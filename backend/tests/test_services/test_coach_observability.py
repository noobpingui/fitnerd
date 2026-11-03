"""Observabilidad del coach (feature 004): CoachService traza cada pregunta a
través del puerto `Tracer`. Todo con fakes escritos a mano (un backend de
trazas en memoria y, en los tests de latencia, un cliente de Langfuse de
mentira detras del adaptador real) - nada llama a Langfuse, Voyage, Claude ni
Redis.
"""

import dataclasses
import json
import re
import time
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError
from services.coach_personal_context import ClientCoachContext, CoachMacros, PersonalContext
from services.coach_service import SYSTEM_PROMPT, CoachService, build_coach_user_message
from tests.fakes import FakeClock, FakeLLMClient, FakeLogger, FakeRateLimiter
from tests.fakes_observability import (
    FakeApp,
    FakeLangfuseClient,
    FakeLangfuseClientFactory,
    FakeObservableRetrievalService,
    FakeTraceBackend,
)
from utils.langfuse_backend import LangfuseTraceBackend
from utils.tracing import NullTraceRecorder, Tracer

UNAVAILABLE_MESSAGE = (
    "No se pudo generar una respuesta en este momento. Intenta de nuevo en unos minutos."
)
DONT_KNOW_MESSAGE = "No tengo informacion relacionada con ese tema en especifico."
REFUSED_MESSAGE = "No pude generar una respuesta para esa pregunta."

GOOD_CANDIDATES = [
    {
        "video_title": "Series y repeticiones",
        "chunk_text": "Haz 3 series de 10 repeticiones.",
        "distance": 0.35,
    },
    {
        "video_title": "Descanso",
        "chunk_text": "Descansa 90 segundos entre series.",
        "distance": 0.62,
    },
]


def make_clock():
    return FakeClock(datetime(2026, 10, 7, 12, 0, tzinfo=timezone.utc))


def make_service(
    candidates=None,
    llm=None,
    retrieval=None,
    backend=None,
    tracer=None,
    allowed=True,
):
    retrieval = retrieval or FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES if candidates is None else candidates
    )
    llm = llm or FakeLLMClient(
        answer="Haz 3 series de 10.", input_tokens=850, output_tokens=40, model="claude-sonnet-5"
    )
    backend = backend or FakeTraceBackend(clock=make_clock())
    tracer = tracer or Tracer(backend=backend, logger=FakeLogger())
    service = CoachService(retrieval, llm, FakeRateLimiter(allowed=allowed), tracer)
    return service, backend, retrieval, llm


def step_named(trace, name):
    matches = [s for s in trace.steps if s.name == name]
    assert len(matches) == 1, f"se esperaba un paso {name!r}, hay {[s.name for s in trace.steps]}"
    return matches[0]


def score_named(trace, name):
    matches = [s for s in trace.scores if s.name == name]
    return matches[0] if matches else None


# --- REQ-001 -----------------------------------------------------------------


# SDD: REQ-001 AC-001.1
def test_sends_one_coach_ask_trace_with_input_output_and_user_id():
    """Una pregunta procesada genera exactamente una traza `coach-ask` con la
    entrada, la salida exacta y el ID de usuario como texto."""
    service, backend, _, _ = make_service()

    answer = service.ask("¿Cuántas series hago?", user_id=42)

    assert answer == "Haz 3 series de 10."
    assert len(backend.traces) == 1
    trace = backend.traces[0]
    assert trace.name == "coach-ask"
    assert trace.input == "¿Cuántas series hago?"
    assert trace.output == "Haz 3 series de 10."
    assert trace.user_id == "42"
    assert trace.finished is True


# SDD: REQ-001 AC-001.2
def test_two_questions_produce_two_distinct_traces():
    """Cada pregunta del mismo usuario genera su propia traza."""
    service, backend, _, _ = make_service()

    service.ask("Primera pregunta", user_id=42)
    service.ask("Segunda pregunta", user_id=42)

    assert len(backend.traces) == 2
    assert backend.traces[0] is not backend.traces[1]
    assert [t.input for t in backend.traces] == ["Primera pregunta", "Segunda pregunta"]


# SDD: REQ-001 AC-001.4
def test_rate_limited_question_produces_no_trace():
    """Con el límite de uso alcanzado se lanza RateLimitError y el destino no
    recibe ninguna traza."""
    service, backend, retrieval, _ = make_service(allowed=False)

    with pytest.raises(RateLimitError):
        service.ask("Otra pregunta", user_id=42)

    assert backend.traces == []
    assert retrieval.embed_calls == []


# --- REQ-002 -----------------------------------------------------------------


# SDD: REQ-002 AC-002.1
def test_embedding_step_records_input_model_and_times_without_history():
    """El paso `embedding` lleva la pregunta, el modelo de embedding y horas
    de inicio y fin."""
    service, backend, _, _ = make_service(
        retrieval=FakeObservableRetrievalService(
            candidates=GOOD_CANDIDATES, embedding_model="voyage-3-test"
        )
    )

    service.ask("¿Y el descanso?", user_id=42)

    step = step_named(backend.traces[0], "embedding")
    assert step.input == "¿Y el descanso?"
    assert step.model == "voyage-3-test"
    assert step.start_time is not None
    assert step.end_time is not None


