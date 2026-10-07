# Plan 004 — Observabilidad del coach de IA con Langfuse Cloud

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-07)

## 1. Resumen de la solución
`CoachService` abre una traza por pregunta a través de un puerto propio, el singleton `tracer` (`Tracer`, en `extensions.py`). Sobre esa traza abre y cierra **en vivo** los pasos `embedding`, `retrieval` y `generation`, y añade las puntuaciones `outcome` y `best_chunk_distance`. El `Tracer` delega en un **backend de trazas**. En producción es `LangfuseTraceBackend`, que traduce cada llamada a la API pública del **SDK oficial `langfuse` (`>=4.17,<5`, la versión cuyas firmas se verificaron)**. Ese SDK mide las horas de inicio y fin al abrir y cerrar cada observación, las encola en memoria y las exporta en su propio hilo al endpoint OpenTelemetry de Langfuse (ADR-0017). Todo lo que devuelve el `Tracer` va envuelto en un recorder **autoprotegido**: cualquier excepción del backend se registra una vez como aviso y deja la traza inerte, así que la respuesta del coach nunca cambia. Sin las dos claves de Langfuse, o con la configuración de tests, el `tracer` queda inactivo, devuelve un recorder nulo y no se importa ni se construye el SDK. `RetrievalService`, `EmbeddingClient` y `LLMClient` exponen métodos nuevos (candidatos sin filtrar y tokens) sin cambiar los que ya existen.

Solo cambia el backend. Se añade una dependencia (`langfuse`). No hay migración. El contrato de `POST /api/coach/ask` no cambia.

**Cambios respecto a la iteración 2** (firmas reales del SDK 4.17):
- Desaparece `update_trace`, que no existe en la v4. El usuario y el nombre de la traza se fijan con `propagate_attributes(user_id=…, trace_name=…)`. Para no filtrar contexto OTel entre peticiones, ese gestor de contexto se abre y se cierra **dentro de cada llamada del adaptador** que crea una observación (sección 3.2, "Aislamiento del contexto").
- La entrada y la salida de la traza son las de la observación raíz `coach-ask`. No se usa `set_trace_io`, que está *deprecated*.
- El constructor recibe `base_url` en lugar de `host`, también *deprecated*. La variable de entorno pasa a llamarse `LANGFUSE_BASE_URL`, el mismo nombre que usa el SDK.
- El mínimo de la dependencia sube a 4.17, que es la versión verificada.

**Horas explícitas:** el diseño no las necesita. `start_observation` no admite hora de inicio, y cada observación se abre y se cierra en el momento real de la fase.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | No hay cambios de datos. |
| backend · repositories | — | — | `TranscriptChunkRepository.find_similar` ya devuelve `(chunk, video_title, distance)` sin filtrar y se reutiliza tal cual. |
| backend · services | — | `backend/services/coach_service.py`, `backend/services/retrieval_service.py` | Instrumentación por fases y clasificación del resultado en `CoachService`. `RetrievalService` separa embedding, candidatos y umbral. |
| backend · utils | `backend/utils/tracing.py`, `backend/utils/langfuse_backend.py` | `backend/utils/embeddings.py`, `backend/utils/llm_client.py` | Puerto de trazas (`Tracer`, recorder autoprotegido y recorder nulo) y adaptador del SDK. Métodos con uso de tokens en los clientes de Voyage y Claude. |
| backend · routes | — | `backend/routes/coach_routes.py` | `_build_coach_service()` inyecta el singleton `tracer`. |
| backend · app / config / deps | — | `backend/extensions.py`, `backend/app.py`, `backend/config.py`, `backend/.env.example`, `backend/requirements.txt` | Singleton `tracer` con `tracer.init_app(app)`. Variables `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` y `LANGFUSE_BASE_URL`, y `OBSERVABILITY_ENVIRONMENT` por entorno. Dependencia `langfuse>=4.17,<5`. |
| backend · tests | `backend/tests/test_services/test_coach_observability.py`, `backend/tests/test_services/test_tracer.py`, `backend/tests/test_services/test_langfuse_backend.py`, `backend/tests/test_services/test_observability_config.py`, `backend/tests/test_routes/test_coach_routes.py` | `backend/tests/fakes.py`, `backend/tests/conftest.py`, `backend/tests/test_services/test_coach_service.py` (solo para ampliar su `FakeRetrievalService`) | Ver la sección 5. |
| frontend | — | — | Fuera de alcance. |

## 3. Diseño
### 3.1 Modelo de datos y migraciones
No aplica. No hay tablas ni columnas nuevas, y no hace falta migración.

### 3.2 Contratos de API
El endpoint no cambia (spec, sección 6):

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `/api/coach/ask` | `@require_auth` (sin cambios) | `{"question": str, "history"?: [{"role","content"}]}` (sin cambios) | `200 {"answer": str}` (sin cambios) | `400`, `401`, `429` y `503`, con los mensajes actuales |

**Contrato saliente (backend → Langfuse).** Lo gestiona por completo el SDK `langfuse`, y fitnerd no construye peticiones HTTP a Langfuse:
- **Observaciones:** exportación OTLP/HTTP a `{LANGFUSE_BASE_URL}/api/public/otel/v1/traces` con el procesador por lotes de OpenTelemetry, en su hilo.
- **Puntuaciones:** las encola `score_trace` con `put(block=False)` en una cola en memoria. Un hilo del SDK las envía como eventos `score-create` a `{LANGFUSE_BASE_URL}/api/public/ingestion` (verificado en `_task_manager/score_ingestion_consumer.py` y `_utils/request.py` de la 4.17). Ver el riesgo de la sección 6.
- **Autenticación:** con la clave pública y la secreta, que solo recibe el constructor.

**Correspondencia entre la spec (sección 6) y el SDK 4.17.** Solo la usa `LangfuseTraceBackend`, y solo con API pública verificada. `scope` es `propagate_attributes(user_id="42", trace_name="coach-ask")` (`from langfuse import propagate_attributes`).

