# Verify report 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-20T07:03:53.887Z · **Rama:** `feat/021-usda-food-database` @ `d08158d` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1175 passed, 0 failed |
| backend | ratchet de ruff: `lint-ratchet.mjs backend` (raíz del repo) | ❌ | 13 violaciones nuevas E501 (línea > 100) en tests: `test_food_routes.py` (3), `test_food_import_service.py` (6), `test_food_search_service.py` (1), `test_usda_csv_reader.py` (2), `usda_samples.py` (1). Los archivos de producción nuevos no tienen violaciones. |
| frontend | `npm test` (`frontend`) | ✅ | 842 passed en 65 archivos, 0 failed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni avisos (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | 3120 módulos. Chunk de entrada `index-*.js`: 384,53 kB (gzip 122,88 kB), por debajo de 500 kB (ADR-0026, NFR-001). `FoodsPage` en chunk propio de 3,72 kB. |

Entorno: Postgres (5433) respondía; las dependencias del backend y del frontend estaban instaladas. No hay errores de entorno.

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
Cada AC tiene al menos un marcador `SDD: 021` en un test, y todos los tests marcados pasan (la suite de cada ámbito está en verde).

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 … AC-001.7 | T-001, T-021, T-022, T-024, T-050, T-052, T-053 | `backend/tests/test_services/test_usda_csv_reader.py`, `backend/tests/test_services/test_food_import_service.py` | ✅ |
| REQ-002 | AC-002.1, AC-002.2, AC-002.3 | T-025, T-036, T-053, T-055 | `backend/tests/test_services/test_food_import_service.py`, `backend/tests/test_routes/test_food_routes.py` | ✅ |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3 | T-026, T-051, T-053 | `backend/tests/test_services/test_food_import_service.py` | ✅ |
| REQ-004 | AC-004.1 … AC-004.4 | T-023, T-027, T-052, T-053 | `backend/tests/test_services/test_usda_csv_reader.py`, `backend/tests/test_services/test_food_import_service.py` | ✅ |
| REQ-005 | AC-005.1, AC-005.2 | T-024, T-025, T-028, T-053, T-054 | `backend/tests/test_services/test_food_import_service.py` | ✅ |
| REQ-006 | AC-006.1 … AC-006.9 | T-031, T-032, T-033, T-051, T-055, T-056 | `backend/tests/test_routes/test_food_routes.py`, `backend/tests/test_services/test_food_search_service.py` | ✅ |
| REQ-007 | AC-007.1, AC-007.2 | T-031, T-033, T-051, T-055, T-056 | `backend/tests/test_routes/test_food_routes.py`, `backend/tests/test_services/test_food_search_service.py` | ✅ |
| REQ-008 | AC-008.1 … AC-008.4 | T-029, T-034, T-055, T-056 | `backend/tests/test_services/test_food_search_service.py`, `backend/tests/test_routes/test_food_routes.py` | ✅ |
| REQ-009 | AC-009.1, AC-009.2 | T-034, T-056 | `backend/tests/test_routes/test_food_routes.py` | ✅ |
| REQ-010 | AC-010.1 … AC-010.3 | T-030, T-035, T-055 | `backend/tests/test_services/test_food_search_service.py`, `backend/tests/test_routes/test_food_routes.py` | ✅ |
| REQ-011 | AC-011.1 … AC-011.3 | T-030, T-035, T-055, T-056 | `backend/tests/test_services/test_food_search_service.py`, `backend/tests/test_routes/test_food_routes.py` | ✅ |
| REQ-012 | AC-012.1 … AC-012.8 | T-037, T-040, T-044, T-058, T-059, T-060, T-061, T-062 | `frontend/src/features/foods/format.test.ts`, `frontend/src/features/foods/pages/FoodsPage.test.tsx`, `frontend/src/components/layout/noFoodsLink.test.tsx`, `frontend/src/app/foodsRoute.test.tsx` | ✅ |
| REQ-013 | AC-013.1 … AC-013.7 | T-038, T-039, T-041, T-057, T-058, T-060, T-061 | `frontend/src/features/foods/schemas.test.ts`, `frontend/src/features/foods/searchError.test.ts`, `frontend/src/features/foods/pages/FoodsPage.test.tsx` | ✅ |
| REQ-014 | AC-014.1 | T-042, T-061 | `frontend/src/features/foods/pages/FoodsPage.test.tsx` | ✅ |
| NFR-001 | AC-N001.1 | T-043, T-062 | `frontend/src/app/foodsRoute.test.tsx` | ✅ |
| NFR-002 | AC-N002.1, AC-N002.2 | T-042, T-060, T-061 | `frontend/src/features/foods/pages/FoodsPage.test.tsx` | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (48 de 48 marcadas)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno

## 3. Criterios de aceptación manuales
- **Calidad de la búsqueda en español e inglés (Q8, REQ-006 y REQ-012):** 20 consultas reales contra Voyage con la base importada. **Manual, no ejecutado** (requiere la importación real y Voyage; no se usa producción ni Supabase).
- **Tamaño de `public.foods`** (`SELECT pg_size_pretty(pg_total_relation_size('public.foods'))`, plan.md): **manual, no medido** (requiere la importación real; se anota aquí cuando se haga).
- **Migración `c8e2a4f6b9d3`:** no aplicada en ninguna base por esta verificación (el verifier no aplica migraciones). El plan pedía aplicarla en la base de desarrollo antes de importar. **Pendiente de decisión del orquestador.**

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ratchet de ruff del backend: 13 violaciones nuevas E501 (líneas de 101 a 111 caracteres) en archivos de test de la feature | `backend/tests/test_routes/test_food_routes.py` L28, L121, L127; `backend/tests/test_services/test_food_import_service.py` L46, L142, L148, L222, L308, L403; `backend/tests/test_services/test_food_search_service.py` L39; `backend/tests/test_services/test_usda_csv_reader.py` L102, L135; `backend/tests/usda_samples.py` L43. `lint-ratchet: 13 violación(es) nueva(s) respecto a main. FAIL` | test-author |

No bloqueante, para el backlog (no cambia el resultado): en `backend/models/food.py`, `search_vector` está declarado como `Mapped[str]` (NOT NULL por defecto), mientras que la migración `c8e2a4f6b9d3` lo crea con `nullable=True`. Es una columna generada, así que en la práctica nunca es nula, pero el modelo y la migración no coinciden. La migración la escribió a mano el implementer y no la detectan los tests (create_all).
