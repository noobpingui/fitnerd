# Plan 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-28)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución
- **Backend:** un endpoint nuevo, `PATCH /api/food-library/custom/<custom_food_id>`, en `food_library_routes.py`, que
  llama a un método nuevo, `FoodLibraryService.update_custom_food`. El servicio valida el cuerpo con las mismas reglas
  que los personalizados de la 022, que se sacan de `meal_rules._parse_custom_item` a una función pública
  (`parse_custom_food_fields`) para no duplicarlas. Después bloquea la fila del usuario (ADR-0020, como el resto de
  escrituras de la biblioteca), comprueba que el alimento es suyo y que ningún **otro** alimento propio tiene la misma
  clave de nombre (`custom_food_name_key` de la 028) y modifica la fila en su sitio. Capas
  `routes → services → repositories → models` (Art. P2.1). **Sin migración:** `custom_foods` ya tiene todo lo necesario.
- **Frontend:** `api.ts` y `hooks.ts` de `food-library` añaden la edición (`updateCustomFood` y `useUpdateCustomFood`) y
  una comprobación del nombre repetido (`useCustomFoodNameCheck`) que reutiliza `GET /api/food-library/search`.
  `LibraryFoodList` añade el botón «Editar» y `FoodSearchPanel` generaliza su confirmación en línea de la 028 a un único
  «elemento en línea» (confirmación de borrado **o** formulario de edición), con las mismas reglas de cierre y de foco. El
  formulario es un componente nuevo, `CustomFoodEditForm`, con react-hook-form y un esquema zod que comparte la
  validación por 100 g con `customFoodFormSchema`. `PhotoReview` actualiza sus filas al editar (REQ-011).
- Sin dependencias, variables de entorno ni pasos manuales en producción nuevos.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | services (reglas) | — | `backend/services/meal_rules.py` | `CustomFoodFields` y `parse_custom_food_fields`, que `_parse_custom_item` pasa a usar (REQ-002) |
| backend | services (reglas) | — | `backend/services/food_library_rules.py` | `CUSTOM_FOOD_NAME_TAKEN_MESSAGE` (REQ-003) |
| backend | services | — | `backend/services/food_library_service.py` | `update_custom_food` (REQ-001 a REQ-004) |
| backend | routes | — | `backend/routes/food_library_routes.py` | `PATCH /custom/<custom_food_id>` (REQ-001, REQ-004) |
| backend | tests | — | `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_food_library_service.py`, `backend/tests/test_routes/test_food_library_routes.py`, `backend/tests/test_routes/test_meal_library_routes.py` | Sección 5 |
| frontend | `food-library` (datos) | `frontend/src/features/food-library/names.ts` | `frontend/src/features/food-library/api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` | Edición, clave de nombre y comprobación del nombre repetido (REQ-009, REQ-010) |
| frontend | diary · lógica | `frontend/src/features/diary/customFoodEdit.ts` | `frontend/src/features/diary/schemas.ts`, `errors.ts`, `proposal.ts` | Esquema del formulario, regla de «cambio», mensajes y filas de la propuesta (REQ-007, REQ-008, REQ-010, REQ-011) |
| frontend | diary · componentes | `frontend/src/features/diary/components/CustomFoodEditForm.tsx` | `frontend/src/features/diary/components/LibraryFoodList.tsx`, `FoodSearchPanel.tsx`, `PhotoReview.tsx` | Botón, formulario en línea, foco y propuesta (REQ-006 a REQ-011, NFR-001) |
| frontend | tests | `frontend/src/features/food-library/names.test.ts`, `frontend/src/features/food-library/hooks.test.tsx`, `frontend/src/features/diary/customFoodEdit.test.ts`, `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx` | `frontend/src/features/food-library/api.test.ts`, `frontend/src/features/diary/schemas.test.ts`, `errors.test.ts`, `proposal.test.ts`, `components/FoodSearchPanel.test.tsx`, `components/AddFoodDialog.test.tsx`, `components/MealPhotoDialog.test.tsx` | Sección 5 |

No cambian modelos, migraciones, `config.py`, `extensions.py`, `AddFoodDialog.tsx`, `MealPhotoDialog.tsx` ni la Política
de privacidad.

## 3. Diseño
### 3.1 Datos y migraciones
No aplica. La edición modifica en su sitio una fila de `public.custom_foods` (028): `name`, `name_key` y los cuatro
valores por 100 g; `updated_at` lo pone el `onupdate` del modelo. El `id`, el `user_id`, los favoritos
(`food_favorites.custom_food_id`) y los vínculos de `meal_items.custom_food_id` no cambian, y la copia de cada
`meal_item` tampoco (REQ-005, ADR-0036). Las `CHECK` existentes (`ck_custom_foods_name_length`, `ck_custom_foods_calories`
y `ck_custom_foods_macros`) y la restricción única `uq_custom_foods_user_id_name_key` siguen siendo la red de seguridad.

### 3.2 Contratos e interfaces

#### API HTTP
| Petición | Respuesta | Errores |
|---|---|---|
| `PATCH /api/food-library/custom/<custom_food_id>` con `{"name": str, "per_100g": {"calories_kcal", "protein_g", "carbs_g", "fat_g"}}` | 200 con `library_food_to_json(LibraryFood)`: `{"kind": "custom", "id": int, "name": str, "per_100g": {cuatro float}, "favorite": bool}` (sin `last_grams`) | 400 (tabla de la sección 6 de la spec), 404 `No encontramos ese alimento.`, 409 `Ya tienes un alimento con ese nombre.`, 401 sin sesión |

- `@require_auth`; el `user_id` sale de `g.decoded_token["id"]` (Art. P3.1).
- El parámetro de ruta es **texto** (no `<int:…>`), como `DELETE /custom/<custom_food_id>` de la 028, para que `abc`
  llegue al servicio y responda el 404 con el mensaje de la spec (AC-004.2).
- La ruta lee el cuerpo con `request.get_json(silent=True)`: JSON malformado da `None` y el servicio responde 400
  `La petición no es válida` (AC-002.1).

#### Backend · firmas exactas (esqueletos: `raise NotImplementedError("not implemented")`, Art. P1.backend.5)

