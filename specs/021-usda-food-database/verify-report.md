# Verify report 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-20T06:48:49.888Z · **Rama:** `feat/021-usda-food-database` @ `5182f7d` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q <4 archivos nuevos>` (`backend`) | ✅ rojo legítimo | 100 failed, 0 passed. Causas: 67 `NotImplementedError: not implemented` (scaffold de servicios) y el resto 404 de la ruta `/api/foods/search`, que aún no existe (incluye un `KeyError: 'results'` del helper `ids_of` derivado del 404). Ningún error de sintaxis, fixture o import. Postgres respondía. |
| frontend | `npx vitest run <6 archivos nuevos>` (`frontend`) | ✅ rojo legítimo | 48 failed, 0 passed (6 ficheros). `not implemented` en `format` (7), `searchError` (4) y `FoodsPage` (24, el componente lanza al renderizar); aserciones sobre comportamiento ausente en `schemas` (7: valor `undefined`, texto sin recortar), `foodsRoute` (4: ruta `/foods` ausente en `router.tsx`) y `noFoodsLink` (2: precondición de que `router.tsx` declara `/foods`). |
| backend | ratchet de ruff (`lint_ratchet`) | — | No se ejecuta en modo red. |
| frontend | `npm run lint`, `npx tsc -b`, `npm run build` | — | No se ejecutan en modo red (solo en modo full). |

Escaneo de marcadores de omisión (`skip`, `xfail`, `.only`, `.skip`, `todo`) en los tests nuevos y en el diff de `fakes.py` y `models/__init__.py`: ninguno.

Marcadores `SDD:`: `FoodsPage.test.tsx` tiene 23 marcadores y 24 tests, porque el bloque `it.each` de «caja vacía» y «solo espacios» lleva un marcador para sus dos casos. El total de tests nuevos (48) coincide con la suma de los ficheros.

Comprobación de esqueletos `(scaffold)` (`tasks.md` T-001 a T-010): los cuerpos de funciones y métodos nuevos solo lanzan `not implemented` (backend: `FoodRepository`, `read_usda_dataset`, `FoodImportService.run`, `format_summary`, `normalize_query`, `fuse_rankings`, `FoodSearchService.search`; frontend: `formatCalories`, `formatGrams`, `searchErrorView`, `searchFoods`, `useFoodSearch`, `FoodSearchForm`, `FoodResultList`, `FoodsPage`). Los constructores solo guardan dependencias. Las constantes, los tipos, el modelo `Food` (con `CHECK`, columna generada y GIN) y el esquema provisional `foodSearchFormSchema` son declaraciones completas que el plan permite. `router.tsx` y `Navbar`/`BottomTabBar` no tienen cambios. Sin hallazgos en esta comprobación.

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
No aplica en modo red. Se comprueba en la etapa verify, con la matriz de `tasks.md`.

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno

## 3. Criterios de aceptación manuales
No aplica en modo red. Se listarán en la etapa verify.

## 4. Fallos (si los hay)
Ninguno bloquea el PASS. Los fallos de la iteración anterior (F1-F4: 6 tests de frontend que pasaban sin implementación) están corregidos: los 6 fallan ahora por comportamiento ausente.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |

Fallos legítimos (no bloquean, se listan para trazabilidad):
- Backend, 100 tests: `NotImplementedError: not implemented` en `services/usda_csv_reader.py`, `services/food_import_service.py` y `services/food_search_service.py`, o 404 (ruta `/api/foods/search` inexistente) en `tests/test_routes/test_food_routes.py`.
- Frontend, 48 tests: `not implemented` del scaffold en `format`, `searchError` y `FoodsPage`; aserciones sobre comportamiento ausente en `schemas`; en `foodsRoute` y `noFoodsLink`, aserciones sobre el contenido de `router.tsx` (la ruta `/foods` no existe todavía).

Entorno: Postgres (5433) y Redis respondían. No hay errores de entorno.

## 5. Backlog de verificación (hallazgos menores, no bloquean)
- `backend/tests/test_routes/test_food_routes.py`: el helper `ids_of` lee `results` sin comprobar antes el código de estado; tras un 404 el fallo es `KeyError: 'results'` en vez de una aserción de estado. Conviene comprobar el código primero en la etapa de implementación o al revisar.
- `frontend/src/app/foodsRoute.test.tsx` y `frontend/src/components/layout/noFoodsLink.test.tsx`: parte de las aserciones lee el texto de `router.tsx`. Es válido en red como precondición, pero en verify las comprobaciones de comportamiento (navegación y ausencia de enlaces en el DOM) deben ser las que prueben el AC.
