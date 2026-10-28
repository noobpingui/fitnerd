# Verify report 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-28T09:46:19Z · **Rama:** `feat/029-edit-favorite-foods` @ `e2a207d` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
En modo red solo se ejecutan los tests nuevos de la feature (archivos cambiados con marcador `SDD: 029`), con `commands.test_files`. Los cambios de la etapa tests están sin commit; se comparan con `e2a207d`. Lint, typecheck y build no se ejecutan en esta etapa.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre 4 archivos (`backend`) | ❌ (rojo esperado) | 101 fallidos y 466 pasados en los 4 archivos (los 466 incluyen tests ya existentes). Los 101 fallos son rojo legítimo: `not implemented` de los esqueletos, respuestas 405 porque la ruta `PATCH` aún no existe, y un id repetido en el alta tras renombrar (AC-003.4) porque el renombrado no ocurre. Ningún test marcado `SDD: 029` pasa. |
| frontend | `npx vitest run` sobre 11 archivos (`frontend`) | ❌ (rojo esperado) | 143 fallidos y 451 pasados en los 11 archivos (los 451 incluyen tests ya existentes). Los fallos son `Error: not implemented`, botones «Editar» ausentes y aserciones sobre valores que el esqueleto no produce. Único test marcado que pasa: F5 (excepción aceptada, ver sección 4). |

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 029` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.6 | T-021, T-023, T-052, T-053 | `test_food_library_service.py`, `test_food_library_routes.py` | ❌ rojo legítimo (405 y `not implemented`) |
| REQ-002 | AC-002.1 a AC-002.7 | T-020, T-022, T-024, T-050 | `test_meal_rules.py`, `test_food_library_service.py`, `test_food_library_routes.py` | ❌ rojo legítimo |
| REQ-003 | AC-003.1 a AC-003.4 | T-022, T-025, T-027, T-051 a T-054 | `test_food_library_routes.py`, `test_food_library_service.py`, `test_meal_library_routes.py` | ❌ rojo legítimo |
| REQ-004 | AC-004.1 a AC-004.4 | T-022, T-026, T-052, T-053 | `test_food_library_routes.py`, `test_food_library_service.py` | ❌ rojo legítimo |
| REQ-005 | AC-005.1 a AC-005.4 | T-027, T-028, T-054 | `test_meal_library_routes.py` | ❌ rojo legítimo |
| REQ-006 | AC-006.1 a AC-006.3 | T-039, T-044, T-068, T-070 | `FoodSearchPanel.test.tsx`, `MealPhotoDialog.test.tsx` | ❌ rojo legítimo (botón «Editar» ausente) |
| REQ-007 | AC-007.1 a AC-007.8 | T-034, T-038, T-040, T-043, T-044 | `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx`, `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `schemas.test.ts` | ❌ rojo legítimo, salvo F5 (excepción aceptada, sección 4) |
| REQ-008 | AC-008.1 a AC-008.5 | T-034, T-035, T-038 | `customFoodEdit.test.ts`, `CustomFoodEditForm.test.tsx`, `schemas.test.ts` | ❌ rojo legítimo |
| REQ-009 | AC-009.1 a AC-009.5 | T-032, T-038 | `names.test.ts`, `hooks.test.tsx`, `CustomFoodEditForm.test.tsx` | ❌ rojo legítimo |
| REQ-010 | AC-010.1 a AC-010.7 | T-031, T-033, T-036, T-038, T-041 | `api.test.ts`, `hooks.test.tsx`, `errors.test.ts`, `FoodSearchPanel.test.tsx` | ❌ rojo legítimo |
| REQ-011 | AC-011.1 a AC-011.3 | T-037, T-045 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ❌ rojo legítimo |
| NFR-001 | AC-N001.1 a AC-N001.5 | T-038, T-042 | `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx` | ❌ rojo legítimo |

- AC sin test: — (los 61 AC de la spec tienen al menos un marcador `SDD: 029`)
- REQ sin tarea: — (REQ-001 a REQ-011 y NFR-001 aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: 16, de T-050 a T-070 (Fase B, pendientes de implementar; esperado en esta etapa)
- `skip`, `xfail`, `.only`, `.todo` o equivalentes nuevos en el diff: — (revisado en las líneas añadidas del diff y en los archivos de test nuevos sin seguimiento)

Comprobación de esqueletos (Art. B5.6): los símbolos de T-001 a T-011 lanzan `not implemented` sin lógica. Hay dos excepciones permitidas: `customFoodEditSchema` es un `z.object` de cinco `z.string()` sin reglas (T-007 lo autoriza), y `CustomFoodFields` es solo un tipo de datos.

Comprobación de tests nuevos: no hay errores de sintaxis, de configuración, de fixture ni imports de módulos fuera del plan. No hay `ImportError`, `ModuleNotFoundError`, `Failed to resolve import` ni `SyntaxError` en la salida.

## 3. Criterios de aceptación manuales
Ninguno en esta etapa. Los AC de foco y accesibilidad (NFR-001) tienen test automático. Lo visual se revisará en la etapa verify.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno bloqueante | — | — |

- **Excepción aceptada (F5):** `frontend/src/features/diary/schemas.test.ts` › «customFoodFormSchema sigue igual: mismos mensajes y los gramos siguen siendo obligatorios» (marcador `SDD: 029`) pasa sin implementación. Es una regresión sobre código existente. El orquestador la aceptó como excepción (evento «note» de `state.json`, etapa tests).
- **Anteriores ítems 1 a 4 y 6 del informe previo:** ya fallan de forma legítima. El ítem 1 (`test_editing_keeps_the_favorite_row_of_the_food`) responde 405; el ítem 2 (`api.test.ts` › «rechaza una respuesta que no es un alimento propio») falla con `not implemented`; los ítems 3 y 4 (`schemas.test.ts`, «acepta los valores actuales…» y «acepta una suma de macros de exactamente 100 g…») fallan; el ítem 6 («un resultado del catálogo no tiene «Editar»») falla.
- **Falso positivo descartado:** el título «deja pasar el error del servidor tal cual» aparece en `api.test.ts` tres veces. Solo la del bloque `updateCustomFood` (marcador `SDD: 029`, línea 295) cuenta para esta feature, y falla con `not implemented`. Las otras dos son de la 028 y pasan.
- **Observación no bloqueante para implement:** `frontend/src/features/food-library/types.ts` tiene `export type RecentFood =LibraryFood & { last_grams: number }`, sin espacio tras `=`. Viene del informe previo y hay que corregirlo en implement.
- **Observación no bloqueante para implement:** `customFoodEditSchema` debe sustituir su `z.object` sin reglas por las reglas reales (T-063). No se toca en esta etapa.
