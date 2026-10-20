# Tareas 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-20)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo firmas que lanzan `not implemented` (Art. B5.6 y P1.5 del backend y del frontend). Las constantes, los tipos y la
declaración del modelo no tienen lógica y se escriben completos. No hace falta andamiaje para la ruta HTTP
`/api/foods/search` (la ausencia responde 404, rojo legítimo), para la ruta `/foods` del frontend ni para el script de
importación (no lo prueba ningún test).

- [x] T-001 [REQ-001, REQ-003] (scaffold) Crear `FOOD_DATA_TYPES` y el modelo `Food` con todas sus columnas, el `CHECK ck_foods_data_type`, la columna generada `search_vector` y el índice GIN `ix_foods_search_vector`, y registrarlo para `create_all()` — `backend/models/food.py`, `backend/models/__init__.py`
- [x] T-002 [REQ-001, REQ-006] (scaffold) Crear `FoodRepository` con `__init__(session)` que guarda la sesión y los cinco métodos del plan (`get_by_fdc_ids`, `find_text_matches`, `find_semantic_matches`, `list_missing_embedding`, `count_missing_embedding_by_data_type`) que lancen "not implemented" — `backend/repositories/food_repository.py`
- [x] T-003 [REQ-001, REQ-004] (scaffold) Crear las constantes de `usda_csv_reader`, `UsdaFileError` (guarda `path` y `message`), `UsdaFoodRecord` y `read_usda_dataset(directory, data_type)` que lance "not implemented" — `backend/services/usda_csv_reader.py`
- [x] T-004 [REQ-002, REQ-003, REQ-005] (scaffold) Crear `EMBEDDING_BATCH_SIZE`, `DATA_TYPE_LABELS`, `UsdaSource`, `SourceSummary`, `ImportSummary`, `FoodImportService` (el `__init__` guarda sus dependencias; `run` lanza "not implemented") y `format_summary` que lance "not implemented" — `backend/services/food_import_service.py`
- [x] T-005 [REQ-006, REQ-008, REQ-010, REQ-011] (scaffold) Crear las constantes y mensajes, `normalize_query`, `fuse_rankings` y `FoodSearchService` (el `__init__` guarda sus dependencias; `search` lanza "not implemented") — `backend/services/food_search_service.py`
- [x] T-006 [REQ-012, REQ-013] (scaffold) Crear los tipos del dominio de la feature — `frontend/src/features/foods/types.ts`
- [x] T-007 [REQ-013] (scaffold) Crear las constantes de mensajes y de longitud, `foodSearchFormSchema` como esquema provisional sin reglas (`z.object({ query: z.string() })`), `foodSearchResponseSchema` provisional y `FoodSearchFormValues` — `frontend/src/features/foods/schemas.ts`
- [x] T-008 [REQ-012, REQ-013] (scaffold) Crear `DATA_TYPE_LABELS`, `formatCalories(_value)` y `formatGrams(_value, _label)` que lancen "not implemented", y `SEARCH_FAILED_MESSAGE` y `searchErrorView(_error)` que lance "not implemented" — `frontend/src/features/foods/format.ts`, `frontend/src/features/foods/searchError.ts`
- [x] T-009 [REQ-012, REQ-013] (scaffold) Crear `searchFoods(_query)` y `useFoodSearch()` que lancen "not implemented" — `frontend/src/features/foods/api.ts`, `frontend/src/features/foods/hooks.ts`
- [x] T-010 [REQ-012, REQ-013, REQ-014] (scaffold) Crear `FoodSearchForm(_props)`, `FoodResultList(_props)` y `FoodsPage()` que lancen "not implemented" — `frontend/src/features/foods/components/FoodSearchForm.tsx`, `frontend/src/features/foods/components/FoodResultList.tsx`, `frontend/src/features/foods/pages/FoodsPage.tsx`

## Fase A — Tests (test-author)
Marcadores `# SDD: 021 REQ-… AC-…` (backend) y `// SDD: 021 REQ-… AC-…` (frontend), en la línea anterior a cada test.

