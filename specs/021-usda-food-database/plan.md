# Plan 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-20)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución
- **Backend:** tabla nueva `public.foods` (modelo `Food`, migración Alembic que no se aplica sola) con el FDC ID como clave
  primaria, los cuatro nutrientes por 100 g, un `tsvector` generado en inglés con índice GIN y un `vector(1024)` de Voyage.
- **Importación:** lector de CSV de USDA (`services/usda_csv_reader.py`) y `FoodImportService`, en dos fases (guardar
  alimentos en una transacción; calcular vectores pendientes por lotes), invocados por un script fino en
  `backend/scripts/import_usda_foods.py`, como el pipeline RAG.
- **Búsqueda:** `GET /api/foods/search` (`routes/food_routes.py`, `@require_auth`) → `FoodSearchService` (validación,
  límite de Redis, vector de la consulta, fusión RRF de candidatos por texto y por similitud) → `FoodRepository`.
  Reutiliza `utils/embeddings.py` y `utils/rate_limiter.py` (Art. P2.5). Decisión en ADR-0029.
- **Frontend:** feature nueva `src/features/foods/` con la pantalla «Alimentos» en `/foods`, cargada bajo demanda dentro
  de `AppLayout` y `OnboardingGuard`, sin entrada en la navegación.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | models | `backend/models/food.py` | `backend/models/__init__.py` | Modelo `Food` (REQ-001, REQ-003); registrarlo para `create_all()` y Alembic |
| backend | migrations | `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py` | — | Crear `public.foods`, su `CHECK`, la columna generada y el índice GIN (Art. P2.4) |
| backend | repositories | `backend/repositories/food_repository.py` | — | Lecturas por FDC ID, candidatos por texto y por similitud, pendientes de vector |
| backend | services | `backend/services/usda_csv_reader.py`, `backend/services/food_import_service.py`, `backend/services/food_search_service.py` | — | Lectura y validación de CSV, importación en dos fases y resumen, búsqueda híbrida |
| backend | routes | `backend/routes/food_routes.py` | `backend/routes/__init__.py` | Endpoint `GET /api/foods/search` y registro del blueprint |
| backend | scripts | `backend/scripts/import_usda_foods.py` | — | CLI de la importación (fuera de la app) |
| backend | tests | `backend/tests/test_services/test_usda_csv_reader.py`, `backend/tests/test_services/test_food_import_service.py`, `backend/tests/test_services/test_food_search_service.py`, `backend/tests/test_routes/test_food_routes.py`, `backend/tests/usda_samples.py` | `backend/tests/fakes.py` | Pruebas y dobles nuevos (sección 5) |
| frontend | feature `foods` | `frontend/src/features/foods/{types.ts,schemas.ts,api.ts,hooks.ts,format.ts,searchError.ts}`, `frontend/src/features/foods/components/{FoodSearchForm.tsx,FoodResultList.tsx}`, `frontend/src/features/foods/pages/FoodsPage.tsx` | — | Pantalla «Alimentos» (REQ-012 a REQ-014, NFR-002) |
| frontend | app | — | `frontend/src/app/router.tsx` | Ruta `/foods` bajo demanda (NFR-001) |
| frontend | tests | `frontend/src/features/foods/pages/FoodsPage.test.tsx`, `frontend/src/features/foods/format.test.ts`, `frontend/src/features/foods/schemas.test.ts`, `frontend/src/features/foods/searchError.test.ts`, `frontend/src/app/foodsRoute.test.tsx`, `frontend/src/components/layout/noFoodsLink.test.tsx` | — | Pruebas (sección 5) |
| docs | runbook | — | `docs/deploy-runbook.md` (lo hace el `doc-keeper`) | Paso manual: migración e importación en producción (Art. P4) |

No se modifican `Navbar.tsx` ni `BottomTabBar.tsx` (AC-012.8), ni `config.py` ni ningún `.env.example`: no hay variables
nuevas (se reutilizan `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL` y `REDIS_URL`).

## 3. Diseño
### 3.1 Datos y migraciones
**Tabla `public.foods`** (`backend/models/food.py`, clase `Food(Base)`):

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `fdc_id` | `Integer` | no | Clave primaria natural, `autoincrement=False` |
| `description` | `Text` | no | Descripción original de USDA |
| `data_type` | `String(20)` | no | `CHECK (data_type IN ('foundation', 'sr_legacy'))`, nombre `ck_foods_data_type` |
| `calories_kcal` | `Float` | sí | `NULL` = sin dato |
| `protein_g` | `Float` | sí | |
| `carbs_g` | `Float` | sí | Carbohidratos por diferencia |
| `fat_g` | `Float` | sí | Grasa total |
| `embedding` | `Vector(1024)` (pgvector) | sí | `NULL` = sin representación semántica (pendiente) |
| `search_vector` | `TSVECTOR` | — | `Computed("to_tsvector('english'::regconfig, description)", persisted=True)`; índice GIN `ix_foods_search_vector` |
| `created_at` | `DateTime` | no | `server_default=func.now()` |
| `updated_at` | `DateTime` | no | `server_default=func.now()`, `onupdate=func.now()` |

