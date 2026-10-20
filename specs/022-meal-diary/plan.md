# Plan 022 — Diario de comidas con totales del día frente al objetivo de Macros

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-20)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución
En el backend se añade un área nueva `meals`, que sigue las capas `routes → services → repositories → models` (Art. P2.1):
dos modelos (`Meal` y `MealItem`) con su migración aditiva, un `MealRepository`, un módulo de reglas puras
(`services/meal_rules.py`: validación, cálculo de nutrientes con `Decimal` y totales) y un `MealService` que recibe por
constructor los repositorios de comidas, alimentos (el `FoodRepository` de la 021) y usuarios, el `UnitOfWork` y el reloj
de la app (ADR-0028). Cada alimento registrado guarda una **copia** de su descripción, su origen y sus valores por 100 g,
sin clave foránea a `foods` (ADR-0030). En el frontend se crea la feature `src/features/diary/` con la pantalla «Diario»
(`/diary`, cargada bajo demanda, ADR-0026), que reutiliza la búsqueda de la 021 (`useFoodSearch`, `FoodSearchForm`,
`FoodResultList`, `searchErrorView`, `format.ts`) y el cálculo de Macros (`calculateMacros` + `answersFromProfile`) para
los objetivos. Se añaden la entrada «Diario» a las dos barras de navegación y los textos legales.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | models | `backend/models/meal.py` (`Meal`, `MealItem`, `MEAL_TYPES`) | `backend/models/__init__.py` | Tablas `meals` y `meal_items` (REQ-001, REQ-002, REQ-008) |
| backend | migrations | `backend/migrations/versions/b3d5f7a9c1e4_create_meals_and_meal_items_tables.py` | — | Migración aditiva (Art. P2.4, P4) |
| backend | repositories | `backend/repositories/meal_repository.py` | — | Consultas por usuario, fecha y tipo, y por id y usuario (REQ-005, REQ-009) |
| backend | services | `backend/services/meal_rules.py`, `backend/services/meal_service.py` | — | Validación, cálculo, ventana de fecha y operaciones (REQ-001 a REQ-009) |
| backend | routes | `backend/routes/meal_routes.py` (`meal_bp`, `/api/meals`) | `backend/routes/__init__.py` | Endpoints con `@require_auth` (REQ-009, Art. P3.1) |
| backend | tests | `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py`, `backend/tests/test_routes/test_meal_routes.py` | `backend/tests/fakes.py` (`FakeMealRepository`, `make_food`) | Tests de la 022 |
| frontend | feature `diary` | `frontend/src/features/diary/{types.ts,api.ts,hooks.ts,schemas.ts,constants.ts,nutrition.ts,format.ts,errors.ts}`, `components/{MealSection.tsx,MealItemRow.tsx,DailyTotals.tsx,NutrientProgress.tsx,AddFoodDialog.tsx,PortionForm.tsx,CustomFoodForm.tsx,EditGramsDialog.tsx}`, `pages/DiaryPage.tsx` | — | Pantalla «Diario» (REQ-010 a REQ-014, NFR-002) |
| frontend | feature `foods` (reutilización) | — | `frontend/src/features/foods/components/FoodResultList.tsx` (prop opcional `onSelect`), `frontend/src/features/foods/components/FoodSearchForm.tsx` (prop opcional `defaultQuery`) | Elegir un resultado y conservar la consulta al volver (REQ-011); sin cambiar el comportamiento de `/foods` |
| frontend | app / navegación | — | `frontend/src/app/router.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/layout/BottomTabBar.tsx` | Ruta `/diary` bajo demanda y entrada «Diario» (REQ-015, NFR-001) |
| frontend | legal | — | `frontend/src/features/legal/pages/TermsOfServicePage.tsx`, `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx` | Atribución a USDA y privacidad (REQ-016) |
| frontend | tests | `frontend/src/test/diaryFixtures.ts`, `frontend/src/features/diary/*.test.ts`, `frontend/src/features/diary/components/*.test.tsx`, `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/app/diaryRoute.test.tsx` | `frontend/src/components/layout/Navbar.test.tsx`, `frontend/src/components/layout/BottomTabBar.test.tsx`, `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`, `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` | Los tests de las barras afirman hoy la lista antigua de entradas; pasan a la de AC-015.1/AC-015.2 |

## 3. Diseño

### 3.1 Datos y migraciones
**Tabla `public.meals`** (modelo `Meal`, `backend/models/meal.py`):

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | `INTEGER` autoincremental | no | Clave primaria. |
| `user_id` | `UUID` | no | FK `public.users.id` (sin `ondelete`, como `body_metrics`). |
| `meal_date` | `DATE` | no | Fecha local enviada por el cliente. Se serializa como `date`. |
| `meal_type` | `VARCHAR(20)` | no | `CHECK ck_meals_meal_type`: `meal_type IN ('breakfast','lunch','dinner','snack')`. |
| `created_at`, `updated_at` | `TIMESTAMP` | no | `server_default now()`; `updated_at` con `onupdate`. |

Restricción única `uq_meals_user_id_meal_date_meal_type (user_id, meal_date, meal_type)` (su índice sirve también para
la consulta del diario por usuario y fecha).

**Tabla `public.meal_items`** (modelo `MealItem`):

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | `INTEGER` autoincremental | no | Clave primaria. |
| `meal_id` | `INTEGER` | no | FK `public.meals.id` con `ON DELETE CASCADE`; índice `ix_meal_items_meal_id`. |
| `position` | `INTEGER` | no | Orden dentro de la comida (orden de alta). |
| `source` | `VARCHAR(10)` | no | `CHECK ck_meal_items_source`: `source IN ('usda','custom')`. |
| `fdc_id` | `INTEGER` | sí | **Sin** FK a `foods` (REQ-008, AC-008.3). |
| `name` | `TEXT` | no | Descripción de USDA copiada o nombre personalizado. |
| `data_type` | `VARCHAR(20)` | sí | `CHECK ck_meal_items_data_type`: `data_type IS NULL OR data_type IN ('foundation','sr_legacy')`. |
| `grams` | `NUMERIC(5,1)` | no | `CHECK ck_meal_items_grams`: `grams >= 1 AND grams <= 2000`. |
| `per_100g_calories_kcal`, `per_100g_protein_g`, `per_100g_carbs_g`, `per_100g_fat_g` | `DOUBLE PRECISION` | sí | Copia de USDA (o valores del usuario); `NULL` = sin dato. |
| `calories_kcal`, `protein_g`, `carbs_g`, `fat_g` | `NUMERIC(8,2)` | sí | Nutrientes de la porción; `NULL` si su valor por 100 g es `NULL`. |
| `created_at` | `TIMESTAMP` | no | `server_default now()`. |

