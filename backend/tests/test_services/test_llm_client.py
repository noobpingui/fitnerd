"""LLMClient (utils/llm_client.py) con un cliente de Anthropic de mentira
asignado a `client` - sin red ni mocks. Cubre `generate_with_usage` y que
`generate()` (que usan el coach y ProgressAnalysisService) no cambie.
"""

from types import SimpleNamespace

import anthropic
import pytest

from config import DEFAULT_PORTION_ESTIMATE_MODEL
from tests.fakes import FakeLLMClient, FakeStructuredLLMClient
from tests.fakes_observability import FakeAnthropicClient, FakeApp
from utils.llm_client import (
    GenerationResult,
    LazyLLMClient,
    LLMClient,
    StructuredGenerationResult,
)


def make_client(fake):
    client = LLMClient(model="claude-sonnet-5", api_key="clave-de-prueba")
    client.client = fake
    return client


# SDD: 004 REQ-004 AC-004.1
def test_generate_with_usage_returns_text_and_tokens_from_the_response():
    """Devuelve el texto y los tokens de entrada y salida de `response.usage`."""
    fake = FakeAnthropicClient(text="Haz 3 series de 10.", input_tokens=850, output_tokens=40)
    client = make_client(fake)

    result = client.generate_with_usage("sistema", [{"role": "user", "content": "hola"}])

    assert result == GenerationResult("Haz 3 series de 10.", 850, 40)
    assert fake.calls[0]["model"] == "claude-sonnet-5"
    assert fake.calls[0]["system"] == "sistema"
    assert fake.calls[0]["messages"] == [{"role": "user", "content": "hola"}]


# SDD: 004 REQ-004 AC-004.4
def test_generate_with_usage_marks_a_refusal_with_none_text_and_keeps_tokens():
    """Con `stop_reason == "refusal"` el texto es `None` y los tokens se
    conservan."""
    fake = FakeAnthropicClient(text=None, input_tokens=500, output_tokens=0, stop_reason="refusal")
    client = make_client(fake)

    result = client.generate_with_usage("sistema", [{"role": "user", "content": "hola"}])

    assert result.text is None
    assert result.input_tokens == 500
    assert result.output_tokens == 0


# SDD: 004 REQ-005 AC-005.3
def test_generate_keeps_returning_the_text_and_none_on_refusal():
    """`generate()` mantiene su comportamiento: texto normal y `None` si hay
    rechazo."""
    ok = make_client(FakeAnthropicClient(text="Respuesta normal"))
    refused = make_client(FakeAnthropicClient(text=None, stop_reason="refusal"))

    assert ok.generate("sistema", [{"role": "user", "content": "hola"}]) == "Respuesta normal"
    assert refused.generate("sistema", [{"role": "user", "content": "hola"}]) is None


# SDD: 004 REQ-004 AC-004.4
def test_generate_returns_an_empty_string_when_the_response_has_no_text_block():
    """Sin bloque de texto, `generate()` devuelve cadena vacia como hoy."""
    fake = FakeAnthropicClient(content=[SimpleNamespace(type="tool_use")])
    client = make_client(fake)

    assert client.generate("sistema", [{"role": "user", "content": "hola"}]) == ""


# --- Spec 030: salida estructurada y cliente perezoso ---------------------

TOOL = {
    "name": "report_portion",
    "description": "Informa del peso.",
    "input_schema": {"type": "object", "properties": {}},
}


def tool_use_block(data, name="report_portion"):
    return SimpleNamespace(type="tool_use", name=name, input=data)


# SDD: 030 NFR-001 AC-N001.1
def test_generate_structured_forces_the_tool_and_returns_data_and_tokens():
    """Pasa max_tokens, temperature, tools y tool_choice forzado, y devuelve el
    input de la herramienta con los tokens."""
    fake = FakeAnthropicClient(
        content=[tool_use_block({"is_food": True, "grams": 250})],
        stop_reason="tool_use",
        input_tokens=70,
        output_tokens=25,
    )
    client = make_client(fake)
    messages = [{"role": "user", "content": "5 huevos"}]

    result = client.generate_structured("sistema", messages, TOOL, 150, 0)

    assert isinstance(result, StructuredGenerationResult)
    assert result.data == {"is_food": True, "grams": 250}
    assert result.stop_reason == "tool_use"
    assert result.input_tokens == 70
    assert result.output_tokens == 25
    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["model"] == "claude-sonnet-5"
    assert call["max_tokens"] == 150
    assert "temperature" not in call
    assert call["system"] == "sistema"
    assert call["messages"] == messages
    assert call["tools"] == [TOOL]
    assert call["tool_choice"] == {"type": "tool", "name": "report_portion"}


