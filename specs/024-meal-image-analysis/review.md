# Review 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Iteración:** 3 de 4
- **Diff revisado:** `git diff main...feat/024-meal-image-analysis` @ `cba4a18`. Sin cambios de código sin commitear: solo `state.json` y `verify-report.md` de la feature, del orquestador. Revisión centrada en `git diff e83804b cba4a18`, las correcciones de F2 a F9.
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 2 corrige todos los hallazgos abiertos (F2–F9) sin cambiar la spec ni el orden de validaciones. Lo más
importante es F2: la validación ya no decodifica píxeles en ningún formato. PNG se comprueba con `verify()`, JPEG con el
recorrido de segmentos (exige un `SOF` admitido, un `SOS` y un `EOI`) y WebP con el *demuxer* de libwebp y el
recorrido RIFF. También se corrigen F4 (`init_app` ya no impide arrancar la app), F6 (`input` que no es objeto da 503 con
`VisionProviderError`) y F8 (el perfil ICC se descarta en los tres formatos). Los tests de F3, F7 y F9 ahora prueban lo
que dicen. No encuentro regresiones; quedan dos NIT nuevos.

## 2. Cumplimiento de la spec

Fuera de lo que se cita, el código de producción no cambió desde `e83804b` y la evidencia de las iteraciones anteriores
sigue valiendo.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 – AC-001.5 | Sí | `backend/services/meal_image_rules.py`, `backend/routes/meal_routes.py`, `backend/utils/vision_client.py:84-136` (sin cambios de comportamiento) |
| AC-002.1 – AC-002.4 | Sí | `backend/services/meal_photo.py:181-184`; AC-002.4 también con el archivo extra de 3,5 MB de `test_request_body_under_4_mb_with_an_extra_file_is_analyzed` |
| AC-003.1 – AC-003.2 | Sí | `backend/services/meal_photo.py:41-49,188-195` (`formats=[…]` forzado) |
| AC-003.3 | Sí | JPEG truncado: `meal_photo.py:103-107` (sin `EOI`); sin escaneo o proceso no admitido: `meal_photo.py:69-79`; PNG: `verify()` en `meal_photo.py:175-176` y `IEND` en `:127`; WebP: *demuxer* al abrir y `meal_photo.py:133-144`. Lo he comprobado a mano con un JPEG, un PNG y un WebP truncados (también un WebP truncado con el tamaño RIFF reescrito): los cuatro dan 400 «No se pudo leer la imagen.». |
| AC-003.4 | Sí | `backend/services/meal_photo.py:186-187` |
| AC-003.5 | Sí (el test ya prueba el límite del cuerpo, F3) | `test_request_body_over_4_mb_returns_413_in_spanish` (foto pequeña + archivo extra de 4 MB → 413) y `test_request_body_under_4_mb_with_an_extra_file_is_analyzed` (3,5 MB → 200) |
| AC-003.6 | Sí | `backend/services/meal_photo.py:196-197`. Un WebP *lossless* de 8000 × 8000 (38 bytes) se valida en 0,00 s con un pico de `tracemalloc` de 4,4 KB, y un JPEG progresivo de 8000 × 6000 en 0,016 s: ya no se decodifica. |
| AC-004.1 | Sí | `@require_auth` en `backend/routes/meal_routes.py` (sin cambios) |
| AC-005.1 – AC-005.3 | Sí | `backend/services/meal_image_analysis_service.py` (sin cambios) |
| AC-006.1 – AC-008.2 | Sí | `backend/services/meal_image_rules.py` (sin cambios) |
| AC-009.1 | Sí | `backend/Dockerfile:27` (`--timeout 90`, sin cambios en esta iteración), test movido a `backend/tests/test_services/test_gunicorn_config.py` |
| AC-009.2 | Sí (F6 corregido) | `backend/utils/vision_client.py:124-126` |
| AC-009.3 | Sí | sin cambios |
| AC-009.4 | Sí (F4 corregido) | `backend/utils/vision_client.py:59-78`: `client = None` al empezar, región saneada con `strip()`, sin región no llama a la fábrica y la fábrica va en `try … except Exception` con `describe_vision_error` (nunca `str(exc)`). `test_app_with_an_empty_bedrock_region_starts_and_answers_503` prueba `create_app` real con `BEDROCK_REGION=""`. |
| AC-010.1 | Sí (F8 corregido) | JPEG: `APP2` fuera por `meal_photo.py:90`; PNG: `iCCP` fuera de la lista blanca `meal_photo.py:22-27`; WebP: `ICCP` fuera de `meal_photo.py:28` y bit `0x20` de `VP8X` borrado en `:150`. Comprobado también con un WebP animado con ICC: sale sin perfil, con sus 3 fotogramas y legible. |
| AC-010.2 | Sí | `backend/services/meal_photo.py:110-127` |
| AC-N001.1 – AC-N001.2 | Sí | sin cambios; el test de AC-N001.1 ya consulta el diario con el mismo usuario (F7) |
| AC-N002.1 – AC-N002.4 | Sí | sin cambios |