`CHECK ck_meal_items_source_fields`: `(source = 'usda' AND fdc_id IS NOT NULL AND data_type IS NOT NULL) OR
(source = 'custom' AND fdc_id IS NULL AND data_type IS NULL)`.

Relación ORM: `Meal.items = relationship(back_populates="meal", cascade="all, delete-orphan", order_by=(MealItem.position,
MealItem.id))` y `MealItem.meal = relationship(back_populates="items")`. Las restricciones y el índice se declaran
también en `__table_args__` (con `{"schema": "public"}`), para que `create_all()` de los tests cree el mismo esquema.

**Migración** `b3d5f7a9c1e4` (`down_revision = "c8e2a4f6b9d3"`): `create_table` de `meals` y después de `meal_items`,
con todas las restricciones y el índice; `downgrade` borra `meal_items` y `meals` (pierde los datos del diario; es una
reversión de una tabla nueva, no un borrado de datos previos). Es **aditiva** y **no** se aplica sola: el `doc-keeper`
documenta el paso manual (volcado verificado en `C:/Users/alber/fitnerd-backups`, `flask db upgrade` con `FLASK_ENV`
bien puesto antes del merge) en `docs/deploy-runbook.md` (Art. P4). Se genera con `flask db migrate` en
`FLASK_ENV=development` y se revisa a mano (Art. P2.4); si el autogenerado difiere de la tabla anterior, manda esta.

### 3.2 Contratos e interfaces

**API** (todos con `@require_auth`, filtran por `g.decoded_token["id"]`; contrato completo en la sección 6 de la spec):

| Método y ruta | Cuerpo | Éxito | Errores |
|---|---|---|---|
| `GET /api/meals?date=AAAA-MM-DD` | — | 200 diario | 400 fecha, 401 |
| `POST /api/meals` | `{date, meal_type, items}` | 201 (comida creada) / 200 (ya existía), comida completa | 400 (tabla de la sección 6), 401, 404 usuario inexistente |
| `PATCH /api/meals/<int:meal_id>/items/<int:item_id>` | `{grams}` | 200 comida completa | 400 cuerpo o gramos, 401, 404 |
| `DELETE /api/meals/<int:meal_id>/items/<int:item_id>` | — | 204 | 401, 404 |
| `DELETE /api/meals/<int:meal_id>` | — | 204 | 401, 404 |

Los números se serializan como `float` (`grams`, `per_100g`, `nutrients` y `totals`) o `null`; `date` como
`AAAA-MM-DD`. Los ids fuera del rango de `INTEGER` (1 a 2 147 483 647) responden 404 «No encontramos esa comida.» o «No
encontramos ese alimento en la comida.» sin llegar a Postgres.

**Firmas del backend** (los tests importan estos símbolos; el `implementer` crea primero sus esqueletos según Art. P1.5):

```python
# backend/models/meal.py
MEAL_TYPES: tuple[str, ...] = ("breakfast", "lunch", "dinner", "snack")   # también es el orden del diario
MEAL_ITEM_SOURCES: tuple[str, ...] = ("usda", "custom")

class Meal(Base):        # __tablename__ = "meals"; columnas de 3.1; items: Mapped[list["MealItem"]]
    ...
class MealItem(Base):    # __tablename__ = "meal_items"; columnas de 3.1; meal: Mapped["Meal"]
    ...
```

```python
# backend/services/meal_rules.py
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

INVALID_REQUEST_MESSAGE      # reexporta el de services/auth_input_rules.py: "La petición no es válida"
INVALID_DATE_MESSAGE = "La fecha no es válida."
DATE_OUT_OF_WINDOW_MESSAGE = "Solo puedes registrar comidas de hoy."
INVALID_MEAL_TYPE_MESSAGE = "El tipo de comida no es válido."
ITEMS_REQUIRED_MESSAGE = "Añade al menos un alimento."
TOO_MANY_ITEMS_MESSAGE = "Una comida no puede tener más de 50 alimentos."
ITEM_SOURCE_MESSAGE = "Cada alimento debe ser de USDA o personalizado."
GRAMS_RANGE_MESSAGE = "Los gramos deben estar entre 1 y 2000."
GRAMS_DECIMALS_MESSAGE = "Los gramos admiten como mucho un decimal."
FOOD_NOT_FOUND_MESSAGE = "No encontramos ese alimento."
NAME_REQUIRED_MESSAGE = "Escribe el nombre del alimento."
NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres."
PER_100G_REQUIRED_MESSAGE = "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
CALORIES_RANGE_MESSAGE = "Las calorías por 100 g deben estar entre 0 y 900."
MACROS_RANGE_MESSAGE = "Los macros por 100 g deben estar entre 0 y 100 g."
MACROS_SUM_MESSAGE = "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
MEAL_NOT_FOUND_MESSAGE = "No encontramos esa comida."
ITEM_NOT_FOUND_MESSAGE = "No encontramos ese alimento en la comida."

NUTRIENT_KEYS: tuple[str, ...] = ("calories_kcal", "protein_g", "carbs_g", "fat_g")
MAX_ITEMS_PER_MEAL = 50
MAX_NAME_CHARS = 100
GRAMS_RANGE = (1, 2000)
CALORIES_PER_100G_RANGE = (0, 900)
MACRO_PER_100G_RANGE = (0, 100)
MAX_DB_INTEGER = 2_147_483_647

@dataclass(frozen=True)
class UsdaItemInput:
    fdc_id: int
    grams: Decimal

@dataclass(frozen=True)
class CustomItemInput:
    name: str                          # sin espacios en los extremos
    grams: Decimal
    per_100g: dict[str, float]         # las cuatro claves de NUTRIENT_KEYS

def parse_meal_date(value: object) -> date: ...                 # ValidationError(INVALID_DATE_MESSAGE)
def check_add_window(meal_date: date, today: date) -> None: ... # ValidationError(DATE_OUT_OF_WINDOW_MESSAGE)
def parse_meal_type(value: object) -> str: ...                  # ValidationError(INVALID_MEAL_TYPE_MESSAGE)
def validate_grams(value: object) -> Decimal: ...               # Decimal con un decimal (p. ej. Decimal("150.0"))
def parse_items(value: object) -> list[UsdaItemInput | CustomItemInput]: ...
def portion_nutrients(per_100g: dict[str, float | int | None], grams: Decimal) -> dict[str, Decimal | None]: ...
def sum_nutrients(nutrients: list[dict[str, Decimal | None]]) -> tuple[dict[str, Decimal], list[str]]: ...
def is_db_id(value: object) -> bool: ...                        # int (no bool) entre 1 y MAX_DB_INTEGER
```