| Spec | Llamada al SDK |
|---|---|
| Traza `coach-ask`, usuario y entrada | `with scope: root = client.start_observation(name="coach-ask", as_type="span", input=question)`. El procesador de spans del SDK copia `user_id` y `trace_name` del contexto a la raíz al crearla. La entrada de la traza es la de la raíz. |
| Entorno | Parámetro `environment` del constructor (`production` o `development`). El SDK lo aplica a las observaciones, y `score_trace` lo hereda del cliente. No se repite en `propagate_attributes`. |
| Paso `embedding` | `with scope: obs = root.start_observation(name="embedding", as_type="generation", input=query, model=embedding_model)`. Al cerrar, `obs.update(usage_details={"input": n})` (solo si hay tokens) y `obs.end()`. |
| Paso `retrieval` | `with scope: obs = root.start_observation(name="retrieval", as_type="span", input={"limit", "threshold"})`. Al cerrar, `obs.update(output={"candidates": […], "passed_count": n})` y `obs.end()`. |
| Paso `generation` | `with scope: obs = root.start_observation(name="generation", as_type="generation", input=messages, model=llm_model)`. Al cerrar, `obs.update(output=texto, usage_details={"input": n, "output": m})` y `obs.end()`. Langfuse calcula el coste a partir de `model` y `usage_details`. |
| Error de un paso | `obs.update(level="ERROR", status_message=format_error(exc))` y `obs.end()`. |
| Puntuaciones | `root.score_trace(name="outcome", value="answered", data_type="CATEGORICAL")` y `root.score_trace(name="best_chunk_distance", value=0.35, data_type="NUMERIC")`. |
| Salida y cierre | `root.update(output=texto)` y `root.end()`. La salida de la traza es la de la raíz. |

No se usan `update_trace` (no existe en la v4) ni `set_trace_io` o `set_current_trace_io` (*deprecated*).

**Aislamiento del contexto (decisión de diseño).** `propagate_attributes` adjunta un contexto OTel al hilo actual y lo desadjunta al salir del `with`. Sus atributos solo llegan a las observaciones **creadas** mientras el contexto está activo, porque el procesador de spans del SDK los lee del contexto en `on_start`. Por eso:
1. La raíz se crea con `client.start_observation` y los pasos con `root.start_observation`. Ninguno se convierte en la observación "actual" del hilo, y no se usa `start_as_current_observation`.
2. Cada llamada del adaptador que crea una observación (`start_trace` y `start_step`) envuelve **solo** esa creación en un `with propagate_attributes(user_id=…, trace_name="coach-ask")` propio. Todas las observaciones de la traza (raíz y pasos) llevan así `user_id` y `trace_name`, como recomienda el SDK para las agregaciones por usuario.
3. El contexto se abre y se cierra dentro de la misma llamada síncrona y en el mismo hilo. Nunca queda adjunto entre dos llamadas del puerto ni entre dos peticiones del mismo hilo de gunicorn, aunque la petición termine con una excepción: el `with` lo desadjunta siempre.
4. `update`, `score_trace` y `end` no necesitan el contexto. `score_trace` usa el `trace_id` de la raíz y el entorno del cliente.

Se descartó abrir un único `propagate_attributes` en `start_trace` y cerrarlo en `finish`. Ese contexto quedaría adjunto al hilo entre llamadas, y si `finish` no llegara a ejecutarse se filtraría a la siguiente petición servida por ese hilo.

**Verificación de la API del SDK:** el orquestador ya verificó en el código fuente de `langfuse` 4.17.0 estas firmas: el constructor con `base_url` y `environment`, `start_observation` del cliente y de la observación, `update`, `end`, `score_trace` y `propagate_attributes` (tabla de "Comentarios del usuario"). El planner comprobó además en ese mismo código:
- que los pasos se crean con `use_span(root)`, encima del contexto actual, y que el procesador aplica los atributos propagados en `on_start` (`_client/span.py` y `_client/span_processor.py`);
- que `propagate_attributes` valida `user_id` y `trace_name` (texto ASCII de 200 caracteres como máximo) y no lanza: si un valor no es válido, lo descarta con un aviso del SDK.

El implementer no tiene que repetir la verificación. Si la versión instalada es otra 4.x y algún nombre difiere, solo cambian `backend/utils/langfuse_backend.py` y su `FakeLangfuseClient`.

### 3.3 Lógica de negocio

**Dependencia (`backend/requirements.txt`)**
- Se añade `langfuse>=4.17,<5`:
  - el mínimo es la versión cuyas firmas se verificaron (`propagate_attributes` con `trace_name`, `base_url`, exportación OTel por defecto);
  - el techo `<5` evita romper el adaptador con un cambio de versión mayor, por ejemplo cuando se retire `set_trace_io`, que este diseño no usa.

  Es la primera dependencia con versión acotada del archivo. El resto sigue igual (fuera de alcance).
- Dependencias transitivas de la 4.17.0: `httpx`, `pydantic>=2`, `backoff`, `wrapt`, `packaging`, `opentelemetry-api`, `opentelemetry-sdk` y `opentelemetry-exporter-otlp-proto-http` (>=1.45). Requiere Python >=3.10, y el proyecto usa 3.13.
- El paquete solo se importa de forma **perezosa**, dentro de las funciones por defecto del adaptador (`_default_client_factory` y `_default_propagate_attributes`). Ni la suite de tests ni un entorno sin claves lo importan.

**Configuración (`backend/config.py`)**
- `DEFAULT_LANGFUSE_BASE_URL = "https://us.cloud.langfuse.com"` y una función pura `resolve_langfuse_base_url(value: str | None) -> str`:
  - si el valor es `None` o vacío, devuelve la URL por defecto;
  - si no, devuelve el valor sin la `/` final.
- En `Config`:
  - `LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY") or None`;
  - `LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY") or None`;
  - `LANGFUSE_BASE_URL = resolve_langfuse_base_url(os.getenv("LANGFUSE_BASE_URL"))`;
  - `OBSERVABILITY_ENVIRONMENT = "development"`.
- `ProductionConfig.OBSERVABILITY_ENVIRONMENT = "production"`. `DevelopmentConfig` hereda `"development"`, y `default` apunta a `DevelopmentConfig`.
- `TestingConfig`:
  - `LANGFUSE_PUBLIC_KEY = None` y `LANGFUSE_SECRET_KEY = None`, fijos en el código, sin leer el entorno;
  - `OBSERVABILITY_ENVIRONMENT = "testing"` (nunca se envía).
- Función pura `observability_enabled(config: Mapping) -> bool`: devuelve `True` solo si ambas claves tienen valor y `config.get("TESTING")` no es verdadero.
- El SDK también lee `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` y `LANGFUSE_TRACING_ENVIRONMENT` del entorno. Para que no haya dos fuentes de verdad, el adaptador pasa siempre los valores **explícitos** de `app.config` al constructor, y los explícitos tienen prioridad en el SDK. Los nombres de fitnerd coinciden con los del SDK, así que no hay dos variables distintas para lo mismo. `LANGFUSE_HOST` no se usa porque está *deprecated*.