- El modelo declara en `__table_args__` el `CheckConstraint`, el `Index("ix_foods_search_vector", "search_vector",
  postgresql_using="gin")` y `{"schema": "public"}`, para que `create_all()` de los tests cree lo mismo que la migración.
- **Sin índice vectorial** (ADR-0029): búsqueda exacta sobre unos 8 200 vectores.
- **Migración** `c8e2a4f6b9d3_create_foods_table.py`, `down_revision = "e5b7d9f1a3c6"`: `upgrade` crea la tabla
  (`sa.Computed(...)` para la columna generada), el `CHECK` y el índice GIN; la extensión `vector` ya existe
  (`91e542a485a7`). `downgrade` borra el índice y la tabla (datos reimportables desde USDA). Se genera con
  `FLASK_ENV=development flask db migrate` y se revisa a mano: Alembic puede omitir el `Computed` o el `postgresql_using`.
- **No es destructiva** y no toca tablas existentes. **No se aplica sola** (ADR-0016): en producción se ejecuta
  `flask db upgrade` en la instancia y después la importación (runbook, sección 3.3).
- **Tamaño estimado:** ~40 MB (vector de 4 KB por alimento más texto, `tsvector` y GIN). Se mide en la verificación
  con `SELECT pg_size_pretty(pg_total_relation_size('public.foods'))` y se anota en `verify-report.md` (riesgo abierto
  del plan global).

### 3.2 Contratos e interfaces
**HTTP** `GET /api/foods/search?q={consulta}`, con `@require_auth`. Respuestas, mensajes y formato: exactamente los de la
sección 6 de la spec. Cualquier parámetro distinto de `q` se ignora (no se lee). Con varios `q`, se usa el primero
(`request.args.get("q")`).

**Firmas que los tests importarán** (el `implementer` crea primero sus esqueletos, Art. P1.5):

`backend/models/food.py`
```python
FOOD_DATA_TYPES: tuple[str, ...] = ("foundation", "sr_legacy")

class Food(Base):
    __tablename__ = "foods"
    fdc_id: Mapped[int]
    description: Mapped[str]
    data_type: Mapped[str]
    calories_kcal: Mapped[float | None]
    protein_g: Mapped[float | None]
    carbs_g: Mapped[float | None]
    fat_g: Mapped[float | None]
    embedding: Mapped[list[float] | None]
    search_vector: Mapped[str]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

`backend/repositories/food_repository.py`
```python
class FoodRepository(BaseRepository):
    def __init__(self, session): ...
    def get_by_fdc_ids(self, fdc_ids: list[int]) -> list[Food]: ...            # con defer(Food.embedding); orden libre
    def find_text_matches(self, query: str, limit: int) -> list[int]: ...       # FDC IDs por ts_rank_cd desc, fdc_id asc
    def find_semantic_matches(
        self, vector: list[float], max_distance: float, limit: int
    ) -> list[int]: ...                                                         # FDC IDs con vector y distancia <= max, por distancia asc, fdc_id asc
    def list_missing_embedding(self, limit: int) -> list[Food]: ...             # embedding IS NULL, por fdc_id asc
    def count_missing_embedding_by_data_type(self) -> dict[str, int]: ...       # {"foundation": n, "sr_legacy": m}; 0 si no hay
```

`backend/services/usda_csv_reader.py`
```python
FOOD_FILE = "food.csv"
FOOD_NUTRIENT_FILE = "food_nutrient.csv"
USDA_DATA_TYPES: dict[str, str] = {"foundation": "foundation_food", "sr_legacy": "sr_legacy_food"}
NUTRIENT_ENERGY_KCAL = 1008
NUTRIENT_ENERGY_ATWATER_GENERAL = 2047
NUTRIENT_ENERGY_ATWATER_SPECIFIC = 2048
NUTRIENT_PROTEIN = 1003
NUTRIENT_FAT = 1004
NUTRIENT_CARBS = 1005

class UsdaFileError(Exception):
    def __init__(self, path: Path, message: str): ...   # guarda path y message; str(error) == message (que incluye la ruta)

@dataclass(frozen=True)
class UsdaFoodRecord:
    fdc_id: int
    description: str
    data_type: str            # "foundation" | "sr_legacy"
    calories_kcal: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None

def read_usda_dataset(directory: Path | str, data_type: str) -> list[UsdaFoodRecord]: ...
```

`backend/services/food_import_service.py`
```python
EMBEDDING_BATCH_SIZE = 128
DATA_TYPE_LABELS: dict[str, str] = {"foundation": "Foundation", "sr_legacy": "SR Legacy"}

@dataclass(frozen=True)
class UsdaSource:
    data_type: str            # "foundation" | "sr_legacy"
    directory: Path

@dataclass
class SourceSummary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    missing_embedding: int = 0

