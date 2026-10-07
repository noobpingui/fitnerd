"""Puerto de trazas (utils/tracing.py): recorders autoprotegidos, recorder
nulo, `format_error` y activación del `Tracer` por configuración. Todo con
fakes: ningún test importa ni llama al SDK real de Langfuse.
"""

import pytest

from tests.fakes import FakeLogger
from tests.fakes_observability import (
    FakeApp,
    FakeLangfuseClient,
    FakeLangfuseClientFactory,
    FakeTraceBackend,
)
from utils.langfuse_backend import LangfuseTraceBackend
from utils.tracing import (
    NullStepHandle,
    NullTraceRecorder,
    SafeStepHandle,
    SafeTraceRecorder,
    Tracer,
    format_error,
)

BOOM = RuntimeError("secreto-sk-lf-123")


def warnings_about_the_trace(logger):
    return [r for r in logger.records if "traza del coach" in r]


def make_recorder():
    backend = FakeTraceBackend()
    logger = FakeLogger()
    recorder = SafeTraceRecorder(backend.start_trace("coach-ask", "42", "pregunta"), logger)
    return recorder, backend, logger


# SDD: REQ-007 AC-007.3
def test_format_error_includes_type_and_message_and_trims_to_200_characters():
    """`format_error` devuelve tipo y mensaje, recortado a 200 caracteres y sin
    traza de pila."""
    assert format_error(RuntimeError("overloaded")) == "RuntimeError: overloaded"

    long_error = format_error(ValueError("x" * 500))

    assert len(long_error) == 200
    assert long_error.startswith("ValueError: ")
    assert "Traceback" not in long_error


# SDD: REQ-008 AC-008.2
def test_safe_recorder_records_normally_when_the_backend_works():
    """Con un backend sano el recorder reenvía pasos, puntuaciones y cierre."""
    recorder, backend, logger = make_recorder()

    step = recorder.start_step("embedding", "generation", "pregunta", "voyage-test")
    step.end(None, {"input": 12})
    recorder.add_score("outcome", "answered", "CATEGORICAL")
    recorder.finish("respuesta")

    trace = backend.traces[0]
    assert [s.name for s in trace.steps] == ["embedding"]
    assert trace.steps[0].usage == {"input": 12}
    assert trace.scores[0].value == "answered"
    assert trace.output == "respuesta"
    assert logger.records == []


# SDD: REQ-008 AC-008.2
def test_safe_recorder_never_propagates_backend_errors():
    """Ninguna operacion del recorder lanza aunque el backend falle."""
    recorder, backend, _ = make_recorder()
    step = recorder.start_step("embedding", "generation", "pregunta", "voyage-test")
    backend.raise_error = BOOM

    step.end("salida", {"input": 1})
    step.fail(RuntimeError("otro"))
    recorder.start_step("retrieval", "span", {"limit": 5})
    recorder.add_score("outcome", "error", "CATEGORICAL")
    recorder.finish("")


# SDD: REQ-008 AC-008.5
def test_safe_recorder_warns_once_with_only_the_exception_type_and_then_goes_inert():
    """El primer fallo registra un aviso con solo el nombre del tipo de la
    excepción; después la traza queda inerte y no vuelve a avisar."""
    recorder, backend, logger = make_recorder()
    backend.raise_error = BOOM

    recorder.start_step("embedding", "generation", "pregunta", "voyage-test")
    recorder.add_score("outcome", "error", "CATEGORICAL")
    recorder.finish("")

    warnings = warnings_about_the_trace(logger)
    assert len(warnings) == 1
    assert "RuntimeError" in warnings[0]
    assert "secreto-sk-lf-123" not in warnings[0]

    # Aunque el backend se recupere, la traza sigue inerte.
    backend.raise_error = None
    recorder.start_step("retrieval", "span", {"limit": 5})
    recorder.add_score("best_chunk_distance", 0.3, "NUMERIC")
    recorder.finish("otra salida")

    assert backend.traces[0].steps == []
    assert backend.traces[0].scores == []
    assert backend.traces[0].finished is False
    assert len(warnings_about_the_trace(logger)) == 1


# SDD: REQ-008 AC-008.5
def test_safe_step_handle_swallows_errors_and_warns_once():
    """Un paso abierto cuyo cierre falla no propaga el error y avisa una vez."""
    recorder, backend, logger = make_recorder()
    step = recorder.start_step("generation", "generation", [], "claude-sonnet-5")
    backend.raise_error = BOOM

    step.end("salida", {"input": 1, "output": 2})
    step.fail(RuntimeError("otro"))

    assert isinstance(step, SafeStepHandle)
    assert len(warnings_about_the_trace(logger)) == 1


# SDD: REQ-007 AC-007.1
def test_safe_step_handle_fail_formats_the_exception_for_the_backend():
    """`fail(exc)` recibe la excepción y entrega al backend tipo y mensaje."""
    recorder, backend, _ = make_recorder()
    step = recorder.start_step("generation", "generation", [], "claude-sonnet-5")

    step.fail(RuntimeError("overloaded"))

    assert backend.traces[0].steps[0].error == "RuntimeError: overloaded"


