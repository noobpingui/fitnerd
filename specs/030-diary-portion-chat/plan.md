# Plan 030 — Chat de porciones del diario (backend)

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-30; iteración 3 con REQ-010 y REQ-011)
- **Ámbitos:** `backend`
- **Iteración del plan:** 2 (vuelta desde el gate de review). Añade REQ-010 y REQ-011 y las correcciones de código y
  tests del backlog de la feature (sección 9). El diseño de REQ-001 a REQ-009 y de los NFR no cambia.

## 1. Resumen de la solución

Se añade `POST /api/meals/portion-estimate` al blueprint `meal_bp`. La ruta fija un tope de 4096 bytes para el cuerpo
de **esta** petición (REQ-011), lee el JSON (`get_json(silent=True)`) y llama a un servicio nuevo,
`PortionEstimateService`, que:
1. valida la petición con reglas puras;
2. consume el límite de uso con el `RateLimiter` existente (Redis, ventana fija de 6 h); si Redis falla, responde 503
   sin llamar al modelo ni abrir traza (REQ-010, falla cerrado);
3. abre una traza con el `Tracer` existente (ADR-0017);
4. hace una sola llamada a Anthropic con una herramienta forzada (salida estructurada, ADR-0037), 150 tokens y
   temperatura 0, con un modelo propio (`PORTION_ESTIMATE_MODEL`, por defecto `claude-haiku-4-5`);
5. valida en el servidor lo que devuelve el modelo y produce `estimated`, `not_food` o `unknown`.

Los fallos del proveedor salen como `ServiceUnavailableError` (503). No hay repositorios, `UnitOfWork`, modelos ni
migraciones: no se guarda nada (NFR-003). Se reutiliza `LLMClient` (se le añade `generate_structured`) y se expone
como singleton perezoso `portion_llm` en `extensions.py`, para que los tests sustituyan el cliente sin `monkeypatch`,
igual que `vision_client` en la 024.

Además (backlog de la feature, sección 9): el coach pasa a usar el mismo patrón perezoso con un singleton
`coach_llm` (sin cambiar su comportamiento ni su contrato), lo que permite probar `/api/coach/ask` hasta el 200, y se
corrigen una tilde, una anotación, dos tests y cuatro marcadores antiguos.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | utils (cliente LLM) | — | `backend/utils/llm_client.py` | `StructuredGenerationResult`, `LLMClient.generate_structured`, `timeout` y `max_retries` opcionales en el constructor y `LazyLLMClient`; en esta iteración, `LazyLLMClient.generate_with_usage`, la tilde de F2 y la anotación de F4 |
| backend | config | — | `backend/config.py` | `DEFAULT_PORTION_ESTIMATE_MODEL`, `PORTION_ESTIMATE_TIMEOUT_SECONDS`, `PORTION_ESTIMATE_MAX_RETRIES`, `Config.PORTION_ESTIMATE_MODEL`, `TestingConfig.PORTION_ESTIMATE_MODEL = None`; en esta iteración, `DEFAULT_ANTHROPIC_MODEL` |
| backend | extensions / app | — | `backend/extensions.py`, `backend/app.py` | Singletons `portion_llm` y (nuevo) `coach_llm`, con su `init_app` en `create_app` |
| backend | services (reglas) | `backend/services/portion_estimate_rules.py` | — | Constantes, mensajes, instrucciones, herramienta, `PortionEstimate`, validación de la pregunta y saneado de la salida (sin cambios en esta iteración) |
| backend | services | `backend/services/portion_estimate_service.py` | — | Orquestación: validar, límite (con 503 si Redis falla, REQ-010), traza, modelo, saneado y 503 |
| backend | routes | — | `backend/routes/meal_routes.py` | `_build_portion_estimate_service()`, `_serialize_portion_estimate()`, `MAX_PORTION_REQUEST_BYTES` y la ruta `POST /portion-estimate` con el tope de cuerpo (REQ-011) |
| backend | routes (coach) | — | `backend/routes/coach_routes.py` | `_build_coach_service()` usa `coach_llm` en lugar de construir un `LLMClient` por petición |
| backend | tests (dobles) | — | `backend/tests/fakes.py` | `FakeStructuredLLMClient`; en esta iteración, `raise_error` opcional en `FakeRateLimiter` y `FakeRedisClient` |
| backend | tests | `backend/tests/test_services/test_portion_estimate_rules.py`, `backend/tests/test_services/test_portion_estimate_service.py`, `backend/tests/test_routes/test_portion_estimate_routes.py` | `backend/tests/test_services/test_llm_client.py`, `backend/tests/test_routes/test_coach_routes.py`, `backend/tests/test_routes/test_meal_routes.py` | Unitarios e integración (sección 5) |
| backend | documentación (etapa docs) | — | `backend/.env.example`, `docs/deploy-runbook.md` | Variable opcional `PORTION_ESTIMATE_MODEL` (Art. P3.5, P4) |

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No hay modelos, tablas ni migraciones. Las preguntas y estimaciones no se guardan (NFR-003); el único
estado es el contador de Redis del límite de uso, que caduca solo.

### 3.2 Contratos e interfaces

**Endpoint** (sección 6 de la spec): `POST /api/meals/portion-estimate`, `@require_auth`. Usuario:
`g.decoded_token["id"]`; cualquier `user_id` del cuerpo se ignora. Cuerpo de como mucho 4096 bytes.

