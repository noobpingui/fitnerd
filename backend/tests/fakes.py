"""Fakes reutilizables entre distintos archivos de test unitario. Cada
repositorio real tiene una forma distinta (metodos distintos), asi que esos
se siguen definiendo a mano en cada archivo de test - pero UnitOfWork
siempre tiene la misma forma (commit/rollback) sin importar que servicio la
use, asi que vale la pena tenerla una sola vez aca en vez de repetirla.
"""


class FakeUnitOfWork:
    def __init__(self):
        self.committed = False
        self.rolled_back = False

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class FakeLLMClient:
    """Doble de LLMClient (Anthropic) - devuelve `answer` como si Claude
    hubiera respondido bien, o levanta `raise_error` para simular una
    falla real del proveedor. `calls` queda para poder afirmar CUANTAS
    veces (o si) se llego a llamar - clave para probar que un
    short-circuit (rate limit, sin contexto, etc.) evita gastar una
    llamada real. `answer=None` simula un rechazo por seguridad.
    `input_tokens`, `output_tokens` y `model` alimentan a
    `generate_with_usage` (observabilidad del coach)."""
    def __init__(
        self,
        answer="Respuesta de mentira, sin tocar Anthropic",
        raise_error=None,
        input_tokens=0,
        output_tokens=0,
        model="fake-model",
    ):
        self.answer = answer
        self.raise_error = raise_error
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.model = model
        self.calls = []

    def generate(self, system_prompt, messages):
        self.calls.append((system_prompt, messages))
        if self.raise_error:
            raise self.raise_error
        return self.answer

    def generate_with_usage(self, system_prompt, messages, max_tokens=2048):
        from utils.llm_client import GenerationResult

        self.calls.append((system_prompt, messages))
        if self.raise_error:
            raise self.raise_error
        return GenerationResult(self.answer, self.input_tokens, self.output_tokens)


class FakeRateLimiter:
    """Doble de RateLimiter (Redis) - `allowed` decide si
    check_and_increment devuelve True o False, sin tocar Redis para nada.
    `calls` guarda los argumentos de cada llamada, para poder verificar
    CON QUE key se esta limitando (ej: que incluya el user_id correcto)."""
    def __init__(self, allowed=True):
        self.allowed = allowed
        self.calls = []

    def check_and_increment(self, key, limit, window_seconds):
        self.calls.append((key, limit, window_seconds))
        return self.allowed


class FakeRedisClient:
    """Doble del cliente de Redis para inyectarlo en un `RateLimiter` real
    (`limiter.client = FakeRedisClient()`): `incr` cuenta por key en `counts`
    y `expire` registra cada llamada en `expirations`. Así se prueba la lógica
    real de la ventana sin Redis."""
    def __init__(self):
        self.counts = {}
        self.expirations = []

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, seconds):
        self.expirations.append((key, seconds))


class FakeEmailSender:
    """Doble de EmailSender (utils/email_sender.py) - guarda en `sent` cada
    correo que el servicio intento enviar (claves to, subject, text, html),
    o levanta `raise_error` para simular una caida del proveedor. Como
    `raise_error` es mutable, un test puede "arreglar" el proveedor a mitad
    del escenario (ponerlo en None) para probar la recuperacion."""
    def __init__(self, raise_error=None):
        self.raise_error = raise_error
        self.sent = []

    def send(self, to, subject, text, html):
        if self.raise_error is not None:
            raise self.raise_error
        self.sent.append({"to": to, "subject": subject, "text": text, "html": html})


class FakeClock:
    """Reloj controlable para probar limites y caducidades por tiempo sin
    esperar de verdad. Es invocable (`clock()` devuelve `now`) para poder
    inyectarlo donde el servicio espera una funcion de reloj."""
    def __init__(self, now):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, **timedelta_kwargs):
        from datetime import timedelta
        self.now = self.now + timedelta(**timedelta_kwargs)


class FakeHTTPResponse:
    """Respuesta de exito de mentira: solo hace de context manager vacio."""

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


class FakeOpener:
    """Doble de `urllib.request.urlopen` para ResendTransport: guarda cada
    `Request` en `requests` y, segun la configuracion, tiene exito, lanza un
    HTTPError con `status` y `body`, o lanza un URLError (`no_connection`).
    Nunca toca la red."""

    def __init__(self, status=None, body=b"", no_connection=False):
        self.status = status
        self.body = body
        self.no_connection = no_connection
        self.requests = []

    def __call__(self, request, timeout=None):
        import io
        import urllib.error

        self.requests.append(request)
        if self.no_connection:
            raise urllib.error.URLError("sin conexion")
        if self.status is not None:
            raise urllib.error.HTTPError(
                request.full_url, self.status, "error", {}, io.BytesIO(self.body)
            )
        return FakeHTTPResponse()


