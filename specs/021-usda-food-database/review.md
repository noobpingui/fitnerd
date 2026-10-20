# Review 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...feat/021-usda-food-database` @ `d009a5a` (+ cambios sin commitear: solo `state.json` y `verify-report.md` de la feature)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen
La feature añade la tabla `public.foods` (modelo `Food` y migración `c8e2a4f6b9d3`), el lector de CSV de USDA, la
importación en dos fases reanudable, el endpoint `GET /api/foods/search` con fusión RRF de texto y similitud, y la
pantalla «Alimentos» en `/foods`, cargada bajo demanda. El código está limpio, sigue las capas y el plan casi al pie de
la letra, y los tests prueban de verdad cada AC. Lo único que impide aprobar es que la migración, escrita a mano, no
coincide con el modelo en la nulabilidad de `search_vector`. Es un cambio de una línea que conviene hacer ahora, antes
de que la migración se aplique en algún sitio.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.2 | Sí | `backend/services/usda_csv_reader.py:117-141` (filtro por `USDA_DATA_TYPES`, registro con los 4 valores); `backend/services/food_import_service.py:69-87` (alta); tests `test_usda_csv_reader.py`, `test_food_import_service.py` |
| AC-001.3, AC-001.6, AC-001.7 | Sí | `usda_csv_reader.py:123-131`: orden 1008 → 2047 → 2048 → `None`; nunca se calcula a partir de los macros |
| AC-001.4 | Sí | `usda_csv_reader.py:103-109` (`amount` vacío = `None`) y `:137-139` (`found.get` → `None`, no 0) |
| AC-001.5 | Sí | `usda_csv_reader.py:36-45,101-102` (`_WANTED_NUTRIENTS`) |
| AC-002.1, AC-002.2 | Sí | `food_import_service.py:89-114` (comparación por `fdc_id`; `unchanged`/`updated`) |
| AC-002.3 | Sí | Los alimentos ausentes no se tocan; `test_food_routes.py:424` lo prueba de extremo a extremo |
| AC-003.1 – AC-003.3 | Sí | `food_import_service.py:110-111` (`embedding = None` solo si cambia la descripción) y `:117-131` (solo pendientes; sin pendientes no llama a Voyage) |
| AC-004.1, AC-004.2 | Sí | `food_import_service.py:45-50` (se leen todas las fuentes antes de escribir); `usda_csv_reader.py:48-61` (mensajes con archivo y columna) |
| AC-004.3, AC-004.4 | Sí | `food_import_service.py:117-131` (commit por lote, rollback y parada en el primer fallo; reanudación en la siguiente ejecución) |
| AC-005.1, AC-005.2 | Sí | `food_import_service.py:61-65` y `format_summary` en `:134-145` |
| AC-006.1 – AC-006.9 | Sí | `backend/services/food_search_service.py:59-83`, `fuse_rankings` en `:40-47`; `backend/repositories/food_repository.py:19-40`; `backend/routes/food_routes.py:16-35` (solo lee `q`) |
| AC-007.1, AC-007.2 | Sí | `food_search_service.py:79-80`; umbral `max_distance` en `food_repository.py:36` |
| AC-008.1 – AC-008.4 | Sí | `food_search_service.py:29-37`, llamado antes del límite y de Voyage (`:60`) |
| AC-009.1, AC-009.2 | Sí | `food_routes.py:31` (`@require_auth`) |
| AC-010.1 – AC-010.3 | Sí | `food_search_service.py:62-68` (clave por `user_id` del token, 30 por 60 s, antes de Voyage; cuenta también las que acaban en 503) |
| AC-011.1 – AC-011.3 | Sí | `food_search_service.py:70-74` (`ServiceUnavailableError`, sin resultados parciales) |
| AC-012.1 – AC-012.7 | Sí | `frontend/src/features/foods/pages/FoodsPage.tsx`, `components/FoodSearchForm.tsx`, `components/FoodResultList.tsx`, `format.ts` |
| AC-012.8 | Sí | Sin cambios en `Navbar` ni `BottomTabBar`; `noFoodsLink.test.tsx` |
| AC-013.1 – AC-013.3 | Sí | `frontend/src/features/foods/schemas.ts:8-15`; `FoodSearchForm.tsx:50` (`maxLength`) |
| AC-013.4 – AC-013.7 | Sí | `frontend/src/features/foods/searchError.ts:5-11`; `FoodsPage.tsx:33-47` («Reintentar» con `variables`; el formulario nunca se vacía) |
| AC-014.1 | Sí | `FoodsPage.tsx:8-9,53` |
| AC-N001.1 | Sí | `frontend/src/app/router.tsx:28,162-169`; build con el chunk de entrada en 384,53 kB (verify-report) |
| AC-N002.1, AC-N002.2 | Sí | `FoodSearchForm.tsx:45-51` (`FormLabel` + `type="search"`); `FoodsPage.tsx:29` (`role="status"`, `aria-live="polite"`) |
| Alcance §3: validación manual de unas 20 consultas y tamaño de `public.foods` | **Pendiente** | `verify-report.md` §3: «Manual, no ejecutado» (ver F2) |

