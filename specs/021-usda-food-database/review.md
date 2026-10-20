# Review 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...feat/021-usda-food-database` @ `0618094` (+ cambios sin commitear: solo `backlog.md`, `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
Segunda pasada tras las correcciones de la iteración 1. El commit `0618094` toca solo tres líneas de código, una por
hallazgo: F1 (la migración crea `search_vector` como `NOT NULL`), F3 (`zip(..., strict=True)`) y F5 (el espacio en
`router.tsx`). He comprobado que F1 está resuelto de verdad: el DDL que compila el modelo y el SQL offline de la
migración son idénticos. No hay regresiones: los tests no cambiaron, el snapshot es idéntico y los 100 tests de la
feature pasan. Quedan F2, F4 y F6, menores, en el backlog para que los decida el usuario en el gate.

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1: el commit de correcciones no altera ningún comportamiento especificado.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.2 | Sí | `backend/services/usda_csv_reader.py:117-141`; `backend/services/food_import_service.py:69-87`; tests `test_usda_csv_reader.py`, `test_food_import_service.py` |
| AC-001.3, AC-001.6, AC-001.7 | Sí | `usda_csv_reader.py:123-131`: orden 1008 → 2047 → 2048 → `None`, nunca calculado desde los macros |
| AC-001.4 | Sí | `usda_csv_reader.py:103-109` y `:137-139` (valor ausente = `None`, no 0) |
| AC-001.5 | Sí | `usda_csv_reader.py:36-45,101-102` |
| AC-002.1 – AC-002.3 | Sí | `food_import_service.py:89-114`; los ausentes no se tocan (`test_food_routes.py:424`) |
| AC-003.1 – AC-003.3 | Sí | `food_import_service.py:110-111` y `:115-131` |
| AC-004.1 – AC-004.4 | Sí | `food_import_service.py:45-50,115-131`; `usda_csv_reader.py:48-61` |
| AC-005.1, AC-005.2 | Sí | `food_import_service.py:61-65`, `format_summary` en `:134-145` |
| AC-006.1 – AC-006.9 | Sí | `backend/services/food_search_service.py:40-47,59-83`; `backend/repositories/food_repository.py:19-40`; `backend/routes/food_routes.py:16-35` |
| AC-007.1, AC-007.2 | Sí | `food_search_service.py:79-80`; `food_repository.py:36` |
| AC-008.1 – AC-008.4 | Sí | `food_search_service.py:29-37,60` |
| AC-009.1, AC-009.2 | Sí | `food_routes.py:31` (`@require_auth`) |
| AC-010.1 – AC-010.3 | Sí | `food_search_service.py:62-68` |
| AC-011.1 – AC-011.3 | Sí | `food_search_service.py:70-74` |
| AC-012.1 – AC-012.8 | Sí | `frontend/src/features/foods/pages/FoodsPage.tsx`, `components/FoodSearchForm.tsx`, `components/FoodResultList.tsx`, `format.ts`; sin cambios en `Navbar` ni `BottomTabBar` |
| AC-013.1 – AC-013.7 | Sí | `frontend/src/features/foods/schemas.ts:8-15`; `FoodSearchForm.tsx:50`; `searchError.ts:5-11`; `FoodsPage.tsx:33-47` |
| AC-014.1 | Sí | `FoodsPage.tsx:8-9,53` |
| AC-N001.1 | Sí | `frontend/src/app/router.tsx:28,162-169`; chunk de entrada 384,53 kB (verify-report, iteración 3) |
| AC-N002.1, AC-N002.2 | Sí | `FoodSearchForm.tsx:45-51`; `FoodsPage.tsx:29` |
| Alcance §3: 20 consultas manuales y tamaño de `public.foods` | **Pendiente** | `verify-report.md` §3 (F2, en el backlog) |

## 3. Cumplimiento del plan
- **F1, resuelto:** `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py:35` tiene ahora `nullable=False`.
  Lo he comprobado comparando el `CREATE TABLE` que compila `Food.__table__` con el SQL offline de la migración
  (`FLASK_ENV=development flask db upgrade e5b7d9f1a3c6:c8e2a4f6b9d3 --sql`, sin conectar a la base). Coinciden columna a
  columna, incluida `search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english'::regconfig, description)) STORED
  NOT NULL`, la `CHECK` `ck_foods_data_type`, la clave primaria y el índice GIN `ix_foods_search_vector`.
  `flask db heads` devuelve una sola cabeza, `c8e2a4f6b9d3`.
