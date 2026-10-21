# Plan 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-21)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución
- **Backend:** tabla nueva `public.catalog_foods` (modelo `CatalogFood`) con identificador de texto estable, nombre,
  sinónimos (`TEXT[]`), cuatro valores por 100 g y origen (`usda` con `fdc_id` o `manual` con `reference`); y en
  `meal_items` una columna `catalog_id` con el origen nuevo `catalog`. Una sola migración, aditiva, que no se aplica sola.
- **Carga:** lector y validador del CSV (`services/catalog_csv_reader.py`) y `CatalogLoadService`, que compara las filas
  `usda` con `public.foods` y sincroniza la tabla en una sola transacción (añade, actualiza y borra). El script fino
  `backend/scripts/load_food_catalog.py` pide `[s/N]` si la base no es local; la confirmación se comparte con la
  importación de USDA en `scripts/database_target.py`. El CSV vive en `backend/scripts/data/food_catalog.csv`.
- **Búsqueda:** `GET /api/catalog/search` (`routes/catalog_routes.py`, `@require_auth`) → `CatalogSearchService`, que
  valida con el `normalize_query` de la 021, lee el catálogo completo (como mucho 350 filas) y filtra y ordena con
  funciones puras (`services/catalog_rules.py`). No usa Voyage, Redis ni ninguna extensión de Postgres (NFR-001).
- **Diario:** `meal_rules.parse_items` acepta `{catalog_id, grams}`; `MealService` recibe el repositorio del catálogo y
  copia nombre y valores por 100 g, como con USDA (ADR-0030). Decisión en ADR-0031.
- **Frontend:** feature nueva `src/features/catalog/` (tipos, esquema, `api.ts`, hook y `CatalogResultList`); el
  diálogo de añadir del diario busca en el catálogo; los alimentos del catálogo se pintan sin etiqueta de origen;
  `/foods` redirige a `/diary`; textos legales actualizados.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | models | `backend/models/catalog_food.py` (`CatalogFood`, `CATALOG_SOURCES`) | `backend/models/__init__.py`, `backend/models/meal.py` (`catalog_id`, `MEAL_ITEM_SOURCES`, `CHECK`) | Catálogo (REQ-001, REQ-002) y tercer origen en comidas (REQ-006) |
| backend | migrations | `backend/migrations/versions/d4f6a8c0e2b5_create_catalog_foods_and_catalog_meal_items.py` | — | Tabla, columna y `CHECK` nuevas (Art. P2.4, P4) |
| backend | repositories | `backend/repositories/catalog_food_repository.py` | — | Lectura completa y por identificadores (REQ-002, REQ-004, REQ-006) |
| backend | services | `backend/services/catalog_rules.py`, `backend/services/catalog_csv_reader.py`, `backend/services/catalog_load_service.py`, `backend/services/catalog_search_service.py` | `backend/services/meal_rules.py`, `backend/services/meal_service.py` | Normalización, lectura y validación del CSV, carga, búsqueda y alimentos del catálogo en comidas |
| backend | routes | `backend/routes/catalog_routes.py` (`catalog_bp`, `/api/catalog`) | `backend/routes/__init__.py`, `backend/routes/meal_routes.py` (`catalog_id` en la respuesta y repositorio del catálogo en `_build_meal_service`) | REQ-004, REQ-005, REQ-006 |
| backend | scripts | `backend/scripts/database_target.py`, `backend/scripts/load_food_catalog.py`, `backend/scripts/data/food_catalog.csv` | `backend/scripts/import_usda_foods.py` (usa `database_target`, mismo comportamiento) | Carga a mano y CSV del catálogo (REQ-001 a REQ-003) |
| backend | tests | `backend/tests/catalog_samples.py`, `backend/tests/test_services/test_catalog_rules.py`, `backend/tests/test_services/test_catalog_csv_reader.py`, `backend/tests/test_services/test_catalog_load_service.py`, `backend/tests/test_services/test_catalog_search_service.py`, `backend/tests/test_services/test_food_catalog_csv.py`, `backend/tests/test_services/test_catalog_migration.py`, `backend/tests/test_routes/test_catalog_routes.py`, `backend/tests/test_scripts/test_load_food_catalog_script.py` | `backend/tests/fakes.py` (`make_catalog_food`, `FakeCatalogFoodRepository`), `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py`, `backend/tests/test_routes/test_meal_routes.py` | Sección 5 |
| frontend | feature `catalog` | `frontend/src/features/catalog/{types.ts,schemas.ts,api.ts,hooks.ts}`, `frontend/src/features/catalog/components/CatalogResultList.tsx` | — | Búsqueda en el catálogo (REQ-009, NFR-002); la reutilizará la 024 |
| frontend | feature `diary` | — | `frontend/src/features/diary/{types.ts,schemas.ts,format.ts}`, `components/AddFoodDialog.tsx`, `components/MealItemRow.tsx` | Diálogo con el catálogo y alimentos sin etiqueta de origen (REQ-009, REQ-010) |
| frontend | feature `foods` | — | `frontend/src/features/foods/components/FoodSearchForm.tsx` (prop opcional `placeholder`) | Ejemplo «Ej.: arroz blanco cocido, banano» sin cambiar `FoodsPage` |
| frontend | app | — | `frontend/src/app/router.tsx` | `/foods` → `<Navigate to="/diary" replace />` y se quita `FoodsPage` del router (REQ-011) |
| frontend | legal | — | `frontend/src/features/legal/pages/TermsOfServicePage.tsx`, `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx` | REQ-012 |
| frontend | tests | `frontend/src/test/catalogFixtures.ts`, `frontend/src/features/catalog/schemas.test.ts`, `frontend/src/features/catalog/components/CatalogResultList.test.tsx` | `frontend/src/test/diaryFixtures.ts`, `frontend/src/features/diary/components/AddFoodDialog.test.tsx`, `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/features/diary/format.test.ts`, `frontend/src/features/diary/schemas.test.ts`, `frontend/src/app/foodsRoute.test.tsx`, `frontend/src/app/diaryRoute.test.tsx`, `frontend/src/components/layout/noFoodsLink.test.tsx`, `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx`, `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` | Sección 5 |
| docs | runbook | — | `docs/deploy-runbook.md`, `CLAUDE.md` (los hace el `doc-keeper`) | Migración antes del merge y carga del catálogo tras el CD (Art. P4) |

No se tocan `public.foods`, `FoodImportService`, `FoodSearchService`, `GET /api/foods/search` ni `FoodsPage` (fuera de
alcance). No hay dependencias ni variables nuevas.

## 3. Diseño

### 3.1 Datos y migraciones
**Tabla `public.catalog_foods`** (`backend/models/catalog_food.py`, clase `CatalogFood(Base)`):

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | `VARCHAR(60)` | no | Clave primaria, el identificador del CSV (`arroz-blanco-cocido`). |
| `name` | `VARCHAR(80)` | no | Nombre en español. |
| `synonyms` | `TEXT[]` (`ARRAY(Text)`) | no | `server_default '{}'`; en el orden del CSV. |
| `calories_kcal`, `protein_g`, `carbs_g`, `fat_g` | `DOUBLE PRECISION` | no | Valores por 100 g. |
| `source` | `VARCHAR(10)` | no | `usda` o `manual`. |
| `fdc_id` | `INTEGER` | sí | FDC ID de origen; **sin** FK a `foods` (ADR-0031). |
| `reference` | `TEXT` | sí | Fuente de los valores; no se expone. |
| `created_at`, `updated_at` | `TIMESTAMP` | no | `server_default now()`; `updated_at` con `onupdate`. |

