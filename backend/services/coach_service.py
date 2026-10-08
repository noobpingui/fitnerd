import logging
from dataclasses import dataclass

from services.retrieval_service import DEFAULT_TOP_K, RetrievalService
from utils.feedback_token import FeedbackTokenSigner
from utils.tracing import Tracer
from utils.llm_client import LLMClient
from utils.rate_limiter import RateLimiter
from exceptions.custom_exceptions import ServiceUnavailableError, RateLimitError

logger = logging.getLogger(__name__)

#Cuantas preguntas puede hacer un mismo usuario en una ventana de 1 hora. A diferencia
#del limite de ProgressAnalysisService (2 CADA 24hs, una accion puntual/rara), el coach
#es una funcionalidad de chat de uso normal - el numero tiene que ser generoso para no
#estorbar una conversacion real, solo cortar un abuso claro (un script, un loop por bug).
MAX_QUESTIONS_PER_WINDOW = 20
RATE_LIMIT_WINDOW_SECONDS = 60 * 60


#El system prompt es la pieza clave para que el agente NO conteste con conocimiento
#general propio del modelo, sino solo con lo que le pasamos como contexto recuperado.
#Separamos las reglas de CONTENIDO (que informacion puede usar) de las reglas de ESTILO
#(como la comunica) - son dos problemas distintos, aunque los resuelva el mismo prompt.
SYSTEM_PROMPT = """Sos un entrenador personal experto en fitness. Respondes con la seguridad y
fluidez de alguien que domina el tema, usando EXCLUSIVAMENTE la informacion que se te proporciona
como contexto en cada mensaje - nunca conocimiento general propio sobre fitness, nutricion o
ciencia del ejercicio que no este explicitamente en ese contexto.

Reglas de contenido:
- Si el contexto contiene la respuesta, respondela basandote solo en esa informacion.
- Si el contexto no contiene informacion suficiente para responder la pregunta, decilo
  explicitamente en vez de inventar o completar con conocimiento general.
- No especules mas alla de lo que dice el contexto.

Reglas de estilo:
- Respondes como un experto que ya sabe esto, no como alguien que esta leyendo o citando una
  fuente.
- Nunca menciones fragmentos, videos, transcripciones, documentos ni "el contexto" - ni para
  citarlos ni para decir que no los tenes. El usuario no debe notar que hay una fuente detras.
- NO utilices frases como "segun el video", "los fragmentos indican", "Segun la informacion que tengo a mano" o "la informacion
  proporcionada dice"."""


@dataclass
class CoachAnswer:
    answer: str
    feedback_id: str | None


