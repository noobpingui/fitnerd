# Backlog · 028-diary-food-library

## spec · spec-writer
- [ ] Pantalla «Mis alimentos» con edición de los alimentos propios.
- [ ] Marcar favoritos desde las filas del diario.
- [ ] Crear un alimento propio sin registrarlo en una comida.
- [ ] Recetas o platos compuestos de varios alimentos.
- [ ] Retirar `GET /api/foods/search` y los alimentos de USDA por `fdc_id` (sigue pendiente de la 023).

## plan · planner
- [ ] Retirar el código del catálogo que queda sin uso en el frontend (`CatalogResultList`, `useCatalogSearch`, `searchCatalog`) y `foods/api.ts`, ajustando los mocks de las pruebas de rutas.
- [ ] Hoy no se puede quitar un favorito del catálogo que una carga retiró (DELETE responde 404 según la spec) y sigue contando para el límite de 100.
- [ ] Valorar un test que compruebe que la clave de nombre de la migración y `custom_food_name_key` coinciden en una batería de nombres.
- [ ] Pantalla «Mis alimentos» para editar o borrar fuera de los diálogos (fuera de alcance de la 028).

## tests (scaffold) · implementer
- [ ] En implement, `withEntryKey` debe asignar siempre `key`: en el scaffold `ProposalFormEntry` lo tiene opcional (`ProposalEntry & { key?: string }`) y `MealItem.custom_food_id` es opcional (`custom_food_id?: number | null`); valorar volverlos obligatorios.

## tests · test-author
- [ ] `FoodsPage.test.tsx` lo borra el implementer en T-130; el test-author no lo tocó.
- [ ] Los 4 `searchMock.mockReset()` de `DiaryPage.test.tsx` dejan `searchFoodLibrary` devolviendo `undefined` fuera de los tests que lo fijan. Si la implementación abre la búsqueda en otro flujo, habrá que añadir un valor por defecto.
- [ ] `diaryRoute.test.tsx` no abre el diálogo de añadir, así que no se tocó; si el diario precarga `Recientes` al montar, convendría añadirle el mock de `food-library`.
- [ ] Los avisos `react(incompatible-library)` del lint (NFR-003) solo se comprueban por escaneo del código; `npm run lint` lo ejecuta el verifier.

## tests (red check) · verifier
- [ ] Formato del scaffold en `backend/services/meal_rules.py`: `_DATE_PATTERN =re.compile(...)` sin espacio antes del `=` (implementer, al implementar).
- [ ] `tests/fakes.py` `make_custom_food` depende de `custom_food_name_key` (esqueleto): los tests que usan `gallo()` fallan por `not implemented` y volverán a depender de su implementación.

## tests (red check, iteración 2) · verifier
- [ ] B1 (capas, Art. P2.1): `backend/repositories/meal_repository.py` importa `services/food_library_rules.py` (`RecentFoodRow`). Propuesta: mover `RecentFoodRow` a `models` o `repositories`. Responsable: implementer, en T-104.
- [ ] B2 (formato del scaffold): `backend/services/meal_rules.py` `_DATE_PATTERN =re.compile` (E225 contaría como violación nueva del ratchet) y `frontend/src/features/diary/types.ts` `AnalysisConfidence ="high"`. Responsable: implementer.
- [ ] B3 (claridad, test-author): desempaquetado `(saved,) = ...` en `test_meal_library_routes.py` y `test_meal_service.py` (assert de longitud previo).

## tests (red check, iteración 3) · verifier
- [ ] Las 2 guardas de frontend aceptadas en `foodsRoute.test.tsx` (abrir `/foods` termina en `/diary`; `/foods` sigue llevando a `/diary` con parámetros) deben seguir en verde tras T-130.

## tests (red check PASS, iteración 4) · verifier
- [ ] 51 tests previos de frontend (`AddFoodDialog`, `MealPhotoDialog`, `DiaryPage`) y 1 de backend (`test_post_response_has_the_full_contract_shape`) fallan por la spec 028 y deben volver a verde en implement sin debilitarse (Art. B5.3).
- [ ] Las dos guardas de `foodsRoute.test.tsx` deben seguir en verde tras T-130.
- [ ] B3 (desempaquetados `(saved,) = ...`): ya resuelto con `assert len(...) == 1`; la nota del verifier estaba obsoleta.

## implement · implementer
- [ ] Corregir los 27 E501 de los archivos de tests nuevos (test-author) para que el ratchet de ruff quede en verde: `test_food_library_routes.py` (2), `test_meal_library_routes.py` (3), `test_food_library_migration.py` (6), `test_food_library_service.py` (5), `test_meal_rules.py` (1) y `test_meal_service.py` (7).
- [ ] Quitar el código del catálogo que queda sin uso en el frontend (`CatalogResultList`, `useCatalogSearch`, `searchCatalog`, `foods/api.ts`), ya anotado por el planner.
- [ ] El fixture `src/test/diaryFixtures.ts` podría traer `custom_food_id: null` para volver a hacerlo obligatorio en `MealItem`.
- [ ] `AddFoodDialog` no pasa contenedor a la confirmación de borrado: hoy es en línea y no lo necesita.
- [ ] Decisión del implementer a revisar en review: la confirmación de borrar un alimento propio es en línea (`role="alertdialog"`), no con `ConfirmDialog`, porque el modal marca la lista «Resultados» como `aria-hidden` y AC-017.3 la exige accesible; se quitó la prop `confirmContainer`.
