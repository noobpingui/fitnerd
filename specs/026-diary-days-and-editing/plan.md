# Plan 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-27)
- **Ámbitos:** backend, frontend

## 1. Resumen de la solución

- **Backend:** se amplía la ventana de `check_add_window` (de −366 a +1 días) con el mensaje nuevo, y se añade
  «Deshacer» sin estado (ADR-0035): `DELETE /api/meals/{id}/items/{item_id}?undo=1` devuelve un `restore_token` (copia
  del alimento firmada con HMAC y ligada al usuario) y `POST /api/meals/restore` lo recrea en la misma comida, día y
  posición. Sin `undo=1`, el `DELETE` sigue respondiendo 204 (spec 022). Capas `routes → services → repositories`, el
  firmante entra por constructor desde `_build_meal_service()` y no hay migración.
- **Frontend:** `DiaryPage` lee el día de `?date=` (`useSearchParams`, siempre con `replace`), mantiene «hoy» con
  `useToday` (comprueba cada 30 s y al volver la pestaña visible, en pausa mientras hay un diálogo abierto) y muestra
  siempre la cabecera y la navegación (`DiaryDateNav`). El contenido del día va en `DiaryDayView`, montado con
  `key={date}`, que contiene los totales, las secciones y el estado de «Deshacer» (`useRemovalUndo`). Se añaden
  «Borrar comida» con confirmación (`DeleteMealDialog` sobre `ConfirmDialog` y el `AlertDialog` de shadcn), las barras en
  ámbar (`NutrientProgress` con `over`) y la confirmación al descartar la propuesta en `MealPhotoDialog`.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | utils | `backend/utils/restore_token.py` | — | `RestoreTokenSigner`: firma y verifica el token de restauración (ADR-0035) |
| backend | services (reglas) | — | `backend/services/meal_rules.py` | Mensaje y límites nuevos de la ventana; `RemovedItemSnapshot`, `snapshot_payload`, `parse_snapshot_payload`, `epoch_seconds`, constantes |
| backend | services | — | `backend/services/meal_service.py` | `restore_signer` en el constructor; `remove_item` devuelve el token; `restore_item` nuevo |
| backend | routes | — | `backend/routes/meal_routes.py` | `?undo=1` en `DELETE …/items/{item_id}`; `POST /api/meals/restore`; `_build_meal_service()` inyecta el firmante |
| backend | tests | `backend/tests/test_services/test_restore_token.py` | `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py`, `backend/tests/test_routes/test_meal_routes.py` | Tests nuevos y actualización de los de la ventana de la 022 que la 026 sustituye |
| frontend | UI compartida | `frontend/src/components/ui/alert-dialog.tsx` | — | Envoltorio shadcn de `AlertDialog` de `radix-ui` (ya instalado, sin dependencias nuevas) |
| frontend | diary: lógica pura | `frontend/src/features/diary/days.ts` | `frontend/src/features/diary/format.ts`, `frontend/src/features/diary/constants.ts`, `frontend/src/features/diary/errors.ts`, `frontend/src/features/diary/types.ts`, `frontend/src/features/diary/schemas.ts` | Fechas navegables, formato con año, constantes, mensajes, tipo `RemovalUndo`, esquema de la respuesta de quitar |
| frontend | diary: red y estado | — | `frontend/src/features/diary/api.ts`, `frontend/src/features/diary/hooks.ts` | `removeMealItem` con `undo=1`, `restoreMealItem`, `deleteMeal`; hooks `useRestoreMealItem`, `useDeleteMeal`, `useToday`, `useRemovalUndo` |
| frontend | diary: componentes | `frontend/src/features/diary/components/DiaryDateNav.tsx`, `frontend/src/features/diary/components/DiaryDayView.tsx`, `frontend/src/features/diary/components/ConfirmDialog.tsx`, `frontend/src/features/diary/components/DeleteMealDialog.tsx` | `frontend/src/features/diary/components/MealSection.tsx`, `frontend/src/features/diary/components/NutrientProgress.tsx`, `frontend/src/features/diary/components/DailyTotals.tsx`, `frontend/src/features/diary/components/MealPhotoDialog.tsx` | Navegación, día keyed, «Borrar comida», aviso de «Deshacer», ámbar y confirmación de descarte |
| frontend | diary: página | — | `frontend/src/features/diary/pages/DiaryPage.tsx` | Día desde la dirección, `useToday`, cabecera y navegación siempre visibles |
| frontend | tests | `frontend/src/features/diary/days.test.ts`, `frontend/src/features/diary/hooks.test.tsx`, `frontend/src/features/diary/components/DiaryDateNav.test.tsx`, `frontend/src/features/diary/components/DeleteMealDialog.test.tsx` | `frontend/src/features/diary/api.test.ts`, `frontend/src/features/diary/format.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/features/diary/components/MealPhotoDialog.test.tsx` | Tests nuevos y actualización de los de la 022/025 que la 026 sustituye |

No cambian: modelos, repositorios, migraciones, `POST /api/meals/analyze`, `src/app/router.tsx` (la ruta `/diary`
ya existe; el parámetro `?date=` lo lee la página), variables de entorno ni `docs/deploy-runbook.md` (no hay paso
manual).

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No cambia ninguna tabla. El alimento restaurado es una fila nueva de `meal_items` (id nuevo) con los mismos
`position`, `source`, `catalog_id`, `fdc_id`, `name`, `data_type`, `grams` y `per_100g_*` que la quitada; los
nutrientes se recalculan con `portion_nutrients` (misma función y mismos datos que al guardarlo, así que dan lo mismo).
Si la comida se borró al quedarse vacía, se crea otra con el mismo usuario, fecha y tipo (la restricción única
`uq_meals_user_id_meal_date_meal_type` lo permite porque la anterior ya no existe).

### 3.2 Contratos e interfaces

#### API

