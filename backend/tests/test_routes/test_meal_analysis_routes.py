"""Integración de POST /api/meals/analyze (spec 024) contra el Postgres de
prueba. El cliente de Bedrock es un `FakeBedrockRuntimeClient` instalado en el
singleton `vision_client` y Redis, un `FakeRedisClient` instalado en
`rate_limiter` (ambos se restauran al terminar): nada sale a la red ni a AWS.
"""

import io
from datetime import date

import pytest
from PIL import Image
from sqlalchemy import func, select
from werkzeug.test import EnvironBuilder

from extensions import db, jwt_manager, rate_limiter, tracer, vision_client
from models import CatalogFood
from tests.fakes import FakeBedrockRuntimeClient, FakeRedisClient
from tests.fakes_observability import FakeTraceBackend
from tests.photo_samples import (
    CAMERA_MODEL,
    PNG_TEXT_KEY,
    PNG_TEXT_VALUE,
    gif_bytes,
    jpeg_bytes,
    jpeg_with_gps_exif,
    padded_to,
    png_bytes,
    truncated_jpeg,
    webp_bytes,
)
from utils.in_memory_request import InMemoryUploadRequest

URL = "/api/meals/analyze"
MODEL_ID = "fake-vision-model"
MB = 1024 * 1024

PHOTO_REQUIRED = "Adjunta una foto de la comida."
SINGLE_PHOTO = "Adjunta una sola foto."
UNSUPPORTED = "La imagen debe ser JPEG, PNG o WebP."
UNREADABLE = "No se pudo leer la imagen."
TOO_WIDE = "La imagen no puede superar los 8000 píxeles por lado."
TOO_LARGE = "La imagen no puede superar los 3 MB."
RATE_LIMITED = "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."
UNAVAILABLE = "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."

RICE = {
    "id": "arroz-blanco-cocido",
    "name": "Arroz blanco cocido",
    "calories_kcal": 130.0,
    "protein_g": 2.69,
    "carbs_g": 28.17,
    "fat_g": 0.28,
}
CHICKEN = {
    "id": "pechuga-de-pollo-a-la-plancha",
    "name": "Pechuga de pollo a la plancha",
    "calories_kcal": 165.0,
    "protein_g": 31.0,
    "carbs_g": 0.0,
    "fat_g": 3.57,
}
BEANS = {
    "id": "frijoles-negros-cocidos",
    "name": "Frijoles negros cocidos",
    "calories_kcal": 132.0,
    "protein_g": 8.9,
    "carbs_g": 23.7,
    "fat_g": 0.5,
}


def rice_150():
    return {
        "catalog_id": "arroz-blanco-cocido",
        "name": "Arroz",
        "grams": 150,
        "confidence": "high",
    }


@pytest.fixture(autouse=True)
def redis_fake():
    """Sustituye el cliente de Redis del `RateLimiter` por uno en memoria."""
    original = rate_limiter.client
    fake = FakeRedisClient()
    rate_limiter.client = fake
    yield fake
    rate_limiter.client = original


@pytest.fixture(autouse=True)
def bedrock():
    """Instala un cliente de Bedrock de mentira (y un modelo) en el singleton
    `vision_client`; cada test fija `bedrock.foods` con lo que "ve" el modelo."""
    original_client, original_model = vision_client.client, vision_client.model_id
    fake = FakeBedrockRuntimeClient(foods=[])
    vision_client.client = fake
    vision_client.model_id = MODEL_ID
    yield fake
    vision_client.client = original_client
    vision_client.model_id = original_model


def auth_headers(app, user_id="user-1", minutes=30):
    with app.app_context():
        token = jwt_manager.generate_token({"id": user_id, "user_role": "user"}, minutes)
    return {"Authorization": f"Bearer {token}"}


def seed(app, *foods):
    """Inserta alimentos del catálogo (por defecto, arroz, pollo y frijoles)."""
    with app.app_context():
        for spec in foods or (RICE, CHICKEN, BEANS):
            fields = dict(
                synonyms=[], source="manual", fdc_id=None, reference="Tabla de prueba"
            )
            fields.update(spec)
            db.session.add(CatalogFood(**fields))
        db.session.commit()