Respuesta 200 (todas las claves siempre presentes):

```json
{"status": "estimated", "grams": 250, "unit": "5 huevos grandes", "note": "Unos 50 g por huevo sin cáscara.", "message": null}
{"status": "not_food", "grams": null, "unit": null, "note": null, "message": "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento."}
{"status": "unknown", "grams": null, "unit": null, "note": null, "message": "No he podido estimar el peso. Prueba a describir el alimento de otra forma."}
```

Errores, todos como `{"error": "…"}` a través de `exceptions/error_handlers.py`:

| Caso | Excepción | Código |
|---|---|---|
| Cuerpo de más de 4096 bytes (REQ-011) | `ValidationError(INVALID_REQUEST_MESSAGE)`, lanzada en la ruta al leer el cuerpo | 400 |
| Cuerpo que no es objeto JSON; `question` que no es `str` (incluido `null`) | `ValidationError(INVALID_REQUEST_MESSAGE)` | 400 |
| `question` ausente, vacía o de solo espacios | `ValidationError(QUESTION_REQUIRED_MESSAGE)` | 400 |
| `question` de más de 200 caracteres tras `strip()` | `ValidationError(QUESTION_TOO_LONG_MESSAGE)` | 400 |
| Sin token o token no válido | el de `require_auth` | 401 |
| Límite agotado | `RateLimitError(RATE_LIMIT_MESSAGE)` | 429 |
| Contador del límite no disponible (REQ-010) | `ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE)` | 503 |
| Fallo del proveedor | `ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE)` | 503 |

**Firmas exactas de los símbolos** (los de la iteración 1 ya existen en el código; los nuevos de esta iteración se
marcan con «nuevo»: el `implementer` crea sus esqueletos con `raise NotImplementedError("not implemented")`;
constantes y `__init__` se crean completos):

`backend/services/portion_estimate_rules.py` (sin cambios)
```python
from dataclasses import dataclass

from services.auth_input_rules import INVALID_REQUEST_MESSAGE  # «La petición no es válida»

MAX_QUESTION_CHARS = 200
MIN_GRAMS = 1
MAX_GRAMS = 5000
MAX_UNIT_CHARS = 50
MAX_NOTE_CHARS = 100
MAX_OUTPUT_TOKENS = 150
TEMPERATURE = 0

QUESTION_REQUIRED_MESSAGE = "Escribe qué alimento quieres pesar."
QUESTION_TOO_LONG_MESSAGE = "La pregunta no puede superar los 200 caracteres."
NOT_FOOD_MESSAGE = "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento."
UNKNOWN_MESSAGE = "No he podido estimar el peso. Prueba a describir el alimento de otra forma."

STATUS_ESTIMATED = "estimated"
STATUS_NOT_FOOD = "not_food"
STATUS_UNKNOWN = "unknown"

PORTION_TOOL_NAME = "report_portion"
PORTION_TOOL: dict  # {"name": PORTION_TOOL_NAME, "description": ..., "input_schema": {...}} (3.3)
SYSTEM_PROMPT: str  # instrucciones fijas (3.3)


@dataclass(frozen=True)
class PortionEstimate:
    status: str
    grams: int | None
    unit: str | None
    note: str | None
    message: str | None


def parse_question(data: object) -> str: ...
def parse_grams(value: object) -> int | None: ...
def clean_text(value: object, max_chars: int) -> str | None: ...
def build_estimate(tool_input: object) -> PortionEstimate: ...
def not_food_estimate() -> PortionEstimate: ...
def unknown_estimate() -> PortionEstimate: ...
```

`backend/services/portion_estimate_service.py` (firmas y constantes sin cambios; cambia la lógica de `estimate`, 3.3)
```python
MAX_QUESTIONS_PER_WINDOW = 10
RATE_LIMIT_WINDOW_SECONDS = 6 * 60 * 60  # 21.600
RATE_LIMIT_KEY_PREFIX = "ratelimit:meals:portion-estimate:"
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde."
)
PROVIDER_UNAVAILABLE_MESSAGE = (
    "No se pudo estimar el peso en este momento. Vuelve a intentarlo en unos minutos."
)
TRACE_NAME = "meal-portion-estimate"


class PortionEstimateService:
    def __init__(self, llm_client, rate_limiter, tracer=None, logger=None): ...
    def estimate(self, user_id: str, data: object) -> PortionEstimate: ...
```
El 503 de REQ-010 usa el mismo `PROVIDER_UNAVAILABLE_MESSAGE` (la spec fija el mismo texto); no hay constante nueva.

`backend/utils/llm_client.py`
```python
@dataclass(frozen=True)
class StructuredGenerationResult:
    data: dict | None
    stop_reason: str | None
    input_tokens: int | None
    output_tokens: int | None


class LLMClient:
    def __init__(
        self,
        model: str,
        api_key: str = None,
        timeout: float | None = None,
        max_retries: int | None = None,
    ): ...

    def generate_structured(
        self,
        system_prompt: str,
        messages: list[dict],
        tool: dict,
        max_tokens: int,
        temperature: float,
    ) -> StructuredGenerationResult: ...   # F4: anotación sin comillas


class LazyLLMClient:
    def __init__(
        self,
        model_config_key: str,
        default_model: str,
        timeout: float | None = None,
        max_retries: int | None = None,
        client_factory=None,
    ): ...

    def init_app(self, app) -> None: ...

    def generate_structured(
        self,
        system_prompt: str,
        messages: list[dict],
        tool: dict,
        max_tokens: int,
        temperature: float,
    ) -> StructuredGenerationResult: ...

    # nuevo (unificación del coach)
    def generate_with_usage(
        self, system_prompt: str, messages: list[dict], max_tokens: int = 2048
    ) -> GenerationResult: ...
```

