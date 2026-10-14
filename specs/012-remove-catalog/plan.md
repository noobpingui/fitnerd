# Plan 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Spec:** [spec.md](spec.md) (iteración 3, con Q8 resuelta; aprobada el 2026-10-14)

## 1. Resumen de la solución

Es una retirada sin funciones nuevas. En el **backend** se borran las cinco piezas verticales del catálogo, los favoritos y el plan semanal (rutas, servicios, repositorios y modelos), se quitan sus registros en `routes/__init__.py` y `models/__init__.py`, y se borra el script `migrate_catalog_to_prod.py`. Una **migración Alembic escrita a mano** elimina las cinco tablas. Su `downgrade()` las vuelve a crear **vacías** con la estructura exacta de la revisión `d8e4b2a7c1f5`. Las URL retiradas responden `404` con `{"error": …}` a través del `errorhandler(HTTPException)` que ya existe, sin código nuevo. En el **frontend** se borran `features/exercises/`, `features/weekly-plan/` y el interruptor `app/sections.ts`, y se simplifican el router, la `Navbar`, la `BottomTabBar` y el `AuthHero`. También se reescriben los textos afectados de las dos páginas legales y se quita la dependencia `@dnd-kit/core`, que queda sin uso. La única pieza "nueva" es la migración. El resto son borrados y ediciones.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | `backend/migrations/versions/f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py` | `backend/models/__init__.py` (quita `BodyRegion`, `ExerciseCategory`, `Exercise`, `ExerciseFavorite` y `WeeklyPlanEntry`) · **Borrados:** `backend/models/body_region.py`, `exercise_category.py`, `exercise.py`, `exercise_favorite.py`, `weekly_plan_entry.py` | REQ-003 y NFR-001 |
| backend · repositories | — | **Borrados:** `backend/repositories/body_region_repository.py`, `exercise_category_repository.py`, `exercise_repository.py`, `exercise_favorite_repository.py`, `weekly_plan_repository.py` | REQ-001 y NFR-001 |
| backend · services | — | **Borrados:** `backend/services/body_region_service.py`, `exercise_category_service.py`, `exercise_service.py`, `exercise_favorite_service.py`, `weekly_plan_service.py` | REQ-001 y NFR-001 |
| backend · routes | — | `backend/routes/__init__.py` (quita los imports y los `register_blueprint` de `body_region_bp`, `exercise_category_bp`, `exercise_bp`, `exercise_favorite_bp` y `weekly_plan_bp`) · **Borrados:** `backend/routes/body_region_routes.py`, `exercise_category_routes.py`, `exercise_routes.py` (incluye `POST`/`DELETE /api/exercises/{id}/favorites`), `exercise_favorite_routes.py`, `weekly_plan_routes.py` | REQ-001 |
| backend · scripts | — | **Borrado:** `backend/scripts/migrate_catalog_to_prod.py` | Alcance ("Retirar el script de migración del catálogo") y NFR-001 |
| backend · tests (lo hace el **test-author**) | `backend/tests/test_routes/test_retired_catalog_routes.py`, `backend/tests/test_services/test_catalog_removal_migration.py`, `backend/tests/test_services/test_no_catalog_leftovers.py` | `backend/tests/test_routes/test_health_routes.py` (la fila sembrada en `test_health_check_does_not_change_row_counts` pasa de `BodyRegion` a `User`) · **Borrados:** `backend/tests/test_routes/test_exercise_routes.py`, `backend/tests/test_services/test_weekly_plan_service.py` | REQ-001, REQ-002, REQ-003 y NFR-001 |
| frontend · app | `frontend/src/app/router.test.tsx` gana casos (no es un archivo nuevo) y `frontend/src/app/noRetiredSections.test.ts` (nuevo) | `frontend/src/app/router.tsx` (quita el import de `CATALOG_ENABLED`, los imports de `RegionsPage`, `CategoriesPage`, `ExercisesPage` y `FavoritesPage`, y el bloque condicional de rutas) · `frontend/src/app/AppLayout.tsx` y `frontend/src/app/providers.tsx` (solo comentarios que citan `/categories`, `/favorites` y "categorias, ejercicios, favoritos") · **Borrado:** `frontend/src/app/sections.ts` | REQ-004, REQ-008 y NFR-001 |
| frontend · components/layout | `frontend/src/components/layout/Navbar.test.tsx`, `frontend/src/components/layout/BottomTabBar.test.tsx` | `Navbar.tsx` (lista fija: Macros, Métricas, Coach y Tienda) · `BottomTabBar.tsx` (lista fija: Inicio, Macros, Métricas, Coach y Tienda; quita los iconos `Dumbbell` y `Heart`) | REQ-005 |
| frontend · features/auth | `frontend/src/features/auth/components/AuthHero.test.tsx` | `AuthHero.tsx` (solo la etiqueta "AI Coach online"; quita los iconos `Dumbbell` y `Heart` y el import de `sections`) | REQ-006 |
| frontend · features/legal | `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx` | `PrivacyPolicyPage.tsx`, `TermsOfServicePage.tsx` (textos y `updatedAt`) · `PrivacyPolicyPage.test.tsx` (gana casos de 012) | REQ-007 |
| frontend · features/store | — | `frontend/src/features/store/pages/StorePage.tsx` (solo el comentario que cita `/favorites` y `FavoritesPage`) | NFR-001 (limpieza de referencias) |
| frontend · features/exercises, weekly-plan | — | **Borrados:** todo `frontend/src/features/exercises/` (`api.ts`, `hooks.ts`, `types.ts`, `components/ExerciseCard.tsx` y `pages/RegionsPage.tsx`, `CategoriesPage.tsx`, `ExercisesPage.tsx`, `FavoritesPage.tsx`) y todo `frontend/src/features/weekly-plan/` (`api.ts`, `hooks.ts`, `types.ts`, `constants.ts`, `components/DayColumn.tsx`, `DraggableFavoriteCard.tsx`) | REQ-004 y NFR-001 |
| frontend · dependencias | — | `frontend/package.json` y `package-lock.json`: `npm uninstall @dnd-kit/core` (solo lo usan `FavoritesPage`, `DayColumn` y `DraggableFavoriteCard`) | NFR-001 (código muerto); AC-N001.3 confirma que el build sigue funcionando |
| docs (etapa `docs`, `doc-keeper`) | — | `README.md`, `CLAUDE.md` (sección Proyecto: fila "Catálogo de ejercicios" y fila "Favoritos y plan semanal") y la documentación de despliegue | Alcance: copia de seguridad completa y migración en los pasos de despliegue |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

