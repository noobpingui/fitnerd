"""Tests UNITARIOS del adaptador `BedrockVisionClient` (spec 024). El cliente de
boto3 es un `FakeBedrockRuntimeClient` inyectado a través de la fábrica del
constructor: nada sale a la red ni a AWS.
"""

import pytest
from botocore.exceptions import ClientError, ParamValidationError, ReadTimeoutError

from services.meal_image_rules import FOODS_TOOL_NAME, FOODS_TOOL_SCHEMA
from tests.fakes import FakeBedrockRuntimeClient
from tests.fakes_observability import FakeApp
from utils.vision_client import (
    BedrockVisionClient,
    VisionFoodsResult,
    VisionProviderError,
    build_client_config,
    describe_vision_error,
)

MODEL_ID = "us.fake.vision-model-v1:0"
REGION = "us-east-2"
IMAGE = b"\xff\xd8\xff\xe0fake-image-bytes"
RICE = {"catalog_id": "arroz-blanco-cocido", "name": "Arroz", "grams": 150, "confidence": "high"}


class FakeClientFactory:
    """Sustituye a `boto3.client`: guarda los argumentos y devuelve `client`."""

    def __init__(self, client):
        self.client = client
        self.calls = []

    def __call__(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.client


def make_vision(runtime=None, model_id=MODEL_ID):
    """Cliente de visión ya inicializado con un cliente de Bedrock de mentira."""
    runtime = runtime if runtime is not None else FakeBedrockRuntimeClient(foods=[RICE])
    factory = FakeClientFactory(runtime)
    vision = BedrockVisionClient(client_factory=factory)
    vision.init_app(FakeApp({"BEDROCK_VISION_MODEL_ID": model_id, "BEDROCK_REGION": REGION}))
    return vision, runtime, factory


# SDD: 024 REQ-009 AC-009.4
@pytest.mark.parametrize("model_id", [None, ""])
def test_init_app_without_a_model_leaves_the_client_unconfigured(model_id):
    """Sin modelo configurado: `client` es None, no está configurado y la
    fábrica no se llama."""
    factory = FakeClientFactory(FakeBedrockRuntimeClient())
    vision = BedrockVisionClient(client_factory=factory)

    vision.init_app(FakeApp({"BEDROCK_VISION_MODEL_ID": model_id, "BEDROCK_REGION": REGION}))

    assert vision.client is None
    assert vision.configured is False
    assert factory.calls == []


# SDD: 024 REQ-009 AC-009.4
def test_recognize_foods_without_configuration_raises_a_provider_error():
    """Sin configurar, `recognize_foods` lanza `VisionProviderError`."""
    vision = BedrockVisionClient(client_factory=FakeClientFactory(FakeBedrockRuntimeClient()))
    vision.init_app(FakeApp({"BEDROCK_VISION_MODEL_ID": None, "BEDROCK_REGION": REGION}))

    with pytest.raises(VisionProviderError):
        vision.recognize_foods(IMAGE, "jpeg", "sistema", "texto")


# SDD: 024 REQ-009 AC-009.1
def test_init_app_with_a_model_builds_the_client_with_region_and_timeouts():
    """Con modelo, la fábrica recibe `bedrock-runtime`, la región y una
    configuración con 30 s de lectura y un solo intento."""
    vision, runtime, factory = make_vision()

    assert vision.model_id == MODEL_ID
    assert vision.client is runtime
    assert vision.configured is True
    assert len(factory.calls) == 1
    args, kwargs = factory.calls[0]
    assert args == ("bedrock-runtime",)
    assert kwargs["region_name"] == REGION
    config = kwargs["config"]
    assert config.read_timeout == 30
    assert config.connect_timeout == 5
    assert config.retries["total_max_attempts"] == 1


# SDD: 024 REQ-009 AC-009.1
def test_build_client_config_uses_a_30_second_read_timeout_and_no_retries():
    """La configuración del cliente: lectura de 30 s y sin reintentos (Q8)."""
    config = build_client_config()

    assert config.read_timeout == 30
    assert config.connect_timeout == 5
    assert config.retries["total_max_attempts"] == 1


# SDD: 024 REQ-001 AC-001.2
@pytest.mark.parametrize("image_format", ["jpeg", "png", "webp"])
def test_converse_request_carries_the_image_and_its_format(image_format):
    """La petición lleva la imagen, su formato, el texto y el modelo."""
    vision, runtime, _ = make_vision()

    vision.recognize_foods(IMAGE, image_format, "instrucciones", "lista de alimentos")

    assert len(runtime.calls) == 1
    call = runtime.calls[0]
    assert call["modelId"] == MODEL_ID
    assert call["system"] == [{"text": "instrucciones"}]
    assert runtime.last_image() == (IMAGE, image_format)
    assert runtime.last_prompt() == "lista de alimentos"
    assert call["messages"][0]["role"] == "user"


# SDD: 024 REQ-001 AC-001.2
def test_converse_request_forces_the_foods_tool():
    """El uso de la herramienta `report_foods` es obligatorio y su esquema es
    el de las reglas."""
    vision, runtime, _ = make_vision()

    vision.recognize_foods(IMAGE, "jpeg", "s", "p")

    tool_config = runtime.calls[0]["toolConfig"]
    assert tool_config["toolChoice"] == {"tool": {"name": FOODS_TOOL_NAME}}
    tool_spec = tool_config["tools"][0]["toolSpec"]
    assert tool_spec["name"] == FOODS_TOOL_NAME
    assert tool_spec["inputSchema"] == {"json": FOODS_TOOL_SCHEMA}


# SDD: 024 REQ-001 AC-001.2
def test_recognize_foods_returns_the_unsanitized_list_and_token_usage():
    """Devuelve la lista del modelo tal cual y los tokens de `usage`."""
    runtime = FakeBedrockRuntimeClient(foods=[RICE], input_tokens=321, output_tokens=45)
    vision, _, _ = make_vision(runtime)

    result = vision.recognize_foods(IMAGE, "jpeg", "s", "p")

    assert result == VisionFoodsResult([RICE], 321, 45)


# SDD: 024 REQ-009 AC-009.2
def test_text_only_response_is_not_interpretable():
    """Un mensaje con solo texto («No puedo ayudar con eso») lanza
    `VisionProviderError`."""
    runtime = FakeBedrockRuntimeClient(text="No puedo ayudar con eso")
    vision, _, _ = make_vision(runtime)

    with pytest.raises(VisionProviderError):
        vision.recognize_foods(IMAGE, "jpeg", "s", "p")


# SDD: 024 REQ-009 AC-009.2
def test_max_tokens_stop_reason_is_not_interpretable():
    """Una respuesta cortada por `max_tokens` no es fiable: error del proveedor."""
    runtime = FakeBedrockRuntimeClient(foods=[RICE], stop_reason="max_tokens")
    vision, _, _ = make_vision(runtime)

    with pytest.raises(VisionProviderError):
        vision.recognize_foods(IMAGE, "jpeg", "s", "p")


# SDD: 024 REQ-009 AC-009.2
def test_foods_that_are_not_a_list_are_not_interpretable():
    """Si `foods` de la herramienta no es una lista, error del proveedor."""

    class WrongShapeClient:
        def converse(self, **kwargs):
            return {
                "output": {
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "toolUse": {
                                    "toolUseId": "t",
                                    "name": "report_foods",
                                    "input": {"foods": "arroz"},
                                }
                            }
                        ],
                    }
                },
                "stopReason": "tool_use",
                "usage": {"inputTokens": 1, "outputTokens": 1},
            }

    vision, _, _ = make_vision(WrongShapeClient())

    with pytest.raises(VisionProviderError):
        vision.recognize_foods(IMAGE, "jpeg", "s", "p")


