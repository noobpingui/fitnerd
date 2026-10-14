# Tareas 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-14)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos.
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold (implementer, modo scaffold, ADR-0012), después todos los test (test-author), después impl, migration y config (implementer).
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea.
- Todos los tests nuevos llevan el marcador `SDD: 012 …` (ADR-0022).
- Red check: los verdes de AC-002.*, AC-004.*, AC-005.*, AC-006.*, AC-008.* y AC-007.6 están cubiertos por `red_check_exception` de state.json.
- Los borrados de la Fase B siguen el orden inverso de dependencia (routes → services → repositories → models) para que la app siempre importe.
- Las tareas docs (README, CLAUDE.md, despliegue, copia de seguridad) las crea y ejecuta el doc-keeper en la etapa `docs`; no se listan aquí.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [ ] T-000 [REQ-003, AC-003.1, AC-003.2] (scaffold) Crear la revisión `f2c4e6a8b0d1` (`down_revision = 'd8e4b2a7c1f5'`) con `upgrade()` y `downgrade()` que lancen `NotImplementedError("not implemented")`, para que los tests de la migración puedan cargarla — `backend/migrations/versions/f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py`

Frontend: no aplica. Rutas HTTP retiradas: no aplica (un 200/401 hoy es el rojo legítimo).

## Fase A — Tests (test-author)

### Backend
- [ ] T-001 [REQ-001, AC-001.1] (test) `GET` con usuario `user` a `/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites` y `/api/weekly-plan` (parametrizado): 404 con clave `error` — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-002 [REQ-001, AC-001.2] (test) Con `admin_headers`, `POST` a body-regions, exercise-categories y exercises con cuerpo válido, y `DELETE` a `/{uuid4}` de los tres: 404 con `error` — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-003 [REQ-001, AC-001.3] (test) `POST`/`DELETE /api/exercises/{id}/favorites`, `POST /api/weekly-plan` y `DELETE /api/weekly-plan/{id}`: 404 con `error` — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-004 [REQ-001, AC-001.4] (test) Sin cabecera de autorización, `GET /api/exercises` y `GET /api/weekly-plan` responden 404 (no 401) con `error` — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-005 [REQ-002, AC-002.1] (test) No regresión: el `url_map` conserva las reglas de auth, profile, body-metrics (y `/analysis`), coach (`/ask`, `/feedback`), feedback y health — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-006 [REQ-002, AC-002.2] (test) `GET /api/health` responde 200 — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-007 [REQ-002, AC-002.3] (test) Usuario con perfil: `GET /api/profile` y `GET /api/body-metrics` responden 200 con el formato de antes — `backend/tests/test_routes/test_retired_catalog_routes.py`
- [ ] T-008 [REQ-003, AC-003.1] (test) Migración `upgrade()` con `MigrationContext`/`Operations` en transacción: con filas en las cinco tablas y un usuario con perfil y medición, las cinco tablas desaparecen y el resto queda igual — `backend/tests/test_services/test_catalog_removal_migration.py`
- [ ] T-009 [REQ-003, AC-003.2] (test) Migración `downgrade()`: recrea las cinco tablas vacías con columnas, restricciones únicas, FK e índices de §3.1 del plan — `backend/tests/test_services/test_catalog_removal_migration.py`
- [ ] T-010 [REQ-003, AC-003.3] (test) Ninguna de las cinco tablas está en `db.metadata` ni en las tablas de la base de tests — `backend/tests/test_services/test_catalog_removal_migration.py`
- [ ] T-011 [NFR-001, AC-N001.2] (test) Escaneo del backend (excluye `.venv/`, `migrations/versions/`, `tests/`, `__pycache__/`): sin rutas retiradas, sin nombres de tabla como palabra completa y sin `scripts/migrate_catalog_to_prod.py` — `backend/tests/test_services/test_no_catalog_leftovers.py`
- [ ] T-012 [REQ-002, AC-002.1] (test) Adaptar `test_health_check_does_not_change_row_counts`: sembrar `User(email=…, date_of_birth=date(2000, 1, 1))` en lugar de `BodyRegion`, sin cambiar el aserto — `backend/tests/test_routes/test_health_routes.py`
- [ ] T-013 [REQ-001, AC-002.1] (test) Borrar los tests del catálogo y los favoritos, retirados por la spec — `backend/tests/test_routes/test_exercise_routes.py`
- [ ] T-014 [REQ-001, AC-002.1] (test) Borrar los tests del plan semanal, retirados por la spec — `backend/tests/test_services/test_weekly_plan_service.py`

