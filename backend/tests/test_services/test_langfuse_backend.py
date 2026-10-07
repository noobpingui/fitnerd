"""Adaptador del SDK de Langfuse (utils/langfuse_backend.py), probado con un
cliente del SDK de mentira inyectado por `client_factory` y
`propagate_attributes`. Ningun test importa el paquete `langfuse` ni usa la red.
"""

import re
import sys
import threading
from pathlib import Path

import pytest

from tests.fakes import FakeLogger
from tests.fakes_observability import FakeLangfuseClient, FakeLangfuseClientFactory
from utils.langfuse_backend import LangfuseTraceBackend
from utils.tracing import Tracer

LANGFUSE_PK = "pk-lf-public-xyz"
LANGFUSE_SK = "sk-lf-secret-xyz"
VOYAGE_KEY = "voyage-key-123"
ANTHROPIC_KEY = "sk-ant-key-456"
ATTRS = {"user_id": "42", "trace_name": "coach-ask"}


def make_backend(fake=None, factory=None):
    fake = fake or FakeLangfuseClient()
    factory = factory or FakeLangfuseClientFactory(fake)
    backend = LangfuseTraceBackend(
        LANGFUSE_PK,
        LANGFUSE_SK,
        "https://us.cloud.langfuse.com",
        "production",
        client_factory=factory,
        propagate_attributes=fake.propagate_attributes,
    )
    return backend, fake, factory


def methods(obs):
    return [name for name, _ in obs.calls]


# SDD: REQ-001 AC-001.1
def test_root_observation_is_created_with_user_and_trace_name_active():
    """La raiz `coach-ask` se crea con `start_observation` y, en ese momento,
    `user_id` y `trace_name` estan activos en el contexto."""
    backend, fake, _ = make_backend()

    backend.start_trace("coach-ask", "42", "¿Cuántas series hago?")

    assert len(fake.observations) == 1
    root = fake.observations[0]
    assert root.kwargs == {"name": "coach-ask", "as_type": "span", "input": "¿Cuántas series hago?"}
    assert root.attributes_at_creation == ATTRS


# SDD: REQ-001 AC-001.1
def test_finish_updates_the_root_output_and_ends_it_without_deprecated_trace_calls():
    """Al cerrar, `root.update(output=...)` y `root.end()`; nunca `update_trace`
    ni `set_trace_io` (el fake de la observacion ni los tiene)."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")

    trace.finish("Haz 3 series de 10.")

    root = fake.observations[0]
    assert root.calls[0] == ("update", {"output": "Haz 3 series de 10."})
    assert methods(root)[-1] == "end"
    assert not hasattr(root, "update_trace")
    assert not hasattr(root, "set_trace_io")


# SDD: REQ-002 AC-002.1
def test_embedding_step_is_a_generation_child_of_the_root_with_input_and_model():
    """El paso `embedding` se crea desde la raiz como `generation`, con
    entrada y modelo."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")

    trace.start_step("embedding", "generation", "¿Y el descanso?", "voyage-3-test")

    root, step = fake.observations
    assert step.parent is root
    assert step.kwargs == {
        "name": "embedding",
        "as_type": "generation",
        "input": "¿Y el descanso?",
        "model": "voyage-3-test",
    }
    assert step.attributes_at_creation == ATTRS


# SDD: REQ-003 AC-003.1
def test_span_step_without_model_does_not_pass_the_model_argument():
    """Un paso `span` sin modelo no envia `model` al SDK."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")

    trace.start_step("retrieval", "span", {"limit": 5, "threshold": 0.7})

    step = fake.observations[1]
    assert step.kwargs == {"name": "retrieval", "as_type": "span", "input": {"limit": 5, "threshold": 0.7}}


# SDD: REQ-004 AC-004.1
def test_step_end_updates_output_and_usage_details_then_ends():
    """Al cerrar un paso se llama `update(output, usage_details)` y despues
    `end()`."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")
    step = trace.start_step("generation", "generation", [{"role": "user", "content": "hola"}], "claude-sonnet-5")

    step.end("Haz 3 series de 10.", {"input": 850, "output": 40})

    obs = fake.observations[1]
    assert obs.calls[0] == ("update", {"output": "Haz 3 series de 10.", "usage_details": {"input": 850, "output": 40}})
    assert methods(obs)[-1] == "end"


