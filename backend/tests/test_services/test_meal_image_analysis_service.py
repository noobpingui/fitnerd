"""Tests UNITARIOS de `MealImageAnalysisService` (spec 024): no tocan Postgres,
Redis, AWS ni Langfuse. El servicio recibe por constructor un
`FakeCatalogFoodRepository`, un `FakeVisionClient`, un `FakeRateLimiter`, un
`Tracer` con `FakeTraceBackend` y un `FakeLogger`.
"""

import base64
from decimal import Decimal

import pytest
from botocore.exceptions import ReadTimeoutError

from exceptions.custom_exceptions import (
    PayloadTooLargeError,
    RateLimitError,
    ServiceUnavailableError,
    ValidationError,
)
from services.meal_image_analysis_service import (
    MAX_ANALYSES_PER_WINDOW,
    PROVIDER_UNAVAILABLE_MESSAGE,
    RATE_LIMIT_MESSAGE,
    RATE_LIMIT_WINDOW_SECONDS,
    TRACE_NAME,
    MealImageAnalysisService,
)
from tests.fakes import (
    FakeCatalogFoodRepository,
    FakeLogger,
    FakeRateLimiter,
    FakeVisionClient,
    make_catalog_food,
)
from tests.fakes_observability import FakeTraceBackend
from tests.photo_samples import jpeg_bytes
from utils.tracing import Tracer
from utils.vision_client import VisionProviderError

USER = "user-1"
RICE = make_catalog_food(
    "arroz-blanco-cocido",
    "Arroz blanco cocido",
    calories_kcal=130.0,
    protein_g=2.69,
    carbs_g=28.17,
    fat_g=0.28,
)
CHICKEN = make_catalog_food(
    "pechuga-de-pollo-a-la-plancha",
    "Pechuga de pollo a la plancha",
    calories_kcal=165.0,
    protein_g=31.0,
    carbs_g=0.0,
    fat_g=3.57,
)
BEANS = make_catalog_food("frijoles-negros-cocidos", "Frijoles negros cocidos")
CATALOG = [RICE, CHICKEN, BEANS]

RICE_150 = {"catalog_id": "arroz-blanco-cocido", "name": "x", "grams": 150, "confidence": "high"}
CHICKEN_100 = {
    "catalog_id": "pechuga-de-pollo-a-la-plancha",
    "name": "x",
    "grams": 100,
    "confidence": "medium",
}
SAUCE = {"catalog_id": None, "name": "Salsa de tomate", "grams": 30, "confidence": "low"}


def make_service(
    foods=None,
    catalog=None,
    vision=None,
    limiter=None,
    backend=None,
):
    """Arma el servicio con todos los dobles y los devuelve junto a él."""
    parts = {
        "repository": FakeCatalogFoodRepository(CATALOG if catalog is None else catalog),
        "vision": vision if vision is not None else FakeVisionClient(foods=foods),
        "limiter": limiter if limiter is not None else FakeRateLimiter(),
        "backend": backend if backend is not None else FakeTraceBackend(),
        "logger": FakeLogger(),
    }
    tracer = Tracer(backend=parts["backend"], logger=FakeLogger())
    parts["service"] = MealImageAnalysisService(
        parts["repository"],
        parts["vision"],
        parts["limiter"],
        tracer=tracer,
        logger=parts["logger"],
    )
    return parts


def unavailable(parts, images):
    """Ejecuta `analyze` esperando un 503 y devuelve la excepción."""
    with pytest.raises(ServiceUnavailableError) as caught:
        parts["service"].analyze(USER, images)
    return caught.value


def scores(trace):
    return {score.name: (score.value, score.data_type) for score in trace.scores}


# SDD: 024 REQ-001 AC-001.1
def test_rice_150_grams_gives_the_catalog_item_and_totals():
    """Un proveedor que reconoce 150 g de arroz: alimento del catálogo con sus
    nutrientes y totales."""
    parts = make_service(foods=[RICE_150])

    analysis = parts["service"].analyze(USER, [jpeg_bytes()])

    assert [item.catalog_id for item in analysis.items] == ["arroz-blanco-cocido"]
    assert analysis.items[0].name == "Arroz blanco cocido"
    assert analysis.items[0].grams == 150
    assert analysis.unmatched == []
    assert analysis.totals["calories_kcal"] == Decimal("195.0")
    assert analysis.totals["protein_g"] == Decimal("4.04")


