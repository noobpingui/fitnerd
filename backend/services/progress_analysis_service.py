import logging
from dataclasses import dataclass
from datetime import date, timedelta

from repositories.body_metric_repository import BodyMetricRepository
from repositories.progress_analysis_repository import ProgressAnalysisRepository
from repositories.user_profile_repository import UserProfileRepository
from repositories.user_repository import UserRepository
from models.progress_analysis import ProgressAnalysis
from services.calorie_suggestion import CalorieSuggestion, suggest_calories
from services.profile_service import age_on, utc_now
from services.progress_analysis_context import build_user_message, parse_analysis_request
from unit_of_work.unit_of_work import UnitOfWork
from utils.llm_client import LLMClient
from exceptions.custom_exceptions import (
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
)

logger = logging.getLogger(__name__)

#Cuantos analisis puede pedir un mismo usuario en una ventana de 24hs. Existe para que
#nadie (ni por error, ni con un script) pueda correr cientos de analisis seguidos
#"quemando" tokens de la cuenta de Anthropic - cada analisis real le pega a Claude.
MAX_ANALYSES_PER_WINDOW = 2
RATE_LIMIT_WINDOW = timedelta(hours=24)

NO_PROFILE_MESSAGE = "Completa tu perfil para poder generar un análisis."
NO_DATA_MESSAGE = (
    "Todavía no hay registros de métricas en los últimos 12 meses. "
    "Registra al menos uno para poder generar un análisis."
)


@dataclass(frozen=True)
class AnalysisResult:
    analysis: str
    calorie_suggestion: CalorieSuggestion | None


# Separa las reglas de CONTENIDO de las de ESTILO. El "contexto" es el perfil, los
# indicadores, las calorías y el historial de métricas del propio usuario.
PROGRESS_ANALYSIS_SYSTEM_PROMPT = (
    "Eres un entrenador personal experto en fitness. Analizas el perfil, los indicadores de "
    "progreso, las calorías y el historial de métricas corporales (peso, porcentaje de grasa "
    "corporal y porcentaje de masa muscular) de un usuario, correspondiente a los últimos "
    "12 meses.\n\n"
    "Reglas de contenido:\n"
    "- Básate exclusivamente en los datos que se te dan. Nunca inventes valores, fechas ni "
    "tendencias que no estén reflejados en la información proporcionada.\n"
    "- Puedes comentar el perfil, la meta, los indicadores y las calorías recibidos.\n"
    "- Identifica tendencias reales (subida, bajada, estancamiento, constancia o falta de "
    "constancia en el registro) solo si los datos las respaldan.\n"
    "- Si hay pocos registros, están muy espaciados en el tiempo o faltan campos, dilo "
    "explícitamente y aclara que las conclusiones son limitadas. Nunca fuerces una lectura "
    "firme con datos insuficientes.\n"
    "- Usa solo las cifras de calorías que recibes y no propongas otras cifras de calorías.\n"
    "- Si no recibes un ajuste de calorías porque no hay ritmo, di que faltan datos recientes "
    "para ajustar las calorías.\n"
    "- Sé coherente con el estado del ritmo que recibes.\n"
    "- No recetes dietas, alimentos concretos ni rutinas de ejercicio.\n\n"
    "Reglas de estilo:\n"
    "- Responde como un entrenador que ya revisó los datos, con un tono profesional y "
    "alentador, no clínico ni frío.\n"
    "- Responde en español neutro, sin voseo ni regionalismos, en un par de párrafos como mucho."
)