# SDD: REQ-002 AC-002.2
def test_embedding_step_input_joins_last_user_question_and_current_one():
    """Con historial, el texto enviado a Voyage es la última pregunta del
    usuario seguida de la actual."""
    service, backend, _, _ = make_service()
    history = [
        {"role": "user", "content": "¿Cuántas series hago?"},
        {"role": "assistant", "content": "Haz 3 series de 10."},
    ]

    service.ask("¿Y el descanso?", user_id=42, history=history)

    step = step_named(backend.traces[0], "embedding")
    assert step.input == "¿Cuántas series hago? ¿Y el descanso?"


# SDD: REQ-002 AC-002.3
def test_embedding_step_records_tokens_reported_by_the_provider():
    """Si Voyage informa 12 tokens, el paso `embedding` registra 12."""
    service, backend, _, _ = make_service(
        retrieval=FakeObservableRetrievalService(candidates=GOOD_CANDIDATES, embed_tokens=12)
    )

    service.ask("¿Y el descanso?", user_id=42)

    step = step_named(backend.traces[0], "embedding")
    assert step.usage == {"input": 12}


# --- REQ-003 -----------------------------------------------------------------


# SDD: REQ-003 AC-003.1
def test_retrieval_step_records_all_candidates_with_passed_threshold():
    """El paso `retrieval` lista todos los candidatos (pasen o no el umbral) y
    cuenta los que pasaron."""
    candidates = [
        {"video_title": "Video A", "chunk_text": "Texto completo A", "distance": 0.35},
        {"video_title": "Video B", "chunk_text": "Texto completo B", "distance": 0.62},
        {"video_title": "Video C", "chunk_text": "Texto completo C", "distance": 0.81},
    ]
    service, backend, _, _ = make_service(candidates=candidates)

    service.ask("¿Cuántas series hago?", user_id=42)

    step = step_named(backend.traces[0], "retrieval")
    assert step.input == {"limit": 5, "threshold": 0.7}
    assert step.output["passed_count"] == 2
    assert step.output["candidates"] == [
        {
            "video_title": "Video A",
            "chunk_text": "Texto completo A",
            "distance": 0.35,
            "passed_threshold": True,
        },
        {
            "video_title": "Video B",
            "chunk_text": "Texto completo B",
            "distance": 0.62,
            "passed_threshold": True,
        },
        {
            "video_title": "Video C",
            "chunk_text": "Texto completo C",
            "distance": 0.81,
            "passed_threshold": False,
        },
    ]


# SDD: REQ-003 AC-003.2
def test_retrieval_step_marks_every_candidate_as_not_passed_when_all_exceed_the_threshold():
    """Ningún candidato pasa el umbral: `passed_count` es 0 y todos quedan
    con `passed_threshold` falso."""
    candidates = [
        {"video_title": "Video A", "chunk_text": "A", "distance": 0.75},
        {"video_title": "Video B", "chunk_text": "B", "distance": 0.9},
    ]
    service, backend, _, _ = make_service(candidates=candidates)

    service.ask("Pregunta sin respuesta", user_id=42)

    step = step_named(backend.traces[0], "retrieval")
    assert step.output["passed_count"] == 0
    assert [c["passed_threshold"] for c in step.output["candidates"]] == [False, False]


# SDD: REQ-003 AC-003.3
def test_retrieval_step_with_empty_corpus_records_no_candidates():
    """Un corpus vacío produce `candidates` vacía y `passed_count` 0."""
    service, backend, _, _ = make_service(candidates=[])

    service.ask("Pregunta", user_id=42)

    step = step_named(backend.traces[0], "retrieval")
    assert step.output == {"candidates": [], "passed_count": 0}


# --- REQ-004 -----------------------------------------------------------------


# SDD: REQ-004 AC-004.1
def test_generation_step_records_model_tokens_output_and_times():
    """El paso `generation` lleva el modelo, los tokens de entrada y salida,
    el texto generado y horas de inicio y fin."""
    service, backend, _, _ = make_service()

    service.ask("¿Cuántas series hago?", user_id=42)

    step = step_named(backend.traces[0], "generation")
    assert step.model == "claude-sonnet-5"
    assert step.usage == {"input": 850, "output": 40}
    assert step.output == "Haz 3 series de 10."
    assert step.start_time is not None
    assert step.end_time is not None


# SDD: REQ-004 AC-004.2
def test_generation_step_input_is_history_plus_context_message_without_system_prompt():
    """La entrada de `generation` son los mensajes del historial seguidos del
    mensaje con fragmentos y pregunta, sin el system prompt."""
    service, backend, _, llm = make_service()
    history = [
        {"role": "user", "content": "¿Cuántas series hago?"},
        {"role": "assistant", "content": "Haz 3 series de 10."},
    ]

    service.ask("¿Y el descanso?", user_id=42, history=history)

    step = step_named(backend.traces[0], "generation")
    assert len(step.input) == 3
    assert step.input[0] == history[0]
    assert step.input[1] == history[1]
    assert step.input[2]["role"] == "user"
    assert "¿Y el descanso?" in step.input[2]["content"]
    assert "Haz 3 series de 10 repeticiones." in step.input[2]["content"]
    assert SYSTEM_PROMPT not in json.dumps(step.input, default=str)
    assert all(m["role"] != "system" for m in step.input)


