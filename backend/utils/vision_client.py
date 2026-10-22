"""Adaptador del proveedor de visión (Amazon Bedrock, spec 024)."""

import logging
from dataclasses import dataclass

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

VISION_TIMEOUT_SECONDS = 30
VISION_CONNECT_TIMEOUT_SECONDS = 5
MAX_OUTPUT_TOKENS = 2048
TOOL_DESCRIPTION = "Informa de los alimentos visibles en la foto de una comida."


class VisionProviderError(Exception):
    pass


@dataclass(frozen=True)
class VisionFoodsResult:
    foods: list
    input_tokens: int | None
    output_tokens: int | None


def build_client_config() -> Config:
    """Tiempos acotados y un solo intento: sin reintentos (Q8)."""
    return Config(
        connect_timeout=VISION_CONNECT_TIMEOUT_SECONDS,
        read_timeout=VISION_TIMEOUT_SECONDS,
        retries={"total_max_attempts": 1, "mode": "standard"},
    )


def describe_vision_error(exc: BaseException) -> str:
    """Tipo (y código de servicio) del error, nunca su mensaje: puede llevar la imagen."""
    name = type(exc).__name__
    if isinstance(exc, ClientError):
        code = exc.response.get("Error", {}).get("Code")
        if code:
            return f"{name}: {code}"
    return name


def _token_count(usage: dict, key: str) -> int | None:
    value = usage.get(key)
    return value if isinstance(value, int) and not isinstance(value, bool) else None


class BedrockVisionClient:
    def __init__(self, client_factory=None):
        self.client_factory = client_factory
        self.client = None
        self.model_id = None

    def init_app(self, app) -> None:
        self.model_id = app.config.get("BEDROCK_VISION_MODEL_ID") or None
        self.client = None
        if not self.model_id:
            return
        region = (app.config.get("BEDROCK_REGION") or "").strip()
        if not region:
            logger.warning("Falta BEDROCK_REGION: el análisis de fotos responderá 503.")
            return
        factory = self.client_factory or boto3.client
        try:
            self.client = factory(
                "bedrock-runtime", region_name=region, config=build_client_config()
            )
        except Exception as exc:
            logger.warning(
                "No se pudo crear el cliente de Bedrock (%s): el análisis de fotos responderá 503.",
                describe_vision_error(exc),
            )
            self.client = None

    @property
    def configured(self) -> bool:
        return self.client is not None and bool(self.model_id)

    def recognize_foods(
        self, image: bytes, image_format: str, system_prompt: str, prompt: str
    ) -> VisionFoodsResult:
        # Import local: evita un ciclo entre extensions.py y los servicios.
        from services.meal_image_rules import FOODS_TOOL_NAME, FOODS_TOOL_SCHEMA

        if not self.configured:
            raise VisionProviderError("vision provider not configured")
        response = self.client.converse(
            modelId=self.model_id,
            system=[{"text": system_prompt}],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"image": {"format": image_format, "source": {"bytes": image}}},
                        {"text": prompt},
                    ],
                }
            ],
            inferenceConfig={"maxTokens": MAX_OUTPUT_TOKENS, "temperature": 0},
            toolConfig={
                "tools": [
                    {
                        "toolSpec": {
                            "name": FOODS_TOOL_NAME,
                            "description": TOOL_DESCRIPTION,
                            "inputSchema": {"json": FOODS_TOOL_SCHEMA},
                        }
                    }
                ],
                "toolChoice": {"tool": {"name": FOODS_TOOL_NAME}},
            },
        )
        if response.get("stopReason") == "max_tokens":
            raise VisionProviderError("unexpected vision response")
        content = response.get("output", {}).get("message", {}).get("content", [])
        for block in content:
            tool_use = block.get("toolUse") if isinstance(block, dict) else None
            if isinstance(tool_use, dict) and tool_use.get("name") == FOODS_TOOL_NAME:
                tool_input = tool_use.get("input")
                if not isinstance(tool_input, dict):
                    raise VisionProviderError("unexpected vision response")
                foods = tool_input.get("foods")
                if not isinstance(foods, list):
                    break
                usage = response.get("usage") or {}
                return VisionFoodsResult(
                    foods=foods,
                    input_tokens=_token_count(usage, "inputTokens"),
                    output_tokens=_token_count(usage, "outputTokens"),
                )
        raise VisionProviderError("unexpected vision response")