| Método y ruta | Cambio | Entrada | Salida | Errores |
|---|---|---|---|---|
| `POST /api/meals` | Ventana nueva | Igual que en la 022/023 | Igual (201/200) | 400 `{"error": "Solo puedes registrar comidas de hoy o del último año."}` si `date` está fuera de `[hoy − 366, hoy + 1]` (reloj del servidor); 400 «La fecha no es válida.» como antes |
| `DELETE /api/meals/{meal_id}/items/{item_id}` | Parámetro opcional `undo` | `?undo=1` (cualquier otro valor o ausente = comportamiento de la 022) | Con `undo=1`: **200** `{"restore_token": "<token>"}`. Sin él: **204** sin cuerpo | Iguales que en la 022 (404 comida/alimento ajeno o inexistente, 401 sin sesión) |
| `POST /api/meals/restore` | **Nuevo**, `@require_auth` | `{"restore_token": "<token>"}` | **201** si se creó la comida, **200** si ya existía; cuerpo = la comida serializada como en `POST /api/meals` (`_serialize_meal`) | 400 «La petición no es válida.» si el cuerpo no es un objeto JSON; 404 `{"error": "No encontramos ese alimento en la comida."}` si el token falta, no es texto, está alterado, caducó (120 s) o es de otro usuario; 400 «Una comida no puede tener más de 50 alimentos.» si la comida ya tiene 50; 401 sin sesión |
| `DELETE /api/meals/{meal_id}` | Sin cambios | — | 204 | 404 «No encontramos esa comida.» si es ajena o no existe; 401 sin sesión |

`GET /api/meals?date=` y `PATCH /api/meals/{id}/items/{item_id}` no cambian y siguen sin límite de fecha. La
restauración tampoco aplica la ventana (el alimento ya estaba en esa fecha).

**Token (ADR-0035):** `"<payload>.<firma>"`, `payload = base64url_sin_relleno(json.dumps(dict, separators=(",", ":"),
ensure_ascii=False).encode("utf-8"))`, `firma = base64url_sin_relleno(HMAC-SHA256(SECRET_KEY,
"meal-item-restore:v1:<user_id>:<payload>"))`. Diccionario del payload (claves exactas):

```json
{"v": 1, "d": "2026-10-20", "t": "breakfast", "p": 1, "s": "catalog", "c": "platano", "f": null,
 "n": "Plátano", "dt": null, "g": "120.0",
 "per": {"calories_kcal": 89.0, "protein_g": 1.1, "carbs_g": 22.8, "fat_g": 0.3}, "exp": 1792979000}
```

#### Backend: firmas exactas

`backend/utils/restore_token.py` (nuevo):

```python
MAX_RESTORE_TOKEN_LENGTH = 4096


class RestoreTokenSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def sign(self, user_id, payload: dict) -> str: ...
    # Devuelve "<payload_b64>.<firma_b64>".

    def verify(self, user_id, token: object) -> dict | None: ...
    # None si no es str, supera MAX_RESTORE_TOKEN_LENGTH, no tiene exactamente un ".",
    # la firma no coincide (hmac.compare_digest) o el payload no es JSON de un objeto.
```

`backend/services/meal_rules.py` (añadidos y cambios):

```python
DATE_OUT_OF_WINDOW_MESSAGE = "Solo puedes registrar comidas de hoy o del último año."  # cambia
ADD_WINDOW_PAST_DAYS = 366
ADD_WINDOW_FUTURE_DAYS = 1
RESTORE_TOKEN_TTL_SECONDS = 120


@dataclass(frozen=True)
class RemovedItemSnapshot:
    meal_date: date
    meal_type: str
    position: int
    source: str                      # "catalog" | "usda" | "custom"
    catalog_id: str | None
    fdc_id: int | None
    name: str
    data_type: str | None
    grams: Decimal
    per_100g: dict[str, float | None]  # claves NUTRIENT_KEYS
    expires_at: int                  # segundos desde 1970-01-01 (UTC)


def check_add_window(meal_date: date, today: date) -> None: ...
# Acepta today - 366 días <= meal_date <= today + 1 día; si no, ValidationError(DATE_OUT_OF_WINDOW_MESSAGE).

def epoch_seconds(instant: datetime) -> int: ...
# instant es naive en UTC (utc_now / AdjustableClock).

def snapshot_payload(snapshot: RemovedItemSnapshot) -> dict: ...
# Diccionario con las claves del token (v, d, t, p, s, c, f, n, dt, g, per, exp).

def parse_snapshot_payload(payload: object) -> RemovedItemSnapshot | None: ...
# None si no es dict, v != 1, o algún campo falta o tiene tipo o valor no válido
# (fecha AAAA-MM-DD válida, t en MEAL_TYPES, p entero >= 0, s en MEAL_ITEM_SOURCES,
# n str no vacío, g decimal válido de 1 a 2000, per con las cuatro claves numéricas o None, exp entero).
```

`backend/services/meal_service.py`:

```python
class MealService:
    def __init__(
        self,
        meal_repository,
        food_repository,
        user_repository,
        unit_of_work,
        clock=utc_now,
        catalog_repository=None,
        restore_signer=None,   # nuevo; RestoreTokenSigner o None
    ): ...

    def remove_item(self, user_id, meal_id: int, item_id: int) -> str | None: ...
    # Igual que en la 022 y además devuelve el token (None si no hay restore_signer).

    def restore_item(self, user_id, data: object) -> AddItemsResult: ...
```

`backend/routes/meal_routes.py`:

```python
@meal_bp.route("/restore", methods=["POST"])
@require_auth
def restore_item(): ...
```

#### Frontend: firmas exactas

`frontend/src/features/diary/constants.ts`:

```ts
export const DIARY_PAST_DAYS = 365
export const UNDO_DURATION_MS = 10_000
export const TODAY_CHECK_INTERVAL_MS = 30_000
```

`frontend/src/features/diary/days.ts` (nuevo):

```ts
export function isIsoDate(text: string): boolean
// AAAA-MM-DD y fecha real del calendario ("2026-02-30" → false).
export function diaryDateBounds(today: string): { min: string; max: string }
// min = shiftIsoDate(today, -DIARY_PAST_DAYS), max = today.
export function resolveDiaryDate(
  param: string | null,
  today: string
): { date: string; normalize: boolean }
// date = param si es válida y está en [min, max]; si no, today.
// normalize = param !== null && date === today (inválida, fuera del intervalo o igual a hoy).
```