# SDD: REQ-004 AC-004.3
def test_no_generation_step_when_no_chunk_passes_the_threshold():
    """Sin fragmentos relevantes no se llama a Claude y no hay paso
    `generation`."""
    candidates = [{"video_title": "A", "chunk_text": "A", "distance": 0.9}]
    service, backend, _, llm = make_service(candidates=candidates)

    service.ask("Pregunta", user_id=42)

    assert [s.name for s in backend.traces[0].steps] == ["embedding", "retrieval"]
    assert llm.calls == []


# SDD: REQ-004 AC-004.4
def test_generation_step_on_refusal_keeps_tokens_and_has_empty_output():
    """Si Claude rechaza la petición, el paso existe, registra los tokens y su
    salida está vacía."""
    llm = FakeLLMClient(answer=None, input_tokens=500, output_tokens=0, model="claude-sonnet-5")
    service, backend, _, _ = make_service(llm=llm)

    answer = service.ask("Pregunta", user_id=42)

    assert answer == REFUSED_MESSAGE
    step = step_named(backend.traces[0], "generation")
    assert step.usage == {"input": 500, "output": 0}
    assert step.output == ""


# --- REQ-005 -----------------------------------------------------------------


# SDD: REQ-005 AC-005.1
def test_outcome_score_is_answered_when_claude_generates_the_answer():
    """`outcome` = `answered` cuando Claude generó la respuesta."""
    service, backend, _, _ = make_service()

    service.ask("Pregunta", user_id=42)

    score = score_named(backend.traces[0], "outcome")
    assert score.value == "answered"
    assert score.data_type == "CATEGORICAL"


# SDD: REQ-005 AC-005.2
def test_outcome_score_is_dont_know_when_no_chunk_passes_the_threshold():
    """`outcome` = `dont_know` cuando el usuario recibe el mensaje fijo."""
    service, backend, _, _ = make_service(candidates=[])

    answer = service.ask("Pregunta", user_id=42)

    assert answer == DONT_KNOW_MESSAGE
    assert score_named(backend.traces[0], "outcome").value == "dont_know"
    assert backend.traces[0].output == DONT_KNOW_MESSAGE


# SDD: REQ-005 AC-005.3
def test_outcome_score_is_refused_when_claude_refuses():
    """`outcome` = `refused` cuando Claude rechaza generar."""
    service, backend, _, _ = make_service(llm=FakeLLMClient(answer=None))

    service.ask("Pregunta", user_id=42)

    assert score_named(backend.traces[0], "outcome").value == "refused"
    assert backend.traces[0].output == REFUSED_MESSAGE


# SDD: REQ-005 AC-005.4
def test_outcome_score_is_error_when_the_embedding_provider_fails():
    """`outcome` = `error` cuando falla un proveedor."""
    retrieval = FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES, embed_error=ConnectionError("voyage caido")
    )
    service, backend, _, _ = make_service(retrieval=retrieval)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta", user_id=42)

    trace = backend.traces[0]
    assert score_named(trace, "outcome").value == "error"
    assert trace.output == ""
    assert trace.finished is True


# --- REQ-006 -----------------------------------------------------------------


# SDD: REQ-006 AC-006.1
def test_best_chunk_distance_is_the_minimum_over_all_candidates():
    """`best_chunk_distance` es la menor distancia entre todos los candidatos."""
    candidates = [
        {"video_title": "A", "chunk_text": "A", "distance": 0.62},
        {"video_title": "B", "chunk_text": "B", "distance": 0.35},
        {"video_title": "C", "chunk_text": "C", "distance": 0.81},
    ]
    service, backend, _, _ = make_service(candidates=candidates)

    service.ask("Pregunta", user_id=42)

    score = score_named(backend.traces[0], "best_chunk_distance")
    assert score.value == 0.35
    assert score.data_type == "NUMERIC"


# SDD: REQ-006 AC-006.2
def test_best_chunk_distance_is_recorded_even_when_no_candidate_passes_the_threshold():
    """Aunque ninguno pase el umbral, la puntuación es la menor distancia."""
    candidates = [
        {"video_title": "A", "chunk_text": "A", "distance": 0.9},
        {"video_title": "B", "chunk_text": "B", "distance": 0.75},
    ]
    service, backend, _, _ = make_service(candidates=candidates)

    service.ask("Pregunta", user_id=42)

    assert score_named(backend.traces[0], "best_chunk_distance").value == 0.75


# SDD: REQ-006 AC-006.3
def test_no_best_chunk_distance_when_search_returns_no_candidates():
    """Sin candidatos no se añade la puntuación."""
    service, backend, _, _ = make_service(candidates=[])

    service.ask("Pregunta", user_id=42)

    assert score_named(backend.traces[0], "best_chunk_distance") is None


# SDD: REQ-006 AC-006.4
def test_no_best_chunk_distance_when_the_embedding_provider_fails():
    """Si el embedding falla, la búsqueda no se ejecuta y no hay puntuación."""
    retrieval = FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES, embed_error=ConnectionError("voyage caido")
    )
    service, backend, _, _ = make_service(retrieval=retrieval)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta", user_id=42)

    assert score_named(backend.traces[0], "best_chunk_distance") is None


# --- REQ-007 -----------------------------------------------------------------