- [x] T-020 [REQ-004, AC-004.2] (test) Añadir los dobles `basis_vector`, `vector_with_similarity`, `FakeFoodEmbeddingClient`, `FakeVoyageClient` y `FakeFoodRepository` (a mano, sin `unittest.mock`) — `backend/tests/fakes.py`
- [x] T-021 [REQ-001, AC-001.1] (test) Crear `write_usda_dataset(directory, foods, nutrients, food_columns, nutrient_columns)` que escriba `food.csv` y `food_nutrient.csv` con las cabeceras reales de USDA — `backend/tests/usda_samples.py`
- [x] T-022 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7] (test) La lectura de CSV devuelve tipo, descripción y cuatro valores; aplica la preferencia de energía kcal, Atwater general y Atwater específico; deja `None` en lo ausente, ignora otros nutrientes, no calcula la energía desde los macros y descarta filas como `sample_food` — `backend/tests/test_services/test_usda_csv_reader.py`
- [x] T-023 [REQ-004, AC-004.1, AC-004.2] (test) La lectura falla con `UsdaFileError` que nombra el archivo inexistente y el archivo y la columna obligatoria ausente — `backend/tests/test_services/test_usda_csv_reader.py`
- [x] T-024 [REQ-001, REQ-005, AC-001.1, AC-001.2, AC-001.4, AC-005.1] (test) La importación guarda los alimentos de Foundation y SR Legacy con sus valores y su origen, deja «sin dato» donde falta, y el resumen indica 3 y 2 añadidos y 0 sin representación — `backend/tests/test_services/test_food_import_service.py`
- [x] T-025 [REQ-002, REQ-005, AC-002.1, AC-002.2, AC-002.3, AC-005.2] (test) La reimportación no duplica, actualiza descripción y proteína, conserva los alimentos ausentes del archivo y resume 0 añadidos, 1 actualizado y 2 sin cambios — `backend/tests/test_services/test_food_import_service.py`
- [x] T-026 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) La importación calcula la representación semántica de los alimentos nuevos, no pide ninguna al reimportar lo mismo y la pide solo para el alimento cuya descripción cambió — `backend/tests/test_services/test_food_import_service.py`
- [x] T-027 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) Un error de archivo no modifica la base; un fallo del proveedor deja los alimentos sin representación y el resumen lo indica; la siguiente ejecución completa las pendientes — `backend/tests/test_services/test_food_import_service.py`
- [x] T-028 [REQ-005, AC-005.1, AC-005.2] (test) `format_summary` imprime una línea por fuente en el orden recibido y la línea final cuando falla el proveedor de embeddings — `backend/tests/test_services/test_food_import_service.py`
- [x] T-029 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (test) `normalize_query` y `search` rechazan consulta ausente, vacía, de 1 carácter y de 101 con el mensaje exacto, aceptan 100, y no consumen el límite ni llaman al proveedor — `backend/tests/test_services/test_food_search_service.py`
- [x] T-030 [REQ-010, REQ-011, AC-010.1, AC-011.1, AC-011.2] (test) `search` usa la clave y los valores del límite (30 por 60 s), responde 429 sin llamar al proveedor y traduce el fallo del proveedor a 503 aunque haya coincidencias de texto — `backend/tests/test_services/test_food_search_service.py`
- [x] T-031 [REQ-006, REQ-007, AC-006.3, AC-006.4, AC-007.2] (test) `fuse_rankings` prioriza lo que está en las dos listas, devuelve como máximo 20, desempata por FDC ID y devuelve lista vacía sin candidatos — `backend/tests/test_services/test_food_search_service.py`
- [x] T-032 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.5, AC-006.6] (test) La ruta ordena por relevancia por texto («chicken breast»), encuentra por similitud («pechuga de pollo»), prioriza el doble acierto, ignora mayúsculas y espacios y encuentra alimentos sin representación semántica — `backend/tests/test_routes/test_food_routes.py`
- [x] T-033 [REQ-006, REQ-007, AC-006.4, AC-006.7, AC-006.8, AC-006.9, AC-007.1, AC-007.2] (test) La ruta devuelve 20 resultados como máximo e ignora `limit`, el formato de la sección 6 con `null`, Foundation y SR Legacy por separado, y `results` vacío sin relevantes o sin alimentos — `backend/tests/test_routes/test_food_routes.py`
- [x] T-034 [REQ-008, REQ-009, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-009.1, AC-009.2] (test) La ruta responde 400 con los mensajes exactos sin tocar el contador ni el proveedor y 401 sin token, con token inválido y con token caducado — `backend/tests/test_routes/test_food_routes.py`
- [x] T-035 [REQ-010, REQ-011, AC-010.1, AC-010.2, AC-010.3, AC-011.1, AC-011.2, AC-011.3] (test) La ruta aplica el límite por usuario (29 pasan, la 31 da 429, otro usuario no se ve afectado) y responde 503 con el mensaje exacto ante un fallo del proveedor y 200 al recuperarse — `backend/tests/test_routes/test_food_routes.py`
- [x] T-036 [REQ-002, AC-002.3] (test) Extremo a extremo: un alimento ausente de la reimportación sigue apareciendo en la búsqueda — `backend/tests/test_routes/test_food_routes.py`
- [x] T-037 [REQ-012, AC-012.2, AC-012.3] (test) `formatCalories` y `formatGrams` dan `165 kcal`, `31,0 g proteína`, `0,0 g carbohidratos`, `3,6 g grasa` (de 3,57) y «—» si no hay dato — `frontend/src/features/foods/format.test.ts`
- [x] T-038 [REQ-013, AC-013.1, AC-013.2, AC-013.3] (test) `foodSearchFormSchema` rechaza vacío, solo espacios, 1 y 101 caracteres con el mensaje exacto, acepta 2 y 100 y recorta — `frontend/src/features/foods/schemas.test.ts`
- [x] T-039 [REQ-013, AC-013.4, AC-013.6, AC-013.7] (test) `searchErrorView` da el mensaje del servidor sin «Reintentar» para 429, con «Reintentar» para 503, y el mensaje genérico con «Reintentar» para 500 y errores de red — `frontend/src/features/foods/searchError.test.ts`
- [x] T-040 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5, AC-012.6, AC-012.7] (test) La pantalla muestra el estado inicial, los resultados con origen y valores, «—», busca con botón o Intro, muestra «Buscando…» con el botón desactivado, «No encontramos alimentos para «zzxqv».» y no busca al escribir — `frontend/src/features/foods/pages/FoodsPage.test.tsx`
- [x] T-041 [REQ-013, AC-013.1, AC-013.2, AC-013.3, AC-013.4, AC-013.5, AC-013.6, AC-013.7] (test) La pantalla avisa de consulta inválida sin petición, limita a 100 caracteres, muestra los errores 429, 503 y genérico, conserva el texto y «Reintentar» repite la misma consulta — `frontend/src/features/foods/pages/FoodsPage.test.tsx`
- [x] T-042 [REQ-014, NFR-002, AC-014.1, AC-N002.1, AC-N002.2] (test) La atribución se ve con y sin resultados, existe el campo de búsqueda con nombre «Buscar alimento» y «Buscando…», sin resultados y error están en la región `role="status"` — `frontend/src/features/foods/pages/FoodsPage.test.tsx`
- [x] T-043 [REQ-012, NFR-001, AC-N001.1] (test) `/foods` muestra «Cargando…» y luego el `h1` «Alimentos» dentro de la navegación, `router.tsx` usa `lazyNamed` sin import estático de `FoodsPage` y `/home` no evalúa el módulo de la pantalla — `frontend/src/app/foodsRoute.test.tsx`
- [x] T-044 [REQ-012, AC-012.8] (test) `Navbar` y `BottomTabBar` no tienen enlace «Alimentos» ni `href="/foods"` — `frontend/src/components/layout/noFoodsLink.test.tsx`
- [ ] T-045 [REQ-001, AC-001.8, AC-001.9, AC-001.10, AC-001.11, AC-001.12] (test) Reetiquetar los marcadores de los tests de confirmación del script de importación (host no local sin `--yes`, respuesta «n», `--yes`, hosts locales y host desconocido) de `# SDD: 021 REQ-001` a `# SDD: 021 REQ-001 AC-001.8` … `AC-001.12` según corresponda, y quitar el comentario de «sin AC propio», sin cambiar la lógica de los tests — `backend/tests/test_scripts/test_import_usda_foods_script.py`
- [ ] T-046 [REQ-006, AC-006.10] (test) Reetiquetar el marcador del test de ordenación por longitud de descripción («Bananas, raw» frente a descripciones largas) de `# SDD: 021 REQ-006 AC-006.1` a `# SDD: 021 REQ-006 AC-006.10`, sin cambiar la lógica de los tests — `backend/tests/test_services/test_food_text_ranking.py`

