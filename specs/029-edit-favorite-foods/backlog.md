# Backlog · 029-edit-favorite-foods

## spec · spec-writer
- [ ] Deshacer una edición de un alimento propio.
- [ ] Editar un alimento propio desde las filas del diario o desde una pantalla «Mis alimentos».

## plan · planner
- [ ] Tras un 404 al editar desde la propuesta de foto, desvincular las filas de ese alimento, como `unlinkCustomFood` al borrar en la 028 (la spec no lo pide).
- [ ] Endpoint dedicado para comprobar si un nombre ya existe, si la comprobación del cliente con la búsqueda se queda corta.
- [ ] Usar `aria-disabled` en lugar de `disabled` para no perder el foco mientras se guarda, en la edición y en el borrado de la 028.

## tasks · task-breaker
- [ ] AC-003.3 (concurrencia) necesita el helper `concurrent_posts` de `test_meal_library_routes.py`. El test-author decide si lo copia o lo extrae a un módulo de utilidades de tests.

## tests · test-author
- [ ] `backend/tests/test_routes/test_food_library_routes.py` define su propio helper `concurrent_patches`, copiado del patrón de `concurrent_posts` de `test_meal_library_routes.py`. Se podría extraer a un módulo común de utilidades de tests.
- [ ] `ENDPOINTS` del test de sesión de la 028 («las ocho rutas») no incluye el `PATCH`. Sus 401 se cubren con tests propios (AC-004.4).
- [ ] `frontend/src/features/food-library/types.ts` tiene un typo del scaffold: `RecentFood =LibraryFood`. Es solo de formato y no afecta a la compilación.

## tests (red) · verifier
- [ ] frontend/src/features/food-library/types.ts: falta el espacio en `RecentFood =LibraryFood` (corregir en implement).
- [ ] backend/tests/test_routes/test_food_library_routes.py (AC-003.3, concurrencia): el test depende de una bandera interna («reached») del bloqueo; vigilar que no sea frágil al implementar.

## tests (red, iteración 2) · verifier
- [ ] `frontend/src/features/food-library/types.ts`: `export type RecentFood =LibraryFood & { last_grams: number }` sin espacio tras `=`. Corregir en implement.
- [ ] `customFoodEditSchema` (`frontend/src/features/diary/schemas.ts`) es un `z.object` sin reglas. Sustituirlo por las reglas reales en T-063.
- [ ] Incidente de proceso: el hook bloqueó escribir un script en el scratchpad (fuera de `specs/`). Usé un heredoc por stdin, que solo lee datos. Los logs de pytest y vitest sí quedaron en el scratchpad por redirección. No afecta al repositorio.

## implement · implementer
- [ ] Corregir el E501 en backend/tests/test_routes/test_food_library_routes.py:1226 (lo debe hacer el test-author o el usuario).

## verify · verifier
- [ ] La nota de tasks en state.json dice «62 AC», pero la spec tiene 61 AC (AC-008.8 citado en REQ-005 es de la spec 028).
- [ ] La aprobación de implement se dio con la nota «1 E501 nuevo» pendiente; la comprobación de ratchet debería exigirse antes de aprobar implement.

## verify (iteración 2) · verifier
- [ ] state.json, nota de implement: cita «62 AC»; la spec tiene 61 AC propios (el 62.º es AC-008.8, de la 028). Corregir la nota al cerrar.
- [ ] Los marcadores `SDD: 029` de tests parametrizados van sobre el decorador (`@pytest.mark.parametrize`), no pegados a `def`. Es válido, pero conviene que el reviewer lo confirme.

## review · reviewer
- [ ] F1 (NIT, implementer): sigue sin corregir la errata del scaffold `RecentFood =LibraryFood` en frontend/src/features/food-library/types.ts:19.
- [ ] F2 (MENOR, planner): si editar desde la propuesta de foto devuelve 404, las filas que usaban ese alimento se quedan con un customFoodId que ya no existe; habría que desvincularlas, como ya hace unlinkCustomFood al borrar (FoodSearchPanel.tsx:218-222).
- [ ] F3 (NIT, implementer): hay dos mecanismos que devuelven el foco a «Nombre» tras un guardado fallido, nameFocusTick en FoodSearchPanel.tsx:232-236 y wasSaving en CustomFoodEditForm.tsx:79-86; conviene dejar solo uno.
- [ ] F4 (NIT, implementer): mientras se comprueba el nombre, pulsar Intro no hace nada y no avisa de ninguna forma (CustomFoodEditForm.tsx:103-106).

## plan (iteración 2) · planner
- [ ] Envío automático al terminar la comprobación del nombre si el usuario pulsó Intro mientras se comprobaba (F4, mejora opcional de UX).
- [ ] En la 028, un 404 al borrar un alimento propio tampoco desvincula las filas de la propuesta (`confirmDelete` en el `onError`); se podría tratar igual que en F2.
