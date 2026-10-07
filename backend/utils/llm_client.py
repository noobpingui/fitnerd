from dataclasses import dataclass

import anthropic


@dataclass
class GenerationResult:
    text: str | None
    input_tokens: int | None
    output_tokens: int | None


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
        return self.generate_with_usage(system_prompt, messages, max_tokens).text

    #Igual que generate(), pero devuelve tambien los tokens de entrada y salida.
    def generate_with_usage(
        self, system_prompt: str, messages: list[dict], max_tokens: int = 2048
    ) -> GenerationResult:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        #Un rechazo por seguridad devuelve HTTP 200 igual, pero con content vacio/parcial -
        #hay que chequear stop_reason ANTES de leer response.content.
        if response.stop_reason == "refusal":
            return GenerationResult(None, input_tokens, output_tokens)

        text = next((block.text for block in response.content if block.type == "text"), "")
        return GenerationResult(text, input_tokens, output_tokens)
