"""Tests UNITARIOS de las funciones puras de la foto de una comida (spec 024):
`detect_photo_format`, `prepare_photo` y `strip_photo_metadata`. Las imágenes
se generan en memoria con `tests/photo_samples.py`; no hay Flask ni red.
"""

import io
import tracemalloc

import pytest
from PIL import Image

from exceptions.custom_exceptions import PayloadTooLargeError, ValidationError
from services.meal_photo import (
    MAX_PHOTO_BYTES,
    PHOTO_REQUIRED_MESSAGE,
    PHOTO_TOO_LARGE_MESSAGE,
    PHOTO_TOO_WIDE_MESSAGE,
    SINGLE_PHOTO_MESSAGE,
    UNREADABLE_PHOTO_MESSAGE,
    UNSUPPORTED_FORMAT_MESSAGE,
    detect_photo_format,
    prepare_photo,
    strip_photo_metadata,
)
from tests.photo_samples import (
    CAMERA_MODEL,
    PNG_TEXT_KEY,
    PNG_TEXT_VALUE,
    flat_webp,
    gif_bytes,
    jpeg_bytes,
    jpeg_with_gps_exif,
    padded_to,
    png_bytes,
    truncated_jpeg,
    webp_bytes,
    webp_with_gps_exif,
)


def reject(images):
    """Ejecuta `prepare_photo` esperando un rechazo y devuelve su excepción."""
    with pytest.raises((ValidationError, PayloadTooLargeError)) as caught:
        prepare_photo(images)
    return caught.value


# SDD: 024 REQ-002 AC-002.1
def test_empty_list_asks_for_a_photo():
    """Sin archivos en `image`: 400 con «Adjunta una foto de la comida.»."""
    error = reject([])

    assert isinstance(error, ValidationError)
    assert error.message == PHOTO_REQUIRED_MESSAGE


# SDD: 024 REQ-002 AC-002.2
def test_empty_file_asks_for_a_photo():
    """Un archivo de 0 bytes: el mismo 400 de foto ausente."""
    error = reject([b""])

    assert isinstance(error, ValidationError)
    assert error.message == PHOTO_REQUIRED_MESSAGE


# SDD: 024 REQ-002 AC-002.3
def test_two_files_ask_for_a_single_photo():
    """Dos archivos: 400 con «Adjunta una sola foto.»."""
    error = reject([jpeg_bytes(), jpeg_bytes()])

    assert isinstance(error, ValidationError)
    assert error.message == SINGLE_PHOTO_MESSAGE


# SDD: 024 REQ-002 AC-002.3
def test_two_files_ask_for_a_single_photo_even_if_one_is_empty():
    """Con dos o más archivos manda el mensaje de una sola foto, aunque alguno
    esté vacío."""
    error = reject([b"", jpeg_bytes()])

    assert isinstance(error, ValidationError)
    assert error.message == SINGLE_PHOTO_MESSAGE


# SDD: 024 REQ-003 AC-003.1
@pytest.mark.parametrize(
    "data",
    [b"esto es un texto, no una imagen", gif_bytes(), b"\x00\x01\x02"],
    ids=["text", "gif", "raw-bytes"],
)
def test_content_that_is_not_jpeg_png_or_webp_is_rejected(data):
    """Texto, GIF o bytes cualesquiera: 400 con el mensaje de formato."""
    error = reject([data])

    assert isinstance(error, ValidationError)
    assert error.message == UNSUPPORTED_FORMAT_MESSAGE


# SDD: 024 REQ-003 AC-003.1
def test_detect_photo_format_returns_none_for_text_and_gif():
    """Texto y GIF no son un formato admitido."""
    assert detect_photo_format(b"texto de comida.jpg") is None
    assert detect_photo_format(gif_bytes()) is None


# SDD: 024 REQ-003 AC-003.2
def test_detect_photo_format_recognizes_the_three_formats_by_content():
    """Se detecta por los bytes, no por el nombre ni el tipo declarado."""
    assert detect_photo_format(jpeg_bytes()) == "jpeg"
    assert detect_photo_format(png_bytes()) == "png"
    assert detect_photo_format(webp_bytes()) == "webp"


# SDD: 024 REQ-003 AC-003.2
def test_a_png_is_prepared_as_png():
    """Un PNG válido se prepara como `png` (cuenta el contenido)."""
    photo = prepare_photo([png_bytes(40, 30)])

    assert photo.format == "png"
    assert (photo.width, photo.height) == (40, 30)


# SDD: 024 REQ-003 AC-003.3
def test_truncated_jpeg_is_unreadable():
    """Un JPEG cortado por la mitad: 400 con «No se pudo leer la imagen.»."""
    error = reject([truncated_jpeg()])

    assert isinstance(error, ValidationError)
    assert error.message == UNREADABLE_PHOTO_MESSAGE


