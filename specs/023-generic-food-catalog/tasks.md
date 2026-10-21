# Tareas 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-21)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold -> test -> impl/migration/config.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Backend: no hacen falta esqueletos para `GET /api/catalog/search` (una ruta nueva responde 404, rojo legítimo) ni para
`parse_items`, `_serialize_item` ni el `import_usda_foods` existentes (ya existen). Los modelos solo se declaran
(columnas y `CHECK`, sin lógica) porque los tests crean las tablas con `create_all()`.

- [ ] T-001 [REQ-001, REQ-002, REQ-004] (scaffold) Declarar el modelo `CatalogFood` y `CATALOG_SOURCES` (columnas y `CHECK` de la sección 3.1, sin lógica) y exportarlo en `models/__init__.py` — `backend/models/catalog_food.py`
- [ ] T-002 [REQ-006, REQ-007, REQ-008] (scaffold) Añadir `MealItem.catalog_id`, `MEAL_ITEM_SOURCES = ("catalog", "usda", "custom")` y las dos `CHECK` nuevas de `meal_items` (declarativo, sin lógica) — `backend/models/meal.py`
- [ ] T-003 [REQ-004, REQ-001] (scaffold) Crear `catalog_rules` con las constantes reales y `is_catalog_id`, `fold`, `words`, `term_key`, `word_forms` que lancen "not implemented" — `backend/services/catalog_rules.py`
- [ ] T-004 [REQ-002, REQ-004, REQ-006] (scaffold) Crear `CatalogFoodRepository(BaseRepository)` con `__init__` y `list_all`, `get_by_ids` que lancen "not implemented" — `backend/repositories/catalog_food_repository.py`
- [ ] T-005 [REQ-001, REQ-003] (scaffold) Crear `REQUIRED_COLUMNS`, `NUTRIENT_COLUMNS`, `CatalogFileError`, `CatalogRecord` y `read_catalog_csv` que lance "not implemented" — `backend/services/catalog_csv_reader.py`
- [ ] T-006 [REQ-004, REQ-005, NFR-001] (scaffold) Crear `MAX_RESULTS`, grupos, `query_forms`, `match_group`, `rank_catalog` y `CatalogSearchService` (el `__init__` guarda el repositorio; `search` lanza "not implemented") — `backend/services/catalog_search_service.py`
- [ ] T-007 [REQ-002, REQ-003, REQ-007] (scaffold) Crear `CatalogLoadSummary`, `CatalogLoadService` (`__init__` guarda dependencias; `run` lanza "not implemented") y `format_catalog_summary` que lance "not implemented" — `backend/services/catalog_load_service.py`
- [ ] T-008 [REQ-006] (scaffold) Crear el dataclass `CatalogItemInput(catalog_id, grams)` en las reglas del diario — `backend/services/meal_rules.py`
- [ ] T-009 [REQ-006] (scaffold) Añadir el parámetro `catalog_repository=None` al `__init__` de `MealService`, guardándolo sin lanzar — `backend/services/meal_service.py`
- [ ] T-010 [REQ-002] (scaffold) Crear `database_target` (constantes reales; `is_local_host` y `confirm_remote_write` lanzan "not implemented") y `load_food_catalog` (`DEFAULT_CATALOG_PATH`, `CANCEL_MESSAGE`, `main` lanza "not implemented") — `backend/scripts/database_target.py`, `backend/scripts/load_food_catalog.py`
- [ ] T-011 [REQ-009, NFR-002] (scaffold) Crear los tipos del catálogo y `catalogSearchResponseSchema` provisional (`z.never()`) — `frontend/src/features/catalog/types.ts`, `frontend/src/features/catalog/schemas.ts`
- [ ] T-012 [REQ-009] (scaffold) Crear `searchCatalog` y `useCatalogSearch` que lancen "not implemented" (parámetros con `_`) — `frontend/src/features/catalog/api.ts`, `frontend/src/features/catalog/hooks.ts`
- [ ] T-013 [REQ-009, NFR-002] (scaffold) Crear el componente `CatalogResultList` que lance "not implemented" — `frontend/src/features/catalog/components/CatalogResultList.tsx`
- [ ] T-014 [REQ-006, REQ-010] (scaffold) Añadir a los tipos del diario `MealItemSource` con `"catalog"`, `MealItem.catalog_id` y `CatalogItemPayload` (solo tipos) — `frontend/src/features/diary/types.ts`