`backend/config.py`
```python
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"   # nuevo; mismo valor que el literal actual
DEFAULT_PORTION_ESTIMATE_MODEL = "claude-haiku-4-5"
PORTION_ESTIMATE_TIMEOUT_SECONDS = 15.0
PORTION_ESTIMATE_MAX_RETRIES = 1

class Config:
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)   # mismo comportamiento
    PORTION_ESTIMATE_MODEL = os.getenv("PORTION_ESTIMATE_MODEL") or None

class TestingConfig(Config):
    PORTION_ESTIMATE_MODEL = None
```

`backend/extensions.py`
```python
portion_llm = LazyLLMClient(
    "PORTION_ESTIMATE_MODEL",
    DEFAULT_PORTION_ESTIMATE_MODEL,
    timeout=PORTION_ESTIMATE_TIMEOUT_SECONDS,
    max_retries=PORTION_ESTIMATE_MAX_RETRIES,
)
coach_llm = LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)   # nuevo; sin timeout ni reintentos propios
```
y en `create_app`: `coach_llm.init_app(app)` junto a `portion_llm.init_app(app)`.

`backend/routes/meal_routes.py`
```python
MAX_PORTION_REQUEST_BYTES = 4096   # nuevo

def _build_portion_estimate_service() -> PortionEstimateService: ...
def _serialize_portion_estimate(estimate: PortionEstimate) -> dict: ...

@meal_bp.route("/portion-estimate", methods=["POST"])
@require_auth
def estimate_portion(): ...
```

`backend/routes/coach_routes.py`: `_build_coach_service()` mantiene su firma; solo cambia de dónde sale el cliente.
`CoachService` y el contrato de `POST /api/coach/ask` no cambian.

`backend/tests/fakes.py`
```python
class FakeStructuredLLMClient:      # sin cambios
    def __init__(self, data=None, stop_reason="tool_use", raise_error=None,
                 input_tokens=60, output_tokens=30, model="fake-portion-model"): ...
    def generate_structured(self, system_prompt, messages, tool, max_tokens, temperature): ...

class FakeRateLimiter:
    def __init__(self, allowed=True, raise_error=None): ...   # raise_error nuevo, opcional
    # check_and_increment registra la llamada en `calls` y, si raise_error no es None, la lanza

class FakeRedisClient:
    def __init__(self, raise_error=None): ...                 # raise_error nuevo, opcional y mutable
    # incr lanza raise_error si no es None (antes de contar); expire igual que hoy
```
Los usos actuales de ambos dobles no cambian (los parámetros nuevos tienen `None` por defecto).

### 3.3 Lógica

**Ruta** (`estimate_portion`), en este orden:
1. `request.max_content_length = MAX_PORTION_REQUEST_BYTES`, **antes de cualquier acceso al cuerpo** (`request.stream`
   se crea una sola vez con el límite vigente; `require_auth` no lee el cuerpo). Es el mismo mecanismo por petición
   que usa `analyze_photo` con `MAX_ANALYZE_REQUEST_BYTES`; el límite global de la app no cambia (AC-011.4).
2. `try: data = request.get_json(silent=True)` / `except RequestEntityTooLarge: raise
   ValidationError(INVALID_REQUEST_MESSAGE) from None`. `silent=True` solo silencia los `ValueError` del parseo; el
   `RequestEntityTooLarge` de Werkzeug (Content-Length > 4096 o flujo que lo supera) se propaga y se traduce aquí. Con
   un cuerpo de más de 4096 bytes que no es `application/json`, `get_json(silent=True)` devuelve `None` sin leerlo y el
   servicio da el mismo 400. En ningún caso se llama al servicio con el cuerpo grande, así que no se toca el límite, la
   traza ni el modelo (AC-011.1 a AC-011.3). Exactamente 4096 bytes se aceptan (la comprobación de Werkzeug es `>`;
   AC-011.2).
3. `estimate = _build_portion_estimate_service().estimate(g.decoded_token["id"], data)` y
   `jsonify(_serialize_portion_estimate(estimate)), 200`. `_serialize_portion_estimate` devuelve las cinco claves.
   `_build_portion_estimate_service()` devuelve `PortionEstimateService(portion_llm, rate_limiter, tracer=tracer)`.

Importes nuevos en `meal_routes.py`: `ValidationError` (`exceptions.custom_exceptions`) e `INVALID_REQUEST_MESSAGE`
(desde `services.portion_estimate_rules`, que ya lo reexporta). `RequestEntityTooLarge` ya está importado.

**`parse_question(data)`**, en este orden (sin cambios):
1. `data` no es `dict` → `ValidationError(INVALID_REQUEST_MESSAGE)` (AC-005.1: lista, número, `None`).
2. `"question"` no está en `data` → `ValidationError(QUESTION_REQUIRED_MESSAGE)` (AC-005.2 `{}`).
3. `data["question"]` no es `str` → `ValidationError(INVALID_REQUEST_MESSAGE)` (AC-005.3).
4. `question = value.strip()`; vacía → `QUESTION_REQUIRED_MESSAGE`; `len(question) > 200` →
   `QUESTION_TOO_LONG_MESSAGE` (AC-005.4). Devuelve la pregunta sin espacios en los extremos (AC-005.5).

