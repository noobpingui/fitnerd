# Verify report 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-20T09:15:35.842Z · **Rama:** `feat/021-usda-food-database` @ `d4c1113` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1192 passed, 0 failed (82 s). Frente a la verificación anterior (1175), suma los tests nuevos de `test_import_usda_foods_script.py` y `test_food_text_ranking.py` |
| backend | ratchet de ruff: `lint-ratchet.mjs backend` (raíz del repo) | ✅ | sin violaciones nuevas respecto a main (exit 0) |
| frontend | `npm test` (`frontend`) | ✅ | 842 passed en 65 archivos, 0 failed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni avisos (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | sin errores de tipos (exit 0) |
| frontend | `npm run build` (`frontend`) | ✅ | Chunk de entrada `index-*.js`: 384,53 kB (gzip 122,88 kB), por debajo de 500 kB (ADR-0026, NFR-001). `FoodsPage` en chunk propio de 3,72 kB. |

Comprobación adicional de los dos archivos de test nuevos, ejecutados por separado: `test_import_usda_foods_script.py` y `test_food_text_ranking.py`, 17 passed, 0 failed.

Entorno: Postgres (5433) respondía; dependencias instaladas en backend y frontend. No hay errores de entorno.

## 2. Trazabilidad
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

Tests añadidos en esta pasada, con marcadores aproximados. La spec no tiene AC propio para ellos, así que no se cuentan como fallo de trazabilidad:
- `backend/tests/test_scripts/test_import_usda_foods_script.py`: marcador `SDD: 021 REQ-001`. Cubre la confirmación antes de escribir en una base no local (F4), que tiene `--yes`.
- `backend/tests/test_services/test_food_text_ranking.py`: marcador `SDD: 021 REQ-006 AC-006.1`. Cubre la normalización de `ts_rank_cd` por longitud de descripción. Su marcador AC-006.1 es aproximado.

- AC sin test: — (los 61 AC de `spec.md` tienen al menos un marcador `SDD: 021` y todos pasan; no hay marcadores `SDD: 021` con AC que no existan en la spec)
- REQ sin tarea: — (los 16 REQ/NFR aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: — (48 de 48 marcadas)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno (búsqueda en el diff `main...HEAD` y en `backend/tests` y `frontend/src`; las coincidencias de «only» son texto de la spec, no marcas de test)

## 3. Criterios de aceptación manuales
- **Calidad de la búsqueda en español e inglés (Q8, REQ-006 y REQ-012):** validación manual hecha por el orquestador contra la base local (`localhost:5433`), con 22 consultas (12 en español y 10 en inglés). **No repetida por verify.** Resultados según el backlog de la feature:
  - sin errores ni listas vacías; los alimentos comunes salen bien en ambos idiomas;
  - ⚠️ «banana» no devuelve «Bananas, raw» en los 20 primeros resultados;
  - ⚠️ «avena cocida» no devuelve avena en los 5 primeros;
  - ⚠️ el umbral 0,6 deja pasar resultados absurdos («xyzzy qwerty», «zapato de cuero»).
  - Decisión para el usuario en el gate: aceptar la 021 con estos puntos (Q8 prevé pasar a la 022 si la calidad no basta) o ajustar antes de `close`.
- **Tamaño de `public.foods`:** medido por el orquestador en la base local: 48 MB (base completa 58 MB), dentro del límite de 500 MB de Supabase. La medición en producción sigue pendiente.
- **Migraciones y paso de producción:** el orquestador aplicó en local `a7d3f9c1e5b2`, `e5b7d9f1a3c6` y `c8e2a4f6b9d3`. Verify no aplica migraciones. La aplicación en producción, la copia de los CSV a EC2 y la importación siguen siendo pasos manuales que deben quedar en `docs/deploy-runbook.md` (P4, etapa docs).

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno en las comprobaciones automáticas | — | — |