## Fase A — Tests (test-author)
Backend:
- [ ] T-020 [REQ-004, REQ-003] (test) Dobles `make_catalog_food` y `FakeCatalogFoodRepository` (con `list_calls` y `get_calls`) — `backend/tests/fakes.py`
- [ ] T-021 [REQ-003] (test) Utilidades `CATALOG_COLUMNS`, `catalog_row` y `write_catalog_csv` — `backend/tests/catalog_samples.py`
- [ ] T-022 [REQ-004, AC-004.3, AC-004.6, AC-004.12, AC-004.13, AC-004.14, AC-004.15] (test) `fold`, `words`, `term_key`, `word_forms` e `is_catalog_id` — `backend/tests/test_services/test_catalog_rules.py`
- [ ] T-023 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5, AC-004.6, AC-004.7, AC-004.8, AC-004.9, AC-004.10, AC-004.11, AC-004.12, AC-004.13, AC-004.14, AC-004.15, AC-004.16] (test) Coincidencia, plurales y orden del servicio con los catálogos exactos de cada AC — `backend/tests/test_services/test_catalog_search_service.py`
- [ ] T-024 [REQ-005, NFR-001, AC-005.1, AC-005.2, AC-005.3, AC-N001.1] (test) Validación de la consulta antes de leer el repositorio y servicio sin proveedor de embeddings — `backend/tests/test_services/test_catalog_search_service.py`
- [ ] T-025 [REQ-003, REQ-001, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.7, AC-003.8, AC-001.3] (test) Lector del CSV: archivo, columnas, filas, unicidad, palabras prohibidas y todos los errores en un mensaje — `backend/tests/test_services/test_catalog_csv_reader.py`
- [ ] T-026 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) Carga: añadir, repetir sin cambios, actualizar y quitar, con la búsqueda real tras quitar — `backend/tests/test_services/test_catalog_load_service.py`
- [ ] T-027 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6, AC-003.7, AC-003.8] (test) Carga: comparación con USDA (FDC ID 171477) y catálogo intacto ante cualquier error — `backend/tests/test_services/test_catalog_load_service.py`
- [ ] T-028 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) El CSV del repositorio: valida sin errores, 250–350 filas, sin términos repetidos, sin palabras prohibidas y con los 40 de la lista mínima — `backend/tests/test_services/test_food_catalog_csv.py`
- [ ] T-029 [REQ-002, AC-002.5, AC-002.6] (test) Script de carga: confirmación `[s/N]`, `localhost`, `--yes`, ruta por defecto y `CatalogFileError` — `backend/tests/test_scripts/test_load_food_catalog_script.py`
- [ ] T-030 [REQ-006, AC-006.4, AC-006.5] (test) `parse_items` con `CatalogItemInput`, combinaciones de claves con el mensaje nuevo, gramos y `catalog_id` no válido; adaptar la aserción del mensaje de AC-003.7 de la 022 — `backend/tests/test_services/test_meal_rules.py`
- [ ] T-031 [REQ-006, REQ-007, AC-006.1, AC-006.2, AC-006.3, AC-006.6, AC-007.2] (test) `MealService` con alimentos del catálogo: copia, orden, rollback sin guardar, recálculo con valores guardados — `backend/tests/test_services/test_meal_service.py`
- [ ] T-032 [REQ-004, REQ-005, NFR-001, AC-004.1, AC-004.8, AC-004.9, AC-004.10, AC-004.11, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-N001.1, AC-N001.2] (test) Ruta `GET /api/catalog/search` de extremo a extremo, sin Voyage ni Redis (dobles en los singletons) — `backend/tests/test_routes/test_catalog_routes.py`
- [ ] T-033 [REQ-006, REQ-007, REQ-008, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-002.4, AC-007.1, AC-008.1, AC-008.2] (test) Rutas del diario con catálogo, carga real que quita o cambia el alimento y `catalog_id: null` en USDA y personalizados; adaptar mensaje y aserciones existentes — `backend/tests/test_routes/test_meal_routes.py`
- [ ] T-034 [REQ-008, AC-008.1] (test) Migración: el `downgrade` se niega con alimentos `catalog` en `meal_items` y, sin ellos, quita `catalog_id` y `catalog_foods` — `backend/tests/test_services/test_catalog_migration.py`