`frontend/src/features/diary/format.ts`:

```ts
export function formatDiaryDate(isoDate: string, today: string = todayIsoDate()): string
// «lunes, 26 de octubre»; con « de AAAA» si el año de isoDate no es el de today.
```

`frontend/src/features/diary/types.ts`:

```ts
export type RemovalUndo = { token: string; name: string; mealType: MealType }
```

`frontend/src/features/diary/schemas.ts`:

```ts
export const removalResponseSchema = z.object({ restore_token: z.string().min(1) })
```

`frontend/src/features/diary/errors.ts`:

```ts
export const DELETE_MEAL_FAILED_MESSAGE = "No se pudo borrar la comida. Vuelve a intentarlo."
export const UNDO_FAILED_MESSAGE = "No se pudo deshacer. Vuelve a intentarlo."
export function undoErrorMessage(error: unknown): string
// ApiError 400 → error.message («Una comida no puede tener más de 50 alimentos.»); resto → UNDO_FAILED_MESSAGE.
```

`frontend/src/features/diary/api.ts`:

```ts
export async function removeMealItem(mealId: number, itemId: number): Promise<string | null>
// DELETE /api/meals/{mealId}/items/{itemId}?undo=1; devuelve restore_token, o null si la
// respuesta no lo trae (204 de un backend anterior): removalResponseSchema.safeParse.
export async function restoreMealItem(restoreToken: string): Promise<Meal>
// POST /api/meals/restore con { restore_token }; mealResponseSchema.parse.
export async function deleteMeal(mealId: number): Promise<void>
// DELETE /api/meals/{mealId}.
```

`frontend/src/features/diary/hooks.ts`:

```ts
export function useRemoveMealItem(date: string):
  UseMutationResult<string | null, Error, { mealId: number; itemId: number }>
export function useRestoreMealItem(date: string): UseMutationResult<Meal, Error, string>
export function useDeleteMeal(date: string): UseMutationResult<void, Error, number>
// mutationFn trata ApiError 404 como éxito (AC-006.6); onSuccess invalida diaryKeys.day(date).
export function useToday(paused?: boolean, intervalMs?: number): string
// paused por defecto false; intervalMs por defecto TODAY_CHECK_INTERVAL_MS.
export type RemovalUndoState = {
  notice: RemovalUndo | null
  offer: (notice: RemovalUndo | null) => void
  undo: () => void
  isRestoring: boolean
  error: string | null
}
export function useRemovalUndo(date: string, durationMs?: number): RemovalUndoState
// durationMs por defecto UNDO_DURATION_MS.
```

Componentes (props exactas):

```ts
// frontend/src/components/ui/alert-dialog.tsx (shadcn, sobre AlertDialog de "radix-ui")
export { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
         AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel }

// frontend/src/features/diary/components/ConfirmDialog.tsx
export function ConfirmDialog(props: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  isPending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}): ReactElement

// frontend/src/features/diary/components/DeleteMealDialog.tsx
export function DeleteMealDialog(props: {
  mealId: number
  label: string
  itemCount: number
  date: string
  onClose: () => void
}): ReactElement

// frontend/src/features/diary/components/DiaryDateNav.tsx
export function DiaryDateNav(props: {
  date: string
  today: string
  onChange: (date: string) => void
}): ReactElement

// frontend/src/features/diary/components/DiaryDayView.tsx
export function DiaryDayView(props: {
  date: string
  isToday: boolean
  diary: Diary
  targets: NutrientTotals
  onDialogOpenChange: (type: MealType, open: boolean) => void
}): ReactElement

// frontend/src/features/diary/components/MealSection.tsx (props nuevas)
// { type, label, meal, date, undo: RemovalUndoState, onDialogOpenChange: (open: boolean) => void }

// frontend/src/features/diary/components/NutrientProgress.tsx (prop nueva)
// { label: string; percent: number; over?: boolean }
```

### 3.3 Lógica

**Backend**

- `check_add_window(meal_date, today)`: `today - timedelta(days=ADD_WINDOW_PAST_DAYS) <= meal_date <= today +
  timedelta(days=ADD_WINDOW_FUTURE_DAYS)`. Con hoy 2026-10-21: 2025-10-20 entra, 2025-10-19 no; 2026-10-22 entra,
  2026-10-23 no. `add_items` la sigue llamando con `self.clock().date()`; el orden de validación no cambia
  (`parse_meal_date` antes, así AC-001.3 sigue dando «La fecha no es válida.»).
- `remove_item`: como ahora (bloqueo del usuario, `_find_item`, quitar, borrar la comida si queda vacía, `touch`,
  commit). **Antes** de quitar, construye `RemovedItemSnapshot` con los campos del `MealItem` y de su `Meal`
  (`meal_date`, `meal_type`, `position`, identidad, `grams`, `per_100g_*`) y `expires_at = epoch_seconds(self.clock()) +
  RESTORE_TOKEN_TTL_SECONDS`. Tras el commit devuelve `self.restore_signer.sign(user_id, snapshot_payload(snapshot))`, o
  `None` si no hay firmante. Firmar no toca la base.
- `restore_item(user_id, data)`:
  1. `body = require_json_object(data)` (400 «La petición no es válida.»).
  2. Si no hay `restore_signer` → `ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)`. `payload =
     self.restore_signer.verify(user_id, body.get("restore_token"))`; `snapshot = parse_snapshot_payload(payload)` (con
     `payload` `None` devuelve `None`); si `snapshot is None` o `epoch_seconds(self.clock()) > snapshot.expires_at` →
     `ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)` (404). El `user_id` de la firma es el del JWT, así que el token de
     otro usuario falla aquí (AC-N002.2).
  3. Dentro de `try`: `_lock_user`; `meal = get_by_user_date_and_type(user_id, snapshot.meal_date,
     snapshot.meal_type)`; si `meal` tiene `MAX_ITEMS_PER_MEAL` alimentos → `ValidationError(TOO_MANY_ITEMS_MESSAGE)`;
     si no existe, `create(Meal(...))`. Crea el `MealItem` con `_new_item(snapshot.position, snapshot.grams,
     snapshot.per_100g, source=…, catalog_id=…, fdc_id=…, name=…, data_type=…)` (recalcula los nutrientes con
     `portion_nutrients`; no consulta el catálogo ni USDA, AC-007.4). Lo inserta en `meal.items` en el índice del primer
     alimento con `position > snapshot.position` (o al final), para que la respuesta salga en el mismo orden que dará
     `order_by (position, id)` al releer. `touch()` si la comida ya existía; `commit`. Ante cualquier excepción,
     `rollback` y relanzar.
  4. Devuelve `AddItemsResult(meal=_summarize(meal), created=…)`.
