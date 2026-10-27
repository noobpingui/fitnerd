# Tareas 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-27)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold → test → impl/migration/config.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
- Notas de alcance:
  - `query_forms`, `rank_catalog`, `MealService`, `RemovedItemSnapshot` y los componentes del diario ya existen: se
    modifican en Fase B y no necesitan esqueleto salvo los símbolos NUEVOS que los tests importan.
  - Los modelos de SQLAlchemy y los tipos/esquemas zod del frontend son declarativos (sin lógica): el esqueleto los
    deja completos para que `create_all()` y el typecheck funcionen; la lógica sigue ausente.
  - Las rutas `/api/food-library/*` no necesitan esqueleto: su ausencia responde 404, que ya es rojo legítimo.
  - ADR-0036 ya existe como «Propuesta» (la acepta la sesión principal, Art. P5): no hay tarea para ella.
  - El paso manual de producción (runbook, Art. P4) lo documenta el doc-keeper en la etapa docs.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)

### backend
- [x] T-001 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-007, REQ-009] (scaffold) Crear `food_library_rules.py` con las constantes (`MAX_CUSTOM_FOODS`, `MAX_FAVORITES`, `MAX_RECENT_FOODS`, mensajes, `LIBRARY_KINDS`), los dataclasses `LibraryFood` y `RecentFoodRow`, y `custom_food_name_key` y `parse_custom_food_id` que lanzan "not implemented" — `backend/services/food_library_rules.py`
- [x] T-002 [REQ-006, REQ-007] (scaffold) Añadir a `catalog_search_service.py` `edit_distance`, `prefix_edit_distance`, `typo_tolerance`, `typo_distance`, el dataclass `SearchCandidate` y `rank_candidates`, que lanzan "not implemented" (sin tocar `query_forms` ni `rank_catalog`) — `backend/services/catalog_search_service.py`
- [x] T-003 [REQ-001, REQ-009] (scaffold) Crear los modelos `CustomFood` y `FoodFavorite` con columnas, restricciones y nombres exactos del plan (declarativos) — `backend/models/custom_food.py`, `backend/models/food_favorite.py`
- [x] T-004 [REQ-001, REQ-003, REQ-004] (scaffold) Añadir `MealItem.custom_food_id` (FK `SET NULL`, índice y CHECK del plan) e importar `CustomFood` y `FoodFavorite` en `models/__init__.py` — `backend/models/meal.py`, `backend/models/__init__.py`
- [x] T-005 [REQ-001, REQ-004, REQ-009] (scaffold) Crear `CustomFoodRepository` y `FoodFavoriteRepository` con las firmas del plan (constructores guardan la sesión; métodos lanzan "not implemented") — `backend/repositories/custom_food_repository.py`, `backend/repositories/food_favorite_repository.py`
- [x] T-006 [REQ-008] (scaffold) Añadir `MealRepository.list_recent_foods(user_id, limit)` que lanza "not implemented" — `backend/repositories/meal_repository.py`
- [x] T-007 [REQ-003, REQ-012] (scaffold) Añadir el dataclass `LibraryItemInput` y el campo `custom_food_id: int | None = None` de `RemovedItemSnapshot` en `meal_rules.py` — `backend/services/meal_rules.py`
- [x] T-008 [REQ-001, REQ-003, REQ-012] (scaffold) Añadir el kwarg `custom_food_repository=None` (solo se guarda) a `MealService.__init__` — `backend/services/meal_service.py`
- [x] T-009 [REQ-004, REQ-007, REQ-008, REQ-009, REQ-010, NFR-001] (scaffold) Crear `FoodLibraryService` con el constructor del plan (guarda dependencias) y los seis métodos que lanzan "not implemented" — `backend/services/food_library_service.py`

