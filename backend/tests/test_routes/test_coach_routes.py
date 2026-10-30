"""Integración de POST /api/coach/ask: solo lo que cambia con la
observabilidad (las preguntas invalidas no generan traza). El resto de AC se
prueba a nivel de servicio, porque la ruta construye clientes reales de
Anthropic y Voyage.
"""

import anthropic
import pytest

from extensions import (
    coach_llm,
    db,
    embedding_client,
    jwt_manager,
    portion_llm,
    rate_limiter,
    tracer,
)
from models import TranscriptChunk, Video
from tests.fakes import (
    FakeLLMClient,
    FakeRedisClient,
    FakeStructuredLLMClient,
    FakeVoyageClient,
    basis_vector,
)
from tests.fakes_observability import FakeTraceBackend

PORTION_KEY = "ratelimit:meals:portion-estimate:user-1"
COACH_KEY = "ratelimit:coach:ask:user-1"


# SDD: REQ-001 AC-001.3
@pytest.mark.parametrize(
    "question",
    ["", "   ", "x" * 501],
    ids=["empty", "only-spaces", "501-characters"],
)
def test_invalid_questions_return_400_and_send_no_trace(client, registered_user, question):
    """Una pregunta vacía, de solo espacios o de más de 500 caracteres
    responde 400 y el destino no recibe ninguna traza."""
    backend = FakeTraceBackend()
    tracer.backend = backend

    response = client.post(
        "/api/coach/ask",
        json={"question": question},
        headers=registered_user["headers"],
    )

    assert response.status_code == 400
    assert backend.traces == []


# --- Spec 030: el coach usa el cliente perezoso `coach_llm` ----------------


@pytest.fixture
def redis_fake():
    """Sustituye el cliente de Redis del `RateLimiter` por uno en memoria."""
    original = rate_limiter.client
    fake = FakeRedisClient()
    rate_limiter.client = fake
    yield fake
    rate_limiter.client = original


@pytest.fixture
def coach_model():
    """Instala un modelo de texto de mentira en el singleton `coach_llm`."""
    original = coach_llm.llm_client
    fake = FakeLLMClient(answer="Haz 3 series de 10.")
    coach_llm.llm_client = fake
    yield fake
    coach_llm.llm_client = original


@pytest.fixture
def portion_model():
    """Instala un modelo estructurado de mentira en el singleton `portion_llm`."""
    original = portion_llm.llm_client
    fake = FakeStructuredLLMClient(
        data={"is_food": True, "grams": 250, "unit": "5 huevos", "note": "Unos 50 g cada uno."}
    )
    portion_llm.llm_client = fake
    yield fake
    portion_llm.llm_client = original


@pytest.fixture
def voyage():
    """Sustituye el cliente de Voyage del singleton por un doble."""
    original = embedding_client.client
    fake = FakeVoyageClient()
    embedding_client.client = fake
    yield fake
    embedding_client.client = original


@pytest.fixture
def transcript(app):
    """Un vídeo con un fragmento cuyo vector coincide con el de las consultas."""
    with app.app_context():
        video = Video(title="Series y repeticiones", source_key="videos/series.txt")
        db.session.add(video)
        db.session.flush()
        db.session.add(
            TranscriptChunk(
                video_id=video.id,
                chunk_index=0,
                chunk_text="Tres series de diez repeticiones.",
                embedding=basis_vector(1),
            )
        )
        db.session.commit()


def user_headers(app):
    with app.app_context():
        token = jwt_manager.generate_token({"id": "user-1", "user_role": "user"}, 30)
    return {"Authorization": f"Bearer {token}"}


class _NoNetworkMessages:
    def create(self, *args, **kwargs):
        raise AssertionError("El coach no debe llamar al SDK de Anthropic en los tests")


class _NoNetworkAnthropic:
    """Doble del SDK de Anthropic: no hace red y falla si se le pide una respuesta."""

    instances = 0

    def __init__(self, *args, **kwargs):
        type(self).instances += 1
        self.messages = _NoNetworkMessages()


@pytest.fixture(autouse=True)
def no_anthropic_network():
    """Sustituye `anthropic.Anthropic` en todos los tests de este módulo: ninguna
    ejecución del coach, aunque construya su propio `LLMClient`, llega a la red."""
    original = anthropic.Anthropic
    anthropic.Anthropic = _NoNetworkAnthropic
    yield
    anthropic.Anthropic = original


# SDD: 030 REQ-006 AC-006.4
def test_the_coach_and_portion_counters_are_independent_over_http(
    client, app, redis_fake, coach_model, portion_model, voyage, transcript
):
    """Con el contador del coach en 20 las porciones responden 200; con el de
    porciones en 10 el coach responde 200 usando `coach_llm`."""
    redis_fake.counts[COACH_KEY] = 20

    portion = client.post(
        "/api/meals/portion-estimate",
        json={"question": "5 huevos"},
        headers=user_headers(app),
    )

    assert portion.status_code == 200
    assert portion.get_json()["status"] == "estimated"
    assert redis_fake.counts[PORTION_KEY] == 1

    redis_fake.counts[COACH_KEY] = 0
    redis_fake.counts[PORTION_KEY] = 10

    response = client.post(
        "/api/coach/ask", json={"question": "¿Cuántas series?"}, headers=user_headers(app)
    )

    assert response.status_code == 200
    assert response.get_json()["answer"] == "Haz 3 series de 10."
    assert len(coach_model.calls) == 1
    assert redis_fake.counts[COACH_KEY] == 1