**`parse_grams(value)`** (sin cambios): `None` si `not is_number(value)`; si no, `Decimal` con `ROUND_HALF_UP`
(`Decimal(value)` para `int`, `Decimal(repr(value))` para `float`) y el entero solo si está entre 1 y 5000; fuera,
`None`.

**`clean_text(value, max_chars)`** (sin cambios): `None` si no es `str`; si no, `value.strip()[:max_chars].rstrip()`
y `None` si queda vacío.

**`build_estimate(tool_input)`** (sin cambios): no `dict` o `is_food` no `bool` → `unknown`; `is_food is False` →
`not_food` sin leer otros campos; `is_food is True` → `parse_grams`; `None` → `unknown`; si no, `estimated` con
`clean_text(unit, 50)` y `clean_text(note, 100)`.

**`PORTION_TOOL`** y **`SYSTEM_PROMPT`**: sin cambios respecto a la iteración 1 (esquema con `is_food` obligatorio,
`grams`, `unit` ≤ 50 y `note` ≤ 100; instrucciones fijas en español, una sola estimación del primer alimento y no
seguir instrucciones del mensaje del usuario).

**`PortionEstimateService.estimate(user_id, data)`** (cambia el paso 2):
1. `question = parse_question(data)`; cualquier `ValidationError` sale antes de tocar el límite, la traza o el
   modelo (AC-005.x, AC-009.3, AC-010.3).
2. `tracer = self.tracer or Tracer()`; `logger = self.logger or logging.getLogger(__name__)` (se resuelven ahora
   antes del límite, porque el paso 3 necesita el logger).
3. Límite, con el contador protegido (REQ-010):
   ```python
   try:
       allowed = self.rate_limiter.check_and_increment(
           f"{RATE_LIMIT_KEY_PREFIX}{user_id}", MAX_QUESTIONS_PER_WINDOW, RATE_LIMIT_WINDOW_SECONDS
       )
   except Exception as exc:
       logger.error(
           "No se pudo consultar el límite de uso de la estimación de porciones: %s",
           format_error(exc),
       )
       raise ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None
   if not allowed:
       raise RateLimitError(RATE_LIMIT_MESSAGE)
   ```
   El `try` envuelve **solo** la llamada al limitador: un error en `incr` o en `expire` (Redis caído, tiempo de espera,
   conexión rechazada) es un 503 con el mensaje fijo, sin traza ni modelo (AC-010.1, AC-010.2). El `RateLimitError`
   queda fuera del `try`. Si `incr` funcionó y falla `expire`, también es 503 (la spec dice «consultar ni
   actualizar»); en ese caso la clave puede quedar sin caducidad, riesgo aceptado (sección 6). El log usa `format_error` (tipo y mensaje, ≤ 200 caracteres, sin pila) y el
   mensaje al usuario nunca lleva `str(exc)`.
4. `trace = tracer.start_trace(TRACE_NAME, user_id=str(user_id), input=question)`.
5. `messages = [{"role": "user", "content": question}]`;
   `step = trace.start_step("generation", "generation", messages, getattr(self.llm_client, "model", None))`.
6. `try` **solo** alrededor de
   `self.llm_client.generate_structured(SYSTEM_PROMPT, messages, PORTION_TOOL, MAX_OUTPUT_TOKENS, TEMPERATURE)`;
   `except Exception as exc`: `step.fail(exc)`, `logger.error("Falló la estimación de una porción: %s",
   format_error(exc))`, score `outcome` = `error`, `trace.finish({"outcome": "error"})` y
   `raise ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None` (REQ-007, AC-009.2).
7. Fuera del `try`: `step.end(...)`, `build_estimate(result.data)`, score `outcome` con el estado, `trace.finish(<las
   cinco claves>)` y devuelve la estimación (AC-009.4: el `Tracer` está autoprotegido).

**`LLMClient.generate_structured`** (sin cambios de lógica): `messages.create` con `tools=[tool]` y
`tool_choice={"type": "tool", "name": tool["name"]}`; `refusal` o `max_tokens` → `data=None`; si no, el `input` del
primer bloque `tool_use` con ese nombre si es `dict`. F4: la anotación de retorno pasa a
`-> StructuredGenerationResult`, sin comillas.

**`LazyLLMClient`**:
- `init_app(app)`: `self.model = (app.config.get(self.model_config_key) or "").strip() or self.default_model`;
  `self.llm_client = None`.
- Se extrae un método privado `_get_client()` que crea el cliente la primera vez con
  `(self.client_factory or LLMClient)(model=self.model, timeout=self.timeout, max_retries=self.max_retries)` y lo
  devuelve. Lo usan `generate_structured` (como hoy) y el nuevo `generate_with_usage`, que delega en
  `self._get_client().generate_with_usage(system_prompt, messages, max_tokens)`.
- F2: el comentario de la clase pasa a «configuración». Los comentarios nuevos van con tildes (P2.General.1); los
  comentarios ya existentes del archivo sin tildes no se tocan (fuera de alcance, P2.General.1 solo se exige al código
  nuevo, como señala la review).