**Puerto de trazas (`backend/utils/tracing.py`)**, sin dependencias externas:
- `format_error(exc) -> str`: devuelve `f"{type(exc).__name__}: {exc}"[:200]`. Nunca incluye la traza de pila (REQ-007).
- Interfaz del backend, documentada con `typing.Protocol`, que implementan `LangfuseTraceBackend` y `FakeTraceBackend`:
  - `TraceBackend.start_trace(name, user_id, input) -> BackendTrace`;
  - `BackendTrace.start_step(name, kind, input, model=None) -> BackendStep`, con `kind` igual a `"span"` o `"generation"`;
  - `BackendTrace.add_score(name, value, data_type)`, con `data_type` igual a `"CATEGORICAL"` o `"NUMERIC"`;
  - `BackendTrace.finish(output)`;
  - `BackendStep.end(output=None, usage=None)`, donde `usage` es `{"input": n}` o `{"input": n, "output": m}`;
  - `BackendStep.fail(message: str)`.
- `SafeTraceRecorder(backend_trace, logger)` y `SafeStepHandle`: lo que recibe el servicio. Tienen la misma interfaz, salvo que `StepHandle.fail(exc)` recibe la excepción y la formatea con `format_error`.
  - Cada método captura `Exception`.
  - El **primer** fallo registra `logger.warning("No se pudo enviar la traza del coach a Langfuse: %s", type(exc).__name__)`. Solo se registra el nombre del tipo, nunca el mensaje, para no volcar credenciales (AC-008.5).
  - Después del primer fallo, la traza queda **inerte**: los pasos abiertos y las llamadas siguientes no hacen nada.
  - **Nunca lanza.**
- `NullTraceRecorder` y `NullStepHandle`: la misma interfaz, sin efectos.
- `Tracer`, el singleton de `extensions.py`:
  - `__init__(backend=None, logger=None, client_factory=None, propagate_attributes=None)`. Los dos últimos son opcionales y se reenvían al adaptador. Si no se pasan, el adaptador usa sus funciones por defecto, que importan `langfuse` de forma perezosa;
  - `enabled` es una propiedad: `backend is not None`;
  - `init_app(app)`:
    - si `observability_enabled(app.config)`, crea `LangfuseTraceBackend(public_key, secret_key, base_url=LANGFUSE_BASE_URL, environment=OBSERVABILITY_ENVIRONMENT, client_factory=self.client_factory, propagate_attributes=self.propagate_attributes)`;
    - si no, deja `backend = None`. No registra nada, ni al arrancar ni en cada pregunta (AC-009.1);
    - usa `app.logger` como logger si no se inyectó otro;
  - `start_trace(name, user_id, input) -> SafeTraceRecorder | NullTraceRecorder`:
    - si está inactivo, devuelve el nulo;
    - si no, llama a `backend.start_trace(...)` dentro de `try/except Exception`. Si falla, escribe el mismo aviso y devuelve el nulo;
    - **nunca lanza**.
  - No hay cola ni hilo propios. No llama a `flush()` ni a `shutdown()` del SDK en ninguna petición: la exportación es asíncrona dentro del SDK (NFR-002). El SDK registra su propio vaciado al terminar el proceso con `atexit` (mejor esfuerzo, Q10).

**Adaptador del SDK (`backend/utils/langfuse_backend.py`)**
- `LangfuseTraceBackend(public_key, secret_key, base_url, environment, client_factory=None, propagate_attributes=None)`:
  - el cliente se crea de forma **perezosa** en el primer `start_trace` del proceso, protegido por un `threading.Lock`. Como gunicorn crea la app en cada worker (sin `--preload`, ver `backend/Dockerfile`), los hilos del SDK nacen dentro del proceso que los usa y no se pierden en un `fork`;
  - `client_factory(public_key=…, secret_key=…, base_url=…, environment=…)` devuelve el cliente. La función por defecto, `_default_client_factory`, hace `from langfuse import Langfuse` dentro de la función y construye `Langfuse(public_key=…, secret_key=…, base_url=…, environment=…)`;
  - `propagate_attributes(**kwargs)` devuelve un gestor de contexto. La función por defecto, `_default_propagate_attributes`, hace `from langfuse import propagate_attributes` dentro de la función y lo llama con los mismos kwargs;
  - si alguna de las dos lanza, por ejemplo porque el paquete no está instalado, la excepción sube a `Tracer.start_trace`, que la convierte en aviso y en un recorder nulo.
- `start_trace(name, user_id, input)`:
  1. obtiene el cliente;
  2. guarda `user_id` y `name` para los pasos;
  3. dentro de `with self._propagate_attributes(user_id=user_id, trace_name=name):` crea la raíz con `client.start_observation(name=name, as_type="span", input=input)`;
  4. devuelve un `_LangfuseTrace` que envuelve la raíz.
- `_LangfuseTrace.start_step(name, kind, input, model)`:
  - dentro de un `with` igual al anterior, crea el paso con `root.start_observation(name=…, as_type=…, input=…, model=…)`. `model` solo se pasa si no es `None`;
  - `kind="generation"` se traduce a `as_type="generation"` y `kind="span"` a `as_type="span"`;
  - devuelve un `_LangfuseStep`.
- `_LangfuseStep.end(output, usage)`: `obs.update(...)` solo con los campos que no son `None` (`output` y `usage_details=usage`), y después `obs.end()`.
- `_LangfuseStep.fail(message)`: `obs.update(level="ERROR", status_message=message)` y `obs.end()`.
- `_LangfuseTrace.add_score(name, value, data_type)`: `root.score_trace(name=…, value=…, data_type=…)`.
- `_LangfuseTrace.finish(output)`: `root.update(output=output)` y `root.end()`.
- Solo pasa al SDK los campos que recibe del servicio. Las claves solo llegan al constructor del cliente (NFR-001).

**Clientes de proveedores (sin romper a quien los usa hoy)**
- `EmbeddingClient.embed_query_with_usage(text) -> tuple[list[float], int | None]`. Devuelve `result.embeddings[0]` y `getattr(result, "total_tokens", None)`. `embed_query` no cambia.
- `LLMClient`:
  - dataclass `GenerationResult(text: str | None, input_tokens: int | None, output_tokens: int | None)`;
  - `generate_with_usage(system_prompt, messages, max_tokens=2048) -> GenerationResult`. Lee `response.usage.input_tokens` y `response.usage.output_tokens`. Con `stop_reason == "refusal"`, devuelve `text=None` y los tokens;
  - `generate()` pasa a delegar en él y devolver `.text`, con el mismo comportamiento. `ProgressAnalysisService` no cambia.

**`RetrievalService` (`backend/services/retrieval_service.py`)**
- Constante `DEFAULT_TOP_K = 5`. `max_distance` se mantiene (0,7).
- Propiedad `embedding_model -> str | None`, que devuelve `embedding_client.model`.
- `embed(text) -> tuple[list[float], int | None]`, que delega en `embed_query_with_usage`.
- `find_candidates(vector, top_k=DEFAULT_TOP_K) -> list[dict]`: todos los resultados de `find_similar` como `{"video_title", "chunk_text", "distance"}`, sin filtrar y en el orden del repositorio.
- `is_relevant(candidate) -> bool`: `distance <= max_distance`, la misma regla que hoy (`> max_distance` se descarta).
- `search()` se mantiene, compuesto con los tres métodos anteriores, con idéntico resultado.

