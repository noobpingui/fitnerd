# Verify report 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Modo:** red (tras la etapa tests), iteración 4 de verificación
- **Fecha:** 2026-10-27T03:18:00.648Z · **Rama:** `feat/026-diary-days-and-editing` @ `f500114` · **Base:** `main`
- **Resultado:** PASS (con ⚠️ de marcadores, ver §4)

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q -rA` sobre los 4 archivos con marcador `SDD:` de la 026 (`backend`) | ❌ | 108 failed, 348 passed (incluye tests ya existentes en esos archivos). Los 15 casos nuevos que pasan son guardas de la 022 con el comentario exigido (§4). Ningún error de import, sintaxis ni fixture. `test_restore_token.py`: 0 pasan. |
| frontend | `npx vitest run --reporter=verbose src/features/diary` (`frontend`) | ❌ | 506 tests en 15 archivos: 137 failed, 369 passed (incluye tests existentes y `nutrition.test.ts`, que ya pasaba). Los 12 casos nuevos que pasan son guardas con el comentario exigido (§4). Los 6 casos `it.each` de `removeMealItem` ya fallan (`?undo=1` ausente). |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores (exit 0). |
| backend | lint ratchet | — | No se ejecuta en modo red. |
| frontend | `npm run lint`, `npm run build` | — | No se ejecutan en modo red. |

Ejecución en modo red: se corrieron los archivos de test con marcador `SDD:` de la 026 (y el resto del directorio `diary` en frontend). Cada pase nuevo se clasificó por nombre de test contra HEAD y por la presencia del comentario de guarda encima del marcador. Cada fallo se clasificó por tipo de error.

Esqueletos (comprobación 3): todos los `(scaffold)` de `tasks.md` solo lanzan `not implemented` o `NotImplementedError("not implemented")`, sin lógica ni valores de retorno. Los constructores (`RestoreTokenSigner`, `MealService`) solo guardan sus dependencias. Aceptados por el orquestador y anotados aquí: `formatDiaryDate` conserva la implementación de la 022 y solo añade el parámetro opcional `_today`; `removalResponseSchema` es un esquema zod declarativo que pide la T-006. Fuera de los esqueletos, `removeMealItem` (que ya existía) devuelve `null` en su cuerpo; sus casos ya no pasan sin implementar (§4, resuelto).

## 2. Trazabilidad
Estado en red: cobertura de AC, REQ y tareas, y estado de cada grupo de tests nuevos.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.4 | T-021, T-022, T-024, T-051 | `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py` | ❌ rojo legítimo (ventana y mensaje antiguos de la 022). Guardas «still_» de ayer, hoy y mañana: pasan con comentario de guarda (§4). |
| REQ-002 | AC-002.1 a AC-002.10 | T-027, T-028, T-032, T-035 | `days.test.ts`, `format.test.ts`, `DiaryDateNav.test.tsx`, `DiaryPage.test.tsx` | ❌ rojo legítimo. Pasan con guarda correcta: AC-002.1 (mismo año, `format.test.ts`) y AC-002.8 (hoy sin comidas, `DiaryPage.test.tsx`). |
| REQ-003 | AC-003.1 a AC-003.4 | T-027, T-036 | `days.test.ts`, `DiaryPage.test.tsx` | ❌ rojo legítimo (`resolveDiaryDate`, `?date=` no leído). |
| REQ-004 | AC-004.1 a AC-004.4 | T-037 | `DiaryPage.test.tsx` | ❌ rojo legítimo. |
| REQ-005 | AC-005.1 a AC-005.4 | T-030, T-038 | `hooks.test.tsx`, `DiaryPage.test.tsx` | ❌ rojo legítimo (`useToday` es un esqueleto). |
| REQ-006 | AC-006.1 a AC-006.7 | T-029, T-033, T-039 | `api.test.ts`, `DeleteMealDialog.test.tsx`, `DiaryPage.test.tsx` | ❌ rojo legítimo. Los casos `it.each` de `removeMealItem` fallan por `?undo=1` ausente. |
| REQ-007 | AC-007.1 a AC-007.11 | T-020 a T-025, T-029, T-031, T-040 | `test_restore_token.py`, `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py`, `api.test.ts`, `hooks.test.tsx`, `DiaryPage.test.tsx` | ❌ rojo legítimo. Todos los tests de `test_restore_token.py` fallan por `not implemented`. |
| REQ-008 | AC-008.1 a AC-008.4 | T-041 | `DiaryPage.test.tsx` | ❌ AC-008.1 y AC-008.2 en rojo legítimo. AC-008.3 y AC-008.4 pasan con guarda correcta (`Guarda de regresión de la 025: pasa sin implementar la 026.`). |
| REQ-009 | AC-009.1 a AC-009.6 | T-034, T-042 | `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ❌ AC-009.1 a AC-009.4 en rojo legítimo. AC-009.5 y AC-009.6 pasan con guarda correcta (`Guarda de regresión de la 025: pasa sin implementar la 026.`). |
| NFR-001 | AC-N001.1 a AC-N001.3 | T-032, T-033, T-034, T-040 | `DiaryDateNav.test.tsx`, `DeleteMealDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ❌ rojo legítimo. |
| NFR-002 | AC-N002.1 a AC-N002.3 | T-020, T-023, T-026 | `test_restore_token.py`, `test_meal_service.py`, `test_meal_routes.py` | ❌ AC-N002.2 y AC-N002.3 en rojo legítimo. AC-N002.1 pasa con guarda correcta (`Guarda de regresión de la 022: pasa sin implementar la 026.`). |

- Cada AC de `spec.md` aparece en al menos un marcador `SDD:` del código de tests (comprobación por texto, no semántica).
- AC sin test propio de la 026: AC-010.3 y AC-014.2 (referencias a la 022; no bloquean, quedan para el backlog de la feature).
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-050 a T-073 (fase B, esperado en modo red).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: —
- Tests existentes borrados o debilitados: solo los que el plan manda reescribir (T-021, T-022, T-024, T-034, T-042) y las aserciones de `format.test.ts` que solo añaden el argumento `today` con el mismo valor esperado.

## 3. Criterios de aceptación manuales
No aplica en modo red. Los AC visuales y de UX se listarán en el informe de modo `full`.

## 4. Fallos (si los hay)
Criterio aplicado a las guardas (del orquestador): son rojo legítimo las guardas de la 022/025 que pasan sin implementar y llevan el comentario exacto `Guarda de regresión de la 02X: pasa sin implementar la 026.` encima del marcador `SDD:`. Pases nuevos encontrados:

- **Backend, 15 casos, todos con el comentario exacto:** `test_meal_rules.py` (`test_check_add_window_still_accepts_yesterday_today_and_tomorrow`, 3 casos); `test_meal_service.py` (`test_add_items_still_accepts_yesterday_today_and_tomorrow`, 3 casos; `test_remove_item_without_a_signer_returns_none`); `test_meal_routes.py` (`test_post_still_accepts_yesterday_today_and_tomorrow`, 3 casos; `test_post_still_rejects_a_missing_or_invalid_date_with_the_date_message`, 3 casos; `test_delete_without_undo_still_returns_204_with_no_body`; `test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact`).
- **Frontend, 12 casos, todos con el comentario exacto:** `MealPhotoDialog.test.tsx` (7 casos de «Cancelar» y Escape de la 025); `format.test.ts` (`un día del año en curso se muestra sin año`); `DiaryPage.test.tsx` (3 casos de barras sin exceso de la 025 y «hoy sin comidas» de la 022).

Observación sobre el caso `test_remove_item_without_a_signer_returns_none`: lleva el comentario de guarda de la 022, pero su marcador es `SDD: 026 REQ-007 AC-007.2`. Se acepta por el criterio, porque su comportamiento (quitar sin firmante no devuelve token) es el de la 022. El test-author debe decidir si el marcador pasa a `022` o si el caso se reescribe. Lo anoto como ⚠️ y no como fallo.

Caso resuelto desde la iteración 3: los 6 casos `it.each` de `removeMealItem` (`api.test.ts`) ya no pasan sin implementar. Ahora fallan con `expected '/api/meals/N/items/N' to be '/api/meals/N/items/N?undo=N'`.

Rojo legítimo (no es fallo):
- **Backend (108 fallos):** 76 `NotImplementedError: not implemented` de los esqueletos (`RestoreTokenSigner.sign/verify`, `epoch_seconds`, `snapshot_payload`, `parse_snapshot_payload`, `MealService.restore_item`); ruta `POST /api/meals/restore` inexistente (404); `?undo=1` ausente (204 en lugar de 200), con `get_json()` que devuelve `None` en los helpers que leen el token; `remove_item` que aún devuelve `None`, lo que produce `TypeError`, `AttributeError` o `assert` al leer el token; ventana y mensaje antiguos de la 022 (`Solo puedes registrar comidas de hoy.`), que hacen fallar el `setup` de tests con fechas de hace 10 o 200 días (`KeyError: 'id'`, `KeyError: 'items'`).
- **Frontend (137 fallos):** 36 `Error: not implemented` de los esqueletos (`days.ts`, `format.ts`/`errors.ts`, `hooks.ts`, `api.ts` `restoreMealItem`/`deleteMeal`, `DiaryDateNav`, `DeleteMealDialog`, `ConfirmDialog`) y 1 `expected Error: not implemented to match ZodError` derivado de un esqueleto; `role="alertdialog"` «¿Descartar la propuesta?» ausente; botón «Día anterior» y «Borrar Cena» ausentes; aviso «Quitaste …» ausente; textos de fecha sin año; `/diary?date=…` que la página no normaliza a `/diary`; `data-over` y `bg-amber-500` ausentes; `?undo=1` ausente y `removeMealItem` sin token.
- No hay errores de sintaxis, configuración, fixture ni imports de módulos fuera del plan en ninguno de los dos ámbitos.

Para el orquestador, anotar en el backlog de la feature (no son fallos):
- Desviación aceptada de `formatDiaryDate(isoDate, today?)`: conserva la implementación de la 022 y solo añade `_today`.
- `removalResponseSchema` declarativo (T-006), aceptado.
- Colocación del comentario de guarda en 3 casos «still_» de backend (encima de la definición, debajo del marcador `SDD: 022`).
- Marcador `SDD: 026` con comentario de guarda de la 022 en `test_remove_item_without_a_signer_returns_none` (ver arriba).
- Marcador `SDD: 026 NFR-002 AC-N002.1` con comentario de guarda de la 022 en `test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact`: el comentario dice 022 y el marcador dice 026.