Restricciones, declaradas también en `__table_args__` (con `{"schema": "public"}`) para que `create_all()` cree lo mismo:
- `ck_catalog_foods_id_format`: `char_length(id) BETWEEN 2 AND 60 AND id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`.
- `ck_catalog_foods_name_length`: `char_length(name) BETWEEN 2 AND 80`.
- `ck_catalog_foods_calories`: `calories_kcal >= 0 AND calories_kcal <= 900`.
- `ck_catalog_foods_macros`: `protein_g`, `carbs_g` y `fat_g` entre 0 y 100.
- `ck_catalog_foods_source`: `source IN ('usda', 'manual')`.
- `ck_catalog_foods_source_fields`: `(source = 'usda' AND fdc_id IS NOT NULL) OR (source = 'manual' AND fdc_id IS NULL
  AND reference IS NOT NULL)`.
- La suma de macros ≤ 100 y la unicidad de nombres y sinónimos sin mayúsculas ni tildes **no** van en la base: las
  valida la carga con `Decimal` y con la clave normalizada (motivo en ADR-0031).

**Cambios en `public.meal_items`** (`backend/models/meal.py`):
- Columna nueva `catalog_id VARCHAR(60) NULL`, sin FK (REQ-007).
- `MEAL_ITEM_SOURCES = ("catalog", "usda", "custom")`.
- `ck_meal_items_source` pasa a `source IN ('catalog', 'usda', 'custom')`.
- `ck_meal_items_source_fields` pasa a:
  `(source = 'catalog' AND catalog_id IS NOT NULL AND fdc_id IS NULL AND data_type IS NULL) OR
  (source = 'usda' AND catalog_id IS NULL AND fdc_id IS NOT NULL AND data_type IS NOT NULL) OR
  (source = 'custom' AND catalog_id IS NULL AND fdc_id IS NULL AND data_type IS NULL)`.
  Las filas existentes (`catalog_id` nulo) la cumplen, así que crearla no toca datos (REQ-008).

**Migración** `d4f6a8c0e2b5_create_catalog_foods_and_catalog_meal_items.py` (`down_revision = "b3d5f7a9c1e4"`):
- `upgrade`: `create_table('catalog_foods', …)` con sus `CHECK`; `add_column('meal_items', catalog_id)`;
  `drop_constraint` de `ck_meal_items_source` y `ck_meal_items_source_fields` (`type_="check"`) y `create_check_constraint`
  de las nuevas. Todo con `schema="public"`.
- `downgrade`: primero cuenta `SELECT count(*) FROM public.meal_items WHERE source = 'catalog'` (con
  `op.get_bind().exec_driver_sql`, sin interpolar valores); si es mayor que 0, lanza `RuntimeError(f"Hay {n} alimentos
  del catálogo registrados en comidas: quítalos antes de revertir esta migración.")` sin modificar nada. Si no, restaura
  las dos `CHECK` de la 022, quita `catalog_id` y borra `catalog_foods` (el catálogo se recarga desde el CSV).
- Es **aditiva** y **no** se aplica sola (ADR-0016): el `doc-keeper` documenta en `docs/deploy-runbook.md` el volcado
  verificado en `C:/Users/alber/fitnerd-backups`, `flask db upgrade` con `FLASK_ENV` bien puesto **antes del merge** y,
  tras el CD, la carga del catálogo (sección 3.3). Se genera con `FLASK_ENV=development flask db migrate` y se revisa a
  mano (Art. P2.4): Alembic no detecta cambios en el texto de una `CHECK`, así que las dos de `meal_items` se escriben a
  mano; si el autogenerado difiere de esta sección, manda esta.
- **Datos:** la carga del catálogo en producción es un paso manual después del CD; requiere `public.foods` cargada
  (lo está desde la 021).

### 3.2 Contratos e interfaces
**HTTP:**
- `GET /api/catalog/search?q={consulta}` con `@require_auth`: respuestas, mensajes y formato exactamente los de la
  sección 6 de la spec. Se lee solo `request.args.get("q")`; `limit` y cualquier otro parámetro se ignoran.
- `POST /api/meals`: acepta `{"catalog_id": str, "grams": número}` en `items`. Mensajes nuevos o cambiados:
  `ITEM_SOURCE_MESSAGE = "Cada alimento debe ser del catálogo, de USDA o personalizado."` (sustituye al de la 022);
  `catalog_id` inexistente o con formato no válido → `FOOD_NOT_FOUND_MESSAGE` («No encontramos ese alimento.»).
- Todas las respuestas de comidas (`GET`/`POST /api/meals`, `PATCH`) llevan `catalog_id` en cada alimento (texto o
  `null`). El resto del contrato de la 022 no cambia.

**Firmas del backend** (los tests importan estos símbolos; el `implementer` crea primero sus esqueletos según Art. P1.5):

```python
# backend/models/catalog_food.py
CATALOG_SOURCES: tuple[str, ...] = ("usda", "manual")

class CatalogFood(Base):
    __tablename__ = "catalog_foods"
    id: Mapped[str]
    name: Mapped[str]
    synonyms: Mapped[list[str]]
    calories_kcal: Mapped[float]
    protein_g: Mapped[float]
    carbs_g: Mapped[float]
    fat_g: Mapped[float]
    source: Mapped[str]
    fdc_id: Mapped[int | None]
    reference: Mapped[str | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

# backend/models/meal.py (cambios)
MEAL_ITEM_SOURCES: tuple[str, ...] = ("catalog", "usda", "custom")
class MealItem(Base):
    catalog_id: Mapped[str | None]      # VARCHAR(60), sin FK
```

```python
# backend/services/catalog_rules.py
CATALOG_ID_LENGTH = (2, 60)
CATALOG_NAME_LENGTH = (2, 80)
SYNONYM_LENGTH = (2, 80)
CALORIES_RANGE = (0, 900)
MACRO_RANGE = (0, 100)
FORBIDDEN_NAME_WORDS: tuple[str, ...] = ("con", "frito", "frita", "fritos", "fritas")
MIN_REDUCED_FORM_LENGTH = 3

def is_catalog_id(value: object) -> bool: ...   # str, longitud 2–60 y ^[a-z0-9]+(-[a-z0-9]+)*$
def fold(text: str) -> str: ...                 # casefold + NFKD sin marcas combinantes: «Piña» → «pina», «Pingüino» → «pinguino»
def words(text: str) -> list[str]: ...          # re.findall(r"[a-z0-9]+", fold(text))
def term_key(text: str) -> str: ...             # " ".join(words(text)); clave de unicidad de nombres y sinónimos
def word_forms(word: str) -> tuple[str, ...]: ...
    # forma escrita + sin «s» final + sin «es» final, cada reducida solo con >= 3 caracteres, sin repetidos:
    # "huevos" → ("huevos", "huevo", "huev"); "limones" → ("limones", "limone", "limon"); "es" → ("es",)
```