# SDD: 024 REQ-001 AC-001.2
def test_provider_receives_the_image_format_and_prompts():
    """El proveedor recibe la imagen, su formato y los textos."""
    parts = make_service(foods=[])
    data = jpeg_bytes()

    parts["service"].analyze(USER, [data])

    call = parts["vision"].calls[0]
    assert call["image_format"] == "jpeg"
    assert call["image"][:3] == b"\xff\xd8\xff"
    assert call["system_prompt"]
    assert call["prompt"]


# SDD: 024 REQ-001 AC-001.3
def test_provider_prompt_contains_every_catalog_food():
    """El texto enviado al proveedor tiene el id y el nombre de todo el catálogo."""
    parts = make_service(foods=[])

    parts["service"].analyze(USER, [jpeg_bytes()])

    prompt = parts["vision"].calls[0]["prompt"]
    for food in CATALOG:
        assert food.id in prompt
        assert food.name in prompt
    assert parts["repository"].list_calls == [True]


# SDD: 024 REQ-001 AC-001.4
def test_items_follow_the_provider_order():
    """Dos alimentos del catálogo salen en el orden del proveedor y con totales."""
    parts = make_service(foods=[CHICKEN_100, SAUCE, RICE_150])

    analysis = parts["service"].analyze(USER, [jpeg_bytes()])

    assert [item.catalog_id for item in analysis.items] == [
        "pechuga-de-pollo-a-la-plancha",
        "arroz-blanco-cocido",
    ]
    assert [u.name for u in analysis.unmatched] == ["Salsa de tomate"]
    assert analysis.totals["calories_kcal"] == Decimal("360.0")


# SDD: 024 REQ-005 AC-005.1
def test_rate_limit_key_is_per_user_with_10_per_hour():
    """Se limita con una clave que incluye al usuario, 10 y 3600 segundos."""
    parts = make_service(foods=[])

    parts["service"].analyze(USER, [jpeg_bytes()])
    parts["service"].analyze("user-2", [jpeg_bytes()])

    assert MAX_ANALYSES_PER_WINDOW == 10
    assert RATE_LIMIT_WINDOW_SECONDS == 3600
    (key_1, limit_1, window_1), (key_2, _, _) = parts["limiter"].calls
    assert USER in key_1
    assert "user-2" in key_2
    assert key_1 != key_2
    assert (limit_1, window_1) == (10, 3600)


# SDD: 024 REQ-005 AC-005.1
def test_rate_limited_user_gets_429_without_calling_the_provider():
    """Con el límite alcanzado: `RateLimitError` con el mensaje exacto y el
    proveedor no recibe la llamada."""
    parts = make_service(foods=[RICE_150], limiter=FakeRateLimiter(allowed=False))

    with pytest.raises(RateLimitError) as caught:
        parts["service"].analyze(USER, [jpeg_bytes()])

    assert caught.value.status_code == 429
    assert caught.value.message == RATE_LIMIT_MESSAGE
    assert (
        RATE_LIMIT_MESSAGE
        == "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."
    )
    assert parts["vision"].calls == []


# SDD: 024 REQ-005 AC-005.3
@pytest.mark.parametrize(
    "images, error_type",
    [
        ([], ValidationError),
        ([b""], ValidationError),
        ([jpeg_bytes(), jpeg_bytes()], ValidationError),
        ([b"no es una imagen"], ValidationError),
    ],
)
def test_invalid_photo_never_reaches_the_rate_limiter_or_the_provider(images, error_type):
    """Una foto no válida da 400 sin contar para el límite ni llamar al proveedor."""
    parts = make_service(foods=[RICE_150])

    with pytest.raises(error_type):
        parts["service"].analyze(USER, images)

    assert parts["limiter"].calls == []
    assert parts["vision"].calls == []