def upload(data, filename="foto.jpg", mimetype="image/jpeg"):
    return (io.BytesIO(data), filename, mimetype)


def analyze(client, app, data=None, user_id="user-1", headers=None, **form):
    """Envía una foto en el campo `image` (si `data` no es None) con los
    campos extra de `form`."""
    payload = dict(form)
    if data is not None:
        payload["image"] = upload(data)
    return client.post(
        URL,
        data=payload,
        content_type="multipart/form-data",
        headers=headers if headers is not None else auth_headers(app, user_id),
    )


def row_counts(app):
    with app.app_context():
        return {
            table.name: db.session.execute(select(func.count()).select_from(table)).scalar_one()
            for table in db.metadata.sorted_tables
        }


# SDD: 024 REQ-001 AC-001.1
def test_valid_jpeg_returns_the_complete_catalog_response(client, app, bedrock):
    """Arroz con 150 g y confianza `high`: el contrato completo de la sección 6."""
    seed(app)
    bedrock.foods = [rice_150()]

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 200
    nutrients = {"calories_kcal": 195.0, "protein_g": 4.04, "carbs_g": 42.26, "fat_g": 0.42}
    assert response.get_json() == {
        "items": [
            {
                "catalog_id": "arroz-blanco-cocido",
                "name": "Arroz blanco cocido",
                "grams": 150,
                "confidence": "high",
                "per_100g": {
                    "calories_kcal": 130.0,
                    "protein_g": 2.69,
                    "carbs_g": 28.17,
                    "fat_g": 0.28,
                },
                "nutrients": nutrients,
            }
        ],
        "unmatched": [],
        "totals": nutrients,
    }


# SDD: 024 REQ-001 AC-001.2
@pytest.mark.parametrize(
    "data, image_format",
    [(png_bytes(), "png"), (webp_bytes(), "webp"), (jpeg_bytes(), "jpeg")],
    ids=["png", "webp", "jpeg"],
)
def test_png_and_webp_are_accepted_and_the_provider_receives_their_format(
    client, app, bedrock, data, image_format
):
    """PNG y WebP válidos dan 200 y el proveedor recibe imagen y formato."""
    seed(app)

    response = analyze(client, app, data)

    assert response.status_code == 200
    image, received_format = bedrock.last_image()
    assert received_format == image_format
    assert image


# SDD: 024 REQ-001 AC-001.3
def test_provider_receives_the_id_and_name_of_the_whole_catalog(client, app, bedrock):
    """El texto enviado al proveedor lleva el identificador y el nombre de todos
    los alimentos del catálogo."""
    seed(app)

    assert analyze(client, app, jpeg_bytes()).status_code == 200

    prompt = bedrock.last_prompt()
    for food in (RICE, CHICKEN, BEANS):
        assert food["id"] in prompt
        assert food["name"] in prompt


# SDD: 024 REQ-001 AC-001.4
def test_items_keep_the_provider_order_and_totals_add_up(client, app, bedrock):
    """Dos alimentos: `items` en el orden del proveedor y `totals` es la suma."""
    seed(app)
    bedrock.foods = [
        {
            "catalog_id": "pechuga-de-pollo-a-la-plancha",
            "name": "x",
            "grams": 100,
            "confidence": "high",
        },
        rice_150(),
    ]

    body = analyze(client, app, jpeg_bytes()).get_json()

    assert [item["catalog_id"] for item in body["items"]] == [
        "pechuga-de-pollo-a-la-plancha",
        "arroz-blanco-cocido",
    ]
    assert body["totals"] == {
        "calories_kcal": 360.0,
        "protein_g": 35.04,
        "carbs_g": 42.26,
        "fat_g": 3.99,
    }