**`CoachService` (`backend/services/coach_service.py`)**
- Constructor: `CoachService(retrieval_service, llm_client, rate_limiter, tracer: Tracer | None = None)`. Con `None` usa `Tracer()` (inactivo), así que las llamadas actuales de 3 argumentos siguen valiendo. Los mensajes y excepciones actuales no cambian. El servicio solo conoce el puerto (`utils/tracing.py`), nunca el SDK.
- Flujo de `ask(question, user_id, history)`:
  1. **Límite de uso.** Igual que hoy y **antes** de abrir la traza: un `429` no genera traza (AC-001.4).
  2. **Apertura de la traza.** `trace = self.tracer.start_trace("coach-ask", user_id=str(user_id), input=question)`.
  3. Dentro del mismo `try` de proveedores de hoy:
     - **Embedding.** `query = _build_retrieval_query(...)`. Se abre el paso `embedding` (`kind="generation"`, `input=query`, `model=retrieval_service.embedding_model`), se llama a `retrieval_service.embed(query)` y se cierra con `usage={"input": tokens}` si `tokens` no es `None`. Si falla, `fail(exc)` y se relanza.
     - **Recuperación.** Se abre el paso `retrieval` (`kind="span"`, `input={"limit": DEFAULT_TOP_K, "threshold": retrieval_service.max_distance}`) y se llama a `find_candidates`. Se cierra con `output={"candidates": [{"video_title", "chunk_text", "distance", "passed_threshold"}…], "passed_count": n}`. Si hay candidatos, se añade la puntuación `best_chunk_distance` (`NUMERIC`), con el mínimo de las distancias. Si falla, `fail(exc)` y se relanza.
     - **Sin relevantes.** Si ningún candidato es relevante, `outcome = "dont_know"` y la respuesta es el mensaje fijo actual. No hay paso `generation`.
     - **Generación.** Se construyen `messages`, igual que hoy. Se abre el paso `generation` (`kind="generation"`, `input=messages`, sin el system prompt, `model=llm_client.model`) y se llama a `llm_client.generate_with_usage(SYSTEM_PROMPT, messages)`. Se cierra con `output=result.text or ""` y `usage={"input": …, "output": …}`. Si falla, `fail(exc)` y se relanza.
  4. **Fallo de proveedor** (`except Exception`). `logger.exception(...)` como hoy, `add_score("outcome", "error", "CATEGORICAL")` y `trace.finish("")`. Después, el mismo `ServiceUnavailableError` de hoy.
  5. **Fin normal.** Si `result.text is None`, `outcome = "refused"` y la respuesta es el mensaje actual de rechazo. Si no, `outcome = "answered"`. Se añade `outcome` (`CATEGORICAL`) y se llama a `trace.finish(respuesta)`. Se devuelve la respuesta.
- Las llamadas al recorder pueden estar dentro del `try` de proveedores, porque `SafeTraceRecorder` y `NullTraceRecorder` nunca lanzan. Aun así, `finish` y `add_score` del final se hacen **fuera** del `try` para que, ni en teoría, un fallo de instrumentación se convierta en un `503` (REQ-008).

**Ruta (`backend/routes/coach_routes.py`)**
- `_build_coach_service()` pasa `tracer` (importado de `extensions`) como cuarto argumento. La validación (`400`) sigue ocurriendo antes de construir el servicio, así que no hay traza (AC-001.3).
- El servicio solo recibe `g.decoded_token["id"]`: email, nombre y JWT nunca llegan a la traza (NFR-001).

**App (`backend/app.py` y `backend/extensions.py`)**
- `tracer = Tracer()` en `extensions.py`.
- `tracer.init_app(app)` en `create_app()`, junto a las demás extensiones.

**`.env.example`**
- Documenta `LANGFUSE_PUBLIC_KEY` y `LANGFUSE_SECRET_KEY`; sin las dos claves no se envía nada.
- Documenta `LANGFUSE_BASE_URL`, que es opcional y vale `https://us.cloud.langfuse.com` por defecto.

### 3.4 Frontend
No aplica. La feature es solo de backend (fuera de alcance según la spec, sección 3).

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `CoachService.ask`: `start_trace("coach-ask", str(user_id), question)` después del límite de uso, y `finish(output)` con el texto exacto devuelto. `LangfuseTraceBackend`: raíz `coach-ask` con `input=question` creada dentro de `propagate_attributes(user_id, trace_name)`, y `root.update(output)` al cerrar. La entrada y la salida de la traza son las de la raíz. La ruta valida antes de construir el servicio (`400` sin traza). |
| REQ-002 | `CoachService.ask`, paso `embedding`, con `RetrievalService.embed`, `embedding_model` y `EmbeddingClient.embed_query_with_usage` (tokens). La duración la mide el SDK al abrir y cerrar la observación. |
| REQ-003 | `RetrievalService.find_candidates` e `is_relevant`. Paso `retrieval` con `input {limit, threshold}` y `output {candidates[…passed_threshold], passed_count}`. |
| REQ-004 | `LLMClient.generate_with_usage` y `GenerationResult`. Paso `generation` (`as_type="generation"`) con `messages` sin el system prompt, `model`, `usage_details` y salida (`""` si hay rechazo). El coste lo calcula Langfuse. |
| REQ-005 | `CoachService.ask`: puntuación `outcome` (`answered`, `dont_know`, `refused` o `error`), que se traduce a `root.score_trace(..., data_type="CATEGORICAL")`. |
| REQ-006 | `CoachService.ask`: `best_chunk_distance = min(distance)` solo si hay candidatos (`NUMERIC`). |
| REQ-007 | `SafeStepHandle.fail(exc)` con `format_error` (tipo y mensaje, 200 caracteres como máximo, sin pila), que se traduce a `level="ERROR"` y `status_message`. Se relanza para cortar los pasos posteriores. La traza se cierra con `output=""` y `outcome=error`. Se mantiene el `503` actual. |
| REQ-008 | `SafeTraceRecorder` y `Tracer.start_trace`, que nunca lanzan y avisan una sola vez por traza. `finish` y `add_score` finales fuera del `try` de proveedores. Con el tracer inactivo, `NullTraceRecorder` y ninguna llamada al backend. El `with propagate_attributes` desadjunta el contexto aunque la creación de la observación lance. |
| REQ-009 | `config.py` (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `resolve_langfuse_base_url` y `observability_enabled`; `TestingConfig` con claves `None`) y `Tracer.init_app`. El SDK ni se importa si está inactivo. |
| REQ-010 | `OBSERVABILITY_ENVIRONMENT` por clase de configuración. `Tracer.init_app` lo pasa a `LangfuseTraceBackend`, que lo pasa como `environment` al constructor del cliente. Las observaciones y las puntuaciones heredan ese entorno. |
| NFR-001 | `user_id` solo como texto. La ruta solo pasa `id`. El adaptador solo envía al SDK los campos del servicio (más `trace_name`), y las claves solo van al constructor del cliente. `propagate_attributes` se llama sin `as_baggage`, así que `user_id` no viaja en cabeceras HTTP salientes. El aviso de log solo incluye el nombre del tipo de excepción. |
| NFR-002 | El servicio solo hace llamadas en memoria al SDK (`propagate_attributes`, `start_observation`, `update`, `score_trace` con `put(block=False)` y `end`). La exportación por red ocurre en los hilos del SDK, y fitnerd nunca llama a `flush()` ni a `shutdown()` en una petición. Entrega de mejor esfuerzo. |
| NFR-003 | Backend sustituible: `Tracer(backend=FakeTraceBackend())` en unitarios y `tracer.backend = …` en rutas. Cliente del SDK y `propagate_attributes` sustituibles con `client_factory` y `propagate_attributes` (`FakeLangfuseClient`). `TestingConfig` sin claves. |