```python
# backend/services/catalog_csv_reader.py
REQUIRED_COLUMNS: tuple[str, ...] = (
    "id", "name", "synonyms", "calories_kcal", "protein_g", "carbs_g", "fat_g",
    "source", "fdc_id", "reference",
)
NUTRIENT_COLUMNS: tuple[str, ...] = ("calories_kcal", "protein_g", "carbs_g", "fat_g")

class CatalogFileError(Exception):
    def __init__(self, path: Path, message: str): ...   # guarda path y message; str(error) == message

@dataclass(frozen=True)
class CatalogRecord:
    row: int                       # fila de datos, desde 1 (la cabecera no cuenta)
    id: str
    name: str
    synonyms: tuple[str, ...]
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source: str                    # "usda" | "manual"
    fdc_id: int | None
    reference: str | None

def read_catalog_csv(path: Path | str) -> list[CatalogRecord]: ...
    # valida formato, rangos y unicidad (no consulta la base); CatalogFileError si algo falla
```

```python
# backend/services/catalog_load_service.py
@dataclass
class CatalogLoadSummary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0

class CatalogLoadService:
    def __init__(self, catalog_repository, food_repository, unit_of_work): ...
    def run(self, path: Path | str) -> CatalogLoadSummary: ...   # CatalogFileError ante cualquier error, sin escribir

def format_catalog_summary(summary: CatalogLoadSummary) -> str: ...
    # "Catálogo: 3 añadidos, 0 actualizados, 0 sin cambios, 0 quitados."
```

```python
# backend/services/catalog_search_service.py
MAX_RESULTS = 20
GROUP_EXACT, GROUP_NAME_PREFIX, GROUP_OTHER = 0, 1, 2

def query_forms(query: str) -> list[tuple[str, ...]]: ...      # [word_forms(w) for w in words(query)]
def match_group(name: str, synonyms: Sequence[str],
                query: list[tuple[str, ...]]) -> int | None: ...   # None = no coincide
def rank_catalog(foods: Iterable, query: str, limit: int = MAX_RESULTS) -> list: ...

class CatalogSearchService:
    def __init__(self, catalog_repository): ...
    def search(self, raw_query: str | None) -> list[CatalogFood]: ...
```

```python
# backend/repositories/catalog_food_repository.py
class CatalogFoodRepository(BaseRepository):   # create(instance), update(instance) y delete(instance) heredados
    def __init__(self, session): ...
    def list_all(self) -> list[CatalogFood]: ...                   # ordenado por id
    def get_by_ids(self, ids: list[str]) -> list[CatalogFood]: ...  # orden libre; [] si ids está vacía
```

```python
# backend/routes/catalog_routes.py
catalog_bp = Blueprint("catalog", __name__, url_prefix="/api/catalog")
def _build_catalog_search_service() -> CatalogSearchService: ...   # CatalogSearchService(CatalogFoodRepository(db.session))
def catalog_food_to_json(food: CatalogFood) -> dict: ...
    # {"id", "name", "per_100g": {calories_kcal, protein_g, carbs_g, fat_g}} con float; sin sinónimos, fdc_id ni fuente
@catalog_bp.route("/search", methods=["GET"])
@require_auth
def search(): ...
```

```python
# backend/services/meal_rules.py (cambios)
ITEM_SOURCE_MESSAGE = "Cada alimento debe ser del catálogo, de USDA o personalizado."

@dataclass(frozen=True)
class CatalogItemInput:
    catalog_id: str
    grams: Decimal

def parse_items(value: object) -> list[CatalogItemInput | UsdaItemInput | CustomItemInput]: ...
```

```python
# backend/services/meal_service.py (cambio de constructor, compatible con las llamadas de la 022)
class MealService:
    def __init__(self, meal_repository, food_repository, user_repository, unit_of_work,
                 clock=utc_now, catalog_repository=None): ...
```

```python
# backend/scripts/database_target.py
LOCAL_HOSTS: frozenset[str] = frozenset({"localhost", "127.0.0.1", "::1", "postgres"})
CONFIRM_PROMPT = "La base de datos NO es local. ¿Escribir en ella? [s/N]: "
AFFIRMATIVE_ANSWERS: frozenset[str] = frozenset({"s", "si", "sí", "y", "yes"})
def is_local_host(host: str | None) -> bool: ...     # host no nulo y host.lower() en LOCAL_HOSTS
def confirm_remote_write() -> bool: ...              # input(CONFIRM_PROMPT); EOFError → False

# backend/scripts/import_usda_foods.py: _LOCAL_HOSTS, _is_local y _confirm pasan a ser alias de lo anterior
# (mismos nombres y mismo comportamiento; sus tests de la 021 no cambian).

# backend/scripts/load_food_catalog.py
DEFAULT_CATALOG_PATH = Path(__file__).parent / "data" / "food_catalog.csv"
CANCEL_MESSAGE = "Carga cancelada: no se ha escrito nada."
def main(argv: list[str] | None = None) -> int: ...
# python -m scripts.load_food_catalog [RUTA_CSV] [--yes]   (RUTA_CSV opcional, por defecto DEFAULT_CATALOG_PATH)
```

**Mensajes del lector y de la carga** (en `CatalogFileError`; cada uno nombra el archivo):
- Archivo inexistente: `f"No se encontró el archivo {path}."`.
- Columna ausente: `f"Al archivo {path} le falta la columna obligatoria «{column}»."` (se exigen las diez columnas de
  `REQUIRED_COLUMNS`; las demás se ignoran).
- Errores de filas: una primera línea `f"El archivo {path} tiene errores:"` y una línea por error, en el orden de las
  filas, con estos formatos:
  - de una fila: `f"- Fila {row} ({id o 'sin identificador'}): {regla}."`;
  - de unicidad: `f"- Filas {a} y {b}: {regla}."`;
  - de USDA: `f"- Fila {row} ({id}): el FDC ID {fdc_id} no existe en la base de USDA."` y
    `f"- Fila {row} ({id}): «{columna}» es {valor del CSV} y en USDA (FDC ID {fdc_id}) es {valor de USDA o 'sin dato'}."`.
- Reglas (`{regla}`), como constantes del lector:
  - `"el identificador debe tener de 2 a 60 caracteres, solo minúsculas sin tildes, dígitos y guiones sueltos"`;
  - `"el nombre debe tener de 2 a 80 caracteres y empezar por mayúscula"`;
  - `"el nombre no puede contener la palabra «{palabra}»"`;
  - `"cada sinónimo debe tener de 2 a 80 caracteres"`;
  - `"falta el valor de «{columna}»"` (AC-003.8);
  - `"«{columna}» debe ser un número con punto decimal"`;
  - `"«calories_kcal» debe estar entre 0 y 900"` y `"«{columna}» debe estar entre 0 y 100"` (AC-003.3);
  - `"la proteína, los carbohidratos y la grasa no pueden sumar más de 100 g"`;
  - `"«source» debe ser usda o manual"`;
  - `"las filas usda necesitan «fdc_id»"` y `"«fdc_id» debe ser un número entero positivo"`;
  - `"las filas manual necesitan «reference»"` y `"las filas manual deben dejar «fdc_id» vacío"` (AC-003.7);
  - `"identificador repetido «{id}»"`, `"nombre repetido «{nombre}»"` y `"«{término}» se repite como nombre o
    sinónimo"` (AC-003.4).

**Script** (textos exactos de la sección 6 de la spec): imprime `Entorno: …` y `Base de datos: …` (sin contraseña), el
aviso `CONFIRM_PROMPT`, la cancelación `CANCEL_MESSAGE` con código 1, el resumen con código 0, o el mensaje de
`CatalogFileError` con código 1.

**Firmas del frontend:**