`backend/services/meal_rules.py` (añadidos):
```python
@dataclass(frozen=True)
class CustomFoodFields:
    name: str                    # sin los espacios de los extremos
    per_100g: dict[str, float]   # las cuatro claves de NUTRIENT_KEYS

def parse_custom_food_fields(item: dict) -> CustomFoodFields: ...
```
`_parse_custom_item(item, grams)` pasa a ser
`CustomItemInput(name=fields.name, grams=grams, per_100g=fields.per_100g)` con `fields = parse_custom_food_fields(item)`,
sin cambiar el orden de las comprobaciones ni los mensajes (los tests de la 022 y la 028 siguen valiendo).

`backend/services/food_library_rules.py` (añadido):
```python
CUSTOM_FOOD_NAME_TAKEN_MESSAGE = "Ya tienes un alimento con ese nombre."
```

`backend/services/food_library_service.py` (añadido; el constructor no cambia):
```python
class FoodLibraryService:
    def update_custom_food(self, user_id, custom_food_id: object, data: object) -> LibraryFood: ...
```

`backend/routes/food_library_routes.py` (añadido):
```python
@food_library_bp.route("/custom/<custom_food_id>", methods=["PATCH"])
@require_auth
def update_custom_food(custom_food_id): ...
```

No hay métodos de repositorio nuevos: se reutilizan `get_by_id_and_user`, `get_by_name_keys`,
`FoodFavoriteRepository.get_for_food` y `UserRepository.get_by_id_for_update`.

#### Frontend · firmas exactas (esqueletos: `throw new Error("not implemented")`, parámetros con `_`, Art. P1.frontend.5)

`frontend/src/features/food-library/types.ts` (añadido):
```ts
export type CustomFoodUpdatePayload = { name: string; per_100g: LibraryPer100g }
```
Además se corrige la errata de formato que quedó del scaffold en la declaración de `RecentFood` (falta el espacio tras
`=`: `export type RecentFood =LibraryFood & …` pasa a `export type RecentFood = LibraryFood & …`). Sin cambio de tipo
(review F1).

`frontend/src/features/food-library/schemas.ts`: se exporta la variante propia que ya existe dentro de
`libraryFoodSchema`:
```ts
export const customLibraryFoodSchema   // z.object({ kind: z.literal("custom"), id: z.number(), name, per_100g, favorite })
```
(`libraryFoodSchema` pasa a usarla en su unión, sin cambiar su comportamiento.)

`frontend/src/features/food-library/names.ts` (nuevo):
```ts
// Regla de nombres de la 028: sin mayúsculas ni tildes, sin espacios en los extremos y con los repetidos como uno.
export function customFoodNameKey(name: string): string
```

`frontend/src/features/food-library/api.ts` (añadido):
```ts
// PATCH /api/food-library/custom/{id}; valida la respuesta con customLibraryFoodSchema.
export async function updateCustomFood(
  customFoodId: number,
  payload: CustomFoodUpdatePayload
): Promise<CustomLibraryFood>
```

`frontend/src/features/food-library/hooks.ts` (añadidos):
```ts
export type UpdateCustomFoodVariables = { id: number; payload: CustomFoodUpdatePayload }
export function useUpdateCustomFood(): UseMutationResult<CustomLibraryFood, Error, UpdateCustomFoodVariables>

export type CustomFoodNameCheck = { checking: boolean; taken: boolean }
export function useCustomFoodNameCheck(
  food: CustomLibraryFood,
  name: string,
  delayMs: number
): CustomFoodNameCheck
```

`frontend/src/features/diary/schemas.ts` (añadidos):
```ts
export type CustomFoodEditValues = {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
}
export const customFoodEditSchema   // z.object({...cinco z.string()}).superRefine(...), sin «grams»
```
La validación de nombre y de los valores por 100 g de `customFoodFormSchema` se saca a una función interna
(`addCustomFoodIssues(values, ctx)`, no exportada) que usan los dos esquemas, con los mismos mensajes y la misma ruta
`macroSum` para la suma de macros. `customFoodFormSchema` y `customItemPayload` no cambian de comportamiento.

`frontend/src/features/diary/customFoodEdit.ts` (nuevo):
```ts
// Valores del formulario a partir del alimento (números con coma decimal, como gramsText).
export function customFoodEditDefaults(food: CustomLibraryFood): CustomFoodEditValues
// Cuerpo del PATCH: nombre sin los espacios de los extremos y los cuatro números (solo con valores válidos).
export function customFoodEditPayload(values: CustomFoodEditValues): CustomFoodUpdatePayload
// REQ-008: true si el nombre recortado es idéntico y los cuatro campos son el mismo número; un campo no válido es un cambio.
export function isCustomFoodEditUnchanged(values: CustomFoodEditValues, food: CustomLibraryFood): boolean
// Review F4: texto de la región de estado de «Nombre» tras pulsar Intro mientras se comprueba el nombre.
export const CUSTOM_FOOD_NAME_CHECKING_MESSAGE = "Comprobando el nombre…"
```

`frontend/src/features/diary/errors.ts` (añadidos):
```ts
export const CUSTOM_FOOD_NAME_TAKEN_MESSAGE = "Ya tienes un alimento con ese nombre."
export const UPDATE_CUSTOM_FOOD_FAILED_MESSAGE = "No se pudo guardar el alimento."
export const CUSTOM_FOOD_NOT_FOUND_MESSAGE = "No encontramos ese alimento."
export type UpdateCustomFoodErrorView =
  | { kind: "name_taken" }                      // 409
  | { kind: "not_found"; message: string }      // 404, CUSTOM_FOOD_NOT_FOUND_MESSAGE
  | { kind: "message"; message: string }        // 400: mensaje del servidor; el resto: UPDATE_CUSTOM_FOOD_FAILED_MESSAGE
export function updateCustomFoodErrorView(error: unknown): UpdateCustomFoodErrorView
```

`frontend/src/features/diary/proposal.ts` (añadido):
```ts
// Si la entrada es ese alimento propio (custom con el mismo customFoodId), la misma entrada (misma key y gramos)
// con el nombre y los valores por 100 g editados; si no, null.
export function applyCustomFoodEdit(
  entry: ProposalFormEntry,
  food: CustomLibraryFood
): ProposalFormEntry | null
```

`frontend/src/features/diary/components/CustomFoodEditForm.tsx` (nuevo):
```ts
export function CustomFoodEditForm(props: {
  food: CustomLibraryFood
  isSaving: boolean
  serverError: string | null      // mensaje de un 400 o del error genérico, junto a los botones
  nameTakenKey: string | null     // clave de nombre rechazada con 409 (customFoodNameKey)
  onSubmit: (payload: CustomFoodUpdatePayload) => void
  onCancel: () => void
}): ReactElement
```

