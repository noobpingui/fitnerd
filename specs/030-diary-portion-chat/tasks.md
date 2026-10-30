# Tareas 030 — Chat de porciones del diario (backend)

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Ámbitos:** `backend`
- Orden: scaffold (A0) → test (A) → impl/config (B). Formato de línea fijo, lo parsea el verifier.

## Fase A0 — Esqueletos (scaffold)

Cada cuerpo lanza `NotImplementedError("not implemented")`; constantes, dataclasses y `__init__` se crean completos (Art. B5.6, P1.5). El `init_app` de `app.py` NO se añade aquí: con un `init_app` que lanza, `create_app` fallaría en todos los tests; se conecta en la fase B.

- [x] T-001 [NFR-001] (scaffold) Constantes `DEFAULT_PORTION_ESTIMATE_MODEL = "claude-haiku-4-5"`, `PORTION_ESTIMATE_TIMEOUT_SECONDS = 15.0`, `PORTION_ESTIMATE_MAX_RETRIES = 1`, `Config.PORTION_ESTIMATE_MODEL` (`os.getenv(...) or None`) y `TestingConfig.PORTION_ESTIMATE_MODEL = None` (completas, sin lógica) — `backend/config.py`
- [x] T-002 [NFR-001, REQ-004] (scaffold) `StructuredGenerationResult` (dataclass completa), `LLMClient.__init__` con `timeout` y `max_retries` opcionales, `LLMClient.generate_structured`, y `LazyLLMClient` (`__init__` guarda config con `model=None` y `llm_client=None`; `init_app` y `generate_structured` lanzan `not implemented`) — `backend/utils/llm_client.py`
- [x] T-003 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, NFR-002] (scaffold) Módulo de reglas: constantes, mensajes, `STATUS_*`, `PORTION_TOOL_NAME`, `PORTION_TOOL` y `SYSTEM_PROMPT` (completos), dataclass `PortionEstimate` y las funciones `parse_question`, `parse_grams`, `clean_text`, `build_estimate`, `not_food_estimate`, `unknown_estimate` con la firma del plan — `backend/services/portion_estimate_rules.py`
- [x] T-004 [REQ-005, REQ-006, REQ-007, REQ-009] (scaffold) `PortionEstimateService` con constantes (`MAX_QUESTIONS_PER_WINDOW`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_KEY_PREFIX`, mensajes, `TRACE_NAME`), `__init__(llm_client, rate_limiter, tracer=None, logger=None)` que solo guarda y `estimate(user_id, data)` que lanza `not implemented` — `backend/services/portion_estimate_service.py`
- [x] T-005 [NFR-001] (scaffold) Singleton `portion_llm = LazyLLMClient("PORTION_ESTIMATE_MODEL", DEFAULT_PORTION_ESTIMATE_MODEL, timeout=..., max_retries=...)` en `extensions.py` (solo la declaración, sin tocar `app.py`) — `backend/extensions.py`

## Fase A — Tests (rojo)

- [x] T-006 [REQ-001, REQ-003, REQ-004, REQ-007] (test) Doble `FakeStructuredLLMClient` (`data`, `stop_reason`, `raise_error`, tokens, `model`, `calls`; `generate_structured` devuelve `StructuredGenerationResult` con `data=None` si `stop_reason` es `refusal` o `max_tokens`) — `backend/tests/fakes.py`
- [x] T-007 [REQ-005] (test) `parse_question`: AC-005.1 (lista, número, `None`), AC-005.2 (`{}`, `""`, `"   "`), AC-005.3 (`5`, `["huevo"]`, `None`), AC-005.4 (201 caracteres) y AC-005.5 (200 con espacios, devuelve sin espacios) — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-008 [REQ-001, REQ-002] (test) `build_estimate`, `parse_grams` y `clean_text`: AC-001.1 a AC-001.4 (152,6 → 153, 1 y 5000, porción y nota ausentes, vacías o de espacios) y AC-002.1 a AC-002.3 (recorte a 100 y 50, sin espacio final, `strip`) — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-009 [REQ-003, REQ-004] (test) `build_estimate`: AC-003.1 y AC-003.2 (`not_food` sin valores del modelo), AC-004.1 parametrizado (0, 5001, -10, 0,4, `None`, `"250"`, `True`) y AC-004.3 (sin `is_food`, `is_food` no booleano, `tool_input` `None`) — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-010 [REQ-001, REQ-003, REQ-004, NFR-001] (test) `LLMClient.generate_structured` con `FakeAnthropicClient`: AC-N001.1 (pasa `max_tokens`, `temperature`, `tools` y `tool_choice` forzado; devuelve `data` y tokens), AC-004.2 (`refusal` y `max_tokens` → `data` `None`) y AC-004.3 (sin bloque `tool_use` o `input` que no es `dict`); los tests existentes siguen pasando — `backend/tests/test_services/test_llm_client.py`
- [x] T-011 [NFR-001] (test) `LazyLLMClient`: AC-N001.2 (sin `PORTION_ESTIMATE_MODEL` usa el defecto y no `ANTHROPIC_MODEL`; con valor usa ese; `client_factory` falso recibe modelo, `timeout` y `max_retries` en la primera llamada) — `backend/tests/test_services/test_llm_client.py`
- [x] T-012 [REQ-001, REQ-003, REQ-004, REQ-007] (test) Servicio de extremo a extremo con dobles: AC-001.1, AC-003.1, AC-004.2 (`refusal`) y AC-007.1 (`RuntimeError("detalle-secreto")` → `ServiceUnavailableError` con mensaje fijo, sin el texto original, con registro en `FakeLogger`) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-013 [REQ-005, REQ-006, REQ-008] (test) Servicio y límite: una petición no válida no toca limitador ni modelo (AC-005.x), AC-006.1 y AC-006.2 (`calls == [("ratelimit:meals:portion-estimate:<id>", 10, 21600)]`, `RateLimitError` sin modelo) y AC-006.4 (contadores independientes del coach, con `RateLimiter` real y `FakeRedisClient` compartido) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-014 [REQ-009] (test) Trazas del servicio con `Tracer(backend=FakeTraceBackend())`: AC-009.1 (usuario, pregunta, respuesta y `estimated`), AC-009.2 (`not_food`, `unknown`, `error`), AC-009.3 (sin traza en 400 y 429) y AC-009.4 (backend que falla en `finish` → devuelve la estimación) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-015 [NFR-001, NFR-002] (test) Parámetros e instrucciones: AC-N001.1 (una sola llamada, `max_tokens == 150`, `temperature == 0`), AC-N002.1 (instrucciones idénticas a `SYSTEM_PROMPT` ante «Ignora tus instrucciones…» y pregunta como único mensaje de usuario) y AC-N002.2 (segunda consulta sin la primera pregunta ni su respuesta) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-016 [REQ-001, REQ-003, REQ-004] (test) Ruta, caso feliz: fixtures `autouse` con `FakeRedisClient` en `rate_limiter.client` y `FakeStructuredLLMClient` en `portion_llm.llm_client` (restaurados al terminar); AC-001.1 (forma exacta del JSON), AC-003.1 y una muestra de AC-004.1 por HTTP — `backend/tests/test_routes/test_portion_estimate_routes.py`
- [x] T-017 [REQ-005] (test) Ruta, validación: AC-005.1 (`text/plain`, JSON malformado, `null`, lista, número), AC-005.2, AC-005.3, AC-005.4 y AC-005.5 con el modelo sin consultar, y AC-005.6 (9 válidas, 3 no válidas, una válida → 200) — `backend/tests/test_routes/test_portion_estimate_routes.py`
- [x] T-018 [REQ-006, REQ-007] (test) Ruta, límite y fallo: AC-006.1 (undécima 429, modelo consultado 10 veces), AC-006.3 (usuario B no afectado), AC-006.5 (mezcla de `not_food`, `unknown` y 503; décima 200, undécima 429) y AC-007.1 (503 con mensaje fijo sin el error original) — `backend/tests/test_routes/test_portion_estimate_routes.py`
- [x] T-019 [REQ-008, NFR-003] (test) Ruta, sesión y datos: AC-008.1 (sin token y token no válido → 401, sin modelo), AC-008.2 (`user_id` ajeno en el cuerpo → contador del usuario del token) y AC-N003.1 (filas de `Meal`, `MealItem`, `CustomFood` y `FoodFavorite` sin cambios tras un 200) — `backend/tests/test_routes/test_portion_estimate_routes.py`

## Fase B — Implementación

Orden por dependencia: cliente LLM → reglas → servicio → conexión (app) → ruta.

- [x] T-020 [REQ-004, NFR-001] (impl) Implementar `LLMClient.generate_structured` (llamada con herramienta forzada, `data` del primer `tool_use` con el nombre, `None` en `refusal`, `max_tokens`, sin bloque o `input` no `dict`), el paso de `timeout`/`max_retries` al SDK solo si no son `None`, y `LazyLLMClient.init_app` / `generate_structured` (modelo de `PORTION_ESTIMATE_MODEL` o el defecto, cliente perezoso) — `backend/utils/llm_client.py`
- [x] T-021 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, NFR-002] (impl) Implementar `parse_question`, `parse_grams` (`Decimal`, `ROUND_HALF_UP`, rango 1 a 5000, `is_number`), `clean_text`, `build_estimate`, `not_food_estimate` y `unknown_estimate`; redactar `SYSTEM_PROMPT` fijo y `PORTION_TOOL` según el plan — `backend/services/portion_estimate_rules.py`
- [x] T-022 [REQ-005, REQ-006, REQ-007, REQ-009, NFR-001, NFR-002, NFR-003] (impl) Implementar `PortionEstimateService.estimate`: validar, `check_and_increment` (10, 21.600 s), traza, único mensaje de usuario, `try` solo en `generate_structured` → `ServiceUnavailableError` con `format_error` en el log, `build_estimate`, score `outcome` y `finish` — `backend/services/portion_estimate_service.py`
- [x] T-023 [NFR-001] (config) Llamar a `portion_llm.init_app(app)` en `create_app` junto a `vision_client.init_app(app)` y mantener el import en `extensions` — `backend/app.py`
- [x] T-024 [REQ-001, REQ-005, REQ-008] (impl) `_build_portion_estimate_service()`, `_serialize_portion_estimate()` (cinco claves siempre) y ruta `POST /portion-estimate` con `@require_auth`, `get_json(silent=True)` y usuario de `g.decoded_token["id"]` — `backend/routes/meal_routes.py`

## Iteración 2 (rework desde review) — REQ-010, REQ-011 y backlog

Las tareas T-001 a T-024 se conservan tal cual. Orden de la iteración: scaffold (A0) → test (A) → impl/config (B). El `init_app` de `coach_llm` en `app.py` y el cambio de `coach_routes.py` NO se hacen en el scaffold: se conectan en la fase B.

### Fase A0 (iteración 2) — Esqueletos (scaffold)

- [x] T-025 [REQ-006] (scaffold) Constante `DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"` (mismo valor que el literal actual) y `Config.ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)`, completos y sin lógica nueva — `backend/config.py`
- [x] T-026 [REQ-006] (scaffold) `LazyLLMClient.generate_with_usage(self, system_prompt, messages, max_tokens=2048) -> GenerationResult` con cuerpo `raise NotImplementedError("not implemented")` — `backend/utils/llm_client.py`
- [x] T-027 [REQ-006] (scaffold) Singleton `coach_llm = LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)` en `extensions.py` (solo la declaración, sin tocar `app.py` ni `coach_routes.py`) — `backend/extensions.py`
- [x] T-028 [REQ-011] (scaffold) Constante `MAX_PORTION_REQUEST_BYTES = 4096` en `meal_routes.py` (completa; la ruta no la usa todavía) — `backend/routes/meal_routes.py`

### Fase A (iteración 2) — Tests (rojo)

- [x] T-029 [REQ-010] (test) Dobles: parámetro opcional `raise_error=None` en `FakeRateLimiter` (registra la llamada en `calls` y lanza) y en `FakeRedisClient` (mutable; `incr` lanza antes de contar); los usos actuales no cambian — `backend/tests/fakes.py`
- [x] T-030 [REQ-010] (test) Servicio con limitador que falla: AC-010.1 (`ConnectionError("detalle-redis")` → `ServiceUnavailableError` con `PROVIDER_UNAVAILABLE_MESSAGE` sin el texto original, `llm.calls == []`, registro en `FakeLogger`), AC-010.2 (`backend.traces == []`) y AC-010.3 (`{"question": ""}` → `ValidationError` y `limiter.calls == []`) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-031 [REQ-010, REQ-011] (test) Ruta de porciones: AC-010.1 (Redis que lanza → 503 con mensaje fijo, sin modelo), AC-010.3 (Redis que lanza y `question` vacía → 400), AC-011.1 (cuerpo de 4097 bytes → 400 «La petición no es válida», sin modelo), AC-011.2 (4096 bytes → 200) y AC-011.3 (4097 bytes sin contador ni traza) — `backend/tests/test_routes/test_portion_estimate_routes.py`
- [x] T-032 [REQ-011] (test) AC-011.4: `POST /api/meals` con un cuerpo válido de más de 4096 bytes (30 alimentos personalizados con nombres distintos) → 201, el límite global no cambia — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-033 [REQ-006] (test) `LazyLLMClient.generate_with_usage` (AC-006.4): con factoría falsa y `FakeApp({"ANTHROPIC_MODEL": "claude-sonnet-5"})`, `model == "claude-sonnet-5"`, el cliente se crea una vez con `{"model": ..., "timeout": None, "max_retries": None}`, delega y devuelve el `GenerationResult`, y la segunda llamada reutiliza el cliente — `backend/tests/test_services/test_llm_client.py`
- [x] T-034 [NFR-001] (test) F3, AC-N001.1: `LLMClient(model="m", api_key="clave-de-prueba", timeout=15.0, max_retries=1)` expone `timeout == 15.0` y `max_retries == 1` en el cliente del SDK; sin opciones usa los valores por defecto del SDK; sin red ni `monkeypatch` — `backend/tests/test_services/test_llm_client.py`
- [x] T-035 [REQ-004] (test) Marcadores antiguos de L27, L41, L55 y L66: pasan a `# SDD: 004 REQ-004 AC-004.1`, `# SDD: 004 REQ-004 AC-004.4`, `# SDD: 004 REQ-005 AC-005.3` y `# SDD: 004 REQ-004 AC-004.4`; solo cambia el comentario (sin cambiar nombre, docstring ni aserciones; se hace antes de añadir T-033 y T-034 para localizar las líneas) — `backend/tests/test_services/test_llm_client.py`
- [x] T-036 [REQ-002] (test) F5, AC-002.1: `test_build_estimate_truncates_a_long_note_to_100` usa `"a" * 99 + " " + "b" * 80` y comprueba además `estimate.note == "a" * 99` (ejercita el `rstrip`); se conservan las tres aserciones actuales — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-037 [REQ-006] (test) Coach por HTTP (AC-006.4): fixtures que instalan y restauran `FakeRedisClient`, `FakeLLMClient(answer="Haz 3 series de 10.")` en `coach_llm.llm_client` y `FakeVoyageClient`; siembra de `Video` y `TranscriptChunk`; (a) con el contador de porciones en 10, `POST /api/coach/ask` → 200; (b) con el del coach en 20, `POST /api/meals/portion-estimate` → 200; el test de 400 actual se mantiene — `backend/tests/test_routes/test_coach_routes.py`

### Fase B (iteración 2) — Implementación

Orden por dependencia: cliente LLM → servicio → ruta → conexión del coach.

- [x] T-038 [REQ-006] (impl) `LazyLLMClient`: extraer `_get_client()` (crea el cliente la primera vez con `model`, `timeout` y `max_retries`), usarlo en `generate_structured` e implementar `generate_with_usage` delegando; F2 (comentario «configuración» con tilde) y F4 (`-> StructuredGenerationResult` sin comillas) — `backend/utils/llm_client.py`
- [x] T-039 [REQ-010] (impl) `PortionEstimateService.estimate`: resolver `tracer` y `logger` antes del límite y envolver solo `check_and_increment` en `try`; ante cualquier excepción, `logger.error` con `format_error` y `ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None`, sin traza ni modelo; `RateLimitError` fuera del `try`; la validación sigue antes — `backend/services/portion_estimate_service.py`
- [x] T-040 [REQ-011] (impl) Ruta `estimate_portion`: fijar `request.max_content_length = MAX_PORTION_REQUEST_BYTES` antes de leer el cuerpo y traducir `RequestEntityTooLarge` a `ValidationError(INVALID_REQUEST_MESSAGE) from None`, sin tocar el límite global; importes de `ValidationError` e `INVALID_REQUEST_MESSAGE` — `backend/routes/meal_routes.py`
- [x] T-041 [REQ-006] (config) Llamar a `coach_llm.init_app(app)` en `create_app` junto a `portion_llm.init_app(app)` y hacer que `_build_coach_service()` use `coach_llm` en lugar de construir un `LLMClient` (quitar el import de `LLMClient`; `current_app` sigue para `SECRET_KEY`) — `backend/app.py`, `backend/routes/coach_routes.py`

## Matriz de cobertura

| AC | Tarea test | Tarea impl |
|---|---|---|
| AC-001.1 | T-008, T-012, T-016 | T-021, T-022, T-024 |
| AC-001.2 | T-008 | T-021 |
| AC-001.3 | T-008 | T-021 |
| AC-001.4 | T-008 | T-021 |
| AC-002.1 | T-008, T-036 | T-021 |
| AC-002.2 | T-008 | T-021 |
| AC-002.3 | T-008 | T-021 |
| AC-003.1 | T-009, T-012, T-016 | T-021, T-022, T-024 |
| AC-003.2 | T-009 | T-021 |
| AC-004.1 | T-009, T-016 | T-021, T-024 |
| AC-004.2 | T-010, T-012 | T-020, T-022 |
| AC-004.3 | T-009, T-010 | T-020, T-021 |
| AC-005.1 | T-007, T-013, T-017 | T-021, T-022, T-024 |
| AC-005.2 | T-007, T-017 | T-021, T-024 |
| AC-005.3 | T-007, T-017 | T-021, T-024 |
| AC-005.4 | T-007, T-017 | T-021, T-024 |
| AC-005.5 | T-007, T-017 | T-021, T-024 |
| AC-005.6 | T-017 | T-022, T-024 |
| AC-006.1 | T-013, T-018 | T-022 |
| AC-006.2 | T-013 | T-022 |
| AC-006.3 | T-018 | T-022 |
| AC-006.4 | T-013, T-033, T-037 | T-022, T-038, T-041 |
| AC-006.5 | T-018 | T-022 |
| AC-007.1 | T-012, T-018 | T-022 |
| AC-008.1 | T-019 | T-024 |
| AC-008.2 | T-019 | T-024 |
| AC-009.1 | T-014 | T-022 |
| AC-009.2 | T-014 | T-022 |
| AC-009.3 | T-014 | T-022 |
| AC-009.4 | T-014 | T-022 |
| AC-010.1 | T-029, T-030, T-031 | T-039 |
| AC-010.2 | T-029, T-030 | T-039 |
| AC-010.3 | T-029, T-030, T-031 | T-039 |
| AC-011.1 | T-031 | T-040 |
| AC-011.2 | T-031 | T-040 |
| AC-011.3 | T-031 | T-040 |
| AC-011.4 | T-032 | T-040 |
| AC-N001.1 | T-010, T-015, T-034 | T-020, T-022 |
| AC-N001.2 | T-011 | T-020, T-023 |
| AC-N002.1 | T-015 | T-021, T-022 |
| AC-N002.2 | T-015 | T-022 |
| AC-N003.1 | T-019 | T-022, T-024 |

## Notas

- La documentación de `PORTION_ESTIMATE_MODEL` (`backend/.env.example`, `docs/deploy-runbook.md`) corresponde a la etapa docs (plan, sección 2), no a estas tareas.


## Comentarios del usuario

Red check de la iteración 2, 2026-10-30. Decisión sobre F3 (T-034) y F5 (T-036), que prueban código que ya funciona y no pueden estar en rojo: «Aceptar excepción a B5.2 (Recomendada)». Se mantienen como refuerzo de tests existentes, sin código nuevo; queda anotada en el backlog y en el gate de review. La excepción **no** cubre las guardas AC-010.3 (servicio y ruta), AC-011.2, AC-011.4 y la mitad inversa de AC-006.4: esas se funden en tests con una aserción roja.