```ts
// src/features/catalog/types.ts
export type CatalogNutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type CatalogPer100g = Record<CatalogNutrientKey, number>
export type CatalogFood = { id: string; name: string; per_100g: CatalogPer100g }
export type CatalogSearchResponse = { results: CatalogFood[] }

// src/features/catalog/schemas.ts
export const catalogSearchResponseSchema   // z.object({ results: z.array(z.object({ id: z.string(), name: z.string(), per_100g: z.object({…z.number()}) })) })

// src/features/catalog/api.ts (solo apiFetch, Art. P2.2)
export async function searchCatalog(query: string): Promise<CatalogSearchResponse>
// apiFetch(`/api/catalog/search?${new URLSearchParams({ q: query })}`) y catalogSearchResponseSchema.parse

// src/features/catalog/hooks.ts
export function useCatalogSearch()   // useMutation({ mutationFn: (query: string) => searchCatalog(query), retry: false })

// src/features/catalog/components/CatalogResultList.tsx
export function CatalogResultList(props: {
  foods: CatalogFood[]
  onSelect: (food: CatalogFood) => void
}): ReactElement
```

```ts
// src/features/diary/types.ts (cambios)
export type MealItemSource = "catalog" | "usda" | "custom"
export type MealItem = { …; catalog_id: string | null; … }       // campo nuevo
export type CatalogItemPayload = { catalog_id: string; grams: number }
export type AddMealItemsPayload = {
  date: string; meal_type: MealType; items: (CatalogItemPayload | UsdaItemPayload | CustomItemPayload)[]
}

// src/features/diary/schemas.ts (cambios en mealResponseSchema)
//   source: z.enum(["catalog", "usda", "custom"]); catalog_id: z.string().nullable().default(null)

// src/features/diary/format.ts (cambio)
export function sourceLabel(item: MealItem): string | null   // null en "catalog"; «Personalizado», «Foundation» o «SR Legacy» en los demás

// src/features/foods/components/FoodSearchForm.tsx (prop opcional nueva, compatible)
export function FoodSearchForm(props: {
  onSearch: (query: string) => void; isSearching: boolean; defaultQuery?: string; placeholder?: string
}): ReactElement   // placeholder por defecto "Ej.: chicken breast, arroz blanco"
```

`AddFoodDialog`, `MealItemRow` y el resto de componentes del diario conservan sus firmas.

### 3.3 Lógica

**Normalización (`services/catalog_rules.py`, funciones puras):**
- `fold`: `unicodedata.normalize("NFKD", text.casefold())` sin los caracteres con `unicodedata.combining(c)`; así
  mayúsculas, tildes, diéresis y «ñ» → «n» quedan iguales (AC-004.3, AC-004.6).
- `words`: palabras de `[a-z0-9]+` del texto plegado (los espacios, comas y guiones separan palabras).
- `word_forms`: ver firmas. Solo se aplica a las palabras de la **consulta**, nunca a las del catálogo.

**Lectura del CSV (`read_catalog_csv`, sin base de datos):**
1. Si el archivo no existe → error de archivo (AC-003.1). Lee con `encoding="utf-8-sig"` y `csv.DictReader`
   (separador coma). Si falta alguna de `REQUIRED_COLUMNS` → error de columna, la primera que falte (AC-003.2).
2. Por fila (`row` desde 1), con cada celda recortada (`strip()`), acumula **todos** los errores:
   - `id`: `is_catalog_id`.
   - `name`: longitud 2–80 y primer carácter con `isupper()`; si alguna de `words(name)` está en
     `FORBIDDEN_NAME_WORDS`, el error de palabra prohibida (AC-001.3).
   - `synonyms`: celda vacía → `()`; si no, `split("|")` y `strip()` de cada uno; cada uno de 2 a 80 caracteres (un
     segmento vacío, como en `a||b`, incumple la longitud).
   - Valores: celda vacía → «falta el valor» (AC-003.8); si no casa con `^\d+(\.\d+)?$` → «número con punto decimal»;
     rangos de calorías (0–900) y de cada macro (0–100) (AC-003.3); suma de macros con `Decimal(celda)` > 100.
   - `source`: `usda` o `manual`. En `usda`, `fdc_id` obligatorio y entero positivo (`^\d+$`, ≥ 1); `reference`
     opcional (vacía → `None`). En `manual`, `reference` obligatoria y `fdc_id` vacío (AC-003.7).
3. Unicidad entre filas (sobre las filas que tienen el campo con formato válido): `id` repetido; `term_key(name)`
   repetido; y cualquier `term_key` de sinónimo que coincida con el nombre o con otro sinónimo del mismo alimento o de
   otro (AC-001.2, AC-003.4). El error nombra las dos filas (la primera aparición y la repetida).
4. Si hay errores, lanza un único `CatalogFileError` con todas las líneas; si no, devuelve los `CatalogRecord` en el
   orden del archivo. El número de filas (250–350) y la lista mínima **no** son reglas del lector (la carga de AC-002.1
   usa un CSV de 3 filas): los comprueba el test del CSV del repositorio (AC-001.1, AC-001.4).

**Carga (`CatalogLoadService.run`)**, dependencias por constructor: `CatalogFoodRepository`, `FoodRepository` (de la
021) y `UnitOfWork`.
1. `records = read_catalog_csv(path)` (cualquier error sale antes de tocar la base).
2. **USDA:** `food_repository.get_by_fdc_ids` con los FDC ID de las filas `usda` (sin repetidos). Por fila: si el
   FDC ID no está → error; si no, compara cada uno de los cuatro valores con `float(celda) == food.<valor>` (los dos son
   `float` leídos del mismo texto decimal, así que «3.57» y 3.57 de USDA son iguales y «3.6» no lo es, AC-003.5); un
   valor `None` en USDA nunca es igual. Si hay errores, `CatalogFileError` con todas las líneas y sin escribir
   (AC-003.6).
3. **Sincronización** dentro de `try` con `rollback` y relanzamiento ante cualquier excepción: `existing = {f.id: f for
   f in catalog_repository.list_all()}`. Por registro: ausente → `create(CatalogFood(...))` (`added`); con algún cambio
   en `name`, `synonyms` (como lista, en orden), los cuatro valores, `source`, `fdc_id` o `reference` → asigna y
   `update` (`updated`); igual → `unchanged`. Los existentes cuyo `id` no está en el archivo → `delete` (`removed`).
   Un solo `unit_of_work.commit()` (Art. P2.1). Quitar un alimento no toca `meal_items` (no hay FK; REQ-002, REQ-007).
4. Devuelve el resumen; `format_catalog_summary` lo pinta en una línea.

**Script (`scripts/load_food_catalog.py`)**: `argparse` con `csv_path` posicional opcional (`nargs="?"`, por defecto
`DEFAULT_CATALOG_PATH`) y `--yes`. `create_app()` (usa `FLASK_ENV`; por defecto, desarrollo) y, dentro de
`app.app_context()`: imprime entorno y base (`make_url(...).render_as_string(hide_password=True)`); si no hay `--yes` y
`is_local_host(url.host)` es falso, `confirm_remote_write()`; si devuelve `False`, imprime `CANCEL_MESSAGE` y devuelve 1
**antes de construir el servicio** (AC-002.5). Después construye `CatalogLoadService(CatalogFoodRepository(db.session),
FoodRepository(db.session), UnitOfWork(db.session))`, imprime el resumen y devuelve 0; ante `CatalogFileError`, imprime
su mensaje y devuelve 1. El criterio de base local y las respuestas afirmativas son los de la 021 (AC-002.6).