`frontend/src/features/diary/components/LibraryFoodList.tsx` (prop nueva, obligatoria):
```ts
onEdit: (food: CustomLibraryFood, trigger: HTMLButtonElement) => void
```
El botón lleva `data-edit-food-id={food.id}` para que el panel lo encuentre al devolver el foco (NFR-001).

`frontend/src/features/diary/components/FoodSearchPanel.tsx` (prop nueva, opcional):
```ts
onCustomFoodEdited?: (food: CustomLibraryFood) => void   // tras una edición con 200, con el alimento devuelto
```
La prop de la 028 `onCustomFoodDeleted?: (customFoodId: number) => void` no cambia de firma, pero amplía su
significado: «ese alimento propio ya no existe en la biblioteca». El panel la llama tras un borrado con éxito (028) y,
desde esta iteración, también tras un 404 al editar (review F2). Se actualiza su comentario en el tipo de props.

### 3.3 Lógica

**`FoodLibraryService.update_custom_food(user_id, custom_food_id, data)` (REQ-001 a REQ-004):**
1. `parsed = parse_custom_food_id(custom_food_id)`; si es `None` → `ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)`
   (AC-004.2).
2. `body = require_json_object(data)` (de `services/auth_input_rules.py`, como `MealService`) → 400
   `La petición no es válida` si no es un objeto (AC-002.1).
3. `fields = parse_custom_food_fields(body)` → los 400 de la 022 (AC-002.2 a AC-002.7). El orden es el de
   `_parse_custom_item`: primero el nombre, después `per_100g`.
4. `try:`
   - `_lock_user(user_id)` (bloqueo de la fila del usuario, ADR-0020). Serializa dos ediciones simultáneas del mismo
     usuario: la segunda espera y, al leer después, ve el nombre que guardó la primera (AC-003.3).
   - `food = custom_food_repository.get_by_id_and_user(parsed, user_id)`; si es `None` → 404 (AC-004.1, AC-004.3).
   - `key = custom_food_name_key(fields.name)`; si algún `get_by_name_keys(user_id, [key])` tiene `id != food.id` →
     `ConflictError(CUSTOM_FOOD_NAME_TAKEN_MESSAGE)` (409, AC-003.1). Su propio nombre con otras mayúsculas o tildes
     solo se encuentra a sí mismo (AC-001.3); los del catálogo y los de otros usuarios no están en esa consulta
     (AC-001.5, AC-003.2).
   - Asigna `food.name = fields.name`, `food.name_key = key` y los cuatro valores (`float`).
   - `favorite = favorite_repository.get_for_food(user_id, custom_food_id=food.id) is not None` (AC-001.1, AC-001.6).
   - `unit_of_work.commit()` y devuelve `_library_food("custom", food, favorite)`.
   - `except Exception: unit_of_work.rollback(); raise` (no queda nada a medias, REQ-002 y REQ-003).
5. No llama a proveedores externos ni usa `rate_limiter`.

Si el identificador tiene formato válido pero el cuerpo no es válido, responde el 400 antes de mirar si el alimento
existe (la validación del input va antes del bloqueo, como en `MealService.add_items`); la spec no fija ese orden.

**REQ-005 no necesita código:** cada `meal_item` ya guarda su copia (ADR-0036); recientes, favoritos y búsqueda leen
los valores actuales de `custom_foods` (028); `POST /api/meals` con `custom_food_id` copia los valores del momento
(`MealService._load_custom_foods`); `restore_item` recrea desde el `restore_token`, que lleva la copia del momento de
quitarlo, y vuelve a vincular el `cf` si el alimento existe (AC-005.4). Renombrar cambia `name_key`, así que registrar
después un personalizado con el nombre antiguo crea otro alimento (AC-003.4, regla de `_save_custom_foods`). Los tests
lo fijan.

**Frontend · clave de nombre (`customFoodNameKey`):** `name.normalize("NFKD")`, quitar las marcas combinantes
(`/\p{M}/gu`), `toLowerCase()`, partir por espacios y unir con uno. Es la misma regla que `custom_food_name_key` del
servidor (casefold + NFKD sin marcas) salvo casos raros de `casefold` (p. ej. «ß»); si difieren, decide el servidor con
el 409 (REQ-010).

**Frontend · `useCustomFoodNameCheck(food, name, delayMs)` (REQ-009):**
- `trimmed = name.trim()`, `key = customFoodNameKey(trimmed)`.
- `checkable = key !== customFoodNameKey(food.name) && trimmed.length >= 2 && trimmed.length <= 100`. Su propio
  nombre (AC-009.3) y los nombres de un carácter no se comprueban (la búsqueda exige 2) y dan `taken: false`.
- `const [debounced] = useDebouncedValue(checkable ? trimmed : "", delayMs)`;
  `query = checkable && debounced === trimmed ? trimmed : null`; `search = useFoodLibrarySearch(query)` (reutiliza la
  búsqueda conjunta de la 028, sin endpoint nuevo).
- `checking = checkable && (debounced !== trimmed || (query !== null && search.isPending))`.
- `taken = checkable && search.isSuccess && search.data.some(r => r.kind === "custom" && r.id !== food.id &&
  customFoodNameKey(r.name) === key)`. Los del catálogo no cuentan (AC-009.4); los propios no favoritos sí, porque la
  búsqueda recorre toda la biblioteca (AC-009.2).
- Si la búsqueda falla: `checking: false`, `taken: false` (AC-009.5).
- La búsqueda pone primero las coincidencias exactas (grupo `GROUP_EXACT` de la 023), así que un propio con la misma
  clave cae entre los 20 primeros salvo que haya más de 20 alimentos con ese mismo nombre (riesgo en la sección 6).

**Frontend · `useUpdateCustomFood`:** `mutationFn: ({ id, payload }) => updateCustomFood(id, payload)`; `onSuccess`
**devuelve** la promesa de `queryClient.invalidateQueries({ queryKey: foodLibraryKeys.all })`, como
`useSetFoodFavorite` y `useDeleteCustomFood`: la mutación sigue «pendiente» («Guardando…») hasta que llegan las listas
nuevas, así al cerrar el formulario ya se ven el nombre y los valores nuevos en el orden de cada lista (AC-010.2,
AC-010.7) y el panel puede decidir el foco. `onError`: si es un `ApiError` 404, invalida también `foodLibraryKeys.all`
(AC-010.4). Las comidas del diario no se invalidan (REQ-005).

