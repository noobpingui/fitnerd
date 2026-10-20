# Tareas 022 — Diario de comidas con totales del día frente al objetivo de Macros

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-20)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold (implementer, modo scaffold) → test (test-author) → impl y migration (implementer).
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Backend: `Meal` y `MealItem` son declaraciones de datos (columnas y restricciones del plan, sin lógica), no se pueden
reducir a un cuerpo que lance error; el resto son firmas del plan con cuerpo `raise NotImplementedError("not implemented")`.
Frontend: firmas con `throw new Error("not implemented")` y parámetros con prefijo `_`; los esquemas zod de
`schemas.ts` se declaran como `z.custom<T>(() => { throw new Error("not implemented") })`. Las rutas HTTP, los
componentes internos del diálogo, los hooks y los cambios en archivos existentes no necesitan esqueleto (su ausencia ya es rojo legítimo).

- [x] T-001 [REQ-001, REQ-002, REQ-008] (scaffold) Crear los modelos `Meal`, `MealItem` y las constantes `MEAL_TYPES` y `MEAL_ITEM_SOURCES` con las columnas, restricciones (`CHECK`, única, índice, FK con `ON DELETE CASCADE`) y relación ORM de la sección 3.1, y registrarlos en `models/__init__.py` — `backend/models/meal.py`, `backend/models/__init__.py`
- [x] T-002 [REQ-003, REQ-004] (scaffold) Crear `meal_rules.py` con los mensajes, constantes, `UsdaItemInput`, `CustomItemInput` y las firmas de `parse_meal_date`, `check_add_window`, `parse_meal_type`, `validate_grams`, `parse_items`, `portion_nutrients`, `sum_nutrients` e `is_db_id` — `backend/services/meal_rules.py`
- [x] T-003 [REQ-005, REQ-009] (scaffold) Crear `MealRepository(BaseRepository)` con `__init__` que guarda la sesión y las firmas de `list_by_user_and_date`, `get_by_user_date_and_type` y `get_by_id_and_user` — `backend/repositories/meal_repository.py`
- [x] T-004 [REQ-001, REQ-005, REQ-006, REQ-007] (scaffold) Crear `MealSummary`, `DiarySummary`, `AddItemsResult` y `MealService` con `__init__` que solo guarda sus dependencias y las firmas de `get_diary`, `add_items`, `update_item_grams`, `remove_item` y `delete_meal` — `backend/services/meal_service.py`
- [x] T-005 [REQ-010] (scaffold) Crear los tipos de la feature `diary` (`MealType`, `NutrientKey`, `Nutrients`, `NutrientTotals`, `MealItem`, `Meal`, `Diary`, payloads) — `frontend/src/features/diary/types.ts`
- [x] T-006 [REQ-011, REQ-014] (scaffold) Crear `portionNutrients`, `nutrientProgress` y el tipo `NutrientProgressView` — `frontend/src/features/diary/nutrition.ts`
- [x] T-007 [REQ-010, REQ-011] (scaffold) Crear `formatDiaryDate`, `formatKcal`, `formatNutrientGrams`, `formatLoggedGrams`, `formatPortionPreview` y `sourceLabel` — `frontend/src/features/diary/format.ts`
- [x] T-008 [REQ-011, REQ-012] (scaffold) Crear los mensajes de validación, `CUSTOM_NAME_MAX_LENGTH`, `parseDecimalText`, `gramsFormSchema`, `customFoodFormSchema`, `customItemPayload`, `diaryResponseSchema` y `mealResponseSchema` — `frontend/src/features/diary/schemas.ts`
- [x] T-009 [REQ-011, REQ-013] (scaffold) Crear `SAVE_FAILED_MESSAGE`, `REMOVE_FAILED_MESSAGE` y `saveErrorMessage` — `frontend/src/features/diary/errors.ts`
- [x] T-010 [REQ-010, REQ-011, REQ-013] (scaffold) Crear `getDiary`, `addMealItems`, `updateMealItemGrams` y `removeMealItem` — `frontend/src/features/diary/api.ts`
- [x] T-011 [REQ-010] (scaffold) Crear `DiaryPage` con su firma — `frontend/src/features/diary/pages/DiaryPage.tsx`
- [x] T-012 [REQ-011, REQ-012] (scaffold) Crear `AddFoodDialog` con su firma de props — `frontend/src/features/diary/components/AddFoodDialog.tsx`
- [x] T-013 [REQ-013] (scaffold) Crear `EditGramsDialog` con su firma de props — `frontend/src/features/diary/components/EditGramsDialog.tsx`