**Búsqueda (`CatalogSearchService.search`)**, dependencia por constructor: `CatalogFoodRepository`.
1. `query = normalize_query(raw_query)`, reutilizado de `services/food_search_service.py` (mismos mensajes y límites,
   REQ-005; Art. P2.5).
2. `rank_catalog(catalog_repository.list_all(), query)`.
3. Sin rate limiting ni proveedores externos (NFR-001; P3.3 no aplica).

**Coincidencia y orden (`rank_catalog`, función pura):** con `q = query_forms(query)` (si queda vacía, por ejemplo con
`"--"`, devuelve `[]`) y, para cada término (el nombre o un sinónimo), `t = words(término)`:
- *Coincide* si cada `forms` de `q` tiene alguna forma `f` y alguna palabra `w` de `t` con `w.startswith(f)` (AC-004.1,
  AC-004.2, AC-004.5, AC-004.12, AC-004.13). Todas las palabras de la consulta deben coincidir en el **mismo** término.
- *Igual* si `len(t) == len(q)` y `t[i] in q[i]` para cada posición (AC-004.4, AC-004.14).
- *El nombre empieza por la consulta* si `len(t_nombre) >= len(q)`, `t_nombre[i] in q[i]` para todas las posiciones
  menos la última, y `t_nombre[n-1]` empieza por alguna forma de `q[n-1]` (AC-004.7).
- `match_group`: `None` si ningún término coincide; `GROUP_EXACT` si el nombre o algún sinónimo es *igual*;
  `GROUP_NAME_PREFIX` si el nombre *empieza por la consulta*; si no, `GROUP_OTHER`.
- Orden por `(grupo, fold(name), name, id)` y los `limit` primeros (20, AC-004.8). `q=es` solo tiene la forma «es»
  (las reducidas «e» y «» se descartan), así que encuentra «Espinaca cocida» y no «Elote cocido» (AC-004.15); las
  erratas no coinciden porque solo se comparan prefijos exactos (AC-004.16).

**Ruta (`routes/catalog_routes.py`)**: `search()` llama a `_build_catalog_search_service().search(request.args.get("q"))`
y responde `jsonify(results=[catalog_food_to_json(f) for f in foods]), 200`. El 401 lo da `@require_auth`; los 400 salen
por `error_handlers` (Art. P2.3). El blueprint se registra en `routes/__init__.py`.

**Diario:**
- `meal_rules.parse_items`: para cada elemento, si no es un objeto, o el número de claves con valor distinto de `None`
  entre `catalog_id`, `fdc_id` y `name` no es exactamente 1 → `ITEM_SOURCE_MESSAGE` (AC-006.4); después
  `validate_grams` (AC-006.5); en los del catálogo, si `is_catalog_id(catalog_id)` es falso → `FOOD_NOT_FOUND_MESSAGE`;
  los de USDA y personalizados siguen igual.
- `MealService.add_items`: tras `_load_foods`, `_load_catalog_foods(inputs)`: si hay `CatalogItemInput`, llama a
  `catalog_repository.get_by_ids` con los identificadores sin repetidos y, si falta alguno (o `catalog_repository` es
  `None`), `ValidationError(FOOD_NOT_FOUND_MESSAGE)` dentro del `try`, así que hay `rollback` y no se guarda nada
  (AC-006.3). Cada `CatalogItemInput` crea un `MealItem` con `_new_item(..., source="catalog", catalog_id=food.id,
  fdc_id=None, name=food.name, data_type=None)` y los cuatro valores por 100 g del catálogo; los de USDA y
  personalizados pasan `catalog_id=None`. El orden de alta se conserva (AC-006.2).
- `update_item_grams` no cambia: recalcula con los `per_100g_*` guardados, también en los del catálogo (AC-006.6,
  AC-007.2).
- `meal_routes._serialize_item` añade `"catalog_id": item.catalog_id`; `_build_meal_service` pasa
  `catalog_repository=CatalogFoodRepository(db.session)`.

**Frontend:**
- `searchCatalog` y `useCatalogSearch` como `searchFoods` y `useFoodSearch` de la 021 (mutación sin reintentos, así
  «Reintentar» repite la última consulta).
- `CatalogResultList`: `<ul aria-label="Resultados">` con un `<li>` por alimento: el nombre, y `formatCalories` y
  `formatGrams` de `@/features/foods/format` con «proteína», «carbohidratos» y «grasa» («165 kcal», «31,0 g proteína»,
  «0,0 g carbohidratos», «3,6 g grasa»), sin etiqueta de origen, y un botón «Elegir» con `aria-label` «Elegir {nombre}»
  (AC-009.2, AC-N002.1).
- `AddFoodDialog`: cambia `useFoodSearch` por `useCatalogSearch`, `Food` por `CatalogFood` y `FoodResultList` por
  `CatalogResultList`; la descripción pasa a «Busca un alimento o crea uno propio.»; `FoodSearchForm` recibe
  `placeholder="Ej.: arroz blanco cocido, banano"` (AC-009.1). En el paso `portion` pinta `food.name`, `PortionForm`
  con `key={food.id}` y `per100g={food.per_100g}`, y guarda `{ catalog_id: food.id, grams }` (AC-009.3, AC-009.4). La
  región de estado, «Crear alimento personalizado» con el nombre relleno, los errores con «Reintentar» y las
  validaciones sin petición quedan como en la 022 (AC-009.5 a AC-009.7, AC-N002.2).
- `sourceLabel` devuelve `null` si `item.source === "catalog"`; `MealItemRow` solo pinta el `<span>` de origen si no es
  `null` (AC-010.1, AC-010.2). Editar y quitar no cambian (AC-010.3).
- `mealResponseSchema`: `catalog_id` con `.nullable().default(null)`, para no romper el diario si el frontend llega a
  producción unos minutos antes que el backend.
- Router: la ruta `/foods` (en el mismo sitio, dentro de `AppLayout`) pasa a `element={<Navigate to="/diary" replace
  />}` y se quita la declaración `const FoodsPage = lazyNamed(...)` (REQ-011). Así `/foods` sigue exigiendo sesión y
  onboarding antes de redirigir. `Navbar` y `BottomTabBar` no cambian (AC-011.2).
- Legal: en `TermsOfServicePage`, la sección «Datos nutricionales» queda como en la 022 (atribución a USDA y aviso de
  valores aproximados) y no añade texto; en particular, no contiene la frase sobre alimentos añadidos a mano; la
  página solo cambia la fecha de actualización (AC-012.1). En
  `PrivacyPolicyPage`, el punto de Voyage AI queda como «recibe el texto de tus preguntas para buscar el contenido
  relacionado.» (AC-012.2). `updatedAt` de las dos: «21 de octubre de 2026» (AC-012.3).

**CSV del catálogo (`backend/scripts/data/food_catalog.csv`)**, preparado por el `implementer` como artefacto de
producción:
- Entre 250 y 350 alimentos con la cabecera de `REQUIRED_COLUMNS`, las reglas de la sección 6 y la lista mínima.
- Los valores de las filas `usda` se copian de `public.foods` de la base de **desarrollo** (importada en la 021) con
  `repr(float)` (por ejemplo `3.57`, `165.0`), para que la igualdad sea exacta. Se prefieren alimentos de USDA cuyos
  cuatro valores existan; un FDC ID con algún valor `NULL` no sirve.