Frontend:
- [ ] T-040 [REQ-009, REQ-010] (test) Fábricas `makeCatalogFood` y `makeCatalogItem`, y `catalog_id: null` en `makeMealItem` — `frontend/src/test/catalogFixtures.ts`, `frontend/src/test/diaryFixtures.ts`
- [ ] T-041 [REQ-009, AC-009.2] (test) `catalogSearchResponseSchema` acepta la respuesta de la spec y rechaza `null` — `frontend/src/features/catalog/schemas.test.ts`
- [ ] T-042 [REQ-009, NFR-002, AC-009.2, AC-N002.1] (test) `CatalogResultList`: textos de la pechuga sin origen, lista «Resultados» y botón «Elegir {nombre}» — `frontend/src/features/catalog/components/CatalogResultList.test.tsx`
- [ ] T-043 [REQ-009, NFR-002, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-009.7, AC-N002.1, AC-N002.2] (test) Diálogo de añadir con `searchCatalog` simulado, payload `catalog_id` y región de estado; mantener los casos de la 022 — `frontend/src/features/diary/components/AddFoodDialog.test.tsx`
- [ ] T-044 [REQ-010, AC-010.1] (test) `sourceLabel` devuelve `null` en `catalog` y las etiquetas de la 022 siguen — `frontend/src/features/diary/format.test.ts`
- [ ] T-045 [REQ-008, REQ-010, AC-008.1] (test) `mealResponseSchema` acepta `catalog` con `catalog_id` y alimentos sin el campo (queda `null`) — `frontend/src/features/diary/schemas.test.ts`
- [ ] T-046 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) Diario: fila del catálogo sin etiqueta, etiquetas de USDA y personalizado, editar a 200 g; mocks de `catalog/api` — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [ ] T-047 [REQ-011, AC-011.1] (test) `/foods` termina en `/diary`, `router.tsx` no importa `FoodsPage` y con onboarding pendiente se ve el onboarding — `frontend/src/app/foodsRoute.test.tsx`, `frontend/src/app/diaryRoute.test.tsx`
- [ ] T-048 [REQ-011, AC-011.2] (test) Añadir el marcador de la navegación sin enlace a `/foods` — `frontend/src/components/layout/noFoodsLink.test.tsx`
- [ ] T-049 [REQ-012, AC-012.1, AC-012.3] (test) Términos de servicio: atribución, aviso, frase de comida local y fecha — `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`
- [ ] T-050 [REQ-012, AC-012.2, AC-012.3] (test) Política de privacidad: Voyage solo con las preguntas al coach y fecha — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

