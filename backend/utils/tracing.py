"""Puerto de trazas del coach (ADR-0017).

`CoachService` solo conoce este módulo: abre una traza con `Tracer.start_trace`
y registra pasos y puntuaciones en el recorder que recibe. Todo lo que devuelve
el `Tracer` está autoprotegido: ninguna excepción del destino llega al servicio.
El destino real (SDK de Langfuse) vive en `utils/langfuse_backend.py`.
"""

import logging

from config import observability_enabled

_fallback_logger = logging.getLogger(__name__)

_WARNING = "No se pudo enviar la traza del coach a Langfuse: %s"


def format_error(exc) -> str:
    """Tipo y mensaje de la excepción, recortado a 200 caracteres y sin pila."""
    return f"{type(exc).__name__}: {exc}"[:200]


class NullStepHandle:
    def end(self, output=None, usage=None):
        return None

    def fail(self, exc):
        return None


class NullTraceRecorder:
    def start_step(self, name, kind, input, model=None):
        return NullStepHandle()

    def add_score(self, name, value, data_type):
        return None

    def finish(self, output):
        return None


class _TraceState:
    """Estado compartido por un recorder y sus pasos: avisa una sola vez y deja la traza inerte."""

    def __init__(self, logger):
        self.logger = logger
        self.broken = False

    def run(self, func, *args, **kwargs):
        if self.broken:
            return None
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            self.broken = True
            # Solo el nombre del tipo: el mensaje podría contener credenciales.
            self.logger.warning(_WARNING, type(exc).__name__)
            return None


class SafeStepHandle:
    def __init__(self, backend_step, logger, state=None):
        self.backend_step = backend_step
        self.logger = logger
        self._state = state or _TraceState(logger)

    def end(self, output=None, usage=None):
        if self.backend_step is None:
            return None
        self._state.run(self.backend_step.end, output=output, usage=usage)

    def fail(self, exc):
        if self.backend_step is None:
            return None
        self._state.run(lambda: self.backend_step.fail(format_error(exc)))


class SafeTraceRecorder:
    def __init__(self, backend_trace, logger):
        self.backend_trace = backend_trace
        self.logger = logger
        self._state = _TraceState(logger)

    def start_step(self, name, kind, input, model=None):
        step = self._state.run(self.backend_trace.start_step, name, kind, input, model)
        return SafeStepHandle(step, self.logger, self._state)

    def add_score(self, name, value, data_type):
        self._state.run(self.backend_trace.add_score, name, value, data_type)

    def finish(self, output):
        self._state.run(self.backend_trace.finish, output)


class Tracer:
    def __init__(self, backend=None, logger=None, client_factory=None, propagate_attributes=None):
        self.backend = backend
        self.logger = logger
        self.client_factory = client_factory
        self.propagate_attributes = propagate_attributes

    @property
    def enabled(self) -> bool:
        return self.backend is not None

    def init_app(self, app):
        if self.logger is None:
            self.logger = app.logger
        if not observability_enabled(app.config):
            self.backend = None
            return

        # Import local: mantiene el adaptador (y el SDK) fuera si el tracer está inactivo.
        from utils.langfuse_backend import LangfuseTraceBackend

        self.backend = LangfuseTraceBackend(
            app.config["LANGFUSE_PUBLIC_KEY"],
            app.config["LANGFUSE_SECRET_KEY"],
            base_url=app.config["LANGFUSE_BASE_URL"],
            environment=app.config["OBSERVABILITY_ENVIRONMENT"],
            client_factory=self.client_factory,
            propagate_attributes=self.propagate_attributes,
        )

    def start_trace(self, name, user_id, input):
        if self.backend is None:
            return NullTraceRecorder()
        logger = self.logger or _fallback_logger
        try:
            backend_trace = self.backend.start_trace(name, user_id, input)
        except Exception as exc:
            logger.warning(_WARNING, type(exc).__name__)
            return NullTraceRecorder()
        return SafeTraceRecorder(backend_trace, logger)
