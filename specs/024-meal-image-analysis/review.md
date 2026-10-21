# Review 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Iteración:** 2 de 4
- **Diff revisado:** `git diff main...feat/024-meal-image-analysis` @ `e83804b`. Sin cambios de código sin commitear: solo `backlog.md`, `state.json` y `verify-report.md` de la feature, del orquestador. Revisión centrada en `git diff 79810e4 e83804b`, la corrección de F1.
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 1 corrige F1 (MAYOR). Gunicorn arranca ahora con `--timeout 90` en el `CMD` de `backend/Dockerfile:27`,
por encima del peor caso del servidor (unos 38 s: 5 s de conexión y 30 s de lectura de Bedrock, más la validación y las
credenciales). Así, un Bedrock lento vuelve a acabar en el 503 con JSON de REQ-009 y no en un 502 de Caddy. Un test
nuevo de configuración (T-058) evita que vuelva a pasar. El plan (sección 3.5) y el ADR-0032 justifican la decisión,
incluido mantener un solo worker *sync*. Fuera de eso, el diff solo toca artefactos de la feature y documentación: no
hay regresiones. Quedan abiertos los hallazgos MENOR y NIT de la iteración anterior, que ya están en el backlog.

## 2. Cumplimiento de la spec

Fuera de AC-009.1, el código de producción no cambió desde `79810e4`. La evidencia de la iteración 1 sigue valiendo y
aquí se resume.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 – AC-001.5 | Sí | `backend/services/meal_image_rules.py:71-152`, `backend/routes/meal_routes.py:33-51`, `backend/utils/vision_client.py:79-89` |
| AC-002.1 – AC-002.4 | Sí | `backend/routes/meal_routes.py:124`, `backend/services/meal_photo.py:174-177` |
| AC-003.1 – AC-003.6 | Sí (el test de AC-003.5 es débil, F3) | `backend/services/meal_photo.py:41-49,162-195`, `backend/routes/meal_routes.py:122-126` |
| AC-004.1 | Sí | `@require_auth` en `backend/routes/meal_routes.py:120` |
| AC-005.1 – AC-005.3 | Sí | `backend/services/meal_image_analysis_service.py:37-44` |
| AC-006.1 – AC-006.3 | Sí | `backend/services/meal_image_rules.py:115-148` |
| AC-007.1 – AC-007.4 | Sí | `backend/services/meal_image_rules.py:81-100` |
| AC-008.1 – AC-008.2 | Sí | `backend/services/meal_image_rules.py:116-120`, `entries[:MAX_PROPOSED_FOODS]` |
| AC-009.1 | **Sí** (antes, Parcial) | `backend/utils/vision_client.py:9-10,27-32` (5 s de conexión, 30 s de lectura, un solo intento), `backend/services/meal_image_analysis_service.py:78-84` (503) y `backend/Dockerfile:27` (`--timeout 90`). Comprobado que `docker-compose.prod.yml` no sobrescribe el `command` del servicio `backend`, que nadie define `GUNICORN_CMD_ARGS` y que el `Caddyfile` usa `reverse_proxy backend:5000` sin tiempo límite de respuesta. Test `test_gunicorn_timeout_exceeds_the_vision_provider_budget` en verde. |
| AC-009.2 – AC-009.4 | Sí | `backend/utils/vision_client.py:56-66,77-78,106-121`, `backend/services/meal_image_analysis_service.py:53-55` |
| AC-010.1 – AC-010.2 | Sí | `backend/services/meal_photo.py:52-116` |
| AC-N001.1 – AC-N001.2 | Sí | `backend/utils/in_memory_request.py:8-13`, `backend/app.py:22`, `backend/utils/vision_client.py:35-42` |
| AC-N002.1 – AC-N002.4 | Sí | `backend/services/meal_image_analysis_service.py:48-91` |

## 3. Cumplimiento del plan

- La corrección sigue al pie de la letra la sección 3.5 del plan y las tareas T-058 y T-059:
  - un único `--timeout 90`, sin cambiar workers ni la clase de worker;
  - comentario en español en el `CMD`;
  - test puro que lee el `CMD` con `json.loads` y lo compara con `VISION_CONNECT_TIMEOUT_SECONDS + VISION_TIMEOUT_SECONDS + 30`.
- El plan corrige además la mitigación de la sección 6 que señaló F2: ya no dice que el límite de 10 por hora acota el
  coste de decodificar, y deja la corrección en el backlog.
- Desviación de proceso, justificada y anotada en el backlog: `backend/Dockerfile` lo editó el orquestador con
  autorización explícita del usuario, porque está fuera de los globs `prod` de `.sdd/config.json` y el role-guard
  bloqueó al implementer. El cambio coincide exactamente con T-059. Queda pendiente un `chore/…` para añadir el
  archivo a esos globs.
- La documentación del paso manual de producción (Art. P4), que ahora incluye comprobar el `--timeout 90` tras
  desplegar, sigue asignada a la etapa `docs`.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: `snapshot --check` idéntico (8 archivos, snapshot del 2026-10-21T20:10:20Z tras añadir T-058, con `rework` y
  `snapshot` registrados en `history`); `git diff 459110b HEAD -- backend/tests` vacío: los tests no cambiaron durante
  implement. La edición del `Dockerfile` por el orquestador está autorizada y anotada.