**Revisión nueva:** `f2c4e6a8b0d1`, con `down_revision = 'd8e4b2a7c1f5'` (la cabeza actual; la cadena es lineal). Archivo: `backend/migrations/versions/f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py`. Se escribe **a mano**, sin `flask db migrate`, porque el autogenerate añade ruido de FK en otras tablas (se ve en las migraciones `d3ad5ce8b8f3`, `547be2ed9516` y `349c552be1f5`). Todas las operaciones llevan `schema='public'`.

**`upgrade()`:** borra las tablas en orden inverso de dependencias. Los índices y las FK caen con cada tabla.
1. `op.drop_table('weekly_plan_entries', schema='public')`
2. `op.drop_table('exercise_favorites', schema='public')`
3. `op.drop_table('exercises', schema='public')`
4. `op.drop_table('exercise_categories', schema='public')`
5. `op.drop_table('body_regions', schema='public')`

No se usa `IF EXISTS`. Si una tabla no existe, la migración falla y avisa: es mejor eso que tapar una deriva del esquema en producción.

**`downgrade()`:** vuelve a crear las cinco tablas **vacías** (Q2), con la estructura final que tenían en `d8e4b2a7c1f5`, y en orden de dependencias. Las restricciones únicas sin nombre explícito y las FK se crean sin nombre, así que Postgres les pone los mismos nombres que tienen hoy (`body_regions_name_key`, `exercise_categories_name_key`, `<tabla>_<columna>_fkey`).

| Tabla | Columnas (tipo, nulabilidad, default) | Restricciones e índices |
|---|---|---|
| `body_regions` | `id` Uuid PK · `name` String(100) NOT NULL · `is_active` Boolean NOT NULL `server_default='true'` · `created_at` DateTime NOT NULL `server_default=now()` | `UNIQUE(name)` |
| `exercise_categories` | `id` Uuid PK · `name` String(100) NOT NULL · `created_at` DateTime NOT NULL `now()` · `is_active` Boolean NOT NULL `'true'` · `body_region_id` Uuid NOT NULL | `UNIQUE(name)` · FK `body_region_id → public.body_regions.id` · índice `ix_public_exercise_categories_body_region_id` |
| `exercises` | `id` Uuid PK · `category_id` Uuid NOT NULL · `name` String(150) NOT NULL · `video_url` String(500) NOT NULL · `created_at` DateTime NOT NULL `now()` · `is_active` Boolean NOT NULL `'true'` | FK `category_id → public.exercise_categories.id` · `UNIQUE(category_id, name)` con nombre `uq_category_exercise_name` · índice `ix_public_exercises_category_id` |
| `exercise_favorites` | `id` Uuid PK · `user_id` Uuid NOT NULL · `exercise_id` Uuid NOT NULL · `created_at` DateTime NOT NULL `now()` | FK a `public.users.id` y a `public.exercises.id` · `UNIQUE(user_id, exercise_id)` con nombre `uq_user_exercise_favorite` · índices `ix_public_exercise_favorites_user_id` e `ix_public_exercise_favorites_exercise_id` |
| `weekly_plan_entries` | `id` Uuid PK · `user_id` Uuid NOT NULL · `exercise_id` Uuid NOT NULL · `day_of_week` SmallInteger NOT NULL · `created_at` DateTime NOT NULL `now()` | FK a `public.users.id` y a `public.exercises.id` · `UNIQUE(user_id, exercise_id, day_of_week)` con nombre `uq_user_exercise_day` · índices `ix_public_weekly_plan_entries_user_id` e `ix_public_weekly_plan_entries_exercise_id` |