# SDD: REQ-007 AC-007.1
def test_generation_failure_marks_the_step_as_error_and_keeps_the_503():
    """Un fallo de Claude deja los pasos previos correctos, marca `generation`
    como error con tipo y mensaje, y el usuario recibe el mismo 503."""
    llm = FakeLLMClient(raise_error=RuntimeError("overloaded"), model="claude-sonnet-5")
    service, backend, _, _ = make_service(llm=llm)

    with pytest.raises(ServiceUnavailableError) as excinfo:
        service.ask("Pregunta", user_id=42)

    assert str(excinfo.value) == UNAVAILABLE_MESSAGE
    trace = backend.traces[0]
    assert [s.name for s in trace.steps] == ["embedding", "retrieval", "generation"]
    assert trace.steps[0].error is None
    assert trace.steps[1].error is None
    assert "RuntimeError" in trace.steps[2].error
    assert "overloaded" in trace.steps[2].error
    assert trace.finished is True


# SDD: REQ-007 AC-007.2
def test_embedding_failure_leaves_only_the_failed_embedding_step():
    """Si falla Voyage solo existe el paso `embedding`, marcado como error."""
    retrieval = FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES, embed_error=ConnectionError("voyage caido")
    )
    service, backend, _, llm = make_service(retrieval=retrieval)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta", user_id=42)

    trace = backend.traces[0]
    assert [s.name for s in trace.steps] == ["embedding"]
    assert "ConnectionError" in trace.steps[0].error
    assert llm.calls == []


# SDD: REQ-007 AC-007.2
def test_search_failure_marks_the_retrieval_step_and_skips_generation():
    """Si falla la busqueda de fragmentos, `retrieval` queda como error y no
    hay `generation`."""
    retrieval = FakeObservableRetrievalService(
        candidates=GOOD_CANDIDATES, search_error=RuntimeError("db caida")
    )
    service, backend, _, _ = make_service(retrieval=retrieval)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta", user_id=42)

    trace = backend.traces[0]
    assert [s.name for s in trace.steps] == ["embedding", "retrieval"]
    assert "db caida" in trace.steps[1].error


# SDD: REQ-007 AC-007.3
def test_step_error_message_is_trimmed_to_200_characters_without_a_stack_trace():
    """Un mensaje de 500 caracteres se recorta a 200 como máximo y no incluye
    traza de pila."""
    llm = FakeLLMClient(raise_error=RuntimeError("x" * 500))
    service, backend, _, _ = make_service(llm=llm)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta", user_id=42)

    error = step_named(backend.traces[0], "generation").error
    assert len(error) <= 200
    assert "Traceback" not in error


# --- REQ-008 -----------------------------------------------------------------


# SDD: REQ-008 AC-008.1
def test_inactive_tracer_returns_todays_answer_and_sends_nothing():
    """Con el tracer inactivo la respuesta es la de hoy y no se envía nada."""
    unused_backend = FakeTraceBackend()
    inactive = Tracer(logger=FakeLogger())
    service, _, _, _ = make_service(tracer=inactive)

    answer = service.ask("¿Cuántas series hago?", user_id=42)

    assert answer == "Haz 3 series de 10."
    assert inactive.enabled is False
    assert unused_backend.traces == []
    assert isinstance(inactive.start_trace("coach-ask", "42", "pregunta"), NullTraceRecorder)


# SDD: REQ-008 AC-008.2
def test_answer_is_unchanged_when_the_destination_fails_on_every_send():
    """Un destino que lanza error en cada envío no cambia la respuesta 200."""
    backend = FakeTraceBackend(raise_error=RuntimeError("secreto-sk-lf-123"))
    service, _, _, _ = make_service(backend=backend)

    assert service.ask("¿Cuántas series hago?", user_id=42) == "Haz 3 series de 10."


# SDD: REQ-008 AC-008.3
def test_dont_know_answer_is_unchanged_when_the_destination_fails():
    """El mensaje fijo de "sin información" tampoco cambia."""
    backend = FakeTraceBackend(raise_error=RuntimeError("secreto-sk-lf-123"))
    service, _, _, _ = make_service(candidates=[], backend=backend)

    assert service.ask("Pregunta", user_id=42) == DONT_KNOW_MESSAGE


# SDD: REQ-008 AC-008.4
def test_provider_failure_still_gives_the_same_503_when_the_destination_fails():
    """Un fallo del destino no convierte el 503 en otro error."""
    backend = FakeTraceBackend(raise_error=RuntimeError("secreto-sk-lf-123"))
    llm = FakeLLMClient(raise_error=RuntimeError("overloaded"))
    service, _, _, _ = make_service(backend=backend, llm=llm)

    with pytest.raises(ServiceUnavailableError) as excinfo:
        service.ask("Pregunta", user_id=42)

    assert str(excinfo.value) == UNAVAILABLE_MESSAGE


# SDD: REQ-008 AC-008.5
def test_destination_failure_is_logged_as_a_warning_without_credentials_or_exception_message():
    """El fallo del destino queda como aviso en el log, sin credenciales ni el
    mensaje de la excepción."""
    logger = FakeLogger()
    backend = FakeTraceBackend(raise_error=RuntimeError("secreto-sk-lf-123"))
    tracer = Tracer(backend=backend, logger=logger)
    service, _, _, _ = make_service(tracer=tracer)

    service.ask("Pregunta", user_id=42)

    assert any("traza del coach" in record for record in logger.records)
    assert not any("secreto-sk-lf-123" in record for record in logger.records)