```python
# backend/services/meal_service.py
@dataclass
class MealSummary:
    meal: Meal
    totals: dict[str, Decimal]
    incomplete: list[str]

@dataclass
class DiarySummary:
    date: date
    meals: list[MealSummary]
    totals: dict[str, Decimal]
    incomplete: list[str]

@dataclass
class AddItemsResult:
    meal: MealSummary
    created: bool

class MealService:
    def __init__(self, meal_repository, food_repository, user_repository, unit_of_work, clock=utc_now): ...
    def get_diary(self, user_id, date_value: object) -> DiarySummary: ...
    def add_items(self, user_id, data: object) -> AddItemsResult: ...
    def update_item_grams(self, user_id, meal_id: int, item_id: int, data: object) -> MealSummary: ...
    def remove_item(self, user_id, meal_id: int, item_id: int) -> None: ...
    def delete_meal(self, user_id, meal_id: int) -> None: ...
```

```python
# backend/repositories/meal_repository.py
class MealRepository(BaseRepository):          # create(instance) y delete(instance) heredados
    def __init__(self, session): ...
    def list_by_user_and_date(self, user_id, meal_date: date) -> list[Meal]: ...      # con selectinload(items)
    def get_by_user_date_and_type(self, user_id, meal_date: date, meal_type: str) -> Meal | None: ...
    def get_by_id_and_user(self, meal_id: int, user_id) -> Meal | None: ...           # filtra por usuario en la misma consulta
```

```python
# backend/routes/meal_routes.py
meal_bp = Blueprint("meals", __name__, url_prefix="/api/meals")
def _build_meal_service() -> MealService: ...   # MealRepository, FoodRepository, UserRepository, UnitOfWork(db.session), current_clock()
```

**Firmas del frontend** (`frontend/src/features/diary/`):

```ts
// types.ts
import type { FoodDataType } from "@/features/foods/types"
export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type NutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type Nutrients = Record<NutrientKey, number | null>
export type NutrientTotals = Record<NutrientKey, number>
export type MealItemSource = "usda" | "custom"
export type MealItem = {
  id: number; source: MealItemSource; fdc_id: number | null; name: string
  data_type: FoodDataType | null; grams: number; per_100g: Nutrients; nutrients: Nutrients
}
export type Meal = {
  id: number; date: string; meal_type: MealType; items: MealItem[]
  totals: NutrientTotals; incomplete: NutrientKey[]
}
export type Diary = { date: string; meals: Meal[]; totals: NutrientTotals; incomplete: NutrientKey[] }
export type UsdaItemPayload = { fdc_id: number; grams: number }
export type CustomItemPayload = { name: string; grams: number; per_100g: Record<NutrientKey, number> }
export type AddMealItemsPayload = {
  date: string; meal_type: MealType; items: (UsdaItemPayload | CustomItemPayload)[]
}

// api.ts (solo apiFetch, Art. P2.2; las respuestas se validan con los esquemas de schemas.ts)
export async function getDiary(date: string): Promise<Diary>
export async function addMealItems(payload: AddMealItemsPayload): Promise<Meal>
export async function updateMealItemGrams(mealId: number, itemId: number, grams: number): Promise<Meal>
export async function removeMealItem(mealId: number, itemId: number): Promise<void>

// hooks.ts
export const diaryKeys = { day: (date: string) => ["diary", date] as const }
export function useDiary(date: string)                       // useQuery
export function useAddMealItems(date: string)                // useMutation<Meal, Error, AddMealItemsPayload>
export function useUpdateMealItemGrams(date: string)         // useMutation<Meal, Error, { mealId: number; itemId: number; grams: number }>
export function useRemoveMealItem(date: string)              // useMutation<void, Error, { mealId: number; itemId: number }>
// Las tres mutaciones devuelven en onSuccess la promesa de invalidateQueries(diaryKeys.day(date)).

// constants.ts
export const MEAL_SECTIONS: { type: MealType; label: string }[]   // Desayuno, Almuerzo, Cena, Meriendas
export const NUTRIENT_LABELS: Record<NutrientKey, string>         // Calorías, Proteína, Carbohidratos, Grasa

// schemas.ts
export const GRAMS_RANGE_MESSAGE, GRAMS_DECIMALS_MESSAGE, NAME_REQUIRED_MESSAGE, PER_100G_REQUIRED_MESSAGE,
  CALORIES_RANGE_MESSAGE, MACROS_RANGE_MESSAGE, MACROS_SUM_MESSAGE   // textos idénticos a los del backend
export const CUSTOM_NAME_MAX_LENGTH = 100
export function parseDecimalText(text: string): number | null       // admite coma o punto; null si no es un número
export const gramsFormSchema: z.ZodType<GramsFormValues>             // { grams: string }
export type GramsFormValues = { grams: string }
export const customFoodFormSchema: z.ZodType<CustomFoodFormValues>   // errores por campo + "macroSum"
export type CustomFoodFormValues = {
  name: string; grams: string; calories: string; protein: string; carbs: string; fat: string
}
export function customItemPayload(values: CustomFoodFormValues): CustomItemPayload
export const diaryResponseSchema: z.ZodType<Diary>
export const mealResponseSchema: z.ZodType<Meal>

// nutrition.ts
export function portionNutrients(per100g: Nutrients, grams: number): Nutrients
export type NutrientProgressView = { consumed: number; remaining: number; over: boolean; percent: number }
export function nutrientProgress(consumed: number, target: number, decimals: 0 | 1): NutrientProgressView

// format.ts
export function formatDiaryDate(isoDate: string): string          // «martes, 20 de octubre»
export function formatKcal(value: number | null): string           // «248 kcal», «— kcal»
export function formatNutrientGrams(value: number): string         // «46,5»
export function formatLoggedGrams(grams: number): string           // «150 g», «150,5 g»
export function formatPortionPreview(nutrients: Nutrients): string // «248 kcal · 46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa»
export function sourceLabel(item: MealItem): string                // «Foundation», «SR Legacy» o «Personalizado»

// errors.ts
export const SAVE_FAILED_MESSAGE = "No se pudo guardar. Vuelve a intentarlo."
export const REMOVE_FAILED_MESSAGE = "No se pudo quitar el alimento. Vuelve a intentarlo."
export function saveErrorMessage(error: unknown): string           // 400 de ApiError → su mensaje; si no, SAVE_FAILED_MESSAGE

// pages/DiaryPage.tsx
export function DiaryPage(): ReactElement
// components/
export function DailyTotals(props: { totals: NutrientTotals; incomplete: NutrientKey[]; targets: NutrientTotals }): ReactElement
export function NutrientProgress(props: { label: string; percent: number }): ReactElement
export function MealSection(props: { type: MealType; label: string; meal: Meal | null; date: string }): ReactElement
export function MealItemRow(props: { item: MealItem; onEdit: () => void; onRemove: () => void; isRemoving: boolean }): ReactElement
export function AddFoodDialog(props: { mealType: MealType; label: string; date: string; onClose: () => void }): ReactElement
export function PortionForm(props: { per100g: Nutrients; defaultGrams: string; submitLabel: string; isSaving: boolean; onSubmit: (grams: number) => void; children?: ReactNode }): ReactElement
export function CustomFoodForm(props: { defaultName: string; isSaving: boolean; onSubmit: (payload: CustomItemPayload) => void; children?: ReactNode }): ReactElement
export function EditGramsDialog(props: { mealId: number; item: MealItem; date: string; onClose: () => void }): ReactElement
```