## 5. Estrategia de pruebas

**Fakes nuevos o ampliados en `backend/tests/fakes.py`**
- `FakeTraceBackend(clock=None, raise_error=None)`: implementa el puerto y registra en memoria.
  - `traces` es una lista de `RecordedTrace`, con `name`, `user_id`, `input`, `output`, `finished`, `steps` y `scores`.
  - Cada `RecordedStep` guarda `name`, `kind`, `input`, `model`, `output`, `usage`, `error`, `start_time` y `end_time`. Las horas las pone `clock`, un `FakeClock`, o `datetime.now(timezone.utc)` si no se inyecta.
  - Cada `RecordedScore` guarda `name`, `value` y `data_type`.
  - Si `raise_error` tiene valor, **todas** sus operaciones lo lanzan (`start_trace` incluido). Así se simula "un destino que lanza un error en cada envío".
- `FakeLangfuseClient(raise_error=None, flush_delay_seconds=0)`: imita **solo** la API pública del SDK 4.17 que usa el adaptador.
  - `start_observation(**kwargs)` devuelve un `FakeLangfuseObservation`. Cada creación guarda una copia de `active_attributes` en el momento de crearse, igual que hace el procesador de spans del SDK en `on_start`.
  - `FakeLangfuseObservation` solo implementa `start_observation`, `update`, `score_trace` y `end`. A propósito **no** tiene `update_trace` ni `set_trace_io`: si el adaptador los llamara, el test fallaría con `AttributeError`.
  - `propagate_attributes(**kwargs)` es un método que devuelve un gestor de contexto. Al entrar, fija `active_attributes` con los kwargs; al salir, restaura el valor anterior, también si dentro se lanza una excepción. Registra la entrada y la salida en `calls`.
  - Cada llamada se registra en `client.calls` como `(objeto, método, kwargs)`, en orden.
  - `flush()` y `shutdown()` representan la exportación por red. Esperan `flush_delay_seconds` (con `threading.Event().wait`) y cuentan en `flush_calls`.
  - Con `raise_error`, todas las llamadas lo lanzan.
- `FakeLangfuseClientFactory(client)`: invocable. Guarda los kwargs con los que se construye el cliente (`public_key`, `secret_key`, `base_url` y `environment`) y devuelve `client`.
- Los tests del adaptador construyen `LangfuseTraceBackend(..., client_factory=FakeLangfuseClientFactory(fake), propagate_attributes=fake.propagate_attributes)`.
- `FakeLLMClient`, ampliado sin romper sus usos actuales:
  - parámetros `input_tokens=0`, `output_tokens=0` y `model="fake-model"`;
  - método `generate_with_usage(system_prompt, messages, max_tokens=2048)`, que registra en `calls` igual que `generate` y devuelve `GenerationResult(answer, input_tokens, output_tokens)`, o lanza `raise_error`. `answer=None` simula el rechazo.
- `FakeApp(config: dict)`, con `.config` y `.logger` (`FakeLogger`), para probar `Tracer.init_app` sin crear la app.
- `FakeRetrievalService` vive en `test_coach_service.py`. Se amplía con:
  - `embedding_model` y `max_distance`;
  - `embed(text)`, que registra la llamada y devuelve `([0.0], tokens)` o lanza `embed_error`;
  - `find_candidates(vector, top_k)`, que devuelve `candidates` o lanza `search_error`;
  - `is_relevant`, que devuelve `distance <= max_distance`.

  Los tests existentes conservan sus aserciones. Su constructor actual `chunks=[{"chunk_text": …}]` se traduce a candidatos con `distance` 0,1 y `video_title`. Los tests nuevos usan su propio fake, en `test_coach_observability.py` o compartido en `fakes.py`, a elección del test-author.

