"""Imágenes de prueba generadas en memoria con Pillow (spec 024): ningún archivo
en disco ni foto real. Los generadores devuelven `bytes` listos para enviarse a
`prepare_photo` o a `POST /api/meals/analyze`.
"""

import io
import random
import struct
import zlib

from PIL import Image

CAMERA_MODEL = "TestCam-9000"
PNG_TEXT_KEY = "Comment"
PNG_TEXT_VALUE = "ubicacion-secreta-de-casa"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _noise_image(width: int, height: int, mode: str = "RGB") -> Image.Image:
    """Imagen con ruido determinista: no se comprime a casi nada, así que un
    corte a la mitad cae dentro de los datos de la imagen."""
    rng = random.Random(1234)
    channels = len(Image.new(mode, (1, 1)).getbands())
    raw = bytes(rng.randrange(256) for _ in range(width * height * channels))
    return Image.frombytes(mode, (width, height), raw)


def jpeg_bytes(
    width: int = 64,
    height: int = 48,
    exif: bytes | None = None,
    icc_profile: bytes | None = None,
) -> bytes:
    image = Image.new("RGB", (width, height), (200, 120, 40))
    buffer = io.BytesIO()
    options = {}
    if exif is not None:
        options["exif"] = exif
    if icc_profile is not None:
        options["icc_profile"] = icc_profile
    image.save(buffer, format="JPEG", **options)
    return buffer.getvalue()


def png_bytes(
    width: int = 64,
    height: int = 48,
    text: dict[str, str] | None = None,
    mode: str = "RGB",
    icc_profile: bytes | None = None,
) -> bytes:
    """PNG liso. Con `mode="1"` o `"L"` un 8000 x 6000 pesa pocos KB."""
    from PIL.PngImagePlugin import PngInfo

    image = Image.new(mode, (width, height))
    info = None
    if text:
        info = PngInfo()
        for key, value in text.items():
            info.add_text(key, value)
    buffer = io.BytesIO()
    options = {}
    if icc_profile is not None:
        options["icc_profile"] = icc_profile
    image.save(buffer, format="PNG", pnginfo=info, **options)
    return buffer.getvalue()


def webp_bytes(
    width: int = 64,
    height: int = 48,
    exif: bytes | None = None,
    icc_profile: bytes | None = None,
) -> bytes:
    image = Image.new("RGB", (width, height), (40, 160, 90))
    buffer = io.BytesIO()
    options = {}
    if exif is not None:
        options["exif"] = exif
    if icc_profile is not None:
        options["icc_profile"] = icc_profile
    image.save(buffer, format="WEBP", **options)
    return buffer.getvalue()


def flat_webp(width: int, height: int) -> bytes:
    """WebP lossless de un solo color: ocupa pocos KB aunque tenga millones de
    píxeles (`method=0` lo hace rápido de generar)."""
    image = Image.new("RGB", (width, height), (40, 160, 90))
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", lossless=True, method=0)
    return buffer.getvalue()


def gif_bytes() -> bytes:
    image = Image.new("P", (16, 16))
    buffer = io.BytesIO()
    image.save(buffer, format="GIF")
    return buffer.getvalue()


def gps_exif() -> bytes:
    """Bloque EXIF con el modelo de la cámara y una ubicación GPS."""
    exif = Image.Exif()
    exif[0x0110] = CAMERA_MODEL
    exif[0x8825] = {
        1: "N",
        2: (9.0, 56.0, 12.0),
        3: "W",
        4: (84.0, 5.0, 30.0),
    }
    return exif.tobytes()


def jpeg_with_gps_exif(width: int = 64, height: int = 48) -> bytes:
    return jpeg_bytes(width, height, exif=gps_exif())


def webp_with_gps_exif(width: int = 64, height: int = 48) -> bytes:
    return webp_bytes(width, height, exif=gps_exif())


def truncated_jpeg() -> bytes:
    """Un JPEG válido con ruido, cortado por la mitad: empieza como JPEG pero
    no se puede leer entero."""
    image = _noise_image(120, 120)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    data = buffer.getvalue()
    return data[: len(data) // 2]


def padded_to(data: bytes, size: int) -> bytes:
    """PNG válido de exactamente `size` bytes: añade un chunk privado auxiliar
    de relleno antes de `IEND`. `data` debe ser un PNG y caber en `size`."""
    assert data.startswith(PNG_SIGNATURE)
    overhead = 12  # longitud (4) + tipo (4) + CRC (4)
    padding = size - len(data) - overhead
    assert padding >= 0, "la imagen ya supera el tamaño pedido"
    chunk_type = b"prVt"
    payload = b"\x00" * padding
    crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
    chunk = struct.pack(">I", padding) + chunk_type + payload + struct.pack(">I", crc)
    iend = data.rfind(b"IEND") - 4
    result = data[:iend] + chunk + data[iend:]
    assert len(result) == size
    return result