class CoachService:
    def __init__(self, retrieval_service: RetrievalService, llm_client: LLMClient, rate_limiter: RateLimiter, tracer: Tracer | None = None, feedback_signer: FeedbackTokenSigner | None = None):
        self.feedback_signer = feedback_signer
        self.retrieval_service = retrieval_service
        self.llm_client = llm_client
        self.rate_limiter = rate_limiter
        #Sin tracer inyectado se usa uno inactivo: no se envía nada a ningún lado.
        self.tracer = tracer if tracer is not None else Tracer()

    #history: turnos anteriores de ESTA conversacion, en formato [{"role": "user"|"assistant",
    #"content": str}, ...] - tal cual los muestra el frontend, sin la "muleta" de contexto
    #que le agregamos a la pregunta actual mas abajo (esa solo se inyecta en el turno nuevo,
    #no se reinyecta contexto viejo en cada mensaje historico). None/vacio = primera pregunta
    #de la conversacion, se comporta identico a como funcionaba antes de esto.
    #
    #user_id se usa para el rate limit (de quien es cada contador en Redis), para la traza
    #y para firmar el feedback_id, que queda ligado a este usuario.
    def ask(self, question: str, user_id: str, history: list[dict] | None = None) -> str:
        return self.ask_with_feedback(question, user_id, history).answer

    def ask_with_feedback(
        self, question: str, user_id: str, history: list[dict] | None = None
    ) -> CoachAnswer:
        #Chequeo de limite ANTES de gastar nada (retrieval + Claude) - a diferencia de
        #ProgressAnalysisService, aca no hay un caso "gratis" que se pueda resolver sin
        #golpear ningun proveedor externo, asi que el chequeo va primero en el metodo,
        #no a mitad de camino.
        allowed = self.rate_limiter.check_and_increment(
            key=f"ratelimit:coach:ask:{user_id}",
            limit=MAX_QUESTIONS_PER_WINDOW,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        )
        if not allowed:
            raise RateLimitError(
                f"Alcanzaste el límite de {MAX_QUESTIONS_PER_WINDOW} preguntas por hora. "
                "Vuelve a intentarlo en un rato."
            )

        #La traza se abre después del límite de uso: un 429 no genera traza.
        trace = self.tracer.start_trace("coach-ask", user_id=str(user_id), input=question)

        try:
            retrieval_query = self._build_retrieval_query(question, history)

            step = trace.start_step(
                "embedding", "generation", retrieval_query, self.retrieval_service.embedding_model
            )
            try:
                vector, tokens = self.retrieval_service.embed(retrieval_query)
            except Exception as exc:
                step.fail(exc)
                raise
            step.end(None, {"input": tokens} if tokens is not None else None)

            threshold = self.retrieval_service.max_distance
            step = trace.start_step(
                "retrieval", "span", {"limit": DEFAULT_TOP_K, "threshold": threshold}
            )
            try:
                candidates = self.retrieval_service.find_candidates(vector, DEFAULT_TOP_K)
            except Exception as exc:
                step.fail(exc)
                raise
            relevant_chunks = [c for c in candidates if self.retrieval_service.is_relevant(c)]
            step.end(
                {
                    "candidates": [
                        {
                            "video_title": c["video_title"],
                            "chunk_text": c["chunk_text"],
                            "distance": c["distance"],
                            "passed_threshold": self.retrieval_service.is_relevant(c),
                        }
                        for c in candidates
                    ],
                    "passed_count": len(relevant_chunks),
                },
                None,
            )
            if candidates:
                trace.add_score(
                    "best_chunk_distance", min(c["distance"] for c in candidates), "NUMERIC"
                )

            if not relevant_chunks:
                #Nada paso el umbral de relevancia - ni llamamos a Claude, evitamos que
                #el modelo tenga que "improvisar" con contexto debil.
                answer = "No tengo informacion relacionada con ese tema en especifico."
                outcome = "dont_know"
            else:
                #Ya no incluimos el titulo del video en el texto que le llega al modelo - le
                #dabamos una "muleta" para citar la fuente, justo lo que no queremos que haga
                #en la respuesta.
                context = "\n\n".join(chunk["chunk_text"] for chunk in relevant_chunks)

                user_message = f"""Fragmentos de contexto:
{context}

Pregunta: {question}"""

                messages = [*(history or []), {"role": "user", "content": user_message}]

                step = trace.start_step("generation", "generation", messages, self.llm_client.model)
                try:
                    result = self.llm_client.generate_with_usage(SYSTEM_PROMPT, messages)
                except Exception as exc:
                    step.fail(exc)
                    raise
                step.end(
                    result.text or "",
                    {"input": result.input_tokens, "output": result.output_tokens},
                )

                if result.text is None:
                    answer = "No pude generar una respuesta para esa pregunta."
                    outcome = "refused"
                else:
                    answer = result.text
                    outcome = "answered"
        except Exception:
            #Cualquier falla de un proveedor externo (Voyage al buscar contexto, Anthropic
            #al generar) - rate limit, timeout, caida del servicio, etc. Se traduce a un
            #error de negocio prolijo (503) en vez de dejar que la excepcion cruda suba
            #hasta el handler generico de Flask, que devolveria un 500 pelado sin mensaje
            #util. El error real SI queda registrado en el log del servidor, solo que el
            #usuario ve un mensaje limpio.
            logger.exception("Fallo un proveedor externo al responder una pregunta del coach")
            trace.add_score("outcome", "error", "CATEGORICAL")
            trace.finish("")
            raise ServiceUnavailableError(
                "No se pudo generar una respuesta en este momento. Intenta de nuevo en unos minutos."
            )

        #Fuera del try de proveedores: un fallo de instrumentación nunca debe ser un 503.
        trace.add_score("outcome", outcome, "CATEGORICAL")
        trace.finish(answer)

        feedback_id = None
        if self.feedback_signer is not None and trace.trace_id is not None:
            feedback_id = self.feedback_signer.sign(user_id, trace.trace_id)
        return CoachAnswer(answer=answer, feedback_id=feedback_id)

    #Truco barato para que las preguntas de seguimiento cortas ("dame mas detalle",
    #"por que pasa eso") no fallen la busqueda semantica - solas no tienen suficiente
    #contenido propio para encontrar contexto relevante. Concatenamos la ULTIMA pregunta
    #del usuario (el turno inmediato anterior) con la actual, en vez de reformular la
    #pregunta con una llamada extra a Claude (mas preciso, pero el doble de latencia/costo
    #por cada mensaje - no vale la pena para el tamano de esta app).
    def _build_retrieval_query(self, question: str, history: list[dict] | None) -> str:
        if not history:
            return question

        previous_questions = [m["content"] for m in history if m.get("role") == "user"]
        if not previous_questions:
            return question

        return f"{previous_questions[-1]} {question}"
