# Tareas 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-28)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold → test → impl.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
- Sin migración (plan 3.1). Las constantes de texto nuevas (`CUSTOM_FOOD_NAME_TAKEN_MESSAGE`, etc.) las crea la tarea impl; los tests usan los textos literales de la spec.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-002] (scaffold) Crear `CustomFoodFields` (dataclass con `name` y `per_100g`) y `parse_custom_food_fields(item: dict) -> CustomFoodFields`, que lance "not implemented" (`_parse_custom_item` no se toca todavía) — `backend/services/meal_rules.py`
- [x] T-002 [REQ-001] (scaffold) Añadir `FoodLibraryService.update_custom_food(self, _user_id, _custom_food_id, _data)` que lance "not implemented" — `backend/services/food_library_service.py`
- [x] T-003 [REQ-009] (scaffold) Crear `customFoodNameKey(_name: string): string` que lance "not implemented" — `frontend/src/features/food-library/names.ts`
- [x] T-004 [REQ-010] (scaffold) Añadir el tipo `CustomFoodUpdatePayload` y exportar `customLibraryFoodSchema` (la variante propia ya existente de `libraryFoodSchema`, sin cambiar su comportamiento) — `frontend/src/features/food-library/types.ts`, `frontend/src/features/food-library/schemas.ts`
- [x] T-005 [REQ-010] (scaffold) Añadir `updateCustomFood(_customFoodId, _payload)` que lance "not implemented" — `frontend/src/features/food-library/api.ts`
- [x] T-006 [REQ-009, REQ-010] (scaffold) Añadir `useUpdateCustomFood`, `UpdateCustomFoodVariables`, `useCustomFoodNameCheck(_food, _name, _delayMs)` y `CustomFoodNameCheck`, con cuerpos que lancen "not implemented" — `frontend/src/features/food-library/hooks.ts`
- [x] T-007 [REQ-007, REQ-008] (scaffold) Añadir el tipo `CustomFoodEditValues` y `customFoodEditSchema` (esqueleto sin reglas: `z.object` de cinco `z.string()`; si no puede ser sin lógica, que lance "not implemented") — `frontend/src/features/diary/schemas.ts`
- [x] T-008 [REQ-007, REQ-008, REQ-010] (scaffold) Crear `customFoodEditDefaults`, `customFoodEditPayload` e `isCustomFoodEditUnchanged` con parámetros prefijados con `_` y cuerpos que lancen "not implemented" — `frontend/src/features/diary/customFoodEdit.ts`
- [x] T-009 [REQ-010] (scaffold) Añadir `updateCustomFoodErrorView(_error)` y el tipo `UpdateCustomFoodErrorView` que lancen "not implemented" — `frontend/src/features/diary/errors.ts`
- [x] T-010 [REQ-011] (scaffold) Añadir `applyCustomFoodEdit(_entry, _food)` que lance "not implemented" — `frontend/src/features/diary/proposal.ts`
- [x] T-011 [REQ-007, NFR-001] (scaffold) Crear el componente `CustomFoodEditForm` con las props del plan, que lance "not implemented" — `frontend/src/features/diary/components/CustomFoodEditForm.tsx`

## Fase A — Tests (test-author)