@dataclass
class ImportSummary:
    sources: dict[str, SourceSummary]     # por data_type, en el orden de las fuentes recibidas
    embedding_failed: bool = False

class FoodImportService:
    def __init__(self, food_repository, unit_of_work, embedding_client,
                 batch_size: int = EMBEDDING_BATCH_SIZE): ...
    def run(self, sources: list[UsdaSource]) -> ImportSummary: ...

def format_summary(summary: ImportSummary) -> str: ...
```

`backend/services/food_search_service.py`
```python
MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 100
MAX_RESULTS = 20
MAX_SEARCHES_PER_WINDOW = 30
RATE_LIMIT_WINDOW_SECONDS = 60
TEXT_CANDIDATES = 40
SEMANTIC_CANDIDATES = 40
RRF_K = 60
DEFAULT_MAX_DISTANCE = 0.6
EMPTY_QUERY_MESSAGE = "Escribe qué alimento quieres buscar."
SHORT_QUERY_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
LONG_QUERY_MESSAGE = "La búsqueda no puede superar los 100 caracteres."
RATE_LIMIT_MESSAGE = "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
UNAVAILABLE_MESSAGE = "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."

def normalize_query(raw_query: str | None) -> str: ...      # strip; ValidationError con el mensaje que toque
def fuse_rankings(text_ids: list[int], semantic_ids: list[int],
                  limit: int = MAX_RESULTS, k: int = RRF_K) -> list[int]: ...

class FoodSearchService:
    def __init__(self, food_repository, embedding_client, rate_limiter,
                 max_distance: float = DEFAULT_MAX_DISTANCE): ...
    def search(self, user_id: str, raw_query: str | None) -> list[Food]: ...
```

`backend/routes/food_routes.py`
```python
food_bp = Blueprint("foods", __name__, url_prefix="/api/foods")
def _build_food_search_service() -> FoodSearchService: ...
def food_to_json(food: Food) -> dict: ...      # {"fdc_id", "description", "data_type", "per_100g": {calories_kcal, protein_g, carbs_g, fat_g}}
@food_bp.route("/search", methods=["GET"])
@require_auth
def search(): ...
```

`backend/scripts/import_usda_foods.py`
```python
def main(argv: list[str] | None = None) -> int: ...
# python -m scripts.import_usda_foods --foundation <carpeta> --sr-legacy <carpeta>   (al menos una de las dos)
```

**Mensajes de error de la importación** (exactos, en `UsdaFileError`):
- archivo inexistente: `f"No se encontró el archivo {path}."`;
- columna obligatoria ausente: `f"Al archivo {path} le falta la columna obligatoria «{column}»."`;
- valor no numérico en `fdc_id`, `nutrient_id` o `amount`: `f"El archivo {path} tiene un valor no válido en la columna «{column}» (línea {n})."`;
- ningún alimento del tipo esperado: `f"El archivo {path} no contiene alimentos de tipo {usda_type}."`.

Columnas obligatorias: `food.csv` → `fdc_id`, `data_type`, `description`; `food_nutrient.csv` → `fdc_id`,
`nutrient_id`, `amount`. Las demás columnas de USDA se ignoran.

**Resumen** (`format_summary`), una línea por fuente en el orden recibido:
```
Foundation: 3 añadidos, 0 actualizados, 0 sin cambios, 0 sin representación semántica.
SR Legacy: 2 añadidos, 0 actualizados, 0 sin cambios, 0 sin representación semántica.
```
y, si `embedding_failed`, una línea final: `El proveedor de embeddings falló: vuelve a ejecutar la importación para
completar las representaciones semánticas pendientes.`

**Frontend** (`src/features/foods/`):
```ts
// types.ts
export type FoodDataType = "foundation" | "sr_legacy"
export type FoodPer100g = { calories_kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }
export type Food = { fdc_id: number; description: string; data_type: FoodDataType; per_100g: FoodPer100g }
export type FoodSearchResponse = { results: Food[] }

// schemas.ts
export const FOOD_QUERY_MAX_LENGTH = 100
export const EMPTY_QUERY_MESSAGE = "Escribe qué alimento quieres buscar."
export const SHORT_QUERY_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
export const LONG_QUERY_MESSAGE = "La búsqueda no puede superar los 100 caracteres."
export const foodSearchFormSchema   // z.object({ query: z.string().trim().min(1, EMPTY).min(2, SHORT).max(100, LONG) })
export type FoodSearchFormValues = { query: string }
export const foodSearchResponseSchema   // valida la respuesta 200 (sección 6 de la spec)

// api.ts
export function searchFoods(query: string): Promise<FoodSearchResponse>
// apiFetch(`/api/foods/search?${new URLSearchParams({ q: query })}`) y foodSearchResponseSchema.parse

// hooks.ts
export function useFoodSearch()   // useMutation({ mutationFn: searchFoods, retry: false })