class FakeLogger:
    """Logger de mentira: guarda cada entrada ya formateada (`msg % args`)
    en `records`, para poder buscar subcadenas en ella."""

    def __init__(self):
        self.records = []

    def _log(self, msg, *args):
        self.records.append(msg % args if args else msg)

    def debug(self, msg, *args, **kwargs):
        self._log(msg, *args)

    def info(self, msg, *args, **kwargs):
        self._log(msg, *args)

    def warning(self, msg, *args, **kwargs):
        self._log(msg, *args)

    def error(self, msg, *args, **kwargs):
        self._log(msg, *args)


class FakeBodyMetricRepository:
    """Doble de BodyMetricRepository en memoria (spec 008). Guarda instancias
    reales de `BodyMetric`; `create` les asigna `id` y `created_at` porque los
    valores por defecto del modelo solo se aplican al hacer flush. `created` y
    `deleted` quedan para las aserciones. `metrics` permite precargar."""

    def __init__(self, metrics=None):
        self.metrics = list(metrics or [])
        self.created = []
        self.deleted = []

    def create(self, metric):
        from datetime import datetime
        from uuid import uuid4

        if getattr(metric, "id", None) is None:
            metric.id = uuid4()
        if getattr(metric, "created_at", None) is None:
            metric.created_at = datetime(2026, 10, 12, 12, 0)
        self.metrics.append(metric)
        self.created.append(metric)
        return metric

    def delete(self, metric):
        self.metrics.remove(metric)
        self.deleted.append(metric)

    def list_by_user(self, user_id):
        own = [m for m in self.metrics if str(m.user_id) == str(user_id)]
        return sorted(own, key=lambda m: m.recorded_at, reverse=True)

    def get_by_id_and_user(self, metric_id, user_id):
        for metric in self.metrics:
            if str(metric.id) == str(metric_id) and str(metric.user_id) == str(user_id):
                return metric
        return None

    def get_by_user_and_date(self, user_id, recorded_at):
        for metric in self.metrics:
            if str(metric.user_id) == str(user_id) and metric.recorded_at == recorded_at:
                return metric
        return None

    def get_latest_with_weight(self, user_id):
        with_weight = [
            m
            for m in self.metrics
            if str(m.user_id) == str(user_id) and m.weight is not None
        ]
        if not with_weight:
            return None
        return max(with_weight, key=lambda m: m.recorded_at)


class FakeUserProfileRepository:
    """Doble de UserProfileRepository: `profiles` es un dict user_id -> perfil
    (`UserProfile` sin sesion o `SimpleNamespace`)."""

    def __init__(self, profiles=None):
        self.profiles = dict(profiles or {})

    def get_by_user_id(self, user_id):
        return self.profiles.get(user_id)


class FakeLockingUserRepository:
    """Doble de UserRepository con `get_by_id_for_update`: registra cada
    llamada en `for_update_calls`. Si `known_ids` es None, todo usuario
    existe; si no, solo los ids indicados (los demas devuelven None)."""

    def __init__(self, known_ids=None):
        self.known_ids = None if known_ids is None else set(known_ids)
        self.for_update_calls = []

    def get_by_id_for_update(self, user_id):
        from types import SimpleNamespace

        self.for_update_calls.append(user_id)
        if self.known_ids is not None and user_id not in self.known_ids:
            return None
        return SimpleNamespace(id=user_id)


class FakeUserRepository:
    """Doble de UserRepository en memoria (spec 010): `users` es un dict
    user_id -> dict con los campos del usuario (`first_name`, `last_name`,
    `email`, `date_of_birth`; los que falten valen None). `get_by_id`
    devuelve un `SimpleNamespace` con `id` y esos campos, o None si el
    usuario no existe."""

    def __init__(self, users=None):
        self.users = dict(users or {})

    def get_by_id(self, user_id):
        from types import SimpleNamespace

        fields = self.users.get(user_id)
        if fields is None:
            return None
        return SimpleNamespace(
            id=user_id,
            first_name=fields.get("first_name"),
            last_name=fields.get("last_name"),
            email=fields.get("email"),
            date_of_birth=fields.get("date_of_birth"),
        )