# SDD: 024 REQ-001 AC-001.5
def test_photo_without_food_returns_empty_lists_and_zero_totals(client, app, bedrock):
    """Un paisaje: 200 con `items` y `unmatched` vacíos y los totales en 0."""
    seed(app)
    bedrock.foods = []

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 200
    assert response.get_json() == {
        "items": [],
        "unmatched": [],
        "totals": {"calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0},
    }


# SDD: 024 REQ-002 AC-002.1
def test_request_without_body_returns_400_and_does_not_call_the_provider(client, app, bedrock):
    """Sin cuerpo: 400 con el mensaje de foto ausente."""
    seed(app)

    response = client.post(URL, headers=auth_headers(app))

    assert response.status_code == 400
    assert response.get_json() == {"error": PHOTO_REQUIRED}
    assert bedrock.calls == []


# SDD: 024 REQ-002 AC-002.1
def test_json_body_returns_400_and_does_not_call_the_provider(client, app, bedrock):
    """Un cuerpo JSON no es un formulario con foto."""
    seed(app)

    response = client.post(URL, json={"image": "abc"}, headers=auth_headers(app))

    assert response.status_code == 400
    assert response.get_json() == {"error": PHOTO_REQUIRED}
    assert bedrock.calls == []


# SDD: 024 REQ-002 AC-002.1
def test_form_without_the_image_field_returns_400(client, app, bedrock):
    """Un formulario sin el campo `image` (con otro archivo) da 400."""
    seed(app)

    response = client.post(
        URL,
        data={"otro": upload(jpeg_bytes())},
        content_type="multipart/form-data",
        headers=auth_headers(app),
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": PHOTO_REQUIRED}
    assert bedrock.calls == []


# SDD: 024 REQ-002 AC-002.2
def test_empty_file_returns_400(client, app, bedrock):
    """Un archivo de 0 bytes en `image`: 400 con el mensaje de foto ausente."""
    seed(app)

    response = analyze(client, app, b"")

    assert response.status_code == 400
    assert response.get_json() == {"error": PHOTO_REQUIRED}
    assert bedrock.calls == []


# SDD: 024 REQ-002 AC-002.3
def test_two_files_in_image_return_400(client, app, bedrock):
    """Dos archivos en el campo `image`: 400 y el proveedor no recibe llamada."""
    seed(app)

    response = client.post(
        URL,
        data={"image": [upload(jpeg_bytes()), upload(jpeg_bytes(), "otra.jpg")]},
        content_type="multipart/form-data",
        headers=auth_headers(app),
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": SINGLE_PHOTO}
    assert bedrock.calls == []


# SDD: 024 REQ-002 AC-002.4
def test_additional_form_fields_are_ignored(client, app, bedrock):
    """Campos adicionales (texto del usuario, etc.) se ignoran: 200."""
    seed(app)

    response = analyze(client, app, jpeg_bytes(), nota="es arroz integral", user_id_extra="otro")

    assert response.status_code == 200
    assert "arroz integral" not in bedrock.last_prompt()


# SDD: 024 REQ-003 AC-003.1
def test_text_file_named_like_a_jpeg_returns_400(client, app, bedrock):
    """Un texto llamado `comida.jpg` con tipo `image/jpeg`: 400 de formato."""
    seed(app)

    response = client.post(
        URL,
        data={"image": upload(b"esto no es una imagen", "comida.jpg", "image/jpeg")},
        content_type="multipart/form-data",
        headers=auth_headers(app),
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": UNSUPPORTED}
    assert bedrock.calls == []


# SDD: 024 REQ-003 AC-003.1
def test_gif_returns_400(client, app, bedrock):
    """Un GIF no se admite."""
    seed(app)

    response = analyze(client, app, gif_bytes())

    assert response.status_code == 400
    assert response.get_json() == {"error": UNSUPPORTED}
    assert bedrock.calls == []


# SDD: 024 REQ-003 AC-003.2
def test_png_named_jpg_is_sent_to_the_provider_as_png(client, app, bedrock):
    """Un PNG llamado `foto.jpg` con tipo `image/jpeg`: 200 y llega como PNG."""
    seed(app)

    response = client.post(
        URL,
        data={"image": upload(png_bytes(), "foto.jpg", "image/jpeg")},
        content_type="multipart/form-data",
        headers=auth_headers(app),
    )

    assert response.status_code == 200
    assert bedrock.last_image()[1] == "png"


# SDD: 024 REQ-003 AC-003.3
def test_truncated_jpeg_returns_400(client, app, bedrock):
    """Un JPEG truncado: 400 con «No se pudo leer la imagen.»."""
    seed(app)

    response = analyze(client, app, truncated_jpeg())

    assert response.status_code == 400
    assert response.get_json() == {"error": UNREADABLE}
    assert bedrock.calls == []


# SDD: 024 REQ-003 AC-003.4
def test_photo_of_exactly_3_mb_is_analyzed(client, app, bedrock):
    """3 × 1024 × 1024 bytes exactos se analizan."""
    seed(app)

    response = analyze(client, app, padded_to(png_bytes(), 3 * MB))

    assert response.status_code == 200
    assert len(bedrock.calls) == 1


# SDD: 024 REQ-003 AC-003.4
def test_photo_of_3_mb_plus_one_byte_returns_413(client, app, bedrock):
    """3 MB + 1 byte: 413 con el mensaje de 3 MB y sin llamar al proveedor."""
    seed(app)

    response = analyze(client, app, padded_to(png_bytes(), 3 * MB + 1))

    assert response.status_code == 413
    assert response.get_json() == {"error": TOO_LARGE}
    assert bedrock.calls == []


# SDD: 024 REQ-003 AC-003.5
def test_request_body_over_4_mb_returns_413_in_spanish(client, app, bedrock):
    """Foto pequeña válida y un segundo archivo de 4 MB en otro campo: el cuerpo
    supera los 4 MB y da 413 con el mensaje en español, sin llamar al proveedor."""
    seed(app)

    extra = upload(b"0" * (4 * MB), "extra.bin", "application/octet-stream")
    response = analyze(client, app, jpeg_bytes(), extra=extra)

    assert response.status_code == 413
    assert response.get_json() == {"error": TOO_LARGE}
    assert bedrock.calls == []


# SDD: 024 REQ-003 AC-003.5
def test_request_body_under_4_mb_with_an_extra_file_is_analyzed(client, app, bedrock):
    """Con un archivo extra de 3,5 MB el cuerpo sigue por debajo de 4 MB: se
    analiza (los campos extra se ignoran)."""
    seed(app)

    response = analyze(
        client,
        app,
        jpeg_bytes(),
        extra=upload(b"0" * (MB * 7 // 2), "extra.bin", "application/octet-stream"),
    )

    assert response.status_code == 200
    assert len(bedrock.calls) == 1


# SDD: 024 REQ-003 AC-003.6
def test_8000_by_6000_pixels_is_analyzed(client, app, bedrock):
    """8000 × 6000 píxeles se analizan."""
    seed(app)

    response = analyze(client, app, png_bytes(8000, 6000, mode="1"))

    assert response.status_code == 200
    assert len(bedrock.calls) == 1


# SDD: 024 REQ-003 AC-003.6
@pytest.mark.parametrize("width, height", [(8001, 100), (100, 8001)])
def test_a_side_over_8000_pixels_returns_400(client, app, bedrock, width, height):
    """8001 × 100 o 100 × 8001: 400 con el mensaje de píxeles por lado."""
    seed(app)

    response = analyze(client, app, png_bytes(width, height, mode="1"))

    assert response.status_code == 400
    assert response.get_json() == {"error": TOO_WIDE}
    assert bedrock.calls == []


# SDD: 024 REQ-004 AC-004.1
def test_request_without_authorization_header_returns_401(client, app, bedrock):
    """Sin cabecera de autorización: 401 y el proveedor no recibe llamada."""
    seed(app)

    response = client.post(
        URL, data={"image": upload(jpeg_bytes())}, content_type="multipart/form-data"
    )

    assert response.status_code == 401
    assert bedrock.calls == []


# SDD: 024 REQ-004 AC-004.1
def test_expired_token_returns_401(client, app, bedrock):
    """Un token caducado da 401."""
    seed(app)

    response = analyze(client, app, jpeg_bytes(), headers=auth_headers(app, minutes=-5))

    assert response.status_code == 401
    assert bedrock.calls == []


# SDD: 024 REQ-004 AC-004.1
def test_invalid_token_returns_401(client, app, bedrock):
    """Un token inválido da 401."""
    seed(app)

    response = analyze(
        client, app, jpeg_bytes(), headers={"Authorization": "Bearer not-a-token"}
    )

    assert response.status_code == 401
    assert bedrock.calls == []


# SDD: 024 REQ-005 AC-005.1
def test_the_eleventh_analysis_in_an_hour_returns_429(client, app, bedrock):
    """10 análisis válidos y el 11.º da 429 sin llamar al proveedor."""
    seed(app)
    statuses = [analyze(client, app, jpeg_bytes()).status_code for _ in range(10)]

    response = analyze(client, app, jpeg_bytes())

    assert statuses == [200] * 10
    assert response.status_code == 429
    assert response.get_json() == {"error": RATE_LIMITED}
    assert len(bedrock.calls) == 10


# SDD: 024 REQ-005 AC-005.2
def test_the_limit_is_independent_for_each_user(client, app):
    """Un usuario en el límite no afecta a otro."""
    seed(app)
    for _ in range(10):
        assert analyze(client, app, jpeg_bytes(), user_id="user-1").status_code == 200
    assert analyze(client, app, jpeg_bytes(), user_id="user-1").status_code == 429

    response = analyze(client, app, jpeg_bytes(), user_id="user-2")

    assert response.status_code == 200


# SDD: 024 REQ-005 AC-005.3
def test_rejected_requests_do_not_count_for_the_limit(client, app):
    """9 análisis válidos y 5 peticiones rechazadas con 400: el siguiente válido es 200."""
    seed(app)
    for _ in range(9):
        assert analyze(client, app, jpeg_bytes()).status_code == 200
    for _ in range(5):
        assert analyze(client, app, b"no es una imagen").status_code == 400

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 200


# SDD: 024 REQ-005 AC-005.1
def test_analyses_that_end_in_503_count_for_the_limit(client, app, bedrock):
    """Los análisis que terminan en 503 llamaron al proveedor y cuentan."""
    seed(app)
    bedrock.raise_error = RuntimeError("caído")
    statuses = [analyze(client, app, jpeg_bytes()).status_code for _ in range(10)]

    response = analyze(client, app, jpeg_bytes())

    assert statuses == [503] * 10
    assert response.status_code == 429


# SDD: 024 REQ-006 AC-006.2
def test_unknown_catalog_id_goes_to_unmatched_end_to_end(client, app, bedrock):
    """`gallo-pinto` no está en el catálogo: sale en `unmatched`, sin macros."""
    seed(app)
    bedrock.foods = [
        {"catalog_id": "gallo-pinto", "name": "Gallo pinto", "grams": 200, "confidence": "medium"}
    ]

    body = analyze(client, app, jpeg_bytes()).get_json()

    assert body["items"] == []
    assert body["unmatched"] == [{"name": "Gallo pinto", "grams": 200, "confidence": "medium"}]
    assert body["totals"] == {"calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}


# SDD: 024 REQ-009 AC-009.1
def test_provider_error_returns_503_with_the_exact_message(client, app, bedrock):
    """El proveedor lanza un error: 503 con el mensaje exacto y sin detalles."""
    seed(app)
    bedrock.raise_error = RuntimeError("detalle interno del proveedor")

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}


# SDD: 024 REQ-009 AC-009.2
def test_uninterpretable_response_returns_503(client, app, bedrock):
    """El modelo contesta «No puedo ayudar con eso»: 503 con el mismo mensaje."""
    seed(app)
    bedrock.text = "No puedo ayudar con eso"

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}


# SDD: 024 REQ-009 AC-009.3
def test_empty_catalog_returns_503_without_calling_the_provider(client, app, bedrock):
    """Sin alimentos en el catálogo: 503 y el proveedor no recibe llamada."""
    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}
    assert bedrock.calls == []


# SDD: 024 REQ-009 AC-009.4
def test_unconfigured_provider_returns_503(client, app):
    """Sin la configuración del proveedor (`client = None`): 503."""
    seed(app)
    vision_client.client = None

    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}


# SDD: 024 REQ-009 AC-009.4
def test_app_with_an_empty_bedrock_region_starts_and_answers_503(client, app, make_app):
    """Con modelo pero `BEDROCK_REGION=""`, la app arranca, el proveedor queda
    sin configurar y un análisis válido responde 503."""
    make_app("testing", BEDROCK_VISION_MODEL_ID="modelo", BEDROCK_REGION="")
    rate_limiter.client = FakeRedisClient()
    seed(app)

    assert vision_client.configured is False
    response = analyze(client, app, jpeg_bytes())

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}


# SDD: 024 REQ-010 AC-010.1
def test_provider_receives_the_jpeg_without_exif_or_gps(client, app, bedrock):
    """La imagen que recibe el proveedor no tiene EXIF, GPS ni modelo de cámara
    y conserva sus dimensiones."""
    seed(app)
    original = jpeg_with_gps_exif(90, 70)
    assert CAMERA_MODEL.encode() in original

    assert analyze(client, app, original).status_code == 200

    received, image_format = bedrock.last_image()
    assert image_format == "jpeg"
    assert CAMERA_MODEL.encode() not in received
    with Image.open(io.BytesIO(received)) as image:
        image.load()
        assert image.size == (90, 70)
        assert len(image.getexif()) == 0


# SDD: 024 REQ-010 AC-010.2
def test_provider_receives_the_png_without_the_text_chunk(client, app, bedrock):
    """La imagen PNG que recibe el proveedor no contiene el bloque de texto."""
    seed(app)
    original = png_bytes(50, 40, text={PNG_TEXT_KEY: PNG_TEXT_VALUE})

    assert analyze(client, app, original).status_code == 200

    received, image_format = bedrock.last_image()
    assert image_format == "png"
    assert PNG_TEXT_VALUE.encode() not in received
    assert b"tEXt" not in received


# SDD: 024 NFR-001 AC-N001.1
def test_analyses_write_nothing_to_the_database(client, app, bedrock):
    """Un análisis 200 y otro 503 no cambian ninguna tabla y el diario sigue vacío."""
    user_id = "5f0c2a52-3b1e-4a6d-9a47-0c1f2d3e4b5a"
    seed(app)
    bedrock.foods = [rice_150()]
    before = row_counts(app)

    assert analyze(client, app, jpeg_bytes(), user_id=user_id).status_code == 200
    bedrock.raise_error = RuntimeError("caído")
    assert analyze(client, app, jpeg_bytes(), user_id=user_id).status_code == 503

    assert row_counts(app) == before
    diary = client.get(
        "/api/meals",
        query_string={"date": date.today().isoformat()},
        headers=auth_headers(app, user_id),
    )
    assert diary.status_code == 200
    assert diary.get_json()["meals"] == []


# SDD: 024 NFR-001 AC-N001.1
def test_app_keeps_uploaded_files_in_memory(app):
    """La app usa `InMemoryUploadRequest`, cuyo flujo de archivos es un `BytesIO`."""
    assert app.request_class is InMemoryUploadRequest
    environ = EnvironBuilder(method="POST").get_environ()
    request = InMemoryUploadRequest(environ)

    stream = request._get_file_stream(10, "image/jpeg")

    assert isinstance(stream, io.BytesIO)


# SDD: 024 NFR-002 AC-N002.3
def test_rejected_requests_create_no_trace(client, app):
    """Con un trazador activo, 400 y 429 no crean ninguna traza."""
    seed(app)
    backend = FakeTraceBackend()
    tracer.backend = backend

    assert analyze(client, app, b"no es una imagen").status_code == 400
    assert analyze(client, app).status_code == 400
    assert backend.traces == []

    for _ in range(10):
        assert analyze(client, app, jpeg_bytes()).status_code == 200
    created = len(backend.traces)
    assert analyze(client, app, jpeg_bytes()).status_code == 429
    assert len(backend.traces) == created == 10


# SDD: 024 NFR-002 AC-N002.1
def test_valid_analysis_creates_one_trace(client, app, bedrock):
    """Un análisis válido crea una traza con la foto sin incluirla."""
    seed(app)
    bedrock.foods = [rice_150()]
    backend = FakeTraceBackend()
    tracer.backend = backend

    assert analyze(client, app, jpeg_bytes()).status_code == 200

    assert len(backend.traces) == 1
    assert backend.traces[0].user_id == "user-1"
