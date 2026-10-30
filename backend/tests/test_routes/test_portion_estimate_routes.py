"""Integración de POST /api/meals/portion-estimate (spec 030) contra el
Postgres de prueba. El modelo es un `FakeStructuredLLMClient` instalado en el
singleton `portion_llm` y Redis, un `FakeRedisClient` instalado en
`rate_limiter` (ambos se restauran al terminar): nada sale a la red.
"""

import json

import pytest
from sqlalchemy import func, select

from extensions import db, jwt_manager, portion_llm, rate_limiter, tracer
from models import CustomFood, FoodFavorite, Meal, MealItem
from tests.fakes import FakeRedisClient, FakeStructuredLLMClient
from tests.fakes_observability import FakeTraceBackend

URL = "/api/meals/portion-estimate"
INVALID = "La petición no es válida"
REQUIRED = "Escribe qué alimento quieres pesar."
TOO_LONG = "La pregunta no puede superar los 200 caracteres."
RATE_LIMITED = "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde."
UNAVAILABLE = "No se pudo estimar el peso en este momento. Vuelve a intentarlo en unos minutos."
NOT_FOOD_MESSAGE = "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento."
UNKNOWN_MESSAGE = "No he podido estimar el peso. Prueba a describir el alimento de otra forma."

EGGS = {
    "is_food": True,
    "grams": 250,
    "unit": "5 huevos grandes",
    "note": "Unos 50 g por huevo sin cáscara.",
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
def model():
    """Instala un modelo de mentira en el singleton `portion_llm`; cada test
    fija `model.data` con lo que "responde" el modelo."""
    original = portion_llm.llm_client
    fake = FakeStructuredLLMClient(data=dict(EGGS))
    portion_llm.llm_client = fake
    yield fake
    portion_llm.llm_client = original


def auth_headers(app, user_id="user-1", minutes=30):
    with app.app_context():
        token = jwt_manager.generate_token({"id": user_id, "user_role": "user"}, minutes)
    return {"Authorization": f"Bearer {token}"}


def ask(client, app, question="5 huevos", user_id="user-1"):
    return client.post(URL, json={"question": question}, headers=auth_headers(app, user_id))


def post_raw(client, app, **kwargs):
    return client.post(URL, headers=auth_headers(app), **kwargs)


# --- Caso feliz -------------------------------------------------------------


# SDD: 030 REQ-001 AC-001.1
def test_valid_question_returns_the_exact_estimation(client, app, model):
    """200 con las cinco claves de una estimación."""
    response = ask(client, app, "5 huevos")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "estimated",
        "grams": 250,
        "unit": "5 huevos grandes",
        "note": "Unos 50 g por huevo sin cáscara.",
        "message": None,
    }
    assert len(model.calls) == 1


# SDD: 030 REQ-003 AC-003.1
def test_not_food_question_returns_the_fixed_message(client, app, model):
    """Pregunta que no es de comida: 200 con not_food y el mensaje fijo."""
    model.data = {"is_food": False}

    response = ask(client, app, "¿Quién ganó el mundial?")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "not_food",
        "grams": None,
        "unit": None,
        "note": None,
        "message": NOT_FOOD_MESSAGE,
    }


# SDD: 030 REQ-004 AC-004.1
def test_invalid_grams_return_unknown(client, app, model):
    """Comida con 5001 g: 200 con unknown y el mensaje fijo."""
    model.data = {"is_food": True, "grams": 5001, "unit": "x", "note": "y"}

    response = ask(client, app)

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "unknown",
        "grams": None,
        "unit": None,
        "note": None,
        "message": UNKNOWN_MESSAGE,
    }


# SDD: 030 REQ-004 AC-004.2
def test_model_refusal_returns_unknown(client, app, model):
    """Si el modelo rechaza la generación: 200 con unknown."""
    model.stop_reason = "refusal"

    response = ask(client, app)

    assert response.status_code == 200
    assert response.get_json()["status"] == "unknown"


# --- Validación -------------------------------------------------------------


# SDD: 030 REQ-005 AC-005.1
@pytest.mark.parametrize(
    "kwargs",
    [
        {"data": "no soy json", "content_type": "text/plain"},
        {"data": "{malformado", "content_type": "application/json"},
        {"data": "null", "content_type": "application/json"},
        {"json": ["huevo"]},
        {"json": 5},
    ],
)
def test_a_body_that_is_not_a_json_object_returns_400(client, app, model, kwargs):
    """Texto, JSON malformado, null, lista o número: 400 y el modelo no se consulta."""
    response = post_raw(client, app, **kwargs)

    assert response.status_code == 400
    assert response.get_json() == {"error": INVALID}
    assert model.calls == []


# SDD: 030 REQ-005 AC-005.2
@pytest.mark.parametrize("body", [{}, {"question": ""}, {"question": "   "}])
def test_a_missing_or_blank_question_returns_400(client, app, model, body):
    """Pregunta ausente, vacía o de espacios: 400 con el mensaje que pide el alimento."""
    response = post_raw(client, app, json=body)

    assert response.status_code == 400
    assert response.get_json() == {"error": REQUIRED}
    assert model.calls == []