**Unitarios de servicio** (`test_services/test_coach_observability.py`). Se construye `CoachService(FakeRetrievalService, FakeLLMClient, FakeRateLimiter, Tracer(backend=FakeTraceBackend(clock=FakeClock(…)), logger=FakeLogger()))`, se llama a `ask` y se afirma sobre `backend.traces[i]`. No hace falta esperar: el registro es síncrono.
- AC-001.1 y AC-001.2: nombre, entrada, salida, `user_id == "42"` y `finished`; dos preguntas generan dos `RecordedTrace`.
- AC-001.4: con `FakeRateLimiter(allowed=False)` se lanza `RateLimitError` y `traces == []`.
- AC-002.1 a AC-002.3: paso `embedding`, con `input`, `model`, `start_time`/`end_time` y `usage == {"input": 12}`.
- AC-003.1 a AC-003.3: paso `retrieval`, con `input` (`limit` 5, `threshold` 0,7), `candidates` y `passed_threshold`, y `passed_count`.
- AC-004.1 a AC-004.4: paso `generation`, con `model == "claude-sonnet-5"` (pasado al `FakeLLMClient`), `usage == {"input": 850, "output": 40}` y horas. Con historial, el orden de `messages` y sin `SYSTEM_PROMPT`. Sin `generation` en `dont_know`. Con rechazo, salida `""` y tokens.
- AC-005.1 a AC-005.4: `outcome`.
- AC-006.1 a AC-006.4: `best_chunk_distance`.
- AC-007.1 a AC-007.3: paso con `error` que contiene el tipo y "overloaded", recortado a ≤200 caracteres y sin `"Traceback"`; pasos posteriores ausentes; `ServiceUnavailableError` con el mensaje exacto.
- AC-008.1: `Tracer()` inactivo y un `FakeTraceBackend` aparte que no se conecta. La respuesta es la de hoy y `traces` está vacío. Como variante, comprobar que `Tracer().start_trace(...)` devuelve un `NullTraceRecorder`.
- AC-008.2 a AC-008.4: `FakeTraceBackend(raise_error=RuntimeError("secreto-sk-lf-123"))`, con el mismo retorno o excepción que sin observabilidad.
- AC-008.5: con el mismo fake, el `FakeLogger` del `Tracer` tiene un aviso con "traza del coach", y ese aviso no contiene `"secreto-sk-lf-123"` ni los valores de las claves.
- AC-009.1: `Tracer()` inactivo con `FakeLogger`. Tras varias preguntas, `records == []`.
- AC-010.1 y AC-010.2: a nivel de `init_app` y adaptador (ver más abajo).
- AC-N001.1: `user_id=42`; serializar el `RecordedTrace` con `json.dumps(dataclasses.asdict(...), default=str)` y afirmar que no contiene el email, el nombre ni un JWT de ejemplo, y que `user_id == "42"`.
- AC-N001.2 (servicio): la traza no contiene claves de proveedores conocidas, ni en una pregunta correcta ni con un fallo de proveedor cuyo mensaje no las incluye. El caso de las claves de Langfuse está en el test del adaptador.
- AC-N002.1: `Tracer(backend=LangfuseTraceBackend(..., client_factory=FakeLangfuseClientFactory(fake), propagate_attributes=fake.propagate_attributes))`, con `fake = FakeLangfuseClient(flush_delay_seconds=3)`. Con `ask` medido con `time.perf_counter()`, la respuesta tarda < 0,5 s y `flush_calls == 0`: la petición nunca espera a la exportación.
- AC-N002.2: `FakeTraceBackend(raise_error=…)` y `FakeLangfuseClient(raise_error=…)`, con `ask` < 0,5 s.

**Unitarios del puerto** (`test_services/test_tracer.py`). Cubren REQ-007, REQ-008 y REQ-009:
- `SafeTraceRecorder` no propaga errores de `start_step`, `end`, `fail`, `add_score` ni `finish`;
- avisa **una sola vez** por traza y después queda inerte;
- `Tracer.start_trace` devuelve el nulo si el backend falla al abrir;
- `format_error` recorta y no incluye la pila;
- `NullTraceRecorder` no tiene efectos;
- AC-009.2: `Tracer(client_factory=FakeLangfuseClientFactory(fake), propagate_attributes=fake.propagate_attributes).init_app(FakeApp({ambas claves, "TESTING": False, ...}))` deja `enabled` verdadero y el backend es un `LangfuseTraceBackend`. El cliente **no** se crea hasta el primer `start_trace`, y en ese momento la factoría recibe las claves, `base_url` y el entorno;
- AC-010.1 y AC-010.2: con `OBSERVABILITY_ENVIRONMENT` igual a `"production"` y a `"development"`, la factoría recibe `environment` con ese valor;
- AC-009.1: con una clave o ninguna, `enabled` es falso, `FakeApp.logger.records == []` y la factoría nunca se llama.

**Unitarios del adaptador** (`test_services/test_langfuse_backend.py`). Usan `FakeLangfuseClient` y `FakeLangfuseClientFactory`, sin red ni SDK:
- **AC-001.1 (adaptador):** la raíz se crea con `client.start_observation(name="coach-ask", as_type="span", input=question)`, y en el momento de crearse `active_attributes == {"user_id": "42", "trace_name": "coach-ask"}`. Al cerrar, `root.update(output=…)` y `root.end()`. No hay llamadas a `update_trace` ni a `set_trace_io`.
- Los pasos hijos se crean en orden desde la raíz, con `name`, `as_type`, `input` y `model`, y cada uno se crea con los mismos `active_attributes`. Al cerrar, `update(output, usage_details)` y `end()`; con error, `level="ERROR"` y `status_message`.
- **Aislamiento del contexto:**
  - cada `propagate_attributes` que se abre se cierra dentro de la misma llamada del adaptador. Después de cada `start_trace` y de cada `start_step`, `active_attributes` vuelve a estar vacío;
  - `update`, `score_trace`, `end` y `finish` se ejecutan sin contexto activo;
  - si `start_observation` lanza dentro del `with`, el contexto también se restaura.
- Puntuaciones con `root.score_trace(name, value, data_type)`.
- El cliente se crea una sola vez aunque haya varias trazas, y la creación es segura con dos hilos.
- **AC-N001.2:** con claves de Langfuse, Voyage y Anthropic de valores conocidos, ningún `kwargs` registrado en `client.calls` (serializado con `json.dumps(default=str)`), incluidos los de `propagate_attributes`, contiene esos valores. Las claves de Langfuse solo aparecen en los kwargs de la factoría. `propagate_attributes` nunca recibe `as_baggage=True`.
- Con `FakeLangfuseClient(raise_error=…)` detrás de un `Tracer`, la excepción se convierte en el aviso de AC-008.5.

**Configuración** (`test_services/test_observability_config.py`):
- AC-009.3: `TestingConfig.LANGFUSE_PUBLIC_KEY is None` y `TestingConfig.LANGFUSE_SECRET_KEY is None`; `observability_enabled({..claves.., "TESTING": True}) is False`; y el singleton `extensions.tracer.enabled is False` en la app de tests.
- AC-009.4 y AC-009.5: `resolve_langfuse_base_url(None)`, `resolve_langfuse_base_url("")` y `resolve_langfuse_base_url("https://cloud.langfuse.com/")` (devuelve el valor sin la `/` final).
- AC-009.1: `observability_enabled` con una clave o ninguna devuelve `False`.
- AC-010.1 y AC-010.2: `ProductionConfig.OBSERVABILITY_ENVIRONMENT == "production"` y `DevelopmentConfig.OBSERVABILITY_ENVIRONMENT == "development"`.

**Integración de rutas** (`test_routes/test_coach_routes.py`, necesita Postgres por `registered_user`):
- AC-001.3: con `tracer.backend = FakeTraceBackend()`, `POST /api/coach/ask` con `""`, con solo espacios y con 501 caracteres → `400`, y `backend.traces == []`.
- En `conftest.py`, una fixture `autouse` que deja `extensions.tracer.backend = None` antes y después de cada test, igual que `_clear_email_outbox`.
- El resto de AC se prueban a nivel de servicio. La ruta construye `LLMClient` (Anthropic) y usa Redis y Voyage reales a través de singletons, y sustituirlos todos supera el alcance de esta feature. La ruta solo cambia en la inyección del `tracer`.

**RTL:** no aplica.

