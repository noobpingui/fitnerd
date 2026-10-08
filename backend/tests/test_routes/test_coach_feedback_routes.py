"""Integración de POST /api/coach/feedback (feature 005). El destino de
observabilidad es un `FakeTraceBackend` instalado en el singleton `tracer` y
el contador de votos usa el `RateLimiter` real con un `FakeRedisClient`. Nada
llama a Langfuse ni a Redis. `/ask` no se prueba aquí (construye clientes
reales de Anthropic y Voyage); su contrato se cubre a nivel de servicio.
"""

import json

import pytest

from extensions import jwt_manager, rate_limiter, tracer
from tests.fakes import FakeRedisClient
from tests.fakes_observability import FakeTraceBackend
from utils.feedback_token import FeedbackTokenSigner

URL = "/api/coach/feedback"
TRACE_ID = "1234567890abcdef1234567890abcdef"
MISSING_ID_MESSAGE = "Falta el identificador de la respuesta"
BAD_RATING_MESSAGE = "La valoración debe ser 'up' o 'down'"
NOT_FOUND_MESSAGE = "No se encontró la respuesta que quieres valorar"
LIMIT_MESSAGE = "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."


@pytest.fixture(autouse=True)
def _fake_redis():
    """Sustituye el cliente de Redis del `RateLimiter` por uno en memoria y lo
    restaura al terminar."""
    original = rate_limiter.client
    rate_limiter.client = FakeRedisClient()
    yield
    rate_limiter.client = original


@pytest.fixture
def backend():
    backend = FakeTraceBackend()
    tracer.backend = backend
    return backend


def make_token(app, user_id=42):
    with app.app_context():
        return jwt_manager.generate_token({"id": user_id, "user_role": "user"}, 30)


def auth_headers(app, user_id=42):
    return {"Authorization": f"Bearer {make_token(app, user_id)}"}


def valid_feedback_id(app, user_id=42, trace_id=TRACE_ID):
    return FeedbackTokenSigner(app.config["SECRET_KEY"]).sign(user_id, trace_id)


# SDD: REQ-002 AC-002.1
def test_valid_vote_returns_204_with_no_body_and_records_the_score(client, app, backend):
    """Un voto válido responde 204 sin cuerpo y la puntuación llega al destino."""
    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app), "rating": "up"},
        headers=auth_headers(app),
    )

    assert response.status_code == 204
    assert response.data == b""
    assert len(backend.trace_scores) == 1
    score = backend.trace_scores[0]
    assert (score.trace_id, score.name, score.value, score.data_type) == (
        TRACE_ID,
        "user_feedback",
        1,
        "BOOLEAN",
    )


# SDD: REQ-004 AC-004.1
def test_missing_feedback_id_returns_400_with_the_exact_message(client, app, backend):
    """Sin `feedback_id`: 400 con el mensaje exacto y nada enviado."""
    response = client.post(URL, json={"rating": "up"}, headers=auth_headers(app))

    assert response.status_code == 400
    assert response.get_json() == {"error": MISSING_ID_MESSAGE}
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.2
def test_invalid_rating_returns_400_with_the_exact_message(client, app, backend):
    """Con `rating` "meh": 400 con el mensaje exacto y nada enviado."""
    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app), "rating": "meh"},
        headers=auth_headers(app),
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": BAD_RATING_MESSAGE}
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.3
def test_missing_rating_returns_400_with_the_exact_message(client, app, backend):
    """Sin `rating`: 400 con el mensaje de la valoración."""
    response = client.post(
        URL, json={"feedback_id": valid_feedback_id(app)}, headers=auth_headers(app)
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": BAD_RATING_MESSAGE}


# SDD: REQ-004 AC-004.4
def test_empty_body_returns_400_not_415_or_500(client, app, backend):
    """Una petición sin cuerpo responde 400 con `{"error": …}`."""
    response = client.post(URL, headers=auth_headers(app))

    assert response.status_code == 400
    assert "error" in response.get_json()
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.4
def test_non_json_body_returns_400_not_415_or_500(client, app, backend):
    """Un cuerpo que no es JSON responde 400 con `{"error": …}`."""
    response = client.post(
        URL, data="no-json", content_type="text/plain", headers=auth_headers(app)
    )

    assert response.status_code == 400
    assert "error" in response.get_json()
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.4
def test_json_body_that_is_not_an_object_returns_400(client, app, backend):
    """Un JSON que no es un objeto (una lista) también responde 400."""
    response = client.post(URL, json=["up"], headers=auth_headers(app))

    assert response.status_code == 400
    assert "error" in response.get_json()


# SDD: REQ-005 AC-005.1
def test_feedback_id_issued_for_another_user_returns_404(client, app, backend):
    """El `feedback_id` emitido para el usuario 42 no lo puede votar el 7."""
    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app, user_id=42), "rating": "up"},
        headers=auth_headers(app, user_id=7),
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": NOT_FOUND_MESSAGE}
    assert backend.trace_scores == []


# SDD: REQ-005 AC-005.2
def test_invented_feedback_id_returns_404(client, app, backend):
    """Un `feedback_id` inventado responde 404 con el mensaje exacto."""
    response = client.post(
        URL, json={"feedback_id": "abc", "rating": "up"}, headers=auth_headers(app)
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": NOT_FOUND_MESSAGE}
    assert backend.trace_scores == []


# SDD: REQ-006 AC-006.1
def test_vote_without_authorization_header_returns_401_and_sends_nothing(client, app, backend):
    """Sin cabecera de autorización: 401 y nada enviado."""
    response = client.post(
        URL, json={"feedback_id": valid_feedback_id(app), "rating": "up"}
    )

    assert response.status_code == 401
    assert backend.trace_scores == []


# SDD: REQ-007 AC-007.1
def test_vote_number_61_returns_429_with_the_exact_message(client, app, backend):
    """Tras 60 votos válidos en la hora, el 61 responde 429 con el mensaje
    exacto y no llega al destino."""
    payload = {"feedback_id": valid_feedback_id(app), "rating": "up"}
    headers = auth_headers(app)
    for _ in range(60):
        assert client.post(URL, json=payload, headers=headers).status_code == 204

    response = client.post(URL, json=payload, headers=headers)

    assert response.status_code == 429
    assert response.get_json() == {"error": LIMIT_MESSAGE}
    assert len(backend.trace_scores) == 60


# SDD: REQ-008 AC-008.1
def test_vote_returns_204_when_the_destination_fails(client, app):
    """Con un destino que falla en cada envío el voto sigue respondiendo 204."""
    tracer.backend = FakeTraceBackend(raise_error=RuntimeError("sk-lf-secret-xyz"))

    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app), "rating": "down"},
        headers=auth_headers(app),
    )

    assert response.status_code == 204


# SDD: REQ-008 AC-008.3
def test_vote_returns_204_when_observability_is_disabled(client, app):
    """Con la observabilidad desactivada el voto responde 204 sin enviar nada."""
    tracer.backend = None

    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app), "rating": "up"},
        headers=auth_headers(app),
    )

    assert response.status_code == 204


# SDD: NFR-001 AC-N001.1
def test_request_jwt_never_appears_in_what_is_sent_to_the_destination(client, app, backend):
    """El token de sesión de la petición no aparece en lo que recibe el
    destino de observabilidad."""
    token = make_token(app)

    response = client.post(
        URL,
        json={"feedback_id": valid_feedback_id(app), "rating": "up"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204
    sent = json.dumps([vars(s) for s in backend.trace_scores], default=str)
    assert token not in sent