// format.ts
export const DATA_TYPE_LABELS: Record<FoodDataType, string>   // { foundation: "Foundation", sr_legacy: "SR Legacy" }
export function formatCalories(value: number | null): string  // "165 kcal" | "— kcal"
export function formatGrams(value: number | null, label: string): string  // "31,0 g proteína" | "— carbohidratos"

// searchError.ts
export const SEARCH_FAILED_MESSAGE = "No se pudo completar la búsqueda."
export function searchErrorView(error: unknown): { message: string; canRetry: boolean }

// components/FoodSearchForm.tsx
export function FoodSearchForm(props: { onSearch: (query: string) => void; isSearching: boolean }): ReactElement
// components/FoodResultList.tsx
export function FoodResultList(props: { foods: Food[] }): ReactElement
// pages/FoodsPage.tsx
export function FoodsPage(): ReactElement
```

### 3.3 Lógica
**Lectura de CSV** (`read_usda_dataset`, función pura sin base de datos):
1. Comprueba que existen `food.csv` y `food_nutrient.csv` en la carpeta y sus columnas obligatorias (lee con
   `encoding="utf-8-sig"` y `csv.DictReader`).
2. De `food.csv` conserva solo las filas con `data_type == USDA_DATA_TYPES[data_type]` (la descarga de Foundation trae
   también `sample_food`, `sub_sample_food`, `market_acquisition`…). Un FDC ID repetido se toma una vez (la primera).
3. Recorre `food_nutrient.csv` en streaming y guarda solo los nutrientes 1008, 2047, 2048, 1003, 1004 y 1005 de esos
   alimentos (AC-001.5). `amount` vacío = sin dato; si un par (alimento, nutriente) se repite, se toma el primero.
4. Energía: 1008; si falta, 2047; si falta, 2048; si no, `None`. Nunca se calcula de los macros (AC-001.3, .6, .7).
   Nutriente ausente = `None`, no 0 (AC-001.4).

**Importación** (`FoodImportService.run`), dependencias por constructor: `FoodRepository`, `UnitOfWork`,
`EmbeddingClient` (`embed_documents`).
1. **Validación previa:** lee **todas** las fuentes con `read_usda_dataset` antes de escribir nada; un `UsdaFileError`
   sale sin tocar la base (AC-004.1, AC-004.2). `data_type` fuera de `FOOD_DATA_TYPES` → `ValueError`.
2. **Fase 1 (alimentos):** por fuente, carga los existentes con `get_by_fdc_ids` y compara: nuevo → `create`
   (`added`); con cambios en descripción, tipo o nutrientes → actualiza (`updated`) y, si cambió la descripción, pone
   `embedding = None` (REQ-003); igual → `unchanged`. Los que no aparecen no se tocan (AC-002.3). Un solo
   `unit_of_work.commit()`; ante una excepción, `rollback()` y se relanza.
3. **Fase 2 (vectores):** repite `list_missing_embedding(batch_size)` → `embed_documents([descripciones])` → asigna →
   `commit()` hasta que no queden pendientes. Incluye pendientes de ejecuciones anteriores (AC-004.4). Si Voyage lanza
   cualquier excepción: `rollback()`, `logger.exception`, `embedding_failed = True` y se detiene (AC-004.3). Si no
   hay pendientes, no se llama a Voyage (AC-003.2).
4. **Resumen:** `missing_embedding` de cada fuente = `count_missing_embedding_by_data_type()` tras la fase 2 (REQ-005).

**Script** (`scripts/import_usda_foods.py`): `argparse` con `--foundation` y `--sr-legacy` (al menos una), crea la app
con `create_app()` (usa `FLASK_ENV`; por defecto, desarrollo), imprime el entorno y la base de destino sin contraseña
(`make_url(uri).render_as_string(hide_password=True)`), construye el servicio con `FoodRepository(db.session)`,
`UnitOfWork(db.session)` y el singleton `embedding_client`, imprime `format_summary` y devuelve 0; ante `UsdaFileError`
imprime el mensaje y devuelve 1. No lleva lógica propia.

**Búsqueda** (`FoodSearchService.search`), dependencias por constructor: `FoodRepository`, `EmbeddingClient`
(`embed_query`), `RateLimiter`, `max_distance`.
1. `normalize_query`: `None`, vacío o solo espacios → `ValidationError(EMPTY_QUERY_MESSAGE)`; tras `strip()`, menos de 2
   caracteres → `SHORT_QUERY_MESSAGE`; más de 100 → `LONG_QUERY_MESSAGE`. Antes del límite y de Voyage (AC-008.4).
2. Límite: `rate_limiter.check_and_increment(key=f"ratelimit:foods:search:{user_id}", limit=30, window_seconds=60)`;
   si no se permite → `RateLimitError(RATE_LIMIT_MESSAGE)` sin llamar a Voyage (REQ-010). Cuenta también las que
   terminen en 503.
3. `embed_query(consulta normalizada)`; cualquier excepción → `logger.exception` y
   `ServiceUnavailableError(UNAVAILABLE_MESSAGE)`, sin resultados parciales (REQ-011, Art. P3.3).
4. `find_text_matches(consulta, TEXT_CANDIDATES)` y `find_semantic_matches(vector, max_distance, SEMANTIC_CANDIDATES)`.
5. `fuse_rankings`: puntuación RRF = Σ 1/(k + posición, empezando en 1) por lista; orden por puntuación desc y FDC ID
   asc; los `limit` primeros. Con 40 candidatos y `k = 60`, quien está en las dos listas supera a quien está en una
   (AC-006.3). Sin candidatos → lista vacía (REQ-007).
6. `get_by_fdc_ids(ids)` y se devuelven en el orden fusionado. Máximo 20, sin parámetro (AC-006.4, AC-006.8). Foundation
   y SR Legacy no se fusionan (AC-006.9).

**Repositorio** (consultas con parámetros enlazados, Art. P3.4):
- Texto: `Food.search_vector @@ websearch_to_tsquery('english', :q)`, orden `ts_rank_cd(search_vector, tsquery) DESC,
  fdc_id ASC`, `LIMIT`. `websearch_to_tsquery` no falla con entradas arbitrarias y no distingue mayúsculas (AC-006.5).
  Los alimentos sin vector se encuentran por aquí (AC-006.6).
- Similitud: `Food.embedding.cosine_distance(vector)` (como `TranscriptChunkRepository.find_similar`), con
  `embedding IS NOT NULL` y distancia `<= max_distance`.

**Ruta:** `_build_food_search_service()` construye `FoodSearchService(FoodRepository(db.session), embedding_client,
rate_limiter)` con los singletons de `extensions.py`; la ruta lee `q`, toma `user_id` de `g.decoded_token["id"]`,
llama al servicio y responde `jsonify(results=[food_to_json(f) for f in foods]), 200`. Los errores salen por
`error_handlers` (Art. P2.3); el 401 lo da `@require_auth` (REQ-009).

### 3.4 Interfaz de usuario
**Ruta:** `router.tsx` añade `const FoodsPage = lazyNamed(() => import("@/features/foods/pages/FoodsPage"), "FoodsPage")`
y `<Route path="/foods" element={<RouteSuspense className={IN_LAYOUT}><FoodsPage /></RouteSuspense>} />` dentro de
`AppLayout` (por tanto tras `ProtectedRoute` y `OnboardingGuard`). Sin import estático (NFR-001, ADR-0026). Sin cambios en
`Navbar` ni en `BottomTabBar`.

**`FoodsPage`** (contenedor `mx-auto max-w-2xl p-4 sm:p-8`, como `CoachPage`):
- `<h1>` «Alimentos».
- `FoodSearchForm`: react-hook-form con `zodResolver(foodSearchFormSchema)` y los componentes de `@/components/ui/form`;
  `FormLabel` «Buscar alimento» ligado a un `Input type="search"` (rol `searchbox`, NFR-002) con
  `placeholder="Ej.: chicken breast, arroz blanco"` y `maxLength={100}` (AC-013.3). Botón `type="submit"` «Buscar»,
  desactivado mientras `isSearching`; Intro envía el mismo formulario (AC-012.4). Solo busca al enviar (AC-012.7). Los
  avisos de validación salen en `FormMessage` y no se llama a la API (AC-013.1, AC-013.2). El formulario nunca se
  vacía, así que la caja conserva el texto en cualquier estado (REQ-013). `onSubmit` recibe la consulta ya recortada.
- Estado con `useFoodSearch()` (mutación; cada búsqueda es una acción puntual y así «Reintentar» repite exactamente la
  última, `mutation.variables`). Si se envía mientras hay una en curso, se ignora.
- **Región de estado:** un único `<div role="status" aria-live="polite">` siempre montado que contiene, según el estado:
  inicial → «Busca un alimento para ver sus calorías y macros por 100 g.»; pendiente → «Buscando…»; éxito vacío →
  «No encontramos alimentos para «{consulta}».» con la consulta recortada que se envió; error → el mensaje de
  `searchErrorView(error)` y, si `canRetry`, un botón «Reintentar» que llama a `mutate(variables)` (AC-N002.2).
- `searchErrorView`: `ApiError` 429 → mensaje del servidor, sin «Reintentar» (AC-013.6); `ApiError` 503 → mensaje del
  servidor con «Reintentar» (AC-013.7); cualquier otro error (red, 5xx, respuesta inválida) → «No se pudo completar la
  búsqueda.» con «Reintentar» (AC-013.4). El 401 ya lo gestiona `apiFetch`.
- `FoodResultList` (fuera de la región de estado): `<ul aria-label="Resultados">` con un `<li>` por alimento: descripción,
  origen (`DATA_TYPE_LABELS`) y cuatro textos, cada uno en un único nodo de texto: `formatCalories` y `formatGrams` con
  las etiquetas «proteína», «carbohidratos» y «grasa». Formato con `Intl.NumberFormat("es-ES")`: kcal sin decimales
  (`165 kcal`), gramos con exactamente un decimal (`31,0 g proteína`, `3,6 g grasa`); sin dato, el valor y la unidad
  se sustituyen por «—» (`— kcal`, `— carbohidratos`) (AC-012.2, AC-012.3).
- Atribución siempre visible al pie: «Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData
  Central.» (REQ-014).

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `services/usda_csv_reader.py` (`read_usda_dataset`: filtro de tipo, nutrientes y preferencia de energía); `FoodImportService.run` fase 1; modelo `Food` y migración |
| REQ-002 | `FoodImportService.run` fase 1 (comparación por `fdc_id` con `get_by_fdc_ids`; sin borrados) |
| REQ-003 | Fase 1 (`embedding = None` si cambia la descripción) y fase 2 (`list_missing_embedding` + `embed_documents`) |
| REQ-004 | Validación previa de todos los CSV (`UsdaFileError`, sin escribir); fase 2 con commit por lote y parada en el primer fallo |
| REQ-005 | `ImportSummary`/`SourceSummary`, `count_missing_embedding_by_data_type`, `format_summary` y el script |
| REQ-006 | `FoodSearchService.search` + `fuse_rankings` + `FoodRepository.find_text_matches`/`find_semantic_matches`/`get_by_fdc_ids`; `food_to_json` |
| REQ-007 | Umbral `max_distance` en `find_semantic_matches`; fusión vacía → `{"results": []}` |
| REQ-008 | `normalize_query` antes del límite y de Voyage (`ValidationError` → 400) |
| REQ-009 | `@require_auth` en `food_routes.search` |
| REQ-010 | `rate_limiter.check_and_increment` (30 por 60 s, clave por `user_id`) → `RateLimitError` (429) |
| REQ-011 | `try` alrededor de `embed_query` → `ServiceUnavailableError` (503) |
| REQ-012 | Ruta `/foods` en `router.tsx`; `FoodsPage`, `FoodSearchForm`, `FoodResultList`, `format.ts`; sin cambios en la navegación |
| REQ-013 | `foodSearchFormSchema` (zod), `maxLength`, `searchErrorView`, «Reintentar» con `mutation.variables`, formulario sin reset |
| REQ-014 | Texto de atribución fijo en `FoodsPage` |
| NFR-001 | `lazyNamed` + `RouteSuspense` en `router.tsx`; `npm run build` sin superar 500 kB en el chunk de entrada |
| NFR-002 | `FormLabel` + `Input type="search"`; región `role="status"` con `aria-live="polite"` |

## 5. Estrategia de pruebas
**Entorno:** Postgres de prueba con pgvector (`TEST_DATABASE_URL`) para el backend. Ningún test llama a Voyage ni a
Redis reales (Art. P1.4). Marcadores `# SDD: 021 REQ-… AC-…` / `// SDD: 021 REQ-… AC-…` (Art. P1.1).