- Filas `manual` solo para comida local que USDA no tiene, con una `reference` concreta y comprobable (tabla y código
  del alimento). **No se inventan valores:** si no hay una fuente verificable, se elige una alternativa de USDA o el
  alimento se deja fuera y se anota en el backlog. El `implementer` lista las filas `manual` en su informe para que el
  usuario las revise en el gate de `review` (Q10). Tras la revisión de la spec (sin «Yuca cocida»), el CSV tiene 261
  filas, ninguna `manual`; el formato `manual` se conserva para el futuro.
- Antes de cerrar la tarea, el `implementer` (y después el `verifier`) ejecuta la carga contra la base de desarrollo con
  `FLASK_ENV=development` y comprueba que no hay errores (la igualdad con USDA no la puede comprobar ningún test).

### 3.4 Interfaz de usuario
- **Diálogo «Añadir a {sección}»**: mismo diseño de la 022. Cambian la descripción («Busca un alimento o crea uno
  propio.»), el ejemplo de la caja («Ej.: arroz blanco cocido, banano») y la tarjeta de cada resultado: nombre en
  español, cuatro valores por 100 g y «Elegir», sin «Foundation» ni «SR Legacy».
- **Paso de porción**: título con el nombre del alimento del catálogo, «Gramos» con 100 y la vista previa de la 022.
- **Diario**: los alimentos del catálogo muestran nombre, gramos y kcal, con «Editar» y «Quitar», sin etiqueta de
  origen; los de USDA ya registrados siguen con «Foundation» o «SR Legacy» y los personalizados con «Personalizado».
- **`/foods`**: redirige a `/diary` (con `replace`, así «Atrás» no vuelve a `/foods`).
- **Accesibilidad**: `searchbox` «Buscar alimento», lista «Resultados», botones «Elegir {nombre}» y la región
  `role="status"` con `aria-live="polite"` para «Buscando…», sin resultados y error (NFR-002).
- **Validaciones**: las de `foodSearchFormSchema` (zod) de la 021, sin petición cuando fallan (AC-009.7).

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `backend/scripts/data/food_catalog.csv`; reglas en `catalog_rules` y `read_catalog_csv` (formato, unicidad con `term_key`, palabras prohibidas); número de filas y lista mínima en el test del CSV del repositorio |
| REQ-002 | `CatalogLoadService.run` (sincronización con `list_all`, `create`, `update`, `delete`, un `commit`), `CatalogLoadSummary`, `format_catalog_summary`; `scripts/load_food_catalog.py` con `database_target.is_local_host`/`confirm_remote_write` y `--yes`; copia en `meal_items` sin FK |
| REQ-003 | `read_catalog_csv` (archivo, columnas, reglas por fila y unicidad, todos los errores en un `CatalogFileError`) y comprobación frente a `FoodRepository.get_by_fdc_ids` en `CatalogLoadService.run`, antes de escribir |
| REQ-004 | `CatalogSearchService.search`, `rank_catalog`, `match_group`, `query_forms`, `fold`, `words`, `word_forms`, `CatalogFoodRepository.list_all`, `catalog_food_to_json`, `GET /api/catalog/search` |
| REQ-005 | `normalize_query` reutilizado de la 021 (400) y `@require_auth` (401) |
| REQ-006 | `meal_rules.parse_items` (`CatalogItemInput`, `ITEM_SOURCE_MESSAGE` nuevo), `MealService.add_items`/`_load_catalog_foods` con `CatalogFoodRepository.get_by_ids`, `MealItem.catalog_id`, `CHECK` nuevas, `_serialize_item` con `catalog_id` |
| REQ-007 | Copia de nombre y valores por 100 g en `meal_items`, sin FK a `catalog_foods`; `update_item_grams` con los valores guardados |
| REQ-008 | `CHECK` nuevas compatibles con las filas existentes, `catalog_id: null` en `_serialize_item`, `downgrade` que no pierde datos; flujo de la 022 sin cambios |
| REQ-009 | `useCatalogSearch`, `searchCatalog`, `catalogSearchResponseSchema`, `CatalogResultList`, `AddFoodDialog` (descripción, ejemplo y payload `catalog_id`), `FoodSearchForm.placeholder` |
| REQ-010 | `sourceLabel` (`null` en `catalog`), `MealItemRow`, `MealItem.catalog_id`, `mealResponseSchema` |
| REQ-011 | `router.tsx`: `/foods` → `<Navigate to="/diary" replace />` dentro de `AppLayout`, sin `FoodsPage`; navegación sin cambios |
| REQ-012 | `TermsOfServicePage.tsx` (solo `updatedAt`) y `PrivacyPolicyPage.tsx` (texto de Voyage y `updatedAt`) |
| NFR-001 | `CatalogSearchService` solo recibe el repositorio: sin `embedding_client` ni `rate_limiter` |
| NFR-002 | `searchbox` de `FoodSearchForm`, `ul aria-label="Resultados"` y `aria-label="Elegir {nombre}"` en `CatalogResultList`, región `role="status"` del diálogo |

## 5. Estrategia de pruebas
Marcadores con número de spec: `# SDD: 023 REQ-00X AC-00X.Y` y `// SDD: 023 REQ-0XX AC-0XX.Y` (Art. P1.1, ADR-0022).

### backend
**Entorno:** Postgres de prueba (`TEST_DATABASE_URL`, puerto 5433, con pgvector). Ningún test llama a Voyage ni a Redis
reales (Art. P1.4); la búsqueda del catálogo no los usa y los tests de NFR-001 lo comprueban instalando dobles en los
singletons. Sin `unittest.mock`; `monkeypatch` solo en el test del script (justificado abajo).

**Dobles y utilidades nuevos:**
- `backend/tests/fakes.py`: `make_catalog_food(id, name, synonyms=(), calories_kcal=0.0, protein_g=0.0, carbs_g=0.0,
  fat_g=0.0, source="usda", fdc_id=1, reference=None)` (un `SimpleNamespace` con la forma de `CatalogFood`) y
  `FakeCatalogFoodRepository(foods=None)` con `list_all()` y `get_by_ids(ids)`, que registra `list_calls` y `get_calls`.
- `backend/tests/catalog_samples.py`: `CATALOG_COLUMNS` (las diez columnas), `catalog_row(**overrides) -> dict` (una
  fila válida de origen `usda` con valores por defecto) y `write_catalog_csv(path, rows, columns=CATALOG_COLUMNS)`,
  que escribe el CSV en UTF-8 y permite omitir columnas (AC-003.2).