### frontend
- [x] T-020 [REQ-007, REQ-014, REQ-015] (scaffold) Crear los tipos y esquemas zod de la feature de datos (`LibraryFood`, `RecentFood`, `libraryFoodSchema`, `libraryResultsSchema`, `recentResultsSchema`) — `frontend/src/features/food-library/types.ts`, `frontend/src/features/food-library/schemas.ts`
- [x] T-021 [REQ-007, REQ-009, REQ-004, REQ-014, REQ-015, REQ-017] (scaffold) Crear `api.ts` (`searchFoodLibrary`, `getRecentFoods`, `getFavoriteFoods`, `setFoodFavorite`, `deleteCustomFood`) y `hooks.ts` (`foodLibraryKeys` y los cinco hooks) que lanzan "not implemented" — `frontend/src/features/food-library/api.ts`, `frontend/src/features/food-library/hooks.ts`
- [x] T-022 [REQ-013] (scaffold) Crear `useDebouncedValue` que lanza "not implemented" — `frontend/src/lib/useDebouncedValue.ts`
- [x] T-023 [REQ-013, REQ-014, REQ-015, REQ-017] (scaffold) Crear `FoodSearchPanel` y `LibraryFoodList` con las props del plan, que lanzan "not implemented" — `frontend/src/features/diary/components/FoodSearchPanel.tsx`, `frontend/src/features/diary/components/LibraryFoodList.tsx`
- [x] T-024 [REQ-018, REQ-019] (scaffold) Añadir a `proposal.ts` `libraryEntry`, `withEntryKey` y `mergeProposalEntries` (lanzan "not implemented") y a `types.ts` del diario `MealItem.custom_food_id`, `LibraryItemPayload`, `SavableItemPayload`, `ProposalFormEntry`, `ProposalFormValues` y `customFoodId?` de la variante `custom` — `frontend/src/features/diary/proposal.ts`, `frontend/src/features/diary/types.ts`
- [x] T-025 [REQ-014, REQ-015, REQ-016, REQ-017] (scaffold) Añadir `gramsText` (`format.ts`), `favoriteErrorMessage` con sus constantes de mensaje (`errors.ts`), y `SEARCH_DEBOUNCE_MS` y `CUSTOM_FOOD_LIBRARY_NOTICE` (`constants.ts`); las funciones lanzan "not implemented" — `frontend/src/features/diary/format.ts`, `frontend/src/features/diary/errors.ts`, `frontend/src/features/diary/constants.ts`

## Fase A — Tests (test-author)