class FakeSequenceClock:
    """Reloj que devuelve los instantes indicados en orden y, agotados,
    repite el último. `calls` cuenta cuántas veces se consultó."""

    def __init__(self, *instants):
        self.instants = list(instants)
        self.calls = 0

    def __call__(self):
        index = min(self.calls, len(self.instants) - 1)
        self.calls += 1
        return self.instants[index]


# --- Spec 021: base de alimentos de USDA ---------------------------------


def basis_vector(index, dimensions=1024):
    """Vector unitario con un 1.0 en `index` y ceros en el resto. Dos vectores
    de base distintos son ortogonales (similitud coseno 0, distancia 1)."""
    vector = [0.0] * dimensions
    vector[index] = 1.0
    return vector


def vector_with_similarity(similarity, dimensions=1024):
    """Vector unitario cuyo coseno con `basis_vector(0)` es `similarity`
    (distancia coseno = 1 - similarity). Sirve para colocar alimentos y
    consultas a distancias conocidas en una columna `vector(1024)`."""
    import math

    vector = [0.0] * dimensions
    vector[0] = similarity
    vector[1] = math.sqrt(max(0.0, 1.0 - similarity * similarity))
    return vector


class FakeFoodEmbeddingClient:
    """Doble de `EmbeddingClient` (spec 021): `vectors` asigna un vector a cada
    texto exacto; los demas reciben `default_vector` (por defecto
    `basis_vector(1)`). `document_calls` guarda la lista de textos de cada
    llamada a `embed_documents` y `query_calls` cada texto de `embed_query`.
    `raise_error` es mutable: un test puede hacer que falle y luego que
    responda."""

    def __init__(self, vectors=None, default_vector=None, raise_error=None):
        self.vectors = dict(vectors or {})
        self.default_vector = default_vector if default_vector is not None else basis_vector(1)
        self.raise_error = raise_error
        self.document_calls = []
        self.query_calls = []

    def _vector_for(self, text):
        return list(self.vectors.get(text, self.default_vector))

    def embed_documents(self, texts):
        self.document_calls.append(list(texts))
        if self.raise_error is not None:
            raise self.raise_error
        return [self._vector_for(text) for text in texts]

    def embed_query(self, text):
        self.query_calls.append(text)
        if self.raise_error is not None:
            raise self.raise_error
        return self._vector_for(text)


class FakeVoyageClient:
    """Doble del `voyageai.Client` que se instala en el singleton
    (`embedding_client.client = FakeVoyageClient(...)`): asi la ruta usa el
    `EmbeddingClient` real sin red. `embed` devuelve un objeto con
    `embeddings` y `total_tokens`; `calls` guarda cada llamada."""

    def __init__(self, vectors=None, default_vector=None, raise_error=None):
        self.vectors = dict(vectors or {})
        self.default_vector = default_vector if default_vector is not None else basis_vector(1)
        self.raise_error = raise_error
        self.calls = []

    def embed(self, texts, model=None, input_type=None):
        from types import SimpleNamespace

        self.calls.append({"texts": list(texts), "model": model, "input_type": input_type})
        if self.raise_error is not None:
            raise self.raise_error
        embeddings = [list(self.vectors.get(text, self.default_vector)) for text in texts]
        return SimpleNamespace(embeddings=embeddings, total_tokens=len(texts))


class FakeFoodRepository:
    """Doble de `FoodRepository` en memoria (spec 021): devuelve las listas de
    FDC IDs preparadas (`text_ids`, `semantic_ids`) respetando `limit`, y
    registra las llamadas en `text_calls` y `semantic_calls`. `foods` son los
    alimentos que devuelve `get_by_fdc_ids` (objetos con `fdc_id`)."""

    def __init__(self, foods=None, text_ids=None, semantic_ids=None):
        self.foods = list(foods or [])
        self.text_ids = list(text_ids or [])
        self.semantic_ids = list(semantic_ids or [])
        self.text_calls = []
        self.semantic_calls = []
        self.get_calls = []

    def find_text_matches(self, query, limit):
        self.text_calls.append((query, limit))
        return self.text_ids[:limit]

    def find_semantic_matches(self, vector, max_distance, limit):
        self.semantic_calls.append((vector, max_distance, limit))
        return self.semantic_ids[:limit]

    def get_by_fdc_ids(self, fdc_ids):
        self.get_calls.append(list(fdc_ids))
        wanted = set(fdc_ids)
        return [food for food in self.foods if food.fdc_id in wanted]