### Frontend
- [ ] T-015 [REQ-004, AC-004.1] (test) Con sesión y onboarding completo, `/categories`, `/categories/r1`, `/categories/r1/c1` y `/favorites` terminan en `/home` sin "Catálogo", "Favoritos" ni "Plan semanal" — `frontend/src/app/router.test.tsx`
- [ ] T-016 [REQ-004, AC-004.2] (test) Sin sesión, `/favorites` termina en `/login` — `frontend/src/app/router.test.tsx`
- [ ] T-017 [REQ-008, AC-008.1, AC-008.2] (test) Con sesión y onboarding completo, `/macros`, `/body-metrics`, `/coach`, `/store` y `/profile` mantienen su URL y muestran su pantalla — `frontend/src/app/router.test.tsx`
- [ ] T-018 [REQ-005, AC-005.1] (test) Los enlaces de sección de `Navbar` son exactamente Macros, Métricas, Coach y Tienda, en ese orden, sin "Catálogo" ni "Favoritos" — `frontend/src/components/layout/Navbar.test.tsx`
- [ ] T-019 [REQ-005, AC-005.2] (test) Las pestañas de `BottomTabBar` son exactamente Inicio, Macros, Métricas, Coach y Tienda, en ese orden — `frontend/src/components/layout/BottomTabBar.test.tsx`
- [ ] T-020 [REQ-006, AC-006.1, AC-006.2] (test) `/login` y `/register` muestran "AI Coach online" y no los textos del catálogo ni de favoritos — `frontend/src/features/auth/components/AuthHero.test.tsx`
- [ ] T-021 [REQ-007, AC-007.1, AC-007.2, AC-007.3] (test) Privacidad: "Actividad en la app" (AI Coach y valoraciones, sin favoritos ni plan semanal), "Para qué usamos tu información" (sin catálogo, favoritos ni plan) y fecha con formato y distinta de "8 de octubre de 2026" — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`
- [ ] T-022 [REQ-007, AC-007.6] (test) Privacidad sin voseo (marcador 012) — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`
- [ ] T-023 [REQ-007, AC-007.4, AC-007.5] (test) Términos: "No es asesoría médica" advierte del AI Coach y no contiene "catálogo"; fecha con formato y distinta de "2 de septiembre de 2026" — `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`
- [ ] T-024 [REQ-007, AC-007.6] (test) Términos sin voseo — `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`
- [ ] T-025 [NFR-001, AC-N001.1] (test) Escaneo del código fuente del frontend (sin tests) con `import.meta.glob`: sin rutas `/api/…` retiradas, sin `CATALOG_ENABLED` ni `app/sections` — `frontend/src/app/noRetiredSections.test.ts`

## Fase B — Implementación (implementer)