# --- REQ-009 -----------------------------------------------------------------


# SDD: REQ-009 AC-009.1
@pytest.mark.parametrize(
    "config",
    [
        {"LANGFUSE_PUBLIC_KEY": "pk-lf-1", "LANGFUSE_SECRET_KEY": None, "TESTING": False},
        {"LANGFUSE_PUBLIC_KEY": None, "LANGFUSE_SECRET_KEY": "sk-lf-1", "TESTING": False},
        {"LANGFUSE_PUBLIC_KEY": None, "LANGFUSE_SECRET_KEY": None, "TESTING": False},
    ],
)
def test_tracer_without_both_keys_stays_inactive_silent_and_never_builds_the_client(config):
    """Sin una o las dos claves no se envia nada, no se registra nada por
    pregunta y el cliente del SDK no se crea."""
    fake = FakeLangfuseClient()
    factory = FakeLangfuseClientFactory(fake)
    app = FakeApp(
        {
            **config,
            "LANGFUSE_BASE_URL": "https://us.cloud.langfuse.com",
            "OBSERVABILITY_ENVIRONMENT": "development",
        }
    )
    tracer = Tracer(client_factory=factory, propagate_attributes=fake.propagate_attributes)
    tracer.init_app(app)
    service, _, _, _ = make_service(tracer=tracer)

    for _ in range(3):
        assert service.ask("Pregunta", user_id=42) == "Haz 3 series de 10."

    assert tracer.enabled is False
    assert app.logger.records == []
    assert factory.calls == []
    assert fake.calls == []


# --- NFR-001 -----------------------------------------------------------------


EMAIL = "ana@example.com"
FULL_NAME = "Ana Pérez"
JWT = "eyJhbGciOiJSUzI1NiJ9.eyJpZCI6IjQyIn0.firma-de-prueba"


# SDD: NFR-001 AC-N001.1
def test_trace_contains_only_the_internal_user_id_and_no_personal_data():
    """Ningún campo de la traza contiene email, nombre ni token; el usuario es
    solo su ID interno."""
    service, backend, _, _ = make_service()

    service.ask("¿Cuántas series hago?", user_id=42)

    trace = backend.traces[0]
    dumped = json.dumps(dataclasses.asdict(trace), default=str, ensure_ascii=False)
    assert trace.user_id == "42"
    assert EMAIL not in dumped
    assert FULL_NAME not in dumped
    assert JWT not in dumped


# SDD: NFR-001 AC-N001.2
@pytest.mark.parametrize("fails", [False, True])
def test_trace_never_contains_provider_or_langfuse_credentials(fails):
    """Ni en una respuesta correcta ni con un fallo de proveedor aparecen las
    claves de Voyage, Anthropic o Langfuse en lo que recibe el cliente del SDK
    (adaptador real con cliente falso) ni en un backend en memoria."""
    keys = ["pk-lf-public-xyz", "sk-lf-secret-xyz", "voyage-key-123", "sk-ant-key-456"]
    llm = FakeLLMClient(raise_error=RuntimeError("overloaded")) if fails else None

    memory_service, memory_backend, _, _ = make_service(llm=llm)
    fake = FakeLangfuseClient()
    adapter = LangfuseTraceBackend(
        keys[0],
        keys[1],
        "https://us.cloud.langfuse.com",
        "production",
        client_factory=FakeLangfuseClientFactory(fake),
        propagate_attributes=fake.propagate_attributes,
    )
    sdk_service, _, _, _ = make_service(
        llm=llm, tracer=Tracer(backend=adapter, logger=FakeLogger())
    )

    for service in (memory_service, sdk_service):
        try:
            service.ask("¿Cuántas series hago?", user_id=42)
        except ServiceUnavailableError:
            assert fails

    dumped = (
        json.dumps(dataclasses.asdict(memory_backend.traces[0]), default=str)
        + fake.serialized_calls()
    )
    for key in keys:
        assert key not in dumped


# --- NFR-002 -----------------------------------------------------------------


# --- Spec 034: el nombre nunca llega a la traza ------------------------------


class FakePersonalContextReader:
    """Doble del lector del contexto personal: devuelve un `PersonalContext` fijo."""

    def __init__(self, first_name="Carlos"):
        profile = SimpleNamespace(
            gender="male",
            height_unit="cm",
            height_cm=180,
            height_ft=None,
            height_in=None,
            weight_unit="kg",
            activity_level="high",
            goal="lose",
        )
        client = ClientCoachContext(
            today=date(2026, 10, 12),
            macros=CoachMacros(2750, 2200, 160, 245, 61),
            indicators={
                "weight": "79,4 kg",
                "weight_change_30d": "-0,6 kg",
                "body_fat": None,
                "body_fat_change_30d": None,
                "rate": "-0,2 kg/sem",
                "fat_mass": None,
                "lean_mass": None,
                "bmi": "24,5",
                "ffmi": None,
                "streak_weeks": 4,
                "records_last_30_days": 4,
                "total_records": 4,
                "last_record_date": "2026-10-11",
            },
            pace_status="too_slow",
        )
        self.context = PersonalContext(
            first_name=first_name, profile=profile, age=30, client=client
        )
        self.calls = []
        self.name_calls = []

    def read(self, user_id, client_data):
        self.calls.append((user_id, client_data))
        return self.context

    def read_first_name(self, user_id):
        """Solo para anonimizar la traza; no toca `calls` (solo de `read`)."""
        self.name_calls.append(user_id)
        return self.context.first_name