- **F3, resuelto:** `backend/services/food_import_service.py:125` usa `zip(pending, vectors, strict=True)`. Si los
  vectores no cuadran, se lanza `ValueError` dentro del `try`: rollback del lote, `embedding_failed` y fin del bucle. Ya
  no puede quedarse en un bucle infinito.
- **F5, resuelto:** `frontend/src/app/router.tsx:29` vuelve a ser idéntico a `main`. El diff del router contra `main`
  solo añade `FoodsPage` y su ruta.
- El resto de desviaciones (migración escrita a mano, `backend/scripts/**` en `.sdd/config.json`) ya se valoraron como
  justificadas en la iteración 1.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` es idéntico (0 cambiados, borrados o añadidos). Desde
      `commits.tests` (`b1ac9ee`), los tests solo cambiaron en `d009a5a`, la corrección de formato E501 autorizada
      (`rework tests` y `snapshot` posterior en `history`). `0618094` no toca tests.
- [x] B4: los marcadores `SDD: 021 …` son coherentes con los AC, con la salvedad menor de F6 (en el backlog).
- [x] B5: no hay tests borrados, saltados ni debilitados, ni llamadas a Voyage o Redis reales. Los 100 tests de la
      feature pasan (ejecutados en esta revisión).
- [x] B5.7: el ratchet de ruff no da violaciones nuevas, y `npm run lint`, `npx tsc -b` y `npm run build` pasan
      (verify-report, iteración 3).
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: los marcadores, la ubicación y el nombre de los tests y los dobles escritos a mano siguen la convención.
- [x] P2.1 / P2.2: capas respetadas; solo `UnitOfWork` hace commit; inyección por constructor.
- [x] P2.3: excepciones de `custom_exceptions.py` para los errores HTTP; `UsdaFileError` justificada en el plan.
- [x] P2.4: la migración está incluida, revisada y **coincide con el modelo** (F1 resuelto).
- [x] P2.5: reutiliza `utils/embeddings.py` y `utils/rate_limiter.py`.
- [x] P2 frontend: estructura de feature, `apiFetch`, TanStack Query, react-hook-form con zod y componentes de `ui/`.
- [x] P2 General: textos, comentarios y docstrings en español correcto.
- [x] P3.1 – P3.5: autenticación, validación de entrada y salida, límite en Redis, SQL parametrizado y sin secretos.
- [x] P4: la migración es no destructiva y coincide con el modelo. Documentar en `docs/deploy-runbook.md` los pasos
      manuales (`flask db upgrade`, copiar los CSV e importar en la instancia, medir el tamaño) le toca al `doc-keeper`
      en la etapa docs.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ resuelto | `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py:35` | Resuelto en `0618094`: la migración y el modelo generan el mismo DDL (comprobado). | implementer |
| F2 | MENOR (backlog) | `specs/021-usda-food-database/verify-report.md` §3 | Siguen sin hacerse las 20 consultas manuales contra Voyage ni la medición del tamaño de `public.foods`, y la migración no se ha aplicado en ninguna base. El usuario debe hacerlo o diferirlo explícitamente antes de `close` y del despliegue en Supabase. | implementer |
| F3 | ~~MENOR~~ resuelto | `backend/services/food_import_service.py:125` | Resuelto: `zip(..., strict=True)`. | implementer |
| F4 | MENOR (backlog) | `backend/scripts/import_usda_foods.py:31-38` | El script escribe sin pedir confirmación cuando la base no es local. Valorar un `--yes` o una confirmación interactiva. | implementer |
| F5 | ~~NIT~~ resuelto | `frontend/src/app/router.tsx:29` | Resuelto: la línea vuelve a ser idéntica a `main`. | implementer |
| F6 | NIT (backlog) | `frontend/src/app/foodsRoute.test.tsx:113` | El marcador `AC-012.1` del test «con el onboarding pendiente, /foods no se muestra» debería ser `REQ-012`. | test-author |
| F7 | NIT | `specs/021-usda-food-database/state.json` (notas de `history`) | Las notas de `spec` y `tasks` dicen «60 AC», pero `spec.md` tiene 61 (58 de REQ y 3 de NFR). Ya está en el backlog del verifier. Basta con usar la cifra correcta en la documentación de la etapa docs. | implementer |

## 6. Decisión
APPROVED: no quedan hallazgos BLOQUEANTES ni MAYORES. F1 está resuelto y comprobado contra el DDL del modelo, y las
correcciones no causan regresiones. F2 (pasos manuales antes del despliegue), F4 y F6 quedan en el backlog de la feature
para que los decida el usuario en el gate de review.