**Frontend · regla de «cambio» (`isCustomFoodEditUnchanged`, REQ-008):** `values.name.trim() === food.name` (comparación
exacta: una mayúscula o una tilde es un cambio, AC-008.3; los espacios de los extremos no, AC-008.4) y, para cada campo
numérico, `parseDecimalText(texto) === food.per_100g[clave]` («6», «6,0» y «6.0» valen 6, AC-008.4). Un campo vacío o
no válido (`parseDecimalText` da `null`) cuenta como cambio (AC-008.5). (`food.name` ya viene recortado del servidor.)

**Frontend · `CustomFoodEditForm` (REQ-007 a REQ-010, NFR-001):**
- `useForm<CustomFoodEditValues>({ resolver: zodResolver(customFoodEditSchema), defaultValues:
  customFoodEditDefaults(food), mode: "onSubmit", reValidateMode: "onSubmit" })`; los valores se leen con `useWatch`.
  Los mensajes de validación salen al pulsar «Guardar», como en el formulario de la 022 (AC-007.5, AC-008.5).
- `<form aria-labelledby={titleId}>` con el título `Editar «{food.name}»` (nombre accesible del formulario,
  AC-N001.1), los cinco campos con las etiquetas de la spec (las de `CustomFoodForm` sin «Gramos») y los botones
  «Guardar» (`type="submit"`, «Guardando…» mientras `isSaving`) y «Cancelar» (`type="button"`).
- Al montar: `form.setFocus("name")` (AC-N001.1).
- **Foco tras un guardado fallido, un único mecanismo (review F3):** el efecto del formulario que, cuando `isSaving` pasa
  de `true` a `false` con el formulario aún montado, hace `form.setFocus("name")` (ref `wasSaving`). Es el único que
  devuelve el foco a «Nombre» tras un 409, un 400 o un error genérico. Se elimina del panel el contador
  `nameFocusTick`, su estado, sus `setNameFocusTick` en `saveEdit` y su efecto con `querySelector("form input[name='name']")`.
  Motivo: el formulario conoce su campo por react-hook-form, sin buscar en el DOM, y el caso de éxito y el de 404
  desmontan el formulario, así que ese efecto no actúa en ellos (y si llegara a actuar en el render intermedio, el
  `pendingFocus` o el `focusTrigger` del panel se ejecutan después y fijan el foco final). Si al quitar el del panel
  falla algún test de foco existente (AC-N001), se conserva el del panel y se quita el del formulario: nunca los dos.
- `check = useCustomFoodNameCheck(food, nameValue, SEARCH_DEBOUNCE_MS)`;
  `takenByServer = nameTakenKey !== null && customFoodNameKey(nameValue.trim()) === nameTakenKey`;
  `showTaken = check.taken || takenByServer`.
- Aviso: una región `<p id={takenId} role="status" aria-live="polite">` junto al campo «Nombre», siempre en el DOM y con
  el texto `CUSTOM_FOOD_NAME_TAKEN_MESSAGE` solo si `showTaken`; mientras se muestra, el campo «Nombre» lleva
  `aria-describedby` con `takenId` (además del id del mensaje de validación de `FormControl`, si lo hay; el implementer
  compone los dos ids porque la prop del `Input` sustituye a la del `Slot`) (AC-N001.5).
- «Guardar» deshabilitado si `isSaving || isCustomFoodEditUnchanged(values, food) || check.checking || showTaken`
  (REQ-008, REQ-009, AC-010.3). «Cancelar» deshabilitado mientras `isSaving`.
- `handleSubmit(values)` (lo llama `form.handleSubmit` solo si la validación zod pasa; si no, salen los mensajes de
  validación, como hoy): si `isSaving` o `blocked` por otro motivo no envía nada (AC-010.6, REQ-008, REQ-009); si no,
  `onSubmit(customFoodEditPayload(values))` (AC-010.1).
- **Intro mientras se comprueba el nombre (review F4):** si al enviar (Intro en un campo) `check.checking` es `true` y
  no hay guardado en curso, no se envía nada (REQ-009 sigue igual) pero se da una señal: el formulario guarda en un
  estado `checkingNoticeFor = values.name` y la misma región `role="status"` de «Nombre» muestra
  `CUSTOM_FOOD_NAME_CHECKING_MESSAGE` («Comprobando el nombre…») mientras
  `!showTaken && check.checking && checkingNoticeFor === values.name` (valor derivado, sin efecto). Cuando la
  comprobación termina, el texto desaparece solo: si el nombre está repetido, la región pasa a mostrar el aviso de
  REQ-009; si no, queda vacía y «Guardar» se habilita, y el usuario vuelve a pulsar Intro o «Guardar» (**no** hay envío
  automático al terminar la comprobación). Si el usuario cambia el nombre, el texto también desaparece. El campo
  «Nombre» no añade `takenId` a `aria-describedby` por este texto (solo por el aviso, AC-N001.5); la región `aria-live`
  ya lo anuncia. Intro con el formulario sin cambios o con el aviso de nombre repetido visible sigue sin hacer nada y
  sin texto nuevo (el botón deshabilitado y el aviso ya son la señal). Con `isSaving`, Intro tampoco muestra este texto.
- `useEscapeCapture(() => { if (!isSaving) onCancel() }, true)`: Escape cierra solo el formulario y no llega a Radix
  (no cierra «Añadir a {sección}» ni abre la confirmación de descartar la propuesta, AC-007.3 y AC-007.4); con el
  guardado en curso se consume sin hacer nada.
- `serverError` se pinta con `role="alert"` bajo los botones.

**Frontend · `FoodSearchPanel` (REQ-006, REQ-007, REQ-010, NFR-001):**
- El estado `target` de la 028 pasa a ser un único elemento en línea:
  `type InlineTarget = { mode: "delete" | "edit"; food: CustomLibraryFood; list: ListLabel; trigger: HTMLButtonElement;
  query: string }`. `confirming` se mantiene para el modo `delete`. Abrir uno sustituye al otro sin guardar ni borrar
  (AC-007.6): `startEdit(list)` y `startDelete(list)` hacen `reset()` de las dos mutaciones y fijan el `target`. Mientras
  hay un guardado o un borrado en curso, abrir otro no hace nada (para no cerrar un formulario a medio guardar).
- `renderInline(list)`: si el `target` es de esa lista y de ese alimento, en modo `delete` pinta lo de la 028; en modo
  `edit`, `<CustomFoodEditForm food={target.food} … />` dentro del elemento (AC-007.1, AC-007.7). Cada apertura monta un
  formulario nuevo con los valores actuales (AC-007.2).