**AC-N003.1:** ningún test usa red ni importa `langfuse`. El adaptador se prueba con `FakeLangfuseClient` inyectado por `client_factory` y `propagate_attributes`, y `TestingConfig` deja el `tracer` inactivo.

**Justificación de `unittest.mock` y `monkeypatch`:** no se necesitan.

**Verificación manual tras desplegar** (no la cubre ningún test automático, porque depende de Langfuse Cloud): una pregunta real en producción y otra en desarrollo. En Langfuse hay que comprobar:
- que la traza `coach-ask` muestra la entrada, la salida, el usuario y el entorno;
- que tiene los tres pasos y sus duraciones;
- que aparecen las dos puntuaciones;
- que la latencia del coach no cambia de forma apreciable.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El SDK 4.17 envía las **puntuaciones** a `/api/public/ingestion` (eventos `score-create`), la misma API cuyo apagado anuncia Langfuse para el 2026-11-16. Si el apagado incluye las puntuaciones, `outcome` y `best_chunk_distance` dejarían de llegar, aunque las trazas y los pasos seguirían llegando por OTel. | Baja | Medio | Que la última versión del SDK oficial siga usando esa vía para las puntuaciones indica que Langfuse la mantiene o la migrará en una versión menor de la 4.x. El rango `<5` permite actualizar sin tocar fitnerd. La verificación manual tras desplegar comprueba que las puntuaciones aparecen. Antes del 2026-11-16, revisar el changelog del SDK y, si hace falta, subir el mínimo. Nunca se llama a la API de puntuaciones de forma síncrona en la petición, porque rompería NFR-002. |
| Langfuse no muestra la entrada o la salida de la traza a partir de la raíz (el diseño no usa `set_trace_io`, que está *deprecated*). | Baja | Bajo | El SDK marca la raíz como `is_app_root`, la observación de la que Langfuse toma la entrada y la salida de la traza. Se comprueba en la verificación manual. Si no aparecen, la solución es añadir `root.set_trace_io(input, output)`, que sigue existiendo en la 4.x. El cambio queda aislado en `langfuse_backend.py` y en su fake. |
| `propagate_attributes` deja contexto OTel adjunto a un hilo de gunicorn y lo filtra a otra petición. | Baja | Medio | Cada `with` se abre y se cierra dentro de una sola llamada del adaptador (sección 3.2). Tests de aislamiento: el contexto se restaura después de cada llamada y también cuando hay una excepción. |
| Un error en la instrumentación convierte una respuesta válida en un `503`. | Baja | Alto | `SafeTraceRecorder` y `Tracer.start_trace` nunca lanzan, y el `finish` final va fuera del `try`. Tests con backend y cliente que fallan (AC-008.2 a AC-008.4). |
| Una llamada "en memoria" del SDK bloquea la petición (por ejemplo, una cola interna llena). | Baja | Medio | Las observaciones se exportan con el procesador por lotes de OTel, que descarta cuando la cola está llena en lugar de bloquear. Las puntuaciones se encolan con `put(block=False)` y se descartan con un aviso si la cola está llena. fitnerd nunca llama a `flush()` en una petición (test AC-N002.1). Prueba manual de latencia tras desplegar. |
| Los fallos de exportación por red los registra el propio SDK u OpenTelemetry en su hilo, con su propio texto, y no con el aviso de fitnerd. | Media | Bajo | AC-008.5 se cumple con el aviso propio para los fallos que llegan a fitnerd, es decir, los que lanza el SDK en el hilo de la petición. Los exportadores no registran las cabeceras, así que no registran credenciales. Se documenta en el ADR. |
| Hilos del SDK con gunicorn (`fork`). | Baja | Medio | Cliente creado de forma perezosa en el primer `start_trace` de cada worker. Hoy no se usa `--preload`. |
| Dependencias transitivas nuevas (OpenTelemetry, `pydantic`, `backoff`, `wrapt`) en una imagen y un `requirements.txt` sin versiones fijadas. | Media | Bajo | `langfuse>=4.17,<5` acotado. Importación perezosa: si falla, el coach sigue igual (aviso y recorder nulo). La CI instala `requirements.txt` y la suite pasa sin importar el SDK. |
| El modelo `claude-sonnet-5` no está en la tabla de precios de Langfuse y no se calcula el coste. | Media | Bajo | Paso de despliegue (spec, sección 6): añadir el precio a mano en el proyecto de Langfuse. La traza se envía igual. |
| Ampliar `FakeRetrievalService` en `test_coach_service.py` se interpreta como modificar un test existente. | Media | Bajo | Solo se añaden métodos al fake y no se cambia ninguna aserción (Art. 5.3). Se indica de forma explícita en las tareas. |

## 7. Cumplimiento de la constitución
- **Art. 4 (trazabilidad):** cada AC tiene un test asignado en la sección 5, con el marcador `SDD:`.
- **Art. 5.4:** solo hay fakes escritos a mano (`FakeTraceBackend`, `FakeLangfuseClient`, `FakeLangfuseClientFactory`, `FakeClock`, `FakeLogger` y `FakeApp`), inyectados por constructor o como atributo del singleton (patrón de `email_sender.transport`). Sin `unittest.mock` ni `monkeypatch`, y ningún test llama a Langfuse, Voyage, Anthropic ni Redis.
- **Art. 6.1 y 6.2:**
  - La lógica (fases y clasificación del resultado) vive en `CoachService`, que solo depende del puerto `Tracer`, no del SDK.
  - Los clientes externos y el `Tracer` se inyectan por constructor desde `_build_coach_service()`. El cliente del SDK y `propagate_attributes` se inyectan en el adaptador con `client_factory` y `propagate_attributes`.
  - La ruta solo añade una dependencia.
  - No hay repositorios nuevos ni commits.
- **Art. 6.3:** sin errores nuevos. Se mantienen `ServiceUnavailableError` y `RateLimitError` con los mismos mensajes.
- **Art. 6.4:** sin cambios de modelo ni migración.
- **Art. 6.5:** el código nuevo no debe introducir violaciones de ruff.
- **Art. 7.1:** sin secretos en el repositorio. Las variables nuevas se documentan en `backend/.env.example`.
- **Art. 7.2:** el endpoint sigue con `@require_auth`. El `user_id` sale del token.
- **Art. 7.4:** se mantienen el rate limiting y el `503`.
- **DEBERÍA no cumplidos:** ninguno.

## 8. ADRs
- [ADR-0017](../../docs/sdd/decisions/ADR-0017-observabilidad-langfuse.md), revisada en la iteración 3. Define el puerto `Tracer`, con recorder autoprotegido, y el adaptador `LangfuseTraceBackend` sobre el SDK oficial `langfuse>=4.17,<5`:
  - observaciones abiertas y cerradas en vivo;
  - atributos de traza con `propagate_attributes` en `with` cortos dentro de cada llamada del adaptador;
  - `base_url`;
  - exportación en los hilos del SDK.

  Estado: Propuesta.