El docstring de `downgrade()` deja claro que los datos **no** vuelven y que solo se recuperan desde la copia de seguridad.

**Tests y `create_all()`:** al quitar los cinco modelos de `models/__init__.py`, `db.metadata` deja de tener las tablas y la base de tests ya no las crea (AC-003.3).

**Orden operativo en producción** (lo documenta el `doc-keeper`):
1. El usuario hace la copia de seguridad **completa** de Supabase (esquema y datos de todas las tablas, por ejemplo con `pg_dump` en una versión mayor o igual que la del servidor) y la guarda en `C:/Users/alber/fitnerd-backups`.
2. Merge a `main`. El CD despliega el backend, que ya no conoce los modelos; las tablas siguen existiendo y nadie las usa.
3. En EC2: `docker compose -f docker-compose.prod.yml exec backend flask db upgrade`.

En local: `FLASK_ENV=development flask db upgrade`. Sin `FLASK_ENV`, el comando apunta a producción.

### 3.2 Contratos de API

No hay endpoints nuevos ni cambiados. Las rutas retiradas dejan de existir en el `url_map`. Werkzeug lanza `NotFound` y `exceptions/error_handlers.py::handle_http_exception` lo traduce a `{"error": <descripción genérica>}`. La respuesta es 404 también con `POST` y `DELETE`, porque ninguna regla coincide con la ruta (no es 405), y llega antes que cualquier decorador `@require_auth` o `@require_admin`, así que es 404 y no 401 ni 403.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| `GET`, `POST` | `/api/body-regions` | ninguna (ya no hay ruta) | cualquiera | — | `404 {"error": …}` |
| `DELETE` | `/api/body-regions/{id}` | ninguna | — | — | `404 {"error": …}` |
| `GET`, `POST` | `/api/exercise-categories` | ninguna | cualquiera | — | `404 {"error": …}` |
| `DELETE` | `/api/exercise-categories/{id}` | ninguna | — | — | `404 {"error": …}` |
| `GET`, `POST` | `/api/exercises` | ninguna | cualquiera | — | `404 {"error": …}` |
| `DELETE` | `/api/exercises/{id}` | ninguna | — | — | `404 {"error": …}` |
| `POST`, `DELETE` | `/api/exercises/{id}/favorites` | ninguna | — | — | `404 {"error": …}` |
| `GET` | `/api/favorites` | ninguna | — | — | `404 {"error": …}` |
| `GET`, `POST` | `/api/weekly-plan` | ninguna | cualquiera | — | `404 {"error": …}` |
| `DELETE` | `/api/weekly-plan/{id}` | ninguna | — | — | `404 {"error": …}` |

Los endpoints que se conservan (`/api/auth/*`, `/api/profile`, `/api/body-metrics…`, `/api/coach/*`, `/api/feedback` y `/api/health`) no cambian. `decorators.require_admin` y la fixture `admin_headers` de `conftest.py` se conservan (Q4). El decorador se queda sin usos en producción, y la fixture se reutiliza en AC-001.2.

### 3.3 Lógica de negocio

No hay servicios nuevos ni cambiados, y no se inyecta ninguna dependencia nueva. Solo se borran `BodyRegionService`, `ExerciseCategoryService`, `ExerciseService`, `ExerciseFavoriteService` y `WeeklyPlanService`, junto con sus `_build_service()` y repositorios. Ningún otro servicio ni repositorio los importa: `coach_service`, `feedback_service`, `progress_analysis_service`, `profile_service` y `body_metric_service` no tienen referencias. Las excepciones de `custom_exceptions.py` se quedan como están, porque las usan otras áreas.

### 3.4 Frontend