- El efecto de la 028 que cierra en silencio si cambia el texto de la caja o el alimento deja de mostrarse vale para los
  dos modos (AC-007.8); no actúa con la mutación correspondiente pendiente o terminada con éxito (como hoy con
  `isDeleting` y `deleted`).
- `cancelEdit()`: cierra y devuelve el foco al botón «Editar» (`focusTrigger`, que ya cae a la caja si el botón no está)
  (AC-007.2, AC-N001.2).
- `saveEdit(payload)`: `updateFood.mutate({ id: target.food.id, payload }, …)`:
  - `onSuccess(food)`: `onCustomFoodEdited?.(food)`; cierra el formulario y guarda
    `pendingFocus = { list, id: food.id }`. Un efecto, tras pintar, busca en el contenedor del panel (`ref` en su `div`
    raíz) `ul[aria-label="{list}"] button[data-edit-food-id="{id}"]`: si está, lo enfoca (AC-N001.3); si no, enfoca la
    caja de búsqueda (AC-N001.4).
  - `onError(error)`: `updateCustomFoodErrorView(error)`:
    - `name_taken`: el formulario sigue abierto; `nameTakenKey = customFoodNameKey(payload.name)` (AC-010.3).
    - `not_found`: llama a `onCustomFoodDeleted?.(current.food.id)` (review F2: el alimento ya no existe, así que las
      filas de la propuesta de foto que lo usaban se desvinculan con el `unlinkDeleted`/`unlinkCustomFood` de la 028,
      igual que tras borrarlo; conservan el nombre, los valores **anteriores** a la edición fallida y los gramos, pasan
      a «Personalizado» sin `customFoodId` y al guardar se envían con `name` y `per_100g`, que vuelve a crear el
      alimento propio con la regla de la 028). Después cierra el formulario, muestra el mensaje en un
      `<p role="alert">` del panel (junto al de favoritos) y devuelve el foco con `focusTrigger` (AC-010.4). El aviso
      se borra al abrir otro elemento en línea o al cambiar el texto de la caja. Con 409, 400 o error genérico no se
      llama a `onCustomFoodDeleted` (el alimento sigue existiendo).
    - `message`: el formulario sigue abierto con `serverError = message` y lo escrito (AC-010.5).
    - En los dos casos en que el formulario sigue abierto, el foco va al campo «Nombre» (los botones estuvieron
      deshabilitados durante el guardado y el foco no debe quedarse en el cuerpo, NFR-001). Lo hace solo el efecto
      `wasSaving` de `CustomFoodEditForm` (review F3); `saveEdit` no gestiona ese foco.
- `listProps(list)` añade `onEdit: startEdit(list)`.

**Frontend · `LibraryFoodList` (REQ-006):** en los `custom`, tras la estrella y antes de «Borrar», un `Button`
`variant="ghost" size="sm"` con texto «Editar», `aria-label={\`Editar ${food.name}\`}`, `data-edit-food-id={food.id}`,
`disabled={disabled}` y `onClick={(event) => onEdit(food, event.currentTarget)}`. Los del catálogo no lo tienen.

**Frontend · `PhotoReview` (REQ-011):** pasa `onCustomFoodEdited={applyEdited}` al `FoodSearchPanel` de su vista de
búsqueda. `applyEdited(food)` hace `replace(entries.map(entry => applyCustomFoodEdit(entry, food) ?? entry))`, igual que
`unlinkDeleted` de la 028. Conserva `key` y gramos, así `mergeProposalEntries` sigue emparejando los gramos por clave y
los totales se recalculan con `proposalTotals` (AC-011.1). La fila sigue con `customFoodId`, así que al guardar va como
`{ custom_food_id, grams }` (AC-011.2, `proposalItems` de la 028). Las filas de otros alimentos no cambian (AC-011.3).
Si la edición responde 404, el panel llama a `onCustomFoodDeleted` y `PhotoReview` desvincula esas filas con el
`unlinkDeleted` que ya existe (review F2); `PhotoReview.tsx` no necesita cambios para ello, ya pasa
`onCustomFoodDeleted={unlinkDeleted}`. Así ninguna fila queda con un `customFoodId` que ya no existe, que el servidor
rechazaría al guardar la propuesta.

### 3.4 Interfaz de usuario
- **Botón «Editar»** en cada alimento propio de «Favoritos», «Recientes» y «Resultados», en este orden: «Elegir», la
  estrella, «Editar» y «Borrar» (AC-006.1, AC-006.2). La búsqueda de la propuesta de foto es el mismo `FoodSearchPanel`
  (AC-006.3).
- **Formulario en línea** dentro del `<li>` del alimento, bajo sus botones (donde hoy va la confirmación de borrado),
  con borde (`rounded-lg border p-4`, sin el color destructivo): título «Editar «{nombre}»», campos «Nombre»,
  «Calorías por 100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)» y «Grasa por 100 g (g)» (texto,
  `inputMode="decimal"` en los números, `maxLength` 100 en el nombre), el aviso de nombre repetido bajo «Nombre», el
  error de la suma de macros bajo «Grasa» (como en `CustomFoodForm`) y los botones «Guardar» y «Cancelar». Sin vista
  previa de la porción (no hay gramos) ni el aviso `CUSTOM_FOOD_LIBRARY_NOTICE`.
- **Estados:** «Guardar» deshabilitado sin cambios, con el nombre repetido, mientras se comprueba el nombre y mientras
  se guarda («Guardando…», con «Cancelar» también deshabilitado). Mensajes del servidor y genérico bajo los botones;
  «No encontramos ese alimento.» en el panel tras cerrar el formulario. Si se pulsa Intro mientras se comprueba el
  nombre, bajo «Nombre» sale «Comprobando el nombre…» hasta que termina la comprobación (review F4).
- El resto de la búsqueda (caja, otras listas, otros alimentos) sigue visible y usable mientras el formulario está
  abierto.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `PATCH /api/food-library/custom/<id>` (`food_library_routes.update_custom_food`) → `FoodLibraryService.update_custom_food` (pasos 4: asignación, favorito, `commit`) → `library_food_to_json` |