## Fase B — Implementación (implementer)
Cada tarea impl se cumple cuando pasan los tests que cubren sus mismos AC.

- [x] T-050 [REQ-001, REQ-003, REQ-006] (migration) Generar con `FLASK_ENV=development flask db migrate` y revisar a mano `c8e2a4f6b9d3_create_foods_table` (`down_revision = "e5b7d9f1a3c6"`): tabla `public.foods`, `Computed` de `search_vector`, `CHECK`, índice GIN y downgrade; no aplicarla en producción — `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py`
- [x] T-051 [REQ-001, REQ-003, REQ-006, REQ-007] (impl) Implementar `FoodRepository`: lectura por FDC ID con `defer(embedding)`, candidatos por texto con `websearch_to_tsquery` y `ts_rank_cd` normalizado por longitud (AC-006.10), candidatos por distancia coseno con umbral, pendientes y recuento por origen — `backend/repositories/food_repository.py`
- [x] T-052 [REQ-001, REQ-004] (impl) Implementar `read_usda_dataset`: validar archivos y columnas, filtrar por tipo de USDA, leer solo los seis nutrientes y aplicar la preferencia de energía, con los mensajes exactos de `UsdaFileError` — `backend/services/usda_csv_reader.py`
- [x] T-053 [REQ-002, REQ-003, REQ-004, REQ-005] (impl) Implementar `FoodImportService.run` en dos fases (validación previa, alta y actualización en una transacción, vectores por lotes con parada y reanudación) y `format_summary` — `backend/services/food_import_service.py`
- [x] T-054 [REQ-005] (impl) Crear el script `main(argv)` con `--foundation` y `--sr-legacy` (al menos uno), que imprima el entorno y la base sin contraseña, ejecute el servicio, imprima el resumen y devuelva 0 o 1 ante `UsdaFileError`, con confirmación previa si el host de la base no es local y sin `--yes` (AC-001.8 a AC-001.12), sin lógica de negocio propia — `backend/scripts/import_usda_foods.py`
- [x] T-055 [REQ-006, REQ-007, REQ-008, REQ-010, REQ-011] (impl) Implementar `normalize_query`, `fuse_rankings` (RRF) y `FoodSearchService.search` (validación, límite, vector de la consulta, 503, fusión y orden) — `backend/services/food_search_service.py`
- [x] T-056 [REQ-006, REQ-009] (impl) Crear `food_bp`, `_build_food_search_service()`, `food_to_json` y `GET /api/foods/search` con `@require_auth`, y registrar el blueprint — `backend/routes/food_routes.py`, `backend/routes/__init__.py`
- [x] T-057 [REQ-013] (impl) Implementar `foodSearchFormSchema` (trim, mínimo 1 y 2, máximo 100) y `foodSearchResponseSchema` — `frontend/src/features/foods/schemas.ts`
- [x] T-058 [REQ-012, REQ-013] (impl) Implementar `formatCalories`, `formatGrams` (`Intl.NumberFormat("es-ES")`) y `searchErrorView` — `frontend/src/features/foods/format.ts`, `frontend/src/features/foods/searchError.ts`
- [x] T-059 [REQ-012, REQ-013] (impl) Implementar `searchFoods` con `apiFetch` y validación zod, y `useFoodSearch` como mutación sin reintentos — `frontend/src/features/foods/api.ts`, `frontend/src/features/foods/hooks.ts`
- [x] T-060 [REQ-012, REQ-013, NFR-002] (impl) Implementar `FoodSearchForm` (react-hook-form con zod, `Input type="search"` con etiqueta «Buscar alimento», `maxLength` 100, botón «Buscar» desactivado mientras busca) y `FoodResultList` — `frontend/src/features/foods/components/FoodSearchForm.tsx`, `frontend/src/features/foods/components/FoodResultList.tsx`
- [x] T-061 [REQ-012, REQ-013, REQ-014, NFR-002] (impl) Implementar `FoodsPage`: título, formulario, región `role="status"` con los estados inicial, «Buscando…», vacío y error con «Reintentar», lista de resultados y atribución a USDA — `frontend/src/features/foods/pages/FoodsPage.tsx`
- [x] T-062 [REQ-012, NFR-001] (impl) Añadir la ruta `/foods` con `lazyNamed` y `RouteSuspense` dentro de `AppLayout`, sin import estático y sin tocar `Navbar` ni `BottomTabBar` — `frontend/src/app/router.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-022, T-024 | T-050, T-052, T-053 |
| REQ-001 | AC-001.2 | T-022, T-024 | T-050, T-052, T-053 |
| REQ-001 | AC-001.3 | T-022 | T-052 |
| REQ-001 | AC-001.4 | T-022, T-024 | T-052, T-053 |
| REQ-001 | AC-001.5 | T-022 | T-052 |
| REQ-001 | AC-001.6 | T-022 | T-052 |
| REQ-001 | AC-001.7 | T-022 | T-052 |
| REQ-001 | AC-001.8 | T-045 | T-054 |
| REQ-001 | AC-001.9 | T-045 | T-054 |
| REQ-001 | AC-001.10 | T-045 | T-054 |
| REQ-001 | AC-001.11 | T-045 | T-054 |
| REQ-001 | AC-001.12 | T-045 | T-054 |
| REQ-002 | AC-002.1 | T-025 | T-053 |
| REQ-002 | AC-002.2 | T-025 | T-053 |
| REQ-002 | AC-002.3 | T-025, T-036 | T-053, T-055 |
| REQ-003 | AC-003.1 | T-026 | T-051, T-053 |
| REQ-003 | AC-003.2 | T-026 | T-053 |
| REQ-003 | AC-003.3 | T-026 | T-053 |
| REQ-004 | AC-004.1 | T-023, T-027 | T-052, T-053 |
| REQ-004 | AC-004.2 | T-023, T-027 | T-052, T-053 |
| REQ-004 | AC-004.3 | T-027 | T-053 |
| REQ-004 | AC-004.4 | T-027 | T-053 |
| REQ-005 | AC-005.1 | T-024, T-028 | T-053, T-054 |
| REQ-005 | AC-005.2 | T-025, T-028 | T-053, T-054 |
| REQ-006 | AC-006.1 | T-032 | T-051, T-055, T-056 |
| REQ-006 | AC-006.2 | T-032 | T-051, T-055, T-056 |
| REQ-006 | AC-006.3 | T-031, T-032 | T-055 |
| REQ-006 | AC-006.4 | T-031, T-033 | T-055, T-056 |
| REQ-006 | AC-006.5 | T-032 | T-051, T-055 |
| REQ-006 | AC-006.6 | T-032 | T-051, T-055 |
| REQ-006 | AC-006.7 | T-033 | T-056 |
| REQ-006 | AC-006.8 | T-033 | T-055, T-056 |
| REQ-006 | AC-006.9 | T-033 | T-051, T-056 |
| REQ-006 | AC-006.10 | T-046 | T-051 |
| REQ-007 | AC-007.1 | T-033 | T-051, T-055 |
| REQ-007 | AC-007.2 | T-031, T-033 | T-055, T-056 |
| REQ-008 | AC-008.1 | T-029, T-034 | T-055, T-056 |
| REQ-008 | AC-008.2 | T-029, T-034 | T-055, T-056 |
| REQ-008 | AC-008.3 | T-029, T-034 | T-055, T-056 |
| REQ-008 | AC-008.4 | T-029, T-034 | T-055 |
| REQ-009 | AC-009.1 | T-034 | T-056 |
| REQ-009 | AC-009.2 | T-034 | T-056 |
| REQ-010 | AC-010.1 | T-030, T-035 | T-055 |
| REQ-010 | AC-010.2 | T-035 | T-055 |
| REQ-010 | AC-010.3 | T-035 | T-055 |
| REQ-011 | AC-011.1 | T-030, T-035 | T-055, T-056 |
| REQ-011 | AC-011.2 | T-030, T-035 | T-055, T-056 |
| REQ-011 | AC-011.3 | T-035 | T-055 |
| REQ-012 | AC-012.1 | T-040 | T-061, T-062 |
| REQ-012 | AC-012.2 | T-037, T-040 | T-058, T-060, T-061 |
| REQ-012 | AC-012.3 | T-037, T-040 | T-058, T-060 |
| REQ-012 | AC-012.4 | T-040 | T-060, T-061 |
| REQ-012 | AC-012.5 | T-040 | T-060, T-061 |
| REQ-012 | AC-012.6 | T-040 | T-061 |
| REQ-012 | AC-012.7 | T-040 | T-060, T-061 |
| REQ-012 | AC-012.8 | T-044 | T-062 |
| REQ-013 | AC-013.1 | T-038, T-041 | T-057, T-060 |
| REQ-013 | AC-013.2 | T-038, T-041 | T-057, T-060 |
| REQ-013 | AC-013.3 | T-038, T-041 | T-057, T-060 |
| REQ-013 | AC-013.4 | T-039, T-041 | T-058, T-061 |
| REQ-013 | AC-013.5 | T-041 | T-061 |
| REQ-013 | AC-013.6 | T-039, T-041 | T-058, T-061 |
| REQ-013 | AC-013.7 | T-039, T-041 | T-058, T-061 |
| REQ-014 | AC-014.1 | T-042 | T-061 |
| NFR-001 | AC-N001.1 | T-043 | T-062 |
| NFR-002 | AC-N002.1 | T-042 | T-060 |
| NFR-002 | AC-N002.2 | T-042 | T-061 |