### Backend
- [ ] T-030 [REQ-003, AC-003.1, AC-003.2] (migration) Implementar `upgrade()` (drop de `weekly_plan_entries`, `exercise_favorites`, `exercises`, `exercise_categories`, `body_regions`, `schema='public'`, sin `IF EXISTS`) y `downgrade()` (recrea las cinco vacías según §3.1 del plan, con docstring que avisa de que los datos no vuelven) — `backend/migrations/versions/f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py`
- [ ] T-031 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-002.1] (impl) Quitar los imports y los `register_blueprint` de los cinco blueprints retirados — `backend/routes/__init__.py`
- [ ] T-032 [REQ-001, AC-001.1, AC-001.2, NFR-001] (impl) Borrar las rutas de regiones, categorías y ejercicios (incluye favoritos por ejercicio) — `backend/routes/body_region_routes.py`, `backend/routes/exercise_category_routes.py`, `backend/routes/exercise_routes.py`
- [ ] T-033 [REQ-001, AC-001.1, AC-001.3, NFR-001] (impl) Borrar las rutas de favoritos y plan semanal — `backend/routes/exercise_favorite_routes.py`, `backend/routes/weekly_plan_routes.py`
- [ ] T-034 [REQ-001, AC-N001.2] (impl) Borrar los servicios de regiones, categorías y ejercicios — `backend/services/body_region_service.py`, `backend/services/exercise_category_service.py`, `backend/services/exercise_service.py`
- [ ] T-035 [REQ-001, AC-N001.2] (impl) Borrar los servicios de favoritos y plan semanal — `backend/services/exercise_favorite_service.py`, `backend/services/weekly_plan_service.py`
- [ ] T-036 [REQ-001, AC-N001.2] (impl) Borrar los repositorios de regiones, categorías y ejercicios — `backend/repositories/body_region_repository.py`, `backend/repositories/exercise_category_repository.py`, `backend/repositories/exercise_repository.py`
- [ ] T-037 [REQ-001, AC-N001.2] (impl) Borrar los repositorios de favoritos y plan semanal — `backend/repositories/exercise_favorite_repository.py`, `backend/repositories/weekly_plan_repository.py`
- [ ] T-038 [REQ-003, AC-003.3] (impl) Quitar `BodyRegion`, `ExerciseCategory`, `Exercise`, `ExerciseFavorite` y `WeeklyPlanEntry` de los imports y de `__all__` — `backend/models/__init__.py`
- [ ] T-039 [REQ-003, AC-003.3, AC-N001.2] (impl) Borrar los modelos de regiones, categorías y ejercicios — `backend/models/body_region.py`, `backend/models/exercise_category.py`, `backend/models/exercise.py`
- [ ] T-040 [REQ-003, AC-003.3, AC-N001.2] (impl) Borrar los modelos de favoritos y plan semanal — `backend/models/exercise_favorite.py`, `backend/models/weekly_plan_entry.py`
- [ ] T-041 [NFR-001, AC-N001.2] (impl) Borrar el script de migración del catálogo a producción — `backend/scripts/migrate_catalog_to_prod.py`