# SDD: 030 REQ-004 AC-004.2
@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_generate_structured_returns_no_data_on_refusal_or_truncation(stop_reason):
    """Con refusal o max_tokens no hay datos, aunque el contenido traiga algo."""
    fake = FakeAnthropicClient(
        content=[tool_use_block({"is_food": True, "grams": 250})], stop_reason=stop_reason
    )
    client = make_client(fake)

    result = client.generate_structured("sistema", [], TOOL, 150, 0)

    assert result.data is None
    assert result.stop_reason == stop_reason


# SDD: 030 REQ-004 AC-004.3
def test_generate_structured_returns_no_data_without_a_tool_use_block():
    """Sin bloque tool_use, data es None."""
    fake = FakeAnthropicClient(text="hola", stop_reason="end_turn")
    client = make_client(fake)

    assert client.generate_structured("sistema", [], TOOL, 150, 0).data is None


# SDD: 030 REQ-004 AC-004.3
def test_generate_structured_ignores_a_tool_use_block_of_another_tool():
    """Un bloque tool_use con otro nombre no cuenta."""
    fake = FakeAnthropicClient(content=[tool_use_block({"is_food": True}, name="otra")])
    client = make_client(fake)

    assert client.generate_structured("sistema", [], TOOL, 150, 0).data is None


# SDD: 030 REQ-004 AC-004.3
@pytest.mark.parametrize("bad_input", ["texto", ["lista"], None, 5])
def test_generate_structured_returns_no_data_when_the_input_is_not_a_dict(bad_input):
    """Un input que no es dict no se acepta."""
    fake = FakeAnthropicClient(content=[tool_use_block(bad_input)])
    client = make_client(fake)

    assert client.generate_structured("sistema", [], TOOL, 150, 0).data is None


# SDD: 030 REQ-004 AC-004.3
def test_generate_structured_uses_the_first_matching_tool_use_block():
    """Toma el primer bloque tool_use con el nombre de la herramienta."""
    fake = FakeAnthropicClient(
        content=[
            SimpleNamespace(type="text", text="pensando"),
            tool_use_block({"is_food": False}),
            tool_use_block({"is_food": True}),
        ]
    )
    client = make_client(fake)

    assert client.generate_structured("sistema", [], TOOL, 150, 0).data == {"is_food": False}


class FakeClientFactory:
    """Invocable que reemplaza a `LLMClient`: guarda los kwargs de cada
    creación y devuelve un cliente de mentira con `generate_structured`."""

    def __init__(self):
        self.created = []
        self.clients = []

    def __call__(self, **kwargs):
        self.created.append(kwargs)
        client = FakeStructuredLLMClient(data={"is_food": False})
        self.clients.append(client)
        return client


def make_lazy(factory=None, **kwargs):
    return LazyLLMClient(
        "PORTION_ESTIMATE_MODEL",
        DEFAULT_PORTION_ESTIMATE_MODEL,
        client_factory=factory,
        **kwargs,
    )


# SDD: 030 NFR-001 AC-N001.2
def test_lazy_client_uses_the_default_small_model_when_not_configured():
    """Sin PORTION_ESTIMATE_MODEL usa el modelo pequeño por defecto, no el del coach."""
    lazy = make_lazy()

    lazy.init_app(FakeApp({"ANTHROPIC_MODEL": "claude-sonnet-5"}))

    assert lazy.model == DEFAULT_PORTION_ESTIMATE_MODEL
    assert lazy.model != "claude-sonnet-5"
    assert "haiku" in lazy.model


# SDD: 030 NFR-001 AC-N001.2
@pytest.mark.parametrize("configured", [None, "", "   "])
def test_lazy_client_falls_back_to_the_default_for_an_empty_value(configured):
    """Un valor vacío o de espacios equivale a no configurarlo."""
    lazy = make_lazy()

    lazy.init_app(FakeApp({"PORTION_ESTIMATE_MODEL": configured}))

    assert lazy.model == DEFAULT_PORTION_ESTIMATE_MODEL


