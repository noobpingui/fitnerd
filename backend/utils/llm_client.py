import anthropic


#Envoltorio sobre el SDK de Anthropic - aisla al resto de la app de su forma especifica
#(messages.create, stop_reason, response.content) para que cambiar de proveedor de LLM el
#dia de manana signifique escribir una clase nueva con este mismo metodo generate(), no
#reescribir los servicios que lo usan (CoachService, ProgressAnalysisService). Mismo
#espiritu que EmbeddingClient en embeddings.py, aplicado a generacion de texto en vez de
#embeddings.
class LLMClient:
    def __init__(self, model: str, api_key: str = None):
        #api_key=None -> el SDK de Anthropic busca ANTHROPIC_API_KEY en las variables de
        #entorno solo, igual que hacia el codigo anterior con anthropic.Anthropic() sin
        #argumentos.
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    #messages: lista de {"role": "user"|"assistant", "content": str}, en el mismo formato
    #que espera la API de Anthropic - permite mandar turnos anteriores de una conversacion,
    #no solo un mensaje suelto (lo usa CoachService para el chat con memoria).
    #
    #Devuelve el texto generado, o None si Claude rechazo la generacion por seguridad -
    #None (en vez de una string vacia) para que el servicio que llama pueda distinguir
    #"rechazado" de "genero una respuesta corta" y decidir su propio mensaje para ese caso.
    def generate(self, system_prompt: str, messages: list[dict], max_tokens: int = 2048) -> str | None:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )

        #Un rechazo por seguridad devuelve HTTP 200 igual, pero con content vacio/parcial -
        #hay que chequear stop_reason ANTES de leer response.content.
        if response.stop_reason == "refusal":
            return None

        return next((block.text for block in response.content if block.type == "text"), "")