Cambios de contrato en componentes de la 021 (compatibles hacia atrás):
- `FoodResultList({ foods, onSelect? }: { foods: Food[]; onSelect?: (food: Food) => void })`: con `onSelect`, cada
  resultado lleva un botón «Elegir {descripción}»; sin él, se pinta igual que hoy.
- `FoodSearchForm({ onSearch, isSearching, defaultQuery? })`: `defaultQuery` (por defecto `""`) es el valor inicial de
  la caja.

### 3.3 Lógica

**Reglas puras (`services/meal_rules.py`)**:
- `parse_meal_date`: texto con `^\d{4}-\d{2}-\d{2}$` y `date.fromisoformat` válido; si no, `INVALID_DATE_MESSAGE`
  (mismo patrón que `_parse_recorded_at` de `body_metric_service.py`).
- `check_add_window`: acepta `today - 1 día <= meal_date <= today + 1 día`.
- `validate_grams`: si no es número (`is_number` de `services/number_validation.py`, que excluye `bool`) o está fuera de
  1 a 2000, `GRAMS_RANGE_MESSAGE`; después, si `Decimal(repr(value))` tiene más de un decimal (exponente < −1 tras quitar
  los ceros finales), `GRAMS_DECIMALS_MESSAGE`. El orden hace que 0,25 o 2000,05 den el mensaje de rango. Devuelve el
  `Decimal` cuantizado a `0.1`.
- `parse_items`: si no es una lista o está vacía, `ITEMS_REQUIRED_MESSAGE`; si tiene más de 50, `TOO_MANY_ITEMS_MESSAGE`
  (antes de validar cada elemento). Para cada elemento, en este orden: si no es un objeto, o `fdc_id` y `name` están
  ambos (distintos de `None`) o ninguno, `ITEM_SOURCE_MESSAGE`; los gramos con `validate_grams`; en los de USDA,
  `fdc_id` debe ser un `int` (no `bool`) entre 1 y `MAX_DB_INTEGER`, si no `FOOD_NOT_FOUND_MESSAGE`; en los
  personalizados, el nombre (no texto o vacío tras `strip()` → `NAME_REQUIRED_MESSAGE`; más de 100 → `NAME_TOO_LONG_MESSAGE`),
  y `per_100g` (no objeto, o alguna clave ausente o no numérica → `PER_100G_REQUIRED_MESSAGE`; calorías fuera de 0–900 →
  `CALORIES_RANGE_MESSAGE`; algún macro fuera de 0–100 → `MACROS_RANGE_MESSAGE`; suma en `Decimal(repr(·))` mayor que
  100 → `MACROS_SUM_MESSAGE`). Se lanza el primer error encontrado (como el resto del backend).
- `portion_nutrients`: para cada clave, `None` si el valor por 100 g es `None`; si no,
  `(Decimal(repr(v)) * grams / Decimal(100)).quantize(Decimal("0.01"), ROUND_HALF_UP)`. `repr` evita el error binario
  (`repr(3.57) == "3.57"` → 5,355 → 5,36). Los enteros se convierten con `Decimal(v)`.
- `sum_nutrients`: suma por clave los valores no nulos (empieza en `Decimal("0")`, así un día vacío da los cuatro a 0) y
  devuelve en `incomplete` las claves con algún `None`, en el orden de `NUTRIENT_KEYS`.

**`MealService`** (dependencias por constructor, Art. P2.2: `meal_repository`, `food_repository` = `FoodRepository` de
la 021, `user_repository` = `UserRepository`, `unit_of_work`, `clock` = `current_clock()`):
- `get_diary`: `parse_meal_date(date_value)` sin ventana (AC-005.7); `list_by_user_and_date`; ordena por el índice de
  `meal_type` en `MEAL_TYPES`; calcula el resumen de cada comida y el del día sobre todos sus alimentos. Sin escrituras.
- `add_items`: valida **todo antes de tocar la base**: `require_json_object` (reutilizado de
  `services/auth_input_rules.py`), `parse_meal_date`, `check_add_window(·, clock().date())`, `parse_meal_type`,
  `parse_items`. Después, dentro de `try` con `rollback` ante cualquier excepción: bloquea la fila del usuario
  (`get_by_id_for_update`; si no existe, `ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)` de `profile_service`), busca de
  una vez los FDC IDs con `food_repository.get_by_fdc_ids` (si falta alguno, `FOOD_NOT_FOUND_MESSAGE`), busca la comida
  con `get_by_user_date_and_type`, comprueba que `alimentos actuales + nuevos <= 50` (si no, `TOO_MANY_ITEMS_MESSAGE` sin
  crear la comida), la crea con `meal_repository.create` si no existe, añade los `MealItem` a `meal.items` con
  `position` consecutiva desde `max(position) + 1` y sus nutrientes de `portion_nutrients`, y hace `commit` una sola vez.
  En los de USDA copia `description` → `name`, `data_type` y los cuatro valores por 100 g del `Food`. Devuelve
  `AddItemsResult(resumen, created)`. Así un 400 no guarda nada (AC-003.14) y dos peticiones simultáneas del mismo
  usuario se serializan (ADR-0030).
- `update_item_grams`: bloquea al usuario; `is_db_id` y `get_by_id_and_user` (si no, `MEAL_NOT_FOUND_MESSAGE`); busca el
  alimento por `id` en `meal.items` (si no, `ITEM_NOT_FOUND_MESSAGE`); después `require_json_object(data)` y
  `validate_grams(data.get("grams"))`; fija `grams` y recalcula los cuatro nutrientes con `portion_nutrients` sobre los
  `per_100g_*` **guardados** (REQ-006, AC-008.2); `commit`. Sin ventana de fecha (AC-006.5). Las comprobaciones de 404
  van antes que las de 400, como en `BodyMetricService.update_metric`.
- `remove_item`: bloquea; 404 como arriba; `meal.items.remove(item)` (el `delete-orphan` lo borra); si la comida queda
  sin alimentos, `meal_repository.delete(meal)`; `commit`.
- `delete_meal`: bloquea; 404 si no es suya; `meal_repository.delete(meal)` (los alimentos caen por la cascada ORM y
  `ON DELETE CASCADE`); `commit`.
- Solo `UnitOfWork` hace `commit` y `rollback` (Art. P2.1). Todos los errores son `ValidationError` o
  `ResourceNotFoundError` (Art. P2.3); no hay respuestas de error construidas en la ruta.

