"""Adaptador del proveedor de visión (Amazon Bedrock, spec 024)."""

from dataclasses import dataclass

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

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
        if not self.model_id:
            self.client = None
            return
        factory = self.client_factory or boto3.client
        self.client = factory(
            "bedrock-runtime",
            region_name=app.config["BEDROCK_REGION"],
            config=build_client_config(),
        )

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
                foods = (tool_use.get("input") or {}).get("foods")
                if not isinstance(foods, list):
                    break
                usage = response.get("usage") or {}
                return VisionFoodsResult(
                    foods=foods,
                    input_tokens=_token_count(usage, "inputTokens"),
                    output_tokens=_token_count(usage, "outputTokens"),
                )
        raise VisionProviderError("unexpected vision response")
