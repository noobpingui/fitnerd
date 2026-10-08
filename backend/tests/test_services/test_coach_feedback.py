"""Valoración 👍/👎 del coach (feature 005): `CoachService.ask_with_feedback`
emite el `feedback_id` firmado y `CoachFeedbackService.submit` registra el
voto como puntuación `user_feedback`. Todo con fakes escritos a mano: un
destino de trazas en memoria, un `FakeRedisClient` dentro de un `RateLimiter`
real, y proveedores simulados. Nada llama a Langfuse, Voyage, Claude ni Redis.
"""

import dataclasses
import json

import pytest

from exceptions.custom_exceptions import (
    RateLimitError,
    ResourceNotFoundError,
    ServiceUnavailableError,
    ValidationError,
)
from services.coach_feedback_service import CoachFeedbackService
from services.coach_service import CoachAnswer, CoachService
from tests.fakes import FakeLLMClient, FakeLogger, FakeRateLimiter, FakeRedisClient
from tests.fakes_observability import FakeObservableRetrievalService, FakeTraceBackend
from utils.feedback_token import FeedbackTokenSigner
from utils.rate_limiter import RateLimiter
from utils.tracing import Tracer

SECRET = "test-secret"
TRACE_A = "a" * 32
TRACE_B = "b" * 32
DONT_KNOW_MESSAGE = "No tengo informacion relacionada con ese tema en especifico."
REFUSED_MESSAGE = "No pude generar una respuesta para esa pregunta."
MISSING_ID_MESSAGE = "Falta el identificador de la respuesta"
BAD_RATING_MESSAGE = "La valoración debe ser 'up' o 'down'"
NOT_FOUND_MESSAGE = "No se encontró la respuesta que quieres valorar"
LIMIT_MESSAGE = "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."

GOOD_CANDIDATES = [
    {"video_title": "Series", "chunk_text": "Haz 3 series de 10.", "distance": 0.35},
]
FAR_CANDIDATES = [
    {"video_title": "Lejano", "chunk_text": "Tema sin relación.", "distance": 0.95},
]


def make_signer():
    return FeedbackTokenSigner(SECRET)


def make_coach(candidates=None, llm=None, backend=None, tracer=None):
    backend = backend if backend is not None else FakeTraceBackend()
    tracer = tracer or Tracer(backend=backend, logger=FakeLogger())
    retrieval = FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES if candidates is None else candidates
    )
    llm = llm or FakeLLMClient(answer="Haz 3 series de 10.")
    service = CoachService(
        retrieval, llm, FakeRateLimiter(allowed=True), tracer, feedback_signer=make_signer()
    )
    return service, backend


def make_feedback(limiter=None, backend=None, logger=None):
    backend = backend if backend is not None else FakeTraceBackend()
    logger = logger if logger is not None else FakeLogger()
    tracer = Tracer(backend=backend, logger=logger)
    if limiter is None:
        limiter = RateLimiter()
        limiter.client = FakeRedisClient()
    service = CoachFeedbackService(make_signer(), limiter, tracer)
    return service, backend, tracer, logger


# --- REQ-001: feedback_id en la respuesta del coach -----------------------------


# SDD: REQ-001 AC-001.1
def test_ask_with_feedback_returns_a_signed_feedback_id_for_a_generated_answer():
    """Con la observabilidad activa, una respuesta generada trae `feedback_id`
    firmado que corresponde a la traza abierta."""
    service, backend = make_coach()

    result = service.ask_with_feedback("¿Cuántas series hago?", user_id=42)

    assert isinstance(result, CoachAnswer)
    assert result.answer == "Haz 3 series de 10."
    assert isinstance(result.feedback_id, str) and result.feedback_id
    assert make_signer().verify(42, result.feedback_id) == backend.traces[0].trace_id