**Unificación del coach** (backlog, sin cambio de contrato):
- `extensions.py`: `coach_llm = LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)`, sin `timeout` ni
  `max_retries` (con `None` no se pasan al SDK, así que se conservan sus valores por defecto, exactamente como hoy:
  `LLMClient(model=...)` sin opciones).
- `app.py`: `coach_llm.init_app(app)`.
- `coach_routes._build_coach_service()`: `CoachService(retrieval_service, coach_llm, rate_limiter, tracer,
  feedback_signer)`; se elimina `LLMClient(model=current_app.config["ANTHROPIC_MODEL"])` y el import de `LLMClient`.
  `current_app` se sigue usando para `SECRET_KEY`.
- `CoachService` solo usa `llm_client.model` (lo expone `LazyLLMClient` tras `init_app`) y
  `llm_client.generate_with_usage(SYSTEM_PROMPT, messages)` (delegado). Su firma, su orden (límite → traza →
  embedding → retrieval → generación) y sus mensajes no cambian.
- Equivalencias y diferencias, todas fuera del uso normal:
  - El modelo sale de `ANTHROPIC_MODEL` igual que hoy. Con `ANTHROPIC_MODEL` vacía en el entorno, hoy se llamaría a
    Anthropic con un modelo vacío (503); ahora se usa `DEFAULT_ANTHROPIC_MODEL`. Mejora inocua.
  - Hoy, si `anthropic.Anthropic()` no se puede construir (falta `ANTHROPIC_API_KEY`), `_build_coach_service()` lanza
    antes del servicio y el coach responde 500 sin consumir el límite. Con el cliente perezoso, el fallo ocurre dentro
    del `try` de proveedores del servicio: 503 con el mensaje del coach, tras consumir el límite y llamar a Voyage. Es
    una mala configuración del operador, no un caso de uso, y el 503 es el que exige P3.3. Se acepta (DECISIONS).
  - El cliente HTTP de Anthropic se reutiliza entre peticiones en lugar de crearse en cada una (el SDK es seguro entre
    hilos). Sin cambio visible.
- `body_metric_routes._build_progress_analysis_service()` sigue construyendo `LLMClient` por petición: fuera del
  encargo (BACKLOG).

**Reutilización (Art. P2.5):** `LLMClient` y `LazyLLMClient` (`utils/llm_client.py`, ahora también para el coach),
`RateLimiter` (`utils/rate_limiter.py`), `Tracer` y `format_error` (`utils/tracing.py`), `is_number`,
`INVALID_REQUEST_MESSAGE`, `require_auth`, las excepciones de `exceptions/custom_exceptions.py` y el patrón de
`request.max_content_length` por petición de `analyze_photo`.

### 3.4 Interfaz de usuario

No aplica: el frontend queda fuera de alcance (feature siguiente).

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `build_estimate` y `parse_grams` (`portion_estimate_rules.py`); `_serialize_portion_estimate` (`meal_routes.py`) |
| REQ-002 | `clean_text` con `MAX_UNIT_CHARS` y `MAX_NOTE_CHARS` |
| REQ-003 | `build_estimate` con `is_food is False` → `not_food_estimate()` y `NOT_FOOD_MESSAGE` |
| REQ-004 | `build_estimate` (estructura, `is_food` no booleano, gramos no válidos) y `LLMClient.generate_structured` (`refusal`, `max_tokens`, sin bloque) → `unknown_estimate()` |
| REQ-005 | Ruta con `get_json(silent=True)` y `parse_question`, antes del límite y del modelo |
| REQ-006 | `PortionEstimateService.estimate` con `RateLimiter.check_and_increment` (10, 21.600 s, clave `ratelimit:meals:portion-estimate:<user_id>`); contadores independientes del coach, comprobados ahora también por HTTP gracias a `coach_llm` |
| REQ-007 | `try` alrededor de `generate_structured` → `ServiceUnavailableError`, `logger.error` con `format_error` |
| REQ-008 | `@require_auth` y `g.decoded_token["id"]`; el cuerpo solo se lee para `question` |
| REQ-009 | `Tracer.start_trace(TRACE_NAME, …)`, paso `generation`, `add_score("outcome", …)` y `finish` fuera del `try`; la traza se abre después de la validación, el tope de cuerpo y el límite |
| REQ-010 | `try` alrededor de `rate_limiter.check_and_increment` en `PortionEstimateService.estimate` → `ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE)`, `logger.error` con `format_error`, antes de la traza y del modelo; validación antes (AC-010.3) |
| REQ-011 | `MAX_PORTION_REQUEST_BYTES = 4096` y `request.max_content_length` en `estimate_portion`; `RequestEntityTooLarge` → `ValidationError(INVALID_REQUEST_MESSAGE)` antes de llamar al servicio; sin cambio en el límite global |
| NFR-001 | `MAX_OUTPUT_TOKENS = 150`, `TEMPERATURE = 0`; `LazyLLMClient` con `PORTION_ESTIMATE_MODEL` o `DEFAULT_PORTION_ESTIMATE_MODEL`; `timeout` 15 s y 1 reintento, que `LLMClient.__init__` pasa al SDK (probado en esta iteración, F3) |
| NFR-002 | `SYSTEM_PROMPT` constante y `messages` con un único mensaje de usuario |
| NFR-003 | El servicio no recibe repositorios ni `UnitOfWork`; no hay modelos nuevos |