### backend
**Dobles nuevos en `backend/tests/fakes.py`:**
- `basis_vector(index: int, dimensions: int = 1024) -> list[float]` y `vector_with_similarity(similarity: float,
  dimensions: int = 1024) -> list[float]` (vector unitario con coseno `similarity` respecto a `basis_vector(0)`), para
  colocar consultas y alimentos a distancias conocidas en columnas `vector(1024)`.
- `FakeFoodEmbeddingClient(vectors: dict[str, list[float]] | None = None, default_vector=None, raise_error=None)`: doble
  de `EmbeddingClient` con `embed_documents(texts)` y `embed_query(text)`; registra `document_calls` (lista de listas de
  textos) y `query_calls`; `raise_error` es mutable (fallar y luego responder, AC-004.4 y AC-011.3).
- `FakeVoyageClient(vectors=None, default_vector=None, raise_error=None)`: doble del `voyageai.Client` que se instala en
  el singleton (`embedding_client.client = FakeVoyageClient(...)`), con `embed(texts, model=None, input_type=None)` que
  devuelve un objeto con `embeddings` y `total_tokens`; registra `calls`. Así la ruta usa el `EmbeddingClient` real sin red.
- `FakeFoodRepository(foods=None, text_ids=None, semantic_ids=None)`: devuelve las listas preparadas y registra las
  llamadas (`text_calls`, `semantic_calls`), para probar la fusión y el orden de pasos sin Postgres.
