"""Adaptador del proveedor de visión (Amazon Bedrock, spec 024)."""

from dataclasses import dataclass

VISION_TIMEOUT_SECONDS = 30
VISION_CONNECT_TIMEOUT_SECONDS = 5


class VisionProviderError(Exception):
    pass


@dataclass(frozen=True)
class VisionFoodsResult:
    foods: list
    input_tokens: int | None
    output_tokens: int | None


def build_client_config():
    raise NotImplementedError("not implemented")


def describe_vision_error(_exc: BaseException) -> str:
    raise NotImplementedError("not implemented")


class BedrockVisionClient:
    def __init__(self, client_factory=None):
        self.client_factory = client_factory
        self.client = None
        self.model_id = None

    def init_app(self, _app) -> None:
        raise NotImplementedError("not implemented")

    @property
    def configured(self) -> bool:
        raise NotImplementedError("not implemented")

    def recognize_foods(
        self, _image: bytes, _image_format: str, _system_prompt: str, _prompt: str
    ) -> VisionFoodsResult:
        raise NotImplementedError("not implemented")
