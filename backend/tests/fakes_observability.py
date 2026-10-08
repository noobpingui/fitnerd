"""Fakes de la feature 004 (observabilidad del coach), escritos a mano.
Se importan junto con los de `tests/fakes.py`. Nada de esto toca la red ni el
SDK real de Langfuse.
"""

import json
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from types import SimpleNamespace

from tests.fakes import FakeLogger


@dataclass
class RecordedScore:
    name: str
    value: object
    data_type: str


@dataclass
class RecordedStep:
    name: str
    kind: str
    input: object
    model: object = None
    output: object = None
    usage: object = None
    error: object = None
    start_time: object = None
    end_time: object = None


@dataclass
class RecordedTrace:
    name: str
    user_id: object
    input: object
    output: object = None
    finished: bool = False
    steps: list = field(default_factory=list)
    scores: list = field(default_factory=list)
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex)


@dataclass
class RecordedTraceScore:
    """Puntuación enviada sobre una traza ya cerrada (feature 005)."""

    trace_id: str
    name: str
    value: object
    data_type: str
    score_id: str


class _FakeBackendStep:
    def __init__(self, backend, recorded):
        self._backend = backend
        self.recorded = recorded

    def end(self, output=None, usage=None):
        self._backend._maybe_raise()
        self.recorded.output = output
        self.recorded.usage = usage
        self.recorded.end_time = self._backend._now()

    def fail(self, message):
        self._backend._maybe_raise()
        self.recorded.error = message
        self.recorded.end_time = self._backend._now()


class _FakeBackendTrace:
    def __init__(self, backend, recorded):
        self._backend = backend
        self.recorded = recorded
        self.trace_id = recorded.trace_id

    def start_step(self, name, kind, input, model=None):
        self._backend._maybe_raise()
        step = RecordedStep(name, kind, input, model, start_time=self._backend._now())
        self.recorded.steps.append(step)
        return _FakeBackendStep(self._backend, step)

    def add_score(self, name, value, data_type):
        self._backend._maybe_raise()
        self.recorded.scores.append(RecordedScore(name, value, data_type))

    def finish(self, output):
        self._backend._maybe_raise()
        self.recorded.output = output
        self.recorded.finished = True


class FakeTraceBackend:
    """Doble del backend de trazas (puerto de utils/tracing.py): registra en
    memoria cada traza, paso y puntuación. Si `raise_error` tiene valor (se
    puede cambiar a mitad del test), TODAS sus operaciones lo lanzan, para
    simular un destino que falla en cada envío. `clock` es opcional: un
    invocable que devuelve la hora; sin el se usa la hora real."""

    def __init__(self, clock=None, raise_error=None, delay_seconds=0):
        self.clock = clock
        self.raise_error = raise_error
        self.delay_seconds = delay_seconds
        self.traces = []
        #Feature 005: todos los envíos de `score_trace` (en orden) y la última
        #puntuación por `score_id`, para imitar el upsert de Langfuse.
        self.trace_scores = []
        self.scores_by_id = {}

    def score_trace(self, trace_id, name, value, data_type, score_id):
        self._maybe_raise()
        if self.delay_seconds:
            threading.Event().wait(self.delay_seconds)
        score = RecordedTraceScore(trace_id, name, value, data_type, score_id)
        self.trace_scores.append(score)
        self.scores_by_id[score_id] = score

    def _now(self):
        return self.clock() if self.clock else datetime.now(timezone.utc)

    def _maybe_raise(self):
        if self.raise_error is not None:
            raise self.raise_error

    def start_trace(self, name, user_id, input):
        self._maybe_raise()
        recorded = RecordedTrace(name, user_id, input)
        self.traces.append(recorded)
        return _FakeBackendTrace(self, recorded)