## 3. Cumplimiento del plan
- La implementación sigue las firmas, los mensajes y la lógica de las secciones 3.2 y 3.3 del plan sin desviaciones
  funcionales.
- **Migración:** el plan pedía generarla con `flask db migrate` y revisarla a mano. Se escribió a mano y quedó
  `search_vector` con `nullable=True`, mientras que el modelo (`Mapped[str]`) crea `NOT NULL` con `create_all()` (F1).
  Lo he comprobado con el DDL que compila el modelo y con el SQL offline de la migración
  (`flask db upgrade e5b7d9f1a3c6:c8e2a4f6b9d3 --sql`, sin conexión a la base). El resto coincide: tipos, `CHECK`
  `ck_foods_data_type`, columna generada `STORED`, índice GIN `ix_foods_search_vector`, clave primaria, `schema='public'`
  y `down_revision = 'e5b7d9f1a3c6'`. `alembic heads` devuelve una sola cabeza (`c8e2a4f6b9d3`), y el downgrade borra el
  índice y la tabla.
- **Riesgo «migración que no coincide con el modelo»:** la mitigación del plan («el `verifier` aplica `flask db upgrade`
  en la base de desarrollo antes de importar») no se ejecutó: la migración no se ha aplicado en ninguna base (F2).
- **`.sdd/config.json`:** añade `backend/scripts/**` a los globs de producción del ámbito `backend`. Lo aprobó el usuario
  (según el orquestador) y resuelve el riesgo anotado en el plan. Justificado.
- **Script de importación:** cumple la mitigación del plan. `create_app()` sin `FLASK_ENV` cae en `default` →
  `DevelopmentConfig` (`backend/app.py:21`, `backend/config.py:133`), no en producción como `wsgi.py`. Antes de escribir
  imprime el entorno y la base sin contraseña (`backend/scripts/import_usda_foods.py:31-36`). Solo apunta a producción
  con `FLASK_ENV=production`, que es lo que fija `docker-compose.prod.yml` en la instancia. No pide confirmación antes de
  escribir (F4, menor).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` es idéntico. Los tests cambiaron desde `commits.tests`
      (`b1ac9ee`) solo en `d009a5a`, una corrección autorizada (`rework tests` y `snapshot` posterior en `history`), y el
      diff es solo de formato (E501), sin cambios de aserciones.
- [x] B4: los marcadores `SDD: 021 …` son coherentes con los AC (con una salvedad menor, F6).
- [x] B5: no hay tests borrados, saltados ni debilitados. Ningún test llama a Voyage ni a Redis reales (dobles en
      `tests/fakes.py` instalados en el atributo `client` de los singletons, patrón existente). Los esqueletos están
      sustituidos por la implementación.
- [x] B5.7: el ratchet de ruff no da violaciones nuevas, y `npm run lint` y `npx tsc -b` pasan sin errores
      (verify-report, iteración 2).
- [x] B6.5: no hay secretos ni variables nuevas (se reutilizan `VOYAGE_*` y `REDIS_URL`).

### Parte II (proyecto)
- [x] P1.1 / P1.2: los marcadores llevan el número de spec, y los docstrings y comentarios están en español.
- [x] P1 backend: los tests están en `test_services/` y `test_routes/`, con nombres en inglés y dobles escritos a mano,
      sin `unittest.mock` ni `monkeypatch`.
- [x] P1 frontend: los tests están junto a su archivo, con `vitest` importado, `it("…")` en español y la red simulada en
      `@/features/foods/api`.
- [x] P2.1 / P2.2: se respetan las capas `routes → services → repositories → models`. Solo `UnitOfWork` hace commit,
      también en la importación, y las dependencias se inyectan por constructor con `_build_food_search_service()`.
- [x] P2.3: los errores HTTP usan `ValidationError`, `RateLimitError` y `ServiceUnavailableError`. `UsdaFileError` queda
      fuera de `custom_exceptions.py`, con justificación en el plan (§7): no es un error HTTP.
- [ ] P2.4: la migración está incluida pero **no coincide con el modelo** en la nulabilidad de `search_vector` (F1).
- [x] P2.5: reutiliza `utils/embeddings.py` (`embed_query`, `embed_documents`) y `utils/rate_limiter.py`.
- [x] P2 frontend: la feature `foods` tiene `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, `components/` y `pages/`. Usa
      `apiFetch`, TanStack Query (mutación), react-hook-form con zod y los componentes de `@/components/ui/`.