## 5. Estrategia de pruebas

**Entorno:** Postgres de prueba (`TEST_DATABASE_URL`) para los tests de rutas; sin Redis, Anthropic, Voyage ni Langfuse
reales (Art. P1.4): Redis con `FakeRedisClient` en `rate_limiter.client`, el modelo con `FakeStructuredLLMClient` en
`portion_llm.llm_client` (y `FakeLLMClient` en `coach_llm.llm_client` para el coach), Voyage con `FakeVoyageClient` en
`embedding_client.client`, y las trazas con `FakeTraceBackend` en `tracer.backend` (el fixture `_reset_tracer_backend`
de `conftest.py` ya lo limpia). Sin `unittest.mock` ni `monkeypatch`. Marcadores `# SDD: 030 REQ-… AC-…`; nombres en
inglés y docstrings en español. La app de tests es de sesión: los fixtures que sustituyen clientes de los singletons
guardan el original y lo restauran, y ningún test que los use llama a `create_app` (que llamaría a `init_app` y
descartaría el doble).

**Dobles:** `FakeStructuredLLMClient` (ya existe). Nuevos en esta iteración: `raise_error` opcional en
`FakeRateLimiter` (registra la llamada y lanza) y en `FakeRedisClient` (mutable; `incr` lanza antes de contar). Para
AC-009.4 sigue el `FinishFailingBackend` del propio test. Se reutilizan `FakeLogger`, `FakeLLMClient`,
`FakeTraceBackend`, `FakeAnthropicClient`, `FakeApp`, `FakeVoyageClient` y `basis_vector`.

**Unitarios — `test_portion_estimate_rules.py`** (sin cambios salvo F5):
- Lo de la iteración 1: `parse_question` (AC-005.1 a AC-005.5) y `build_estimate` / `parse_grams` / `clean_text`
  (AC-001.1 a AC-001.4, AC-002.1 a AC-002.3, AC-003.1, AC-003.2, AC-004.1, AC-004.3).
- **F5** (`# SDD: 030 REQ-002 AC-002.1`): `test_build_estimate_truncates_a_long_note_to_100` pasa a usar una nota de
  180 caracteres cuyo carácter 100 es un espacio (p. ej. `"a" * 99 + " " + "b" * 80`) y comprueba además que
  `estimate.note == "a" * 99`: así ejercita el `rstrip()` tras recortar. Se mantienen las tres aserciones actuales.

**Unitarios — `test_portion_estimate_service.py`** (se amplía):
- Lo de la iteración 1 (AC-001.1, AC-003.1, AC-004.2, AC-005.x, AC-006.1, AC-006.2, AC-006.4, AC-007.1, AC-009.1 a
  AC-009.4, AC-N001.1, AC-N002.1, AC-N002.2) sin cambios.
- **AC-010.1:** `FakeRateLimiter(raise_error=ConnectionError("detalle-redis"))` y `{"question": "5 huevos"}` →
  `ServiceUnavailableError` con `PROVIDER_UNAVAILABLE_MESSAGE`, sin `"detalle-redis"` en el mensaje; `llm.calls == []`;
  `FakeLogger.records` tiene un registro que contiene `ConnectionError`.
- **AC-010.2:** mismo caso con `Tracer(backend=FakeTraceBackend())` → `backend.traces == []`.
- **AC-010.3:** limitador que lanza y `{"question": ""}` → `ValidationError` con `QUESTION_REQUIRED_MESSAGE` y
  `limiter.calls == []`.

**Unitarios — `test_llm_client.py`** (se amplía):
- Lo de la iteración 1 (`generate_structured` y `LazyLLMClient`, AC-N001.1, AC-N001.2, AC-004.2, AC-004.3).
- **F3** (`# SDD: 030 NFR-001 AC-N001.1`): `LLMClient(model="m", api_key="clave-de-prueba", timeout=15.0,
  max_retries=1)` construye un `anthropic.Anthropic` real (sin red: el SDK no conecta al construirse) y
  `client.client.timeout == 15.0` y `client.client.max_retries == 1`; sin esas opciones, `client.client.max_retries ==
  anthropic.DEFAULT_MAX_RETRIES` y `client.client.timeout == anthropic.DEFAULT_TIMEOUT` (los valores por defecto del
  SDK, no los de porciones). Si el SDK expone el `timeout` con otra forma, el test-author compara con la constante del
  SDK que corresponda, sin `monkeypatch`.
- **Coach perezoso** (`# SDD: 030 REQ-006 AC-006.4`): con una factoría falsa que devuelve un `FakeLLMClient`,
  `LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL, client_factory=…)` tras `init_app(FakeApp({"ANTHROPIC_MODEL":
  "claude-sonnet-5"}))` tiene `model == "claude-sonnet-5"`; `generate_with_usage("s", msgs)` crea el cliente una vez
  con `{"model": "claude-sonnet-5", "timeout": None, "max_retries": None}`, delega y devuelve su `GenerationResult`; una
  segunda llamada reutiliza el cliente.
- **Marcadores antiguos** (backlog de verify): los tests de L27, L41, L55 y L66 son de la spec 004
  (`specs/004-coach-observability/tasks.md`, T-048 y T-049). Sus marcadores pasan a `# SDD: 004 REQ-004 AC-004.1`,
  `# SDD: 004 REQ-004 AC-004.4`, `# SDD: 004 REQ-005 AC-005.3` y `# SDD: 004 REQ-004 AC-004.4`. Solo cambia el
  comentario: ni el nombre, ni el docstring, ni las aserciones.