| REQ-002 | `require_json_object` y `meal_rules.parse_custom_food_fields` (compartida con `_parse_custom_item`), antes de tocar nada |
| REQ-003 | `update_custom_food`: `custom_food_name_key` + `get_by_name_keys` excluyendo su id → `ConflictError(CUSTOM_FOOD_NAME_TAKEN_MESSAGE)`; bloqueo de la fila del usuario para la concurrencia |
| REQ-004 | `parse_custom_food_id` y `get_by_id_and_user` → `ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)`; `@require_auth` |
| REQ-005 | Sin código nuevo: copia de `meal_items` (ADR-0036), lecturas de la 028, `_load_custom_foods` y `restore_item`; fijado por tests de integración |
| REQ-006 | `LibraryFoodList` (botón «Editar» con `onEdit`) y `FoodSearchPanel.listProps` |
| REQ-007 | `CustomFoodEditForm` (campos, `customFoodEditSchema`, `customFoodEditDefaults`, `useEscapeCapture`) y `FoodSearchPanel` (`InlineTarget` único, `renderInline`, efecto de cierre) |
| REQ-008 | `isCustomFoodEditUnchanged` en `customFoodEdit.ts`, usado para deshabilitar «Guardar» |
| REQ-009 | `useCustomFoodNameCheck` (búsqueda conjunta + `customFoodNameKey`) y aviso en `CustomFoodEditForm` |
| REQ-010 | `useUpdateCustomFood` (invalidación de `foodLibraryKeys.all`), `customFoodEditPayload`, `updateCustomFoodErrorView` y `FoodSearchPanel.saveEdit` |
| REQ-011 | `FoodSearchPanel.onCustomFoodEdited` → `PhotoReview.applyEdited` → `proposal.applyCustomFoodEdit`; con 404, `FoodSearchPanel.onCustomFoodDeleted` → `PhotoReview.unlinkDeleted` → `proposal.unlinkCustomFood` (review F2) |
| NFR-001 | `CustomFoodEditForm` (`aria-labelledby`, `setFocus("name")`, aviso con `role="status"` y `aria-describedby`, único efecto de foco a «Nombre» tras un error, texto «Comprobando el nombre…» tras Intro durante la comprobación) y `FoodSearchPanel` (`focusTrigger`, `pendingFocus` con `data-edit-food-id`) |

### Correcciones de la review (iteración 2)
| Hallazgo | Resolución en el plan | Archivos |
|---|---|---|
| F1 (NIT) | Errata de formato en `RecentFood` (sección 3.2, `types.ts`) | `frontend/src/features/food-library/types.ts` |
| F2 (MENOR) | Tras un 404 al editar, el panel llama a `onCustomFoodDeleted` y la propuesta desvincula sus filas (secciones 3.2 y 3.3) | `frontend/src/features/diary/components/FoodSearchPanel.tsx` (y sus tests y los de `MealPhotoDialog`) |
| F3 (NIT) | Un único mecanismo de foco a «Nombre» tras un guardado fallido: el efecto `wasSaving` de `CustomFoodEditForm`; se quita `nameFocusTick` del panel (sección 3.3) | `FoodSearchPanel.tsx`, `CustomFoodEditForm.tsx` |
| F4 (NIT) | Intro durante la comprobación del nombre: no envía, muestra «Comprobando el nombre…» en la región de estado, sin envío automático (sección 3.3) | `frontend/src/features/diary/customFoodEdit.ts`, `CustomFoodEditForm.tsx` |

Ninguna cambia requisitos ni AC de la spec: F2 aplica a la edición la desvinculación que la 028 ya hace al borrar y
mantiene AC-010.4; F4 añade una señal sin cambiar REQ-009 ni AC-010.6. No hay cambios en el backend.

## 5. Estrategia de pruebas
Marcadores `# SDD: 029 REQ-… AC-…` y `// SDD: 029 REQ-… AC-…` (Art. P1.1). Ningún test llama a servicios externos
(Art. B5.4).

### backend
Entorno: Postgres de prueba (`TEST_DATABASE_URL`, `docker compose up -d postgres redis`). Sin Redis real ni
proveedores: estos endpoints no los usan.

**Unitarios (`backend/tests/test_services/`), con fakes escritos a mano (Art. P1.backend.3), sin `unittest.mock`:**
- `test_meal_rules.py`: `parse_custom_food_fields` con cada caso de la tabla de errores (nombre ausente, vacío, solo
  espacios, 100 y 101 caracteres recortados, `per_100g` ausente o incompleto, calorías -1 y 901, macros -1 y 101, suma
  de 40 + 40 + 30) y el recorte del nombre (AC-002.2 a AC-002.7, parte de AC-001.1).
- `test_food_library_service.py`: `FoodLibraryService` con `FakeCatalogFoodRepository`, `FakeCustomFoodRepository`,
  `FakeFoodFavoriteRepository`, `FakeMealRepository`, `FakeLockingUserRepository` y `FakeUnitOfWork` de
  `tests/fakes.py` (y `make_custom_food`, `make_favorite`):
  - edición correcta: nombre recortado, valores, mismo id, `favorite` según el favorito, `commit` hecho
    (AC-001.1, AC-001.4, AC-001.6);
  - su propio nombre con otras mayúsculas no es conflicto (AC-001.3); un nombre del catálogo tampoco (AC-001.5);
  - conflicto con otro propio del mismo usuario → `ConflictError` con el mensaje, `rollback` y ningún alimento cambia
    (AC-003.1); el de otro usuario no cuenta (AC-003.2);
  - 404: id no válido (`"abc"`, `"0"`, `"2147483648"`), inexistente, de otro usuario (AC-004.1, AC-004.2);
  - cuerpo que no es un objeto (texto, `None`, lista) → `ValidationError` `La petición no es válida` y nada cambia
    (AC-002.1);
  - bloquea la fila del usuario antes de leer el alimento (`FakeLockingUserRepository`).
- Dobles nuevos: ninguno. Los fakes de la 028 bastan: el servicio modifica el objeto que devuelve
  `get_by_id_and_user`. Si hace falta ver que no cambió tras un error, el test compara los atributos del objeto
  precargado.