# SDD: 030 REQ-005 AC-005.3
@pytest.mark.parametrize("value", [5, ["huevo"], None])
def test_a_question_that_is_not_text_returns_400(client, app, model, value):
    """Una pregunta numérica, lista o null: 400 de petición no válida."""
    response = post_raw(client, app, json={"question": value})

    assert response.status_code == 400
    assert response.get_json() == {"error": INVALID}
    assert model.calls == []


# SDD: 030 REQ-005 AC-005.4
def test_a_question_of_201_characters_returns_400(client, app, model):
    """201 caracteres: 400 con el mensaje del máximo."""
    response = ask(client, app, "a" * 201)

    assert response.status_code == 400
    assert response.get_json() == {"error": TOO_LONG}
    assert model.calls == []


# SDD: 030 REQ-005 AC-005.5
def test_a_question_of_200_characters_with_edge_spaces_is_accepted_stripped(client, app, model):
    """200 caracteres rodeados de espacios: 200 y el modelo recibe la pregunta recortada."""
    question = "a" * 200

    response = ask(client, app, f"  {question}  ")

    assert response.status_code == 200
    assert model.calls[0]["messages"] == [{"role": "user", "content": question}]


# SDD: 030 REQ-005 AC-005.6
def test_invalid_requests_do_not_count_for_the_limit(client, app, model):
    """9 preguntas válidas, 3 no válidas y una válida más: la última da 200."""
    for _ in range(9):
        assert ask(client, app).status_code == 200
    for body in ({}, {"question": ""}, {"question": 5}):
        assert post_raw(client, app, json=body).status_code == 400

    response = ask(client, app)

    assert response.status_code == 200
    assert len(model.calls) == 10


# --- Límite y fallo del proveedor ------------------------------------------


# SDD: 030 REQ-006 AC-006.1
def test_the_eleventh_question_returns_429_without_calling_the_model(client, app, model):
    """Tras 10 preguntas válidas, la undécima da 429 y el modelo no se vuelve a consultar."""
    for _ in range(10):
        assert ask(client, app).status_code == 200

    response = ask(client, app)

    assert response.status_code == 429
    assert response.get_json() == {"error": RATE_LIMITED}
    assert len(model.calls) == 10


# SDD: 030 REQ-006 AC-006.2
def test_the_counter_is_set_to_expire_in_21600_seconds(client, app, redis_fake):
    """La ventana del contador del usuario es de 21.600 segundos."""
    ask(client, app, user_id="user-1")

    assert redis_fake.counts == {"ratelimit:meals:portion-estimate:user-1": 1}
    assert redis_fake.expirations == [("ratelimit:meals:portion-estimate:user-1", 21600)]


# SDD: 030 REQ-006 AC-006.3
def test_one_users_limit_does_not_affect_another(client, app):
    """El usuario A agota su límite y el B recibe 200."""
    for _ in range(10):
        ask(client, app, user_id="user-a")
    assert ask(client, app, user_id="user-a").status_code == 429

    assert ask(client, app, user_id="user-b").status_code == 200


# SDD: 030 REQ-006 AC-006.5
def test_every_valid_question_counts_whatever_its_outcome(client, app, model):
    """Preguntas not_food, unknown y 503 cuentan: la décima da 200 y la undécima 429."""
    model.data = {"is_food": False}
    assert ask(client, app).status_code == 200  # 1: not_food
    model.data = {"is_food": True, "grams": 0}
    assert ask(client, app).status_code == 200  # 2: unknown
    model.raise_error = RuntimeError("proveedor caído")
    assert ask(client, app).status_code == 503  # 3: error
    model.raise_error = None
    model.data = dict(EGGS)
    for _ in range(6):  # 4 a 9
        assert ask(client, app).status_code == 200

    assert ask(client, app).status_code == 200  # 10

    response = ask(client, app)  # 11
    assert response.status_code == 429
    assert response.get_json() == {"error": RATE_LIMITED}


# SDD: 030 REQ-007 AC-007.1
def test_provider_failure_returns_503_without_the_original_error(client, app, model):
    """Un fallo del proveedor da 503 con el mensaje fijo y sin el texto original."""
    model.raise_error = RuntimeError("detalle-secreto-del-proveedor")

    response = ask(client, app)

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}
    assert "detalle-secreto" not in response.get_data(as_text=True)


# --- Sesión y datos ---------------------------------------------------------


# SDD: 030 REQ-008 AC-008.1
def test_request_without_token_returns_401(client, model):
    """Sin token: 401 y el modelo no se consulta."""
    response = client.post(URL, json={"question": "5 huevos"})

    assert response.status_code == 401
    assert model.calls == []


