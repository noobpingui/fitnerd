# Verify report 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-28T17:19:12.419Z · **Rama:** `feat/029-edit-favorite-foods` @ `0d45818` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2681 passed, 0 fallos |
| backend | ratchet de ruff: `node …/lint-ratchet.mjs backend` (raíz del repo) | ❌ | Exit 1. 1 violación nueva respecto a `main`: `E501` en `backend/tests/test_routes/test_food_library_routes.py:1226` (103 > 100). Los demás archivos tocados sin violaciones nuevas. |
| frontend | `npm test` (`frontend`) | ✅ | 91 archivos, 1715 tests passed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint, exit 0, sin errores ni warnings listados |
| frontend | `npx tsc -b` (`frontend`) | ✅ | exit 0, sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | build correcto en 6,54 s, exit 0 |

Los ámbitos tocados son `backend` y `frontend` (`state.json.scope`, confirmado con `changed --json`). Los comandos `lint`, `typecheck` y `build` de `backend` son `null` y no se ejecutan.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 029` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.6 | T-021, T-023, T-052, T-053 | `test_food_library_service.py`, `test_food_library_routes.py` | ✅ |
| REQ-002 | AC-002.1 a AC-002.7 | T-020, T-022, T-024, T-050, T-052 | `test_meal_rules.py`, `test_food_library_service.py`, `test_food_library_routes.py` | ✅ |
| REQ-003 | AC-003.1 a AC-003.4 | T-022, T-025, T-027, T-051 a T-054 | `test_food_library_routes.py`, `test_food_library_service.py`, `test_meal_library_routes.py` | ✅ |
| REQ-004 | AC-004.1 a AC-004.4 | T-022, T-026, T-052, T-053 | `test_food_library_routes.py`, `test_food_library_service.py` | ✅ |
| REQ-005 | AC-005.1 a AC-005.4 | T-027, T-028, T-054 | `test_meal_library_routes.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.3 | T-039, T-044, T-068, T-070 | `FoodSearchPanel.test.tsx`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-007 | AC-007.1 a AC-007.8 | T-034, T-038, T-040, T-043, T-044, T-063, T-067, T-069 | `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx`, `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `schemas.test.ts` | ✅ |
| REQ-008 | AC-008.1 a AC-008.5 | T-034, T-035, T-038, T-063, T-064 | `customFoodEdit.test.ts`, `CustomFoodEditForm.test.tsx`, `schemas.test.ts` | ✅ |
| REQ-009 | AC-009.1 a AC-009.5 | T-030, T-032, T-038, T-060, T-062 | `names.test.ts`, `hooks.test.tsx`, `CustomFoodEditForm.test.tsx` | ✅ |
| REQ-010 | AC-010.1 a AC-010.7 | T-031, T-033, T-036, T-038, T-041, T-061 a T-065, T-069 | `api.test.ts`, `hooks.test.tsx`, `errors.test.ts`, `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx` | ✅ |
| REQ-011 | AC-011.1 a AC-011.3 | T-037, T-045, T-066, T-070 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| NFR-001 | AC-N001.1 a AC-N001.5 | T-038, T-042, T-067, T-069 | `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx` | ✅ |

- AC sin test: — (los 61 AC de la spec tienen al menos un marcador `SDD: 029` y todos esos tests pasan. La cifra «62 AC» de la nota de `state.json` no coincide con la spec; ver backlog.)
- REQ sin tarea: — (REQ-001 a REQ-011 y NFR-001 aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: — (52 de 52 marcadas)
- `skip`, `xfail`, `.only`, `.skip`, `.todo` o equivalentes nuevos en el diff (`git diff main...HEAD`): —

Nota: el AC-008.8 que cita el texto de REQ-005 es de la spec 028 y no es un AC de esta feature.

## 3. Criterios de aceptación manuales
Ninguno. Todos los AC de la spec tienen test automático, incluidos los de foco y accesibilidad (NFR-001). La spec no define criterios visuales.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ratchet de ruff del backend: 1 violación nueva (E501) | `backend/tests/test_routes/test_food_library_routes.py:1226: Line too long (103 > 100)`. La línea es `client, headers, food_id, edit_payload(calories_kcal=calories, protein_g=0, carbs_g=0, fat_g=0)` dentro de `test_editing_with_calories_out_of_range_is_400`. El archivo existía en `main` sin violaciones, así que es nueva. Art. B5.7: el código nuevo o modificado no debe introducir violaciones de lint. | test-author (la línea está en un archivo de test, que no puede tocar el implementer) |

## 5. Observaciones
- Lo de la etapa implement se aprobó con esta violación pendiente de la nota «ratchet backend: 1 E501 nuevo en un test»; se detecta ahora.
- Los archivos de test, los `.ts` de producción y `tasks.md` no se han modificado en esta etapa.
