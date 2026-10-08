"""Adaptador del SDK oficial `langfuse` (>=4.17,<5) para el puerto de trazas (ADR-0017).

El paquete solo se importa de forma perezosa, dentro de las funciones por defecto:
sin claves (o en tests) nunca se carga. El SDK mide las horas al abrir y cerrar cada
observación y exporta en sus propios hilos, así que nada de aquí espera a la red.
"""

import threading


def _default_client_factory(**kwargs):
    from langfuse import Langfuse

    return Langfuse(**kwargs)


def _default_propagate_attributes(**kwargs):
    from langfuse import propagate_attributes

    return propagate_attributes(**kwargs)


class _LangfuseStep:
    def __init__(self, observation):
        self._obs = observation

    def end(self, output=None, usage=None):
        fields = {}
        if output is not None:
            fields["output"] = output
        if usage is not None:
            fields["usage_details"] = usage
        if fields:
            self._obs.update(**fields)
        self._obs.end()

    def fail(self, message):
        self._obs.update(level="ERROR", status_message=message)
        self._obs.end()


class _LangfuseTrace:
    def __init__(self, root, user_id, name, propagate_attributes):
        self._root = root
        self._user_id = user_id
        self._name = name
        self._propagate_attributes = propagate_attributes
        self.trace_id = root.trace_id

    def start_step(self, name, kind, input, model=None):
        kwargs = {"name": name, "as_type": kind, "input": input}
        if model is not None:
            kwargs["model"] = model
        # El contexto se abre y se cierra dentro de esta llamada: nunca queda adjunto al hilo.
        with self._propagate_attributes(user_id=self._user_id, trace_name=self._name):
            obs = self._root.start_observation(**kwargs)
        return _LangfuseStep(obs)

    def add_score(self, name, value, data_type):
        self._root.score_trace(name=name, value=value, data_type=data_type)

    def finish(self, output):
        self._root.update(output=output)
        self._root.end()


class LangfuseTraceBackend:
    def __init__(
        self,
        public_key,
        secret_key,
        base_url,
        environment,
        client_factory=None,
        propagate_attributes=None,
    ):
        self.public_key = public_key
        self.secret_key = secret_key
        self.base_url = base_url
        self.environment = environment
        self.client_factory = client_factory or _default_client_factory
        self.propagate_attributes = propagate_attributes or _default_propagate_attributes
        self._client = None
        self._lock = threading.Lock()

    def _get_client(self):
        # Perezoso y con candado: gunicorn crea la app en cada worker y los hilos del SDK
        # deben nacer dentro del proceso que los usa.
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = self.client_factory(
                        public_key=self.public_key,
                        secret_key=self.secret_key,
                        base_url=self.base_url,
                        environment=self.environment,
                    )
        return self._client

    def start_trace(self, name, user_id, input):
        client = self._get_client()
        with self.propagate_attributes(user_id=user_id, trace_name=name):
            root = client.start_observation(name=name, as_type="span", input=input)
        return _LangfuseTrace(root, user_id, name, self.propagate_attributes)

    def score_trace(self, trace_id, name, value, data_type, score_id):
        # create_score encola el envío en segundo plano: no bloquea la petición.
        self._get_client().create_score(
            name=name,
            value=value,
            trace_id=trace_id,
            score_id=score_id,
            data_type=data_type,
        )