## Fase B — Implementación (implementer)
Backend, de datos a interfaz:
- [ ] T-100 [REQ-002, REQ-006, REQ-007, REQ-008] (migration) Migración `d4f6a8c0e2b5` (`down_revision = "b3d5f7a9c1e4"`): `catalog_foods` con sus `CHECK`, `meal_items.catalog_id`, las dos `CHECK` nuevas escritas a mano y `downgrade` que se niega con alimentos `catalog` — `backend/migrations/versions/d4f6a8c0e2b5_create_catalog_foods_and_catalog_meal_items.py`
- [ ] T-101 [REQ-004, REQ-001, AC-004.3, AC-004.6, AC-004.12, AC-004.13, AC-004.14, AC-004.15] (impl) Funciones de `catalog_rules` — `backend/services/catalog_rules.py`
- [ ] T-102 [REQ-002, REQ-004, REQ-006] (impl) `CatalogFoodRepository.list_all` y `get_by_ids` — `backend/repositories/catalog_food_repository.py`
- [ ] T-103 [REQ-001, REQ-003, AC-001.3, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.7, AC-003.8] (impl) `read_catalog_csv` con los mensajes del plan — `backend/services/catalog_csv_reader.py`
- [ ] T-104 [REQ-002, REQ-003, REQ-007, AC-002.1, AC-002.2, AC-002.3, AC-003.5, AC-003.6] (impl) `CatalogLoadService.run` y `format_catalog_summary` — `backend/services/catalog_load_service.py`
- [ ] T-105 [REQ-004, REQ-005, NFR-001, AC-004.1, AC-004.2, AC-004.4, AC-004.5, AC-004.7, AC-004.8, AC-004.9, AC-004.11, AC-004.16, AC-005.1, AC-005.2, AC-005.3, AC-N001.1] (impl) `query_forms`, `match_group`, `rank_catalog` y `CatalogSearchService.search` — `backend/services/catalog_search_service.py`
- [ ] T-106 [REQ-004, REQ-005, NFR-001, AC-004.10, AC-005.4, AC-N001.2] (impl) `catalog_bp`, `catalog_food_to_json`, `_build_catalog_search_service`, y registro del blueprint — `backend/routes/catalog_routes.py`, `backend/routes/__init__.py`
- [ ] T-107 [REQ-006, AC-006.4, AC-006.5] (impl) `ITEM_SOURCE_MESSAGE` nuevo y `parse_items` con `catalog_id` — `backend/services/meal_rules.py`
- [ ] T-108 [REQ-006, REQ-007, AC-006.1, AC-006.2, AC-006.3, AC-006.6, AC-007.2] (impl) `MealService.add_items` con `_load_catalog_foods` y `catalog_id` en los alimentos nuevos — `backend/services/meal_service.py`
- [ ] T-109 [REQ-006, REQ-008, AC-002.4, AC-007.1, AC-008.1, AC-008.2] (impl) `catalog_id` en `_serialize_item` y `catalog_repository` en `_build_meal_service` — `backend/routes/meal_routes.py`
- [ ] T-110 [REQ-002, AC-002.5, AC-002.6] (impl) `is_local_host`, `confirm_remote_write` y que `import_usda_foods` los use como alias, con el mismo comportamiento — `backend/scripts/database_target.py`, `backend/scripts/import_usda_foods.py`
- [ ] T-111 [REQ-002, AC-002.5, AC-002.6] (impl) Script `load_food_catalog.main` (argumentos, entorno y base sin contraseña, confirmación, resumen y códigos de salida) — `backend/scripts/load_food_catalog.py`

CSV del catálogo (valores `usda` copiados de `public.foods` de la base de desarrollo con `repr(float)`; filas `manual` solo con referencia verificable y sin inventar valores):
- [ ] T-120 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (config) CSV parte 1: cabecera y granos, legumbres, tubérculos, panes y pastas, incluida la parte de la lista mínima que les corresponde — `backend/scripts/data/food_catalog.csv`
- [ ] T-121 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (config) CSV parte 2: carnes, pescados, huevo, lácteos y la parte de la lista mínima que les corresponde — `backend/scripts/data/food_catalog.csv`
- [ ] T-122 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (config) CSV parte 3: frutas, verduras, frutos secos, grasas y la parte de la lista mínima que les corresponde — `backend/scripts/data/food_catalog.csv`
- [ ] T-123 [REQ-001, REQ-003, AC-001.1, AC-001.4] (config) CSV parte 4: completar hasta 250–350 filas, sinónimos regionales sin repeticiones y filas `manual` con su `reference`; listarlas en el informe para el gate de review — `backend/scripts/data/food_catalog.csv`
- [ ] T-124 [REQ-001, REQ-003, AC-003.5, AC-003.6] (config) Aplicar la migración y ejecutar la carga del CSV contra la base de desarrollo con `FLASK_ENV=development`; corregir el CSV hasta que no haya errores — `backend/scripts/data/food_catalog.csv`