**Rutas (`routes/meal_routes.py`)**: leen `request.get_json(silent=True)` (un JSON malformado o un texto da `None` y
`require_json_object` responde «La petición no es válida»), `request.args.get("date")` y los ids de la URL
(`<int:…>`), llaman al servicio y serializan con funciones privadas `_serialize_item`, `_serialize_meal(summary)` y
`_serialize_numbers(dict)` (`float` o `None`). `POST` responde 201 si `created`, si no 200; los `DELETE`, `("", 204)`.
El blueprint se registra en `routes/__init__.py`. No llama a proveedores externos: no necesita rate limiting
(Art. P3.3).

**Frontend**:
- `DiaryPage`: `const date = useMemo(todayIsoDate, [])` (`src/lib/dates.ts`, fecha local; AC-010.2); `useDiary(date)`;
  objetivos con `useProfile()` + `answersFromProfile` + `calculateMacros` (los mismos que `MacrosPage`, AC-014.3):
  `calories_kcal = summary.targetKcal` y los gramos de `summary.macros` por clave (`protein`, `carbs`, `fat`). Mientras
  carga, «Cargando el diario…»; con error, «No se pudo cargar el diario.» y «Reintentar» (`refetch`), ambos en una región
  `role="status" aria-live="polite"`. Con datos: título «Diario», `formatDiaryDate(date)`, `DailyTotals`, «Todavía no has
  registrado nada hoy.» si `meals` está vacío, y las cuatro `MealSection` en el orden de `MEAL_SECTIONS` (cada una
  recibe su comida o `null`).
- `MealSection`: encabezado con la etiqueta y el subtotal (`formatKcal(meal?.totals.calories_kcal ?? 0)`), «Sin
  alimentos.» si no hay comida, sus `MealItemRow`, el botón «Añadir alimento» (abre `AddFoodDialog`) y el estado de
  «Quitar» (`useRemoveMealItem(date)`; si falla, `REMOVE_FAILED_MESSAGE` en un `role="alert"` de la sección). Abre
  `EditGramsDialog` con el alimento elegido.
- `MealItemRow`: nombre, `sourceLabel`, `formatLoggedGrams`, `formatKcal(item.nutrients.calories_kcal)`, botones
  «Editar» y «Quitar» con `aria-label` «Editar {nombre}» y «Quitar {nombre}» (AC-013.6). «Quitar» no pide confirmación.
- `AddFoodDialog` (`Dialog` de shadcn, título «Añadir a {sección}», AC-N002.1): estado local `step: "search" | "portion"
  | "custom"`, alimento elegido y `useFoodSearch()` **en el diálogo** (así «Volver a la búsqueda» muestra los
  resultados guardados en la mutación sin repetir la petición, AC-011.9, y `FoodSearchForm` recibe
  `defaultQuery={variables}`). En `search` pinta `FoodSearchForm`, la región de estado con los mismos textos que
  `FoodsPage` («Busca un alimento…», «Buscando…», «No encontramos alimentos para «{consulta}».», `searchErrorView` y
  «Reintentar»), `FoodResultList` con `onSelect`, y el botón «Crear alimento personalizado» (junto al mensaje sin
  resultados cuando lo hay, con el nombre relleno con la consulta, AC-012.6; si no, al pie). En `portion` pinta el
  nombre del alimento y `PortionForm` (gramos 100 por defecto) con «Volver a la búsqueda»; en `custom`,
  `CustomFoodForm` con «Volver a la búsqueda». «Cancelar» y cerrar el diálogo no guardan nada; mientras guarda, el
  diálogo no se cierra. Al guardar llama a `useAddMealItems(date).mutateAsync({ date, meal_type, items: [item] })`; si
  va bien, cierra (el diario se relee por la invalidación); si falla, sigue abierto con lo elegido y muestra
  `saveErrorMessage(error)` en un `role="alert"` (AC-011.6, AC-N002.3).
- `PortionForm`: react-hook-form + `gramsFormSchema` (zod, Art. P2.3/P3.2); campo de texto «Gramos»
  (`type="text" inputMode="decimal"`, para admitir coma); vista previa con `useWatch` →
  `formatPortionPreview(portionNutrients(per100g, parseDecimalText(grams) ?? 0))` sin peticiones (AC-011.3); botón
  `submitLabel` («Añadir» o «Guardar») que con `isSaving` muestra «Guardando…» y está desactivado (AC-011.10). Los
  errores salen con `FormMessage` tras pulsar el botón y entonces no se llama a `onSubmit`.
- `CustomFoodForm`: react-hook-form + `customFoodFormSchema`; campos «Nombre» (`maxLength={100}`, AC-012.5),
  «Gramos», «Calorías por 100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)» y «Grasa por 100 g (g)»
  (texto con `inputMode="decimal"`); vista previa de la porción; el error de suma (`macroSum`) se pinta debajo del campo
  de grasa. `onSubmit(customItemPayload(values))`.
- `EditGramsDialog`: título «Editar gramos»; `PortionForm` con `per100g = item.per_100g` y `defaultGrams =
  String(item.grams)` con coma decimal si la hay; «Guardar» llama a `useUpdateMealItemGrams(date)`; «Cancelar»; errores
  con `saveErrorMessage`.
- `DailyTotals`: una fila por nutriente con `NUTRIENT_LABELS`; calorías como «{consumido} / {objetivo} kcal» con
  `Intl.NumberFormat("es-ES")` sin decimales (el formato de Macros); gramos como «{consumido con 1 decimal} / {objetivo}
  g»; `nutrientProgress` da «Quedan {n} {unidad}» o «{n} {unidad} por encima del objetivo» y el porcentaje de la barra
  (`NutrientProgress`, un `div role="progressbar"` con `aria-label` del nutriente, `aria-valuemin=0`,
  `aria-valuemax=100`, `aria-valuenow`; AC-N002.2). Si el nutriente está en `incomplete`, «Algún alimento no tiene este
  dato: el total puede ser mayor.».
- `nutrientProgress(consumed, target, decimals)`: redondea `consumed` a los decimales que se muestran y calcula
  `remaining = target − consumido redondeado` (así «650 / 2000» y «Quedan 1350» siempre cuadran), `over = remaining <
  0` (se muestra el valor absoluto) y `percent = min(100, consumido / target × 100)` (0 si `target <= 0`).
- `portionNutrients(per100g, grams)`: `null` si el valor por 100 g es `null`; si no, `v × grams / 100` limpiado con
  `toPrecision(12)` y redondeado a 2 decimales con mitades hacia arriba mediante notación exponencial
  (`Math.round(Number(x + "e2"))`), para coincidir con el servidor (247,5 → «248 kcal»; 5,355 → 5,36 → «5,4 g»).