- Se reutilizan `FakeUnitOfWork`, `FakeLockingUserRepository`, `FakeClock`, `FakeMealRepository`, `FakeFoodRepository`,
  `make_food`, `FakeVoyageClient` y `FakeRedisClient`.

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `test_services/test_catalog_rules.py` | Unitario puro | `fold` («PLÁTANO», «Piña», «ü»), `words`, `term_key`, `word_forms` («huevos», «limones», «bananos», «es» → solo «es»), `is_catalog_id` (válidos, mayúsculas, tildes, «ñ», guion inicial, final o doble, 1 y 61 caracteres) (AC-004.3, AC-004.6, AC-004.12 a AC-004.15) |
| `test_services/test_catalog_search_service.py` | Unitario, `FakeCatalogFoodRepository` | Toda la regla de REQ-004 con los catálogos exactos de los AC: AC-004.1 a AC-004.9 y AC-004.11 a AC-004.16; `normalize_query` antes de leer el repositorio (AC-005.1 a AC-005.3, `list_calls` vacío); el servicio no recibe proveedor de embeddings ni limitador (AC-N001.1 a nivel de constructor) |
| `test_services/test_catalog_csv_reader.py` | Unitario, `tmp_path` + `write_catalog_csv` | AC-003.1 (archivo y ruta en el mensaje), AC-003.2 (columna `synonyms`), AC-003.3 («Fila 3», el identificador y la regla), AC-003.4 (identificador, nombre y sinónimo repetidos, con las dos filas), AC-003.7, AC-003.8, palabras prohibidas (AC-001.3 en el lector), formatos de número y sinónimos, varios errores en un solo mensaje, filas válidas devueltas en orden |
| `test_services/test_catalog_load_service.py` | `db_session` con `CatalogFoodRepository`, `FoodRepository` y `UnitOfWork` reales; alimentos de USDA sembrados con `Food(...)` | AC-002.1, AC-002.2, AC-002.3 (incluida la búsqueda con `CatalogSearchService` real tras quitarlo), AC-003.5 (FDC ID 171477 con 3,57 y con 3,6), AC-003.6, y «el catálogo no cambia» tras los errores de AC-003.1 a AC-003.8 (catálogo precargado y comparado antes y después); `format_catalog_summary` |
| `test_services/test_food_catalog_csv.py` | Unitario sobre `backend/scripts/data/food_catalog.csv` | AC-001.1 (`read_catalog_csv` sin errores y 250–350 filas), AC-001.2 (claves `term_key` sin repetidos), AC-001.3 (ninguna palabra prohibida), AC-001.4 (los 39 de la lista mínima, como constante del test, aparecen por `term_key` de nombre o sinónimo) |
| `test_scripts/test_load_food_catalog_script.py` | Unitario, mismo patrón que `test_import_usda_foods_script.py` (`FakeApp`, `FakeCatalogLoadService`, repositorios y `UnitOfWork` falsos, `input` falso) | AC-002.5 («n», vacío y `EOFError` → código 1, mensaje de cancelación y servicio sin construir; «s» → código 0), AC-002.6 (`localhost` y `--yes` → sin aviso); ruta por defecto y `CatalogFileError` → código 1 |
| `test_services/test_meal_rules.py` (añadidos) | Unitario puro | `CatalogItemInput` (AC-006.1), las combinaciones de AC-006.4 (dos o tres claves, ninguna) con el mensaje nuevo, gramos no válidos (AC-006.5), `catalog_id` con formato no válido → `FOOD_NOT_FOUND_MESSAGE` |
| `test_services/test_meal_service.py` (añadidos) | Unitario, `FakeCatalogFoodRepository` por constructor | AC-006.1 (copia y nutrientes 247,5 / 46,5 / 0,0 / 5,36), AC-006.2 (orden y `source`), AC-006.3 (sin `commit` y con `rollback`), AC-006.6 (330,0 / 62,0 / 0,0 / 7,14), AC-007.2 (cambiar el doble no cambia el recálculo) |
| `test_routes/test_catalog_routes.py` | Integración, `client`; catálogo sembrado con `CatalogFood(...)` y `db.session` | AC-004.1, AC-004.8 (30 alimentos, con y sin `limit=50`), AC-004.9, AC-004.10 (claves exactas de cada resultado), AC-004.11, AC-005.1 a AC-005.4 (sin cabecera, token caducado e inválido), AC-N001.1 (`FakeVoyageClient` instalado en `embedding_client.client` sin llamadas), AC-N001.2 (31 búsquedas → 200, con `FakeRedisClient` en `rate_limiter.client` sin contar nada) |
| `test_routes/test_meal_routes.py` (añadidos) | Integración, `client`, `app_clock` | AC-006.1 a AC-006.6 de extremo a extremo; AC-002.4 y AC-007.1 (registrar, ejecutar `CatalogLoadService` real sobre `db.session` con un CSV que quita o cambia el alimento, y releer el diario); AC-008.1 (USDA y personalizado con `catalog_id: null`) y AC-008.2 |
| `test_services/test_catalog_migration.py` | Integración con `migration_helpers.run_downgrade` dentro de una transacción que se deshace | Con un alimento `catalog` en `meal_items`, el `downgrade` falla sin cambiar nada; sin ninguno, quita `catalog_id` y `catalog_foods` (se deshace al terminar). Marcador `# SDD: 023 REQ-008` |

**Tests existentes que cambian por requisito (no se debilitan, Art. B5.3):** en `test_meal_rules.py` y
`test_meal_routes.py`, las aserciones del mensaje de AC-003.7 de la 022 pasan al de AC-006.4 de la 023, y las que
comparan alimentos completos de la respuesta añaden `catalog_id: None`. `test_import_usda_foods_script.py` no cambia y
debe seguir pasando tras extraer `database_target.py`.

**Excepción justificada a P1.3 (`monkeypatch` en `test_load_food_catalog_script.py`):** el script es el punto de
entrada de la línea de comandos y no recibe dependencias por constructor (llama a `create_app()`, construye
repositorios, `UnitOfWork` y `CatalogLoadService`, y lee de `input()`). Como en la 021, el test sustituye esos nombres
del módulo y `builtins.input` por dobles escritos a mano y `monkeypatch` los restaura; así nunca se usa una URL real.

**Migración:** los tests usan `create_all()`; el `reviewer` comprueba a mano que `d4f6a8c0e2b5` coincide con los modelos
(columnas, `TEXT[]`, las seis `CHECK` de `catalog_foods` y las dos nuevas de `meal_items`) (Art. P2.4). El `verifier`
aplica `flask db upgrade` en la base de desarrollo y ejecuta allí la carga del CSV real (validación de USDA).

### frontend
Vitest con `globals: false` (Art. P1.2); red simulada con `vi.mock("@/features/catalog/api", () => ({ searchCatalog:
vi.fn() }))`, `vi.mock("@/features/diary/api", …)` y `vi.mock("@/features/profile/api", …)` (Art. P1.4). Fábrica nueva
`makeCatalogFood(overrides)` en `frontend/src/test/catalogFixtures.ts` (por defecto, la pechuga de AC-009.2); en
`frontend/src/test/diaryFixtures.ts`, `makeMealItem` añade `catalog_id: null` y una fábrica `makeCatalogItem` con
`source: "catalog"`.