### Frontend
- [ ] T-042 [REQ-004, REQ-008, AC-004.1, AC-004.2, AC-008.1, AC-008.2] (impl) Quitar `CATALOG_ENABLED`, los cuatro imports de páginas y el bloque condicional de rutas; el comodín `*` redirige — `frontend/src/app/router.tsx`
- [ ] T-043 [REQ-005, AC-005.1] (impl) Lista fija de enlaces: Macros, Métricas, Coach y Tienda — `frontend/src/components/layout/Navbar.tsx`
- [ ] T-044 [REQ-005, AC-005.2] (impl) Lista fija de pestañas: Inicio, Macros, Métricas, Coach y Tienda; quitar los iconos `Dumbbell` y `Heart` — `frontend/src/components/layout/BottomTabBar.tsx`
- [ ] T-045 [REQ-006, AC-006.1, AC-006.2] (impl) Dejar solo la etiqueta "AI Coach online"; quitar `Dumbbell`, `Heart` y el import de `sections` — `frontend/src/features/auth/components/AuthHero.tsx`
- [ ] T-046 [NFR-001, AC-N001.1] (impl) Borrar el interruptor del catálogo — `frontend/src/app/sections.ts`
- [ ] T-047 [REQ-004, NFR-001, AC-N001.1] (impl) Borrar la feature de ejercicios completa (`api.ts`, `hooks.ts`, `types.ts`, `components/ExerciseCard.tsx`, `pages/RegionsPage.tsx`, `CategoriesPage.tsx`, `ExercisesPage.tsx`, `FavoritesPage.tsx`) — `frontend/src/features/exercises/`
- [ ] T-048 [REQ-004, NFR-001, AC-N001.1] (impl) Borrar la feature del plan semanal completa (`api.ts`, `hooks.ts`, `types.ts`, `constants.ts`, `components/DayColumn.tsx`, `DraggableFavoriteCard.tsx`) — `frontend/src/features/weekly-plan/`
- [ ] T-049 [NFR-001, REQ-008, AC-N001.1] (impl) Actualizar los comentarios que citan `/categories`, `/favorites`, `FavoritesPage` y "categorias, ejercicios, favoritos" — `frontend/src/app/AppLayout.tsx`, `frontend/src/app/providers.tsx`, `frontend/src/features/store/pages/StorePage.tsx`
- [ ] T-050 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.6] (impl) Reescribir "Actividad en la app" y "Para qué usamos tu información" (sin la subcadena "plan"), y cambiar `updatedAt` a la fecha del día con formato "D de mes de AAAA" — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`
- [ ] T-051 [REQ-007, AC-007.4, AC-007.5, AC-007.6] (impl) Reescribir "No es asesoría médica" (sin "catálogo") y cambiar `updatedAt` a la misma fecha — `frontend/src/features/legal/pages/TermsOfServicePage.tsx`
- [ ] T-052 [NFR-001, AC-N001.3] (config) Desinstalar `@dnd-kit/core` (`npm uninstall`), sin uso tras T-047 y T-048 — `frontend/package.json`, `frontend/package-lock.json`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001 | T-031, T-032, T-033 |
| REQ-001 | AC-001.2 | T-002 | T-031, T-032 |
| REQ-001 | AC-001.3 | T-003 | T-031, T-033 |
| REQ-001 | AC-001.4 | T-004 | T-031 |
| REQ-002 | AC-002.1 | T-005, T-012, T-013, T-014 | T-031 |
| REQ-002 | AC-002.2 | T-006 | T-031 |
| REQ-002 | AC-002.3 | T-007 | T-031 |
| REQ-003 | AC-003.1 | T-008 | T-030 |
| REQ-003 | AC-003.2 | T-009 | T-030 |
| REQ-003 | AC-003.3 | T-010 | T-038, T-039, T-040 |
| REQ-004 | AC-004.1 | T-015 | T-042, T-047, T-048 |
| REQ-004 | AC-004.2 | T-016 | T-042 |
| REQ-005 | AC-005.1 | T-018 | T-043 |
| REQ-005 | AC-005.2 | T-019 | T-044 |
| REQ-006 | AC-006.1 | T-020 | T-045 |
| REQ-006 | AC-006.2 | T-020 | T-045 |
| REQ-007 | AC-007.1 | T-021 | T-050 |
| REQ-007 | AC-007.2 | T-021 | T-050 |
| REQ-007 | AC-007.3 | T-021 | T-050 |
| REQ-007 | AC-007.4 | T-023 | T-051 |
| REQ-007 | AC-007.5 | T-023 | T-051 |
| REQ-007 | AC-007.6 | T-022, T-024 | T-050, T-051 |
| REQ-008 | AC-008.1 | T-017 (más `npm test` completo, verifier) | T-042 |
| REQ-008 | AC-008.2 | T-017 | T-042 |
| NFR-001 | AC-N001.1 | T-025 | T-042, T-046, T-047, T-048, T-049 |
| NFR-001 | AC-N001.2 | T-011 | T-034, T-035, T-036, T-037, T-039, T-040, T-041 |
| NFR-001 | AC-N001.3 | Comandos del verifier (ruff-new, lint, tsc, build), sin tarea test | T-052 (y todas las impl) |