- **`app/router.tsx`:** desaparecen el bloque `{CATALOG_ENABLED && (…)}` y los cuatro imports de páginas. Las URL `/categories…` y `/favorites` caen en el comodín `<Route path="*" element={<Navigate to="/home" replace />} />`, que ya existe. Sin sesión, `/home` pasa por `ProtectedRoute`, que manda a `/login` (Q6, sin cambios de comportamiento).
- **`components/layout/Navbar.tsx`:** `links` pasa a ser un array literal `[Macros, Métricas, Coach, Tienda]`.
- **`components/layout/BottomTabBar.tsx`:** `tabs` pasa a ser un array literal `[Inicio, Macros, Métricas, Coach, Tienda]`, y se quitan `Dumbbell` y `Heart` del import de `lucide-react`.
- **`features/auth/components/AuthHero.tsx`:** `features = [{ icon: Sparkles, label: "AI Coach online" }]`, y se quitan `Dumbbell` y `Heart`. Se conserva el `map` para no tocar la animación.
- **`features/legal/pages/PrivacyPolicyPage.tsx`:**
  - "Actividad en la app": "las preguntas que le haces al AI Coach y las valoraciones (👍/👎) que das a sus respuestas (para mejorar el coach y por límites de uso)."
  - "Para qué usamos tu información": por ejemplo, "Únicamente para que la app funcione: autenticarte, guardar tu perfil y tu progreso, y darle contexto al AI Coach para que te responda. No usamos tus datos…". **Ojo:** la sección entera no puede contener la subcadena "plan" (AC-007.2), así que hay que evitar palabras como "planificar" o "planes".
  - `updatedAt` = fecha de la implementación con el formato "D de mes de AAAA".
- **`features/legal/pages/TermsOfServicePage.tsx`:** "No es asesoría médica" empieza con "Las respuestas del AI Coach son información general con fines educativos - no reemplazan el consejo de un profesional…" y el resto del párrafo no cambia. `updatedAt` = la misma fecha.
- **Borrados:** `features/exercises/`, `features/weekly-plan/` y `app/sections.ts`, y se desinstala `@dnd-kit/core`.
- No hay hooks, claves de query ni schemas zod nuevos. Se quitan las claves de query de `exercises/hooks.ts` y `weekly-plan/hooks.ts` junto con sus archivos.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | Borrado de los cinco blueprints y su registro en `backend/routes/__init__.py`; el 404 lo produce `error_handlers.handle_http_exception`, que ya existe (§3.2) |
| REQ-002 | No se toca ninguna otra ruta, servicio ni modelo. Solo se adapta la fila sembrada en `test_health_routes.py`, la única modificación que permite AC-002.1 (§5) |
| REQ-003 | Migración `f2c4e6a8b0d1` (upgrade borra y downgrade crea vacías, §3.1) y modelos fuera de `models/__init__.py` para `create_all()` |
| REQ-004 | `frontend/src/app/router.tsx`: sin rutas del catálogo; el comodín `*` y `ProtectedRoute` redirigen |
| REQ-005 | `Navbar.tsx` y `BottomTabBar.tsx` con listas fijas |
| REQ-006 | `AuthHero.tsx` (lo comparten `/login` y `/register` a través de `AuthLayout`) |
| REQ-007 | `PrivacyPolicyPage.tsx` y `TermsOfServicePage.tsx` (textos y `updatedAt`) |
| REQ-008 | No se tocan las demás features. Solo cambian comentarios en `AppLayout.tsx`, `providers.tsx` y `StorePage.tsx` |
| NFR-001 | Borrado completo de `features/exercises/`, `features/weekly-plan/`, `app/sections.ts`, las capas del backend y `scripts/migrate_catalog_to_prod.py`. Hay tests que recorren el código fuente (§5) y comprobación de lint, tsc, build y ruff por el verifier |

## 5. Estrategia de pruebas

**Marcadores:** todos los tests nuevos llevan `SDD: 012 …` (ADR-0022).

**Rojo esperado frente a verde de no regresión (excepción aprobada):** es una retirada, así que varios AC describen un comportamiento que ya se cumple hoy gracias al interruptor apagado (`CATALOG_ENABLED=false`). El usuario aprobó en el gate del plan una **excepción al Art. 5.2 de la constitución** para el red check, registrada en `state.json` (`red_check_exception`, 2026-10-14T21:42:14Z): los tests de no regresión de **AC-002.\*, AC-004.\*, AC-005.\*, AC-006.\* y AC-008.\*** pueden estar **en verde** en el red check. La excepción se limita a esos AC; ningún otro test puede estar en verde, y los de esos AC tampoco pueden fallar por errores de sintaxis, import o fixture.

Para que el reparto sea limpio, los tests de esos cinco grupos solo comprueban lo que se conserva o lo que ya se cumple hoy (no mezclan asertos de la retirada). El **rojo legítimo** lo aportan:
- REQ-001 (AC-001.1–4): hoy responden 200, 201, 401 o 403.
- AC-003.1 y AC-003.2: el andamio de la migración lanza `NotImplementedError`.
- AC-003.3: las tablas existen hoy en la metadata.
- REQ-007 (AC-007.1–5): los textos actuales contienen "favoritos" y "catálogo", y sus fechas son las antiguas. **Ojo con AC-007.6 (voseo):** ya se cumple hoy, así que su test estará en verde y **no** está en la lista de `red_check_exception`. El plan no amplía la excepción por su cuenta: en el gate del plan el usuario decide si la extiende a AC-007.6 (recomendado, porque es no regresión pura) o si prefiere otra salida. Mientras no lo decida, el verifier debe señalar ese verde.
- AC-N001.1 y AC-N001.2: hoy hay referencias en el código y el script existe.