**Integración (`backend/tests/test_routes/`, fixture `client` de `tests/conftest.py`):**
- `test_food_library_routes.py`:
  - AC-001.1 a AC-001.6 de punta a punta, incluido AC-001.2 (favoritos y `search?q=gallo` tras editar);
  - AC-002.1 (cuerpo `"hola"`, `null`, lista y JSON malformado enviado con `data=` y `content_type="application/json"`)
    a AC-002.7, comprobando en la base que el alimento no cambia;
  - AC-003.1 y AC-003.2; **AC-003.3** con dos `PATCH` simultáneos («Avena» → «Batido» y «Banano» → «Batido»), adaptando
    el patrón de `concurrent_posts` de `test_meal_library_routes.py` (bloqueo de la fila del usuario desde otra
    conexión, espera a que las dos peticiones esperen el bloqueo con `pg_stat_activity` y liberación): una 200, otra
    409, ninguna 500 y un solo «Batido» en `custom_foods`. El helper se copia al archivo o se extrae a un módulo de
    utilidades de tests; decide el test-author;
  - AC-004.1 a AC-004.4 (otro usuario, ids no válidos, alimento borrado con `DELETE /custom/<id>`, sin cabecera y con
    token caducado, con los helpers de token que ya usen los tests de la 028).
- `test_meal_library_routes.py` (REQ-005): AC-005.1 (diario del día con la copia y el mismo `custom_food_id`),
  AC-005.2 (recientes con los valores nuevos y `last_grams`), AC-005.3 (`POST /api/meals` con `custom_food_id` copia
  los editados), AC-005.4 (`DELETE …?undo=1`, editar y `POST /api/meals/restore`) y AC-003.4 (renombrar y registrar
  después un personalizado con el nombre antiguo crea otro alimento propio). El reloj se fija con el `AdjustableClock`
  de los tests (`TESTING`) para el día «27 de octubre».

### frontend
Vitest con `globals: false` (Art. P1.frontend.2); la red se simula con `vi.mock("@/features/food-library/api", …)` y,
donde ya se hace, con los mocks de `@/features/diary/api` (Art. P1.frontend.4). Los mocks existentes de
`@/features/food-library/api` deben añadir `updateCustomFood` en las fábricas de los archivos que lo usen.

- `food-library/names.test.ts`: `customFoodNameKey` con mayúsculas, tildes, espacios en los extremos y repetidos
  («  ARROZ con   pollo de mama » = «Arroz con pollo de mamá»).
- `food-library/api.test.ts`: `updateCustomFood` hace `PATCH /api/food-library/custom/12` con el cuerpo y valida la
  respuesta (mock de `apiFetch` como en los tests actuales de ese archivo).
- `food-library/hooks.test.tsx`: `useCustomFoodNameCheck` con `QueryClientProvider` y temporizadores falsos:
  `checking` durante el retardo y la petición, `taken` solo con otro propio de la misma clave, no con el mismo id ni con
  un `catalog`, y `taken: false`/`checking: false` si la búsqueda falla (AC-009.1 a AC-009.5); `useUpdateCustomFood`
  invalida `foodLibraryKeys.all` tras el 200 y tras un 404 (AC-010.4).
- `diary/schemas.test.ts`: `customFoodEditSchema` con los mensajes de la 022 (AC-007.5, AC-008.5) y que
  `customFoodFormSchema` sigue igual tras extraer la validación compartida.
- `diary/customFoodEdit.test.ts`: `customFoodEditDefaults` (180 → «180», 6,5 → «6,5»), `customFoodEditPayload`
  (nombre recortado, números) e `isCustomFoodEditUnchanged` (AC-008.1 a AC-008.5).
- `diary/errors.test.ts`: `updateCustomFoodErrorView` para 409, 404, 400, 500 y un error de red.
- `diary/proposal.test.ts`: `applyCustomFoodEdit` (misma `key` y gramos, nombre y valores nuevos; `null` con otro id,
  con un `catalog` o con un `custom` sin `customFoodId`).
- `diary/components/CustomFoodEditForm.test.tsx`: el formulario aislado, con `useCustomFoodNameCheck` real y la búsqueda
  simulada: título y nombre accesible, foco en «Nombre», valores iniciales, «Guardar» habilitado o no (REQ-008,
  REQ-009), aviso con `aria-describedby` y región `role="status"` (AC-N001.5), `nameTakenKey` (AC-010.3), sin
  petición con errores de validación (AC-007.5), Intro con `isSaving` sin `onSubmit` (AC-010.6), Escape llama a
  `onCancel`.
- `diary/components/FoodSearchPanel.test.tsx` (bloques nuevos): orden de botones y ausencia en el catálogo
  (AC-006.1, AC-006.2); el formulario en el elemento y la lista correctos (AC-007.1, AC-007.7); «Cancelar» y vuelta a
  abrir (AC-007.2); alternar con la confirmación de borrado (AC-007.6); cierre al escribir o plegar (AC-007.8); guardar:
  cuerpo enviado, «Guardando…», listas nuevas y orden (AC-010.1, AC-010.2, AC-010.7); 409, 404 y 500 (AC-010.3 a
  AC-010.5); doble envío (AC-010.6); foco al cancelar, al guardar y cuando el alimento ya no está en «Resultados»
  (AC-N001.1 a AC-N001.4); `onCustomFoodEdited` recibe el alimento devuelto.
- `diary/components/AddFoodDialog.test.tsx`: AC-007.3 (Escape cierra el formulario y el diálogo sigue abierto; un
  segundo Escape cierra el diálogo).
- `diary/components/MealPhotoDialog.test.tsx`: AC-006.3, AC-007.4 (Escape sin confirmación de descartar y con el texto
  de la búsqueda), AC-011.1 a AC-011.3 (fila actualizada con 250 g y 500 kcal, total, cuerpo de «Guardar en
  {sección}» con `custom_food_id`, y filas ajenas sin cambios).
- Dobles nuevos: ninguno; se reutilizan los mocks de las APIs y las fábricas de alimentos de esos archivos.

**Casos nuevos por las correcciones de la review (iteración 2).** Se añaden a los archivos de arriba, con marcador
`SDD: 029` y el REQ/AC más cercano; los tests existentes no se modifican (Art. B5.3):
- **F2 · `diary/components/FoodSearchPanel.test.tsx`** (`// SDD: 029 REQ-010 AC-010.4`): con `onCustomFoodDeleted`
  espiado (como `renderWithDeletedCallback` de la 028), editar «Gallo pinto» (id 12) y que `updateCustomFood` rechace
  con un `ApiError` 404 → `onCustomFoodDeleted` se llama una vez con `12`; con 409, 400 y 500 no se llama;
  con 200 tampoco (solo `onCustomFoodEdited`).