## Comentarios del usuario

**Gate de plan, iteración 1 (2026-10-07).** Respuesta literal del usuario: "Si, devolver con la opcion (a)".

Opción (a), tal como se le presentó al usuario: **SDK oficial `langfuse` (v4.7+)**, la librería oficial de Langfuse para Python, que por dentro ya usa OpenTelemetry. La versión se fija en `requirements.txt`. Hay que confirmar que el SDK admite horas de inicio y fin explícitas para encajar en el diseño, o adaptar el diseño, y comprobar cómo encaja detrás del `Tracer` sin acoplar `CoachService`.

Motivo del cambio (documentación de Langfuse, https://langfuse.com/docs/api-and-data-platform/features/public-api): "The legacy Ingestion API is deprecated and is sunset on Langfuse Cloud on November 16, 2026 (2026-11-16)". "The OpenTelemetry endpoint is the supported path for trace ingestion." "Modern Langfuse SDKs (Python v4.7.0+, JS/TS v5.4.0+) already use the OpenTelemetry endpoint by default." El destino `LangfuseIngestionSink` sobre `POST /api/public/ingestion` no es viable.

**Respuesta del planner (iteración 2):**
- **Horas explícitas.** No se pudieron confirmar sin acceso a la red ni al paquete instalado, así que se **adaptó el diseño** para no necesitarlas: las observaciones se abren y se cierran en vivo y el SDK mide las horas.
- **Desacoplamiento.** `CoachService` solo conoce el puerto `Tracer` (`utils/tracing.py`). El SDK queda encerrado en `utils/langfuse_backend.py`, con importación perezosa.
- **Versión.** Se fija `langfuse>=4.7,<5`.
- **Envío en segundo plano.** Lo hace el SDK, así que se eliminan la cola y el hilo propios.

**Gate de plan, iteración 2 (2026-10-07).** Respuesta literal del usuario: "Si, devuélvelo para la iteración 3".

Firmas verificadas por el orquestador en el código fuente de `langfuse` 4.17.0 (última versión en PyPI; paquete descomprimido, solo lectura, en `C:/Users/alber/AppData/Local/Temp/claude/C--Users-alber-source-repos-fitnerd/2fda970a-5991-4a11-bbaf-cbf4bbbbc1e4/scratchpad/lf/x/langfuse`), tal como se le presentaron al usuario:

| El plan usa | El SDK 4.17 real |
|---|---|
| `root.update_trace(name=…, user_id=…, input=…, output=…)` | **No existe** en v4. El usuario y el nombre de la traza se fijan con el gestor de contexto `propagate_attributes(user_id=…, session_id=…, metadata=…, version=…, tags=…, trace_name=…, environment=…, prompt=…, as_baggage=…)` (`from langfuse import propagate_attributes`). Su docstring: "Only the currently active span and spans created after entering this context will have these attributes. Pre-existing spans will NOT be retroactively updated." y "Call this as early as possible within your trace/workflow — ideally wrapping the creation of your root span". La entrada y la salida a nivel de traza (`LangfuseObservationWrapper.set_trace_io(input, output)` y `Langfuse.set_current_trace_io`) están marcadas como *deprecated* ("legacy method… will be removed in a future major version"). |
| `Langfuse(host=…)` | `host` está **deprecated** ("Deprecated. Use base_url instead."). El parámetro es `base_url` (también `LANGFUSE_BASE_URL`). `environment` sí existe en el constructor. Firma: `Langfuse(public_key, secret_key, base_url, host, timeout, httpx_client, debug, tracing_enabled, flush_at, flush_interval, environment, release, media_upload_thread_count, sample_rate, mask, mask_otel_spans, blocked_instrumentation_scopes, should_export_span, additional_headers, tracer_provider, id_generator, span_exporter, otel_compression)`. |
| Raíz con `start_observation` para no tocar el contexto OTel actual | Compatible, pero hay que compaginarlo con `propagate_attributes`, que sí trabaja con el contexto activo. Es una decisión de diseño (aislamiento entre peticiones e hilos de gunicorn) que debe quedar en el plan. |

Sí coinciden: `Langfuse.start_observation(trace_context, name, as_type, input, output, metadata, version, level, status_message, completion_start_time, model, model_parameters, usage_details, cost_details, prompt)`; `LangfuseObservationWrapper.start_observation(...)` (mismos parámetros, sin `trace_context`); `.update(name, input, output, metadata, version, level, status_message, completion_start_time, model, model_parameters, usage_details, cost_details, prompt)`; `.end(end_time)`; `.score_trace(name, value, score_id, data_type, comment, config_id, timestamp, metadata)`; `Langfuse.create_score(...)`; `Langfuse.flush()` y `Langfuse.shutdown()`. `start_observation` no admite una hora de inicio explícita; `end` sí admite `end_time`.

Dependencias transitivas de `langfuse` 4.17.0: `httpx`, `pydantic>=2`, `backoff`, `wrapt`, `packaging`, `opentelemetry-api`, `opentelemetry-sdk` y `opentelemetry-exporter-otlp-proto-http` (>=1.45). Requiere Python >=3.10.

**Respuesta del planner (iteración 3):**
- **`update_trace`.** Se elimina. `user_id` y `trace_name` se fijan con `propagate_attributes`. La entrada y la salida de la traza son las de la raíz `coach-ask`, sin `set_trace_io` (sección 3.2).
- **Aislamiento del contexto.**
  - Cada `propagate_attributes` envuelve solo la creación de una observación (`start_trace` y `start_step`), dentro de una única llamada síncrona del adaptador.
  - Raíz y pasos se crean con `start_observation`, nunca como observación actual.
  - El contexto nunca queda adjunto entre llamadas ni entre peticiones.
  - Se descartó un único `with` desde `start_trace` hasta `finish`, porque dejaría el contexto adjunto al hilo.
  - Se comprobó en el SDK que los pasos se crean con `use_span(root)` encima del contexto actual y que el procesador aplica los atributos propagados en `on_start`.
- **`base_url`.** El constructor recibe `base_url`. La variable pasa a ser `LANGFUSE_BASE_URL` y la función, `resolve_langfuse_base_url`.
- **Versión.** El mínimo sube a `langfuse>=4.17,<5`, la versión verificada.
- **Hallazgo nuevo.** En la 4.17, `score_trace` encola las puntuaciones y un hilo del SDK las envía a `/api/public/ingestion` (`score-create`), no por OTel. Las trazas y los pasos sí van por OTel. Queda como primer riesgo de la sección 6, con su mitigación.