## 3. Cumplimiento del plan

- La implementación sigue la sección 10 del plan y las tareas T-060 a T-075, sin desviaciones:
  - F2: `_check_integrity` solo llama a `verify()` en PNG, y `_strip_jpeg` rechaza los `SOF` fuera de `FFC0`–`FFC2` (sin
    afectar a `FFC4`, `FFC8` ni `FFCC`) y el `EOI` sin `SOF` y `SOS`;
  - F4: `init_app` como en la sección 3.2;
  - F5: el comentario de `PayloadTooLargeError` está en español;
  - F6: `isinstance(tool_input, dict)` antes de leer `foods`;
  - F8: WebP sin `ICCP` y sin el bit `0x20`.
- El plan dice que en esta iteración no se toca `backend/Dockerfile`, y así es: no aparece en `git diff e83804b HEAD`.
- ADR-0032 y su línea del índice se amplían con F2, F4 y F8. Las decisiones que no cambian la spec (aceptar que un
  archivo con estructura correcta y píxeles corruptos llegue al proveedor, y que el `calloc` de libwebp no ocupe memoria
  residente con glibc) están en la sección 3.3 y los riesgos del plan, y en el backlog de la feature.
- Desviación de proceso, justificada y anotada en el backlog: el orquestador borró `test_server_timeout.py` con
  `git rm` y autorización explícita del usuario, porque el test-author no puede borrar archivos. El contenido sigue en
  `test_gunicorn_config.py`, al que solo se añade un docstring de módulo, y el test no cambia.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: `snapshot --check` idéntico (8 archivos, snapshot del 2026-10-21T21:02:30Z). El `rework tests` de la E501 y
  su `snapshot` posterior están en `history`. `git diff d2e5273 HEAD -- backend/tests` está vacío: los tests no
  cambiaron durante implement. El borrado de `test_server_timeout.py` está autorizado y anotado.
- [x] B4: los marcadores nuevos (`# SDD: 024 REQ-003 AC-003.3/AC-003.5/AC-003.6`, `REQ-009 AC-009.2/AC-009.4`,
  `REQ-010 AC-010.1`) coinciden con lo que prueba cada test. El de `test_webp_validation_does_not_decode_pixels`
  (AC-003.6) protege el coste de validar a las dimensiones admitidas; es razonable.
- [x] B5: no se borra, salta ni debilita ningún test. F3 y F7 refuerzan dos tests y F9 solo los renombra. Sin red
  ni AWS: `FakeClientFactory`, `WrongShapeClient` local y `FakeRedisClient`. Ejecuté los seis archivos de la feature:
  pasan los 180 tests. La suite completa pasa (1997, verify-report).
- [x] B5.7: `ruff check` limpio en los siete archivos tocados de producción y de tests; el ratchet no da violaciones nuevas (verify-report).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.General.1–2 y P1.backend.1–5: los marcadores llevan el número de spec, los nombres de los tests están en
  inglés y los docstrings en español. No se usan `unittest.mock` ni `monkeypatch`, porque los dobles se inyectan por
  constructor o en atributos de singletons, que los fixtures autouse restauran. `tracemalloc` mide y no sustituye nada.
- [x] P2.1–P2.3: sin cambios de capas; las excepciones siguen siendo las de `custom_exceptions.py`.
- [x] P2.4: sin cambios de modelo ni migraciones (`git diff main...HEAD -- backend/migrations backend/models` vacío en la feature).
- [x] P2.5: el aviso de `init_app` reutiliza `describe_vision_error`; no se duplica nada.
- [x] P2.General.1: el comentario de `backend/exceptions/custom_exceptions.py:42` (F5), el de `meal_photo.py:173-174` y los avisos del log están en español.
- [x] P3.1–P3.5: sin cambios. P3.3 sale reforzado, porque una región vacía o inválida ya no tumba la app y deja el endpoint en 503.
- [ ] P4: el paso manual de producción (IAM, variables, IMDS y comprobación de `--timeout 90`) sigue pendiente de la
  etapa `docs`; no bloquea esta revisión.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ CORREGIDO (iteración 1) | `backend/Dockerfile:27` | Sin cambios desde la iteración anterior. | planner |
