# Review 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...feat/016-past-date-measurements` @ `3527d19` (+ cambios sin commitear solo en `specs/016-past-date-measurements/backlog.md`, `state.json` y `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen

La feature añade en Métricas el diálogo "Registrar medición" con fecha (hasta 365 días atrás), un límite de 366 días hacia atrás en el servidor, la relectura del perfil tras cualquier registro y el aviso de 008 F2 en "Datos físicos". El cambio es pequeño, sigue el plan casi al pie de la letra y reutiliza bien lo que ya había (`invalidateMetricsAndProfile`, `NumberField`, `fieldMessages`, `LIMITS`, `FAT_LIMITS` y `MUSCLE_LIMITS`). Los tests no cambiaron después del snapshot y prueban de verdad los AC. Solo hay hallazgos menores y NIT.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.2 | Sí | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:79-83`: un solo botón, visible con y sin mediciones; tests de FREG |
| AC-001.3, AC-001.4, AC-001.6, AC-001.7 | Sí | `RegisterMetricDialog.tsx:47-49` (fecha de hoy y campos vacíos), `:82-87` (título y ayuda), `:110-111` (`Peso (${weightUnit})`); `BodyMetricsPage.tsx:51` (`kg` sin perfil) |
| AC-001.5 | Sí | `RegisterMetricDialog.tsx:159-166` (`type="button"` y `onClose`); el diálogo se monta en cada apertura (`BodyMetricsPage.tsx:86-92`) |
| AC-002.1 a AC-002.6 | Sí | `frontend/src/features/body-metrics/schemas.ts:99-161` (`superRefine` con los mensajes de la sección 6 y los mismos límites que la corrección); `RegisterMetricDialog.tsx:168` ("Guardar" deshabilitado) |
| AC-002.7 | Sí | `RegisterMetricDialog.tsx:94-95` (`min` = hoy − 365, `max` = hoy); `frontend/src/lib/dates.ts:12-19` (`shiftIsoDate` en UTC) |
| AC-003.1 a AC-003.3 | Sí | `schemas.ts:167-186` (`registrationPayload`: claves ausentes, no `null`; redondeo a un decimal en kg) |
| AC-003.4, AC-003.9 | Sí | `useCreateBodyMetric` espera la recarga (`frontend/src/features/body-metrics/hooks.ts:36-38`) y el diálogo se cierra después (`RegisterMetricDialog.tsx:62-71`) |
| AC-003.5 | Sí | `RegisterMetricDialog.tsx:63`, `:168-169` |
| AC-003.6, AC-N002.2 | Sí | `RegisterMetricDialog.tsx:66-68` (el error no cierra) y `:153-157` (`role="alert"`) |
| AC-003.7, AC-003.8 | Sí (regresión) | `save_metric` sin cambios; tests BS y BR en verde |
| AC-004.1 a AC-004.3 | Sí | `RegisterMetricDialog.tsx:54`, `:103-109`; el aviso no interviene en `allValid` |
| AC-005.1 a AC-005.3 | Sí | `backend/services/body_metric_service.py:22`, `:24`, `:73-74`: límite inclusivo `today - 366`, comprobado después de la fecha futura y antes de bloquear o escribir |
| AC-005.4, AC-005.5 | Sí | `_parse_recorded_at` solo se llama en `save_metric` (`body_metric_service.py:96`); `update_metric` y `delete_metric` no lo usan |
| AC-006.1 a AC-006.6 | Sí (regresión) | `_sync_profile_weight` y `get_latest_with_weight` sin cambios; tests de `test_body_metric_service.py` y de rutas |
| AC-007.1 a AC-007.7 | Sí | Recarga de la lista vía `invalidateMetricsAndProfile`; `buildInsights` y `buildAnalysisRequest` sin cambios; FREG y FAN |
| AC-008.1 a AC-008.4 | Sí | `hooks.ts:38`: `useCreateBodyMetric` invalida mediciones y perfil, igual que la corrección y el borrado |
| AC-009.1 a AC-009.4 | Sí | `frontend/src/features/profile/components/PhysicalDataForm.tsx:144-170` (caché releída, `laterWeightMetric`, `saved` y `form.reset` con el peso real, sin `justSaved`) y `:319-325` (aviso con el texto exacto). `ProfilePage` tiene `useBodyMetrics` activo (`ProfilePage.tsx:33`), así que la lista sí se recarga antes de leer la caché |
| AC-009.5 | Sí (regresión) | Sincronización existente; tests BS y BR |
| AC-010.1, AC-010.2 | Sí | `BodyMetricsPage.tsx:75-77` y `:106-109` |
| AC-N001.1, AC-N001.2 | Sí (regresión) | La ruta no cambia (`@require_auth` y el usuario del token) |
| AC-N002.1 | Sí | `DialogTitle` y `Label htmlFor` en cada campo (`RegisterMetricDialog.tsx:84`, `:189-200`) |

## 3. Cumplimiento del plan

- Backend, `hooks.ts`, `laterWeight.ts`, `dates.ts`, `schemas.ts`, `BodyMetricsPage` y `PhysicalDataForm` siguen el diseño de §3.
- **Desviación menor:** el plan (§3.4) pide `aria-describedby` en cada input con mensaje de error. Solo lo tiene "Fecha". Los errores de peso, grasa y masa muscular y "Registra al menos un valor" no quedan asociados a su campo (F1).
- **Decisiones del implementer** (registradas en `history`):
  - el aviso de REQ-009 se oculta al editar;
  - solo se comprueba la medición posterior si hubo cambio medible;
  - sin perfil en la caché se conservan los valores del formulario.

  Las tres son coherentes con el plan.
- Sin migración, sin dependencias nuevas (no cambia `package.json` ni `requirements*.txt`) y sin ADR, como prevé el plan.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B1.3: el cambio de AC-007.6 pasó por un rework de spec con aprobación explícita ("Si", 2026-10-16T19:25:55) y el comentario del usuario ("A") en `spec.md`.
- [x] B2: `snapshot --check` da idéntico. El snapshot se rehízo tras el rework autorizado (`rework` de spec y `snapshot` posterior en `history`). `git diff b1bd525 HEAD` (commit `tests`) no toca ningún archivo de test: implement solo cambió código de producción.
- [x] B4: los marcadores `SDD: 016 …` coinciden con los AC que prueban; 59 de 59 AC cubiertos (verify-report §2, comprobado en los archivos revisados).
- [x] B5: no hay tests borrados, saltados ni debilitados; la red está simulada con `vi.mock` y en el backend se usan fakes y Postgres de test. No quedan esqueletos `not implemented` en el código de producción. Lo he comprobado ejecutando vitest sobre `body-metrics`, `profile` y `lib`: 439 tests pasan.
- [x] B5.7: según verify, el ratchet de ruff no tiene violaciones nuevas, oxlint da 0 errores y `tsc -b` y `build` pasan.
- [x] B6.5: sin secretos y sin variables nuevas.

### Parte II (proyecto)
- [x] P1 general: marcadores con el número de spec; comentarios de los tests en español.
- [x] P1 backend: tests en `test_services/` y `test_routes/`; nombres en inglés; fakes sin `unittest.mock` ni `monkeypatch`.
- [x] P1 frontend: tests junto al archivo; `vitest` importado explícitamente; `it("…")` en español; red simulada en `api.ts`.
- [x] P2 backend: el cambio vive en el servicio y usa `ValidationError`; la ruta no cambia; no hay cambio de modelo, así que no hace falta migración (P2.4 comprobado: `backend/migrations` sin cambios).
- [x] P2 frontend: organización por feature; HTTP solo a través de `createBodyMetric` y `apiFetch`; TanStack Query con claves en `hooks.ts`; react-hook-form y zod; `Dialog`, `Input`, `Label` y `Button` de `components/ui`.
- [x] P2 general: textos en español correcto, con tildes y sin voseo.
- [x] P3: el endpoint sigue con `@require_auth` y el usuario del token; entrada validada en el servicio y con zod; sin SQL a mano.
- [x] P4: sin migración ni pasos manuales en producción.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx:112-151` | Los errores de "Peso", "% Grasa corporal" y "% Masa muscular" y el mensaje "Registra al menos un valor" no están enlazados a su input con `aria-describedby`, como pide el plan §3.4. Solo "Fecha" lo hace (`:99`). `NumberField` no acepta esa prop. Un lector de pantalla no lee el error al enfocar el campo (NFR-002, en espíritu; los AC-N002.x sí se cumplen). | implementer |
| F2 | MENOR | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:51`, `:79` | El botón "Registrar medición" se habilita cuando cargan las mediciones, aunque el perfil siga cargando. Mientras tanto, `weightUnit` vale `"kg"`. Si un usuario con perfil en lb abre el diálogo antes de que llegue el perfil, ve "Peso (kg)" y, al cargar el perfil, la etiqueta y la conversión de `registrationPayload` cambian a lb con el número ya escrito. La ventana es corta, pero el resultado sería guardar un peso mal convertido. | implementer |
| F3 | NIT | `frontend/src/features/body-metrics/pages/BodyMetricsPage.register.test.tsx:370-390` | AC-007.7 sustituye `TrendChart` por un stub que pinta las fechas recibidas. Comprueba que la medición llega al gráfico, pero no el periodo de "1 mes". El plan lo permitía y el filtrado por periodo ya tiene sus propios tests. | test-author |
| F4 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:33-51` | Las importaciones nuevas (`useQueryClient`, `bodyMetricsKeys`, `profileKeys`…) quedan intercaladas sin orden con las existentes. | implementer |
| F5 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:157-160` | Si hay una medición posterior pero no hay perfil en la caché, se muestra el aviso de REQ-009 y el campo "Peso" conserva el valor escrito, que no es el del perfil. En `ProfilePage` siempre hay perfil, así que no se da en la práctica. Ya figura en el backlog del implementer. | implementer |
| F6 | NIT | `specs/016-past-date-measurements/backlog.md:21` | La entrada "Hay que actualizar el test de AC-007.6…" ya está resuelta (commit `b1bd525`). Conviene marcarla o quitarla antes de pasar el backlog al del proyecto. | spec-writer |

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Todos los AC están implementados como se especificaron, los tests no cambiaron desde el snapshot autorizado y se cumplen la Parte I y la Parte II de la constitución. F1 y F2 (MENOR) y los NIT pueden pasar al backlog del proyecto, o corregirse ahora si el usuario lo prefiere.

## Comentarios del usuario

## Comentarios del usuario

> F1 a F6, vamos a arreglarlas todas de una vez
