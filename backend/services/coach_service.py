import logging

from services.retrieval_service import RetrievalService
from utils.llm_client import LLMClient
from exceptions.custom_exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)


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
- No uses frases como "segun el video", "los fragmentos indican" o "la informacion
  proporcionada dice"."""


class CoachService:
    def __init__(self, retrieval_service: RetrievalService, llm_client: LLMClient):
        self.retrieval_service = retrieval_service
        self.llm_client = llm_client

    #history: turnos anteriores de ESTA conversacion, en formato [{"role": "user"|"assistant",
    #"content": str}, ...] - tal cual los muestra el frontend, sin la "muleta" de contexto
    #que le agregamos a la pregunta actual mas abajo (esa solo se inyecta en el turno nuevo,
    #no se reinyecta contexto viejo en cada mensaje historico). None/vacio = primera pregunta
    #de la conversacion, se comporta identico a como funcionaba antes de esto.
    def ask(self, question: str, history: list[dict] | None = None) -> str:
        try:
            retrieval_query = self._build_retrieval_query(question, history)
            relevant_chunks = self.retrieval_service.search(retrieval_query)

            if not relevant_chunks:
                #Nada paso el umbral de relevancia - ni llamamos a Claude, evitamos que
                #el modelo tenga que "improvisar" con contexto debil.
                return "No tengo informacion relacionada con ese tema en especifico."

            #Ya no incluimos el titulo del video en el texto que le llega al modelo - le
            #dabamos una "muleta" para citar la fuente, justo lo que no queremos que haga
            #en la respuesta.
            context = "\n\n".join(chunk["chunk_text"] for chunk in relevant_chunks)

            user_message = f"""Fragmentos de contexto:
{context}

Pregunta: {question}"""

            messages = [*(history or []), {"role": "user", "content": user_message}]

            answer = self.llm_client.generate(SYSTEM_PROMPT, messages)
        except Exception:
            #Cualquier falla de un proveedor externo (Voyage al buscar contexto, Anthropic
            #al generar) - rate limit, timeout, caida del servicio, etc. Se traduce a un
            #error de negocio prolijo (503) en vez de dejar que la excepcion cruda suba
            #hasta el handler generico de Flask, que devolveria un 500 pelado sin mensaje
            #util. El error real SI queda registrado en el log del servidor, solo que el
            #usuario ve un mensaje limpio.
            logger.exception("Fallo un proveedor externo al responder una pregunta del coach")
            raise ServiceUnavailableError(
                "No se pudo generar una respuesta en este momento. Intenta de nuevo en unos minutos."
            )

        if answer is None:
            return "No pude generar una respuesta para esa pregunta."

        return answer

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