- **Posición:** los alimentos nuevos usan `max(position) + 1`, así que la posición de un alimento quitado queda libre y
  el restaurado vuelve a su sitio entre sus vecinos (AC-007.3). Si se quitó el último y después se añadió otro (que
  tomó su misma posición), el restaurado queda justo detrás (desempate por `id`); aceptable y anotado.
- **Rutas:** `remove_item` lee `request.args.get("undo") == "1"`: con él, `jsonify(restore_token=token), 200`; sin él,
  `"", 204` (si el token fuese `None` con `undo=1`, responde 204). `restore_item` llama al servicio y devuelve
  `jsonify(_serialize_meal(result.meal)), 201 if result.created else 200`. `_build_meal_service()` añade
  `restore_signer=RestoreTokenSigner(current_app.config["SECRET_KEY"])`.
- **Dependencias por constructor (Art. P2.2):** repositorios, `UnitOfWork`, reloj de la app (`current_clock()`,
  ADR-0028), `catalog_repository` y `restore_signer`. Se reutilizan `require_json_object`, `_lock_user`
  (ADR-0020), `_new_item`, `portion_nutrients`, `_summarize`, `_serialize_meal` y las excepciones existentes.
- **`RestoreTokenSigner`:** firma `base64.urlsafe_b64encode(...).rstrip(b"=")`; al verificar, añade el relleno antes de
  decodificar el payload y captura `ValueError`/`binascii.Error`/`json.JSONDecodeError`/`UnicodeDecodeError` → `None`.
  No reutiliza `FeedbackTokenSigner` porque su formato (traza de 32 hex) es fijo; mismo patrón (ADR-0018) con prefijo de
  dominio distinto.

**Frontend**

- `useToday(paused, intervalMs)`: estado inicial `todayIsoDate()`; `setInterval(check, intervalMs)` y un listener de
  `visibilitychange` que comprueba al volver a `visible` (AC-005.2). `check` actualiza el estado solo si la fecha
  cambió y `paused` es `false`; al pasar `paused` de `true` a `false` comprueba en el acto. Limpia el intervalo y el
  listener al desmontar. 30 s cumplen el «como mucho un minuto» de REQ-005.
- `DiaryPage`:
  - `openDialogs: ReadonlySet<MealType>` (estado) y `today = useToday(openDialogs.size > 0)`: con un diálogo abierto,
    «hoy» no avanza, así que el día mostrado, el diálogo y su `date` no cambian (AC-005.4). Al cerrarlo, `useToday`
    comprueba y, si se estaba en hoy, pasa al día nuevo.
  - `const [searchParams, setSearchParams] = useSearchParams()`; `{ date, normalize } = resolveDiaryDate(
    searchParams.get("date"), today)`; un efecto con `normalize` llama a `setSearchParams({}, { replace: true })`
    (AC-003.3). `goTo(next)` llama a `setSearchParams(next === today ? {} : { date: next }, { replace: true })`
    (AC-003.2, AC-003.4).
  - Siempre pinta `h1` «Diario», `formatDiaryDate(date, today)` y `DiaryDateNav`; debajo, el bloque de estado de
    siempre («Cargando el diario…» o el error con «Reintentar»), y con `diary.data` y los objetivos,
    `<DiaryDayView key={date} … />` (AC-002.10).
  - `useDiary(date)` no cambia: la clave `["diary", date]` hace que una respuesta tardía de otro día vaya a su propia
    entrada de caché y nunca se pinte en el día actual (AC-002.9). No se usa `placeholderData`.
- `DiaryDateNav`: botón «Día anterior» (icono `ChevronLeft` con `aria-label`, deshabilitado si `date <= min`), «Día
  siguiente» (`ChevronRight`, deshabilitado si `date >= today`), «Hoy» (solo si `date !== today`) y
  `<input type="date" id … min={min} max={today} value={date}>` con `<Label>` «Elegir día» (`sr-only`). En `onChange`,
  solo llama a `onChange` si el valor pasa `isIsoDate` y está en el intervalo.
- `DiaryDayView` (montado con `key={date}`: cambiar de día reinicia aviso, diálogos y errores, AC-007.8):
  `undo = useRemovalUndo(date)`; `DailyTotals`; texto vacío `isToday ? "Todavía no has registrado nada hoy." : "No hay
  nada registrado este día."` (AC-002.8); las cuatro `MealSection` con `undo` y `onDialogOpenChange={(open) =>
  onDialogOpenChange(type, open)}`. Al desmontar, `useRemovalUndo` limpia su temporizador (AC-007.8).
- `useRemovalUndo(date, durationMs)`: guarda `notice` y un `setTimeout(durationMs)` que lo borra. `offer(n)` sustituye
  el aviso (o lo borra con `null`), reinicia el temporizador y resetea la mutación (AC-007.7). `undo()` no hace nada si
  no hay aviso o ya hay una restauración en curso (AC-007.11); si no, `restore.mutate(notice.token)`: con éxito borra
  el aviso (la invalidación de `useRestoreMealItem` vuelve a leer el diario, AC-007.3); con error deja el aviso y el
  temporizador original y expone `error = undoErrorMessage(err)` (AC-007.9, AC-007.10).