- `parseDecimalText`: `trim()`, una coma pasa a punto, y solo acepta `^\d+(\.\d+)?$`. `gramsFormSchema`: vacío, no
  numérico o fuera de 1–2000 → `GRAMS_RANGE_MESSAGE`; más de un decimal → `GRAMS_DECIMALS_MESSAGE`.
  `customFoodFormSchema` aplica las mismas reglas y mensajes que el backend (nombre, gramos, cada valor por 100 g y la
  suma).
- `saveErrorMessage`: `ApiError` con `status === 400` → `error.message`; cualquier otro → `SAVE_FAILED_MESSAGE`.
- Navegación: en `Navbar.links`, `{ to: "/diary", label: "Diario" }` primero; en `BottomTabBar.tabs`, tras «Inicio»,
  `{ to: "/diary", label: "Diario", icon: BookOpen }` (lucide-react ya es dependencia). `NavLink` ya marca la activa
  (AC-015.3). `/foods` no cambia (AC-015.4).
- Router: `const DiaryPage = lazyNamed(() => import("@/features/diary/pages/DiaryPage"), "DiaryPage")` y la ruta
  `/diary` dentro de `AppLayout` con `<RouteSuspense className={IN_LAYOUT}>` (NFR-001).
- Legal: en `TermsOfServicePage`, sección «Datos nutricionales» con los dos textos de AC-016.1; en `PrivacyPolicyPage`,
  punto «Diario de comidas:» (los alimentos y las cantidades que registras) en «Qué información recolectamos» y el punto
  de Voyage AI amplía lo que recibe con «el texto de tus búsquedas de alimentos». `updatedAt` de las dos páginas pasa a
  «20 de octubre de 2026».

### 3.4 Interfaz de usuario
- **Pantalla «Diario» (`/diary`)**, dentro de `AppLayout`, contenedor `mx-auto max-w-2xl p-4 sm:p-8` como `FoodsPage`:
  1. Título «Diario» y la fecha larga.
  2. Tarjeta de totales (`Card`) con cuatro filas: etiqueta, «consumido / objetivo», «Quedan…» o «… por encima del
     objetivo», barra de progreso y, si procede, el aviso de total incompleto.
  3. «Todavía no has registrado nada hoy.» si no hay comidas.
  4. Cuatro secciones (Desayuno, Almuerzo, Cena, Meriendas), cada una con encabezado y subtotal en kcal, la lista de
     alimentos (nombre, origen, gramos, kcal, «Editar» y «Quitar») o «Sin alimentos.», y «Añadir alimento».
- **Diálogo «Añadir a {sección}»** en tres pasos: búsqueda (con «Crear alimento personalizado»), porción del alimento
  elegido (gramos y vista previa) y alimento personalizado; botones «Añadir», «Volver a la búsqueda» y «Cancelar».
- **Diálogo «Editar gramos»**: campo «Gramos», vista previa, «Guardar» y «Cancelar».
- **Estados**: «Cargando el diario…», error con «Reintentar», «Guardando…» en el botón, errores de guardado y de quitar
  en regiones anunciadas (`role="status"` o `role="alert"`).
- **Validaciones**: zod con los mensajes de la sección 6 de la spec, mostrados junto a su campo; nunca se envía una
  petición con errores.
- **Formatos**: `es-ES`, coma decimal; kcal sin decimales; gramos de nutrientes con 1 decimal; gramos registrados sin
  decimales si son enteros; «—» sin dato.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `MealService.add_items`, `meal_rules.parse_items`/`portion_nutrients`, `MealRepository.get_by_user_date_and_type`, `FoodRepository.get_by_fdc_ids`, modelos `Meal`/`MealItem` (`position`), `POST /api/meals` (201/200) |
| REQ-002 | `meal_rules.parse_items` (`CustomItemInput`, `strip()`), `MealService.add_items` (`source="custom"`, `fdc_id=None`) |
| REQ-003 | `meal_rules` (todas las validaciones y mensajes), `require_json_object`, validación previa y `rollback` en `add_items`; tope en `parse_items` y en `add_items` |
| REQ-004 | `meal_rules.parse_meal_date`, `check_add_window` con `clock().date()` (`current_clock()`, ADR-0028), solo en `add_items` |
| REQ-005 | `MealService.get_diary`, `MealRepository.list_by_user_and_date`, orden de `MEAL_TYPES`, `sum_nutrients`, `GET /api/meals` |
| REQ-006 | `MealService.update_item_grams` con los `per_100g_*` guardados, `PATCH /api/meals/<id>/items/<id>` |
| REQ-007 | `MealService.remove_item` (borra la comida vacía) y `delete_meal`, cascada ORM y `ON DELETE CASCADE`, `DELETE` 204 |
| REQ-008 | Copia en `meal_items` sin FK a `foods` (ADR-0030), recálculo con la copia en `update_item_grams` |
| REQ-009 | `@require_auth`, `g.decoded_token["id"]`, `get_by_id_and_user` filtrando por usuario, `is_db_id`, mensajes 404 |
| REQ-010 | `DiaryPage`, `MealSection`, `MealItemRow`, `MEAL_SECTIONS`, `formatDiaryDate`, `todayIsoDate`, `useDiary` |
| REQ-011 | `AddFoodDialog` (pasos `search`/`portion`), `PortionForm`, `gramsFormSchema`, `portionNutrients`, `formatPortionPreview`, `useAddMealItems`, `FoodResultList.onSelect`, `FoodSearchForm.defaultQuery`, `useFoodSearch`, `searchErrorView`, `saveErrorMessage` |
| REQ-012 | `AddFoodDialog` (paso `custom`), `CustomFoodForm`, `customFoodFormSchema`, `customItemPayload` |
| REQ-013 | `MealItemRow`, `EditGramsDialog`, `useUpdateMealItemGrams`, `useRemoveMealItem`, `REMOVE_FAILED_MESSAGE` |
| REQ-014 | `DailyTotals`, `NutrientProgress`, `nutrientProgress`, objetivos de `calculateMacros(answersFromProfile(profile))` |
| REQ-015 | `Navbar.tsx`, `BottomTabBar.tsx`, ruta `/diary` en `router.tsx`; `/foods` sin cambios |
| REQ-016 | `TermsOfServicePage.tsx`, `PrivacyPolicyPage.tsx` |
| NFR-001 | `lazyNamed` + `RouteSuspense className={IN_LAYOUT}` para `/diary` en `router.tsx` |
| NFR-002 | `aria-label` en los botones, `Label`/`FormLabel` en los campos, `DialogTitle`, `role="progressbar"` con nombre, regiones `role="status"`/`role="alert"` |

## 5. Estrategia de pruebas
Marcadores con número de spec: `# SDD: 022 REQ-00X AC-00X.Y` y `// SDD: 022 REQ-0XX AC-0XX.Y` (Art. P1.1, ADR-0022).