### Backend
- [x] T-020 [REQ-002, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (test) Unitarios de `parse_custom_food_fields`: nombre ausente, vacío, solo espacios, 100 y 101 caracteres, `per_100g` ausente o incompleto, calorías -1 y 901, macros -1 y 101, suma 40+40+30, y recorte del nombre — `backend/tests/test_services/test_meal_rules.py`
- [x] T-021 [REQ-001, AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6] (test) Unitarios de `update_custom_food` con fakes: edición correcta con nombre recortado y mismo id, favorito conservado, solo mayúsculas, mismos valores, nombre del catálogo, `favorite` false, `commit` hecho, bloqueo de la fila del usuario antes de leer — `backend/tests/test_services/test_food_library_service.py`
- [x] T-022 [REQ-002, REQ-003, REQ-004, AC-002.1, AC-003.1, AC-003.2, AC-004.1, AC-004.2] (test) Unitarios de `update_custom_food`: cuerpo que no es objeto, 409 con otro propio (sin mayúsculas, tildes ni espacios repetidos) con `rollback` y nada cambia, nombre de otro usuario permitido, 404 por id no válido (`"abc"`, `"0"`, `"2147483648"`), inexistente y de otro usuario — `backend/tests/test_services/test_food_library_service.py`
- [x] T-023 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6] (test) Integración de `PATCH /api/food-library/custom/{id}`: respuesta 200 con el formato de biblioteca, favoritos y `search?q=gallo` tras editar, solo mayúsculas, sin cambios, nombre del catálogo, no favorito — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-024 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (test) Integración de 400: cuerpo `"hola"`, `null`, lista y JSON malformado, y cada regla de la 022 con su mensaje; comprobar en la base que el alimento no cambia — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-025 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) Integración de 409 y concurrencia: nombre repetido, nombre de otro usuario, y dos `PATCH` simultáneos «Avena» y «Banano» a «Batido» (una 200, otra 409, ninguna 500, un solo «Batido») — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-026 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) Integración de 404 y 401: alimento de otro usuario, ids `abc`, `0`, `2147483648` e inexistente, alimento borrado, sin cabecera y token caducado — `backend/tests/test_routes/test_food_library_routes.py`
- [x] T-027 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-003.4] (test) Integración del efecto en el diario: la comida conserva su copia y `custom_food_id`, recientes con valores nuevos y `last_grams`, `POST /api/meals` copia los editados, y renombrar y registrar el nombre antiguo crea otro alimento — `backend/tests/test_routes/test_meal_library_routes.py`
- [x] T-028 [REQ-005, AC-005.4] (test) Integración de `undo=1`, edición y `POST /api/meals/restore`: el alimento vuelve con el nombre y los valores de cuando se quitó y su `custom_food_id` — `backend/tests/test_routes/test_meal_library_routes.py`