El verifier debe registrar en el informe del red check que los verdes de AC-002.\*, AC-004.\*, AC-005.\*, AC-006.\* y AC-008.\* están cubiertos por `red_check_exception`.

**Andamio (implementer en modo scaffold, ADR-0012):** solo el archivo de la migración `f2c4e6a8b0d1_…py`, con `revision` y `down_revision` correctos y `upgrade()`/`downgrade()` que lanzan `NotImplementedError`. Así los tests de la migración pueden cargarla sin un error de import. El frontend no necesita andamio.

**Fakes nuevos:** ninguno. Nada de esto prueba lógica de servicio con dependencias. No se usan `unittest.mock` ni `monkeypatch`.

### Backend · integración (Postgres)

`backend/tests/test_routes/test_retired_catalog_routes.py`, con las fixtures `client`, `registered_user` y `admin_headers` de `conftest.py`:
- **AC-001.1:** con `registered_user["headers"]`, `GET` a las cinco rutas de lista (parametrizado). Cada una responde `404` y `"error" in response.get_json()`.
- **AC-001.2:** con `admin_headers`:
  - `POST /api/body-regions` con `{"name": "Tren Superior"}`;
  - `POST /api/exercise-categories` con `{"name": "Pecho", "body_region_id": <uuid4>}`;
  - `POST /api/exercises` con `{"category_id": <uuid4>, "name": "Press", "video_url": "https://youtu.be/x"}`;
  - `DELETE` a `/api/body-regions/{uuid4}`, `/api/exercise-categories/{uuid4}` y `/api/exercises/{uuid4}`.

  Todas responden 404 con `error`.
- **AC-001.3:** con usuario, `POST` y `DELETE /api/exercises/{uuid4}/favorites`, `POST /api/weekly-plan` con `{"exercise_id": <uuid4>, "day_of_week": 1}` y `DELETE /api/weekly-plan/{uuid4}`. Todas responden 404 con `error`.
- **AC-001.4:** sin cabecera, `GET /api/exercises` y `GET /api/weekly-plan` responden 404 (no 401) con `error`.
- **AC-002.1:** el `app.url_map` sigue teniendo las reglas de las áreas que se conservan (`/api/auth/login`, `/api/profile`, `/api/body-metrics`, `/api/body-metrics/analysis`, `/api/coach/ask`, `/api/coach/feedback`, `/api/feedback` y `/api/health`). Es solo de no regresión (verde en el red check, cubierto por la excepción); la ausencia de las rutas retiradas ya la prueban AC-001.1–4. Lo complementa el verifier corriendo la suite completa y comprobando que no hay tests saltados ni debilitados fuera de los borrados permitidos (ver "tests que el test-author ajusta").
- **AC-002.2:** `GET /api/health` responde 200.
- **AC-002.3:** usuario con perfil, creado con `PUT /api/profile` (reutiliza el payload de `test_profile_routes.py`). `GET /api/profile` y `GET /api/body-metrics` responden 200 y el cuerpo tiene las mismas claves que hoy: las de perfil que comprueba `test_profile_routes.py` y una lista para métricas.

### Backend · migración (Postgres, en transacción con rollback)

`backend/tests/test_services/test_catalog_removal_migration.py`. Sigue el precedente de `test_body_metric_consolidation.py`: el DDL de Postgres es transaccional, así que todo ocurre en la transacción de `db_session` y termina con `db_session.rollback()`.
- **Cargar la migración:** `importlib.util.spec_from_file_location` sobre `Path(__file__).parents[2] / "migrations/versions/f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py"`.
- **Ejecutar `op`:**

  ```python
  ctx = MigrationContext.configure(db_session.connection())
  with Operations.context(ctx):
      module.upgrade()  # o module.downgrade()
  ```

  Son `alembic.runtime.migration.MigrationContext` y `alembic.operations.Operations`, API pública de Alembic, no un mock.
- **AC-003.1:**
  1. Crea las cinco tablas con la estructura anterior **sin usar el código bajo prueba**: con una `MetaData` local en el test (reflejando `public.users` con `autoload_with`) o con DDL SQL literal.
  2. Inserta una fila en cada una, más un `User` con `UserProfile` y un `BodyMetric` hechos con el ORM.
  3. Ejecuta `upgrade()`.
  4. Comprueba con `sqlalchemy.inspect(connection).get_table_names(schema="public")` que las cinco ya no están, y que el usuario, su perfil y su medición existen con los mismos valores.