Frontend:
- [ ] T-130 [REQ-009, AC-009.2] (impl) `catalogSearchResponseSchema` real — `frontend/src/features/catalog/schemas.ts`
- [ ] T-131 [REQ-009, AC-009.2, AC-009.6] (impl) `searchCatalog` con `apiFetch` y `useCatalogSearch` sin reintentos — `frontend/src/features/catalog/api.ts`, `frontend/src/features/catalog/hooks.ts`
- [ ] T-132 [REQ-009, NFR-002, AC-009.2, AC-N002.1] (impl) `CatalogResultList` — `frontend/src/features/catalog/components/CatalogResultList.tsx`
- [ ] T-133 [REQ-008, REQ-010, AC-008.1] (impl) `catalog_id` y `"catalog"` en `mealResponseSchema` y el payload `CatalogItemPayload` en `AddMealItemsPayload` — `frontend/src/features/diary/schemas.ts`, `frontend/src/features/diary/types.ts`
- [ ] T-134 [REQ-010, AC-010.1, AC-010.2] (impl) `sourceLabel` devuelve `null` en `catalog` y `MealItemRow` solo pinta la etiqueta si existe — `frontend/src/features/diary/format.ts`, `frontend/src/features/diary/components/MealItemRow.tsx`
- [ ] T-135 [REQ-009, AC-009.1] (impl) Prop opcional `placeholder` en `FoodSearchForm` con el ejemplo anterior por defecto — `frontend/src/features/foods/components/FoodSearchForm.tsx`
- [ ] T-136 [REQ-009, NFR-002, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-009.7, AC-N002.2] (impl) `AddFoodDialog` con catálogo, nueva descripción, ejemplo y payload `catalog_id` — `frontend/src/features/diary/components/AddFoodDialog.tsx`
- [ ] T-137 [REQ-011, AC-011.1, AC-011.2] (impl) `/foods` redirige a `/diary` con `Navigate replace` y se quita `FoodsPage` del router — `frontend/src/app/router.tsx`
- [ ] T-138 [REQ-012, AC-012.1, AC-012.3] (impl) Frase de comida local y fecha «21 de octubre de 2026» en Términos de servicio — `frontend/src/features/legal/pages/TermsOfServicePage.tsx`
- [ ] T-139 [REQ-012, AC-012.2, AC-012.3] (impl) Voyage AI solo con las preguntas al coach y fecha en Política de privacidad — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-028 | T-120, T-121, T-122, T-123 |
| REQ-001 | AC-001.2 | T-028 | T-120, T-121, T-122, T-123 |
| REQ-001 | AC-001.3 | T-025, T-028 | T-103, T-120, T-121, T-122 |
| REQ-001 | AC-001.4 | T-028 | T-120, T-121, T-122, T-123 |
| REQ-002 | AC-002.1 | T-026 | T-104, T-100 |
| REQ-002 | AC-002.2 | T-026 | T-104 |
| REQ-002 | AC-002.3 | T-026 | T-104 |
| REQ-002 | AC-002.4 | T-033 | T-104, T-109 |
| REQ-002 | AC-002.5 | T-029 | T-110, T-111 |
| REQ-002 | AC-002.6 | T-029 | T-110, T-111 |
| REQ-003 | AC-003.1 | T-025, T-027 | T-103 |
| REQ-003 | AC-003.2 | T-025, T-027 | T-103 |
| REQ-003 | AC-003.3 | T-025, T-027 | T-103 |
| REQ-003 | AC-003.4 | T-025, T-027 | T-103 |
| REQ-003 | AC-003.5 | T-027 | T-104, T-124 |
| REQ-003 | AC-003.6 | T-027 | T-104, T-124 |
| REQ-003 | AC-003.7 | T-025, T-027 | T-103 |
| REQ-003 | AC-003.8 | T-025, T-027 | T-103 |
| REQ-004 | AC-004.1 | T-023, T-032 | T-105 |
| REQ-004 | AC-004.2 | T-023 | T-105 |
| REQ-004 | AC-004.3 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.4 | T-023 | T-105 |
| REQ-004 | AC-004.5 | T-023 | T-105 |
| REQ-004 | AC-004.6 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.7 | T-023 | T-105 |
| REQ-004 | AC-004.8 | T-023, T-032 | T-105 |
| REQ-004 | AC-004.9 | T-023, T-032 | T-105 |
| REQ-004 | AC-004.10 | T-023, T-032 | T-106 |
| REQ-004 | AC-004.11 | T-023, T-032 | T-105 |
| REQ-004 | AC-004.12 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.13 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.14 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.15 | T-022, T-023 | T-101 |
| REQ-004 | AC-004.16 | T-023 | T-105 |
| REQ-005 | AC-005.1 | T-024, T-032 | T-105 |
| REQ-005 | AC-005.2 | T-024, T-032 | T-105 |
| REQ-005 | AC-005.3 | T-024, T-032 | T-105 |
| REQ-005 | AC-005.4 | T-032 | T-106 |
| REQ-006 | AC-006.1 | T-031, T-033 | T-107, T-108, T-109 |
| REQ-006 | AC-006.2 | T-031, T-033 | T-108 |
| REQ-006 | AC-006.3 | T-031, T-033 | T-108 |
| REQ-006 | AC-006.4 | T-030, T-033 | T-107 |
| REQ-006 | AC-006.5 | T-030, T-033 | T-107 |
| REQ-006 | AC-006.6 | T-031, T-033 | T-108 |
| REQ-007 | AC-007.1 | T-033 | T-104, T-108, T-109 |
| REQ-007 | AC-007.2 | T-031 | T-108 |
| REQ-008 | AC-008.1 | T-033, T-034, T-045 | T-100, T-109, T-133 |
| REQ-008 | AC-008.2 | T-033 | T-109 |
| REQ-009 | AC-009.1 | T-043 | T-135, T-136 |
| REQ-009 | AC-009.2 | T-041, T-042, T-043 | T-130, T-131, T-132, T-136 |
| REQ-009 | AC-009.3 | T-043 | T-136 |
| REQ-009 | AC-009.4 | T-043 | T-136 |
| REQ-009 | AC-009.5 | T-043 | T-136 |
| REQ-009 | AC-009.6 | T-043 | T-131, T-136 |
| REQ-009 | AC-009.7 | T-043 | T-136 |
| REQ-010 | AC-010.1 | T-044, T-046 | T-134 |
| REQ-010 | AC-010.2 | T-046 | T-134 |
| REQ-010 | AC-010.3 | T-046 | T-134 |
| REQ-011 | AC-011.1 | T-047 | T-137 |
| REQ-011 | AC-011.2 | T-048 | T-137 |
| REQ-012 | AC-012.1 | T-049 | T-138 |
| REQ-012 | AC-012.2 | T-050 | T-139 |
| REQ-012 | AC-012.3 | T-049, T-050 | T-138, T-139 |
| NFR-001 | AC-N001.1 | T-024, T-032 | T-105, T-106 |
| NFR-001 | AC-N001.2 | T-032 | T-106 |
| NFR-002 | AC-N002.1 | T-042, T-043 | T-132, T-136 |
| NFR-002 | AC-N002.2 | T-043 | T-136 |