- `MealSection`:
  - `handleRemove(item)`: `remove.mutate({ mealId, itemId }, { onSuccess: (token) => undo.offer(token ? { token, name:
    item.name, mealType: type } : null) })`. La invalidación ya existente refresca la lista y los totales (AC-007.1,
    AC-007.2).
  - Si `undo.notice?.mealType === type`, dentro de una región `role="status"` `aria-live="polite"` (presente siempre,
    vacía sin aviso) pinta «Quitaste {nombre}.» y el botón «Deshacer» (`disabled={undo.isRestoring}`); el error, si lo
    hay, debajo. No mueve el foco (AC-N001.2).
  - Con alimentos, botón «Borrar comida» (`aria-label={`Borrar ${label}`}`) que abre `DeleteMealDialog` (AC-006.1).
  - Informa con un efecto `onDialogOpenChange(adding || photoOpen || editing !== null || deleting)` y con `false` al
    desmontar.
- `DeleteMealDialog`: `useDeleteMeal(date)`; `ConfirmDialog` con título `¿Borrar ${label}?`, texto `Se quitarán los
  ${n} alimentos de ${label}. No se puede deshacer.` (o `Se quitará el alimento de ${label}. No se puede deshacer.` con
  1), «Borrar» y «Cancelar». Al confirmar, `mutateAsync(mealId)`; con éxito (incluido el 404) cierra; con error muestra
  `DELETE_MEAL_FAILED_MESSAGE` y sigue abierto (AC-006.3 a AC-006.7).
- `ConfirmDialog`: `AlertDialog open` con `onOpenChange(false) → onCancel()` salvo con `isPending`; título y
  descripción de Radix (rol `alertdialog`, nombre = título, foco atrapado: AC-N001.3); el botón de confirmar es un
  `Button` normal, no `AlertDialogAction`, para que no cierre solo (deshabilitado con `isPending`); el de cancelar,
  `AlertDialogCancel`. El error va en `role="alert"` dentro del diálogo.
- `NutrientProgress`: `over` pone `data-over="true"` en la barra y la clase `bg-amber-500` en el indicador en lugar de
  `bg-primary` (patrón ámbar ya usado en Métricas). `DailyTotals` pasa `over={view.over}`. `over` ya es `remaining < 0`,
  así que igualar el objetivo no lo activa (AC-008.3). El texto sigue en `text-muted-foreground`, sin `role="alert"` ni
  `text-destructive` (AC-008.4).
- `MealPhotoDialog`: estado `confirmingDiscard`. `requestClose()`: si `add.isPending` no hace nada; si `reviewing`,
  abre la confirmación; si no, `onClose()` (AC-009.5, AC-009.6). Lo usan el `onOpenChange(false)` del `Dialog` (Escape
  y clic fuera, AC-009.4) y el `onCancel` de `PhotoReview` (AC-009.1). `ConfirmDialog` «¿Descartar la propuesta?»,
  «Perderás los alimentos propuestos. El análisis ya cuenta para el límite de 10 por hora.», «Descartar» → `onClose()`
  (AC-009.2), «Seguir revisando» o Escape → `setConfirmingDiscard(false)`. `PhotoReview` sigue montado debajo, así que
  conserva lo editado (AC-009.3). Guardar bien sigue cerrando con `onClose()` directo.
- `api.ts`: `removeMealItem` hace `apiFetch<unknown>(…?undo=1, { method: "DELETE" })` y devuelve
  `removalResponseSchema.safeParse(data)` → `restore_token` o `null`. Todo pasa por `apiFetch` (Art. P2.2 frontend).

### 3.4 Interfaz de usuario

- **Cabecera del diario:** «Diario», debajo la fecha (`formatDiaryDate`) y una fila con «‹» (Día anterior), el selector
  de fecha nativo, «›» (Día siguiente) y «Hoy» cuando no se está en hoy. Siempre visible, también al cargar o con error.
- **Secciones:** junto al subtotal, botón fantasma «Borrar comida» si hay alimentos. Bajo la lista, el aviso «Quitaste
  {nombre}.» con «Deshacer» (10 s), sin color de error.
- **Totales:** las barras pasan a ámbar al superar el objetivo; el resto igual.
- **Confirmaciones:** `alertdialog` centrado con título, texto y dos botones (destructivo «Borrar»; normal
  «Descartar»).
- **Validaciones:** el selector de fecha se limita con `min` y `max`, y `isIsoDate` más el intervalo filtran los
  valores (el parámetro de la dirección también). No hay formularios nuevos (Art. P2.3 no aplica más allá de lo
  existente).

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `meal_rules.check_add_window` (`ADD_WINDOW_PAST_DAYS`, `ADD_WINDOW_FUTURE_DAYS`) y `DATE_OUT_OF_WINDOW_MESSAGE`; `add_items` sin cambios de orden; PATCH/DELETE sin límite (sin cambios) |
| REQ-002 | `DiaryDateNav`, `days.diaryDateBounds`, `formatDiaryDate(date, today)`, `DiaryPage` (cabecera y estado siempre visibles), `DiaryDayView` (texto de día vacío), `useDiary(date)` con clave por día |
| REQ-003 | `days.resolveDiaryDate`, `DiaryPage` con `useSearchParams` y `{ replace: true }` |
| REQ-004 | `date` del día mostrado propagado `DiaryPage → DiaryDayView → MealSection → AddFoodDialog / MealPhotoDialog / EditGramsDialog / DeleteMealDialog`; hooks invalidan `diaryKeys.day(date)`; `saveErrorMessage` muestra el 400 |
| REQ-005 | `useToday(paused)` (intervalo de 30 s y `visibilitychange`); `DiaryPage` en pausa con `openDialogs`; límites derivados de `today` |
| REQ-006 | `MealSection` («Borrar comida»), `DeleteMealDialog`, `ConfirmDialog`, `api.deleteMeal`, `useDeleteMeal` (404 = éxito) |
| REQ-007 | Backend: `RestoreTokenSigner`, `RemovedItemSnapshot`, `snapshot_payload`, `parse_snapshot_payload`, `MealService.remove_item`/`restore_item`, `DELETE …?undo=1`, `POST /api/meals/restore` (ADR-0035). Frontend: `removeMealItem`, `restoreMealItem`, `useRestoreMealItem`, `useRemovalUndo`, aviso en `MealSection`, `DiaryDayView` keyed por día |
| REQ-008 | `NutrientProgress` (`over`, `bg-amber-500`, `data-over`), `DailyTotals` |
| REQ-009 | `MealPhotoDialog.requestClose` y `ConfirmDialog` de descarte |
| NFR-001 | `aria-label` de los botones de navegación y `<Label>` «Elegir día» en `DiaryDateNav`; región `role="status"` del aviso; `ConfirmDialog` sobre `AlertDialog` de Radix |
| NFR-002 | `@require_auth` en las rutas; `get_by_id_and_user` en `delete_meal` (404); firma del token ligada al `user_id` del JWT y comida buscada por ese `user_id` en `restore_item` |

