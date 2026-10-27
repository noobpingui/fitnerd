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
    CON QUÉ key se está limitando (ej: que incluya el user_id correcto)."""
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
    inyectarlo donde el servicio espera una función de reloj."""
    def __init__(self, now):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, **timedelta_kwargs):
        from datetime import timedelta
        self.now = self.now + timedelta(**timedelta_kwargs)


class FakeHTTPResponse:
    """Respuesta de éxito de mentira: solo hace de context manager vacio."""

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
    (`UserProfile` sin sesión o `SimpleNamespace`)."""

    def __init__(self, profiles=None):
        self.profiles = dict(profiles or {})

    def get_by_user_id(self, user_id):
        return self.profiles.get(user_id)


class FakeLockingUserRepository:
    """Doble de UserRepository con `get_by_id_for_update`: registra cada
    llamada en `for_update_calls`. Si `known_ids` es None, todo usuario
    existe; si no, solo los ids indicados (los demás devuelven None)."""

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


# --- Spec 022: diario de comidas -----------------------------------------


def make_food(fdc_id, description, data_type="sr_legacy", **per_100g):
    """Alimento de USDA de mentira con la forma de `Food` (spec 022): los
    valores por 100 g se pasan por nombre (`calories_kcal`, `protein_g`,
    `carbs_g`, `fat_g`); los que falten valen None (sin dato)."""
    from types import SimpleNamespace

    return SimpleNamespace(
        fdc_id=fdc_id,
        description=description,
        data_type=data_type,
        calories_kcal=per_100g.get("calories_kcal"),
        protein_g=per_100g.get("protein_g"),
        carbs_g=per_100g.get("carbs_g"),
        fat_g=per_100g.get("fat_g"),
    )


class FakeMealRepository:
    """Doble de MealRepository en memoria (spec 022). Guarda instancias reales
    de `Meal` (sin sesion); `create` les asigna un `id` entero creciente.
    `created` y `deleted` quedan para las aserciones y `meals` permite
    precargar. Los tres metodos de consulta filtran por usuario, como el real."""

    def __init__(self, meals=None, recent_rows=None):
        self.meals = list(meals or [])
        self.created = []
        self.deleted = []
        self.recent_rows = list(recent_rows or [])
        self.recent_calls = []
        self._next_id = max([m.id for m in self.meals if m.id is not None] + [0]) + 1

    def list_recent_foods(self, user_id, limit):
        """Spec 028: devuelve las filas de `recent_rows` (ya ordenadas y sin
        repetir, como las daría la consulta real) respetando `limit`, y
        registra cada llamada en `recent_calls`."""
        self.recent_calls.append((user_id, limit))
        return list(self.recent_rows)[:limit]

    def create(self, meal):
        if getattr(meal, "id", None) is None:
            meal.id = self._next_id
            self._next_id += 1
        self.meals.append(meal)
        self.created.append(meal)
        return meal

    def delete(self, meal):
        self.meals.remove(meal)
        self.deleted.append(meal)

    def list_by_user_and_date(self, user_id, meal_date):
        return [
            m
            for m in self.meals
            if str(m.user_id) == str(user_id) and m.meal_date == meal_date
        ]

    def get_by_user_date_and_type(self, user_id, meal_date, meal_type):
        for meal in self.meals:
            if (
                str(meal.user_id) == str(user_id)
                and meal.meal_date == meal_date
                and meal.meal_type == meal_type
            ):
                return meal
        return None

    def get_by_id_and_user(self, meal_id, user_id):
        for meal in self.meals:
            if meal.id == meal_id and str(meal.user_id) == str(user_id):
                return meal
        return None


# --- Spec 023: catálogo genérico de alimentos ----------------------------


def make_catalog_food(
    id,
    name,
    synonyms=(),
    calories_kcal=0.0,
    protein_g=0.0,
    carbs_g=0.0,
    fat_g=0.0,
    source="usda",
    fdc_id=1,
    reference=None,
):
    """Alimento del catálogo de mentira con la forma de `CatalogFood`
    (spec 023): `synonyms` es una lista y los cuatro valores son por 100 g."""
    from types import SimpleNamespace

    return SimpleNamespace(
        id=id,
        name=name,
        synonyms=list(synonyms),
        calories_kcal=calories_kcal,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        source=source,
        fdc_id=fdc_id,
        reference=reference,
    )


class FakeCatalogFoodRepository:
    """Doble de `CatalogFoodRepository` en memoria (spec 023): `foods` son los
    alimentos del catálogo. `list_all` devuelve todos (ordenados por id, como
    el real) y registra la llamada en `list_calls`; `get_by_ids` devuelve los
    que coinciden (orden libre) y guarda cada lista pedida en `get_calls`."""

    def __init__(self, foods=None):
        self.foods = list(foods or [])
        self.list_calls = []
        self.get_calls = []

    def list_all(self):
        self.list_calls.append(True)
        return sorted(self.foods, key=lambda food: food.id)

    def get_by_ids(self, ids):
        self.get_calls.append(list(ids))
        wanted = set(ids)
        return [food for food in self.foods if food.id in wanted]


class FakeVisionClient:
    """Doble de `BedrockVisionClient` (spec 024): `recognize_foods` guarda cada
    llamada en `calls` (claves `image`, `image_format`, `system_prompt` y
    `prompt`), lanza `raise_error` si lo hay y, si no, devuelve `foods` (la
    lista sin sanear que daría el modelo) con los tokens configurados."""

    def __init__(
        self,
        foods=None,
        raise_error=None,
        input_tokens=100,
        output_tokens=20,
        model_id="fake-vision-model",
    ):
        self.foods = foods
        self.raise_error = raise_error
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.model_id = model_id
        self.calls = []

    @property
    def configured(self):
        return True

    def recognize_foods(self, image, image_format, system_prompt, prompt):
        from utils.vision_client import VisionFoodsResult

        self.calls.append(
            {
                "image": image,
                "image_format": image_format,
                "system_prompt": system_prompt,
                "prompt": prompt,
            }
        )
        if self.raise_error is not None:
            raise self.raise_error
        return VisionFoodsResult(list(self.foods or []), self.input_tokens, self.output_tokens)


class FakeBedrockRuntimeClient:
    """Doble del cliente `bedrock-runtime` de boto3 (spec 024): `converse`
    guarda sus kwargs en `calls`, lanza `raise_error` si lo hay y devuelve un
    mensaje con un bloque `toolUse` llamado `report_foods` con `{"foods":
    foods}` o, si se da `text`, un mensaje con solo un bloque de texto (una
    respuesta que no se puede interpretar). Nunca toca la red."""

    def __init__(
        self,
        foods=None,
        text=None,
        raise_error=None,
        stop_reason="tool_use",
        input_tokens=100,
        output_tokens=20,
    ):
        self.foods = foods
        self.text = text
        self.raise_error = raise_error
        self.stop_reason = stop_reason
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.calls = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        if self.raise_error is not None:
            raise self.raise_error
        if self.text is not None:
            content = [{"text": self.text}]
        else:
            content = [
                {
                    "toolUse": {
                        "toolUseId": "tool-1",
                        "name": "report_foods",
                        "input": {"foods": list(self.foods or [])},
                    }
                }
            ]
        return {
            "output": {"message": {"role": "assistant", "content": content}},
            "stopReason": self.stop_reason,
            "usage": {
                "inputTokens": self.input_tokens,
                "outputTokens": self.output_tokens,
            },
        }

    def _last_user_content(self):
        return self.calls[-1]["messages"][0]["content"]

    def last_image(self):
        """(bytes, formato) de la imagen de la última llamada."""
        for block in self._last_user_content():
            if "image" in block:
                return block["image"]["source"]["bytes"], block["image"]["format"]
        raise AssertionError("la última llamada no llevaba imagen")

    def last_prompt(self):
        """Texto del bloque `text` del mensaje de la última llamada."""
        for block in self._last_user_content():
            if "text" in block:
                return block["text"]
        raise AssertionError("la última llamada no llevaba texto")


# --- Spec 028: biblioteca de alimentos del diario -------------------------


def make_custom_food(
    id,
    user_id,
    name,
    calories_kcal=0.0,
    protein_g=0.0,
    carbs_g=0.0,
    fat_g=0.0,
):
    """Alimento propio de mentira con la forma de `CustomFood` (spec 028): los
    cuatro valores son por 100 g y `name_key` sale de la regla real de la
    spec (`custom_food_name_key`)."""
    from types import SimpleNamespace

    from services.food_library_rules import custom_food_name_key

    return SimpleNamespace(
        id=id,
        user_id=user_id,
        name=name,
        name_key=custom_food_name_key(name),
        calories_kcal=calories_kcal,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
    )


def make_favorite(user_id, catalog_id=None, custom_food_id=None):
    """Favorito de mentira con la forma de `FoodFavorite` (spec 028): lleva
    `catalog_id` o `custom_food_id`, nunca los dos."""
    from types import SimpleNamespace

    return SimpleNamespace(
        user_id=user_id, catalog_id=catalog_id, custom_food_id=custom_food_id
    )


class FakeCustomFoodRepository:
    """Doble de `CustomFoodRepository` en memoria (spec 028): filtra por
    usuario como el real. `create` asigna un `id` entero creciente; `created`
    y `deleted` quedan para las aserciones y `foods` permite precargar. Acepta
    tanto instancias reales de `CustomFood` como `SimpleNamespace`."""

    def __init__(self, foods=None):
        self.foods = list(foods or [])
        self.created = []
        self.deleted = []
        self._next_id = max([f.id for f in self.foods if f.id is not None] + [0]) + 1

    def _own(self, user_id):
        return [f for f in self.foods if str(f.user_id) == str(user_id)]

    def list_by_user(self, user_id):
        return sorted(self._own(user_id), key=lambda food: food.id)

    def get_by_id_and_user(self, custom_food_id, user_id):
        for food in self._own(user_id):
            if food.id == custom_food_id:
                return food
        return None

    def get_by_ids_and_user(self, ids, user_id):
        wanted = set(ids)
        return [food for food in self._own(user_id) if food.id in wanted]

    def get_by_name_keys(self, user_id, name_keys):
        wanted = set(name_keys)
        return [food for food in self._own(user_id) if food.name_key in wanted]

    def count_by_user(self, user_id):
        return len(self._own(user_id))

    def create(self, food):
        if getattr(food, "id", None) is None:
            food.id = self._next_id
            self._next_id += 1
        self.foods.append(food)
        self.created.append(food)
        return food

    def delete(self, food):
        self.foods.remove(food)
        self.deleted.append(food)


class FakeFoodFavoriteRepository:
    """Doble de `FoodFavoriteRepository` en memoria (spec 028): `favorites`
    permite precargar (ver `make_favorite`); `created` y `deleted` quedan para
    las aserciones."""

    def __init__(self, favorites=None):
        self.favorites = list(favorites or [])
        self.created = []
        self.deleted = []

    def list_by_user(self, user_id):
        return [f for f in self.favorites if str(f.user_id) == str(user_id)]

    def get_for_food(self, user_id, catalog_id=None, custom_food_id=None):
        for favorite in self.list_by_user(user_id):
            if catalog_id is not None and favorite.catalog_id == catalog_id:
                return favorite
            if custom_food_id is not None and favorite.custom_food_id == custom_food_id:
                return favorite
        return None

    def count_by_user(self, user_id):
        return len(self.list_by_user(user_id))

    def create(self, favorite):
        self.favorites.append(favorite)
        self.created.append(favorite)
        return favorite

    def delete(self, favorite):
        self.favorites.remove(favorite)
        self.deleted.append(favorite)