# SDD: REQ-001 AC-001.2
def test_ask_with_feedback_returns_a_feedback_id_for_the_dont_know_answer():
    """Sin fragmentos bajo el umbral, la respuesta "sin información" también
    trae `feedback_id`."""
    service, backend = make_coach(candidates=FAR_CANDIDATES)

    result = service.ask_with_feedback("¿Qué es el yoga?", user_id=42)

    assert result.answer == DONT_KNOW_MESSAGE
    assert isinstance(result.feedback_id, str) and result.feedback_id
    assert make_signer().verify(42, result.feedback_id) == backend.traces[0].trace_id


# SDD: REQ-001 AC-001.3
def test_ask_with_feedback_returns_a_feedback_id_when_the_model_refuses():
    """Si el modelo rechaza la petición, la respuesta también trae
    `feedback_id`."""
    service, backend = make_coach(llm=FakeLLMClient(answer=None))

    result = service.ask_with_feedback("Pregunta", user_id=42)

    assert result.answer == REFUSED_MESSAGE
    assert isinstance(result.feedback_id, str) and result.feedback_id
    assert make_signer().verify(42, result.feedback_id) == backend.traces[0].trace_id


# SDD: REQ-001 AC-001.4
def test_ask_with_feedback_returns_none_when_observability_is_inactive():
    """Con el tracer inactivo la respuesta es la de siempre y `feedback_id` es
    `None`."""
    service, _ = make_coach(tracer=Tracer())

    result = service.ask_with_feedback("Pregunta", user_id=42)

    assert result.answer == "Haz 3 series de 10."
    assert result.feedback_id is None


# SDD: REQ-001 AC-001.5
def test_ask_with_feedback_returns_none_when_the_trace_cannot_be_opened():
    """Si el destino falla al abrir la traza, la respuesta es la de siempre y
    `feedback_id` es `None`."""
    backend = FakeTraceBackend(raise_error=RuntimeError("sk-lf-secret-xyz"))
    service, _ = make_coach(backend=backend)

    result = service.ask_with_feedback("Pregunta", user_id=42)

    assert result.answer == "Haz 3 series de 10."
    assert result.feedback_id is None


# SDD: REQ-001 AC-001.6
def test_ask_with_feedback_returns_a_different_id_for_each_question():
    """Dos preguntas del mismo usuario producen `feedback_id` distintos."""
    service, backend = make_coach()

    first = service.ask_with_feedback("Primera", user_id=42)
    second = service.ask_with_feedback("Segunda", user_id=42)

    assert first.feedback_id != second.feedback_id
    assert len(backend.traces) == 2


# SDD: REQ-001 AC-001.6
def test_ask_still_returns_a_plain_string():
    """`ask` conserva su contrato: devuelve solo el texto de la respuesta."""
    service, _ = make_coach()

    assert service.ask("Pregunta", user_id=42) == "Haz 3 series de 10."


# SDD: REQ-001 AC-001.7
def test_ask_with_feedback_raises_service_unavailable_when_a_provider_fails():
    """Si falla un proveedor se lanza `ServiceUnavailableError` y no se
    devuelve ningún `CoachAnswer` (ni `feedback_id`)."""
    service, _ = make_coach(llm=FakeLLMClient(raise_error=RuntimeError("proveedor caído")))

    with pytest.raises(ServiceUnavailableError):
        service.ask_with_feedback("Pregunta", user_id=42)


# --- REQ-002: enviar un voto ----------------------------------------------------


# SDD: REQ-002 AC-002.1
def test_submit_up_sends_a_boolean_user_feedback_score_with_value_one():
    """Un voto `up` envía `user_feedback` BOOLEAN con valor 1 sobre la traza."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    result = service.submit(42, feedback_id, "up")

    assert result is None
    assert len(backend.trace_scores) == 1
    score = backend.trace_scores[0]
    assert score.trace_id == TRACE_A
    assert score.name == "user_feedback"
    assert score.value == 1
    assert score.data_type == "BOOLEAN"


# SDD: REQ-002 AC-002.2
def test_submit_down_sends_a_boolean_user_feedback_score_with_value_zero():
    """Un voto `down` envía `user_feedback` BOOLEAN con valor 0."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    service.submit(42, feedback_id, "down")

    score = backend.trace_scores[0]
    assert score.trace_id == TRACE_A
    assert score.name == "user_feedback"
    assert score.value == 0
    assert score.data_type == "BOOLEAN"


