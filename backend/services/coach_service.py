from services.retrieval_service import RetrievalService
from utils.llm_client import LLMClient


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

    def ask(self, question: str) -> str:
        relevant_chunks = self.retrieval_service.search(question)

        if not relevant_chunks:
            #Nada paso el umbral de relevancia - ni llamamos a Claude, evitamos que
            #el modelo tenga que "improvisar" con contexto debil.
            return "No tengo informacion relacionada con ese tema en especifico."

        #Ya no incluimos el titulo del video en el texto que le llega al modelo - le dabamos
        #una "muleta" para citar la fuente, justo lo que no queremos que haga en la respuesta.
        context = "\n\n".join(chunk["chunk_text"] for chunk in relevant_chunks)

        user_message = f"""Fragmentos de contexto:
{context}

Pregunta: {question}"""

        answer = self.llm_client.generate(SYSTEM_PROMPT, user_message)

        if answer is None:
            return "No pude generar una respuesta para esa pregunta."

        return answer