### backend
Entorno: Postgres de prueba (`TEST_DATABASE_URL`, puerto 5433, con pgvector). No se llama a ningún proveedor externo:
el diario no usa Voyage, Anthropic ni Redis. Sin `unittest.mock` ni `monkeypatch` (Art. P1.3).

**Unitarios, `backend/tests/test_services/test_meal_rules.py`** (funciones puras, sin base):
- `parse_meal_date`: válidas, ausente, `"20-10-2026"`, `"2026-02-30"`, no texto (AC-004.3, AC-005.6).
- `check_add_window` con hoy 2026-10-21: 20, 21 y 22 aceptadas; 19 y 23 rechazadas (AC-004.1, AC-004.2).
- `parse_meal_type`: los cuatro válidos; ausente y desconocido (AC-003.2).
- `validate_grams`: 1 y 2000 válidos; 0, 2001, `"150"`, `True`, `None` (AC-003.4); 150,25 y 150,5 (AC-003.5).
- `parse_items`: no lista, vacía (AC-003.3); 51 elementos (AC-003.13); `fdc_id` y `name` a la vez o ninguno (AC-003.7);
  nombre vacío, solo espacios y 101 caracteres tras `strip()` (AC-003.8); `per_100g` incompleto o no numérico
  (AC-003.9); calorías −1/0/900/901 (AC-003.10); macros −1 y 101 (AC-003.11); suma 100 y 100,1, incluido 33,3 + 33,3 +
  33,4 (AC-003.12); `strip()` del nombre (AC-002.1); mezcla de USDA y personalizado (AC-002.2).
- `portion_nutrients`: el pollo de AC-001.1 con 150 g (5,355 → 5,36) y 200 g (AC-006.1); `None` se conserva
  (AC-001.4); 0 da 0 y no `None` (AC-002.3); gallo pinto de AC-002.1; 100 g devuelve los valores por 100 g (AC-006.2).
- `sum_nutrients`: 247,5 + 400,0 = 647,5 (AC-005.3); con un `None` en carbohidratos (AC-005.4); lista vacía (AC-005.2).

**Unitarios, `backend/tests/test_services/test_meal_service.py`** (`MealService` con dobles por constructor):
- Dobles: `FakeMealRepository` **nuevo** en `tests/fakes.py` (guarda instancias reales de `Meal` sin sesión; `create`
  asigna `id` entero creciente; `delete` las quita; implementa los tres métodos de `MealRepository` filtrando por usuario;
  `created`/`deleted` para las aserciones) y una utilidad `make_food(fdc_id, description, data_type, **per_100g)` que
  devuelve un `SimpleNamespace` con la forma de `Food`; reutiliza `FakeFoodRepository` (021), `FakeLockingUserRepository`,
  `FakeUnitOfWork` y `FakeClock`. Los `MealItem` precargados llevan `id` asignado a mano.
- Casos: crea la comida y `created=True` (AC-001.1); reutiliza la existente con `created=False` y conserva el orden
  (AC-001.2, AC-001.5); otro tipo crea otra (AC-001.3); copia descripción, `data_type` y `per_100g` (AC-001.6); FDC ID
  inexistente → 400 sin `commit` y con `rollback` (AC-003.6, AC-003.14); tope 48 + 3 y 48 + 2 (AC-003.13); ventana con
  `FakeClock(datetime(2026, 10, 21, 3, 0))` (AC-004.1, AC-004.2); `get_diary` ordena por tipo y acepta fechas antiguas
  (AC-005.1, AC-005.7); `update_item_grams` recalcula con la copia aunque el `Food` del doble cambie (AC-006.1, AC-008.2)
  y sin ventana (AC-006.5); 404 de comida ajena o inexistente e ítem de otra comida (AC-009.3 a AC-009.5); cuerpo no
  objeto en `PATCH` (AC-006.4); `remove_item` borra la comida vacía (AC-007.2); se bloquea la fila del usuario en cada
  escritura (`for_update_calls`).

**Integración, `backend/tests/test_routes/test_meal_routes.py`** (fixture `client`, `app_clock` para fijar
2026-10-21 03:00 UTC cuando importa la fecha, y alimentos sembrados con `db.session.add(Food(...))` como en
`test_food_routes.py`; usuarios reales registrados por `/api/auth/register`, con una utilidad local
`register(client, email)` para el segundo usuario, porque `meals.user_id` tiene FK a `users`):
- Respuestas completas y códigos de AC-001.1 a AC-001.6 y AC-002.1 a AC-002.3 (incluida la forma de la sección 6).
- Validación de extremo a extremo: cuerpo texto, `null`, lista y JSON malformado (AC-003.1); un caso por mensaje de
  AC-003.2 a AC-003.13; AC-003.14 comprueba con una consulta a `meals`/`meal_items` que no se guardó nada.
- Fechas: AC-004.1 a AC-004.3 con el reloj fijado.
- Diario: AC-005.1 a AC-005.7.
- `PATCH`: AC-006.1 a AC-006.5.
- `DELETE`: AC-007.1 a AC-007.5.
- Historial: AC-008.1 (actualiza la fila de `foods` con la sesión y relee el diario), AC-008.2 y AC-008.3 (borra la
  fila de `foods`).
- Seguridad: sin cabecera, token caducado (`jwt_manager.generate_token(..., -1)` o similar) e inválido en los cinco
  endpoints (AC-009.1); AC-009.2 a AC-009.6.

**Migración**: los tests usan `create_all()`, que no la ejerce; el `reviewer` comprueba a mano que
`b3d5f7a9c1e4` coincide con los modelos (columnas, `CHECK`, única, índice y `ON DELETE CASCADE`) (Art. P2.4).

### frontend
Vitest con `globals: false` (Art. P1.2); la red se simula con `vi.mock("@/features/diary/api", …)`,
`vi.mock("@/features/foods/api", …)` y `vi.mock("@/features/profile/api", …)` (Art. P1.4); la fecha se fija con
`vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 20, 12, 0))`. Fábricas nuevas en
`frontend/src/test/diaryFixtures.ts` (`makeMealItem`, `makeCustomItem`, `makeMeal`, `makeDiary`) y el perfil con
`makeProfileResponse` de `src/test/profileFixtures.ts`.

- `features/diary/nutrition.test.ts`: `portionNutrients` (AC-011.2, AC-011.3, AC-011.7, AC-012.3) y `nutrientProgress`
  (AC-014.1, AC-014.2, AC-014.5).
- `features/diary/format.test.ts`: `formatDiaryDate` («martes, 20 de octubre», AC-010.1), `formatKcal`,
  `formatLoggedGrams` («150 g», «150,5 g»), `formatPortionPreview` con «—» (AC-011.7), `sourceLabel` (AC-010.6).
- `features/diary/schemas.test.ts`: `parseDecimalText` con coma y punto; `gramsFormSchema` (AC-011.5);
  `customFoodFormSchema` y `customItemPayload` (AC-012.2, AC-012.4).