- Se reutilizan `FakeRateLimiter`, `FakeRedisClient` y `FakeUnitOfWork`.

**`backend/tests/usda_samples.py`** (utilitario de test): `write_usda_dataset(directory, foods, nutrients,
food_columns=None, nutrient_columns=None)` escribe `food.csv` y `food_nutrient.csv` con las cabeceras reales de USDA
(`"fdc_id","data_type","description","food_category_id","publication_date"` y
`"id","fdc_id","nutrient_id","amount",…`), con la opción de omitir una columna (AC-004.2).

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `test_services/test_usda_csv_reader.py` | Unitario, `tmp_path`, sin base | AC-001.1–001.7 a nivel de lectura (tipo, nutrientes, preferencia de energía, `None`), filtro de `sample_food`, AC-004.1 y AC-004.2 (mensaje con archivo y columna) |
| `test_services/test_food_import_service.py` | `db_session` con `FoodRepository` y `UnitOfWork` reales, `FakeFoodEmbeddingClient` | AC-001.1, 001.2, 001.4 (guardado), AC-002.1–002.3, AC-003.1–003.3 (número y contenido de `document_calls`), AC-004.1–004.4 (la base no cambia ante un error de archivo; fallo de Voyage y reanudación), AC-005.1, 005.2 y `format_summary` |
| `test_services/test_food_search_service.py` | Unitario, `FakeFoodRepository`, `FakeFoodEmbeddingClient`, `FakeRateLimiter` | `normalize_query` (AC-008.1–008.3), sin llamar a Voyage ni al límite ante 400 (AC-008.4), clave y valores del límite y 429 sin Voyage (AC-010.1), 503 aunque haya texto (AC-011.1, 011.2), `fuse_rankings` (AC-006.3, 006.4, lista vacía de REQ-007) |
| `test_routes/test_food_routes.py` | Integración, `client`, Postgres real; `FakeVoyageClient` y `FakeRedisClient` instalados en los singletons con un fixture `autouse` que los restaura | AC-006.1, 006.2, 006.4–006.9, AC-007.1, 007.2, AC-008.1–008.4 (400 y contador sin cambios), AC-009.1, 009.2, AC-010.1–010.3 (30 búsquedas reales con `FakeRedisClient`), AC-011.1–011.3, y AC-002.3 extremo a extremo (alimento ausente de la reimportación sigue en la búsqueda) |

