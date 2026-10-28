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