# SDD: REQ-002 AC-002.1
def test_step_end_only_passes_the_fields_that_are_not_none():
    """Sin salida o sin tokens, esos campos no se envian al SDK."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")
    step = trace.start_step("embedding", "generation", "pregunta", "voyage-test")

    step.end(None, {"input": 12})

    obs = fake.observations[1]
    assert obs.calls[0] == ("update", {"usage_details": {"input": 12}})

    other = trace.start_step("retrieval", "span", {"limit": 5})
    other.end({"candidates": [], "passed_count": 0}, None)

    assert fake.observations[2].calls[0] == ("update", {"output": {"candidates": [], "passed_count": 0}})


# SDD: REQ-007 AC-007.1
def test_failed_step_is_updated_with_error_level_and_status_message_then_ended():
    """Un paso fallido se marca con `level="ERROR"` y `status_message`."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")
    step = trace.start_step("generation", "generation", [], "claude-sonnet-5")

    step.fail("RuntimeError: overloaded")

    obs = fake.observations[1]
    assert obs.calls[0] == ("update", {"level": "ERROR", "status_message": "RuntimeError: overloaded"})
    assert methods(obs)[-1] == "end"


# SDD: REQ-005 AC-005.1
def test_categorical_score_goes_through_score_trace_on_the_root():
    """`outcome` se envia con `root.score_trace(name, value, data_type)`."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")

    trace.add_score("outcome", "answered", "CATEGORICAL")

    root = fake.observations[0]
    assert root.calls == [("score_trace", {"name": "outcome", "value": "answered", "data_type": "CATEGORICAL"})]


# SDD: REQ-006 AC-006.1
def test_numeric_score_goes_through_score_trace_on_the_root():
    """`best_chunk_distance` se envia como puntuacion numerica."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")

    trace.add_score("best_chunk_distance", 0.35, "NUMERIC")

    root = fake.observations[0]
    assert root.calls == [("score_trace", {"name": "best_chunk_distance", "value": 0.35, "data_type": "NUMERIC"})]


# SDD: REQ-008 AC-008.2
def test_attribute_context_is_closed_after_every_adapter_call():
    """`propagate_attributes` se abre y se cierra dentro de cada creacion, y
    `update`, `score_trace`, `end` y `finish` corren sin contexto activo."""
    backend, fake, _ = make_backend()

    assert fake.active_attributes == {}
    trace = backend.start_trace("coach-ask", "42", "pregunta")
    assert fake.active_attributes == {}
    step = trace.start_step("embedding", "generation", "pregunta", "voyage-test")
    assert fake.active_attributes == {}
    step.end(None, {"input": 1})
    trace.add_score("outcome", "answered", "CATEGORICAL")
    trace.finish("respuesta")

    assert fake.active_attributes == {}
    enters = [c for c in fake.calls if c[1] == "propagate_attributes.enter"]
    exits = [c for c in fake.calls if c[1] == "propagate_attributes.exit"]
    assert len(enters) == len(exits) == 2
    for obs in fake.observations:
        # Solo las llamadas update/score_trace/end; start_observation corre dentro del with.
        later = [a for (name, _), a in zip(obs.calls, obs.active_at_calls) if name != "start_observation"]
        assert all(a == {} for a in later)


# SDD: REQ-008 AC-008.2
def test_attribute_context_is_restored_when_creating_the_root_fails():
    """Si `start_observation` lanza dentro del `with`, el contexto se restaura
    y la excepcion sube a quien llama."""
    backend, fake, _ = make_backend(FakeLangfuseClient(raise_error=RuntimeError("sdk roto")))

    with pytest.raises(RuntimeError):
        backend.start_trace("coach-ask", "42", "pregunta")

    assert fake.active_attributes == {}


# SDD: REQ-008 AC-008.2
def test_attribute_context_is_restored_when_creating_a_step_fails():
    """Lo mismo al crear un paso hijo."""
    backend, fake, _ = make_backend()
    trace = backend.start_trace("coach-ask", "42", "pregunta")
    fake.raise_error = RuntimeError("sdk roto")

    with pytest.raises(RuntimeError):
        trace.start_step("embedding", "generation", "pregunta", "voyage-test")

    assert fake.active_attributes == {}