### backend
- [x] T-030 [REQ-001, REQ-004, REQ-008, REQ-009, REQ-012] (test) Fakes a mano: `make_custom_food`, `FakeCustomFoodRepository`, `FakeFoodFavoriteRepository` y `FakeMealRepository.list_recent_foods` con `recent_rows` — `backend/tests/fakes.py`
- [x] T-031 [REQ-001, AC-001.2, AC-001.4, AC-001.10, REQ-003, AC-003.2, AC-004.3] (test) `custom_food_name_key` (mayúsculas, tildes, espacios repetidos) y `parse_custom_food_id` (enteros, texto de dígitos, `abc`, 0, 2.147.483.648) — `backend/tests/test_services/test_food_library_rules.py`
- [x] T-032 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-006.8, AC-006.9, AC-006.10, AC-006.11] (test) `edit_distance`, `prefix_edit_distance`, `typo_tolerance`, `query_forms` con «-ces» y `rank_catalog` con tolerancia; reescribe `test_search_does_not_tolerate_typos` (sustituido por AC-006.2) — `backend/tests/test_services/test_catalog_search_service.py`
- [x] T-033 [REQ-007, AC-007.3, AC-007.1, AC-007.5, AC-007.7] (test) `rank_candidates`: catálogo antes que propio con el mismo nombre, mezcla de orígenes, tope de 20 y tolerancia en propios — `backend/tests/test_services/test_catalog_search_service.py`
- [x] T-034 [REQ-007, AC-007.1, AC-007.2, AC-007.4, AC-007.5, AC-007.6, AC-007.7, NFR-001, AC-N001.1] (test) `FoodLibraryService.search`: mezcla catálogo/propios, ajenos excluidos, `favorite`, validación de consulta y sin proveedores externos — `backend/tests/test_services/test_food_library_service.py`
- [x] T-035 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6, AC-008.7, AC-008.8, REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) `FoodLibraryService.recent` y `favorites`: orden, `last_grams`, valores actuales, omisión de retirados — `backend/tests/test_services/test_food_library_service.py`
- [x] T-036 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) `FoodLibraryService.add_favorite`, `remove_favorite` y `delete_custom_food`: idempotencia, 404, límite de 100 — `backend/tests/test_services/test_food_library_service.py`
- [x] T-037 [REQ-001, AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.10, REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) `MealService.add_items` guarda o actualiza en la biblioteca, límite de 500 y rollback — `backend/tests/test_services/test_meal_service.py`
- [x] T-038 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5] (test) `MealService.add_items` con `custom_food_id` (copia de valores, ajeno/inexistente, mezcla de orígenes, gramos no válidos) — `backend/tests/test_services/test_meal_service.py`
- [x] T-039 [REQ-012, AC-012.1, AC-012.2] (test) `remove_item` y `restore_item` con `cf` (mantiene el vínculo o cae a `None`) — `backend/tests/test_services/test_meal_service.py`
- [x] T-040 [REQ-003, AC-003.2, AC-003.3, AC-003.5, REQ-012, AC-012.1] (test) `parse_items` con `custom_food_id`; `snapshot_payload` con y sin `cf`; `parse_snapshot_payload` rechaza `cf` no válido o con otro origen — `backend/tests/test_services/test_meal_rules.py`
- [x] T-041 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) Migración `e6a8c0d2f4b7`: relleno desde personalizados (último registro gana, un alimento por usuario y nombre), base sin personalizados y `downgrade` — `backend/tests/test_services/test_food_library_migration.py`
- [x] T-042 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-006.8, AC-006.9, AC-006.10, AC-006.11, REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7] (test) `GET /api/food-library/search` de extremo a extremo: erratas, plural «-ces», mezcla, ajenos, favorito, orden y 400 — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-043 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6, AC-008.7, AC-008.8, REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) `GET /api/food-library/recent` y `/favorites` de extremo a extremo (AC-008.4 y AC-010.2 quitan alimentos de `catalog_foods` con la sesión) — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-044 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) `PUT`/`DELETE` de favoritos y `DELETE /api/food-library/custom/{id}` de extremo a extremo — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-045 [REQ-011, AC-011.1, NFR-001, AC-N001.1, AC-N001.2] (test) 401 sin token y con token caducado en las ocho rutas; sin llamadas a `FakeVoyageClient`; 60 búsquedas seguidas devuelven 200 — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-046 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.9, AC-001.10] (test) `POST /api/meals` guarda o actualiza en la biblioteca y devuelve `custom_food_id` (sin tocar los registrados, USDA/catálogo con `null`) — `backend/tests/test_routes/test_meal_library_routes.py`
- [x] T-047 [REQ-001, AC-001.8, REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) Concurrencia de dos peticiones con el mismo personalizado nuevo (dos hilos, fila del usuario bloqueada) y límite de 500 — `backend/tests/test_routes/test_meal_library_routes.py`
- [x] T-048 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, REQ-012, AC-012.1, AC-012.2] (test) `POST /api/meals` con `custom_food_id` y `POST /api/meals/restore` con y sin alimento propio — `backend/tests/test_routes/test_meal_library_routes.py`
- [x] T-049 [REQ-006, AC-006.12] (test) `GET /api/catalog/search?q=aroz` devuelve «Arroz blanco cocido» con el formato de la 023 — `backend/tests/test_routes/test_catalog_routes.py`
- [x] T-050 [REQ-001, AC-001.9] (test) Actualiza `test_post_response_has_the_full_contract_shape` para que el conjunto exacto de claves del alimento incluya `custom_food_id` — `backend/tests/test_routes/test_meal_routes.py`

