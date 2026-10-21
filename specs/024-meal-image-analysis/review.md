# Review 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Iteración:** 1 de 4
- **Diff revisado:** `git diff main...feat/024-meal-image-analysis` @ `79810e4` (sin cambios de código sin commitear; solo `backlog.md`, `state.json` y `verify-report.md` de la feature, del orquestador)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen

Añade `POST /api/meals/analyze`: valida la foto (presencia, tamaño, formato real, lectura, dimensiones, integridad), quita
los metadatos a nivel de bytes, aplica el límite de 10 análisis por hora en Redis, envía la foto y el catálogo a Bedrock
`converse` con *tool use* forzado y sanea la respuesta con nombres y macros solo del catálogo. La implementación es
limpia, sigue el plan casi al pie de la letra y la suite pasa (1982). Queda un hallazgo MAYOR: en producción el tiempo
límite de 30 s de REQ-009 choca con el `--timeout` de 30 s por defecto de gunicorn, así que un proveedor lento acaba en
un 502 del proxy y no en el 503 especificado. El resto son hallazgos menores.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/services/meal_image_rules.py:132-152` (nombre y `per_100g` del catálogo, `portion_nutrients`), `backend/routes/meal_routes.py:33-51`; `test_valid_jpeg_returns_the_complete_catalog_response` |
| AC-001.2 | Sí | `backend/utils/vision_client.py:79-89` (imagen y formato detectado); `test_png_and_webp_are_accepted_and_the_provider_receives_their_format` |
| AC-001.3 | Sí | `backend/services/meal_image_rules.py:71-78` (`id | nombre` de todo el catálogo); `test_provider_receives_the_id_and_name_of_the_whole_catalog` |
| AC-001.4 | Sí | `backend/services/meal_image_rules.py:109-152` (orden del proveedor, `sum_nutrients`); `test_items_keep_the_provider_order_and_totals_add_up` |
| AC-001.5 | Sí | `sum_nutrients([])` da ceros; `test_photo_without_food_returns_empty_lists_and_zero_totals` |
| AC-002.1 | Sí | `backend/routes/meal_routes.py:124` (lista vacía si no hay multipart o `image`), `backend/services/meal_photo.py:176-177` |
| AC-002.2 | Sí | `backend/services/meal_photo.py:176`; `test_empty_file_returns_400` |
| AC-002.3 | Sí | `backend/services/meal_photo.py:174-175`; `test_two_files_in_image_return_400` |
| AC-002.4 | Sí | La ruta solo lee `getlist("image")`; `test_additional_form_fields_are_ignored` |
| AC-003.1 | Sí | `backend/services/meal_photo.py:41-49,181-183` (bytes mágicos) |
| AC-003.2 | Sí | Formato por contenido; `test_png_named_jpg_is_sent_to_the_provider_as_png` |
| AC-003.3 | Sí | `backend/services/meal_photo.py:162-169,191-195` (`draft` + `load`, `LOAD_TRUNCATED_IMAGES` en `False`) |
| AC-003.4 | Sí | `backend/services/meal_photo.py:179-180`; tests de 3 MB exactos y +1 |
| AC-003.5 | Sí (test débil, F3) | `backend/routes/meal_routes.py:122-126`; comprobado a mano: imagen pequeña + campo extra de 4 MB → 413 en español |
| AC-003.6 | Sí | `backend/services/meal_photo.py:189-190`, antes de decodificar |
| AC-004.1 | Sí | `@require_auth` en `backend/routes/meal_routes.py:120`; tests sin cabecera, caducado e inválido |
| AC-005.1 | Sí | `backend/services/meal_image_analysis_service.py:37-44` (después de validar, antes del proveedor; los 503 cuentan) |
| AC-005.2 | Sí | Clave `ratelimit:meals:analyze:<user_id>` del token |
| AC-005.3 | Sí | `prepare_photo` antes del limitador; `test_rejected_requests_do_not_count_for_the_limit` |
| AC-006.1 | Sí | `backend/services/meal_image_rules.py:115-125,141-148` (nombre y valores del modelo ignorados) |
| AC-006.2 | Sí | `backend/services/meal_image_rules.py:126-130`; `test_unknown_catalog_id_goes_to_unmatched_end_to_end` |
| AC-006.3 | Sí | `clean_unmatched_name(None)` → descarte |
| AC-007.1 | Sí | `backend/services/meal_image_rules.py:81-89` (`ROUND_HALF_UP`, tope 2000) |
| AC-007.2 | Sí | `is_number` excluye cadenas, `bool`, `NaN` e infinitos; `< 1` → descarte |
| AC-007.3 | Sí | `backend/services/meal_image_rules.py:92-93` |
| AC-007.4 | Sí | `backend/services/meal_image_rules.py:96-100` |
| AC-008.1 | Sí | `backend/services/meal_image_rules.py:116-120` (suma con tope y menor confianza en la primera posición) |
| AC-008.2 | Sí | `entries[:MAX_PROPOSED_FOODS]` tras unir duplicados |
| AC-009.1 | Parcial (F1) | Con el doble, sí: `backend/services/meal_image_analysis_service.py:78-84`. En producción, un proveedor que tarde cerca de 30 s acaba en 502 del proxy, no en el 503 |
| AC-009.2 | Sí | `backend/utils/vision_client.py:106-121` |
| AC-009.3 | Sí | `backend/services/meal_image_analysis_service.py:53-55` |
| AC-009.4 | Sí | `backend/utils/vision_client.py:56-66,77-78` |
| AC-010.1 | Sí | `backend/services/meal_photo.py:52-96` (descarta APP1–APP13, APP15 y COM; corta en el primer EOI) |
| AC-010.2 | Sí | `backend/services/meal_photo.py:99-116` (lista blanca de chunks) |
| AC-N001.1 | Sí | Sin `UnitOfWork` ni escrituras; `InMemoryUploadRequest` (`backend/utils/in_memory_request.py:8-13`, `backend/app.py:22`) |
| AC-N001.2 | Sí | `describe_vision_error` (`backend/utils/vision_client.py:35-42`), `step.fail` con excepción saneada, `logger.error` sin `exc_info`, `raise … from None` |
| AC-N002.1 | Sí | `backend/services/meal_image_analysis_service.py:48-76,86-91` (usuario, formato, tamaño, tokens, recuentos, `outcome`) |
| AC-N002.2 | Sí | `outcome` `empty`/`error` |
| AC-N002.3 | Sí | Sin traza antes de validar ni con 429 |
| AC-N002.4 | Sí | Trazas fuera del `try` del proveedor; `Tracer` autoprotegido |

## 3. Cumplimiento del plan

- La implementación sigue el plan (secciones 3.2 y 3.3) en contratos, orden de comprobaciones y saneado.
- Desviaciones menores y justificadas:
  - el import de `FOODS_TOOL_NAME` y `FOODS_TOOL_SCHEMA` es local en `recognize_foods` (`backend/utils/vision_client.py:76`) para evitar un ciclo de importación; está anotado en el backlog;
  - `RATE_LIMIT_KEY_PREFIX` es una constante extra;
  - `pillow` la añadió a `requirements.txt` el orquestador con autorización del usuario (el role-guard no deja al implementer).
- El plan no contempla el `--timeout` de gunicorn (F1). En la sección 6 da como mitigación del coste de decodificar un WebP grande que «el límite de 10 análisis por hora acota el abuso», y eso no es cierto (F2).
- La documentación del paso manual de producción (Art. P4) está asignada a la etapa `docs`: todavía no está y no es un hallazgo de esta revisión.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol; `snapshot --check` idéntico (7 archivos) y `git diff 5d99e15 HEAD -- backend/tests` vacío. El backlog recoge una edición desde la shell del test-author en la etapa de tests, anterior al snapshot y ya conocida por el usuario.
- [x] B4: los marcadores `SDD: 024 …` son coherentes con los AC que prueban (40 de 40).
- [x] B5: ningún test borrado, saltado ni debilitado; sin llamadas reales a AWS, Redis ni Langfuse; no queda ningún `not implemented`.
- [x] B5.7: ratchet de ruff sin violaciones nuevas (verify-report).
- [x] B6.5: sin secretos; `BEDROCK_VISION_MODEL_ID` y `BEDROCK_REGION` documentadas en `backend/.env.example` y `config.py`.

### Parte II (proyecto)
- [x] P1.1–P1.5 (backend): marcadores con número de spec, tests en `test_services/` y `test_routes/`, nombres en inglés, docstrings en español, fakes a mano sin `unittest.mock` ni `monkeypatch`.
- [x] P2.1: la ruta solo fija el límite, extrae bytes, llama al servicio y serializa; sin `commit`.
- [x] P2.2: dependencias por constructor, `_build_meal_image_analysis_service()` y singleton `vision_client` en `extensions.py`.
- [x] P2.3: errores con `PayloadTooLargeError`, `ValidationError`, `RateLimitError` y `ServiceUnavailableError`; ningún error construido a mano.
- [x] P2.4: sin cambios de modelo; no hace falta migración (comprobado: ningún archivo de `models/` ni de `migrations/` en el diff).
- [x] P2.5: reutiliza `RateLimiter`, `Tracer`, `CatalogFoodRepository.list_all`, `portion_nutrients`, `sum_nutrients` e `is_number`.
- [ ] P2.General.1: hay un comentario nuevo en inglés (F5, NIT).
- [x] P3.1: `@require_auth` y `user_id` del token.
- [x] P3.2: la foto y la salida del modelo se validan en servicios.
- [x] P3.3: límite de uso en Redis y fallos del proveedor como `ServiceUnavailableError`, pero ver F1 y F2.
- [x] P3.4: sin SQL a mano.
- [x] P3.5: variables documentadas.
- [ ] P4: el paso manual de producción (IAM `bedrock:InvokeModel`, acceso al modelo, variables, límite de saltos de IMDS) queda pendiente de la etapa `docs`.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `backend/utils/vision_client.py:27-32`, `backend/Dockerfile:22` | REQ-009 y AC-009.1 piden un 503 con el mensaje en español si el proveedor no responde en 30 s. En producción el backend corre con `gunicorn --bind 0.0.0.0:5000 wsgi:app`, sin `--timeout`: el valor por defecto es 30 s, y un worker *sync* que pasa 30 s en una petición se mata. La espera con Bedrock llega a 5 s de conexión más 30 s de lectura, y `read_timeout` mide el tiempo entre lecturas del socket, no el total. Si el modelo tarda cerca de 30 s, gunicorn mata el worker antes de que salte el `ReadTimeoutError`: Caddy responde 502 sin cuerpo `{"error": …}`, la traza no se cierra con `error` y el intento ya contó para el límite. Además, con un solo worker *sync*, cada análisis bloquea al resto de la API mientras dura. Hay que fijar un presupuesto total coherente, por ejemplo subir `--timeout` de gunicorn por encima de connect + read (y documentarlo), o bajar los tiempos de Bedrock por debajo del de gunicorn y ajustar el «30 segundos» de la spec. Ningún test lo cubre porque los tests no pasan por gunicorn. | planner |
| F2 | MENOR | `backend/services/meal_photo.py:168-169`, `backend/services/meal_image_analysis_service.py:37-38` | La integridad del WebP se comprueba con `image.load()`, que decodifica la imagen entera, y se hace **antes** del límite de uso (por diseño: AC-005.3). Comprobado: un WebP *lossless* de 8000 × 8000 de color liso ocupa **2.506 bytes**, pasa la validación y obliga a reservar unos **256 MB** y 0,37 s de CPU en cada petición. Las peticiones que reciben 429 también se decodifican antes del 429, así que el límite de 10 por hora no acota este coste, al contrario de lo que dice la sección 6 del plan. Opciones: comprobar el WebP solo por estructura (`_strip_webp` ya recorre los chunks), poner un tope de píxeles más bajo para decodificar o aplicar un límite de peticiones barato antes de validar. Ya hay una entrada parecida en el backlog («límite global de memoria o concurrencia»), pero con la justificación equivocada. | planner |
| F3 | MENOR | `backend/tests/test_routes/test_meal_analysis_routes.py:419-427` | `test_request_body_over_4_mb_returns_413_in_spanish` (AC-003.5) envía en `image` un archivo de más de 4 MB, que ya supera los 3 MB. Si se quitara `request.max_content_length` de la ruta, `prepare_photo` respondería igualmente 413 con el mismo mensaje y el test seguiría pasando: no prueba el límite del cuerpo. Debería enviar una imagen válida pequeña y otro campo de más de 4 MB (lo comprobé a mano: hoy da 413 con el mensaje en español). | test-author |
| F4 | MENOR | `backend/config.py:94`, `backend/utils/vision_client.py:61-66` | `BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")` devuelve `""` si la variable existe vacía. Con `BEDROCK_VISION_MODEL_ID` puesto, `boto3.client(..., region_name="")` lanza al crear el cliente dentro de `create_app` y el backend no arranca. Eso contradice la sección 6 de la spec («sin esa configuración el endpoint responde 503 y el resto de la app funciona igual»). Conviene usar `os.getenv("BEDROCK_REGION") or "us-east-1"` o capturar el fallo de `init_app` y dejar el proveedor sin configurar. | implementer |
| F5 | NIT | `backend/exceptions/custom_exceptions.py:42` | Comentario nuevo en inglés (`#Exception raised when the request body…`). Art. P2.General.1 pide los comentarios en español, aunque el resto del archivo ya esté en inglés. | implementer |
| F6 | NIT | `backend/utils/vision_client.py:112` | `(tool_use.get("input") or {}).get("foods")` lanza `AttributeError` si `input` no es un `dict`. Acaba igualmente en 503 por el `except Exception` del servicio, pero se registra como `AttributeError` en lugar de `VisionProviderError: unexpected vision response`. | implementer |
| F7 | NIT | `backend/tests/test_routes/test_meal_analysis_routes.py:651-657` | En AC-N001.1, el diario se consulta con un usuario (`5f0c…`) distinto del que hizo los análisis (`user-1`), así que esa parte de la aserción no prueba nada. El recuento de filas de todas las tablas sí cubre el AC. | test-author |
| F8 | NIT | `backend/services/meal_photo.py:80` | Al descartar APP2 se pierde también el perfil ICC del JPEG (fotos Display P3 de iPhone): el modelo verá colores algo desaturados. Ya está previsto en el plan; conviene comprobarlo en la revisión manual de Q9. | planner |

## 6. Decisión

**CHANGES_REQUESTED.** F1 (MAYOR): en producción no se cumple el 503 de REQ-009 ante un proveedor lento, por la
interacción con el `--timeout` por defecto de gunicorn. Tiene que corregirlo primero el `planner`, decidiendo el
presupuesto de tiempo y su configuración, y después el `implementer`.

Los MENORES (F2–F4) pueden corregirse ahora o pasar al backlog con la aprobación del usuario. Sigue pendiente, sin
bloquear, la revisión manual de precisión con unas 10 fotos reales (Q9) en el gate de `review`, y la documentación del
paso manual de producción (Art. P4) en la etapa `docs`.