- [x] P2 General: los textos visibles, comentarios y docstrings están en español correcto, sin voseo.
- [x] P3.1: `@require_auth`. El `user_id` del token solo se usa en la clave del límite y no se recibe del cliente.
- [x] P3.2: la consulta se valida en el servicio (`ValidationError`) y con zod en el frontend, y la respuesta también se
      valida con zod (`foodSearchResponseSchema`).
- [x] P3.3: límite en Redis de 30 por minuto y por usuario, y los fallos de Voyage salen como 503.
- [x] P3.4: las consultas usan el ORM y parámetros enlazados (`websearch_to_tsquery`, `cosine_distance`), sin
      concatenar SQL.
- [x] P3.5: no hay `.env` ni claves en el diff.
- [ ] P4: la migración está incluida, pero falta corregir F1. Los pasos manuales de producción (`flask db upgrade`,
      copiar los CSV e importar en la instancia, medir el tamaño) los tiene que documentar el `doc-keeper` en
      `docs/deploy-runbook.md` (pendiente de su etapa).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py:35` (frente a `backend/models/food.py:29`) | La migración crea `search_vector` con `nullable=True`, pero el modelo declara `Mapped[str]`, y `create_all()` (lo que usan los tests) emite `... STORED NOT NULL`. Comprobado con el DDL del modelo y con el SQL offline de la migración. Producción tendría un esquema distinto del probado, y el próximo `flask db migrate` propondría un `alter_column` espurio. Art. P2.4 exige que la migración se revise a mano y coincida con el modelo. La migración aún no se ha aplicado en ninguna base, así que corregirla ahora es cambiar `nullable=True` por `nullable=False`; después haría falta otra migración. | implementer |
| F2 | MENOR | `specs/021-usda-food-database/verify-report.md` §3 | La spec (§3, «Incluye») pide validar a mano unas 20 consultas reales y el plan pide medir el tamaño de `public.foods` (riesgo de los 500 MB de Supabase), pero no se hizo ninguna de las dos cosas. La migración tampoco se ha aplicado en la base de desarrollo, que era la mitigación del plan para el riesgo de desajuste entre modelo y migración. No bloquea el código, pero hay que hacerlo (o que el usuario lo difiera explícitamente) antes del gate de `close` y del despliegue en Supabase. | implementer |
| F3 | MENOR | `backend/services/food_import_service.py:125` | `zip(pending, vectors)` sin `strict=True`: si el proveedor devolviera menos vectores que textos, los alimentos sobrantes quedarían sin vector sin que nadie lo detectara. En el caso límite (siempre uno menos), el bucle `while True` de `_complete_embeddings` no terminaría nunca. Conviene usar `zip(..., strict=True)`, que convierte la discrepancia en un fallo controlado (`embedding_failed`). | implementer |
| F4 | MENOR | `backend/scripts/import_usda_foods.py:31-38` | El script imprime el entorno y la base de destino, pero escribe enseguida, sin confirmación. El plan califica de «Alto» el impacto de importar contra la base equivocada. Valorar un `--yes` o una confirmación interactiva cuando la base no es local. | implementer |
| F5 | NIT | `frontend/src/app/router.tsx:29` | Se tocó sin querer la línea de `CoachPage`: ahora es `const CoachPage =lazyNamed(` (falta el espacio después de `=`). Es un cambio fuera del alcance de la feature. | implementer |
| F6 | NIT | `frontend/src/app/foodsRoute.test.tsx:113` | El test «con el onboarding pendiente, /foods no se muestra» lleva el marcador `AC-012.1`, que habla del estado inicial de la pantalla. Lo que prueba es la condición del enunciado de REQ-012 (onboarding completado), así que bastaría con el marcador `REQ-012`. | test-author |

## 6. Decisión
CHANGES_REQUESTED: hay un hallazgo MAYOR abierto (F1, responsable `implementer`), una corrección de una línea en la
migración. Los MENORES y los NIT se pueden corregir en la misma iteración o pasar al backlog con la aprobación del
usuario. F2 es un paso manual que el usuario debe hacer o diferir explícitamente antes de `close`.
