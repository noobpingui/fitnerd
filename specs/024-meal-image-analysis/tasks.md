# Tareas 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-21)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold -> test -> impl/migration/config.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
- Sin migración: el plan no cambia modelos (sección 3.1). Todos los tests son del ámbito backend.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Las rutas HTTP nuevas (`POST /api/meals/analyze`) dan 404 mientras no existan: rojo legítimo, sin esqueleto. Los
símbolos que los tests importan se crean sin lógica. Las constantes de mensajes y las clases de datos (dataclasses)
llevan sus valores exactos del plan; todas las funciones y métodos lanzan `NotImplementedError("not implemented")` y los
constructores solo guardan sus dependencias.

- [x] T-001 [REQ-003, AC-003.4] (scaffold) Crear `PayloadTooLargeError(AppError)` con código 413 y mensaje por defecto "Payload too large" (clase sin lógica, tal cual el plan 3.2) — `backend/exceptions/custom_exceptions.py`
- [x] T-002 [REQ-002, REQ-003, REQ-010, AC-003.1] (scaffold) Crear el módulo con constantes (`MAX_PHOTO_BYTES`, `MAX_PHOTO_SIDE`, `PHOTO_FORMATS` y los seis mensajes), dataclass `MealPhoto` y las firmas `detect_photo_format(data)`, `strip_photo_metadata(data, photo_format)` y `prepare_photo(images)` que lanzan "not implemented" — `backend/services/meal_photo.py`
- [x] T-003 [REQ-006, REQ-007, REQ-008, AC-006.1] (scaffold) Crear el módulo con constantes (`CONFIDENCE_LEVELS`, `MAX_PROPOSED_FOODS`, `MAX_ESTIMATED_GRAMS`, `MAX_UNMATCHED_NAME_CHARS`, `FOODS_TOOL_NAME`, `FOODS_TOOL_SCHEMA`, `SYSTEM_PROMPT`), dataclasses `ProposedItem`, `UnmatchedItem`, `MealImageAnalysis` y las firmas `build_user_prompt`, `parse_estimated_grams`, `parse_confidence`, `clean_unmatched_name` y `build_analysis` que lanzan "not implemented" — `backend/services/meal_image_rules.py`
- [x] T-004 [REQ-001, REQ-009, AC-009.4] (scaffold) Crear `VISION_TIMEOUT_SECONDS`, `VISION_CONNECT_TIMEOUT_SECONDS`, `VisionProviderError`, dataclass `VisionFoodsResult`, funciones `build_client_config` y `describe_vision_error`, y la clase `BedrockVisionClient` (el `__init__` guarda `client_factory` y deja `client` y `model_id` en `None`; `init_app`, `configured` y `recognize_foods` lanzan "not implemented") — `backend/utils/vision_client.py`
- [x] T-005 [REQ-001, REQ-005, REQ-009, AC-005.1] (scaffold) Crear las constantes (`MAX_ANALYSES_PER_WINDOW`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MESSAGE`, `PROVIDER_UNAVAILABLE_MESSAGE`, `TRACE_NAME`) y `MealImageAnalysisService` (el `__init__` solo guarda `catalog_repository`, `vision_client`, `rate_limiter`, `tracer` y `logger`; `analyze` lanza "not implemented") — `backend/services/meal_image_analysis_service.py`
- [x] T-006 [NFR-001, AC-N001.1] (scaffold) Crear la clase `InMemoryUploadRequest(flask.Request)` con `_get_file_stream` que lanza "not implemented" (los parámetros no usados con prefijo `_`) — `backend/utils/in_memory_request.py`
- [x] T-007 [REQ-001, REQ-009, AC-009.4] (scaffold) Añadir el singleton `vision_client = BedrockVisionClient()` (importando la clase del módulo de T-004), sin llamar todavía a `init_app` — `backend/extensions.py`

## Fase A — Tests (test-author)
Marcadores `# SDD: 024 REQ-… AC-…`, nombres en inglés, docstrings en español, fakes a mano (sin `unittest.mock` ni
`monkeypatch`).