class ProgressAnalysisService:
    def __init__(
        self,
        body_metric_repository: BodyMetricRepository,
        progress_analysis_repository: ProgressAnalysisRepository,
        user_repository: UserRepository,
        user_profile_repository: UserProfileRepository,
        unit_of_work: UnitOfWork,
        llm_client: LLMClient,
        clock=utc_now,
    ):
        self.body_metric_repository = body_metric_repository
        self.progress_analysis_repository = progress_analysis_repository
        self.user_repository = user_repository
        self.user_profile_repository = user_profile_repository
        self.unit_of_work = unit_of_work
        self.llm_client = llm_client
        self.clock = clock

    def analyze(self, user_id, data, months: int = 12) -> AnalysisResult:
        # Sin perfil no hay contexto: se rechaza antes de mirar datos o el límite,
        # para que ese intento no consuma nada (REQ-009).
        profile = self.user_profile_repository.get_by_user_id(user_id)
        if profile is None:
            raise ConflictError(NO_PROFILE_MESSAGE)

        today = self.clock().date()
        metrics = self.body_metric_repository.list_by_user(user_id)
        cutoff = self._months_ago(months, today)
        recent = [m for m in metrics if m.recorded_at >= cutoff]

        if not recent:
            # Sin nada que analizar no se llama a Claude ni se cuenta contra el límite
            # (mismo criterio que CoachService.ask() sin contexto relevante).
            return AnalysisResult(NO_DATA_MESSAGE, None)

        request = parse_analysis_request(data, today)

        self._check_rate_limit(user_id)

        user = self.user_repository.get_by_id(user_id)
        date_of_birth = user.date_of_birth if user is not None else None
        age = (
            age_on(date_of_birth, date.fromisoformat(request.today))
            if date_of_birth is not None
            else None
        )

        suggestion = suggest_calories(
            request.pace_status,
            request.rate_kg_per_week,
            request.latest_weight_kg,
            profile.goal,
            profile.gender,
            request.calories.target_kcal,
        )

        # El repositorio devuelve del más nuevo al más viejo; el mensaje usa orden cronológico.
        recent_chronological = sorted(recent, key=lambda m: m.recorded_at)
        user_message = build_user_message(
            profile, age, request, recent_chronological, suggestion, months
        )

        # El intento se registra ANTES de llamar a Claude: si la llamada falla a mitad de
        # camino igual pudo consumir tokens, así que cuenta contra el límite.
        self.progress_analysis_repository.create(ProgressAnalysis(user_id=user_id))
        self.unit_of_work.commit()

        try:
            answer = self.llm_client.generate(
                PROGRESS_ANALYSIS_SYSTEM_PROMPT,
                [{"role": "user", "content": user_message}],
            )
        except Exception:
            # Una falla de Anthropic se traduce a un 503 prolijo en vez de un 500.
            logger.exception("Fallo Anthropic al generar el analisis de progreso")
            raise ServiceUnavailableError(
                "No se pudo generar el analisis en este momento. Intenta de nuevo en unos minutos."
            )

        if answer is None:
            return AnalysisResult("No pude generar un analisis en este momento.", suggestion)

        return AnalysisResult(answer, suggestion)

    def _check_rate_limit(self, user_id):
        count = self.progress_analysis_repository.count_since(user_id, RATE_LIMIT_WINDOW)

        if count >= MAX_ANALYSES_PER_WINDOW:
            raise RateLimitError(
                f"Alcanzaste el límite de {MAX_ANALYSES_PER_WINDOW} análisis cada 24 horas. "
                "Vuelve a intentarlo más tarde."
            )

    #Equivalente en Python a "restale N meses a hoy", manejando el rollover de anio/mes a
    #mano (Python no tiene un metodo built-in para esto sin la libreria dateutil, que no
    #esta entre las dependencias del proyecto - no vale la pena agregarla solo por esto).
    def _months_ago(self, months: int, today: date) -> date:
        total_months = today.month - 1 - months
        year = today.year + total_months // 12
        month = total_months % 12 + 1

        #Clamp del dia a 28 para evitar fechas invalidas (ej: 31 de agosto menos 6 meses
        #no existe como "31 de febrero") - una diferencia de un par de dias no importa para
        #una ventana de "ultimos 12 meses" aproximada.
        day = min(today.day, 28)

        return date(year, month, day)
