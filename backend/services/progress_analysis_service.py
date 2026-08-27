import logging
from datetime import date, timedelta

from repositories.body_metric_repository import BodyMetricRepository
from repositories.progress_analysis_repository import ProgressAnalysisRepository
from models.progress_analysis import ProgressAnalysis
from unit_of_work.unit_of_work import UnitOfWork
from utils.llm_client import LLMClient
from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError

logger = logging.getLogger(__name__)

#Cuantos analisis puede pedir un mismo usuario en una ventana de 24hs. Existe para que
#nadie (ni por error, ni con un script) pueda correr cientos de analisis seguidos
#"quemando" tokens de la cuenta de Anthropic - cada analisis real le pega a Claude.
MAX_ANALYSES_PER_WINDOW = 2
RATE_LIMIT_WINDOW = timedelta(hours=24)


#Mismo espiritu que el SYSTEM_PROMPT de CoachService (separar reglas de CONTENIDO de reglas
#de ESTILO), pero para una tarea distinta: acá no hay retrieval de transcripciones, el
#"contexto" es el propio historial de metricas corporales del usuario.
PROGRESS_ANALYSIS_SYSTEM_PROMPT = """Sos un entrenador personal experto en fitness, analizando el
historial de metricas corporales (peso, porcentaje de grasa corporal, porcentaje de masa muscular)
de un usuario, correspondiente a los ultimos 12 meses.

Reglas de contenido:
- Basate EXCLUSIVAMENTE en los datos que se te dan - nunca inventes valores, fechas ni tendencias
  que no esten reflejados en la informacion proporcionada.
- Identifica tendencias reales (subida, bajada, estancamiento, consistencia o falta de consistencia
  en el registro) solo si los datos concretamente las respaldan.
- Si hay pocos registros, estan muy espaciados en el tiempo, o faltan campos (por ejemplo, solo hay
  peso pero nunca se cargo % de grasa), decilo explicitamente y aclara que las conclusiones son
  limitadas - nunca fuerces una lectura firme con datos insuficientes.
- No receta rutinas de ejercicio, dietas ni consejos nutricionales genericos que no se desprendan
  directamente de los numeros - esto es una LECTURA de los datos, no un plan de entrenamiento.

Reglas de estilo:
- Respondes como un entrenador que ya reviso los datos, con un tono profesional y alentador, no
  clinico ni frio.
- Se conciso: un par de parrafos como mucho, no una lista exhaustiva de cada numero registrado.
- En tu comunicacion, utiliza un espanol de latinoamerica, con acentro neutro y NO utilices modismos
  (evita cosas como che, mae, etc). Emplea un tono profesional."""



class ProgressAnalysisService:
    def __init__(
        self,
        body_metric_repository: BodyMetricRepository,
        progress_analysis_repository: ProgressAnalysisRepository,
        unit_of_work: UnitOfWork,
        llm_client: LLMClient,
    ):
        self.body_metric_repository = body_metric_repository
        self.progress_analysis_repository = progress_analysis_repository
        self.unit_of_work = unit_of_work
        self.llm_client = llm_client

    def analyze(self, user_id, months: int = 12) -> str:
        metrics = self.body_metric_repository.list_by_user(user_id)

        cutoff = self._months_ago(months)
        recent = [m for m in metrics if m.recorded_at >= cutoff]

        if not recent:
            #Sin nada que analizar, ni llamamos a Claude - mismo criterio que
            #CoachService.ask() cuando el retrieval no encuentra contexto relevante.
            #A proposito ANTES del chequeo de limite: esto no gasta tokens, no tiene
            #sentido que le cueste una de las 2 corridas del dia al usuario.
            return ("Todavia no hay registros de metricas en los ultimos 12 meses. "
                    "Carga al menos uno para poder generar un analisis.")

        self._check_rate_limit(user_id)

        #El repositorio devuelve mas nuevo -> mas viejo (para la lista del historial) - para
        #el prompt conviene orden cronologico, mismo criterio que usan los charts del frontend.
        recent_chronological = sorted(recent, key=lambda m: m.recorded_at)
        context = self._format_metrics(recent_chronological)

        user_message = f"Historial de metricas corporales (ultimos {months} meses):\n{context}"

        #Logueamos el intento ANTES de llamar a Claude, no despues de una respuesta
        #exitosa - si la llamada falla a mitad de camino igual pudo haber consumido
        #tokens del lado de Anthropic, asi que cuenta como una de las 2 del dia.
        self.progress_analysis_repository.create(ProgressAnalysis(user_id=user_id))
        self.unit_of_work.commit()

        try:
            answer = self.llm_client.generate(
                PROGRESS_ANALYSIS_SYSTEM_PROMPT,
                [{"role": "user", "content": user_message}],
            )
        except Exception:
            #Mismo criterio que CoachService.ask(): una falla de Anthropic (rate limit,
            #timeout, etc.) se traduce a un 503 prolijo en vez de un 500 pelado. El intento
            #ya quedo logueado arriba (cuenta contra el limite de 2/dia igual, ver el
            #comentario de mas arriba sobre por que).
            logger.exception("Fallo Anthropic al generar el analisis de progreso")
            raise ServiceUnavailableError(
                "No se pudo generar el analisis en este momento. Intenta de nuevo en unos minutos."
            )

        if answer is None:
            return "No pude generar un analisis en este momento."

        return answer

    def _check_rate_limit(self, user_id):
        count = self.progress_analysis_repository.count_since(user_id, RATE_LIMIT_WINDOW)

        if count >= MAX_ANALYSES_PER_WINDOW:
            raise RateLimitError(
                f"Alcanzaste el limite de {MAX_ANALYSES_PER_WINDOW} analisis cada 24 horas. "
                "Volve a intentarlo mas tarde."
            )

    def _format_metrics(self, metrics) -> str:
        lines = []
        for metric in metrics:
            parts = []
            if metric.weight is not None:
                parts.append(f"peso {metric.weight}kg")
            if metric.body_fat_percentage is not None:
                parts.append(f"grasa corporal {metric.body_fat_percentage}%")
            if metric.muscle_mass_percentage is not None:
                parts.append(f"masa muscular {metric.muscle_mass_percentage}%")
            if metric.notes:
                parts.append(f'notas: "{metric.notes}"')

            lines.append(f"{metric.recorded_at.isoformat()}: {', '.join(parts)}")

        return "\n".join(lines)

    #Equivalente en Python a "restale N meses a hoy", manejando el rollover de anio/mes a
    #mano (Python no tiene un metodo built-in para esto sin la libreria dateutil, que no
    #esta entre las dependencias del proyecto - no vale la pena agregarla solo por esto).
    def _months_ago(self, months: int) -> date:
        today = date.today()

        total_months = today.month - 1 - months
        year = today.year + total_months // 12
        month = total_months % 12 + 1

        #Clamp del dia a 28 para evitar fechas invalidas (ej: 31 de agosto menos 6 meses
        #no existe como "31 de febrero") - una diferencia de un par de dias no importa para
        #una ventana de "ultimos 12 meses" aproximada.
        day = min(today.day, 28)

        return date(year, month, day)