# SDD: 024 REQ-005 AC-005.3
def test_oversized_photo_never_reaches_the_rate_limiter():
    """Una foto de más de 3 MB da 413 sin contar para el límite."""
    parts = make_service(foods=[RICE_150])

    with pytest.raises(PayloadTooLargeError):
        parts["service"].analyze(USER, [b"\xff\xd8\xff" + b"0" * (3 * 1024 * 1024)])

    assert parts["limiter"].calls == []
    assert parts["vision"].calls == []


# SDD: 024 REQ-005 AC-005.1
def test_a_provider_failure_still_counts_for_the_limit():
    """Los análisis que terminan en 503 ya llamaron al proveedor y cuentan."""
    parts = make_service(vision=FakeVisionClient(raise_error=RuntimeError("caído")))

    unavailable(parts, [jpeg_bytes()])

    assert len(parts["limiter"].calls) == 1


# SDD: 024 REQ-009 AC-009.1
@pytest.mark.parametrize(
    "error",
    [
        RuntimeError("el proveedor falló"),
        ReadTimeoutError(endpoint_url="https://bedrock.example"),
        VisionProviderError("unexpected vision response"),
    ],
)
def test_provider_failures_give_503_with_the_exact_message(error):
    """Un error genérico, un tiempo agotado o una respuesta no interpretable
    dan 503 con el mensaje exacto y sin detalles."""
    parts = make_service(vision=FakeVisionClient(raise_error=error))

    exc = unavailable(parts, [jpeg_bytes()])

    assert exc.status_code == 503
    assert exc.message == PROVIDER_UNAVAILABLE_MESSAGE
    assert (
        PROVIDER_UNAVAILABLE_MESSAGE
        == "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."
    )


# SDD: 024 REQ-009 AC-009.1
def test_provider_failure_is_logged_on_the_server():
    """El fallo queda en el registro del servidor."""
    parts = make_service(vision=FakeVisionClient(raise_error=RuntimeError("caído")))

    unavailable(parts, [jpeg_bytes()])

    assert len(parts["logger"].records) >= 1


# SDD: 024 REQ-009 AC-009.3
def test_empty_catalog_gives_503_without_calling_the_provider():
    """Catálogo vacío: 503 y el proveedor no recibe ninguna llamada."""
    parts = make_service(catalog=[], foods=[RICE_150])

    exc = unavailable(parts, [jpeg_bytes()])

    assert exc.message == PROVIDER_UNAVAILABLE_MESSAGE
    assert parts["vision"].calls == []


# SDD: 024 NFR-001 AC-N001.2
def test_neither_the_log_nor_the_trace_contain_the_image_bytes_or_base64():
    """El proveedor falla con un mensaje que contiene los bytes y su base64:
    ni el registro ni los datos de la traza los repiten."""
    data = jpeg_bytes()
    encoded = base64.b64encode(data).decode()
    error = RuntimeError(f"fallo con {data!r} y {encoded}")
    parts = make_service(vision=FakeVisionClient(raise_error=error))

    unavailable(parts, [data])

    everything = " ".join(parts["logger"].records) + " " + repr(parts["backend"].traces)
    assert encoded[:40] not in everything
    assert "JFIF" not in everything


# SDD: 024 NFR-001 NFR-002 AC-N001.2 AC-N002.1
def test_trace_of_a_successful_analysis_does_not_contain_the_image():
    """La traza de un análisis correcto no incluye la imagen ni su base64."""
    data = jpeg_bytes()
    parts = make_service(foods=[RICE_150])

    parts["service"].analyze(USER, [data])

    text = repr(parts["backend"].traces)
    assert base64.b64encode(data).decode()[:40] not in text
    assert "JFIF" not in text