# SDD: REQ-008 AC-008.2
def test_tracer_start_trace_returns_the_null_recorder_when_the_backend_fails_to_open():
    """Si el backend falla al abrir la traza, `start_trace` no lanza, avisa y
    devuelve el recorder nulo."""
    logger = FakeLogger()
    tracer = Tracer(backend=FakeTraceBackend(raise_error=BOOM), logger=logger)

    recorder = tracer.start_trace("coach-ask", "42", "pregunta")

    assert isinstance(recorder, NullTraceRecorder)
    assert len(warnings_about_the_trace(logger)) == 1
    assert "secreto-sk-lf-123" not in logger.records[0]


# SDD: REQ-008 AC-008.5
def test_tracer_start_trace_returns_a_safe_recorder_when_the_backend_works():
    """Con un backend sano `start_trace` devuelve un `SafeTraceRecorder`."""
    backend = FakeTraceBackend()
    tracer = Tracer(backend=backend, logger=FakeLogger())

    recorder = tracer.start_trace("coach-ask", "42", "pregunta")

    assert isinstance(recorder, SafeTraceRecorder)
    assert backend.traces[0].name == "coach-ask"
    assert backend.traces[0].user_id == "42"
    assert backend.traces[0].input == "pregunta"


# SDD: REQ-008 AC-008.2
def test_null_recorder_has_no_effects_and_never_raises():
    """El recorder nulo acepta todas las operaciones sin hacer nada."""
    recorder = NullTraceRecorder()

    step = recorder.start_step("embedding", "generation", "pregunta", "voyage-test")
    step.end("salida", {"input": 1})
    step.fail(RuntimeError("x"))
    recorder.add_score("outcome", "answered", "CATEGORICAL")
    recorder.finish("respuesta")

    assert isinstance(step, NullStepHandle)


# --- Activación por configuración (REQ-009 / REQ-010) -------------------------


def make_config(**overrides):
    config = {
        "LANGFUSE_PUBLIC_KEY": "pk-lf-public-xyz",
        "LANGFUSE_SECRET_KEY": "sk-lf-secret-xyz",
        "LANGFUSE_BASE_URL": "https://us.cloud.langfuse.com",
        "OBSERVABILITY_ENVIRONMENT": "development",
        "TESTING": False,
    }
    config.update(overrides)
    return config


def make_tracer():
    fake = FakeLangfuseClient()
    factory = FakeLangfuseClientFactory(fake)
    tracer = Tracer(client_factory=factory, propagate_attributes=fake.propagate_attributes)
    return tracer, fake, factory


# SDD: REQ-009 AC-009.2
def test_init_app_with_both_keys_activates_the_tracer_with_the_langfuse_backend():
    """Con ambas claves y TESTING falso el tracer queda activo con el adaptador
    de Langfuse, y el cliente del SDK no se crea hasta el primer `start_trace`."""
    tracer, fake, factory = make_tracer()

    tracer.init_app(FakeApp(make_config()))

    assert tracer.enabled is True
    assert isinstance(tracer.backend, LangfuseTraceBackend)
    assert factory.calls == []

    tracer.start_trace("coach-ask", "42", "pregunta")

    assert factory.calls == [
        {
            "public_key": "pk-lf-public-xyz",
            "secret_key": "sk-lf-secret-xyz",
            "base_url": "https://us.cloud.langfuse.com",
            "environment": "development",
        }
    ]


# SDD: REQ-010 AC-010.1
def test_production_environment_is_passed_to_the_langfuse_client():
    """El entorno `production` llega al constructor del cliente."""
    tracer, _, factory = make_tracer()
    tracer.init_app(FakeApp(make_config(OBSERVABILITY_ENVIRONMENT="production")))

    tracer.start_trace("coach-ask", "42", "pregunta")

    assert factory.calls[0]["environment"] == "production"


# SDD: REQ-010 AC-010.2
def test_development_environment_is_passed_to_the_langfuse_client():
    """El entorno `development` llega al constructor del cliente."""
    tracer, _, factory = make_tracer()
    tracer.init_app(FakeApp(make_config(OBSERVABILITY_ENVIRONMENT="development")))

    tracer.start_trace("coach-ask", "42", "pregunta")

    assert factory.calls[0]["environment"] == "development"


# SDD: REQ-009 AC-009.1
@pytest.mark.parametrize(
    "overrides",
    [
        {"LANGFUSE_PUBLIC_KEY": None},
        {"LANGFUSE_SECRET_KEY": None},
        {"LANGFUSE_PUBLIC_KEY": None, "LANGFUSE_SECRET_KEY": None},
        {"LANGFUSE_PUBLIC_KEY": "", "LANGFUSE_SECRET_KEY": ""},
    ],
)
def test_init_app_without_both_keys_leaves_the_tracer_inactive_and_silent(overrides):
    """Sin una o las dos claves el tracer queda inactivo, no registra nada y
    nunca pide el cliente."""
    tracer, _, factory = make_tracer()
    app = FakeApp(make_config(**overrides))
    tracer.init_app(app)

    recorder = tracer.start_trace("coach-ask", "42", "pregunta")
    recorder.finish("respuesta")

    assert tracer.enabled is False
    assert isinstance(recorder, NullTraceRecorder)
    assert app.logger.records == []
    assert factory.calls == []


# SDD: REQ-009 AC-009.3
def test_init_app_with_testing_true_stays_inactive_even_with_keys():
    """En el entorno de tests el tracer queda inactivo aunque haya claves."""
    tracer, _, factory = make_tracer()

    tracer.init_app(FakeApp(make_config(TESTING=True)))
    tracer.start_trace("coach-ask", "42", "pregunta")

    assert tracer.enabled is False
    assert factory.calls == []