# SDD: REQ-002 AC-002.3
def test_submit_attaches_each_vote_to_the_trace_of_its_own_answer():
    """Dos respuestas con `feedback_id` distintos: cada voto va a su traza."""
    service, backend, _, _ = make_feedback()
    signer = make_signer()

    service.submit(42, signer.sign(42, TRACE_A), "up")
    service.submit(42, signer.sign(42, TRACE_B), "down")

    by_trace = {s.trace_id: s.value for s in backend.trace_scores}
    assert by_trace == {TRACE_A: 1, TRACE_B: 0}


# SDD: REQ-002 AC-002.1
def test_vote_on_a_feedback_id_issued_by_ask_reaches_the_trace_of_that_answer():
    """Flujo completo de servicio: el `feedback_id` que emite el coach sirve
    para votar y la puntuación cae en la traza de esa respuesta."""
    coach, backend = make_coach()
    answer = coach.ask_with_feedback("Pregunta", user_id=42)
    feedback, _, tracer, _ = make_feedback(backend=backend)

    feedback.submit(42, answer.feedback_id, "up")

    assert backend.trace_scores[0].trace_id == backend.traces[0].trace_id


# --- REQ-003: cambiar el voto ---------------------------------------------------


# SDD: REQ-003 AC-003.1
def test_changing_the_vote_reuses_the_same_score_id_and_keeps_the_last_value():
    """Los dos envíos usan el mismo `score_id` y el valor final es 0."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    service.submit(42, feedback_id, "up")
    service.submit(42, feedback_id, "down")

    assert len(backend.trace_scores) == 2
    assert backend.trace_scores[0].score_id == backend.trace_scores[1].score_id
    assert backend.trace_scores[0].score_id
    assert len(backend.scores_by_id) == 1
    assert next(iter(backend.scores_by_id.values())).value == 0


# SDD: REQ-003 AC-003.2
def test_repeating_the_same_vote_keeps_a_single_score():
    """Votar `up` dos veces deja una sola puntuación con valor 1."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    service.submit(42, feedback_id, "up")
    service.submit(42, feedback_id, "up")

    assert len(backend.scores_by_id) == 1
    assert next(iter(backend.scores_by_id.values())).value == 1


# SDD: REQ-003 AC-003.1
def test_different_traces_use_different_score_ids():
    """Las puntuaciones de trazas distintas no se pisan entre sí."""
    service, backend, _, _ = make_feedback()
    signer = make_signer()

    service.submit(42, signer.sign(42, TRACE_A), "up")
    service.submit(42, signer.sign(42, TRACE_B), "up")

    assert len(backend.scores_by_id) == 2


# --- REQ-004: validación --------------------------------------------------------


# SDD: REQ-004 AC-004.1
@pytest.mark.parametrize("feedback_id", [None, "", "   ", 123, ["x"]])
def test_submit_rejects_a_missing_or_empty_feedback_id(feedback_id):
    """Sin `feedback_id` como texto no vacío: ValidationError y nada enviado."""
    service, backend, _, _ = make_feedback()

    with pytest.raises(ValidationError) as exc_info:
        service.submit(42, feedback_id, "up")

    assert str(exc_info.value) == MISSING_ID_MESSAGE
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.2
@pytest.mark.parametrize("rating", ["meh", "UP", "Up", " up", "up ", "", 1, True])
def test_submit_rejects_a_rating_that_is_not_exactly_up_or_down(rating):
    """Un `rating` distinto de `up`/`down` exactos: ValidationError y nada
    enviado."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    with pytest.raises(ValidationError) as exc_info:
        service.submit(42, feedback_id, rating)

    assert str(exc_info.value) == BAD_RATING_MESSAGE
    assert backend.trace_scores == []


# SDD: REQ-004 AC-004.3
def test_submit_rejects_a_missing_rating():
    """Sin `rating` (None): ValidationError con el mensaje de la valoración."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    with pytest.raises(ValidationError) as exc_info:
        service.submit(42, feedback_id, None)

    assert str(exc_info.value) == BAD_RATING_MESSAGE
    assert backend.trace_scores == []