def make_personal_service(answer, first_name="Carlos"):
    backend = FakeTraceBackend(clock=make_clock())
    llm = FakeLLMClient(answer=answer, input_tokens=850, output_tokens=40, model="claude-sonnet-5")
    reader = FakePersonalContextReader(first_name)
    service = CoachService(
        FakeObservableRetrievalService(candidates=GOOD_CANDIDATES),
        llm,
        FakeRateLimiter(allowed=True),
        Tracer(backend=backend, logger=FakeLogger()),
        personal_context_reader=reader,
    )
    service.test_reader = reader
    return service, backend, llm


def dump_trace(trace):
    return json.dumps(dataclasses.asdict(trace), default=str, ensure_ascii=False)


# SDD: 034 NFR-003 AC-N003.1
def test_trace_never_contains_the_name_but_the_user_still_gets_it_in_the_answer():
    """El usuario recibe la respuesta con «Carlos»; ningún texto de la traza
    (entrada, pasos y salida) lo contiene y en su lugar va «[nombre]»."""
    answer_text = "Hola, Carlos: con tu objetivo de 2200 kcal, reparte la proteína."
    service, backend, llm = make_personal_service(answer_text)

    result = service.ask_with_feedback(
        "Soy Carlos, ¿cuánta proteína necesito, Carlos?", user_id=42
    )

    assert result.answer == answer_text
    assert "Carlos" in llm.calls[0][1][-1]["content"]
    trace = backend.traces[0]
    dumped = dump_trace(trace)
    assert "Carlos" not in dumped
    assert "carlos" not in dumped.lower()
    assert "[nombre]" in dumped
    assert "2200 kcal" in dumped
    assert trace.input == "Soy [nombre], ¿cuánta proteína necesito, [nombre]?"
    assert trace.output == "Hola, [nombre]: con tu objetivo de 2200 kcal, reparte la proteína."
    assert "Nombre: [nombre]" in dumped
    for step in trace.steps:
        assert "Carlos" not in json.dumps(dataclasses.asdict(step), default=str, ensure_ascii=False)


# SDD: 034 NFR-003 AC-N003.1
def test_the_model_and_the_embedding_still_receive_the_real_name_and_question():
    """Solo la traza se anonimiza: lo enviado a Voyage y al modelo no cambia."""
    service, backend, llm = make_personal_service("Hola, Carlos.")

    service.ask("Soy Carlos, ¿cuánta proteína necesito?", user_id=42)

    assert "Soy Carlos, ¿cuánta proteína necesito?" in llm.calls[0][1][-1]["content"]
    assert "Nombre: Carlos" in llm.calls[0][1][-1]["content"]
    embedding = step_named(backend.traces[0], "embedding")
    assert "Carlos" not in str(embedding.input)


# SDD: 034 NFR-003 AC-N003.2
def test_trace_includes_the_profile_the_indicators_and_the_internal_user_id():
    """La traza lleva el perfil y los indicadores enviados al modelo y el
    identificador interno del usuario."""
    service, backend, _ = make_personal_service("Haz 3 series de 10.")

    service.ask("¿Cuántas series hago?", user_id=42)

    trace = backend.traces[0]
    dumped = dump_trace(trace)
    assert trace.user_id == "42"
    assert "Perder peso" in dumped
    assert "79,4 kg" in dumped
    assert "2200 kcal" in dumped


# SDD: 034 NFR-003 AC-N003.3
def test_trace_does_not_touch_longer_words_that_contain_the_name():
    """Con el nombre «Ana», «Anabel» no se modifica en la traza."""
    service, backend, _ = make_personal_service("Hola Ana, dile a Anabel que descanse.", "Ana")

    result = service.ask_with_feedback("¿Cuántas series hago?", user_id=42)

    assert result.answer == "Hola Ana, dile a Anabel que descanse."
    trace = backend.traces[0]
    assert trace.output == "Hola [nombre], dile a Anabel que descanse."
    assert "Anabel" in dump_trace(trace)


# SDD: 034 NFR-003 AC-N003.1
# SDD: 034 REQ-010 AC-010.4
def test_with_the_context_off_the_history_name_is_still_kept_out_of_the_trace():
    """Interruptor desactivado a mitad de conversación: el historial trae
    «Carlos». El usuario recibe la respuesta tal cual, el modelo no recibe nada
    nuevo de la cuenta y la traza no contiene «Carlos» (sí «[nombre]»)."""
    service, backend, llm = make_personal_service("Carlos, sigue con tu plan.")
    reader = service.test_reader
    history = [
        {"role": "user", "content": "¿Cuánta proteína necesito?"},
        {"role": "assistant", "content": "Hola, Carlos: reparte la proteína en el día."},
    ]

    result = service.ask_with_feedback(
        "¿Y los carbohidratos?", user_id=42, history=history, use_personal_context=False
    )

    assert result.answer == "Carlos, sigue con tu plan."
    sent = llm.calls[0][1]
    assert sent[:2] == history
    assert len(sent) == 3
    content = sent[2]["content"]
    prefix = "Fragmentos de contexto:\n"
    suffix = "\n\nPregunta: ¿Y los carbohidratos?"
    assert content.startswith(prefix) and content.endswith(suffix)
    corpus = content[len(prefix) : -len(suffix)]
    assert content == build_coach_user_message(corpus, "¿Y los carbohidratos?")
    assert "<datos_del_usuario>" not in content
    dumped = dump_trace(backend.traces[0])
    assert "Carlos" not in dumped
    assert "carlos" not in dumped.lower()
    assert "[nombre]" in dumped
    assert reader.calls == []
    assert reader.name_calls == [42]