class FakeLangfuseObservation:
    """Doble de la observación del SDK langfuse 4.17: solo implementa
    `start_observation`, `update`, `score_trace` y `end`. A proposito NO
    tiene `update_trace` ni `set_trace_io`: si el adaptador los llamara, el
    test fallaria con AttributeError."""

    def __init__(self, client, kwargs, parent=None):
        self.client = client
        self.kwargs = kwargs
        self.parent = parent
        #32 caracteres hexadecimales, uno por raíz; los hijos comparten el de su raíz.
        self.trace_id = parent.trace_id if parent is not None else uuid.uuid4().hex
        self.attributes_at_creation = dict(client.active_attributes)
        self.calls = []
        self.active_at_calls = []

    def _record(self, method, kwargs):
        self.client._check_error()
        self.calls.append((method, kwargs))
        self.active_at_calls.append(dict(self.client.active_attributes))
        self.client.calls.append((self, method, kwargs))

    def start_observation(self, **kwargs):
        self._record("start_observation", kwargs)
        return self.client._create(kwargs, parent=self)

    def update(self, **kwargs):
        self._record("update", kwargs)

    def score_trace(self, **kwargs):
        self._record("score_trace", kwargs)

    def end(self, **kwargs):
        self._record("end", kwargs)


class _FakePropagateContext:
    def __init__(self, client, kwargs):
        self.client = client
        self.kwargs = kwargs
        self._previous = {}

    def __enter__(self):
        self._previous = dict(self.client.active_attributes)
        self.client.active_attributes = dict(self.kwargs)
        self.client.calls.append((self.client, "propagate_attributes.enter", dict(self.kwargs)))
        return self

    def __exit__(self, *exc_info):
        self.client.active_attributes = self._previous
        self.client.calls.append((self.client, "propagate_attributes.exit", dict(self.kwargs)))
        return False


class FakeLangfuseClient:
    """Doble del cliente `Langfuse` del SDK 4.17 (solo la API pública que usa
    el adaptador). `active_attributes` imita el contexto de OpenTelemetry
    (uno por hilo): cada observación guarda una copia al crearse, igual que
    el procesador de spans del SDK en `on_start`. `calls` guarda
    `(objeto, método, kwargs)` en orden. `flush()` y `shutdown()`
    representan la exportación por red: esperan `flush_delay_seconds`."""

    def __init__(self, raise_error=None, flush_delay_seconds=0):
        self.raise_error = raise_error
        self.flush_delay_seconds = flush_delay_seconds
        self.flush_calls = 0
        self.shutdown_calls = 0
        self.calls = []
        self.observations = []
        self._local = threading.local()

    @property
    def active_attributes(self):
        return getattr(self._local, "attributes", {})

    @active_attributes.setter
    def active_attributes(self, value):
        self._local.attributes = value

    def _check_error(self):
        if self.raise_error is not None:
            raise self.raise_error

    def _create(self, kwargs, parent=None):
        obs = FakeLangfuseObservation(self, kwargs, parent=parent)
        self.observations.append(obs)
        return obs

    def start_observation(self, **kwargs):
        self._check_error()
        self.calls.append((self, "start_observation", kwargs))
        return self._create(kwargs)

    def create_score(self, **kwargs):
        self._check_error()
        self.calls.append((self, "create_score", kwargs))

    def propagate_attributes(self, **kwargs):
        return _FakePropagateContext(self, kwargs)

    def flush(self):
        self.flush_calls += 1
        threading.Event().wait(self.flush_delay_seconds)

    def shutdown(self):
        self.shutdown_calls += 1
        threading.Event().wait(self.flush_delay_seconds)

    def serialized_calls(self):
        return json.dumps([(name, kwargs) for _, name, kwargs in self.calls], default=str)


class FakeLangfuseClientFactory:
    """Invocable que reemplaza a `Langfuse(...)`: guarda en `calls` los kwargs
    con los que se pidió el cliente y devuelve `client`. `delay_seconds`
    ensancha la ventana de una posible carrera entre hilos."""

    def __init__(self, client, delay_seconds=0):
        self.client = client
        self.delay_seconds = delay_seconds
        self.calls = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay_seconds:
            threading.Event().wait(self.delay_seconds)
        return self.client