## Fase A — Tests (test-author)
Marcador `# SDD: 022 REQ-… AC-…` / `// SDD: 022 REQ-… AC-…` en la línea anterior a cada test (Art. P1.1).

- [x] T-020 [REQ-001, REQ-005, REQ-009] (test) Añadir `FakeMealRepository` (instancias reales de `Meal`, `create` con id creciente, `delete`, filtrado por usuario, `created`/`deleted`) y la utilidad `make_food` — `backend/tests/fakes.py`
- [x] T-021 [REQ-003, REQ-004, REQ-005, AC-003.2, AC-004.1, AC-004.2, AC-004.3, AC-005.6] (test) Reglas de fecha, ventana de ±1 día y tipo de comida — `backend/tests/test_services/test_meal_rules.py`
- [x] T-022 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-003.3, AC-003.4, AC-003.5, AC-003.7, AC-003.8, AC-003.9, AC-003.10, AC-003.11, AC-003.12, AC-003.13] (test) Reglas de gramos y de `parse_items` (límites, mensajes, `strip()`, mezcla USDA/personalizado) — `backend/tests/test_services/test_meal_rules.py`
- [x] T-023 [REQ-001, REQ-002, REQ-005, REQ-006, AC-001.1, AC-001.4, AC-002.1, AC-002.3, AC-005.2, AC-005.3, AC-005.4, AC-006.1, AC-006.2] (test) `portion_nutrients` (5,355 a 5,36, `None`, 0) y `sum_nutrients` — `backend/tests/test_services/test_meal_rules.py`
- [x] T-024 [REQ-001, REQ-003, REQ-004, AC-001.1, AC-001.2, AC-001.3, AC-001.5, AC-001.6, AC-003.6, AC-003.13, AC-003.14, AC-004.1, AC-004.2] (test) `MealService.add_items` con dobles: creación, reutilización, copia de datos, atomicidad con rollback, tope de 50, ventana con `FakeClock` y bloqueo del usuario — `backend/tests/test_services/test_meal_service.py`
- [x] T-025 [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, AC-005.1, AC-005.7, AC-006.1, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.2, AC-008.2, AC-009.3, AC-009.4, AC-009.5] (test) `get_diary`, `update_item_grams`, `remove_item` y `delete_meal` con dobles: orden, fechas antiguas, recálculo con la copia, 404 y bloqueo del usuario — `backend/tests/test_services/test_meal_service.py`
- [x] T-026 [REQ-001, REQ-002, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-002.1, AC-002.2, AC-002.3] (test) `POST /api/meals` de extremo a extremo con la forma completa de la respuesta (201/200) — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-027 [REQ-003, REQ-004, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6, AC-003.7, AC-003.8, AC-003.9, AC-003.10, AC-003.11, AC-003.12, AC-003.13, AC-003.14, AC-004.1, AC-004.2, AC-004.3] (test) Validación de `POST /api/meals` (un caso por mensaje, atomicidad y fechas con el reloj fijado) — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-028 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-005.6, AC-005.7, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5] (test) `GET /api/meals` y `PATCH /api/meals/{id}/items/{id}` — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-029 [REQ-007, REQ-008, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-008.1, AC-008.2, AC-008.3] (test) `DELETE` de alimento y de comida, y estabilidad del historial ante cambios y borrado en `foods` — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-030 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6] (test) 401 en los cinco endpoints y aislamiento entre usuarios (404 sin revelar existencia) — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-031 [REQ-010, REQ-014] (test) Fábricas `makeMealItem`, `makeCustomItem`, `makeMeal` y `makeDiary` — `frontend/src/test/diaryFixtures.ts`
- [x] T-032 [REQ-011, REQ-012, REQ-014, AC-011.2, AC-011.3, AC-011.7, AC-012.3, AC-014.1, AC-014.2, AC-014.5] (test) `portionNutrients` (redondeo, `null`) y `nutrientProgress` (quedan, por encima, vacío) — `frontend/src/features/diary/nutrition.test.ts`
- [x] T-033 [REQ-010, REQ-011, AC-010.1, AC-010.6, AC-011.7] (test) `formatDiaryDate`, `formatKcal`, `formatLoggedGrams`, `formatPortionPreview` con «—» y `sourceLabel` — `frontend/src/features/diary/format.test.ts`
- [x] T-034 [REQ-011, REQ-012, AC-011.5, AC-012.2, AC-012.4] (test) `parseDecimalText`, `gramsFormSchema`, `customFoodFormSchema` y `customItemPayload` — `frontend/src/features/diary/schemas.test.ts`
- [x] T-035 [REQ-011, REQ-013, AC-011.6, AC-013.5] (test) `saveErrorMessage` con un 400 y con otros errores — `frontend/src/features/diary/errors.test.ts`
- [x] T-036 [REQ-010, NFR-002, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5, AC-010.6, AC-N002.3] (test) Pantalla «Diario»: contenido, fecha local pedida, vacío, carga, error con «Reintentar», origen del alimento y regiones anunciadas — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-037 [REQ-014, NFR-002, AC-014.1, AC-014.2, AC-014.3, AC-014.4, AC-014.5, AC-014.6, AC-N002.2] (test) Totales frente al objetivo de Macros (mismo perfil que Macros), aviso de total incompleto y barras por rol — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-038 [REQ-011, REQ-012, REQ-013, REQ-014, AC-011.4, AC-012.2, AC-013.2, AC-013.4, AC-013.5, AC-013.6, AC-014.6] (test) Relectura del diario tras añadir, editar y quitar; fallo al quitar; nombres accesibles «Editar/Quitar {nombre}» — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-039 [REQ-011, NFR-002, AC-011.1, AC-011.2, AC-011.3, AC-011.4, AC-011.5, AC-011.6, AC-011.7, AC-011.8, AC-011.9, AC-011.10, AC-N002.1] (test) Diálogo «Añadir a {sección}»: búsqueda, gramos, vista previa, payload, validaciones, errores, cancelar, volver sin repetir y «Guardando…» — `frontend/src/features/diary/components/AddFoodDialog.test.tsx`
- [x] T-040 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5, AC-012.6] (test) Alimento personalizado: campos, envío, vista previa, validaciones, `maxLength` y botón junto a «No encontramos…» con el nombre relleno — `frontend/src/features/diary/components/AddFoodDialog.test.tsx`
- [x] T-041 [REQ-013, AC-013.1, AC-013.2, AC-013.3, AC-013.5] (test) Diálogo «Editar gramos»: valores guardados, guardado, validación y error — `frontend/src/features/diary/components/EditGramsDialog.test.tsx`
- [x] T-042 [REQ-015, AC-015.1, AC-015.3] (test) Actualizar la lista de la barra de escritorio (Diario, Macros, Métricas, Coach, Tienda), enlace a `/diary` y estado activo — `frontend/src/components/layout/Navbar.test.tsx`
- [x] T-043 [REQ-015, AC-015.2, AC-015.3] (test) Actualizar la lista de la barra inferior (Inicio, Diario, Macros, Métricas, Coach, Tienda), enlace a `/diary` y estado activo — `frontend/src/components/layout/BottomTabBar.test.tsx`
- [x] T-044 [REQ-015, NFR-001, AC-015.4, AC-N001.1] (test) `/foods` sigue mostrando «Alimentos»; `/diary` carga bajo demanda con «Cargando…» y `router.tsx` usa `lazyNamed` e import dinámico — `frontend/src/app/diaryRoute.test.tsx`
- [x] T-045 [REQ-016, AC-016.1] (test) Sección «Datos nutricionales» con la atribución a USDA y el aviso de valores aproximados — `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`
- [x] T-046 [REQ-016, AC-016.2] (test) Punto «Diario de comidas:» y mención de las búsquedas de alimentos en Voyage AI — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