# SDD: 034 NFR-003 AC-N003.1
def test_a_user_without_a_name_leaves_the_trace_unchanged():
    """Sin nombre no se sustituye nada en la traza."""
    service, backend, _ = make_personal_service("Hola Carlos.", first_name=None)

    service.ask("Soy Carlos", user_id=42)

    trace = backend.traces[0]
    assert trace.input == "Soy Carlos"
    assert trace.output == "Hola Carlos."


def make_langfuse_tracer(fake):
    backend = LangfuseTraceBackend(
        "pk-lf-1",
        "sk-lf-1",
        "https://us.cloud.langfuse.com",
        "production",
        client_factory=FakeLangfuseClientFactory(fake),
        propagate_attributes=fake.propagate_attributes,
    )
    return Tracer(backend=backend, logger=FakeLogger())


# SDD: NFR-002 AC-N002.1
def test_a_slow_langfuse_export_does_not_delay_the_answer_and_never_flushes():
    """Con un cliente cuya exportación tarda 3 s la respuesta llega en menos
    de 0,5 s y la petición nunca llama a flush()."""
    fake = FakeLangfuseClient(flush_delay_seconds=3)
    service, _, _, _ = make_service(tracer=make_langfuse_tracer(fake))

    started = time.perf_counter()
    answer = service.ask("¿Cuántas series hago?", user_id=42)
    elapsed = time.perf_counter() - started

    assert answer == "Haz 3 series de 10."
    assert elapsed < 0.5
    assert fake.flush_calls == 0
    assert fake.shutdown_calls == 0
    assert len(fake.observations) >= 1


# SDD: NFR-002 AC-N002.2
def test_a_destination_that_fails_instantly_does_not_delay_the_answer():
    """Un destino (backend o cliente del SDK) que falla al instante no alarga
    la respuesta."""
    failing_backend = FakeTraceBackend(raise_error=RuntimeError("caido"))
    failing_client = FakeLangfuseClient(raise_error=RuntimeError("caido"))

    for tracer in (
        Tracer(backend=failing_backend, logger=FakeLogger()),
        make_langfuse_tracer(failing_client),
    ):
        service, _, _, _ = make_service(tracer=tracer)
        started = time.perf_counter()
        answer = service.ask("Pregunta", user_id=42)
        elapsed = time.perf_counter() - started

        assert answer == "Haz 3 series de 10."
        assert elapsed < 0.5


# --- Revisión 2: nombres compuestos (F4) y nombres anteriores (F10) -----------

QUESTION = "¿Cuánta proteína necesito?"
SENTINEL_NAMES = ["Carlitos", "A", "B", "C", "D", "E"]


def casefolded_dump(backend):
    return dump_trace(backend.traces[0]).casefold()


# SDD: 034 NFR-003 AC-N003.4
def test_compound_name_is_anonymized_part_by_part_end_to_end():
    """«María José»: el usuario recibe el texto sin cambios y la traza no contiene
    «maría» ni «josé»; el nombre completo es un único «[nombre]»."""
    answer_text = "Hola, María José. Como dice José en el vídeo… Gracias, maría"
    service, backend, llm = make_personal_service(answer_text, "María José")

    result = service.ask_with_feedback(QUESTION, user_id=42)

    assert result.answer == answer_text
    assert "Nombre: María José" in llm.calls[0][1][-1]["content"]
    dumped = casefolded_dump(backend)
    assert "maría" not in dumped
    assert "josé" not in dumped
    assert backend.traces[0].output.startswith("Hola, [nombre]. Como dice [nombre]")
    assert "[nombre] [nombre]" not in dumped


# SDD: 034 NFR-003 AC-N003.5
def test_hyphenated_name_part_is_anonymized_in_the_trace():
    """«José-Luis» con la respuesta «Hola, Luis»: la traza dice «Hola, [nombre]»."""
    service, backend, _ = make_personal_service("Hola, Luis", "José-Luis")

    result = service.ask_with_feedback(QUESTION, user_id=42)

    assert result.answer == "Hola, Luis"
    assert backend.traces[0].output == "Hola, [nombre]"
    assert "luis" not in casefolded_dump(backend)