- [x] T-010 [REQ-001, REQ-009, AC-001.2, AC-009.2] (test) Añadir los dobles `FakeVisionClient` (guarda `calls`, lanza `raise_error` o devuelve `VisionFoodsResult`) y `FakeBedrockRuntimeClient` (guarda kwargs de `converse`, devuelve bloque `toolUse` `report_foods` o solo texto, `stop_reason`, tokens; ayudas `last_image()` y `last_prompt()`) — `backend/tests/fakes.py`
- [x] T-011 [REQ-003, REQ-010, AC-003.4, AC-003.6, AC-010.1, AC-010.2] (test) Crear los generadores de imágenes en memoria `jpeg_bytes`, `png_bytes`, `webp_bytes`, `gif_bytes`, `jpeg_with_gps_exif`, `truncated_jpeg` y `padded_to` (PNG con chunk privado de relleno para los 3 MB exactos) — `backend/tests/photo_samples.py`
- [x] T-012 [REQ-001, REQ-006, AC-001.1, AC-001.4, AC-001.5] (test) `build_analysis`: nutrientes 195,0 / 4,04 / 42,26 / 0,42 y totales del arroz, orden del proveedor con suma de totales, y lista vacía con totales en 0 — `backend/tests/test_services/test_meal_image_rules.py`
- [x] T-013 [REQ-006, AC-006.1, AC-006.2, AC-006.3] (test) `build_analysis`: ignora nombre y macros del modelo, id inexistente con nombre va a `unmatched`, id inexistente sin nombre se descarta — `backend/tests/test_services/test_meal_image_rules.py`
- [x] T-014 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) `parse_estimated_grams`, `parse_confidence`, `clean_unmatched_name` y su efecto en `build_analysis`: redondeo y tope 2000, gramos inválidos descartados, confianza por defecto `low`, nombre recortado a 100 y vacío descartado — `backend/tests/test_services/test_meal_image_rules.py`
- [x] T-015 [REQ-008, AC-008.1, AC-008.2] (test) `build_analysis`: unión de duplicados del catálogo (suma de gramos, menor confianza, primera posición) y tope de 20 alimentos entre `items` y `unmatched` — `backend/tests/test_services/test_meal_image_rules.py`
- [x] T-016 [REQ-001, AC-001.3] (test) `build_user_prompt` contiene el identificador y el nombre de todos los alimentos del catálogo — `backend/tests/test_services/test_meal_image_rules.py`
- [x] T-017 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-002.3, AC-003.1, AC-003.2, AC-003.3] (test) `prepare_photo`/`detect_photo_format`: lista vacía, `b""` y dos archivos, texto y GIF rechazados, PNG detectado por contenido, JPEG truncado ilegible — `backend/tests/test_services/test_meal_photo.py`
- [x] T-018 [REQ-003, AC-003.4, AC-003.6] (test) `prepare_photo`: 3 MB exactos pasa y 3 MB + 1 lanza `PayloadTooLargeError`; 8000 × 6000 pasa y 8001 × 100 y 100 × 8001 fallan con el mensaje de píxeles — `backend/tests/test_services/test_meal_photo.py`
- [x] T-019 [REQ-010, AC-010.1, AC-010.2] (test) `strip_photo_metadata`/`prepare_photo`: JPEG sin EXIF/GPS/modelo y con las mismas dimensiones, PNG sin chunk `tEXt`, WebP sin EXIF — `backend/tests/test_services/test_meal_photo.py`
- [x] T-020 [REQ-001, REQ-009, AC-001.2, AC-009.1, AC-009.2, AC-009.4] (test) `BedrockVisionClient`: petición `converse` con imagen, formato, texto, `toolChoice` forzado y `modelId`; texto sin `toolUse` o `max_tokens` lanza `VisionProviderError`; sin modelo no está configurado; `init_app` con modelo usa la fábrica con región y `read_timeout == 30` con un solo intento — `backend/tests/test_services/test_vision_client.py`
- [x] T-021 [REQ-009, NFR-001, AC-N001.2] (test) `describe_vision_error`: solo tipo y código de `ClientError`, nunca el mensaje de un `ParamValidationError` que contiene bytes de imagen — `backend/tests/test_services/test_vision_client.py`
- [x] T-022 [REQ-001, REQ-005, AC-001.1, AC-001.3, AC-005.1, AC-005.2, AC-005.3] (test) `MealImageAnalysisService.analyze`: respuesta del arroz, prompt con todo el catálogo, clave de límite por usuario con `limit=10` y `window_seconds=3600`, 429 con mensaje exacto sin llamar al proveedor, foto no válida sin llamar al limitador — `backend/tests/test_services/test_meal_image_analysis_service.py`
- [x] T-023 [REQ-009, NFR-001, AC-009.1, AC-009.3, AC-N001.2] (test) `analyze`: error genérico y `ReadTimeoutError` dan 503 con el mensaje exacto, catálogo vacío da 503 sin llamar al proveedor, y ni el log ni la traza contienen los bytes ni su base64 — `backend/tests/test_services/test_meal_image_analysis_service.py`
- [x] T-024 [NFR-002, AC-N002.1, AC-N002.2, AC-N002.3, AC-N002.4] (test) `analyze`: traza con usuario, formato, tamaño, puntuaciones `items_count`/`unmatched_count`/`outcome` (`answered`, `empty`, `error`) y tokens, sin imagen; 400 y 429 sin traza; un trazador que falla no cambia el 200 — `backend/tests/test_services/test_meal_image_analysis_service.py`
- [x] T-025 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5] (test) Ruta `POST /api/meals/analyze`: respuesta completa exacta del arroz, PNG y WebP con su formato, catálogo completo enviado, orden y totales, respuesta vacía (incluye fixtures que instalan los dobles en `vision_client` y `rate_limiter`) — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-026 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4] (test) Ruta: 400 sin cuerpo, con JSON o sin campo `image`, archivo vacío, dos archivos, y campos adicionales ignorados — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-027 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6] (test) Ruta: texto y GIF 400, PNG llamado `foto.jpg` llega como PNG, truncado 400, 3 MB exactos y +1 (413), cuerpo de 4 MB + 1 con 413 en español, 8000 píxeles — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-028 [REQ-004, REQ-005, AC-004.1, AC-005.1, AC-005.2, AC-005.3] (test) Ruta: 401 sin cabecera, caducado e inválido sin llamar al proveedor; límite de 10 por hora con el 11.º en 429, independiente por usuario, y 400 que no cuentan — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-029 [REQ-006, REQ-009, AC-006.2, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (test) Ruta: `gallo-pinto` a `unmatched` de extremo a extremo, 503 con proveedor que lanza, con texto no interpretable, sin catálogo y con `vision_client.client = None` — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-030 [REQ-010, NFR-001, NFR-002, AC-010.1, AC-010.2, AC-N001.1, AC-N002.3] (test) Ruta: la imagen que recibe el proveedor no tiene EXIF ni bloque de texto; ninguna tabla cambia tras un 200 y un 503; 400 y 429 no crean trazas; `app.request_class` es `InMemoryUploadRequest` y su `_get_file_stream` devuelve `BytesIO` — `backend/tests/test_routes/test_meal_analysis_routes.py`
- [x] T-058 [REQ-009, AC-009.1] (test) `test_gunicorn_timeout_exceeds_the_vision_provider_budget` (review F1, plan 3.5 y 5): lee el `CMD` de `backend/Dockerfile`, comprueba que es `gunicorn` con un único `--timeout` entero ≥ `VISION_CONNECT_TIMEOUT_SECONDS + VISION_TIMEOUT_SECONDS + 30`; archivo nuevo, requiere reabrir la etapa de tests; en rojo hasta T-059 — `backend/tests/test_services/test_server_timeout.py`

## Fase B — Implementación (implementer)
Sin tareas `migration`: no hay cambios de modelo. Orden: configuración y dependencias → utilidades → reglas puras →
servicio → ruta.

- [x] T-040 [REQ-009, AC-009.4] (config) Añadir `BEDROCK_VISION_MODEL_ID` (por defecto `None`) y `BEDROCK_REGION` (por defecto `us-east-1`) a `Config`, y fijar `BEDROCK_VISION_MODEL_ID = None` en `TestingConfig` — `backend/config.py`
- [x] T-041 [REQ-009, REQ-010] (config) Declarar `pillow` en las dependencias y documentar `BEDROCK_VISION_MODEL_ID` y `BEDROCK_REGION` (Art. P3.5) — `backend/requirements.txt`, `backend/.env.example`
- [x] T-042 [REQ-003, AC-003.4, AC-003.5] (impl) Dejar `PayloadTooLargeError` (413) ya traducida a `{"error": …}` por el manejador de errores existente, comprobando que `AppError` la cubre sin cambios en `error_handlers.py` — `backend/exceptions/custom_exceptions.py`
- [x] T-043 [REQ-003, AC-003.1, AC-003.2] (impl) Implementar `detect_photo_format` (bytes mágicos JPEG, PNG y WebP) — `backend/services/meal_photo.py`
- [x] T-044 [REQ-010, AC-010.1] (impl) Implementar `strip_photo_metadata` para JPEG (descarta APP1–APP13, APP15 y COM; conserva APP0, APP14, tablas, SOF, DRI y escaneos; corta tras el primer EOI) — `backend/services/meal_photo.py`
- [x] T-045 [REQ-010, AC-010.2] (impl) Implementar `strip_photo_metadata` para PNG (lista blanca de chunks, corte tras `IEND`) y WebP (descarta `EXIF`, `XMP ` y desconocidos, limpia bits de `VP8X`, recalcula tamaño RIFF); `ValueError` si la estructura no se puede recorrer — `backend/services/meal_photo.py`
- [x] T-046 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-002.3, AC-003.1, AC-003.3, AC-003.4, AC-003.6] (impl) Implementar `prepare_photo`: presencia, 3 MB, formato, apertura con Pillow forzando el formato, dimensiones antes de decodificar, integridad por formato (JPEG `draft`+`load`, PNG `verify`, WebP `load`) y quitado de metadatos — `backend/services/meal_photo.py`
- [x] T-047 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (impl) Implementar `parse_estimated_grams` (`is_number`, `ROUND_HALF_UP`, descartar < 1, tope 2000), `parse_confidence` y `clean_unmatched_name` — `backend/services/meal_image_rules.py`
- [x] T-048 [REQ-001, REQ-006, REQ-008, AC-001.1, AC-001.4, AC-001.5, AC-006.1, AC-006.2, AC-006.3, AC-008.1, AC-008.2] (impl) Implementar `build_analysis` con `portion_nutrients` y `sum_nutrients` del diario, unión de duplicados, tope de 20 y separación en `items` y `unmatched` — `backend/services/meal_image_rules.py`
- [x] T-049 [REQ-001, REQ-006, AC-001.3] (impl) Definir `SYSTEM_PROMPT` (español, sin voseo), `FOODS_TOOL_SCHEMA` e implementar `build_user_prompt` (`id | nombre` de todo el catálogo) — `backend/services/meal_image_rules.py`
- [x] T-050 [REQ-009, AC-009.1, AC-009.4] (impl) Implementar `build_client_config` (conexión 5 s, lectura 30 s, un solo intento), `init_app` y `configured` de `BedrockVisionClient` — `backend/utils/vision_client.py`
- [x] T-051 [REQ-001, REQ-009, AC-001.2, AC-009.2] (impl) Implementar `recognize_foods` (`converse` con imagen, texto y `toolChoice` forzado; extracción del bloque `toolUse`; tokens; `VisionProviderError` ante respuesta no interpretable) — `backend/utils/vision_client.py`
- [x] T-052 [REQ-009, NFR-001, AC-N001.2] (impl) Implementar `describe_vision_error` (solo tipo y código de `ClientError`, nunca `str(exc)`) — `backend/utils/vision_client.py`
- [x] T-053 [NFR-001, AC-N001.1] (impl) Implementar `InMemoryUploadRequest._get_file_stream` (devuelve `io.BytesIO()`) — `backend/utils/in_memory_request.py`
- [x] T-054 [REQ-009, NFR-001, AC-009.4] (config) Asignar `app.request_class = InMemoryUploadRequest` y llamar a `vision_client.init_app(app)` en `create_app` — `backend/app.py`
- [x] T-055 [REQ-001, REQ-005, REQ-009, AC-001.1, AC-005.1, AC-005.3, AC-009.1, AC-009.3] (impl) Implementar `MealImageAnalysisService.analyze`: `prepare_photo`, límite de uso, catálogo, proveedor y saneado, con `except Exception` a `ServiceUnavailableError` y registro seguro del fallo — `backend/services/meal_image_analysis_service.py`
- [x] T-056 [NFR-002, AC-N002.1, AC-N002.2, AC-N002.3, AC-N002.4] (impl) Añadir a `analyze` la traza `meal-image-analysis` (paso `vision` con tokens, puntuaciones `outcome`, `items_count` y `unmatched_count`) fuera del `try` del proveedor y sin traza ante 400 o 429 — `backend/services/meal_image_analysis_service.py`
- [x] T-057 [REQ-001, REQ-002, REQ-003, REQ-004, AC-001.1, AC-002.1, AC-003.5, AC-004.1] (impl) Añadir la ruta `POST /analyze` con `@require_auth`, `request.max_content_length` de 4 MB, lectura de `request.files.getlist("image")` y traducción de `RequestEntityTooLarge` a `PayloadTooLargeError`, `_build_meal_image_analysis_service()` y `_serialize_analysis` — `backend/routes/meal_routes.py`
- [x] T-059 [REQ-009, AC-009.1] (config) Añadir `"--timeout", "90"` al `CMD` de gunicorn (`["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "90", "wsgi:app"]`), sin cambiar workers ni clase de worker, y actualizar el comentario en español del `CMD` (review F1, plan 3.5). Nota: `backend/Dockerfile` no está en los globs de producción del ámbito `backend`; si el role-guard bloquea al implementer, lo aplica el orquestador con autorización del usuario — `backend/Dockerfile`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-012, T-022, T-025 | T-048, T-055, T-057 |
| REQ-001 | AC-001.2 | T-020, T-025 | T-051 |
| REQ-001 | AC-001.3 | T-016, T-022, T-025 | T-049 |
| REQ-001 | AC-001.4 | T-012, T-025 | T-048 |
| REQ-001 | AC-001.5 | T-012, T-025 | T-048 |
| REQ-002 | AC-002.1 | T-017, T-026 | T-046, T-057 |
| REQ-002 | AC-002.2 | T-017, T-026 | T-046 |
| REQ-002 | AC-002.3 | T-017, T-026 | T-046 |
| REQ-002 | AC-002.4 | T-026 | T-057 |
| REQ-003 | AC-003.1 | T-017, T-027 | T-043, T-046 |
| REQ-003 | AC-003.2 | T-017, T-027 | T-043 |
| REQ-003 | AC-003.3 | T-017, T-027 | T-046 |
| REQ-003 | AC-003.4 | T-018, T-027 | T-042, T-046 |
| REQ-003 | AC-003.5 | T-027 | T-042, T-057 |
| REQ-003 | AC-003.6 | T-018, T-027 | T-046 |
| REQ-004 | AC-004.1 | T-028 | T-057 |
| REQ-005 | AC-005.1 | T-022, T-028 | T-055 |
| REQ-005 | AC-005.2 | T-022, T-028 | T-055 |
| REQ-005 | AC-005.3 | T-022, T-028 | T-055 |
| REQ-006 | AC-006.1 | T-013 | T-048 |
| REQ-006 | AC-006.2 | T-013, T-029 | T-048 |
| REQ-006 | AC-006.3 | T-013 | T-048 |
| REQ-007 | AC-007.1 | T-014 | T-047 |
| REQ-007 | AC-007.2 | T-014 | T-047 |
| REQ-007 | AC-007.3 | T-014 | T-047 |
| REQ-007 | AC-007.4 | T-014 | T-047 |
| REQ-008 | AC-008.1 | T-015 | T-048 |
| REQ-008 | AC-008.2 | T-015 | T-048 |
| REQ-009 | AC-009.1 | T-020, T-023, T-029, T-058 | T-050, T-055, T-059 |
| REQ-009 | AC-009.2 | T-020, T-029 | T-051 |
| REQ-009 | AC-009.3 | T-023, T-029 | T-055 |
| REQ-009 | AC-009.4 | T-020, T-029 | T-040, T-050, T-054 |
| REQ-010 | AC-010.1 | T-019, T-030 | T-044 |
| REQ-010 | AC-010.2 | T-019, T-030 | T-045 |
| NFR-001 | AC-N001.1 | T-030 | T-053 |
| NFR-001 | AC-N001.2 | T-021, T-023 | T-052, T-055 |
| NFR-002 | AC-N002.1 | T-024 | T-056 |
| NFR-002 | AC-N002.2 | T-024 | T-056 |
| NFR-002 | AC-N002.3 | T-024, T-030 | T-056 |
| NFR-002 | AC-N002.4 | T-024 | T-056 |