## 5. Estrategia de pruebas

Marcadores `# SDD: 026 REQ-… AC-…` / `// SDD: 026 …` (Art. P1.1). Nombres en inglés (backend) y en español
(frontend).

### Backend

Entorno: Postgres de prueba (`TEST_DATABASE_URL`, puerto 5433). No hace falta Redis ni ningún proveedor externo.
Aislamiento con los dobles escritos a mano de `tests/fakes.py` (`FakeMealRepository`, `FakeFoodRepository`,
`FakeCatalogFoodRepository`, `FakeLockingUserRepository`, `FakeUnitOfWork`, `FakeClock`), inyectados por constructor;
sin `unittest.mock` ni `monkeypatch` (Art. P1.3). `RestoreTokenSigner` es puro y se usa real en los unitarios con una
clave fija (`"test-secret"`); no hace falta un doble nuevo. En integración, el reloj se fija con el fixture `app_clock`
(`AdjustableClock`) como en `test_meal_routes.py`.

- **Unitarios, `backend/tests/test_services/test_meal_rules.py`:** `check_add_window` con hoy 2026-10-21 acepta
  2025-10-20, 2026-01-15, 2026-10-21 y 2026-10-22 y rechaza 2025-10-19 y 2026-10-23 con el mensaje nuevo (AC-001.1,
  AC-001.2); `snapshot_payload` → `parse_snapshot_payload` devuelve el mismo snapshot (catálogo, USDA con valores
  `None`, personalizado); `parse_snapshot_payload` devuelve `None` con payloads mal formados (AC-007.4 como soporte).
- **Unitarios, `backend/tests/test_services/test_restore_token.py` (nuevo):** firmar y verificar devuelve el payload;
  con otro `user_id`, payload o firma alterados, sin punto, no texto o más largo que el máximo devuelve `None`
  (AC-N002.2); un `feedback_id` firmado con `FeedbackTokenSigner` y la misma clave no se acepta.
- **Unitarios, `backend/tests/test_services/test_meal_service.py`:** ventana (AC-001.1, AC-001.2);
  `remove_item` devuelve un token y quita el alimento de verdad (AC-007.2); `restore_item`: vuelve entre sus vecinos
  con los mismos gramos, valores por 100 g y nutrientes (AC-007.3), conserva los valores aunque el catálogo falso
  cambie (AC-007.4), recrea la comida borrada al quedarse vacía con `created=True` (AC-007.5), con 50 alimentos lanza
  `ValidationError` y no cambia nada, con `rollback` (AC-007.10), con token de otro usuario, alterado o caducado
  (`FakeClock.advance(seconds=121)`) lanza `ResourceNotFoundError` y no escribe (AC-N002.2), con cuerpo no objeto lanza
  `ValidationError` «La petición no es válida.».
- **Integración, `backend/tests/test_routes/test_meal_routes.py`:** `POST /api/meals` con las fechas de AC-001.1
  (201/200) y AC-001.2 (400, nada guardado); AC-001.3 con `date` ausente, `"20-10-2026"` y `"2026-02-30"`; AC-001.4:
  PATCH y DELETE de un alimento de hace 200 días; `DELETE …?undo=1` → 200 con `restore_token` y sin él → 204
  (regresión de la 022); `POST /api/meals/restore` → 200 en la comida existente y en su posición, y 201 tras quitar el
  único alimento (AC-007.3, AC-007.5); AC-007.10 (400 con 50); AC-N002.1 (borrar la comida de B → 404 y B intacta);
  AC-N002.2 (A con el token de B → 404 y las comidas de B sin cambios); AC-N002.3 (sin sesión: `POST /api/meals`,
  `DELETE /api/meals/{id}`, `DELETE …/items/{id}` y `POST /api/meals/restore` → 401, nada cambia).
- **Tests de la 022 que la 026 sustituye (actualizar, no borrar ni debilitar):** los de la ventana ±1 día y el mensaje
  «Solo puedes registrar comidas de hoy.» en `test_meal_rules.py` (`test_check_add_window_accepts_yesterday_today_and_
  tomorrow`, `test_check_add_window_rejects_two_days_away`, constante `OUT_OF_WINDOW`), `test_meal_service.py`
  (`test_add_items_rejects_dates_outside_the_window`, constante `OUT_OF_WINDOW`) y `test_meal_routes.py`
  (`test_post_accepts_yesterday_today_and_tomorrow_of_the_server_clock`, `test_post_rejects_dates_outside_the_window`).
  Se cambian sus fechas y su mensaje a los de la 026 y su marcador a `026 REQ-001 AC-001.x`; los que siguen siendo
  válidos (20, 21 y 22 de octubre aceptadas) pueden conservar también el de la 022.

### Frontend

Entorno: Vitest + Testing Library en jsdom (`npm test`), sin servicios. La red se simula con
`vi.mock("@/features/diary/api", …)` (y `@/features/catalog/api`, `@/features/profile/api`), o con
`vi.mock("@/lib/apiClient")` en `api.test.ts` (Art. P1.4). Los mocks de la página deben incluir las funciones nuevas
`restoreMealItem` y `deleteMeal`. La fecha se fija con `vi.useFakeTimers({ toFake: ["Date"] })` y
`vi.setSystemTime(...)`, como hoy.

