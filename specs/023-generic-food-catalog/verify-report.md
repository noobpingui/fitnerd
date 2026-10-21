# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** full (etapa verify), iteración 1 de 3
- **Fecha:** 2026-10-21T07:48:23.472Z · **Rama:** `feat/023-generic-food-catalog` @ `d9459f3` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
Ámbitos tocados: `backend`, `frontend`. Los comandos de `typecheck` y `build` del ámbito `backend` están a `null` y no se listan.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1808 passed en 120,52 s (suite completa, incluidos los tests 023 y los de 021 y 022) |
| backend | ratchet de ruff, `node scripts/lint-ratchet.mjs backend` (raíz del repo) | ❌ | Exit 1: 1058 violaciones nuevas. 1051 son del CSV `backend/scripts/data/food_catalog.csv` (E501 +86 e invalid-syntax +965), que el ratchet trata como Python por estar en el ámbito `prod` (`backend/scripts/**`). 7 son E501 en 5 archivos de test congelados. Detalle en la sección 4. Ningún archivo de código de producción tiene violaciones nuevas. |
| frontend | `npm test` (`frontend`) | ✅ | 75 archivos, 1048 tests passed en 61,54 s |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint, exit 0, sin errores ni warnings |
| frontend | `npx tsc -b` (`frontend`) | ✅ | exit 0, sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | exit 0. Chunk de entrada `dist/assets/index-De6qw7Tc.js` de 384,63 kB (122,89 kB gzip), por debajo de 500 kB (ADR-0026). El chunk de `BodyMetricsPage`, 364,77 kB, es lazy y no entra en la carga inicial. |

Comprobación de los archivos congelados (`tests_snapshot` de `state.json`): los 26 archivos de test del snapshot tienen en `HEAD` el mismo hash que el registrado. La copia de trabajo tiene otro hash por la conversión de fin de línea del checkout, pero `git status` está limpio en esos archivos, así que no hay cambios de contenido. Entre `e0b0f5b` y `d9459f3` no se ha modificado ningún test.

Comprobación de diff: `git diff main...HEAD` no añade `skip`, `xfail`, `.only`, `.skip`, `.todo` ni `fixme`, y no quita ninguno.

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

- AC sin test: — (67 de 67 ACs tienen al menos un marcador `SDD: 023` en `HEAD`, comprobado contra `spec.md`; los 67 tests pasan en la suite completa).
- REQ sin tarea: — (los 12 REQ y los 2 NFR aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: — (67 de 67 marcadas; todas referencian un REQ o NFR).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

## 3. Criterios de aceptación manuales
Los AC de contenido y de presentación que los tests no pueden juzgar se dejan para la revisión del usuario en el gate de `review`:

- **REQ-001, reglas de contenido 1 a 3 de la sección 6 de la spec:** que cada alimento sea simple, que la versión cocida o cruda sea la correcta y que no haya preparaciones con aceite. Los tests solo comprueban formato, unicidad, límites, la lista mínima y las palabras prohibidas (Q9). Además, las filas `manual` (1 en el CSV, `yuca-cocida`) tienen su `reference` pero los valores no están verificados contra la fuente.
- **Aspecto del diálogo «Añadir a {sección}» y del diario (AC-009.1, AC-009.3, AC-010.1, AC-N002.1, AC-N002.2):** los tests comprueban textos, roles y regiones, pero no el diseño ni la distribución en móvil.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ratchet de backend: 7 violaciones E501 nuevas en 5 archivos de test congelados (el implementer informó de 4; el ratchet cuenta 7) | `backend/tests/test_routes/test_meal_routes.py` L1215 (102 > 100); `backend/tests/test_scripts/test_load_food_catalog_script.py` L270 (103); `backend/tests/test_services/test_catalog_csv_reader.py` L171 (105), L290 (107), L388 (104); `backend/tests/test_services/test_catalog_load_service.py` L249 (101); `backend/tests/test_services/test_meal_rules.py` L313 (106). Lint-ratchet: «1058 violación(es) nueva(s) respecto a main. FAIL» | test-author (líneas de los tests congelados por el snapshot; el cambio de formato no altera el comportamiento, pero exige reabrir el snapshot con un registro explícito) |
| 2 | Ratchet de backend: 1051 violaciones «nuevas» en el CSV del catálogo, que no es código Python (E501 +86, invalid-syntax +965). No es un defecto del CSV: el ratchet lo pasa a ruff porque entra en el ámbito `prod` (`backend/scripts/**`) | `NUEVO backend/scripts/data/food_catalog.csv  E501 +86`; `NUEVO backend/scripts/data/food_catalog.csv  invalid-syntax +965` | entorno (configuración del ratchet o de `scopes.backend.prod` en `.sdd/config.json`; no lo corrige ningún agente de esta etapa) |

Aunque se excluyera el CSV (fallo 2), el fallo 1 mantendría el ratchet en FAIL. La decisión queda para el orquestador: corregir las siete líneas de test (requiere reabrir el snapshot) o, si el usuario lo acepta de forma explícita, dejarlas como violaciones previas.

Otras comprobaciones en verde: suite backend 1808/1808, suite frontend 1048/1048, lint, typecheck y build del frontend, trazabilidad 67/67, snapshot de tests congelados sin cambios, y ningún `skip` nuevo.