# SDD: 034 REQ-010 AC-010.8
# SDD: 034 NFR-003 AC-N003.4
def test_with_the_context_off_a_compound_name_in_the_history_is_kept_out_of_the_trace():
    """Desactivado y con «Carlos Alberto»: el modelo recibe el historial idéntico
    y el mensaje sin bloque; la traza no contiene «Carlos» ni «Alberto»."""
    service, backend, llm = make_personal_service("Sigue así, Alberto.", "Carlos Alberto")
    reader = service.test_reader
    history = [
        {"role": "user", "content": QUESTION},
        {"role": "assistant", "content": "Hola, Carlos: con tu objetivo de 2200 kcal…"},
    ]

    result = service.ask_with_feedback(
        "¿Y la cena?", user_id=42, history=history, use_personal_context=False
    )

    assert result.answer == "Sigue así, Alberto."
    sent = llm.calls[0][1]
    assert sent[:2] == history
    content = sent[2]["content"]
    prefix, suffix = "Fragmentos de contexto:\n", "\n\nPregunta: ¿Y la cena?"
    corpus = content[len(prefix) : -len(suffix)]
    assert content == build_coach_user_message(corpus, "¿Y la cena?")
    assert "Alberto" not in content
    assert reader.calls == []
    dumped = casefolded_dump(backend)
    assert "carlos" not in dumped
    assert "alberto" not in dumped
    assert "[nombre]" in dumped
    assert "2200 kcal" in dumped


# SDD: 034 REQ-013 AC-013.3
# SDD: 034 REQ-013 AC-013.4
@pytest.mark.parametrize("context_on", [True, False])
def test_a_previous_name_is_kept_out_of_the_trace_but_reaches_the_model(context_on):
    """«Carlitos» (nombre anterior) y «Carlos» (actual) no salen en la traza, con
    el contexto activado o desactivado; el modelo recibe el historial tal cual."""
    service, backend, llm = make_personal_service("Carlos, sigue así", "Carlos")
    reader = service.test_reader
    history = [
        {"role": "user", "content": QUESTION},
        {"role": "assistant", "content": "Hola, Carlitos: reparte la proteína."},
    ]

    service.ask_with_feedback(
        "¿Y la cena?",
        user_id=42,
        history=history,
        use_personal_context=context_on,
        previous_names=["Carlitos"],
    )

    assert llm.calls[0][1][:2] == history
    assert "Carlitos" in llm.calls[0][1][1]["content"]
    dumped = casefolded_dump(backend)
    assert "carlitos" not in dumped
    assert "carlos" not in dumped
    assert "[nombre]" in dumped
    if not context_on:
        assert reader.calls == []


# SDD: 034 REQ-013 AC-013.6
@pytest.mark.parametrize(
    "invalid",
    [
        SENTINEL_NAMES,
        ["Carlitos", ""],
        ["Carlitos", "x" * 101],
        ["Carlitos", 5],
    ],
    ids=["seis", "vacio", "101-caracteres", "no-texto"],
)
def test_an_invalid_previous_names_list_is_ignored_entirely(invalid):
    """Lista no válida: responde igual, la traza conserva «Carlitos» y anonimiza
    «Carlos» (el nombre actual)."""
    service, backend, _ = make_personal_service("Hola, Carlos", "Carlos")
    history = [
        {"role": "user", "content": QUESTION},
        {"role": "assistant", "content": "Hola, Carlitos"},
    ]

    result = service.ask_with_feedback(
        "¿Y la cena?", user_id=42, history=history, previous_names=invalid
    )

    assert result.answer == "Hola, Carlos"
    dumped = dump_trace(backend.traces[0])
    assert "Carlitos" in dumped
    assert "[nombre]" in dumped
    assert not re.search(r"(?<!\w)carlos(?!\w)", dumped, flags=re.IGNORECASE)


# SDD: 034 REQ-013 AC-013.5
def test_a_previous_name_in_the_question_is_anonymized_but_never_replaces_the_name():
    """«Soy Ana» con `previous_names=["Ana"]`: el bloque dice «Nombre: Carlos» y la
    entrada de la traza es «Soy [nombre]»."""
    service, backend, llm = make_personal_service("Hola", "Carlos")

    service.ask("Soy Ana", user_id=42, previous_names=["Ana"])

    content = llm.calls[0][1][-1]["content"]
    assert "Nombre: Carlos" in content
    assert "Nombre: Ana" not in content
    assert backend.traces[0].input == "Soy [nombre]"


# SDD: 034 REQ-013 AC-013.7
# SDD: 034 NFR-003 AC-N003.4
@pytest.mark.parametrize("particle", ["de", "De", "LA"])
@pytest.mark.parametrize("context_on", [True, False])
def test_a_previous_name_that_is_only_a_particle_is_not_anonymized_in_the_trace(
    context_on, particle
):
    """Una partícula como nombre anterior se conserva como palabra en la traza;
    «Carlitos» y «Carlos» siguen anonimizados y el modelo recibe el historial tal cual."""
    service, backend, llm = make_personal_service(
        "Carlos, la proteína de la dieta ayuda", "Carlos"
    )
    reader = service.test_reader
    history = [
        {"role": "user", "content": QUESTION},
        {"role": "assistant", "content": "Hola, Carlitos: la proteína de la dieta…"},
    ]

    service.ask_with_feedback(
        "¿Y la cena?",
        user_id=42,
        history=history,
        use_personal_context=context_on,
        previous_names=[particle, "Carlitos"],
    )

    assert llm.calls[0][1][:2] == history
    dumped = casefolded_dump(backend)
    word = particle.casefold()
    assert re.search(rf"(?<!\w){word}(?!\w)", dumped)
    assert "la proteína de la dieta" in dumped
    assert not re.search(r"(?<!\w)carlitos(?!\w)", dumped)
    assert not re.search(r"(?<!\w)carlos(?!\w)", dumped)
    assert "[nombre]" in dumped
    if not context_on:
        assert reader.calls == []