- **AC-003.2:** parte de la base de tests, que ya no tiene las tablas y equivale a "ya migrada".
  1. Ejecuta `downgrade()`.
  2. Comprueba con el inspector que las cinco tablas existen, con columnas y tipos, nulabilidad, restricciones únicas (con nombre donde lo hay), FK e índices tal como dice §3.1.
  3. Comprueba que `SELECT count(*)` da 0 en cada una.
- **AC-003.3:** ninguno de los cinco nombres está en `db.metadata.tables` (esquema `public.`), ni en `inspect(engine).get_table_names(schema="public")` de la base de tests.

### Backend · código fuente

`backend/tests/test_services/test_no_catalog_leftovers.py`:
- **AC-N001.2:** recorre los `*.py` de `backend/` **excluyendo** `.venv/` (dependencias instaladas), `migrations/versions/` (historial, incluida `f2c4e6a8b0d1`) y `tests/`, tal como fija la spec tras Q8. Excluye también `__pycache__/`. Comprueba que no aparece ninguna de las cinco rutas (`/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites`, `/api/weekly-plan`) ni ninguno de los cinco nombres de tabla como **palabra completa** (`\bbody_regions\b`, `\bexercise_categories\b`, `\bexercises\b`, `\bexercise_favorites\b`, `\bweekly_plan_entries\b`), para no chocar con, por ejemplo, `exercise_id`. Comprueba también que `scripts/migrate_catalog_to_prod.py` no existe. Para que el test sea útil, comprueba primero que el recorrido encontró archivos (por ejemplo, que incluye `app.py` y `routes/__init__.py`), y así no pasa en vacío por un error de ruta.
- **AC-N001.3 (ruff):** lo ejecuta el verifier (`node .claude/sdd/scripts/ruff-new.mjs`). No es un test pytest.

### Backend · tests que el test-author ajusta

Lo hace el test-author, porque el implementer no puede tocar tests:
- **Borrar** `tests/test_routes/test_exercise_routes.py` y `tests/test_services/test_weekly_plan_service.py`. AC-002.1 los excluye explícitamente de la suite.
- **`test_health_routes.py::test_health_check_does_not_change_row_counts`:** cambiar la fila sembrada de `BodyRegion(name=…)` a `User(email=…, date_of_birth=date(2000, 1, 1))`. Es exactamente el caso que AC-002.1 permite (Q8): un dato auxiliar sembrado en una tabla retirada pasa a una tabla que se conserva. El aserto (recuentos iguales antes y después en todas las tablas) no cambia y no se debilita. Ningún otro test de las áreas conservadas se modifica.

### Frontend · RTL

La red se simula con `vi.mock` de los `api.ts`, como en `accountSwitch.test.tsx`.
- **`src/app/router.test.tsx`** (se añaden casos):
  - **AC-004.1:** `setToken("token")`; `getProfile` simulado con `makeProfileResponse()` de `@/test/profileFixtures`, y además `listBodyMetrics` y `getCurrentUser`, como en `accountSwitch.test.tsx`. Para cada una de `/categories`, `/categories/r1`, `/categories/r1/c1` y `/favorites`, termina en `window.location.pathname === "/home"` y no muestra "Catálogo", "Favoritos" ni "Plan semanal".
  - **AC-004.2:** sin token, `/favorites` termina en `/login`.
  - **AC-008.2 y AC-008.1:** con sesión y onboarding completado, `/macros`, `/body-metrics`, `/coach`, `/store` y `/profile` mantienen su `pathname` y muestran un elemento propio de cada pantalla (por ejemplo, su heading). Simula las `api.ts` que cada una llame al montar. AC-008.1 lo completa el verifier con `npm test` completo.
