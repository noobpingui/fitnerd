# Review 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Iteración:** 4 de 4
- **Diff revisado:** `git diff main...feat/024-meal-image-analysis` @ `2f579db`. Sin cambios de código sin commitear: solo `state.json` y `verify-report.md` de la feature, del orquestador. Revisión centrada en `git diff cba4a18 2f579db`, las correcciones de F10 y F11.
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 3 corrige los dos NIT que quedaban abiertos, con un cambio mínimo y sin tocar la spec, los mensajes ni
ningún AC. F11 mueve el control de dimensiones de `prepare_photo` a después de la integridad y del quitado de
metadatos, de modo que el orden coincide con «lectura, dimensiones» de la sección 6 de la spec. F10 añade un test que
fija el descarte del `iCCP` en PNG. No encuentro regresiones ni hallazgos nuevos.

## 2. Cumplimiento de la spec

Fuera de lo que se cita, el código de producción no cambió desde `cba4a18` y la evidencia de las iteraciones anteriores
sigue valiendo.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 – AC-001.5 | Sí | `backend/services/meal_image_rules.py`, `backend/routes/meal_routes.py`, `backend/utils/vision_client.py` (sin cambios) |
| AC-002.1 – AC-002.4 | Sí | `backend/services/meal_photo.py:179-187` (sin cambios) |
| AC-003.1 – AC-003.2 | Sí | `backend/services/meal_photo.py:188-195` (sin cambios) |
| AC-003.3 | Sí (F11 corregido) | `backend/services/meal_photo.py:196-202`: la integridad (`_check_integrity` y `strip_photo_metadata`) va antes de las dimensiones. `test_truncated_photo_with_a_side_over_8000_pixels_is_unreadable` (`test_meal_photo.py:383`), con un PNG sin `IEND` y un JPEG sin `EOI` de 8001 px, da «No se pudo leer la imagen.». |
| AC-003.4 – AC-003.5 | Sí | sin cambios |
| AC-003.6 | Sí | `backend/services/meal_photo.py:203-204`: el mismo mensaje y la misma condición, ahora tras la integridad. Siguen pasando `test_a_side_over_8000_pixels_is_rejected` (`test_meal_photo.py:174`) y `test_a_side_over_8000_pixels_returns_400` (`test_meal_analysis_routes.py:462`), que usan PNG válidos, y `test_webp_validation_does_not_decode_pixels`. |
| AC-004.1 – AC-009.4 | Sí | sin cambios |
| AC-010.1 | Sí (F10 corregido) | Lista blanca de `_strip_png` (sin cambios); ahora la fija `test_png_icc_profile_is_stripped` (`test_meal_photo.py:362`) con `png_bytes(..., icc_profile=…)` (`backend/tests/photo_samples.py:50-64`). |
| AC-010.2 | Sí | sin cambios |
| AC-N001.1 – AC-N002.4 | Sí | sin cambios |

**Regresiones en el orden de validaciones.** He comprobado que mover las dimensiones:
- no cambia ningún mensaje ni código de estado: las dos ramas siguen siendo `ValidationError` (400);
- no reabre el coste de memoria de F2: ni `_check_integrity` ni `strip_photo_metadata` decodifican píxeles, y el recorrido
  es proporcional al archivo, que ya está limitado a 3 MB antes de abrirlo (`meal_photo.py:185-186`);
- no altera el orden respecto al límite de uso ni al proveedor, que van después de `prepare_photo`;
- cierra la imagen también al rechazarla por dimensiones, porque el `finally` va antes.

El único efecto observable es el que pide la spec: un archivo ilegible de más de 8000 px ya no recibe el mensaje de
las dimensiones.

## 3. Cumplimiento del plan

- La implementación sigue la sección 11 del plan y las tareas T-076 a T-079 sin desviaciones: el bloque resultante de
  `prepare_photo` es idéntico al del plan; `png_bytes` recibe `icc_profile` como último parámetro opcional y los
  llamadores actuales no cambian.
- T-077 es de caracterización (verde antes y después), y está justificado en el plan y en el red check (Art. B5.1).
  El test va aparte porque el perfil PNG va comprimido con zlib, y la justificación es correcta.
- ADR-0032 añade una frase sobre F11; no hace falta un ADR nuevo.
- No se toca `backend/Dockerfile`, ni hay migraciones, dependencias ni variables nuevas.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: `snapshot --check` idéntico (8 archivos, snapshot del 2026-10-21T21:29:25Z, registrado en `history` tras el
  red check). `git diff 239571f HEAD -- backend/tests` está vacío: los tests no cambiaron durante implement.