# SDD: REQ-008 AC-008.2
def test_client_is_created_lazily_and_only_once_across_traces():
    """El cliente del SDK se crea en el primer `start_trace` y se reutiliza."""
    backend, fake, factory = make_backend()

    assert factory.calls == []
    backend.start_trace("coach-ask", "42", "primera")
    backend.start_trace("coach-ask", "43", "segunda")

    assert len(factory.calls) == 1
    assert factory.calls[0] == {
        "public_key": LANGFUSE_PK,
        "secret_key": LANGFUSE_SK,
        "base_url": "https://us.cloud.langfuse.com",
        "environment": "production",
    }


# SDD: REQ-008 AC-008.2
def test_client_creation_is_safe_with_concurrent_threads():
    """Varios hilos que abren su primera traza a la vez crean un solo cliente."""
    fake = FakeLangfuseClient()
    factory = FakeLangfuseClientFactory(fake, delay_seconds=0.05)
    backend, _, _ = make_backend(fake, factory)
    barrier = threading.Barrier(8)
    errors = []

    def worker(index):
        try:
            barrier.wait()
            backend.start_trace("coach-ask", str(index), "pregunta")
        except Exception as exc:  # pragma: no cover - solo si falla el test
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    assert len(factory.calls) == 1
    assert len(fake.observations) == 8


# SDD: NFR-001 AC-N001.2
def test_no_recorded_call_contains_any_credential_and_baggage_is_never_enabled():
    """Ninguna llamada al SDK contiene las claves de Langfuse, Voyage o
    Anthropic (las de Langfuse solo van a la factoria) y `propagate_attributes`
    nunca recibe `as_baggage=True`."""
    backend, fake, factory = make_backend()
    trace = backend.start_trace("coach-ask", "42", "¿Cuántas series hago?")
    step = trace.start_step("generation", "generation", [{"role": "user", "content": "hola"}], "claude-sonnet-5")
    step.fail("RuntimeError: overloaded")
    trace.add_score("outcome", "error", "CATEGORICAL")
    trace.finish("")

    dumped = fake.serialized_calls()
    for key in (LANGFUSE_PK, LANGFUSE_SK, VOYAGE_KEY, ANTHROPIC_KEY):
        assert key not in dumped
    assert factory.calls[0]["public_key"] == LANGFUSE_PK
    assert factory.calls[0]["secret_key"] == LANGFUSE_SK
    for _, name, kwargs in fake.calls:
        if name == "propagate_attributes.enter":
            assert kwargs.get("as_baggage") is not True
            assert kwargs == ATTRS


# SDD: REQ-008 AC-008.5
def test_sdk_errors_behind_a_tracer_become_the_warning_and_never_propagate():
    """Con un cliente del SDK que lanza en cada llamada, detras de un `Tracer`
    la excepcion se convierte en el aviso y la traza queda nula."""
    logger = FakeLogger()
    backend, _, _ = make_backend(FakeLangfuseClient(raise_error=RuntimeError("secreto-sk-lf-123")))
    tracer = Tracer(backend=backend, logger=logger)

    recorder = tracer.start_trace("coach-ask", "42", "pregunta")
    recorder.finish("respuesta")

    assert any("traza del coach" in r for r in logger.records)
    assert not any("secreto-sk-lf-123" in r for r in logger.records)


# SDD: NFR-003 AC-N003.1
def test_no_test_in_the_suite_imports_the_langfuse_package():
    """Ningun archivo de test importa `langfuse` y el paquete no esta cargado
    durante la suite (el adaptador solo usa el cliente de mentira)."""
    pattern = re.compile(r"^\s*(?:import|from)\s+langfuse(?:\s|\.|$)", re.MULTILINE)
    tests_dir = Path(__file__).resolve().parents[1]

    offenders = [
        str(path.relative_to(tests_dir))
        for path in tests_dir.rglob("*.py")
        if pattern.search(path.read_text(encoding="utf-8"))
    ]

    assert offenders == []
    assert "langfuse" not in sys.modules