# SDD: 024 REQ-003 AC-003.3
def test_png_with_only_the_signature_is_unreadable():
    """Un PNG que solo trae la firma no se puede leer."""
    error = reject([png_bytes()[:8]])

    assert isinstance(error, ValidationError)
    assert error.message == UNREADABLE_PHOTO_MESSAGE


# SDD: 024 REQ-003 AC-003.4
def test_photo_of_exactly_3_mb_is_accepted():
    """3 × 1024 × 1024 bytes exactos se analizan."""
    data = padded_to(png_bytes(), MAX_PHOTO_BYTES)

    photo = prepare_photo([data])

    assert photo.size_bytes == MAX_PHOTO_BYTES
    assert photo.format == "png"


# SDD: 024 REQ-003 AC-003.4
def test_photo_of_3_mb_plus_one_byte_is_too_large():
    """3 MB + 1 byte: 413 con el mensaje de 3 MB."""
    data = padded_to(png_bytes(), MAX_PHOTO_BYTES + 1)

    error = reject([data])

    assert isinstance(error, PayloadTooLargeError)
    assert error.status_code == 413
    assert error.message == PHOTO_TOO_LARGE_MESSAGE


# SDD: 024 REQ-003 AC-003.6
def test_8000_by_6000_pixels_is_accepted():
    """8000 × 6000 píxeles pasa y conserva sus dimensiones."""
    photo = prepare_photo([png_bytes(8000, 6000, mode="1")])

    assert (photo.width, photo.height) == (8000, 6000)


# SDD: 024 REQ-003 AC-003.6
@pytest.mark.parametrize("width, height", [(8001, 100), (100, 8001)])
def test_a_side_over_8000_pixels_is_rejected(width, height):
    """8001 × 100 o 100 × 8001: 400 con el mensaje de píxeles por lado."""
    error = reject([png_bytes(width, height, mode="1")])

    assert isinstance(error, ValidationError)
    assert error.message == PHOTO_TOO_WIDE_MESSAGE


# SDD: 024 REQ-001 AC-001.2
@pytest.mark.parametrize(
    "data, expected",
    [(jpeg_bytes(), "jpeg"), (png_bytes(), "png"), (webp_bytes(), "webp")],
    ids=["jpeg", "png", "webp"],
)
def test_valid_photos_report_format_original_size_and_dimensions(data, expected):
    """`MealPhoto` trae el formato, el tamaño de la foto original y sus lados."""
    photo = prepare_photo([data])

    assert photo.format == expected
    assert photo.size_bytes == len(data)
    assert (photo.width, photo.height) == (64, 48)


# SDD: 024 REQ-010 AC-010.1
def test_jpeg_without_metadata_keeps_its_dimensions():
    """El JPEG preparado sigue siendo una imagen legible con las mismas
    dimensiones que la original."""
    photo = prepare_photo([jpeg_bytes(80, 60)])

    with Image.open(io.BytesIO(photo.data)) as image:
        image.load()
        assert image.size == (80, 60)


# SDD: 024 REQ-010 AC-010.1
def test_jpeg_gps_and_camera_model_are_stripped():
    """Un JPEG con GPS y modelo de cámara sale sin EXIF, sin la cadena del
    modelo y con las mismas dimensiones."""
    original = jpeg_with_gps_exif(90, 70)
    assert CAMERA_MODEL.encode() in original

    photo = prepare_photo([original])

    assert CAMERA_MODEL.encode() not in photo.data
    with Image.open(io.BytesIO(photo.data)) as image:
        image.load()
        assert image.size == (90, 70)
        assert len(image.getexif()) == 0
        assert "exif" not in image.info
    assert photo.size_bytes == len(original)
    assert len(photo.data) <= len(original)


# SDD: 024 REQ-010 AC-010.1
def test_strip_photo_metadata_on_jpeg_keeps_the_visible_content():
    """El JPEG sin metadatos conserva los colores de la imagen."""
    original = jpeg_with_gps_exif()

    stripped = strip_photo_metadata(original, "jpeg")

    with Image.open(io.BytesIO(stripped)) as image:
        red, green, blue = image.convert("RGB").getpixel((10, 10))
    assert abs(red - 200) < 12 and abs(green - 120) < 12 and abs(blue - 40) < 12