Los alimentos de las pruebas de ruta se insertan con `Food(...)` y `db.session` dentro de `app.app_context()` (o con
`FoodImportService`), con vectores de `basis_vector`/`vector_with_similarity`; la consulta sin relación usa un vector
ortogonal (distancia 1 > 0,6). AC-009.2 usa un token mal formado y uno caducado (`jwt_manager.generate_token(...)` con
minutos negativos, o el patrón ya usado en los tests de autenticación).

**Sobre P1.3:** sustituir el atributo `client` de los singletons `rate_limiter` y `embedding_client` en un fixture que lo
restaura es el patrón vigente (`test_coach_feedback_routes.py`); no se usa `monkeypatch` ni `unittest.mock`.

### frontend
Red simulada con `vi.mock("@/features/foods/api", () => ({ searchFoods: vi.fn() }))` (Art. P1.4); `QueryClient` con
`retry: false`; `userEvent` para escribir y pulsar.

| Archivo | Qué cubre |
|---|---|
| `features/foods/pages/FoodsPage.test.tsx` | AC-012.1–012.7, AC-013.1–013.7 (texto conservado, «Reintentar» repite la misma consulta: `searchFoods` llamado dos veces con el mismo argumento), AC-014.1 (con y sin resultados), AC-N002.1 (`getByRole("searchbox", { name: "Buscar alimento" })`), AC-N002.2 (`within(getByRole("status"))` para «Buscando…», sin resultados y error) |
| `features/foods/format.test.ts` | `formatCalories`/`formatGrams`: `165 kcal`, `31,0 g proteína`, `0,0 g carbohidratos`, `3,6 g grasa` (de 3,57), `— carbohidratos` (AC-012.2, AC-012.3) |
| `features/foods/schemas.test.ts` | `foodSearchFormSchema`: vacío, espacios, 1, 2, 100 y 101 caracteres; recorte (AC-013.1–013.3) |
| `features/foods/searchError.test.ts` | 429, 503, 500 y error de red (AC-013.4, 013.6, 013.7) |
| `app/foodsRoute.test.tsx` | Con sesión y onboarding completado, `/foods` muestra «Cargando…» y después el `h1` «Alimentos» dentro de la navegación (REQ-012, AC-N001.1); `router.tsx` declara `FoodsPage` con `lazyNamed(() => import("@/features/foods/pages/FoodsPage")…)` y no lo importa de forma estática (escaneo con `import.meta.glob(..., { query: "?raw" })`, como `sourceCleanup017.test.ts`); visitar `/home` no evalúa el módulo de `FoodsPage` (factoría de `vi.mock` que registra si se cargó) |
| `components/layout/noFoodsLink.test.tsx` | `Navbar` y `BottomTabBar` no tienen enlace «Alimentos» ni `href="/foods"` (AC-012.8) |

El tamaño del chunk de entrada (≤ 500 kB, NFR-001) lo comprueba `npm run build` en la verificación.