- [x] B4: `# SDD: 024 REQ-009 AC-009.1` en `backend/tests/test_services/test_server_timeout.py:20`, coherente con lo
  que prueba.
- [x] B5: ningún test borrado, saltado ni debilitado; T-058 no usa red ni servicios externos; la suite pasa (1983) y
  he vuelto a ejecutar `test_server_timeout.py` y `test_vision_client.py` (18 pasan).
- [x] B5.7: ratchet sin violaciones nuevas (verify-report, iteración 2).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1–P1.5 (backend): marcador con número de spec, nombre en inglés, sin `unittest.mock` ni `monkeypatch`.
- [x] P2.1–P2.5: sin cambios de capas en esta iteración; lo revisado en la iteración 1 sigue igual.
- [ ] P2.General.1: el comentario en inglés de `backend/exceptions/custom_exceptions.py:42` sigue abierto (F5, NIT).
  El comentario nuevo del `Dockerfile` está en español, sin tildes, como el resto del archivo.
- [x] P3.1–P3.5: sin cambios. P3.3 (fallos del proveedor → `ServiceUnavailableError`) ahora también se cumple en
  producción ante un proveedor lento.
- [ ] P4: el paso manual de producción sigue pendiente de la etapa `docs`, que también debe incluir la comprobación
  de `--timeout 90`.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ CORREGIDO | `backend/Dockerfile:27`, `backend/tests/test_services/test_server_timeout.py:21-36` | Corregido: gunicorn arranca con `--timeout 90`, por encima de 5 + 30 s de Bedrock, y T-058 lo protege. Ni el compose de producción ni el `Caddyfile` lo anulan. El comportamiento real (503 y no 502 ante un Bedrock lento) solo se puede comprobar tras desplegar; está en el backlog del verifier. | planner |
| F2 | MENOR | `backend/services/meal_photo.py:168-169`, `backend/services/meal_image_analysis_service.py:37-38` | Sigue abierto. Un WebP *lossless* de 8000 × 8000 que ocupa unos 2,5 KB se decodifica entero con `image.load()` antes del límite de uso: reserva unos 256 MB y gasta 0,37 s de CPU en cada petición, también en las que acaban en 429. El plan ya no dice que el límite lo acote, y el único worker *sync* evita decodificar dos fotos a la vez. La corrección (comprobar el WebP solo por su estructura, bajar el tope de píxeles o poner un límite barato antes de validar) está en el backlog. | planner |
| F3 | MENOR | `backend/tests/test_routes/test_meal_analysis_routes.py:419-427` | Sigue abierto. El test de AC-003.5 envía un archivo de más de 4 MB, que ya supera los 3 MB de la imagen, así que no prueba el límite de 4 MB del cuerpo. Debería enviar una imagen pequeña y otro campo grande. | test-author |
| F4 | MENOR | `backend/config.py:94`, `backend/utils/vision_client.py:61-66` | Sigue abierto. Si `BEDROCK_REGION` existe pero está vacía y el modelo está configurado, `boto3.client(region_name="")` falla en `create_app` y el backend no arranca, en lugar de dejar el endpoint en 503. | implementer |
| F5 | NIT | `backend/exceptions/custom_exceptions.py:42` | Sigue abierto: comentario nuevo en inglés (Art. P2.General.1). | implementer |
| F6 | NIT | `backend/utils/vision_client.py:112` | Sigue abierto. Si `input` no es un `dict`, salta un `AttributeError` en lugar de `VisionProviderError`; la respuesta sigue siendo 503. | implementer |
| F7 | NIT | `backend/tests/test_routes/test_meal_analysis_routes.py:651-657` | Sigue abierto. En AC-N001.1, el diario se consulta con un usuario distinto del que hizo los análisis. | test-author |
| F8 | NIT | `backend/services/meal_photo.py:80` | Sigue abierto. Al descartar APP2 se pierde el perfil ICC del JPEG; conviene comprobarlo en la revisión manual de Q9. | planner |
| F9 | NIT | `backend/tests/test_services/test_server_timeout.py:1` | Nuevo. T-058 es un test de configuración del despliegue y está en `test_services/`, aunque no prueba ningún servicio. Funciona igual, pero sería más fácil de encontrar en una carpeta o un archivo de configuración. | test-author |

## 6. Decisión

**APPROVED.** F1, el único hallazgo MAYOR, está corregido: el `--timeout 90` está en el `CMD` real de producción,
nada lo anula, el test lo protege y la decisión está justificada en el plan y en el ADR-0032. No quedan hallazgos
BLOQUEANTES ni MAYORES. Los MENORES (F2–F4) y los NIT (F5–F9) pueden ir al backlog con la aprobación del usuario. Siguen
pendientes, sin bloquear:
- la revisión manual de precisión con unas 10 fotos reales (Q9) en el gate de `review`;
- comprobar en producción que un Bedrock lento devuelve 503 y no 502;
- la documentación del paso manual de producción (Art. P4) en la etapa `docs`;
- el `chore/…` que añade `backend/Dockerfile` a los globs `prod`.