**Temporizadores:** `waitFor`/`findBy` de Testing Library usan `setTimeout`/`setInterval` reales; si se falsean,
pueden colgarse. Por eso:
- la lógica de tiempo (AC-005.1, AC-005.3, AC-007.6, AC-007.7) se prueba sobre todo con `renderHook` en
  `hooks.test.tsx`, con `vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout",
  "clearTimeout"] })` y `act(() => vi.advanceTimersByTime(…))`, comprobando el resultado de forma síncrona;
- `useToday` y `useRemovalUndo` aceptan `intervalMs`/`durationMs` para los tests de hooks;
- en los tests de página que necesiten el paso del tiempo (AC-005.1, AC-005.4, AC-007.6), se falsean solo
  `["Date", "setInterval", "clearInterval"]` o `["Date", "setTimeout", "clearTimeout"]` según el caso, se avanza con
  `act`, se vacían promesas con `await act(async () => {})` y se comprueba con `getBy`/`queryBy`, sin `findBy`;
- AC-005.2 se prueba disparando `document.dispatchEvent(new Event("visibilitychange"))` tras cambiar la hora y
  `document.visibilityState` (`Object.defineProperty`).

Por archivo:
- **`days.test.ts` (nuevo):** `isIsoDate` (válidas, `2026-02-30`, `ayer`); `diaryDateBounds("2026-10-26")` →
  `2025-10-26`..`2026-10-26` (AC-002.5, AC-002.6); `resolveDiaryDate` con `2026-10-20` (AC-003.1), y `2026-02-30`,
  `ayer`, `2026-10-27`, `2025-10-25` → hoy con `normalize` (AC-003.3); `null` → hoy sin `normalize`.
- **`format.test.ts`:** «miércoles, 31 de diciembre de 2025» con hoy 2026-10-26 y «domingo, 25 de octubre» sin año
  (AC-002.7, AC-002.1).
- **`api.test.ts`:** `removeMealItem` llama a `/api/meals/1/items/2?undo=1` con `DELETE` y devuelve el token; con
  respuesta vacía devuelve `null`; `restoreMealItem` hace `POST /api/meals/restore` con `{ restore_token }`;
  `deleteMeal` hace `DELETE /api/meals/1` (AC-006.3, AC-007.3).
- **`hooks.test.tsx` (nuevo):** `useToday` cambia al pasar la medianoche en ≤ 60 s (AC-005.1), con
  `visibilitychange` (AC-005.2), no cambia con `paused` y cambia al quitar la pausa (AC-005.4); `useRemovalUndo`: el
  aviso desaparece a los 10 s (AC-007.6), un `offer` nuevo sustituye al anterior (AC-007.7), error de red → mensaje y
  aviso sigue (AC-007.9), 400 → «Una comida no puede tener más de 50 alimentos.» (AC-007.10), `undo` dos veces con la
  primera en curso → una sola llamada (AC-007.11).
- **`components/DiaryDateNav.test.tsx` (nuevo):** en hoy, «Día siguiente» deshabilitado y sin «Hoy» (AC-002.3); en el
  límite inferior, «Día anterior» deshabilitado (AC-002.5); el selector tiene `min`/`max` y elegir 2026-03-10 llama a
  `onChange` (AC-002.6); nombres accesibles y etiqueta «Elegir día» (AC-N001.1).
- **`components/DeleteMealDialog.test.tsx` (nuevo):** títulos y textos con 3 y con 1 alimento (AC-006.2);
  «Cancelar»/Escape sin petición (AC-006.4); error → mensaje y sigue abierto (AC-006.5); 404 → cierra sin error
  (AC-006.6); «Borrar» deshabilitado durante la petición y una sola llamada (AC-006.7); rol `alertdialog`, nombre
  = título y foco dentro (AC-N001.3).
- **`pages/DiaryPage.test.tsx`** (con `MemoryRouter initialEntries` o `createMemoryRouter` para leer la dirección):
  AC-002.1, AC-002.2, AC-002.4, AC-002.8, AC-002.9 (dos promesas diferidas resueltas en orden inverso), AC-002.10
  (navegación visible con carga pendiente y con error); AC-003.1, AC-003.2 (dirección con y sin parámetro),
  AC-003.3 (la dirección queda `/diary`), AC-003.4 (con `createMemoryRouter` e `initialEntries: ["/home",
  "/diary?date=2026-10-20"]`, tras dos cambios de día, `router.navigate(-1)` lleva a `/home`); AC-004.1 a AC-004.4
  (fecha del payload y día invalidado; 400 en el diálogo); AC-005.1, AC-005.3 y AC-005.4 (diálogo «Añadir a Cena»
  abierto al pasar la medianoche, guarda con `2026-10-26`); AC-006.1 y AC-006.3; AC-007.1 a AC-007.5, AC-007.7 y
  AC-007.8; AC-008.1 a AC-008.4 (`data-over`, clase `bg-amber-500` frente a `bg-primary`, ningún `role="alert"` ni
  `text-destructive` por el exceso); AC-N001.2 (aviso en `role="status"` y `document.activeElement` no cambia).
- **`components/MealPhotoDialog.test.tsx`:** AC-009.1 a AC-009.6 y AC-N001.3 (confirmación de descarte).
- **Tests de la 022 y la 025 que la 026 sustituye (actualizar, no borrar ni debilitar):**
  `MealPhotoDialog.test.tsx` ««Cancelar» con una propuesta cierra sin guardar y sin pedir confirmación» y «cerrar con
  Escape con una propuesta tampoco guarda nada» (025 REQ-013 AC-013.1) y `DiaryPage.test.tsx` «tras cerrar el diálogo
  con una propuesta, al volver a abrirlo empieza sin foto» (025 REQ-013 AC-013.2): pasan por la confirmación
  («Descartar») y se marcan también con `026 REQ-009`. Los tests de la 022 que mockean `removeMealItem` con
  `undefined` siguen valiendo (se trata como `null`: sin aviso).

### Cobertura de AC