- **`src/components/layout/Navbar.test.tsx`, AC-005.1:** renderiza `Navbar` en `MemoryRouter` y `QueryClientProvider`, y simula `@/features/auth/api` si `UserMenu` lo usa. Los nombres de los enlaces de sección, **excluyendo** el del logo (`/home`), son exactamente `["Macros", "Métricas", "Coach", "Tienda"]` en ese orden, y no hay ningún enlace "Catálogo" ni "Favoritos". En jsdom la clase `hidden md:flex` no oculta nada, así que se pueden consultar sin problema.
- **`src/components/layout/BottomTabBar.test.tsx`, AC-005.2:** los enlaces de la `nav` son exactamente `["Inicio", "Macros", "Métricas", "Coach", "Tienda"]`.
- **`src/features/auth/components/AuthHero.test.tsx`, AC-006.1 y AC-006.2:** renderiza `LoginPage` y `RegisterPage` en `MemoryRouter` y `QueryClientProvider`, con `vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")` como en `router.test.tsx`. En las dos aparece "AI Coach online" y no aparecen "Catálogo de ejercicios con técnica de ejecución" ni "Guarda tus ejercicios favoritos". Si montar las páginas resulta costoso, una alternativa válida es montar `/login` y `/register` a través de `AppRouter` sin token.
- **`src/features/legal/pages/PrivacyPolicyPage.test.tsx`** (se añaden casos 012):
  - **AC-007.1:** el `listitem` "Actividad en la app" contiene "AI Coach" y "valoraciones" y no contiene "favoritos" ni "plan semanal".
  - **AC-007.2:** el `textContent` de `sectionOf("Para qué usamos tu información")`, en minúsculas, no contiene "catálogo", "favoritos" ni "plan".
  - **AC-007.3:** la fecha cumple el formato con la regex `MONTHS` que ya existe y es distinta de "8 de octubre de 2026".
  - **AC-007.6:** voseo, con la misma lista del test existente y marcador 012.
- **`src/features/legal/pages/TermsOfServicePage.test.tsx`** (nuevo):
  - **AC-007.4:** la sección "No es asesoría médica" contiene "AI Coach", "información general" y "profesional", y no contiene "catálogo".
  - **AC-007.5:** formato de la fecha y distinta de "2 de septiembre de 2026".
  - **AC-007.6:** sin voseo.

### Frontend · código fuente

- **`src/app/noRetiredSections.test.ts`, AC-N001.1:** usa `import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true })`, es decir, excluye los tests como fija la spec tras Q8 (este mismo archivo nombra las cadenas buscadas). Comprueba que ningún archivo contiene `/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites`, `/api/weekly-plan`, `CATALOG_ENABLED` ni `app/sections`. Comprueba antes que el glob devolvió archivos (por ejemplo, que incluye `/src/app/router.tsx`). Los tipos de `import.meta.glob` ya los da `vite/client` (en `tsconfig.app.json`). Los `api.ts` actuales de `features/exercises` y `features/weekly-plan` escriben las rutas con el prefijo `/api/…` completo, así que el test está en rojo hoy por la razón correcta.
- **AC-N001.3:** `npm run lint`, `npx tsc -b` y `npm run build` los ejecuta el verifier.

### Cobertura de AC

| AC | Test |
|---|---|
| AC-001.1–4 | `test_retired_catalog_routes.py` |
| AC-002.1–3 | `test_retired_catalog_routes.py` y la suite completa (verifier) |
| AC-003.1–3 | `test_catalog_removal_migration.py` |
| AC-004.1–2, AC-008.1–2 | `router.test.tsx` y `npm test` completo (verifier) |
| AC-005.1 | `Navbar.test.tsx` |
| AC-005.2 | `BottomTabBar.test.tsx` |
| AC-006.1–2 | `AuthHero.test.tsx` |
| AC-007.1–3, AC-007.6 | `PrivacyPolicyPage.test.tsx` |
| AC-007.4–6 | `TermsOfServicePage.test.tsx` |
| AC-N001.1 | `noRetiredSections.test.ts` |
| AC-N001.2 | `test_no_catalog_leftovers.py` |
| AC-N001.3 | Comandos del verifier (ruff-new, lint, tsc y build); la marca de trazabilidad se pone en el `verify-report.md` |

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Pérdida irreversible de los datos de producción si se migra sin copia de seguridad, o con una copia incompleta | Baja | Alto | Paso manual obligatorio de copia **completa** antes de `flask db upgrade`, documentado por el `doc-keeper`. El downgrade solo recrea las tablas vacías (Q2). Conviene comprobar que la copia se puede leer (por ejemplo, con `pg_restore --list` o abriendo el `.sql`) antes de migrar |
| Deriva de esquema en Supabase (tablas renombradas, objetos dependientes como vistas o políticas RLS) que hace fallar `DROP TABLE` | Baja | Medio | Sin `IF EXISTS` ni `CASCADE`, la migración falla en una transacción y no deja nada a medias. Se revisa el error y se decide con el usuario |
| La base de tests local conserva las tablas antiguas tras una ejecución abortada (`drop_all` ya no las conoce): falla AC-003.3 o el `downgrade()` de AC-003.2 por "already exists" | Media | Bajo | En CI la base es nueva. En local, si pasa, se borran a mano o se recrea la base de tests. AC-003.3 comprueba primero `db.metadata` |
| El escaneo de código fuente (AC-N001.1 y AC-N001.2) pasa en vacío por una ruta o un glob mal escritos, o da falsos positivos con identificadores como `exercise_id` | Media | Medio | Los tests comprueban primero que recorrieron archivos conocidos, y los nombres de tabla se buscan como palabra completa, como fija la spec tras Q8 (§5) |
| El test-author modifica más tests de las áreas conservadas de lo que permite AC-002.1 | Baja | Medio | La única modificación permitida es la fila sembrada de `test_health_routes.py` (§5). El verifier y el reviewer comprueban en el diff que ningún otro test de esas áreas cambia, se salta o se debilita |
| La fecha legal "del día en que se cierre la feature" no se conoce al implementar | Media | Bajo | El implementer pone la fecha del día de la implementación; los tests solo exigen el formato y que sea distinta de las anteriores. Si el cierre cae otro día, el orquestador propone al usuario un ajuste de copy (Art. 1.2) |
| Los tests de no regresión (AC-002.\*, AC-004.\*, AC-005.\*, AC-006.\* y AC-008.\*) están en verde en el red check, y un verde de otro AC se cuela como si estuviera cubierto | Seguro (los verdes) / Baja (la confusión) | Bajo | Excepción aprobada y registrada en `state.json` (`red_check_exception`), limitada a esos cinco grupos. Esos tests no mezclan asertos de la retirada (§5). El rojo legítimo lo dan REQ-001, REQ-003, REQ-007 y NFR-001, y el verifier rechaza cualquier verde fuera de la lista |
| `require_admin` se queda sin usos ni tests | Seguro | Bajo | Se conserva por decisión de Q4. Quitarlo o probarlo es otra feature |