- **F2 · `diary/components/MealPhotoDialog.test.tsx`** (`// SDD: 029 REQ-011 AC-010.4`), siguiendo el test de la 028
  «al borrar un propio que ya está en la propuesta…»: propuesta con el propio «Gallo pinto» (id 12) con 250 g,
  «Añadir otro alimento», editar «Gallo pinto» a «Gallo pinto con huevo» con 200 kcal y que la edición responda 404,
  «Volver a la propuesta» → la fila sigue con «Gallo pinto», 250 g, «Personalizado» y los valores anteriores (450 kcal
  con 180 kcal por 100 g), y «Guardar en {sección}» la envía como `{ name: "Gallo pinto", grams: 250, per_100g: {…} }`
  sin `custom_food_id`; las filas de otros alimentos no cambian.
- **F3 · `diary/components/CustomFoodEditForm.test.tsx`** (`// SDD: 029 NFR-001`): renderizado con `isSaving: true`,
  foco en otro elemento, y rerender con `isSaving: false` → el foco va a «Nombre». Los tests existentes de foco tras
  409 y 500 en `FoodSearchPanel.test.tsx` deben seguir pasando sin cambios con el único mecanismo.
- **F4 · `diary/components/CustomFoodEditForm.test.tsx`** (`// SDD: 029 REQ-009 AC-010.6`), con la búsqueda simulada
  con una promesa que el test resuelve a mano:
  - cambiar el nombre a uno nuevo y pulsar Intro en «Nombre» mientras la búsqueda está pendiente → `onSubmit` no se
    llama y la región `role="status"` muestra «Comprobando el nombre…»; al resolver la búsqueda sin coincidencias,
    el texto desaparece, `onSubmit` sigue sin llamarse y «Guardar» está habilitado; pulsar «Guardar» llama a
    `onSubmit` una vez;
  - lo mismo, pero la búsqueda devuelve otro propio con la misma clave → la región muestra el aviso «Ya tienes un
    alimento con ese nombre.» y no «Comprobando el nombre…»;
  - tras el Intro durante la comprobación, cambiar el nombre → el texto desaparece;
  - Intro sin cambios o con `isSaving: true` → sin texto «Comprobando el nombre…» y sin `onSubmit`.
- **F1:** sin test (solo formato); lo cubren `npm run lint` y `npx tsc -b`.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La comprobación del nombre en el cliente no ve un propio con la misma clave (más de 20 coincidencias exactas, nombre de un carácter o solo con puntuación, diferencias raras de `casefold`) | Baja | Bajo | El servidor siempre comprueba y responde 409; el formulario muestra el aviso y deshabilita «Guardar» (REQ-010, Q7) |
| Dos ediciones simultáneas hacia el mismo nombre dan un 500 por la restricción única | Baja | Medio | Bloqueo de la fila del usuario antes de leer (ADR-0020); test de concurrencia de AC-003.3 con el patrón ya probado en la 028 |
| El foco se queda en el cuerpo al deshabilitar los botones durante el guardado o al reordenar las listas | Media | Medio | Foco explícito tras cada resultado (botón «Editar» por `data-edit-food-id`, caja de búsqueda o campo «Nombre»); tests de AC-N001.1 a AC-N001.4 |
| Generalizar el estado de la confirmación de borrado rompe la 028 | Media | Medio | Mismo efecto de cierre y mismas funciones de foco; los tests existentes de `FoodSearchPanel` deben seguir pasando sin cambios (Art. B5.3) |
| Extraer `parse_custom_food_fields` y la validación compartida del esquema cambia mensajes u orden de la 022 | Baja | Medio | Refactor sin cambio de comportamiento; los tests de la 022 y la 028 (`test_meal_rules.py`, `schemas.test.ts`) siguen pasando |
| Quitar `nameFocusTick` deja el foco en el cuerpo en algún caso de error (F3) | Baja | Medio | El efecto `wasSaving` cubre 409, 400 y genérico; los tests de foco existentes deben pasar sin cambios y, si no, se conserva el mecanismo del panel en su lugar (nunca los dos) |
| Un 404 de edición por un fallo transitorio desvincula filas de un alimento que sí existe (F2) | Muy baja | Bajo | El servidor solo da 404 si el id no es válido o el alimento no existe o no es del usuario; es el mismo trato que la 028 da al borrado, y la fila se sigue guardando con `name` y `per_100g` (regla de la 028) |

## 7. Cumplimiento de la constitución
- **Art. B1, B4 y B5:** cambio funcional con spec aprobada; cada AC tiene test en la sección 5 con marcador `SDD: 029`;
  esqueletos con las firmas de la sección 3.2; sin llamadas externas en los tests.
- **Art. P1:** tests backend en `test_services/` y `test_routes/` con fakes a mano, sin `unittest.mock` ni
  `monkeypatch`; frontend junto a cada archivo, con `vitest` importado y la red simulada en `api.ts`.
- **Art. P2.backend:** capas respetadas (la ruta solo parsea y serializa; reglas en `meal_rules`/`food_library_rules`;
  lógica en el servicio; solo `UnitOfWork` hace `commit`/`rollback`); dependencias por constructor desde
  `_build_food_library_service()` (sin cambios); errores con `ValidationError`, `ResourceNotFoundError` y
  `ConflictError`. Sin cambios de modelo (P2.4 no aplica). Se reutilizan `require_json_object`,
  `parse_custom_food_id`, `custom_food_name_key` y la validación de la 022 en lugar de duplicarlas (P2.5).
- **Art. P2.frontend:** organización por feature; HTTP solo por `apiFetch`; estado de servidor con TanStack Query
  (claves de `foodLibraryKeys`) y formulario con react-hook-form y zod; componentes shadcn de `src/components/ui/`.
  `names.ts` y `customFoodEdit.ts` son módulos de lógica de la feature, como `proposal.ts` o `format.ts`.
- **Art. P3:** `@require_auth` y filtro por el `user_id` del token (P3.1); validación en el servicio y con zod (P3.2);
  sin proveedores de IA (P3.3 no aplica); solo ORM (P3.4); sin variables nuevas (P3.5).
- **Art. P4:** sin migración ni pasos manuales en producción.
- **Art. P5:** archivos en LF; sin ADRs ni archivos de datos.
- No hay ningún «DEBERÍA» incumplido.

## 8. ADRs
Ninguna. La edición sigue las decisiones de ADR-0036 (biblioteca única por usuario y nombre normalizado, copia en
`meal_items`, confirmación en línea con Escape en captura) y de ADR-0020 (bloqueo de la fila del usuario). La
comprobación del nombre en el cliente reutiliza la búsqueda conjunta existente y es solo una ayuda: la regla la aplica
el servidor.