| F2 | ~~MENOR~~ CORREGIDO | `backend/services/meal_photo.py:69-79,172-176` | La validación ya no decodifica píxeles: no hay `load()` ni `draft()`. Mi prueba, un WebP *lossless* de 8000 × 8000 de 38 bytes, se valida al instante con un pico de 4,4 KB. Los truncados de los tres formatos siguen dando 400. `test_webp_validation_does_not_decode_pixels` evita que se vuelva a decodificar. | planner |
| F3 | ~~MENOR~~ CORREGIDO | `backend/tests/test_routes/test_meal_analysis_routes.py:418-447` | El test envía una foto pequeña con un archivo extra de 4 MB (413) y de 3,5 MB (200): prueba el límite de 4 MB del cuerpo. | test-author |
| F4 | ~~MENOR~~ CORREGIDO | `backend/utils/vision_client.py:59-78` | `init_app` nunca lanza. El test de rutas crea una app real con `BEDROCK_REGION=""` y obtiene 503. | implementer |
| F5 | ~~NIT~~ CORREGIDO | `backend/exceptions/custom_exceptions.py:42` | El comentario está en español. | implementer |
| F6 | ~~NIT~~ CORREGIDO | `backend/utils/vision_client.py:124-126` | Un `input` que no es `dict` da `VisionProviderError`. | implementer |
| F7 | ~~NIT~~ CORREGIDO | `backend/tests/test_routes/test_meal_analysis_routes.py:674-692` | Los análisis y la consulta del diario usan el mismo UUID. | test-author |
| F8 | ~~NIT~~ CORREGIDO | `backend/services/meal_photo.py:28,150` | El perfil ICC se descarta en JPEG, PNG y WebP, con la justificación frente a REQ-010 en el plan (sección 3.3) y en ADR-0032. Queda comprobar en la revisión manual de Q9, con alguna foto en Display P3, que la precisión no empeora. | planner |
| F9 | ~~NIT~~ CORREGIDO | `backend/tests/test_services/test_gunicorn_config.py:1-4` | El test está renombrado y lleva un docstring que dice que es un test de configuración del despliegue. | test-author |
| F10 | NIT | `backend/tests/test_services/test_meal_photo.py:341-358` | `test_icc_profile_is_stripped` solo cubre `jpeg` y `webp`. El descarte de `iCCP` en PNG solo lo garantiza la lista blanca de `_strip_png`, sin un test que lo fije. Bastaría añadir el caso `png`, o un helper `png_bytes(icc_profile=…)`, para que los tres formatos queden protegidos igual, como pide F8. | test-author |
| F11 | NIT | `backend/services/meal_photo.py:196-202` | La sección 6 de la spec fija el orden «lectura, dimensiones», pero el código comprueba las dimensiones (`:196`) antes de la integridad (`:199`). Un archivo truncado de más de 8000 px responde «…8000 píxeles por lado» en lugar de «No se pudo leer la imagen.». Las dos respuestas son 400 y solo pasa con archivos fabricados. El orden venía del plan para no decodificar imágenes enormes, y desde F2 ya no se decodifica: se podría mover `_check_integrity` y `strip_photo_metadata` antes del control de dimensiones sin coste. | planner |

## 6. Decisión

**APPROVED.** Los hallazgos F2 a F9 están corregidos según el plan, sin cambiar la spec, y no hay regresiones:

- los truncados de los tres formatos siguen dando 400 (AC-003.3);
- 8000 × 6000 se analiza (AC-003.6);
- el ICC se descarta en los tres formatos y la imagen sigue legible (REQ-010);
- `create_app` arranca con la región vacía y responde 503 (AC-009.4).

Los tests no cambiaron durante implement y la suite pasa. No quedan hallazgos BLOQUEANTES ni MAYORES. Los NIT F10 y
F11 pueden ir al backlog con la aprobación del usuario. Siguen pendientes, sin bloquear:
- la revisión manual de precisión con unas 10 fotos reales (Q9) en el gate de `review`, con alguna foto en Display P3 por F8;
- comprobar en producción que un Bedrock lento devuelve 503 y no 502;
- la documentación del paso manual de producción (Art. P4) en la etapa `docs`;
- el `chore/…` que añade `backend/Dockerfile` a los globs `prod`.