# --- REQ-005: solo el destinatario puede votar ----------------------------------


# SDD: REQ-005 AC-005.1
def test_submit_rejects_a_feedback_id_issued_for_another_user():
    """Un `feedback_id` emitido para el usuario 42 no lo puede usar el 7."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    with pytest.raises(ResourceNotFoundError) as exc_info:
        service.submit(7, feedback_id, "up")

    assert str(exc_info.value) == NOT_FOUND_MESSAGE
    assert backend.trace_scores == []


# SDD: REQ-005 AC-005.2
def test_submit_rejects_an_invented_feedback_id():
    """Un `feedback_id` inventado ("abc") da ResourceNotFoundError."""
    service, backend, _, _ = make_feedback()

    with pytest.raises(ResourceNotFoundError) as exc_info:
        service.submit(42, "abc", "up")

    assert str(exc_info.value) == NOT_FOUND_MESSAGE
    assert backend.trace_scores == []


# SDD: REQ-005 AC-005.3
def test_submit_rejects_a_tampered_feedback_id():
    """Cambiar un carácter de un `feedback_id` válido da ResourceNotFoundError."""
    service, backend, _, _ = make_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)
    tampered = feedback_id[:-3] + ("A" if feedback_id[-3] != "A" else "B") + feedback_id[-2:]

    with pytest.raises(ResourceNotFoundError):
        service.submit(42, tampered, "up")

    assert backend.trace_scores == []


# --- REQ-007: límite de votos ---------------------------------------------------


def make_limited_feedback():
    limiter = RateLimiter()
    redis_client = FakeRedisClient()
    limiter.client = redis_client
    service, backend, _, _ = make_feedback(limiter=limiter)
    return service, backend, redis_client


# SDD: REQ-007 AC-007.1
def test_vote_number_61_in_an_hour_raises_rate_limit_error_and_sends_nothing():
    """Tras 60 votos válidos, el siguiente lanza RateLimitError con el mensaje
    exacto y no envía la puntuación."""
    service, backend, _ = make_limited_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)
    for _ in range(60):
        service.submit(42, feedback_id, "up")
    sent_before = len(backend.trace_scores)

    with pytest.raises(RateLimitError) as exc_info:
        service.submit(42, feedback_id, "down")

    assert str(exc_info.value) == LIMIT_MESSAGE
    assert len(backend.trace_scores) == sent_before == 60


# SDD: REQ-007 AC-007.2
def test_vote_number_60_in_an_hour_is_accepted():
    """El voto 60 todavía se acepta."""
    service, backend, _ = make_limited_feedback()
    feedback_id = make_signer().sign(42, TRACE_A)

    for _ in range(60):
        service.submit(42, feedback_id, "up")

    assert len(backend.trace_scores) == 60


# SDD: REQ-007 AC-007.3
def test_the_vote_limit_is_per_user():
    """Con el usuario 42 en el límite, el usuario 7 aún puede votar."""
    service, backend, _ = make_limited_feedback()
    signer = make_signer()
    for _ in range(60):
        service.submit(42, signer.sign(42, TRACE_A), "up")

    service.submit(7, signer.sign(7, TRACE_B), "up")

    assert backend.trace_scores[-1].trace_id == TRACE_B


# SDD: REQ-007 AC-007.4
def test_rejected_requests_do_not_count_towards_the_limit():
    """60 peticiones rechazadas con 404 no gastan cupo: el voto válido siguiente
    se acepta."""
    service, backend, redis_client = make_limited_feedback()
    for _ in range(60):
        with pytest.raises(ResourceNotFoundError):
            service.submit(42, "abc", "up")
    for _ in range(60):
        with pytest.raises(ValidationError):
            service.submit(42, make_signer().sign(42, TRACE_A), "meh")

    service.submit(42, make_signer().sign(42, TRACE_A), "up")

    assert len(backend.trace_scores) == 1
    assert redis_client.counts == {"ratelimit:coach:feedback:42": 1}


# SDD: REQ-007 AC-007.1
def test_the_vote_limit_uses_a_one_hour_window_and_a_per_user_key():
    """El contador vive en `ratelimit:coach:feedback:<user_id>` con ventana de
    3600 segundos."""
    service, _, redis_client = make_limited_feedback()

    service.submit(42, make_signer().sign(42, TRACE_A), "up")

    assert redis_client.expirations == [("ratelimit:coach:feedback:42", 3600)]


# --- REQ-008: el voto no depende de Langfuse ------------------------------------


# SDD: REQ-008 AC-008.1
def test_submit_does_not_raise_when_the_destination_fails():
    """Un destino que falla en cada envío no impide aceptar el voto."""
    backend = FakeTraceBackend(raise_error=RuntimeError("sk-lf-secret-xyz"))
    service, _, _, _ = make_feedback(backend=backend)

    service.submit(42, make_signer().sign(42, TRACE_A), "up")


# SDD: REQ-008 AC-008.2
def test_a_failed_send_logs_a_warning_without_credentials():
    """El fallo del envío queda en el log como aviso de la valoración, sin las
    claves de Langfuse ni el mensaje de la excepción."""
    backend = FakeTraceBackend(raise_error=RuntimeError("sk-lf-secret-xyz pk-lf-public-xyz"))
    service, _, _, logger = make_feedback(backend=backend)

    service.submit(42, make_signer().sign(42, TRACE_A), "up")

    assert len(logger.records) >= 1
    assert any("valoración" in r and "Langfuse" in r for r in logger.records)
    joined = " ".join(logger.records)
    assert "sk-lf-secret-xyz" not in joined
    assert "pk-lf-" not in joined


# SDD: REQ-008 AC-008.3
def test_submit_sends_nothing_when_observability_is_disabled_after_issuing_the_id():
    """Se emite el `feedback_id` con el tracer activo y después se desactiva:
    el voto se acepta sin intentar enviar nada."""
    coach, backend = make_coach()
    answer = coach.ask_with_feedback("Pregunta", user_id=42)
    service, _, tracer, _ = make_feedback(backend=backend)
    tracer.backend = None

    service.submit(42, answer.feedback_id, "up")

    assert backend.trace_scores == []


# --- NFR-001: privacidad --------------------------------------------------------


# SDD: NFR-001 AC-N001.1
def test_neither_the_feedback_id_nor_the_vote_payload_contain_personal_data():
    """Ni el `feedback_id` ni lo enviado al destino por el voto contienen el
    email, el nombre ni el token de sesión del usuario."""
    jwt_token = "eyJhbGciOiJSUzI1NiJ9.eyJpZCI6NDJ9.firma-de-prueba"
    coach, backend = make_coach()
    answer = coach.ask_with_feedback("Pregunta", user_id=42)
    service, _, _, _ = make_feedback(backend=backend)

    service.submit(42, answer.feedback_id, "up")

    sent = json.dumps([dataclasses.asdict(s) for s in backend.trace_scores], default=str)
    for secret in ("ana@example.com", "Ana Pérez", jwt_token):
        assert secret not in answer.feedback_id
        assert secret not in sent