## Fase B — Implementación (implementer)
- [x] T-050 [REQ-001, REQ-008, REQ-009] (migration) Migración aditiva `b3d5f7a9c1e4` (`down_revision = "c8e2a4f6b9d3"`) que crea `meals` y `meal_items` con CHECK, única, índice y `ON DELETE CASCADE` idénticos a los modelos; revisada a mano — `backend/migrations/versions/b3d5f7a9c1e4_create_meals_and_meal_items_tables.py`
- [x] T-051 [REQ-003, REQ-004, REQ-005, REQ-006, AC-003.2, AC-003.4, AC-003.5, AC-004.1, AC-004.2, AC-004.3, AC-005.6] (impl) Implementar `parse_meal_date`, `check_add_window`, `parse_meal_type`, `validate_grams` e `is_db_id` — `backend/services/meal_rules.py`
- [x] T-052 [REQ-001, REQ-002, REQ-003, AC-002.1, AC-002.2, AC-003.3, AC-003.7, AC-003.8, AC-003.9, AC-003.10, AC-003.11, AC-003.12, AC-003.13] (impl) Implementar `parse_items` con el orden de validación del plan — `backend/services/meal_rules.py`
- [x] T-053 [REQ-001, REQ-002, REQ-005, REQ-006, AC-001.1, AC-001.4, AC-002.3, AC-005.2, AC-005.3, AC-005.4, AC-006.1, AC-006.2] (impl) Implementar `portion_nutrients` (Decimal, `ROUND_HALF_UP`, `repr`) y `sum_nutrients` — `backend/services/meal_rules.py`
- [x] T-054 [REQ-005, REQ-009, AC-001.2, AC-001.3, AC-005.1, AC-005.5, AC-009.2, AC-009.3, AC-009.6] (impl) Implementar `MealRepository` (consultas por usuario, fecha y tipo, `selectinload`, filtro por usuario en la misma consulta) — `backend/repositories/meal_repository.py`
- [x] T-055 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-008, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-002.3, AC-003.1, AC-003.2, AC-003.6, AC-003.13, AC-003.14, AC-004.1, AC-004.2, AC-004.3, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-005.6, AC-005.7, AC-007.4, AC-008.1, AC-008.3, AC-009.2, AC-009.6] (impl) Implementar `MealService.get_diary` y `add_items` (validar antes de escribir, bloqueo del usuario, copia de datos, un solo commit, rollback) — `backend/services/meal_service.py`
- [x] T-056 [REQ-006, REQ-007, REQ-008, REQ-009, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-008.2, AC-009.3, AC-009.4, AC-009.5] (impl) Implementar `update_item_grams`, `remove_item` y `delete_meal` (404 antes que 400, recálculo con la copia, sin ventana de fecha) — `backend/services/meal_service.py`
- [x] T-057 [REQ-001, REQ-005, REQ-006, REQ-007, REQ-009, AC-001.1, AC-001.6, AC-003.1, AC-005.1, AC-006.1, AC-006.4, AC-007.1, AC-007.3, AC-009.1] (impl) Crear `meal_bp` (`/api/meals`, `@require_auth`, `_build_meal_service()`, serialización a `float`/`null`, 201/200/204) y registrarlo — `backend/routes/meal_routes.py`, `backend/routes/__init__.py`
- [x] T-060 [REQ-011, REQ-012, REQ-014, AC-011.2, AC-011.3, AC-011.7, AC-012.3, AC-014.1, AC-014.2, AC-014.5] (impl) Implementar `portionNutrients` (`toPrecision(12)` y redondeo con mitades hacia arriba) y `nutrientProgress` — `frontend/src/features/diary/nutrition.ts`
- [x] T-061 [REQ-010, REQ-011, AC-010.1, AC-010.6, AC-011.2, AC-011.7] (impl) Implementar las funciones de formato `es-ES` — `frontend/src/features/diary/format.ts`
- [x] T-062 [REQ-010, REQ-011, REQ-013, AC-011.6, AC-013.5] (impl) Implementar `saveErrorMessage` y crear `MEAL_SECTIONS` y `NUTRIENT_LABELS` — `frontend/src/features/diary/errors.ts`, `frontend/src/features/diary/constants.ts`
- [x] T-063 [REQ-011, REQ-012, REQ-013, AC-011.5, AC-012.2, AC-012.4, AC-013.3] (impl) Implementar `parseDecimalText`, `gramsFormSchema`, `customFoodFormSchema` y `customItemPayload` con los mensajes del backend — `frontend/src/features/diary/schemas.ts`
- [x] T-064 [REQ-010, REQ-011, REQ-013, AC-010.2, AC-011.4, AC-013.2] (impl) Implementar los esquemas de respuesta de `schemas.ts` y las llamadas de `api.ts` con `apiFetch` — `frontend/src/features/diary/schemas.ts`, `frontend/src/features/diary/api.ts`
- [x] T-065 [REQ-010, REQ-011, REQ-013, REQ-014, AC-010.2, AC-010.4, AC-010.5, AC-011.4, AC-013.2, AC-013.4, AC-014.6] (impl) Crear `diaryKeys`, `useDiary` y las tres mutaciones que invalidan el día — `frontend/src/features/diary/hooks.ts`
- [x] T-066 [REQ-014, NFR-002, AC-014.1, AC-014.2, AC-014.4, AC-014.5, AC-010.1, AC-N002.2] (impl) Crear `NutrientProgress` (`role="progressbar"` con nombre) y `DailyTotals` — `frontend/src/features/diary/components/NutrientProgress.tsx`, `frontend/src/features/diary/components/DailyTotals.tsx`
- [x] T-067 [REQ-010, REQ-013, AC-010.1, AC-010.3, AC-010.6, AC-013.4, AC-013.5, AC-013.6] (impl) Crear `MealItemRow` y `MealSection` (subtotal, «Sin alimentos.», «Quitar» sin confirmar y error en `role="alert"`) — `frontend/src/features/diary/components/MealItemRow.tsx`, `frontend/src/features/diary/components/MealSection.tsx`
- [x] T-068 [REQ-010, REQ-014, NFR-002, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5, AC-014.3, AC-014.6, AC-N002.3] (impl) Implementar `DiaryPage` (fecha local, objetivos con `calculateMacros`, estados en región anunciada) — `frontend/src/features/diary/pages/DiaryPage.tsx`
- [x] T-069 [REQ-011, REQ-012, AC-011.2, AC-011.9, AC-012.6] (impl) Añadir la prop opcional `onSelect` (botón «Elegir {descripción}») y `defaultQuery`, sin cambiar `/foods` — `frontend/src/features/foods/components/FoodResultList.tsx`, `frontend/src/features/foods/components/FoodSearchForm.tsx`
- [x] T-070 [REQ-011, REQ-013, AC-011.2, AC-011.3, AC-011.5, AC-011.7, AC-011.10] (impl) Crear `PortionForm` (react-hook-form + zod, vista previa sin peticiones, «Guardando…») — `frontend/src/features/diary/components/PortionForm.tsx`
- [x] T-071 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5] (impl) Crear `CustomFoodForm` (seis campos, `maxLength` 100, vista previa, error de suma junto a grasa) — `frontend/src/features/diary/components/CustomFoodForm.tsx`
- [x] T-072 [REQ-011, REQ-012, NFR-002, AC-011.1, AC-011.2, AC-011.4, AC-011.6, AC-011.8, AC-011.9, AC-012.1, AC-012.2, AC-012.6, AC-N002.1, AC-N002.3] (impl) Implementar `AddFoodDialog` con los pasos búsqueda, porción y personalizado — `frontend/src/features/diary/components/AddFoodDialog.tsx`
- [x] T-073 [REQ-013, AC-013.1, AC-013.2, AC-013.3, AC-013.5] (impl) Implementar `EditGramsDialog` — `frontend/src/features/diary/components/EditGramsDialog.tsx`
- [x] T-074 [REQ-015, AC-015.1, AC-015.2, AC-015.3] (impl) Añadir «Diario» (`/diary`, icono `BookOpen` en móvil) a las dos barras — `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/layout/BottomTabBar.tsx`
- [x] T-075 [REQ-015, NFR-001, AC-015.4, AC-N001.1] (impl) Añadir la ruta `/diary` con `lazyNamed` y `RouteSuspense` — `frontend/src/app/router.tsx`
- [x] T-076 [REQ-016, AC-016.1, AC-016.2] (impl) Añadir la sección «Datos nutricionales», el punto «Diario de comidas:», la mención a Voyage AI y la fecha «20 de octubre de 2026» — `frontend/src/features/legal/pages/TermsOfServicePage.tsx`, `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-023, T-024, T-026 | T-053, T-055, T-057 |
| REQ-001 | AC-001.2 | T-024, T-026 | T-054, T-055 |
| REQ-001 | AC-001.3 | T-024, T-026 | T-054, T-055 |
| REQ-001 | AC-001.4 | T-023, T-026 | T-053, T-055 |
| REQ-001 | AC-001.5 | T-024, T-026 | T-055 |
| REQ-001 | AC-001.6 | T-024, T-026 | T-055, T-057 |
| REQ-002 | AC-002.1 | T-022, T-023, T-026 | T-052, T-053 |
| REQ-002 | AC-002.2 | T-022, T-026 | T-052 |
| REQ-002 | AC-002.3 | T-023, T-026 | T-053, T-055 |
| REQ-003 | AC-003.1 | T-027 | T-055, T-057 |
| REQ-003 | AC-003.2 | T-021, T-027 | T-051, T-055 |
| REQ-003 | AC-003.3 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.4 | T-022, T-027 | T-051 |
| REQ-003 | AC-003.5 | T-022, T-027 | T-051 |
| REQ-003 | AC-003.6 | T-024, T-027 | T-055 |
| REQ-003 | AC-003.7 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.8 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.9 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.10 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.11 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.12 | T-022, T-027 | T-052 |
| REQ-003 | AC-003.13 | T-022, T-024, T-027 | T-052, T-055 |
| REQ-003 | AC-003.14 | T-024, T-027 | T-055 |
| REQ-004 | AC-004.1 | T-021, T-024, T-027 | T-051, T-055 |
| REQ-004 | AC-004.2 | T-021, T-024, T-027 | T-051, T-055 |
| REQ-004 | AC-004.3 | T-021, T-027 | T-051, T-055 |
| REQ-005 | AC-005.1 | T-025, T-028 | T-054, T-055, T-057 |
| REQ-005 | AC-005.2 | T-023, T-028 | T-053, T-055 |
| REQ-005 | AC-005.3 | T-023, T-028 | T-053, T-055 |
| REQ-005 | AC-005.4 | T-023, T-028 | T-053, T-055 |
| REQ-005 | AC-005.5 | T-028 | T-054, T-055 |
| REQ-005 | AC-005.6 | T-021, T-028 | T-051, T-055 |
| REQ-005 | AC-005.7 | T-025, T-028 | T-055 |
| REQ-006 | AC-006.1 | T-023, T-025, T-028 | T-053, T-056, T-057 |
| REQ-006 | AC-006.2 | T-023, T-028 | T-053, T-056 |
| REQ-006 | AC-006.3 | T-025, T-028 | T-056 |
| REQ-006 | AC-006.4 | T-025, T-028 | T-056, T-057 |
| REQ-006 | AC-006.5 | T-025, T-028 | T-056 |
| REQ-007 | AC-007.1 | T-025, T-029 | T-056, T-057 |
| REQ-007 | AC-007.2 | T-025, T-029 | T-056 |
| REQ-007 | AC-007.3 | T-029 | T-056, T-057 |
| REQ-007 | AC-007.4 | T-029 | T-055, T-056 |
| REQ-007 | AC-007.5 | T-029 | T-056 |
| REQ-008 | AC-008.1 | T-029 | T-050, T-055 |
| REQ-008 | AC-008.2 | T-025, T-029 | T-056 |
| REQ-008 | AC-008.3 | T-029 | T-050, T-055 |
| REQ-009 | AC-009.1 | T-030 | T-057 |
| REQ-009 | AC-009.2 | T-030 | T-054, T-055 |
| REQ-009 | AC-009.3 | T-025, T-030 | T-054, T-056 |
| REQ-009 | AC-009.4 | T-025, T-030 | T-056 |
| REQ-009 | AC-009.5 | T-025, T-030 | T-056 |
| REQ-009 | AC-009.6 | T-030 | T-054, T-055 |
| REQ-010 | AC-010.1 | T-033, T-036 | T-061, T-066, T-067, T-068 |
| REQ-010 | AC-010.2 | T-036 | T-064, T-065, T-068 |
| REQ-010 | AC-010.3 | T-036 | T-067, T-068 |
| REQ-010 | AC-010.4 | T-036 | T-065, T-068 |
| REQ-010 | AC-010.5 | T-036 | T-065, T-068 |
| REQ-010 | AC-010.6 | T-033, T-036 | T-061, T-067 |
| REQ-011 | AC-011.1 | T-039 | T-072 |
| REQ-011 | AC-011.2 | T-032, T-039 | T-060, T-061, T-069, T-070 |
| REQ-011 | AC-011.3 | T-032, T-039 | T-060, T-070 |
| REQ-011 | AC-011.4 | T-038, T-039 | T-064, T-065, T-072 |
| REQ-011 | AC-011.5 | T-034, T-039 | T-063, T-070 |
| REQ-011 | AC-011.6 | T-035, T-039 | T-062, T-072 |
| REQ-011 | AC-011.7 | T-032, T-033, T-039 | T-060, T-061, T-070 |
| REQ-011 | AC-011.8 | T-039 | T-072 |
| REQ-011 | AC-011.9 | T-039 | T-069, T-072 |
| REQ-011 | AC-011.10 | T-039 | T-070 |
| REQ-012 | AC-012.1 | T-040 | T-071, T-072 |
| REQ-012 | AC-012.2 | T-034, T-038, T-040 | T-063, T-071, T-072 |
| REQ-012 | AC-012.3 | T-032, T-040 | T-060, T-071 |
| REQ-012 | AC-012.4 | T-034, T-040 | T-063, T-071 |
| REQ-012 | AC-012.5 | T-040 | T-071 |
| REQ-012 | AC-012.6 | T-040 | T-069, T-072 |
| REQ-013 | AC-013.1 | T-041 | T-073 |
| REQ-013 | AC-013.2 | T-038, T-041 | T-064, T-065, T-073 |
| REQ-013 | AC-013.3 | T-041 | T-063, T-073 |
| REQ-013 | AC-013.4 | T-038 | T-065, T-067 |
| REQ-013 | AC-013.5 | T-035, T-038, T-041 | T-062, T-067, T-073 |
| REQ-013 | AC-013.6 | T-038 | T-067 |
| REQ-014 | AC-014.1 | T-032, T-037 | T-060, T-066 |
| REQ-014 | AC-014.2 | T-032, T-037 | T-060, T-066 |
| REQ-014 | AC-014.3 | T-037 | T-068 |
| REQ-014 | AC-014.4 | T-037 | T-066 |
| REQ-014 | AC-014.5 | T-032, T-037 | T-060, T-066 |
| REQ-014 | AC-014.6 | T-037, T-038 | T-065, T-068 |
| REQ-015 | AC-015.1 | T-042 | T-074 |
| REQ-015 | AC-015.2 | T-043 | T-074 |
| REQ-015 | AC-015.3 | T-042, T-043 | T-074 |
| REQ-015 | AC-015.4 | T-044 | T-075 |
| REQ-016 | AC-016.1 | T-045 | T-076 |
| REQ-016 | AC-016.2 | T-046 | T-076 |
| NFR-001 | AC-N001.1 | T-044 | T-075 |
| NFR-002 | AC-N002.1 | T-039 | T-072 |
| NFR-002 | AC-N002.2 | T-037 | T-066 |
| NFR-002 | AC-N002.3 | T-036 | T-068, T-072 |
