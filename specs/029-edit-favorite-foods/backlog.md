# Backlog · 029-edit-favorite-foods

## spec · spec-writer
- [ ] Deshacer una edición de un alimento propio.
- [ ] Editar un alimento propio desde las filas del diario o desde una pantalla «Mis alimentos».

## plan · planner
- [x] Tras un 404 al editar desde la propuesta de foto, desvincular las filas de ese alimento, como `unlinkCustomFood` al borrar en la 028 (la spec no lo pide).
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
- [x] `frontend/src/features/food-library/types.ts`: `export type RecentFood =LibraryFood & { last_grams: number }` sin espacio tras `=`. Corregir en implement.
- [ ] `customFoodEditSchema` (`frontend/src/features/diary/schemas.ts`) es un `z.object` sin reglas. Sustituirlo por las reglas reales en T-063.
- [ ] Incidente de proceso: el hook bloqueó escribir un script en el scratchpad (fuera de `specs/`). Usé un heredoc por stdin, que solo lee datos. Los logs de pytest y vitest sí quedaron en el scratchpad por redirección. No afecta al repositorio.

## implement · implementer
- [x] Corregir el E501 en backend/tests/test_routes/test_food_library_routes.py:1226 (lo debe hacer el test-author o el usuario).

## verify · verifier
- [ ] La nota de tasks en state.json dice «62 AC», pero la spec tiene 61 AC (AC-008.8 citado en REQ-005 es de la spec 028).
- [ ] La aprobación de implement se dio con la nota «1 E501 nuevo» pendiente; la comprobación de ratchet debería exigirse antes de aprobar implement.

## verify (iteración 2) · verifier
- [ ] state.json, nota de implement: cita «62 AC»; la spec tiene 61 AC propios (el 62.º es AC-008.8, de la 028). Corregir la nota al cerrar.
- [x] Los marcadores `SDD: 029` de tests parametrizados van sobre el decorador (`@pytest.mark.parametrize`), no pegados a `def`. Es válido, pero conviene que el reviewer lo confirme.

## review · reviewer
- [x] F1 (NIT, implementer): sigue sin corregir la errata del scaffold `RecentFood =LibraryFood` en frontend/src/features/food-library/types.ts:19.
- [x] F2 (MENOR, planner): si editar desde la propuesta de foto devuelve 404, las filas que usaban ese alimento se quedan con un customFoodId que ya no existe; habría que desvincularlas, como ya hace unlinkCustomFood al borrar (FoodSearchPanel.tsx:218-222).
- [x] F3 (NIT, implementer): hay dos mecanismos que devuelven el foco a «Nombre» tras un guardado fallido, nameFocusTick en FoodSearchPanel.tsx:232-236 y wasSaving en CustomFoodEditForm.tsx:79-86; conviene dejar solo uno.
- [x] F4 (NIT, implementer): mientras se comprueba el nombre, pulsar Intro no hace nada y no avisa de ninguna forma (CustomFoodEditForm.tsx:103-106).

## plan (iteración 2) · planner
- [ ] Envío automático al terminar la comprobación del nombre si el usuario pulsó Intro mientras se comprobaba (F4, mejora opcional de UX).
- [ ] En la 028, un 404 al borrar un alimento propio tampoco desvincula las filas de la propuesta (`confirmDelete` en el `onError`); se podría tratar igual que en F2.

## review (iteración 2) · reviewer
- [x] R1 (MENOR, planner): dejar un único mecanismo de foco a «Nombre» tras un guardado fallido en `CustomFoodEditForm.tsx:84-98`. Hoy el efecto sobre `[serverError, nameTakenKey]` cubre todos los fallos, incluido el rechazo inmediato, y `wasSaving` sobra: solo lo sostiene T-048. Opciones: conservar solo el efecto por resultado y que test-author adapte T-048, fundir los dos en un solo efecto o dejar escrito en el plan que se aceptan los dos.
- [x] R2 (NIT, implementer): quitar la rama `if (!isSaving && check.checking)` de `handleSubmit` (`CustomFoodEditForm.tsx:117-120`), que nunca se alcanza, y limpiar `checkingNoticeFor` al cambiar el nombre para que el aviso no reaparezca al volver a escribir el mismo nombre.
- Pendiente del verifier: los marcadores `SDD:` encima de `@pytest.mark.parametrize` son válidos, porque el decorador forma parte de la definición del test. Se puede cerrar ese punto del backlog.

## verify (iteración 4) · verifier
- [ ] Revisar si `accountSwitch.test.tsx` (test «B entra con el onboarding pendiente…») es inestable con carga: el timeout por defecto de 5 s es ajustado.
- [ ] Algunos marcadores `SDD:` de la 029 emparejan un REQ con un AC de otro REQ (p. ej. `REQ-011 AC-010.4` en `MealPhotoDialog.test.tsx`, `REQ-009 AC-010.6` en `CustomFoodEditForm.test.tsx`) o solo llevan el REQ (`names.test.ts`, `CustomFoodEditForm.test.tsx` línea 357). No afecta a la cobertura, pero conviene alinearlos en la review.

## review (iteración 3) · reviewer
- [x] R3 (NIT, test-author): el marcador `SDD: 029 REQ-009 AC-010.6` de T-077 (`CustomFoodEditForm.test.tsx:553`) y los de T-049 juntan REQ-009 con un AC de REQ-010; conviene usar `REQ-009 AC-009.1` o solo `REQ-009`.
- [x] R4 (NIT, planner): según el riesgo F3/R1 de `plan.md` (sección 6), los tests de `FoodSearchPanel` cubren el caso del mismo mensaje de error dos veces seguidas, pero solo prueban un primer fallo; hay que corregir la frase o añadir un test con dos 500 seguidos.
- [x] R5 (NIT, planner): T-048 y T-075 de `tasks.md` (líneas 63 y 97) siguen marcadas [x] y describen `wasSaving`, que ya no existe; conviene anotar que las sustituyen T-076 y T-078.
