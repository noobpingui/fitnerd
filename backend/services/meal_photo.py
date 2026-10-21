"""Funciones puras para validar y limpiar la foto de una comida (spec 024)."""

from dataclasses import dataclass

MAX_PHOTO_BYTES = 3 * 1024 * 1024
MAX_PHOTO_SIDE = 8000
PHOTO_FORMATS: tuple[str, ...] = ("jpeg", "png", "webp")

PHOTO_REQUIRED_MESSAGE = "Adjunta una foto de la comida."
SINGLE_PHOTO_MESSAGE = "Adjunta una sola foto."
UNSUPPORTED_FORMAT_MESSAGE = "La imagen debe ser JPEG, PNG o WebP."
UNREADABLE_PHOTO_MESSAGE = "No se pudo leer la imagen."
PHOTO_TOO_WIDE_MESSAGE = "La imagen no puede superar los 8000 píxeles por lado."
PHOTO_TOO_LARGE_MESSAGE = "La imagen no puede superar los 3 MB."


@dataclass(frozen=True)
class MealPhoto:
    data: bytes
    format: str
    size_bytes: int
    width: int
    height: int


def detect_photo_format(_data: bytes) -> str | None:
    raise NotImplementedError("not implemented")


def strip_photo_metadata(_data: bytes, _photo_format: str) -> bytes:
    raise NotImplementedError("not implemented")


def prepare_photo(_images: list[bytes]) -> MealPhoto:
    raise NotImplementedError("not implemented")