# SDD: 024 REQ-010 AC-010.2
def test_png_text_chunk_is_stripped():
    """Un PNG con un bloque `tEXt` sale sin ese bloque ni su texto."""
    original = png_bytes(50, 40, text={PNG_TEXT_KEY: PNG_TEXT_VALUE})
    assert PNG_TEXT_VALUE.encode() in original

    photo = prepare_photo([original])

    assert PNG_TEXT_VALUE.encode() not in photo.data
    assert b"tEXt" not in photo.data
    with Image.open(io.BytesIO(photo.data)) as image:
        image.load()
        assert image.size == (50, 40)
        assert PNG_TEXT_KEY not in image.info


# SDD: 024 REQ-010 AC-010.2
def test_strip_photo_metadata_on_png_drops_other_text_chunks_too():
    """También se descartan `zTXt`, `iTXt` y los chunks privados de relleno."""
    original = padded_to(png_bytes(), 2000)

    stripped = strip_photo_metadata(original, "png")

    assert b"prVt" not in stripped
    assert len(stripped) < len(original)
    with Image.open(io.BytesIO(stripped)) as image:
        image.load()
        assert image.size == (64, 48)


# SDD: 024 REQ-010 AC-010.1
def test_webp_exif_is_stripped():
    """Un WebP con EXIF (GPS y modelo) sale sin ese bloque y se sigue leyendo."""
    original = webp_with_gps_exif(70, 50)
    assert b"EXIF" in original

    photo = prepare_photo([original])

    assert b"EXIF" not in photo.data
    assert CAMERA_MODEL.encode() not in photo.data
    with Image.open(io.BytesIO(photo.data)) as image:
        image.load()
        assert image.size == (70, 50)
        assert len(image.getexif()) == 0


# SDD: 024 REQ-010 AC-010.1
def test_strip_photo_metadata_on_webp_without_exif_stays_readable():
    """Un WebP sin metadatos sigue siendo un WebP legible tras el quitado."""
    stripped = strip_photo_metadata(webp_bytes(33, 21), "webp")

    with Image.open(io.BytesIO(stripped)) as image:
        image.load()
        assert image.size == (33, 21)


# SDD: 024 REQ-003 AC-003.6
def test_webp_validation_does_not_decode_pixels():
    """Un WebP plano de 3000 × 3000 (unos KB) se valida sin decodificar los
    píxeles: el pico de memoria es menor de 8 MB (decodificar reservaría 27 MB)."""
    data = flat_webp(3000, 3000)

    tracemalloc.start()
    try:
        photo = prepare_photo([data])
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()

    assert photo.width == 3000
    assert peak < 8 * 1024 * 1024


# SDD: 024 REQ-003 AC-003.3
def test_jpeg_with_an_unsupported_coding_process_is_unreadable():
    """Un JPEG con el marcador `FFC0` cambiado por `FFC3` (sin pérdida, no
    admitido) no se puede leer."""
    data = jpeg_bytes()
    assert b"\xff\xc0" in data
    unsupported = data.replace(b"\xff\xc0", b"\xff\xc3", 1)

    error = reject([unsupported])

    assert isinstance(error, ValidationError)
    assert error.message == UNREADABLE_PHOTO_MESSAGE


# SDD: 024 REQ-003 AC-003.3
def test_jpeg_without_a_scan_is_unreadable():
    """Un JPEG cortado justo antes de su `SOS` y cerrado con `EOI` no trae
    datos de imagen: no se puede leer."""
    data = jpeg_bytes()
    without_scan = data[: data.index(b"\xff\xda")] + b"\xff\xd9"

    error = reject([without_scan])

    assert isinstance(error, ValidationError)
    assert error.message == UNREADABLE_PHOTO_MESSAGE


# SDD: 024 REQ-010 AC-010.1
@pytest.mark.parametrize(
    "make_photo, image_format",
    [(jpeg_bytes, "jpeg"), (webp_bytes, "webp")],
    ids=["jpeg", "webp"],
)
def test_icc_profile_is_stripped(make_photo, image_format):
    """El perfil ICC se descarta (puede identificar el dispositivo) y la imagen
    sigue leyéndose con sus dimensiones."""
    marker = b"fitnerd-icc-device-model"
    original = make_photo(70, 50, icc_profile=marker)
    assert marker in original

    stripped = strip_photo_metadata(original, image_format)

    assert marker not in stripped
    with Image.open(io.BytesIO(stripped)) as image:
        assert "icc_profile" not in image.info
        image.load()
        assert image.size == (70, 50)


# SDD: 024 REQ-003 AC-003.3
def test_strip_photo_metadata_raises_value_error_when_the_structure_cannot_be_walked():
    """Un JPEG con un segmento que se sale del archivo no se puede recorrer."""
    broken = b"\xff\xd8\xff\xe1\xff\xff" + b"x" * 10

    with pytest.raises(ValueError):
        strip_photo_metadata(broken, "jpeg")