## 7. Cumplimiento de la constitución

- **Art. 1:** el cambio funcional va por SDD con la spec 012 aprobada.
- **Art. 4 (trazabilidad):** todos los REQ y NFR están mapeados en §4, y todos los AC tienen test en §5 con marcador `SDD: 012`. La excepción es AC-N001.3, que es una comprobación con comandos (lint, tsc, build y ruff) y la registra el verifier.
- **Art. 5.2 (rojo legítimo):** se cumple con la excepción aprobada por el usuario y registrada en `state.json` (`red_check_exception`): los tests de no regresión de AC-002.\*, AC-004.\*, AC-005.\*, AC-006.\* y AC-008.\* pueden estar en verde. El resto de los tests nuevos debe estar en rojo por comportamiento ausente (§5), salvo AC-007.6, que queda pendiente de que el usuario decida si amplía la excepción.
- **Art. 5.3 (no borrar tests):** se borran `test_exercise_routes.py` y `test_weekly_plan_service.py` porque prueban funciones que la spec retira; AC-002.1 los excluye explícitamente de la suite. `test_health_routes.py` se **adapta**: solo cambia el modelo de la fila sembrada (`BodyRegion` pasa a `User`), que es la única modificación que AC-002.1 permite tras Q8, y el aserto no se debilita. Sin el cambio, el archivo no se podría importar. Todo esto lo hace el test-author, no el implementer.
- **Art. 5.4:** sin `unittest.mock` ni `monkeypatch`. Los tests de migración usan la API pública de Alembic (`MigrationContext` y `Operations`) contra Postgres real dentro de una transacción.
- **Art. 5.7:** el andamio de la migración solo lanza `NotImplementedError`.
- **Art. 6.1–6.3:** las capas siguen igual. El 404 lo produce el `errorhandler(HTTPException)` que ya existe; ninguna ruta construye un error a mano.
- **Art. 6.4:** el cambio de modelo (cinco modelos borrados) va con su migración Alembic, escrita y revisada a mano. El reviewer debe comprobar que `down_revision = 'd8e4b2a7c1f5'` y que el `downgrade()` coincide con §3.1.
- **Art. 6.5 y 6.10:** ruff ratchet, `npm run lint` y `npx tsc -b` sin errores nuevos (AC-N001.3).
- **Art. 6.6–6.8:** las features que quedan mantienen su organización. No hay llamadas HTTP nuevas.
- **Art. 6.11:** textos legales en español correcto y sin voseo (AC-007.6).
- **Art. 7:** desaparecen endpoints y no hay secretos ni variables nuevas. `require_admin` se conserva (Q4). La migración no concatena SQL.
- **Alcance de NFR-001:** ya no hace falta interpretarlo. Tras Q8, la spec fija que el escaneo de AC-N001.2 excluye `backend/tests/`, `migrations/versions/` y las dependencias instaladas (`.venv/`), busca los nombres de tabla como palabra completa y exige que el script de migración del catálogo no exista; y que el de AC-N001.1 excluye los tests del frontend (`*.test.ts(x)`). El plan sigue esa definición literal (§5).

## 8. ADRs

Ninguna. Retirar las funciones es una decisión de producto que ya recoge la spec, y la migración destructiva con downgrade vacío está resuelta en Q2. Probar una migración con `MigrationContext` y `Operations` de Alembic dentro de una transacción es un patrón de pruebas local a esta feature. Si se repite en otras, se puede promover a ADR más adelante.