# SDD: 030 NFR-001 AC-N001.2
def test_lazy_client_uses_the_configured_model():
    """Con PORTION_ESTIMATE_MODEL definido, usa ese modelo."""
    lazy = make_lazy()

    lazy.init_app(FakeApp({"PORTION_ESTIMATE_MODEL": "modelo-x", "ANTHROPIC_MODEL": "otro"}))

    assert lazy.model == "modelo-x"


# SDD: 030 NFR-001 AC-N001.2
def test_lazy_client_creates_the_real_client_on_the_first_call_with_model_and_options():
    """El cliente se crea perezosamente, con modelo, timeout y max_retries, y se reutiliza."""
    factory = FakeClientFactory()
    lazy = make_lazy(factory, timeout=15.0, max_retries=1)
    lazy.init_app(FakeApp({"PORTION_ESTIMATE_MODEL": "modelo-x"}))
    assert factory.created == []

    first = lazy.generate_structured("sistema", [{"role": "user", "content": "a"}], TOOL, 150, 0)
    lazy.generate_structured("sistema", [{"role": "user", "content": "b"}], TOOL, 150, 0)

    assert factory.created == [{"model": "modelo-x", "timeout": 15.0, "max_retries": 1}]
    assert first.data == {"is_food": False}
    assert len(factory.clients[0].calls) == 2
    assert factory.clients[0].calls[0]["max_tokens"] == 150
    assert factory.clients[0].calls[0]["temperature"] == 0


# SDD: 030 NFR-001 AC-N001.2
def test_lazy_client_init_app_discards_a_previously_created_client():
    """Volver a llamar a init_app descarta el cliente creado."""
    factory = FakeClientFactory()
    lazy = make_lazy(factory)
    lazy.init_app(FakeApp({}))
    lazy.generate_structured("sistema", [], TOOL, 150, 0)

    lazy.init_app(FakeApp({"PORTION_ESTIMATE_MODEL": "modelo-y"}))
    lazy.generate_structured("sistema", [], TOOL, 150, 0)

    assert [c["model"] for c in factory.created] == [DEFAULT_PORTION_ESTIMATE_MODEL, "modelo-y"]


class FakeTextClientFactory:
    """Invocable que reemplaza a `LLMClient` con un `FakeLLMClient` (texto)."""

    def __init__(self):
        self.created = []
        self.clients = []

    def __call__(self, **kwargs):
        self.created.append(kwargs)
        client = FakeLLMClient(answer="Haz 3 series de 10.", input_tokens=12, output_tokens=7)
        self.clients.append(client)
        return client


# SDD: 030 REQ-006 AC-006.4
def test_lazy_client_generate_with_usage_creates_the_client_once_and_delegates():
    """El cliente del coach se crea una vez con el modelo configurado, delega
    `generate_with_usage` y se reutiliza en la segunda llamada."""
    factory = FakeTextClientFactory()
    lazy = LazyLLMClient("ANTHROPIC_MODEL", "claude-sonnet-5", client_factory=factory)
    lazy.init_app(FakeApp({"ANTHROPIC_MODEL": "claude-sonnet-5"}))
    messages = [{"role": "user", "content": "hola"}]

    first = lazy.generate_with_usage("sistema", messages, 512)
    second = lazy.generate_with_usage("sistema", messages)

    assert lazy.model == "claude-sonnet-5"
    assert factory.created == [{"model": "claude-sonnet-5", "timeout": None, "max_retries": None}]
    assert first == GenerationResult("Haz 3 series de 10.", 12, 7)
    assert second == first
    assert factory.clients[0].calls == [("sistema", messages), ("sistema", messages)]


# SDD: 030 NFR-001 AC-N001.1
def test_llm_client_passes_timeout_and_max_retries_to_the_sdk_client():
    """Con timeout y max_retries, el cliente del SDK los expone; sin ellos usa
    los valores por defecto del SDK."""
    configured = LLMClient(
        model="m", api_key="clave-de-prueba", timeout=15.0, max_retries=1
    )
    default = LLMClient(model="m", api_key="clave-de-prueba")

    assert configured.client.timeout == 15.0
    assert configured.client.max_retries == 1
    reference = anthropic.Anthropic(api_key="clave-de-prueba")
    assert default.client.timeout == reference.timeout
    assert default.client.max_retries == reference.max_retries
    assert default.client.max_retries != configured.client.max_retries
    assert default.client.timeout != configured.client.timeout