# SDD: 024 REQ-009 AC-009.1
def test_botocore_errors_propagate_unchanged():
    """Los errores de botocore (tiempo agotado, rechazo del servicio) no se
    envuelven: el servicio los traduce a 503."""
    timeout = ReadTimeoutError(endpoint_url="https://bedrock.example")
    vision, _, _ = make_vision(FakeBedrockRuntimeClient(raise_error=timeout))

    with pytest.raises(ReadTimeoutError):
        vision.recognize_foods(IMAGE, "jpeg", "s", "p")


# SDD: 024 REQ-009 NFR-001 AC-N001.2
def test_describe_vision_error_gives_type_and_code_for_a_client_error():
    """`ClientError`: tipo y código de servicio, sin el mensaje."""
    error = ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": "mensaje interno"}}, "Converse"
    )

    description = describe_vision_error(error)

    assert description == "ClientError: ThrottlingException"
    assert "mensaje interno" not in description


# SDD: 024 REQ-009 NFR-001 AC-N001.2
def test_describe_vision_error_never_includes_the_image_bytes():
    """El mensaje de un `ParamValidationError` lleva los bytes de la imagen:
    la descripción solo trae el nombre del tipo."""
    secret = "SECRET-IMAGE-BYTES-0123456789"
    error = ParamValidationError(report=f"Invalid value b'{secret}' for bytes")
    assert secret in str(error)

    description = describe_vision_error(error)

    assert secret not in description
    assert description == "ParamValidationError"


# SDD: 024 REQ-009 NFR-001 AC-N001.2
def test_describe_vision_error_of_a_generic_exception_is_its_type_name():
    """Una excepción cualquiera: solo el nombre del tipo, nunca `str(exc)`."""
    assert describe_vision_error(RuntimeError("detalle privado")) == "RuntimeError"
