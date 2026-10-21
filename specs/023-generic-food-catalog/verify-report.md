# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** full (etapa verify), iteración 2 (tras la corrección de formato aprobada por el usuario)
- **Fecha:** 2026-10-21T08:14:28.523Z · **Rama:** `feat/023-generic-food-catalog` @ `e7792b5` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbitos tocados: `backend`, `frontend`. Los comandos de `typecheck` y `build` del ámbito `backend` están a `null` y no se listan.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1808 passed en 114,88 s (suite completa, incluidos los tests 023 y los de 021 y 022) |
| backend | ratchet de ruff, `node scripts/lint-ratchet.mjs backend` (raíz del repo) | ✅ | Exit 0: «sin violaciones nuevas respecto a main». El CSV `backend/scripts/data/food_catalog.csv` ya no entra en el ratchet (`prod` solo cubre `backend/scripts/*.py` y `backend/scripts/**/*.py`). Todos los archivos de producción y de test de la feature con 0 violaciones nuevas. |
| frontend | `npm test` (`frontend`) | ✅ | 75 archivos, 1048 tests passed en 62,34 s |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint, exit 0, sin errores ni warnings |
| frontend | `npx tsc -b` (`frontend`) | ✅ | exit 0, sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | exit 0. Chunk de entrada `dist/assets/index-De6qw7Tc.js` de 384,63 kB (122,89 kB gzip), por debajo de 500 kB (ADR-0026). El chunk de `BodyMetricsPage`, 364,77 kB, es lazy y no entra en la carga inicial. |

Comprobación de los cambios desde la verificación anterior (`e0b0f5b`..`e7792b5`): en los tests solo hay reflujos de línea en 5 archivos de backend (`test_meal_routes.py`, `test_load_food_catalog_script.py`, `test_catalog_csv_reader.py`, `test_catalog_load_service.py`, `test_meal_rules.py`). Ninguno cambia aserciones, datos ni nombres de test. No hay cambios en tests de frontend. El árbol de trabajo está limpio salvo `state.json`.

Comprobación de diff: `git diff main...HEAD` no añade `skip`, `xfail`, `.only`, `.skip`, `.todo` ni `fixme`.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a 001.4 | T-103, T-120 a T-124 | `backend/tests/test_services/test_food_catalog_csv.py`, `test_catalog_csv_reader.py` | ✅ |
| REQ-002 | AC-002.1 a 002.6 | T-026, T-029, T-104, T-100, T-110, T-111 | `test_catalog_load_service.py`, `test_load_food_catalog_script.py`, `test_meal_routes.py` (AC-002.4) | ✅ |
| REQ-003 | AC-003.1 a 003.8 | T-025, T-027, T-103, T-104, T-124 | `test_catalog_csv_reader.py`, `test_catalog_load_service.py` | ✅ |
| REQ-004 | AC-004.1 a 004.16 | T-022, T-023, T-032, T-101, T-102, T-105, T-106 | `test_catalog_rules.py`, `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| REQ-005 | AC-005.1 a 005.4 | T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| REQ-006 | AC-006.1 a 006.6 | T-030, T-031, T-033, T-107, T-108, T-109 | `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py` | ✅ |
| REQ-007 | AC-007.1, 007.2 | T-031, T-033, T-104, T-108, T-109 | `test_meal_routes.py`, `test_meal_service.py` | ✅ |
| REQ-008 | AC-008.1, 008.2 | T-033, T-034, T-045, T-100, T-109, T-133 | `test_catalog_migration.py`, `test_meal_routes.py`, `diary/schemas.test.ts` | ✅ |
| REQ-009 | AC-009.1 a 009.7 | T-040 a T-043, T-130 a T-132, T-135, T-136 | `AddFoodDialog.test.tsx`, `CatalogResultList.test.tsx`, `catalog/schemas.test.ts` | ✅ |
| REQ-010 | AC-010.1 a 010.3 | T-044, T-046, T-133, T-134 | `format.test.ts`, `DiaryPage.test.tsx`, `diary/schemas.test.ts` | ✅ |
| REQ-011 | AC-011.1, 011.2 | T-047, T-048, T-137 | `foodsRoute.test.tsx`, `diaryRoute.test.tsx`, `noFoodsLink.test.tsx` | ✅ |
| REQ-012 | AC-012.1 a 012.3 | T-049, T-050, T-138, T-139 | `TermsOfServicePage.test.tsx`, `PrivacyPolicyPage.test.tsx` | ✅ |
| NFR-001 | AC-N001.1, N001.2 | T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| NFR-002 | AC-N002.1, N002.2 | T-042, T-043, T-132, T-136 | `CatalogResultList.test.tsx`, `AddFoodDialog.test.tsx` | ✅ |

- AC sin test: — (67 de 67 ACs de `spec.md` tienen un marcador `SDD: 023` en los tests, y los 67 pasan en la suite completa).
- REQ sin tarea: — (los 12 REQ y los 2 NFR aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: — (67 de 67 marcadas; todas referencian un REQ o NFR).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

## 3. Criterios de aceptación manuales
Los AC que los tests no pueden juzgar se dejan para la revisión del usuario en el gate de `review`:

- **REQ-001, reglas de contenido 1 a 3 de la sección 6 de la spec:** que cada alimento sea simple, que la versión cocida o cruda sea la correcta y que no haya preparaciones con aceite. Los tests solo comprueban formato, unicidad, límites, la lista mínima y las palabras prohibidas (Q9). Además, la fila `manual` (`yuca-cocida`) tiene su `reference`, pero sus valores no están verificados contra la fuente.
- **Aspecto del diálogo «Añadir a {sección}» y del diario (AC-009.1, AC-009.3, AC-010.1, AC-N002.1, AC-N002.2):** los tests comprueban textos, roles y regiones, pero no el diseño ni la distribución en móvil.

## 4. Fallos (si los hay)
Ninguno. Las dos incidencias de la iteración 1 (7 E501 en tests congelados y el CSV contado como Python) están corregidas: el formato se corrigió en `e7792b5` y la configuración de `scopes.backend.prod` ya no incluye el CSV.