# SDD: 030 REQ-008 AC-008.1
def test_request_with_an_invalid_token_returns_401(client, model):
    """Con un token no válido: 401 y el modelo no se consulta."""
    response = client.post(
        URL, json={"question": "5 huevos"}, headers={"Authorization": "Bearer no-es-un-token"}
    )

    assert response.status_code == 401
    assert model.calls == []


# SDD: 030 REQ-008 AC-008.1
def test_request_with_an_expired_token_returns_401(client, app, model):
    """Con un token caducado: 401 y el modelo no se consulta."""
    response = client.post(
        URL, json={"question": "5 huevos"}, headers=auth_headers(app, minutes=-5)
    )

    assert response.status_code == 401
    assert model.calls == []


# SDD: 030 REQ-008 AC-008.2
def test_a_user_id_in_the_body_is_ignored_for_the_limit(client, app, redis_fake):
    """El contador que se incrementa es el del usuario del token."""
    response = post_raw(
        client, app, json={"question": "5 huevos", "user_id": "otro-usuario"}
    )

    assert response.status_code == 200
    assert redis_fake.counts == {"ratelimit:meals:portion-estimate:user-1": 1}


def _row_counts(app):
    with app.app_context():
        return [
            db.session.scalar(select(func.count()).select_from(table))
            for table in (Meal, MealItem, CustomFood, FoodFavorite)
        ]


# SDD: 030 NFR-003 AC-N003.1
def test_a_question_does_not_change_any_diary_or_library_row(client, app, registered_user):
    """Tras un 200 no cambian las filas de comidas, alimentos del diario, alimentos
    propios ni favoritos."""
    before = _row_counts(app)

    response = client.post(
        URL, json={"question": "5 huevos"}, headers=registered_user["headers"]
    )

    assert response.status_code == 200
    assert _row_counts(app) == before


# --- Contador no disponible (REQ-010) ---------------------------------------


# SDD: 030 REQ-010 AC-010.1
def test_a_failing_counter_returns_503_without_the_original_error(client, app, model, redis_fake):
    """Redis que lanza un error: 503 con el mensaje fijo, sin el texto original y
    sin consultar el modelo."""
    redis_fake.raise_error = ConnectionError("detalle-redis")

    response = ask(client, app)

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE}
    assert "detalle-redis" not in response.get_data(as_text=True)
    assert model.calls == []


# SDD: 030 REQ-010 AC-010.3
def test_a_blank_question_returns_400_even_when_the_counter_fails(client, app, model, redis_fake):
    """Con Redis caído y la pregunta vacía: 400 de validación, no 503."""
    redis_fake.raise_error = ConnectionError("detalle-redis")

    response = ask(client, app, question="")

    assert response.status_code == 400
    assert response.get_json() == {"error": REQUIRED}
    assert model.calls == []

    valid = ask(client, app)

    assert valid.status_code == 503
    assert valid.get_json() == {"error": UNAVAILABLE}
    assert model.calls == []


# --- Tamaño máximo del cuerpo (REQ-011) -------------------------------------


@pytest.fixture
def trace_backend():
    """Instala un destino de trazas de mentira en el `tracer` y lo restaura."""
    original = tracer.backend
    fake = FakeTraceBackend()
    tracer.backend = fake
    yield fake
    tracer.backend = original


def body_of_size(size):
    """Objeto JSON con una pregunta válida y un relleno, de exactamente `size` bytes."""
    base = len(json.dumps({"question": "5 huevos", "pad": ""}).encode("utf-8"))
    body = json.dumps({"question": "5 huevos", "pad": "x" * (size - base)}).encode("utf-8")
    assert len(body) == size
    return body


def post_sized(client, app, size):
    return client.post(
        URL,
        data=body_of_size(size),
        content_type="application/json",
        headers=auth_headers(app),
    )


# SDD: 030 REQ-011 AC-011.1
def test_a_body_of_4097_bytes_returns_400_without_calling_the_model(client, app, model):
    """4097 bytes: 400 «La petición no es válida» y el modelo no se consulta."""
    response = post_sized(client, app, 4097)

    assert response.status_code == 400
    assert response.get_json() == {"error": INVALID}
    assert model.calls == []


# SDD: 030 REQ-011 AC-011.2
def test_a_body_of_exactly_4096_bytes_is_accepted(client, app, model):
    """4096 bytes exactos con una pregunta válida: 200; con 4097, 400."""
    response = post_sized(client, app, 4096)

    assert response.status_code == 200
    assert response.get_json()["status"] == "estimated"
    assert len(model.calls) == 1

    over = post_sized(client, app, 4097)

    assert over.status_code == 400
    assert len(model.calls) == 1


# SDD: 030 REQ-011 AC-011.3
def test_a_body_of_4097_bytes_touches_neither_the_counter_nor_the_tracer(
    client, app, redis_fake, trace_backend
):
    """Un cuerpo de 4097 bytes no incrementa el contador ni registra traza."""
    response = post_sized(client, app, 4097)

    assert response.status_code == 400
    assert redis_fake.counts == {}
    assert redis_fake.expirations == []
    assert trace_backend.traces == []
