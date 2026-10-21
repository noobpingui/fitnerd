# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** full (etapa verify), iteración 4 (tras F13, F16 y F17)
- **Fecha:** 2026-10-21T09:09:27.795Z · **Rama:** `feat/023-generic-food-catalog` @ `ea24a16` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbitos tocados: `backend`, `frontend`.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1817 passed en 114,69 s (sin fallos ni skips) |
| backend | `lint-ratchet backend` (raíz del repo) | ✅ | Exit 0: sin violaciones nuevas respecto a main (0 en los archivos de la feature) |
| backend | typecheck | — | `null` en la config, no se ejecuta |
| backend | build | — | `null` en la config, no se ejecuta |
| frontend | `npm test` (`frontend`) | ✅ | 75 archivos, 1048 passed |
| frontend | `npm run lint` (`frontend`) | ✅ | Exit 0, 0 errores |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Exit 0 |
| frontend | `npm run build` (`frontend`) | ✅ | Built. Chunk de entrada `index-B-3-DjSU.js` 384,63 kB (gzip 122,89 kB) < 500 kB |

Comprobaciones adicionales:
- **Snapshot de tests:** los 26 archivos de `tests_snapshot.sha256` de `state.json` coinciden con el contenido de HEAD (hash SHA-256 sobre el texto con finales de línea LF, que es como lo guarda git; en el disco están en CRLF). No hay cambios sin commit en `backend/tests`, `frontend/src/test`, `frontend/src/app`, `frontend/src/components` ni `frontend/src/features`.
- **CSV:** `backend/scripts/data/food_catalog.csv` tiene 261 filas de datos. No aparece «yuca» y sí «Lechuga iceberg» (F16).
- **Términos:** `TermsOfServicePage.tsx` ya no contiene la frase de alimentos añadidos a mano (F13).
- **Test intermitente reportado por el implementer:** «B entra con el onboarding pendiente y sin ver la fecha de nacimiento de A» (`frontend/src/app/accountSwitch.test.tsx:68`). No pertenece a los archivos de la 023 (no aparece en `git diff --name-only main...HEAD`). Pasó en la suite completa de esta ronda y en una repetición aislada. No se ha reproducido el fallo; no se puede afirmar si es intermitente, pero tampoco atribuirlo a la 023.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 … AC-001.4 | T-028, T-035, T-036, T-120 a T-127 | `backend/tests/test_services/test_food_catalog_csv.py` (250–350 filas, filas `manual` con referencia, lista mínima de 39) | ✅ |
| REQ-002 | AC-002.1 … AC-002.6 | T-026, T-029, T-033, T-100, T-104, T-109, T-110, T-111 | `test_catalog_load_service.py`, `test_load_food_catalog_script.py`, `test_meal_routes.py` | ✅ |
| REQ-003 | AC-003.1 … AC-003.8 | T-025, T-027, T-103, T-104, T-124 | `test_catalog_csv_reader.py`, `test_catalog_load_service.py` | ✅ |
| REQ-004 | AC-004.1 … AC-004.16 | T-022, T-023, T-032, T-101, T-102, T-105, T-106 | `test_catalog_rules.py`, `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| REQ-005 | AC-005.1 … AC-005.4 | T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| REQ-006 | AC-006.1 … AC-006.6 | T-030, T-031, T-033, T-107, T-108 | `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py` | ✅ |
| REQ-007 | AC-007.1, AC-007.2 | T-031, T-033, T-104, T-108, T-109 | `test_meal_service.py`, `test_meal_routes.py` | ✅ |
| REQ-008 | AC-008.1, AC-008.2 | T-033, T-034, T-045, T-100, T-109, T-133 | `test_catalog_migration.py`, `test_meal_routes.py`, `diary/schemas.test.ts` | ✅ |
| REQ-009 | AC-009.1 … AC-009.7 | T-041 a T-043, T-130 a T-132, T-135, T-136 | `catalog/schemas.test.ts`, `CatalogResultList.test.tsx`, `AddFoodDialog.test.tsx` | ✅ |
| REQ-010 | AC-010.1 … AC-010.3 | T-044, T-046, T-134 | `diary/format.test.ts`, `DiaryPage.test.tsx` | ✅ |
| REQ-011 | AC-011.1, AC-011.2 | T-047, T-048, T-137 | `foodsRoute.test.tsx`, `diaryRoute.test.tsx`, `noFoodsLink.test.tsx` | ✅ |
| REQ-012 | AC-012.1 … AC-012.3 | T-049, T-050, T-138, T-139 | `TermsOfServicePage.test.tsx`, `PrivacyPolicyPage.test.tsx` | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 | T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ |
| NFR-002 | AC-N002.1, AC-N002.2 | T-042, T-043, T-132, T-136 | `CatalogResultList.test.tsx`, `AddFoodDialog.test.tsx` | ✅ |

- AC en `spec.md`: 67. AC con marcador `SDD: 023` en los tests: 67 de 67. Marcadores sin AC en la spec: ninguno.
- Los tests con esos marcadores pasan (suites completas en verde).
- AC sin test: —
- REQ sin tarea: —
- REQ/NFR presentes en `tasks.md`: 14 de 14.
- Tareas sin marcar `[x]`: — (72 de 72 marcadas)
- `skip`, `xfail`, `.only`, `.skip`, `skipif`, `.todo` o equivalentes nuevos en el diff `main...HEAD`: —

## 3. Criterios de aceptación manuales
Comprobaciones que los tests no cubren y que el usuario debe revisar en el gate de `review`:
- **AC-009.1 (diseño del diálogo):** el texto «Busca un alimento o crea uno…» y el ejemplo del campo de búsqueda, con su aspecto visual.
- **Contenido del CSV (AC-001.2, AC-001.3):** los tests comprueban formato, unicidad y palabras prohibidas, pero no que los nombres y sinónimos sean neutros y correctos para cada alimento. Revisar `backend/scripts/data/food_catalog.csv`.

## 4. Fallos (si los hay)
Ninguno. Todas las comprobaciones obligatorias están en verde.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |
