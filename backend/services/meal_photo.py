"""Funciones puras para validar y limpiar la foto de una comida (spec 024)."""

import io
from dataclasses import dataclass

from PIL import Image

from exceptions.custom_exceptions import PayloadTooLargeError, ValidationError

MAX_PHOTO_BYTES = 3 * 1024 * 1024
MAX_PHOTO_SIDE = 8000
PHOTO_FORMATS: tuple[str, ...] = ("jpeg", "png", "webp")

PHOTO_REQUIRED_MESSAGE = "Adjunta una foto de la comida."
SINGLE_PHOTO_MESSAGE = "Adjunta una sola foto."
UNSUPPORTED_FORMAT_MESSAGE = "La imagen debe ser JPEG, PNG o WebP."
UNREADABLE_PHOTO_MESSAGE = "No se pudo leer la imagen."
PHOTO_TOO_WIDE_MESSAGE = "La imagen no puede superar los 8000 píxeles por lado."
PHOTO_TOO_LARGE_MESSAGE = "La imagen no puede superar los 3 MB."

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_PNG_KEPT_CHUNKS = frozenset(
    {
        b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"gAMA", b"cHRM", b"sRGB",
        b"sBIT", b"bKGD", b"pHYs", b"acTL", b"fcTL", b"fdAT",
    }
)
_WEBP_KEPT_CHUNKS = frozenset({b"VP8 ", b"VP8L", b"VP8X", b"ALPH", b"ANIM", b"ANMF"})
_PILLOW_FORMATS = {"jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}


@dataclass(frozen=True)
class MealPhoto:
    data: bytes
    format: str
    size_bytes: int
    width: int
    height: int


def detect_photo_format(data: bytes) -> str | None:
    """Formato real por los bytes mágicos; None si no es JPEG, PNG ni WebP."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(_PNG_SIGNATURE):
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _strip_jpeg(data: bytes) -> bytes:
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("jpeg sin SOI")
    total = len(data)
    out = bytearray(b"\xff\xd8")
    pos = 2
    seen_sof = False
    seen_sos = False
    while pos < total:
        if data[pos] != 0xFF:
            raise ValueError("marcador jpeg esperado")
        while pos < total and data[pos] == 0xFF:
            pos += 1
        if pos >= total:
            break
        marker = data[pos]
        pos += 1
        if marker == 0xD9:
            if not (seen_sof and seen_sos):
                raise ValueError("jpeg sin SOF o sin SOS")
            out += b"\xff\xd9"
            return bytes(out)
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            if marker > 0xC2:
                raise ValueError("proceso jpeg no admitido")
            seen_sof = True
        if marker == 0xDA:
            seen_sos = True
        if marker == 0x01 or 0xD0 <= marker <= 0xD8:
            out += bytes([0xFF, marker])
            continue
        if pos + 2 > total:
            raise ValueError("segmento jpeg truncado")
        length = int.from_bytes(data[pos : pos + 2], "big")
        if length < 2 or pos + length > total:
            raise ValueError("segmento jpeg fuera del archivo")
        segment = data[pos : pos + length]
        pos += length
        if not (0xE1 <= marker <= 0xED or marker in (0xEF, 0xFE)):
            out += bytes([0xFF, marker]) + segment
        if marker == 0xDA:
            scan_end = pos
            while scan_end < total - 1:
                following = data[scan_end + 1]
                if (
                    data[scan_end] == 0xFF
                    and following not in (0x00, 0xFF)
                    and not 0xD0 <= following <= 0xD7
                ):
                    break
                scan_end += 1
            if scan_end >= total - 1:
                raise ValueError("jpeg sin EOI")
            out += data[pos:scan_end]
            pos = scan_end
    raise ValueError("jpeg sin EOI")


def _strip_png(data: bytes) -> bytes:
    if not data.startswith(_PNG_SIGNATURE):
        raise ValueError("png sin firma")
    total = len(data)
    out = bytearray(_PNG_SIGNATURE)
    pos = len(_PNG_SIGNATURE)
    while pos + 12 <= total:
        length = int.from_bytes(data[pos : pos + 4], "big")
        end = pos + 12 + length
        if end > total:
            raise ValueError("chunk png fuera del archivo")
        chunk_type = data[pos + 4 : pos + 8]
        if chunk_type in _PNG_KEPT_CHUNKS:
            out += data[pos:end]
        pos = end
        if chunk_type == b"IEND":
            return bytes(out)
    raise ValueError("png sin IEND")


def _strip_webp(data: bytes) -> bytes:
    if detect_photo_format(data) != "webp":
        raise ValueError("webp sin cabecera RIFF")
    riff_end = 8 + int.from_bytes(data[4:8], "little")
    if riff_end > len(data):
        raise ValueError("webp truncado")
    chunks = bytearray()
    pos = 12
    while pos + 8 <= riff_end:
        chunk_type = data[pos : pos + 4]
        size = int.from_bytes(data[pos + 4 : pos + 8], "little")
        padded = size + (size & 1)
        end = pos + 8 + padded
        if end > riff_end:
            raise ValueError("chunk webp fuera del archivo")
        if chunk_type in _WEBP_KEPT_CHUNKS:
            body = bytearray(data[pos + 8 : end])
            if chunk_type == b"VP8X":
                if size < 1:
                    raise ValueError("VP8X vacío")
                body[0] &= ~(0x20 | 0x08 | 0x04) & 0xFF
            chunks += chunk_type + data[pos + 4 : pos + 8] + body
        pos = end
    if not chunks:
        raise ValueError("webp sin datos")
    return b"RIFF" + (4 + len(chunks)).to_bytes(4, "little") + b"WEBP" + bytes(chunks)


def strip_photo_metadata(data: bytes, photo_format: str) -> bytes:
    """Quita EXIF, XMP, texto y comentarios a nivel de bytes, sin recodificar.

    Lanza ValueError si la estructura no se puede recorrer.
    """
    if photo_format == "jpeg":
        return _strip_jpeg(data)
    if photo_format == "png":
        return _strip_png(data)
    if photo_format == "webp":
        return _strip_webp(data)
    raise ValueError("formato no admitido")


def _check_integrity(image: Image.Image, photo_format: str) -> None:
    # Sin decodificar píxeles: JPEG y WebP se comprueban por su estructura
    # (cabeceras al abrir y recorrido de strip_photo_metadata); PNG con verify().
    if photo_format == "png":
        image.verify()


def prepare_photo(images: list[bytes]) -> MealPhoto:
    """Valida la foto recibida y devuelve la versión sin metadatos que se enviará al proveedor."""
    if len(images) > 1:
        raise ValidationError(SINGLE_PHOTO_MESSAGE)
    if not images or not images[0]:
        raise ValidationError(PHOTO_REQUIRED_MESSAGE)
    data = images[0]
    if len(data) > MAX_PHOTO_BYTES:
        raise PayloadTooLargeError(PHOTO_TOO_LARGE_MESSAGE)
    photo_format = detect_photo_format(data)
    if photo_format is None:
        raise ValidationError(UNSUPPORTED_FORMAT_MESSAGE)
    try:
        image = Image.open(io.BytesIO(data), formats=[_PILLOW_FORMATS[photo_format]])
        width, height = image.size
    except Exception:
        raise ValidationError(UNREADABLE_PHOTO_MESSAGE) from None
    try:
        _check_integrity(image, photo_format)
        clean = strip_photo_metadata(data, photo_format)
    except Exception:
        raise ValidationError(UNREADABLE_PHOTO_MESSAGE) from None
    finally:
        image.close()
    if width > MAX_PHOTO_SIDE or height > MAX_PHOTO_SIDE:
        raise ValidationError(PHOTO_TOO_WIDE_MESSAGE)
    return MealPhoto(
        data=clean, format=photo_format, size_bytes=len(data), width=width, height=height
    )