- `features/diary/errors.test.ts`: `saveErrorMessage` con 400 y con otros errores (AC-011.6, AC-013.5).
- `features/diary/pages/DiaryPage.test.tsx`: AC-010.1 a AC-010.6; totales frente a Macros con el mismo perfil que
  `MacrosPage.test.tsx` (AC-014.1 a AC-014.6, comparando con `calculateMacros` para AC-014.3); `getDiary` llamado con
  `"2026-10-20"` (AC-010.2); relectura tras añadir, editar y quitar (AC-011.4, AC-012.2, AC-013.2, AC-013.4,
  AC-014.6); «Quitar» falla (AC-013.5); nombres accesibles de «Editar»/«Quitar» (AC-013.6); regiones anunciadas
  (AC-N002.3); barras por rol y nombre (AC-N002.2).
- `features/diary/components/AddFoodDialog.test.tsx`: AC-011.1 a AC-011.10 (título y búsqueda, vista previa, cambio de
  gramos sin peticiones, payload, validaciones sin petición, error 400 y genérico, «—», cancelar, volver sin repetir la
  búsqueda, «Guardando…»), AC-012.1 a AC-012.6 (campos, envío, vista previa, validaciones, `maxLength`, botón junto a
  «No encontramos…» con el nombre relleno) y AC-N002.1.
- `features/diary/components/EditGramsDialog.test.tsx`: AC-013.1 a AC-013.3 y el error de guardado de AC-013.5.
- `components/layout/Navbar.test.tsx` y `components/layout/BottomTabBar.test.tsx`: se actualiza la lista esperada a la
  de AC-015.1/AC-015.2 y se añade el enlace a `/diary` y su estado activo con `MemoryRouter initialEntries={["/diary"]}`
  (AC-015.3). `noFoodsLink.test.tsx` (021) sigue igual y debe seguir pasando.
- `app/diaryRoute.test.tsx`: `/foods` sigue mostrando «Alimentos» (AC-015.4); `/diary` muestra «Cargando…» y después
  la pantalla, y el código fuente de `router.tsx` (`?raw`) declara `DiaryPage` con `lazyNamed` y la importa solo de
  forma dinámica (AC-N001.1), como `foodsRoute.test.tsx` y `lazyRoutes.test.tsx`.
- `features/legal/pages/TermsOfServicePage.test.tsx` y `PrivacyPolicyPage.test.tsx`: AC-016.1 y AC-016.2.
- Los tests de `FoodsPage.test.tsx` (021) deben seguir pasando sin cambios: `onSelect` y `defaultQuery` son opcionales.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Redondeo distinto entre servidor y vista previa (5,355 → 5,35 por el error binario) | Media | Medio | `Decimal(repr(v))` con `ROUND_HALF_UP` en el servidor y `toPrecision(12)` + notación exponencial en el cliente; tests con los valores exactos de la spec en los dos ámbitos. |
| Migración olvidada o distinta de los modelos (los tests usan `create_all()`) | Media | Alto | Restricciones declaradas también en los modelos; revisión manual del `reviewer` (Art. P2.4); paso manual documentado por el `doc-keeper` (Art. P4). |
| Carreras al crear la misma comida o al superar 50 alimentos con peticiones simultáneas | Baja | Medio | Bloqueo de la fila del usuario en todas las escrituras (patrón de ADR-0020) y restricción única como red de seguridad. |
| Ids enormes en la URL (`<int:>` admite cualquier entero) provocan un 500 de Postgres | Baja | Bajo | `is_db_id` responde 404 antes de consultar. |
| Los tests existentes de las barras afirman la lista antigua de entradas | Alta | Bajo | El `test-author` los actualiza a AC-015.1/AC-015.2 (cambio de requisito, no debilitamiento, Art. B5.3). |
| Campo `type="number"` no admite coma en algunos navegadores ni en jsdom | Media | Medio | Campos de texto con `inputMode="decimal"` y `parseDecimalText`. |

## 7. Cumplimiento de la constitución
- **Art. B1/B4/B5:** todo el cambio sale de la spec aprobada; cada REQ y NFR está en el mapa y cada AC tiene su archivo de
  test en la sección 5; los esqueletos siguen Art. B5.6 y P1.5 (`raise NotImplementedError("not implemented")` y
  `throw new Error("not implemented")`, con `_` en los parámetros de TypeScript).
- **Art. B5.3:** los cambios en `Navbar.test.tsx`, `BottomTabBar.test.tsx` y en los tests legales adaptan las aserciones
  a los requisitos nuevos de REQ-015 y REQ-016; no se borra ni se salta ningún test.
- **Art. P1:** tests en `test_services/` y `test_routes/` con nombres en inglés y docstrings en español; fakes a mano
  por constructor, sin `unittest.mock` ni `monkeypatch`; en el frontend, `vi.mock` de los `api.ts`.
- **Art. P2.1–P2.3 (backend):** capas respetadas, solo `UnitOfWork` confirma, dependencias por constructor desde
  `_build_meal_service()`, errores con `ValidationError`/`ResourceNotFoundError`.
- **Art. P2.4 / P4:** migración `b3d5f7a9c1e4` incluida y revisada a mano; el paso manual queda para `docs`.
- **Art. P2.5:** se reutilizan `utils/clock.py`, `is_number`, `require_json_object`, `UserRepository.get_by_id_for_update`
  y `FoodRepository.get_by_fdc_ids`; no se duplica ninguna utilidad.
- **Art. P2 (frontend):** feature `src/features/diary/` con `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`,
  `components/` y `pages/` (más `constants.ts`, `nutrition.ts`, `format.ts` y `errors.ts`, como otras features); solo
  `apiFetch`; TanStack Query y react-hook-form con zod; componentes shadcn existentes (`Dialog`, `Button`, `Input`,
  `Form`, `Card`, `Label`). La barra de progreso es un componente propio de la feature porque no hay uno de shadcn
  instalado y añadirlo no es necesario.
- **Art. P3.1/P3.2/P3.4:** `@require_auth` y filtro por el usuario del token en la misma consulta; validación en el
  servicio y con zod; solo ORM. **P3.3** no aplica (sin proveedores de IA). **P3.5:** no hay variables nuevas.
- **Art. P2 General:** textos en español, sin voseo.
- No hay dependencias nuevas, ni migraciones destructivas, ni cambios en APIs existentes (`/api/foods/search` intacto).
- Ningún «DEBERÍA» queda sin cumplir.

## 8. ADRs
- [ADR-0030](../../docs/sdd/decisions/ADR-0030-diario-de-comidas-con-copia-nutricional.md): copia de los valores
  nutricionales sin FK a `foods`, `Decimal` con `ROUND_HALF_UP`, día enviado por el cliente con ventana de ±1 día, ids
  enteros y bloqueo de la fila del usuario (Propuesta).