| Archivo | Qué cubre |
|---|---|
| `features/catalog/schemas.test.ts` | `catalogSearchResponseSchema` acepta la respuesta de la sección 6 y rechaza valores `null` |
| `features/catalog/components/CatalogResultList.test.tsx` | AC-009.2 (textos de la pechuga, sin «Foundation» ni «SR Legacy»), AC-N002.1 (lista «Resultados» y botón «Elegir {nombre}» que llama a `onSelect`) |
| `features/diary/components/AddFoodDialog.test.tsx` (adaptado) | AC-009.1 a AC-009.7, AC-N002.1 y AC-N002.2 con `searchCatalog` simulado (comprueba que `searchFoods` no se llama, AC-009.2); payload `{ catalog_id, grams }` (AC-009.4). Los casos de la 022 (personalizado, cancelar, volver, «Guardando…», errores) se mantienen con el catálogo |
| `features/diary/format.test.ts` | `sourceLabel` → `null` en `catalog` (AC-010.1); los casos de la 022 siguen |
| `features/diary/schemas.test.ts` | `mealResponseSchema` acepta un alimento `catalog` con `catalog_id` y uno de la 022 sin el campo (queda `null`) (AC-008.1 en el cliente) |
| `features/diary/pages/DiaryPage.test.tsx` (adaptado) | AC-010.1 (fila sin etiqueta de origen), AC-010.2, AC-010.3 (editar 200 g y relectura); los mocks pasan de `foods/api` a `catalog/api` |
| `app/foodsRoute.test.tsx` (adaptado) | AC-011.1 (con sesión y onboarding, `/foods` termina en `/diary` con el `h1` «Diario»); `router.tsx` no importa `FoodsPage` (ni estática ni dinámicamente) y declara `path="/foods"` con `Navigate`; con onboarding pendiente, `/foods` sigue mostrando el onboarding. Los tests de la 021 sobre la carga de `FoodsPage` se sustituyen porque REQ-011 cambia ese requisito |
| `app/diaryRoute.test.tsx` (adaptado) | El caso «/foods sigue mostrando Alimentos» de la 022 pasa a la redirección de AC-011.1 |
| `components/layout/noFoodsLink.test.tsx` | Se añade el marcador de AC-011.2; el contenido sigue igual |
| `features/legal/pages/TermsOfServicePage.test.tsx` y `PrivacyPolicyPage.test.tsx` (adaptados) | AC-012.1 a AC-012.3; el caso de la 022 que exigía «búsquedas de alimentos» en Voyage pasa a exigir lo contrario |

`FoodsPage.test.tsx` (021) no cambia y debe seguir pasando: `FoodSearchForm` conserva su ejemplo por defecto.
`npm run build` comprueba en la verificación que el chunk de entrada sigue por debajo de 500 kB.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Valores del CSV que no coinciden exactamente con `public.foods` (los tests no pueden comprobarlo) | Media | Alto | Copia con `repr(float)` desde la base de desarrollo; carga real contra desarrollo por el `implementer` y el `verifier`; la carga en producción también valida y no escribe nada si falla |
| Valores inventados en filas `manual` | Media | Alto | Solo con una referencia concreta y comprobable; si no la hay, alternativa de USDA o fuera del catálogo; el `implementer` las lista para que el usuario las revise en el gate de `review` |
| Entre el CD y la carga en producción el catálogo está vacío y el diario no encuentra nada | Alta | Medio | La búsqueda responde 200 vacío (AC-004.11) y se puede crear un alimento personalizado; el runbook pone la carga inmediatamente después del CD |
| Migración que no coincide con los modelos (las `CHECK` cambiadas no las detecta Alembic) | Media | Alto | `CHECK` escritas a mano en la migración y declaradas en el modelo; revisión del `reviewer`; `flask db upgrade` en desarrollo durante la verificación |
| Revertir la migración con alimentos del catálogo ya registrados | Baja | Alto | El `downgrade` se niega y no modifica nada; test de la migración |
| Tests existentes de la 021 y la 022 que afirman el comportamiento anterior (`/foods`, mensajes, Voyage) | Alta | Bajo | Se adaptan a los requisitos nuevos con marcadores de la 023 (sección 5); no se borra cobertura sin sustituirla |
| Rendimiento de leer el catálogo entero en cada búsqueda | Baja | Bajo | Como mucho 350 filas pequeñas; si creciera, pasar la coincidencia a Postgres (ADR-0031, backlog) |
| Frontend desplegado antes que el backend (o al revés) | Media | Bajo | `catalog_id` con `default(null)` en el esquema; la migración se aplica antes del merge y los dos despliegues son automáticos al hacer merge |

## 7. Cumplimiento de la constitución
- **B1/B4/B5:** todo sale de la spec aprobada; cada REQ y NFR está en el mapa y cada AC en un archivo de test de la
  sección 5; esqueletos según B5.6 y P1.5 (`raise NotImplementedError("not implemented")` y `throw new Error("not
  implemented")` con `_` en los parámetros de TypeScript).
- **B5.3:** los tests de la 021 y la 022 que se adaptan cambian porque REQ-006 (mensaje), REQ-011 (`/foods`) y REQ-012
  (Voyage) cambian esos requisitos; ningún test se salta ni se debilita sin sustituto.
- **P1:** tests en `test_services/`, `test_routes/` y `test_scripts/`, nombres en inglés y docstrings en español; dobles
  escritos a mano por constructor o en el atributo `client` de los singletons; `monkeypatch` solo en el test del script,
  justificado en la sección 5. Frontend: tests junto al archivo, `vitest` sin globales, red simulada en `api.ts`.
- **P2 backend:** capas `routes → services → repositories → models`; solo `UnitOfWork` confirma o deshace (también en la
  carga); dependencias por constructor y `_build_catalog_search_service()`/`_build_meal_service()`; errores HTTP con
  `ValidationError`. **Justificación:** `CatalogFileError` no está en `exceptions/custom_exceptions.py` porque no es un
  error HTTP: solo lo lanza la carga por línea de comandos (como `UsdaFileError` en la 021). **P2.4:** migración
  incluida y revisada a mano. **P2.5:** se reutilizan `normalize_query`, `FoodRepository.get_by_fdc_ids`,
  `validate_grams`, `portion_nutrients` y la confirmación del script de la 021 (extraída, no duplicada).
- **P2 frontend:** feature `catalog` con `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` y `components/` (sin `pages/`,
  porque no tiene pantalla propia); HTTP solo por `apiFetch`; TanStack Query; formularios con react-hook-form y zod
  (`FoodSearchForm`); componentes de `@/components/ui/`.
- **P3.1:** `@require_auth` en la búsqueda; el catálogo no es dato de usuario y las comidas siguen filtrando por el
  usuario del token. **P3.2:** validación en el servicio y con zod. **P3.3:** no aplica (sin proveedores de IA ni
  límite, NFR-001). **P3.4:** ORM y parámetros enlazados; la consulta del `downgrade` no interpola valores. **P3.5:** no
  hay variables ni secretos nuevos.
- **P4:** migración incluida; el `doc-keeper` documenta en `docs/deploy-runbook.md` el volcado, la migración antes del
  merge y la carga tras el CD (`docker compose -f docker-compose.prod.yml run --rm backend python -m
  scripts.load_food_catalog`, interactiva, sin `--yes`).
- **General:** textos en español, sin voseo. No hay dependencias nuevas ni migraciones destructivas; `/api/meals`
  amplía su contrato de forma compatible (los alimentos por `fdc_id` se siguen aceptando) y solo cambia el texto de un
  mensaje de error, como pide AC-006.4.
- Ningún «DEBERÍA» queda sin cumplir; el único «NO DEBE salvo justificación» que se usa (`monkeypatch`, P1.3) queda
  justificado en la sección 5.

## 8. ADRs
- [ADR-0031](../../docs/sdd/decisions/ADR-0031-catalogo-generico-de-alimentos.md): catálogo en `catalog_foods` con
  identificador de texto estable y sinónimos en `TEXT[]`, sin FK a `foods`; búsqueda por texto en memoria con funciones
  puras y sin proveedores externos; carga que sincroniza desde el CSV (añade, actualiza y borra); origen `catalog` en
  `meal_items` con `catalog_id`; `downgrade` que se niega si hay alimentos del catálogo registrados (Propuesta).