| AC | Test |
|---|---|
| AC-001.1, AC-001.2 | `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py` |
| AC-001.3, AC-001.4 | `test_meal_routes.py` |
| AC-002.1, AC-002.2, AC-002.4, AC-002.8, AC-002.9, AC-002.10 | `DiaryPage.test.tsx` (AC-002.1 también `format.test.ts`) |
| AC-002.3, AC-002.5, AC-002.6 | `DiaryDateNav.test.tsx`, `days.test.ts` |
| AC-002.7 | `format.test.ts`, `DiaryPage.test.tsx` |
| AC-003.1 a AC-003.4 | `DiaryPage.test.tsx`, `days.test.ts` (AC-003.1, AC-003.3) |
| AC-004.1 a AC-004.4 | `DiaryPage.test.tsx` |
| AC-005.1 a AC-005.4 | `hooks.test.tsx`, `DiaryPage.test.tsx` |
| AC-006.1, AC-006.3 | `DiaryPage.test.tsx` (AC-006.3 también `api.test.ts`) |
| AC-006.2, AC-006.4 a AC-006.7 | `DeleteMealDialog.test.tsx` |
| AC-007.1, AC-007.2, AC-007.8 | `DiaryPage.test.tsx` (AC-007.2 también `test_meal_service.py`) |
| AC-007.3, AC-007.4, AC-007.5 | `test_meal_service.py`, `test_meal_routes.py`, `DiaryPage.test.tsx` |
| AC-007.6, AC-007.7, AC-007.9, AC-007.11 | `hooks.test.tsx` (AC-007.7 también `DiaryPage.test.tsx`) |
| AC-007.10 | `test_meal_service.py`, `test_meal_routes.py`, `hooks.test.tsx`, `DiaryPage.test.tsx` |
| AC-008.1 a AC-008.4 | `DiaryPage.test.tsx` |
| AC-009.1 a AC-009.6 | `MealPhotoDialog.test.tsx` |
| AC-N001.1 | `DiaryDateNav.test.tsx` |
| AC-N001.2 | `DiaryPage.test.tsx` |
| AC-N001.3 | `DeleteMealDialog.test.tsx`, `MealPhotoDialog.test.tsx` |
| AC-N002.1 | `test_meal_routes.py` |
| AC-N002.2 | `test_restore_token.py`, `test_meal_service.py`, `test_meal_routes.py` |
| AC-N002.3 | `test_meal_routes.py` |

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Despliegue no simultáneo (Vercel antes que el CD del backend): el frontend nuevo pide `?undo=1` a un backend sin la 026 | Alta durante minutos | Bajo | El backend antiguo responde 204; `removeMealItem` devuelve `null` y no se ofrece «Deshacer». El frontend antiguo no envía `undo=1` y sigue recibiendo 204 (ADR-0035) |
| Temporizadores falsos que cuelgan `waitFor`/`findBy` en los tests | Media | Medio (tests frágiles) | Lógica de tiempo en hooks con `renderHook`; en la página, solo los temporizadores necesarios, `act` y aserciones síncronas (sección 5) |
| Escape o clic fuera con la confirmación abierta encima del diálogo de foto cierran también el de debajo | Baja | Alto (pérdida de la propuesta) | Radix apila las capas descartables: solo responde la de arriba; `requestClose` además nunca cierra directamente con `reviewing`; AC-009.3 y AC-009.4 lo prueban |
| Reutilizar un token dentro de los 120 s duplica el alimento | Baja | Bajo (solo el diario propio) | «Deshacer» deshabilitado durante la petición y retirado al terminar (AC-007.11); caducidad corta; anotado en el backlog |
| El diálogo abierto a medianoche se cierra o guarda en el día nuevo | Media | Medio | `useToday` en pausa mientras hay un diálogo abierto y `DiaryDayView` montado por día (AC-005.4) |

## 7. Cumplimiento de la constitución

- **B1, B4, B5:** todos los REQ/NFR mapeados (sección 4) y todos los AC con test (sección 5). Los tests de la 022 y la
  025 sustituidos se **actualizan** para reflejar la spec aprobada (Art. B1.3 ya pasó por el gate de spec), sin
  borrarlos, saltarlos ni debilitar lo que aún aplica. Esqueletos: `raise NotImplementedError("not implemented")` /
  `throw new Error("not implemented")` (Art. B5.6 y Art. P1, punto 5 de backend y de frontend).
- **P1:** tests en las carpetas de convención; dobles a mano por constructor, sin `unittest.mock` ni `monkeypatch`;
  sin servicios externos; red simulada en `api.ts`/`apiClient`.
- **P2 backend:** capas respetadas (la ruta solo parsea `undo` y serializa); dependencias por constructor desde
  `_build_meal_service()`; errores con `ValidationError`/`ResourceNotFoundError`; sin cambios de modelo, así que no hay
  migración (P2.4 y P4 no aplican). **P2.5:** se reutilizan `require_json_object`, `_lock_user`, `portion_nutrients`,
  el reloj de la app y el patrón HMAC de ADR-0018. `RestoreTokenSigner` es una utilidad nueva y no duplica
  `FeedbackTokenSigner`, cuyo formato es fijo para un `trace_id` hexadecimal; generalizarla tocaría el coach fuera de
  alcance (anotado en el backlog).
- **P2 frontend:** organización por feature (`days.ts` es lógica pura del diario, junto a `format.ts`); HTTP solo por
  `apiFetch`; estado de servidor con TanStack Query y claves en `hooks.ts`; `alert-dialog.tsx` en
  `src/components/ui/` sobre `radix-ui` ya instalado (sin dependencias nuevas); sin errores de oxlint.
- **P3:** el endpoint nuevo usa `@require_auth` y filtra por el `user_id` del JWT; el token se valida en el servicio
  (firma, forma y caducidad); sin SQL a mano; sin variables nuevas (`SECRET_KEY` ya existe y debe tener valor propio en
  EC2, como indica la ADR-0018). Ningún endpoint nuevo llama a IA (P3.3 no aplica).
- **P5:** archivos en LF; la ADR-0035 queda «Propuesta» y la acepta la sesión principal con el usuario.
- **DEBERÍA no cumplidos:** ninguno.

## 8. ADRs

- [ADR-0035](../../docs/sdd/decisions/ADR-0035-deshacer-con-token-de-restauracion-firmado.md) — Deshacer «Quitar» con
  un token de restauración firmado, sin estado en el servidor (Propuesta).
