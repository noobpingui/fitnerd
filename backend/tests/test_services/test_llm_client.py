"""LLMClient (utils/llm_client.py) con un cliente de Anthropic de mentira
asignado a `client` - sin red ni mocks. Cubre `generate_with_usage` y que
`generate()` (que usan el coach y ProgressAnalysisService) no cambie.
"""

from types import SimpleNamespace

from tests.fakes_observability import FakeAnthropicClient
from utils.llm_client import GenerationResult, LLMClient


def make_client(fake):
    client = LLMClient(model="claude-sonnet-5", api_key="clave-de-prueba")
    client.client = fake
    return client


# SDD: REQ-004 AC-004.1
def test_generate_with_usage_returns_text_and_tokens_from_the_response():
    """Devuelve el texto y los tokens de entrada y salida de `response.usage`."""
    fake = FakeAnthropicClient(text="Haz 3 series de 10.", input_tokens=850, output_tokens=40)
    client = make_client(fake)

    result = client.generate_with_usage("sistema", [{"role": "user", "content": "hola"}])

    assert result == GenerationResult("Haz 3 series de 10.", 850, 40)
    assert fake.calls[0]["model"] == "claude-sonnet-5"
    assert fake.calls[0]["system"] == "sistema"
    assert fake.calls[0]["messages"] == [{"role": "user", "content": "hola"}]


# SDD: REQ-004 AC-004.4
def test_generate_with_usage_marks_a_refusal_with_none_text_and_keeps_tokens():
    """Con `stop_reason == "refusal"` el texto es `None` y los tokens se
    conservan."""
    fake = FakeAnthropicClient(text=None, input_tokens=500, output_tokens=0, stop_reason="refusal")
    client = make_client(fake)

    result = client.generate_with_usage("sistema", [{"role": "user", "content": "hola"}])

    assert result.text is None
    assert result.input_tokens == 500
    assert result.output_tokens == 0


# SDD: REQ-005 AC-005.3
def test_generate_keeps_returning_the_text_and_none_on_refusal():
    """`generate()` mantiene su comportamiento: texto normal y `None` si hay
    rechazo."""
    ok = make_client(FakeAnthropicClient(text="Respuesta normal"))
    refused = make_client(FakeAnthropicClient(text=None, stop_reason="refusal"))

    assert ok.generate("sistema", [{"role": "user", "content": "hola"}]) == "Respuesta normal"
    assert refused.generate("sistema", [{"role": "user", "content": "hola"}]) is None


# SDD: REQ-004 AC-004.4
def test_generate_returns_an_empty_string_when_the_response_has_no_text_block():
    """Sin bloque de texto, `generate()` devuelve cadena vacia como hoy."""
    fake = FakeAnthropicClient(content=[SimpleNamespace(type="tool_use")])
    client = make_client(fake)

    assert client.generate("sistema", [{"role": "user", "content": "hola"}]) == ""