### frontend
- [x] T-060 [REQ-013, AC-013.2, AC-013.6] (test) `useDebouncedValue`: retardo, reinicio en cada cambio y `flush` inmediato — `frontend/src/lib/useDebouncedValue.test.ts`
- [x] T-061 [REQ-007, REQ-009, REQ-004, REQ-014, REQ-015, REQ-017] (test) API de la biblioteca: rutas, métodos, `encodeURIComponent` y validación zod, con `apiClient` simulado — `frontend/src/features/food-library/api.test.ts`
- [x] T-062 [REQ-018, AC-018.4, REQ-019, AC-019.1, AC-019.2, AC-019.3, AC-019.4] (test) `libraryEntry`, `withEntryKey`, `mergeProposalEntries` y `proposalItems` con `customFoodId` — `frontend/src/features/diary/proposal.test.ts`
- [x] T-063 [REQ-001, REQ-003] (test) `custom_food_id` (con `null` por defecto) en `mealResponseSchema` — `frontend/src/features/diary/schemas.test.ts`
- [x] T-064 [REQ-013, AC-013.1, AC-013.2, AC-013.3, AC-013.4, AC-013.5, AC-013.6, AC-013.7, AC-013.8] (test) `FoodSearchPanel`: búsqueda a los 300 ms, Intro, carreras, avisos, sin resultados con «Crear alimento personalizado», error con «Reintentar» y sin botón «Buscar» — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-065 [REQ-014, AC-014.1, AC-014.2, AC-014.3, AC-014.4, REQ-015, AC-015.1, AC-015.2, AC-015.3, AC-015.4, AC-015.5] (test) `FoodSearchPanel`: «Favoritos» y «Recientes», etiqueta «Personalizado», botón de favorito y sus errores — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-066 [REQ-017, AC-017.1, AC-017.2, AC-017.3, AC-017.4, NFR-002, AC-N002.1, AC-N002.2] (test) `FoodSearchPanel`: borrado con confirmación, sin «Borrar» en el catálogo, roles, `aria-pressed` y región anunciada — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-067 [REQ-013, AC-013.9, REQ-014, AC-014.5, AC-014.6, REQ-016, AC-016.1, AC-016.2, AC-016.3] (test) Reescribe `AddFoodDialog` sobre el panel: gramos de «Recientes», `custom_food_id`, aviso del formulario, error del límite y recientes al reabrir — `frontend/src/features/diary/components/AddFoodDialog.test.tsx`
- [x] T-068 [REQ-018, AC-018.1, AC-018.2, AC-018.3, AC-018.4, AC-018.5, AC-018.6, REQ-013, AC-013.9] (test) Propuesta de foto: búsqueda compartida, crear/elegir alimentos propios, resolver sin coincidencia y guardar en una sola petición; el mock de `food-library` sustituye al de la 025 — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [x] T-069 [REQ-019, AC-019.1, AC-019.2, AC-019.3, AC-019.4] (test) Propuesta de foto: filas y total al día al editar gramos, resolver, volver de «Añadir otro alimento» y quitar — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [x] T-070 [NFR-003, AC-N003.1] (test) Escaneo del código (`?raw`): `PhotoReview.tsx` no usa `form.watch` ni `.watch(` — `frontend/src/features/diary/components/PhotoReview.source.test.ts`
- [x] T-071 [REQ-021, AC-021.1] (test) El punto «Diario de comidas:» menciona los alimentos personalizados y los favoritos; la fecha ya no es la del 22 de octubre (reescribe el test de la 025) — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`
- [x] T-072 [REQ-020, AC-020.1] (test) `/foods` termina en `/diary` y muestra «Diario» — `frontend/src/app/foodsRoute.test.tsx`
- [x] T-073 [REQ-013, REQ-014] (test) Añade el mock de `@/features/food-library/api` a los tests que abren el diálogo de añadir — `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/app/mealPhotoRoute.test.tsx`

## Fase B — Implementación (implementer)

### backend
- [x] T-100 [REQ-005, REQ-001, REQ-004, REQ-009] (migration) Migración `e6a8c0d2f4b7` (`down_revision = 'd4f6a8c0e2b5'`): tablas `custom_foods` y `food_favorites`, columna/FK/índice/CHECK de `meal_items`, relleno con SQL enlazado y `downgrade` — `backend/migrations/versions/e6a8c0d2f4b7_create_food_library.py`
- [x] T-101 [REQ-001, REQ-003, REQ-004, REQ-007, REQ-009] (impl) `custom_food_name_key` y `parse_custom_food_id` — `backend/services/food_library_rules.py`
- [x] T-102 [REQ-006, REQ-007] (impl) Forma «-ces», OSA, tolerancia, `typo_distance`, `rank_candidates` y `rank_catalog` sobre ellos (también para `/api/catalog/search`) — `backend/services/catalog_search_service.py`
- [x] T-103 [REQ-001, REQ-002, REQ-004, REQ-009, REQ-010] (impl) `CustomFoodRepository` y `FoodFavoriteRepository` (solo `flush`, nunca commit) — `backend/repositories/custom_food_repository.py`, `backend/repositories/food_favorite_repository.py`
- [x] T-104 [REQ-008, REQ-012] (impl) `MealRepository.list_recent_foods` (ventana por clave, solo catálogo vigente o propios) — `backend/repositories/meal_repository.py`
- [x] T-105 [REQ-003, REQ-012] (impl) `parse_items` con `custom_food_id`, `snapshot_payload`/`parse_snapshot_payload` con `cf` opcional — `backend/services/meal_rules.py`
- [x] T-106 [REQ-001, REQ-002, REQ-003] (impl) `MealService.add_items`: `_load_foods` por `UsdaItemInput`, `_load_custom_foods`, `_save_custom_foods`, límite y rollback — `backend/services/meal_service.py`
- [x] T-107 [REQ-012] (impl) `MealService.remove_item` y `restore_item` con `custom_food_id` — `backend/services/meal_service.py`
- [x] T-108 [REQ-004, REQ-007, REQ-008, REQ-009, REQ-010, NFR-001] (impl) `FoodLibraryService` completo (sin embeddings ni rate limiter) — `backend/services/food_library_service.py`
- [x] T-109 [REQ-001, REQ-003, REQ-012] (impl) `custom_food_id` en las respuestas de `/api/meals` y `_build_meal_service` con el repositorio de la biblioteca — `backend/routes/meal_routes.py`
- [x] T-110 [REQ-004, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011] (impl) Blueprint `/api/food-library` con las ocho rutas (`@require_auth`, parámetros de ruta como texto), `_build_food_library_service` y `library_food_to_json`; registro del blueprint — `backend/routes/food_library_routes.py`, `backend/routes/__init__.py`

### frontend
- [x] T-120 [REQ-004, REQ-007, REQ-009, REQ-014, REQ-015, REQ-017] (impl) `api.ts` y `hooks.ts` de `food-library` (claves, `staleTime`, invalidación de `foodLibraryKeys.all`, 404 de borrado como éxito) — `frontend/src/features/food-library/api.ts`, `frontend/src/features/food-library/hooks.ts`
- [x] T-121 [REQ-013] (impl) `useDebouncedValue` con `flush` — `frontend/src/lib/useDebouncedValue.ts`
- [x] T-122 [REQ-014, REQ-015, REQ-016, REQ-017] (impl) `gramsText`, `favoriteErrorMessage` (400 → mensaje del servidor) y constantes — `frontend/src/features/diary/format.ts`, `frontend/src/features/diary/errors.ts`, `frontend/src/features/diary/constants.ts`
- [x] T-123 [REQ-018, REQ-019] (impl) `libraryEntry`, `withEntryKey`, `mergeProposalEntries`, `proposalItems` con `customFoodId` y esquemas del diario con `custom_food_id` y `key` — `frontend/src/features/diary/proposal.ts`, `frontend/src/features/diary/schemas.ts`
- [x] T-124 [REQ-015, REQ-017, NFR-002] (impl) `LibraryFoodList`: lista con nombre, «Personalizado», macros, «Elegir», favorito con `aria-pressed` y «Borrar» — `frontend/src/features/diary/components/LibraryFoodList.tsx`
- [x] T-125 [REQ-013, REQ-014, REQ-015, REQ-017, NFR-002] (impl) `FoodSearchPanel`: caja, búsqueda a 300 ms, Intro, región `status`, favoritos, recientes, borrado con `ConfirmDialog` — `frontend/src/features/diary/components/FoodSearchPanel.tsx`
- [x] T-126 [REQ-016] (impl) Aviso `CUSTOM_FOOD_LIBRARY_NOTICE` y 400 del límite visible en el formulario personalizado — `frontend/src/features/diary/components/CustomFoodForm.tsx`
- [x] T-127 [REQ-013, REQ-014, REQ-016] (impl) `AddFoodDialog` sobre `FoodSearchPanel` y envío de `custom_food_id`; `useAddMealItems` invalida la biblioteca — `frontend/src/features/diary/components/AddFoodDialog.tsx`, `frontend/src/features/diary/hooks.ts`
- [x] T-128 [REQ-018, REQ-019, NFR-003] (impl) `PhotoReview` con `useWatch` y `mergeProposalEntries`, vistas `search` y `custom`, `confirmContainer`; sin `form.watch` — `frontend/src/features/diary/components/PhotoReview.tsx`
- [x] T-129 [REQ-018, REQ-019] (impl) `ProposalEntryRow` y `MealPhotoDialog` ajustados (etiqueta «Personalizado», `confirmContainer`, búsqueda compartida) — `frontend/src/features/diary/components/ProposalEntryRow.tsx`, `frontend/src/features/diary/components/MealPhotoDialog.tsx`
- [x] T-130 [REQ-020] (impl) Borrar `ProposalSearchStep.tsx`, `FoodsPage.tsx` y su test, `FoodResultList.tsx`, `FoodSearchForm.tsx` y `foods/hooks.ts`; `/foods` sigue redirigiendo a `/diary` — `frontend/src/features/foods/pages/FoodsPage.tsx`
- [x] T-131 [REQ-021] (impl) Punto «Diario de comidas:» con personalizados y favoritos y `updatedAt="27 de octubre de 2026"` — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.9, AC-001.10 | T-031, T-037, T-046, T-050, T-063 | T-100, T-101, T-103, T-106, T-109 |
| REQ-001 | AC-001.8 | T-047 | T-100, T-106 |
| REQ-002 | AC-002.1, AC-002.2, AC-002.3 | T-037, T-047 | T-106 |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5 | T-031, T-038, T-040, T-048 | T-101, T-105, T-106, T-109 |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3, AC-004.4 | T-031, T-036, T-044 | T-100, T-101, T-103, T-108, T-110 |
| REQ-005 | AC-005.1, AC-005.2, AC-005.3 | T-041 | T-100 |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-006.8, AC-006.9, AC-006.10, AC-006.11 | T-032, T-042 | T-102 |
| REQ-006 | AC-006.12 | T-049 | T-102 |
| REQ-007 | AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7 | T-033, T-034, T-042 | T-102, T-108, T-110 |
| REQ-008 | AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6, AC-008.7, AC-008.8 | T-035, T-043 | T-104, T-108, T-110 |
| REQ-009 | AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5 | T-036, T-044 | T-100, T-103, T-108, T-110 |
| REQ-010 | AC-010.1, AC-010.2, AC-010.3 | T-035, T-043 | T-103, T-108, T-110 |
| REQ-011 | AC-011.1 | T-045 | T-110 |
| REQ-012 | AC-012.1, AC-012.2 | T-039, T-040, T-048 | T-104, T-105, T-107, T-109 |
| REQ-013 | AC-013.1, AC-013.2, AC-013.3, AC-013.4, AC-013.5, AC-013.6, AC-013.7, AC-013.8 | T-060, T-064 | T-121, T-125 |
| REQ-013 | AC-013.9 | T-067, T-068 | T-125, T-127, T-128, T-129 |
| REQ-014 | AC-014.1, AC-014.2, AC-014.3, AC-014.4 | T-065 | T-120, T-125 |
| REQ-014 | AC-014.5, AC-014.6 | T-067 | T-122, T-125, T-127 |
| REQ-015 | AC-015.1, AC-015.2, AC-015.3, AC-015.4, AC-015.5 | T-065 | T-120, T-122, T-124, T-125 |
| REQ-016 | AC-016.1, AC-016.2, AC-016.3 | T-067 | T-126, T-127 |
| REQ-017 | AC-017.1, AC-017.2, AC-017.3, AC-017.4 | T-066 | T-120, T-124, T-125 |
| REQ-018 | AC-018.1, AC-018.2, AC-018.3, AC-018.4, AC-018.5, AC-018.6 | T-062, T-068 | T-123, T-128, T-129 |
| REQ-019 | AC-019.1, AC-019.2, AC-019.3, AC-019.4 | T-062, T-069 | T-123, T-128, T-129 |
| REQ-020 | AC-020.1 | T-072 | T-130 |
| REQ-021 | AC-021.1 | T-071 | T-131 |
| NFR-001 | AC-N001.1, AC-N001.2 | T-034, T-045 | T-108, T-110 |
| NFR-002 | AC-N002.1, AC-N002.2 | T-066 | T-124, T-125 |
| NFR-003 | AC-N003.1 | T-070 | T-128 |