### Frontend
- [x] T-030 [REQ-009] (test) `customFoodNameKey`: mayúsculas, tildes, espacios en los extremos y repetidos — `frontend/src/features/food-library/names.test.ts`
- [x] T-031 [REQ-010, AC-010.1] (test) `updateCustomFood` hace `PATCH /api/food-library/custom/12` con el cuerpo y valida la respuesta — `frontend/src/features/food-library/api.test.ts`
- [x] T-032 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5] (test) `useCustomFoodNameCheck`: `checking` durante el retardo y la petición, `taken` solo con otro propio de la misma clave (favorito o no), no con el mismo id ni con el catálogo, y sin aviso si la búsqueda falla — `frontend/src/features/food-library/hooks.test.tsx`
- [x] T-033 [REQ-010, AC-010.2, AC-010.4] (test) `useUpdateCustomFood` invalida `foodLibraryKeys.all` tras el 200 y tras un 404 — `frontend/src/features/food-library/hooks.test.tsx`
- [x] T-034 [REQ-007, REQ-008, AC-007.5, AC-008.5] (test) `customFoodEditSchema` con los mensajes de la 022 y `customFoodFormSchema` sin cambios — `frontend/src/features/diary/schemas.test.ts`
- [x] T-035 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5] (test) `customFoodEditDefaults`, `customFoodEditPayload` e `isCustomFoodEditUnchanged` — `frontend/src/features/diary/customFoodEdit.test.ts`
- [x] T-036 [REQ-010, AC-010.3, AC-010.4, AC-010.5] (test) `updateCustomFoodErrorView` para 409, 404, 400, 500 y error de red — `frontend/src/features/diary/errors.test.ts`
- [x] T-037 [REQ-011, AC-011.1, AC-011.3] (test) `applyCustomFoodEdit`: misma `key` y gramos con nombre y valores nuevos; `null` con otro id, un `catalog` o un `custom` sin `customFoodId` — `frontend/src/features/diary/proposal.test.ts`
- [x] T-038 [REQ-007, REQ-008, REQ-009, NFR-001, AC-007.1, AC-007.5, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-009.1, AC-010.3, AC-010.6, AC-N001.1, AC-N001.5] (test) `CustomFoodEditForm` aislado: título y nombre accesible, foco en «Nombre», valores iniciales, «Guardar» habilitado o no, aviso con `aria-describedby` y `role="status"`, `nameTakenKey`, validación sin petición, Intro con `isSaving`, Escape y «Cancelar» — `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`
- [x] T-039 [REQ-006, AC-006.1, AC-006.2] (test) `FoodSearchPanel`: orden Elegir, estrella, Editar, Borrar; sin «Editar» en el catálogo; botón en Favoritos, Recientes y Resultados — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-040 [REQ-007, AC-007.1, AC-007.2, AC-007.6, AC-007.7, AC-007.8] (test) `FoodSearchPanel`: formulario en el elemento y lista correctos, «Cancelar» y reabrir, alternar con la confirmación de borrado, cierre al escribir o plegar — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-041 [REQ-010, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5, AC-010.6, AC-010.7] (test) `FoodSearchPanel`: guardar (cuerpo, «Guardando…», listas nuevas y orden), 409, 404, 500 y doble envío; `onCustomFoodEdited` recibe el alimento devuelto — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-042 [NFR-001, AC-N001.1, AC-N001.2, AC-N001.3, AC-N001.4] (test) `FoodSearchPanel`: foco al abrir, al cancelar y con Escape desde Recientes, tras guardar en Favoritos y a la caja de búsqueda cuando el alimento sale de Resultados — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-043 [REQ-007, AC-007.3] (test) `AddFoodDialog`: Escape cierra solo el formulario y el diálogo sigue abierto; un segundo Escape lo cierra — `frontend/src/features/diary/components/AddFoodDialog.test.tsx`
- [x] T-044 [REQ-006, REQ-007, AC-006.3, AC-007.4] (test) `MealPhotoDialog`: botón «Editar» en Favoritos de «Añadir otro alimento» y Escape sin confirmación de descartar y con el texto de búsqueda — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [x] T-045 [REQ-011, AC-011.1, AC-011.2, AC-011.3] (test) `MealPhotoDialog`: fila actualizada con 250 g y 500 kcal, total, cuerpo de «Guardar en {sección}» con `custom_food_id`, y filas ajenas sin cambios — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`

### Frontend · correcciones de la review (iteración 2)
- [x] T-046 [REQ-010, AC-010.4] (test) `FoodSearchPanel` (F2): con `onCustomFoodDeleted` espiado, editar «Gallo pinto» (id 12) y 404 llama una vez con `12`; con 409, 400, 500 y 200 no se llama (con 200 solo `onCustomFoodEdited`) — `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`
- [x] T-047 [REQ-011, AC-010.4] (test) `MealPhotoDialog` (F2): propuesta con «Gallo pinto» (id 12, 250 g), editarlo con 404, volver a la propuesta: fila «Personalizado» con valores anteriores (450 kcal), «Guardar en {sección}» la envía con `name`, `grams` y `per_100g` sin `custom_food_id`, y las filas ajenas no cambian — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [x] T-048 [NFR-001, AC-N001.1] (test) `CustomFoodEditForm` (F3): con `isSaving: true` y el foco en otro elemento, al pasar a `isSaving: false` el foco va a «Nombre» (único mecanismo; los tests de foco existentes de `FoodSearchPanel` siguen valiendo) — `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`
- [x] T-049 [REQ-009, AC-010.6] (test) `CustomFoodEditForm` (F4): Intro durante la comprobación no envía y la región `role="status"` muestra «Comprobando el nombre…»; al terminar sin coincidencias desaparece, «Guardar» se habilita y no hay envío automático; con nombre repetido muestra el aviso de REQ-009; cambiar el nombre quita el texto; Intro sin cambios o con `isSaving` no muestra el texto — `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`

### Frontend · correcciones de la review (iteración 3)
- [x] T-076 [NFR-001, AC-N001.1] (test) R1: sustituir el bloque `describe` de T-048 («foco al terminar un guardado fallido»; autorización del usuario recogida en el plan, sección 7) por tres casos con `rerender` y el foco puesto antes en «Calorías»: de `isSaving: true` a `false` con `serverError` (`UPDATE_CUSTOM_FOOD_FAILED_MESSAGE`) → foco en «Nombre»; con `nameTakenKey: "gallo pinto con huevo"` → foco en «Nombre»; sin `serverError` ni `nameTakenKey` → el foco sigue en «Calorías» (rojo legítimo) — `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`
- [x] T-077 [REQ-009, AC-010.6] (test) R2.b: con `pendingSearch([])`, escribir «Gallo pinto nuevo», Intro → «Comprobando el nombre…»; escribir « 2» y borrarlo hasta volver al mismo nombre con la comprobación en curso → el texto no aparece y `onSubmit` no se llama (rojo con el código actual) — `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`

## Fase B — Implementación (implementer)

### Backend
- [x] T-050 [REQ-002, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (impl) Implementar `parse_custom_food_fields` extrayendo las reglas de `_parse_custom_item`, que pasa a usarla sin cambiar orden ni mensajes — `backend/services/meal_rules.py`
- [x] T-051 [REQ-003, AC-003.1] (impl) Añadir `CUSTOM_FOOD_NAME_TAKEN_MESSAGE` — `backend/services/food_library_rules.py`
- [x] T-052 [REQ-001, REQ-002, REQ-003, REQ-004, AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-002.1, AC-003.1, AC-003.2, AC-004.1, AC-004.2] (impl) Implementar `FoodLibraryService.update_custom_food` según el plan 3.3 (id, cuerpo, campos, bloqueo, 404, 409, asignación, favorito, commit/rollback) — `backend/services/food_library_service.py`
- [x] T-053 [REQ-001, REQ-004, AC-001.1, AC-001.2, AC-003.3, AC-004.3, AC-004.4] (impl) Añadir `PATCH /custom/<custom_food_id>` con `@require_auth`, parámetro de texto y `get_json(silent=True)` — `backend/routes/food_library_routes.py`
- [x] T-054 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-003.4] (impl) Comprobar que REQ-005 se cumple sin código nuevo; si algún test de T-027 o T-028 falla, corregir solo la causa en el servicio — `backend/services/meal_service.py`

### Frontend
- [x] T-060 [REQ-009] (impl) Implementar `customFoodNameKey` (NFKD, sin marcas, minúsculas, espacios colapsados) — `frontend/src/features/food-library/names.ts`
- [x] T-061 [REQ-010, AC-010.1] (impl) Implementar `updateCustomFood` con `apiFetch` y validación con `customLibraryFoodSchema` — `frontend/src/features/food-library/api.ts`
- [x] T-062 [REQ-009, REQ-010, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-010.2, AC-010.4] (impl) Implementar `useUpdateCustomFood` y `useCustomFoodNameCheck` según el plan 3.3 — `frontend/src/features/food-library/hooks.ts`
- [x] T-063 [REQ-007, REQ-008, AC-007.5, AC-008.5] (impl) Extraer `addCustomFoodIssues` compartida e implementar `customFoodEditSchema` con los mensajes de la 022 — `frontend/src/features/diary/schemas.ts`
- [x] T-064 [REQ-008, REQ-010, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-010.1] (impl) Implementar `customFoodEditDefaults`, `customFoodEditPayload` e `isCustomFoodEditUnchanged` — `frontend/src/features/diary/customFoodEdit.ts`
- [x] T-065 [REQ-010, AC-010.3, AC-010.4, AC-010.5] (impl) Añadir los tres mensajes e implementar `updateCustomFoodErrorView` — `frontend/src/features/diary/errors.ts`
- [x] T-066 [REQ-011, AC-011.1, AC-011.3] (impl) Implementar `applyCustomFoodEdit` — `frontend/src/features/diary/proposal.ts`
- [x] T-067 [REQ-007, REQ-008, REQ-009, NFR-001, AC-007.1, AC-007.5, AC-008.1, AC-009.1, AC-010.3, AC-010.6, AC-N001.1, AC-N001.5] (impl) Implementar `CustomFoodEditForm` (react-hook-form, `useWatch`, foco en «Nombre», aviso con `role="status"` y `aria-describedby`, `useEscapeCapture`) — `frontend/src/features/diary/components/CustomFoodEditForm.tsx`
- [x] T-068 [REQ-006, AC-006.1, AC-006.2] (impl) Añadir el botón «Editar» (prop `onEdit`, `data-edit-food-id`) entre la estrella y «Borrar», solo en los propios — `frontend/src/features/diary/components/LibraryFoodList.tsx`
- [x] T-069 [REQ-007, REQ-010, NFR-001, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.6, AC-007.7, AC-007.8, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5, AC-010.7, AC-N001.2, AC-N001.3, AC-N001.4] (impl) Generalizar la confirmación en línea a `InlineTarget` (delete o edit), `startEdit`, `cancelEdit`, `saveEdit`, foco tras cada resultado, aviso de 404 y `onCustomFoodEdited` — `frontend/src/features/diary/components/FoodSearchPanel.tsx`
- [x] T-070 [REQ-011, AC-006.3, AC-011.1, AC-011.2, AC-011.3] (impl) Pasar `onCustomFoodEdited={applyEdited}` al panel de la vista de búsqueda y actualizar las filas con `applyCustomFoodEdit` — `frontend/src/features/diary/components/PhotoReview.tsx`

### Frontend · correcciones de la review (iteración 2)
- [x] T-071 [REQ-005] (impl) F1: corregir la errata de formato `RecentFood =LibraryFood` a `RecentFood = LibraryFood`, sin cambio de tipo; lo cubren lint y `tsc` — `frontend/src/features/food-library/types.ts`
- [x] T-072 [REQ-010, REQ-011, AC-010.4] (impl) F2: en `saveEdit`, tras un 404 llamar a `onCustomFoodDeleted?.(id)` antes de cerrar el formulario (no con 409, 400, 500 ni 200) y actualizar el comentario de la prop — `frontend/src/features/diary/components/FoodSearchPanel.tsx`
- [x] T-073 [NFR-001, AC-N001.1] (impl) F3: quitar `nameFocusTick`, su estado, sus `set` en `saveEdit` y su efecto del panel; el foco a «Nombre» tras un error lo da solo el efecto `wasSaving` del formulario (si falla un test de foco existente, conservar el del panel y quitar el del formulario, nunca los dos) — `frontend/src/features/diary/components/FoodSearchPanel.tsx`
- [x] T-074 [REQ-009] (impl) F4: exportar `CUSTOM_FOOD_NAME_CHECKING_MESSAGE = "Comprobando el nombre…"` — `frontend/src/features/diary/customFoodEdit.ts`
- [x] T-075 [REQ-009, NFR-001, AC-010.6, AC-N001.1] (impl) F3 y F4: Intro con `check.checking` y sin guardado no envía y fija `checkingNoticeFor`; la región `role="status"` muestra el mensaje mientras `!showTaken && check.checking && checkingNoticeFor === name`, sin añadirlo a `aria-describedby` ni envío automático; mantener el efecto `wasSaving` — `frontend/src/features/diary/components/CustomFoodEditForm.tsx`

### Frontend · correcciones de la review (iteración 3)
- [ ] T-078 [NFR-001, AC-N001.1] (impl) R1: dejar un único efecto de foco a «Nombre» por resultado (`[serverError, nameTakenKey]`) y quitar el efecto `wasSaving` y su ref — `frontend/src/features/diary/components/CustomFoodEditForm.tsx`
- [ ] T-079 [REQ-009, AC-010.6] (impl) R2: quitar de `handleSubmit` la rama inalcanzable de «comprobando» (la señal queda en `handleKeyDown`) y limpiar `checkingNoticeFor` en el `onChange` del campo «Nombre» envolviendo el de react-hook-form — `frontend/src/features/diary/components/CustomFoodEditForm.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-021, T-023 | T-052, T-053 |
| REQ-001 | AC-001.2 | T-023 | T-052, T-053 |
| REQ-001 | AC-001.3 | T-021, T-023 | T-052 |
| REQ-001 | AC-001.4 | T-021, T-023 | T-052 |
| REQ-001 | AC-001.5 | T-021, T-023 | T-052 |
| REQ-001 | AC-001.6 | T-021, T-023 | T-052 |
| REQ-002 | AC-002.1 | T-022, T-024 | T-052 |
| REQ-002 | AC-002.2 | T-020, T-024 | T-050 |
| REQ-002 | AC-002.3 | T-020, T-024 | T-050 |
| REQ-002 | AC-002.4 | T-020, T-024 | T-050 |
| REQ-002 | AC-002.5 | T-020, T-024 | T-050 |
| REQ-002 | AC-002.6 | T-020, T-024 | T-050 |
| REQ-002 | AC-002.7 | T-020, T-024 | T-050 |
| REQ-003 | AC-003.1 | T-022, T-025 | T-051, T-052 |
| REQ-003 | AC-003.2 | T-022, T-025 | T-052 |
| REQ-003 | AC-003.3 | T-025 | T-053 |
| REQ-003 | AC-003.4 | T-027 | T-054 |
| REQ-004 | AC-004.1 | T-022, T-026 | T-052 |
| REQ-004 | AC-004.2 | T-022, T-026 | T-052 |
| REQ-004 | AC-004.3 | T-026 | T-053 |
| REQ-004 | AC-004.4 | T-026 | T-053 |
| REQ-005 | AC-005.1 | T-027 | T-054 |
| REQ-005 | AC-005.2 | T-027 | T-054 |
| REQ-005 | AC-005.3 | T-027 | T-054 |
| REQ-005 | AC-005.4 | T-028 | T-054 |
| REQ-006 | AC-006.1 | T-039 | T-068 |
| REQ-006 | AC-006.2 | T-039 | T-068 |
| REQ-006 | AC-006.3 | T-044 | T-070 |
| REQ-007 | AC-007.1 | T-038, T-040 | T-067, T-069 |
| REQ-007 | AC-007.2 | T-040 | T-069 |
| REQ-007 | AC-007.3 | T-043 | T-069 |
| REQ-007 | AC-007.4 | T-044 | T-069 |
| REQ-007 | AC-007.5 | T-034, T-038 | T-063, T-067 |
| REQ-007 | AC-007.6 | T-040 | T-069 |
| REQ-007 | AC-007.7 | T-040 | T-069 |
| REQ-007 | AC-007.8 | T-040 | T-069 |
| REQ-008 | AC-008.1 | T-035, T-038 | T-064, T-067 |
| REQ-008 | AC-008.2 | T-035, T-038 | T-064 |
| REQ-008 | AC-008.3 | T-035, T-038 | T-064 |
| REQ-008 | AC-008.4 | T-035, T-038 | T-064 |
| REQ-008 | AC-008.5 | T-034, T-035, T-038 | T-063, T-064 |
| REQ-009 | AC-009.1 | T-032, T-038, T-049, T-077 | T-062, T-067, T-074, T-075, T-079 |
| REQ-009 | AC-009.2 | T-032 | T-062 |
| REQ-009 | AC-009.3 | T-032 | T-062 |
| REQ-009 | AC-009.4 | T-032 | T-062 |
| REQ-009 | AC-009.5 | T-032 | T-062 |
| REQ-010 | AC-010.1 | T-031, T-041 | T-061, T-064, T-069 |
| REQ-010 | AC-010.2 | T-033, T-041 | T-062, T-069 |
| REQ-010 | AC-010.3 | T-036, T-038, T-041 | T-065, T-067, T-069 |
| REQ-010 | AC-010.4 | T-033, T-036, T-041, T-046, T-047 | T-062, T-065, T-069, T-072 |
| REQ-010 | AC-010.5 | T-036, T-041 | T-065, T-069 |
| REQ-010 | AC-010.6 | T-038, T-041, T-049, T-077 | T-067, T-075, T-079 |
| REQ-010 | AC-010.7 | T-041 | T-069 |
| REQ-011 | AC-011.1 | T-037, T-045 | T-066, T-070 |
| REQ-011 | AC-011.2 | T-045 | T-070 |
| REQ-011 | AC-011.3 | T-037, T-045 | T-066, T-070 |
| NFR-001 | AC-N001.1 | T-038, T-042, T-048, T-076 | T-067, T-073, T-075, T-078 |
| NFR-001 | AC-N001.2 | T-042 | T-069 |
| NFR-001 | AC-N001.3 | T-042 | T-069 |
| NFR-001 | AC-N001.4 | T-042 | T-069 |
| NFR-001 | AC-N001.5 | T-038 | T-067 |