class FakeApp:
    """App de Flask de mentira: solo `config` y `logger`, para probar
    `Tracer.init_app` sin crear la app real."""

    def __init__(self, config):
        self.config = config
        self.logger = FakeLogger()


class FakeObservableRetrievalService:
    """Doble de RetrievalService para los tests de observabilidad del coach:
    `candidates` (lista de {"video_title", "chunk_text", "distance"}) es lo
    que devuelve la búsqueda sin filtrar; `embed_error` y `search_error`
    simulan fallas de Voyage y de la busqueda."""

    def __init__(
        self,
        candidates=None,
        embedding_model="voyage-test-model",
        max_distance=0.7,
        embed_tokens=None,
        embed_error=None,
        search_error=None,
    ):
        self.candidates = candidates if candidates is not None else []
        self.embedding_model = embedding_model
        self.max_distance = max_distance
        self.embed_tokens = embed_tokens
        self.embed_error = embed_error
        self.search_error = search_error
        self.embed_calls = []
        self.find_calls = []

    def embed(self, text):
        self.embed_calls.append(text)
        if self.embed_error:
            raise self.embed_error
        return [0.0], self.embed_tokens

    def find_candidates(self, vector, top_k=5):
        self.find_calls.append(top_k)
        if self.search_error:
            raise self.search_error
        return list(self.candidates)

    def is_relevant(self, candidate):
        return candidate["distance"] <= self.max_distance


class FakeAnthropicClient:
    """Doble del cliente de Anthropic (`client.messages.create`): devuelve una
    respuesta con `content`, `usage` y `stop_reason` configurables, y guarda
    en `calls` los kwargs de cada llamada. Nunca toca la red."""

    def __init__(
        self,
        text="Haz 3 series de 10.",
        input_tokens=850,
        output_tokens=40,
        stop_reason="end_turn",
        content=None,
    ):
        if content is None:
            content = [SimpleNamespace(type="text", text=text)] if text is not None else []
        self.response = SimpleNamespace(
            content=content,
            usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
            stop_reason=stop_reason,
        )
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


class FakeVoyageClient:
    """Doble del cliente de Voyage (`client.embed`): devuelve `embeddings` y,
    si `total_tokens` no es None, ese atributo (si es None la respuesta no
    lo trae, como cuando el proveedor no lo informa)."""

    def __init__(self, embeddings=None, total_tokens=12):
        self.embeddings = embeddings if embeddings is not None else [[0.1, 0.2, 0.3]]
        self.total_tokens = total_tokens
        self.calls = []

    def embed(self, texts, model=None, input_type=None):
        self.calls.append({"texts": texts, "model": model, "input_type": input_type})
        result = SimpleNamespace(embeddings=self.embeddings)
        if self.total_tokens is not None:
            result.total_tokens = self.total_tokens
        return result


class FakeEmbeddingClient:
    """Doble de EmbeddingClient para probar RetrievalService."""

    def __init__(self, vector=None, tokens=7, model="voyage-test-model"):
        self.vector = vector if vector is not None else [0.1, 0.2]
        self.tokens = tokens
        self.model = model
        self.queries = []

    def embed_query(self, text):
        self.queries.append(text)
        return self.vector

    def embed_query_with_usage(self, text):
        self.queries.append(text)
        return self.vector, self.tokens


class FakeTranscriptChunkRepository:
    """Doble de TranscriptChunkRepository: `rows` es una lista de
    (chunk_text, video_title, distance); `find_similar` devuelve filas
    `(chunk, título, distancia)` respetando `limit`."""

    def __init__(self, rows=None):
        self.rows = rows if rows is not None else []
        self.calls = []

    def find_similar(self, query_embedding, limit=5):
        self.calls.append({"query_embedding": query_embedding, "limit": limit})
        return [
            (SimpleNamespace(chunk_text=text), title, distance)
            for text, title, distance in self.rows[:limit]
        ]