**Integración — `test_portion_estimate_routes.py`** (se amplía; fixtures `redis_fake` y `model` ya existentes):
- Lo de la iteración 1 sin cambios.
- **AC-010.1:** `redis_fake.raise_error = ConnectionError("detalle-redis")` → 503 con
  `{"error": UNAVAILABLE}`, sin `"detalle-redis"` en el cuerpo; `model.calls == []`.
- **AC-010.3:** con Redis que lanza, `{"question": ""}` → 400 `{"error": REQUIRED}`.
- **AC-011.1:** cuerpo de exactamente 4097 bytes construido con
  `json.dumps({"question": "5 huevos", "padding": "x" * n}, separators=(",", ":"))` (se ajusta `n` y se comprueba
  `len(body.encode("utf-8")) == 4097`), enviado con `data=body, content_type="application/json"` → 400
  `{"error": INVALID}` y `model.calls == []`.
- **AC-011.2:** el mismo cuerpo con 4096 bytes → 200.
- **AC-011.3:** con 4097 bytes, `redis_fake.counts == {}` (el limitador no se consulta) y, con un `FakeTraceBackend`
  en `tracer.backend`, `backend.traces == []`.

**Integración — `test_meal_routes.py`** (se amplía, con sus helpers, su reloj fijado y su usuario):
- **AC-011.4** (`# SDD: 030 REQ-011 AC-011.4`): `POST /api/meals` con un cuerpo válido de más de 4096 bytes que crea una
  comida nueva (p. ej. 30 alimentos personalizados con nombres distintos de unos 90 caracteres; se serializa el cuerpo con
  `json.dumps`, se comprueba que `len(body.encode("utf-8")) > 4096` y se envía con `data=body,
  content_type="application/json"`) → 201. Se usan alimentos y no un campo de
  relleno porque el endpoint de comidas no está obligado a ignorar claves desconocidas.

**Integración — `test_coach_routes.py`** (se amplía; nuevo gracias a `coach_llm`):
- Fixtures en el propio archivo que instalan y restauran `FakeRedisClient` en `rate_limiter.client`,
  `FakeLLMClient(answer="Haz 3 series de 10.")` en `coach_llm.llm_client` y `FakeVoyageClient(default_vector=
  basis_vector(0))` en `embedding_client.client`; un `Video` y un `TranscriptChunk` con `embedding=basis_vector(0)`
  sembrados en la base de prueba (distancia 0, pasa el umbral), con el patrón de siembra de `test_food_routes.py`.
- **AC-006.4 por HTTP** (`# SDD: 030 REQ-006 AC-006.4`): (a) con `redis_fake.counts["ratelimit:meals:portion-estimate:
  <id>"] = 10`, `POST /api/coach/ask` → 200 con `answer == "Haz 3 series de 10."` y una llamada al `FakeLLMClient`;
  (b) con `redis_fake.counts["ratelimit:coach:ask:<id>"] = 20`, `POST /api/meals/portion-estimate` (con un
  `FakeStructuredLLMClient` en `portion_llm.llm_client`) → 200. El test de 400 actual se mantiene.
- **Regresión del coach:** toda la suite existente del coach (`test_coach_service.py`, `test_coach_observability.py`,
  `test_coach_feedback.py`, `test_coach_routes.py`, `test_coach_feedback_routes.py`) sigue en verde sin cambios; el
  `verifier` lo comprueba con la suite completa.

**Cobertura de AC:** los 35 AC de la iteración 1 siguen cubiertos por sus tests; los 7 nuevos (AC-010.1 a AC-010.3 y
AC-011.1 a AC-011.4) tienen al menos un test con marcador.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Con 150 tokens la llamada se corta (`max_tokens`) y una estimación correcta acaba en `unknown` | Baja | Medio | Instrucciones y esquema piden textos cortos; `max_tokens` → `unknown`, nunca un 500; revisable en Langfuse por `stop_reason` |
| El alias `claude-haiku-4-5` deja de existir o la cuenta no tiene acceso | Baja | Alto (todo 503) | `PORTION_ESTIMATE_MODEL` en el `backend/.env` de EC2 sin redesplegar código; prueba manual tras el CD (runbook) |
| Inyección de instrucciones en la pregunta | Media | Bajo | Instrucciones fijas en `system`, pregunta como único mensaje de usuario, herramienta forzada y saneado en el servidor |
| Latencia de Anthropic que bloquea el worker de gunicorn | Baja | Medio | `timeout` de 15 s y un reintento (peor caso ~31 s < `--timeout 90`); el límite acota el abuso |
| El tope de cuerpo no se aplica si algo lee `request.stream` antes de fijar `max_content_length` | Baja | Bajo | Se fija como primera instrucción de la ruta; `require_auth` no lee el cuerpo; AC-011.1 y AC-011.3 lo comprueban por HTTP |
| Si falla `expire` tras un `incr` correcto, la clave del contador queda sin caducidad y el usuario podría quedar bloqueado | Muy baja | Medio | Mismo comportamiento de fondo que el `RateLimiter` actual del coach y la foto; la pregunta responde 503 y el operador puede borrar la clave. Mejora del `RateLimiter` (p. ej. `SET NX EX` + `INCR` en pipeline) en el BACKLOG |
| La unificación del coach cambia el caso de mala configuración (sin `ANTHROPIC_API_KEY`): de 500 sin consumir el límite a 503 tras consumirlo | Baja | Bajo | Solo ocurre con el entorno mal configurado; el 503 es el que exige P3.3; la suite del coach debe seguir en verde |
| En tests, `coach_llm.model` lo fija el último `create_app` (p. ej. `test_production_config.py`), no la app de sesión | Media | Bajo | Ningún test nuevo depende del modelo del coach salvo el unitario con `FakeApp`; mismo comportamiento que ya tienen `portion_llm` y `vision_client` |
| Langfuse sin precio para el modelo Haiku | Media | Bajo | Añadir el precio a mano en el proyecto (paso manual, sin código) |