# SDD: 024 NFR-002 AC-N002.1
def test_trace_records_user_format_size_counts_outcome_and_tokens():
    """Dos alimentos propuestos y uno sin coincidencia: una traza con el
    usuario, formato, tamaño, recuentos 2 y 1, resultado `answered` y tokens."""
    data = jpeg_bytes()
    parts = make_service(foods=[RICE_150, CHICKEN_100, SAUCE])

    parts["service"].analyze(USER, [data])

    traces = parts["backend"].traces
    assert len(traces) == 1
    trace = traces[0]
    assert trace.name == TRACE_NAME
    assert trace.user_id == USER
    assert trace.input == {"format": "jpeg", "size_bytes": len(data)}
    assert scores(trace) == {
        "outcome": ("answered", "CATEGORICAL"),
        "items_count": (2, "NUMERIC"),
        "unmatched_count": (1, "NUMERIC"),
    }
    assert trace.finished is True
    assert [step.name for step in trace.steps] == ["vision"]
    assert trace.steps[0].usage == {"input": 100, "output": 20}
    assert trace.steps[0].error is None


# SDD: 024 NFR-002 AC-N002.2
def test_trace_outcome_is_empty_when_nothing_is_recognized():
    """Sin alimentos reconocidos, el resultado de la traza es `empty`."""
    parts = make_service(foods=[])

    analysis = parts["service"].analyze(USER, [jpeg_bytes()])

    assert analysis.items == [] and analysis.unmatched == []
    trace = parts["backend"].traces[0]
    assert scores(trace)["outcome"] == ("empty", "CATEGORICAL")


# SDD: 024 NFR-002 AC-N002.2
def test_trace_outcome_is_answered_with_only_unmatched_foods():
    """Con solo alimentos sin coincidencia también hay respuesta: `answered`."""
    parts = make_service(foods=[SAUCE])

    parts["service"].analyze(USER, [jpeg_bytes()])

    assert scores(parts["backend"].traces[0])["outcome"] == ("answered", "CATEGORICAL")


# SDD: 024 NFR-002 AC-N002.2
def test_trace_outcome_is_error_when_the_provider_fails():
    """Si el proveedor falla, el resultado de la traza es `error`."""
    parts = make_service(vision=FakeVisionClient(raise_error=RuntimeError("caído")))

    unavailable(parts, [jpeg_bytes()])

    trace = parts["backend"].traces[0]
    assert scores(trace)["outcome"] == ("error", "CATEGORICAL")
    assert trace.finished is True


# SDD: 024 NFR-002 AC-N002.3
def test_rejected_photo_creates_no_trace():
    """Una foto rechazada con 400 no genera traza."""
    parts = make_service(foods=[RICE_150])

    with pytest.raises(ValidationError):
        parts["service"].analyze(USER, [])
    with pytest.raises(ValidationError):
        parts["service"].analyze(USER, [b"no es una imagen"])

    assert parts["backend"].traces == []


# SDD: 024 NFR-002 AC-N002.3
def test_rate_limited_request_creates_no_trace():
    """Una petición rechazada con 429 no genera traza."""
    parts = make_service(foods=[RICE_150], limiter=FakeRateLimiter(allowed=False))

    with pytest.raises(RateLimitError):
        parts["service"].analyze(USER, [jpeg_bytes()])

    assert parts["backend"].traces == []


# SDD: 024 NFR-002 AC-N002.4
def test_a_failing_trace_backend_does_not_change_a_successful_analysis():
    """Un trazador que falla en cada envío no convierte el análisis en 503."""
    backend = FakeTraceBackend(raise_error=RuntimeError("langfuse caído"))
    parts = make_service(foods=[RICE_150], backend=backend)

    analysis = parts["service"].analyze(USER, [jpeg_bytes()])

    assert [item.catalog_id for item in analysis.items] == ["arroz-blanco-cocido"]


# SDD: 024 NFR-002 AC-N002.4
def test_a_failing_trace_backend_still_gives_503_only_for_provider_failures():
    """Con el trazador roto y el proveedor roto, sigue siendo el 503 normal."""
    backend = FakeTraceBackend(raise_error=RuntimeError("langfuse caído"))
    parts = make_service(
        vision=FakeVisionClient(raise_error=RuntimeError("caído")), backend=backend
    )

    exc = unavailable(parts, [jpeg_bytes()])

    assert exc.message == PROVIDER_UNAVAILABLE_MESSAGE
