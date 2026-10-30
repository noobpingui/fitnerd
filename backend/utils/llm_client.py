from dataclasses import dataclass
from typing import Protocol

import anthropic


@dataclass
class GenerationResult:
    text: str | None
    input_tokens: int | None
    output_tokens: int | None


@dataclass(frozen=True)
class StructuredGenerationResult:
    data: dict | None  #input del bloque tool_use de la herramienta, o None
    stop_reason: str | None
    input_tokens: int | None
    output_tokens: int | None


#Envoltorio sobre el SDK de Anthropic - aisla al resto de la app de su forma especifica
#(messages.create, stop_reason, response.content) para que cambiar de proveedor de LLM el
#dia de manana signifique escribir una clase nueva con este mismo metodo generate(), no
#reescribir los servicios que lo usan (CoachService, ProgressAnalysisService). Mismo
#espiritu que EmbeddingClient en embeddings.py, aplicado a generacion de texto en vez de
#embeddings.
class LLMClient:
    def __init__(
        self,
        model: str,
        api_key: str = None,
        timeout: float | None = None,
        max_retries: int | None = None,
    ):
        #api_key=None -> el SDK de Anthropic busca ANTHROPIC_API_KEY en las variables de
        #entorno solo, igual que hacia el codigo anterior con anthropic.Anthropic() sin
        #argumentos.
        #timeout y max_retries solo se pasan al SDK si no son None.
        sdk_options = {}
        if timeout is not None:
            sdk_options["timeout"] = timeout
        if max_retries is not None:
            sdk_options["max_retries"] = max_retries
        self.client = anthropic.Anthropic(api_key=api_key, **sdk_options)
        self.model = model

    #Salida estructurada con una herramienta forzada (spec 030, ADR-0037).
    #`temperature` se acepta por compatibilidad con los llamadores pero no se envia: el SDK
    #1.0.0 de Anthropic lo quito de messages.create().
    def generate_structured(
        self,
        system_prompt: str,
        messages: list[dict],
        tool: dict,
        max_tokens: int,
        temperature: float,
    ) -> StructuredGenerationResult:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
            tools=[tool],
            tool_choice={"type": "tool", "name": tool["name"]},
        )
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        stop_reason = response.stop_reason
        if stop_reason in ("refusal", "max_tokens"):
            return StructuredGenerationResult(None, stop_reason, input_tokens, output_tokens)

        data = None
        for block in response.content:
            is_tool_block = getattr(block, "type", None) == "tool_use"
            if is_tool_block and getattr(block, "name", None) == tool["name"]:
                candidate = getattr(block, "input", None)
                data = candidate if isinstance(candidate, dict) else None
                break
        return StructuredGenerationResult(data, stop_reason, input_tokens, output_tokens)

    #messages: lista de {"role": "user"|"assistant", "content": str}, en el mismo formato
    #que espera la API de Anthropic - permite mandar turnos anteriores de una conversacion,
    #no solo un mensaje suelto (lo usa CoachService para el chat con memoria).
    #
    #Devuelve el texto generado, o None si Claude rechazo la generacion por seguridad -
    #None (en vez de una string vacia) para que el servicio que llama pueda distinguir
    #"rechazado" de "genero una respuesta corta" y decidir su propio mensaje para ese caso.
    def generate(self, system_prompt: str, messages: list[dict], max_tokens: int = 2048) -> str | None:
        return self.generate_with_usage(system_prompt, messages, max_tokens).text

    #Igual que generate(), pero devuelve también los tokens de entrada y salida.
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


#Contrato mínimo que usa CoachService: lo cumplen LLMClient y LazyLLMClient.
class GenerativeClient(Protocol):
    @property
    def model(self) -> str | None: ...

    def generate_with_usage(
        self, system_prompt: str, messages: list[dict], max_tokens: int = 2048
    ) -> GenerationResult: ...


#Cliente perezoso con modelo propio (spec 030, ADR-0037): el modelo sale de la
#configuración de la app y el cliente real se crea en la primera llamada.
class LazyLLMClient:
    def __init__(
        self,
        model_config_key: str,
        default_model: str,
        timeout: float | None = None,
        max_retries: int | None = None,
        client_factory=None,
    ):
        self.model_config_key = model_config_key
        self.default_model = default_model
        self.timeout = timeout
        self.max_retries = max_retries
        self.client_factory = client_factory
        self.model = None
        self.llm_client = None

    def init_app(self, app) -> None:
        configured = (app.config.get(self.model_config_key) or "").strip()
        self.model = configured or self.default_model
        self.llm_client = None

    def _get_client(self):
        if self.llm_client is None:
            factory = self.client_factory or LLMClient
            self.llm_client = factory(
                model=self.model, timeout=self.timeout, max_retries=self.max_retries
            )
        return self.llm_client

    def generate_with_usage(
        self, system_prompt: str, messages: list[dict], max_tokens: int = 2048
    ) -> GenerationResult:
        return self._get_client().generate_with_usage(system_prompt, messages, max_tokens)

    def generate_structured(
        self,
        system_prompt: str,
        messages: list[dict],
        tool: dict,
        max_tokens: int,
        temperature: float,
    ) -> StructuredGenerationResult:
        return self._get_client().generate_structured(
            system_prompt, messages, tool, max_tokens, temperature
        )