## 7. Cumplimiento de la constitución

- **B1 / B4 / B5:** flujo SDD completo; todos los REQ, NFR y AC (42) tienen tests en la sección 5 con marcador
  `# SDD: 030 …`; los esqueletos nuevos (`LazyLLMClient.generate_with_usage`) con `NotImplementedError("not
  implemented")`. Ningún test llama a servicios externos reales (B5.4, P1.4): el test de F3 construye el cliente del SDK
  sin hacer ninguna petición.
- **B5.3:** no se borra, salta ni debilita ningún test. F5 refuerza un test (añade una aserción y cambia el dato para
  que ejercite el caso); el cambio de marcadores de `test_llm_client.py` solo añade el número de la spec 004 (P1.1).
- **P1.3:** dobles escritos a mano (parámetros opcionales nuevos en `FakeRateLimiter` y `FakeRedisClient`) e
  inyectados por constructor o en los singletons de `extensions.py`; sin `unittest.mock` ni `monkeypatch`.
- **P2.1 / P2.2:** la ruta solo parsea (incluido el tope de tamaño, como `analyze_photo`) y serializa; la lógica vive en
  `services/`; el servicio recibe cliente, limitador, trazador y logger por constructor; los singletons `portion_llm` y
  `coach_llm` viven en `extensions.py`.
- **P2.3:** errores con `ValidationError`, `RateLimitError` y `ServiceUnavailableError`; ninguna respuesta de error
  construida a mano.
- **P2.4 / P4:** no hay cambios de modelo ni migración.
- **P2.5:** se reutilizan `LLMClient`, `LazyLLMClient`, `RateLimiter`, `Tracer` y `format_error`; la unificación del
  coach elimina una forma duplicada de construir el cliente de Anthropic.
- **P3.1:** `@require_auth` y `user_id` del token. **P3.2:** validación en el servicio y tope de cuerpo. **P3.3:** rate
  limiting en Redis; fallos del proveedor y del contador como 503 (falla cerrado). **P3.4:** no hay SQL. **P3.5 /
  B6.5:** `PORTION_ESTIMATE_MODEL` en `backend/.env.example` y `config.py` en la etapa docs; `DEFAULT_ANTHROPIC_MODEL`
  no es una variable nueva.
- **P2.General.1:** mensajes, comentarios y docstrings nuevos en español correcto (F2 corregido).
- Sin dependencias nuevas. No hay «DEBERÍA» incumplidos.

## 8. ADRs

- [ADR-0037](../../docs/sdd/decisions/ADR-0037-estimacion-de-porciones-con-salida-estructurada.md) — Estimación de
  porciones con Anthropic y herramienta forzada, modelo propio y singleton perezoso `portion_llm`; en esta iteración se
  amplía (sigue en «Propuesta») con el coach en `coach_llm`, el 503 si Redis falla y el tope de 4096 bytes solo en este
  endpoint.

## 9. Backlog de la feature: qué se corrige y cómo

| Punto | Tipo | Tratamiento en este plan |
|---|---|---|
| Unificar el `LLMClient` del coach con el patrón perezoso | Código y tests | `coach_llm` (3.2, 3.3); tests de `LazyLLMClient.generate_with_usage` y de `/api/coach/ask` hasta el 200 (5) |
| Precio de Haiku en Langfuse | Manual | Sin código: paso manual que la etapa docs deja en el runbook |
| Documentar `PORTION_ESTIMATE_MODEL` | Docs | Etapa docs (`backend/.env.example`, `docs/deploy-runbook.md`) |
| `cat >>` del test-author / F1 | Proceso | Sin código: se informa en el gate |
| E501 en `test_portion_estimate_rules.py` | Tests | Ya corregido en `c09c6b1` |
| Marcadores sin número en `test_llm_client.py` (L27, L41, L55, L66) | Tests | Se añaden `004` (5) |
| F2 «configuracion» | Código | Comentario corregido (3.3) |
| F3 timeout y max_retries al SDK | Tests | Test nuevo en `test_llm_client.py` (5) |
| F4 anotación entre comillas | Código | `-> StructuredGenerationResult` (3.2) |
| F5 `rstrip` de la nota | Tests | Dato y aserción del test reforzados (5) |
| F6 tamaño del cuerpo | Código y tests | Resuelto por REQ-011 (3.3, 5) |
| Comportamiento si Redis falla | Código y tests | REQ-010 (3.3, 5) |
| Aceptar ADR-0037 | Proceso | Sesión principal, con el usuario (P5.2) |