### Validación manual (verificación, Q8 de la spec)
Con la base de desarrollo importada con los CSV reales y Voyage real, el `verifier` (o el usuario) ejecuta estas
consultas en `/foods` y anota, para cada una, si el alimento esperado aparece entre los 5 primeros: «pechuga de pollo»,
«arroz blanco», «huevo», «plátano», «aguacate», «avena», «leche entera», «yogur griego», «salmón», «carne molida»,
«frijoles negros», «papa cocida», «brócoli», «almendras», «aceite de oliva», «chicken breast», «white rice cooked»,
«banana», «peanut butter», «whole milk». Anota también el tamaño de `public.foods` y el resumen de la importación. Si
la calidad no es buena (orientativo: menos de 16 de 20), se anota en el backlog para la 022; no bloquea la 021.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Calidad baja con consultas en español (texto con lógica AND en inglés; umbral 0,6 sin calibrar) | Media | Medio | Fusión RRF que no depende del texto; validación manual de 20 consultas; constantes `DEFAULT_MAX_DISTANCE`, `TEXT_CANDIDATES` y `RRF_K` aisladas en el servicio; backlog para la 022 |
| Ejecutar la importación contra la base equivocada (p. ej. Supabase desde local) | Baja | Alto | `create_app()` sin `FLASK_ENV` usa desarrollo; el script imprime el entorno y la base sin contraseña antes de escribir; el runbook indica ejecutarlo en la instancia con `docker compose … run` |
| Límites de uso de Voyage durante la importación (~65 lotes) | Media | Bajo | Commit por lote, parada en el primer fallo y reanudación al volver a ejecutar (REQ-004) |
| Migración que no coincide con el modelo (columna generada, índice GIN) sin que los tests lo detecten | Media | Medio | El modelo declara lo mismo; revisión manual del `reviewer` (Art. P2.4); el `verifier` aplica `flask db upgrade` en la base de desarrollo antes de importar |
| `backend/scripts/` no está en los globs de producción del ámbito `backend` | Media | Bajo | El script es una envoltura sin lógica; toda la lógica y los tests están en `services/`. Si un hook bloquea la escritura, el `implementer` lo informa |
| Foundation trae filas que no son alimentos finales (`sample_food`…) | Alta | Medio | Filtro por `data_type == "foundation_food"`; test específico |
| Cambio futuro de modelo de Voyage invalida los vectores | Baja | Medio | Mismo modelo que el coach; anotado en ADR-0029 y en el backlog |

## 7. Cumplimiento de la constitución
- **B1/B4/B5:** todos los REQ y NFR mapeados (sección 4) y cada AC con su test (sección 5); esqueletos según P1.5 y B5.6.
- **P1:** tests en `test_services/` y `test_routes/`, nombres en inglés y docstrings en español; dobles escritos a mano e
  inyectados por constructor o instalados en el atributo `client` de los singletons (patrón existente); sin
  `unittest.mock` ni `monkeypatch`. Frontend: tests junto al archivo, `vitest` sin globales, red simulada en `api.ts`.
- **P2 backend:** capas `routes → services → repositories → models`; solo `UnitOfWork` hace commit (también en la
  importación); dependencias por constructor y `_build_food_search_service()`; reutiliza `utils/embeddings.py` y
  `utils/rate_limiter.py`; migración Alembic incluida y revisada a mano. **Justificación:** `UsdaFileError` no está en
  `exceptions/custom_exceptions.py` porque no es un error HTTP: solo lo lanza la importación por línea de comandos y
  nunca llega a una ruta; los errores HTTP de la búsqueda sí usan `ValidationError`, `RateLimitError` y
  `ServiceUnavailableError`.
- **P2 frontend:** feature `foods` con `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, `components/` y `pages/` (más
  `format.ts` y `searchError.ts`, utilidades puras de la feature); HTTP solo por `apiFetch`; TanStack Query (mutación) y
  react-hook-form con zod; componentes de `@/components/ui/`.
- **P3:** `@require_auth`; los alimentos no son datos de usuario, y el `user_id` del token solo se usa para el límite de
  uso. Validación en el servicio (`ValidationError`) y con zod en el frontend (formulario y respuesta). Límite en Redis
  y 503 ante fallos de Voyage. Consultas con el ORM y parámetros enlazados. Sin variables ni secretos nuevos.
- **P4:** migración incluida; los pasos manuales de producción (copiar los CSV a la instancia, `flask db upgrade`,
  ejecutar la importación con `docker compose -f docker-compose.prod.yml run --rm -v <carpeta>:/data/usda:ro backend
  python -m scripts.import_usda_foods …` y comprobar el tamaño) los documenta el `doc-keeper` en `docs/deploy-runbook.md`.
- Ningún «DEBERÍA» queda sin cumplir.

## 8. ADRs
- [ADR-0029](../../docs/sdd/decisions/ADR-0029-base-de-alimentos-usda-y-busqueda-hibrida.md): base de alimentos en
  `public.foods` con `fdc_id` natural, `tsvector` generado en inglés, vector de la descripción original sin índice
  vectorial, búsqueda híbrida con RRF en el servicio e importación en dos fases reanudable (Propuesta).