- [x] B4: `# SDD: 024 REQ-010 AC-010.1` en el test de F10 y `# SDD: 024 REQ-003 AC-003.3 AC-003.6` en el de F11
  coinciden con lo que prueban.
- [x] B5: no se borra, salta ni debilita ningún test; los de dimensiones siguen verdes. Sin red ni AWS. Ejecuté
  `test_meal_photo.py` y `test_meal_analysis_routes.py`: pasan los 79 tests. La suite completa pasa (2000, verify-report).
- [x] B5.7: `ruff check` limpio en los tres archivos tocados; el ratchet no da violaciones nuevas (verify-report).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.General y P1.backend: nombres de tests en inglés, docstrings en español, marcadores con número de spec y sin
  `unittest.mock` ni `monkeypatch`.
- [x] P2: sin cambios de capas, de modelos ni de migraciones; las excepciones siguen siendo las de `custom_exceptions.py`.
- [x] P2.General: los mensajes visibles no cambian y siguen en español.
- [x] P3: sin cambios de autorización, validación de entradas más débil ni secretos; la validación queda más estricta en el orden.
- [ ] P4: el paso manual de producción (IAM, variables, IMDS y comprobación de `--timeout 90`) sigue pendiente de la
  etapa `docs`; no bloquea esta revisión.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ CORREGIDO (iteración 1) | `backend/Dockerfile:27` | `--timeout 90`; sin cambios desde entonces. | planner |
| F2 | ~~MENOR~~ CORREGIDO (iteración 2) | `backend/services/meal_photo.py:171-175` | La validación no decodifica píxeles; sin cambios en esta iteración. | planner |
| F3 | ~~MENOR~~ CORREGIDO (iteración 2) | `backend/tests/test_routes/test_meal_analysis_routes.py` | El test prueba el límite de 4 MB del cuerpo. | test-author |
| F4 | ~~MENOR~~ CORREGIDO (iteración 2) | `backend/utils/vision_client.py:59-78` | `init_app` nunca lanza. | implementer |
| F5 | ~~NIT~~ CORREGIDO (iteración 2) | `backend/exceptions/custom_exceptions.py:42` | Comentario en español. | implementer |
| F6 | ~~NIT~~ CORREGIDO (iteración 2) | `backend/utils/vision_client.py:124-126` | Un `input` que no es `dict` da `VisionProviderError`. | implementer |
| F7 | ~~NIT~~ CORREGIDO (iteración 2) | `backend/tests/test_routes/test_meal_analysis_routes.py` | Análisis y consulta del diario con el mismo UUID. | test-author |
| F8 | ~~NIT~~ CORREGIDO (iteración 2) | `backend/services/meal_photo.py` | El ICC se descarta en JPEG, PNG y WebP. Queda la revisión manual de Q9 con alguna foto en Display P3. | planner |
| F9 | ~~NIT~~ CORREGIDO (iteración 2) | `backend/tests/test_services/test_gunicorn_config.py:1-4` | Test renombrado, con docstring de test de configuración del despliegue. | test-author |
| F10 | ~~NIT~~ CORREGIDO (iteración 3) | `backend/tests/test_services/test_meal_photo.py:362-374`, `backend/tests/photo_samples.py:50-64` | `test_png_icc_profile_is_stripped` comprueba que el original lleva `iCCP` y que tras `strip_photo_metadata` desaparece, sin `icc_profile` en `info`, con `load()` correcto y tamaño `(70, 50)`. | test-author |
| F11 | ~~NIT~~ CORREGIDO (iteración 3) | `backend/services/meal_photo.py:196-204` | Las dimensiones se comprueban tras la integridad, como dice la sección 6 de la spec; un truncado de más de 8000 px da «No se pudo leer la imagen.». Sin regresiones en los tests de dimensiones. | planner |

No hay hallazgos nuevos.

## 6. Decisión

**APPROVED.** F10 y F11 están corregidos según la sección 11 del plan, sin cambiar la spec ni los mensajes, y el orden
de validaciones de `prepare_photo` coincide ahora con el de la spec. Los tests no cambiaron durante implement y la
suite pasa. No quedan hallazgos abiertos de ninguna severidad. Siguen pendientes, sin bloquear:
- la revisión manual de precisión con unas 10 fotos reales (Q9) en el gate de `review`, con alguna foto en Display P3 por F8;
- comprobar en producción que un Bedrock lento devuelve 503 y no 502;
- la documentación del paso manual de producción (Art. P4) en la etapa `docs`;
- el `chore/…` que añade `backend/Dockerfile` a los globs `prod`;
- marcar F10 y F11 como resueltos en el backlog de la feature (`specs/024-meal-image-analysis/backlog.md`).
