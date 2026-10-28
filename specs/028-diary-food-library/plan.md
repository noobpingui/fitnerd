# Plan 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-27; iteración 2 aprobada el mismo día)
- **Ámbitos:** `backend`, `frontend`
- **Iteración 2 (hallazgos F1 a F8 de la review):** lo nuevo o cambiado se marca con «(iteración 2)». Resumen en la
  sección 1; el diseño, en 3.2 y 3.3; los tests que cambian y los nuevos, en la sección 5 («Iteración 2»). **No hay migración nueva**: la
  `e6a8c0d2f4b7` no cambia.
- **Iteración 3 (hallazgos F9, F10 y F11 de la review de la iteración 2):** todo está en la sección 9, al final. Sin
  migración, sin cambios de contrato HTTP y sin cambios en la spec.

## 1. Resumen de la solución
- **Backend:** dos tablas nuevas, `custom_foods` (biblioteca por usuario) y `food_favorites`, y la columna
  `meal_items.custom_food_id` (`ON DELETE SET NULL`). `POST /api/meals` crea o actualiza el alimento propio al registrar
  un personalizado y acepta `custom_food_id`. Un `FoodLibraryService` nuevo da la búsqueda conjunta, los recientes (una
  consulta con función de ventana sobre `meal_items`), los favoritos y el borrado, detrás de `/api/food-library`. La
  tolerancia a erratas y el plural «-ces» se añaden a las funciones puras de `catalog_search_service.py`, así que
  también valen para `GET /api/catalog/search`. Capas `routes → services → repositories → models` (Art. P2.1), sin
  proveedores externos.
- **Migración** aditiva que rellena la biblioteca desde los personalizados ya registrados (ADR-0036). No se aplica sola.
- **Frontend:** una feature de datos `food-library` (api, hooks, tipos y esquemas) y, en `diary`, un componente
  `FoodSearchPanel` compartido por `AddFoodDialog` y `PhotoReview`, con búsqueda mientras se escribe (300 ms),
  «Favoritos», «Recientes», favoritos y borrado. `PhotoReview` deja `form.watch` y lee los gramos con `useWatch`
  emparejados por clave. Se retira el código de `FoodsPage` y se actualiza la Política de privacidad.
- **(iteración 2)**
  - **F1 y F2 (REQ-017, NFR-002):** la confirmación de borrado es en línea (`role="alertdialog"`), dentro del elemento
    de la lista donde se pulsó «Borrar»; Escape la cancela con un hook nuevo, `useEscapeCapture`, que escucha en
    `window` en fase de captura (antes que Radix) mientras está abierta; el foco va a «Cancelar» al abrir, vuelve a
    «Borrar» al cancelar o si el borrado falla (la confirmación se cierra y el error queda en el elemento) y pasa a la
    caja de búsqueda tras un borrado correcto. `AddFoodDialog` y `MealPhotoDialog` no cambian.
  - **F3 (REQ-009):** el límite de 100 cuenta solo los favoritos visibles y `DELETE …/favorites/catalog/{id}` borra un
    favorito cuyo alimento ya no está en el catálogo. Solo cambia `FoodLibraryService`.
  - **F4 (NFR-004):** la segunda pasada de `catalog_search_service` memoriza las distancias por pareja (forma, palabra)
    en una búsqueda, resuelve sin calcular las formas cortas y las palabras demasiado cortas, y cuenta los cálculos en
    un `TypoSearchStats` opcional: como mucho F × P, sin cambiar resultados ni orden.
  - **F5 (REQ-020):** se borran `features/catalog/` entero, `features/foods/api.ts`, `catalogEntry`, el esquema y los
    tipos de la respuesta de USDA del frontend y `src/test/catalogFixtures.ts`, y se quitan sus mocks de los tests.
  - **F6:** `PhotoReview` usa un esquema nuevo, `proposalReviewSchema`, con `key` obligatoria; sin `as never` ni
    `as unknown as`.
  - **F7 (REQ-018):** al borrar desde la búsqueda de la propuesta un alimento propio que ya está en ella, sus filas
    pierden el vínculo (`unlinkCustomFood`) y se guardan como personalizados con `name` y `per_100g`.
  - **F8:** el plan y la ADR-0036 describen la confirmación en línea; ya no hay `ConfirmDialog` ni `confirmContainer`
    en esta feature.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | models | `backend/models/custom_food.py`, `backend/models/food_favorite.py` | `backend/models/meal.py`, `backend/models/__init__.py` | Tablas `custom_foods` y `food_favorites`; columna `meal_items.custom_food_id` (REQ-001, REQ-004, REQ-009) |
| backend | migrations | `backend/migrations/versions/e6a8c0d2f4b7_create_food_library.py` | — | DDL y relleno de la biblioteca (REQ-005) |
| backend | repositories | `backend/repositories/custom_food_repository.py`, `backend/repositories/food_favorite_repository.py` | `backend/repositories/meal_repository.py` | Acceso a la biblioteca, favoritos y consulta de recientes (REQ-008) |
| backend | services (reglas puras) | `backend/services/food_library_rules.py` | `backend/services/catalog_search_service.py`, `backend/services/meal_rules.py` | Clave de nombre, límites, mensajes; erratas y «-ces» (REQ-006); `LibraryItemInput` y `cf` del token (REQ-003, REQ-012) |
| backend | services | `backend/services/food_library_service.py` | `backend/services/meal_service.py` | Búsqueda conjunta, recientes, favoritos y borrado (REQ-004, REQ-007 a REQ-010); guardar en la biblioteca y añadir por id (REQ-001 a REQ-003, REQ-012) |
| backend | routes | `backend/routes/food_library_routes.py` | `backend/routes/__init__.py`, `backend/routes/meal_routes.py` | `/api/food-library/*` (REQ-011); `custom_food_id` en las respuestas de `/api/meals` |
| backend | tests | `backend/tests/test_services/test_food_library_rules.py`, `backend/tests/test_services/test_food_library_service.py`, `backend/tests/test_services/test_food_library_migration.py`, `backend/tests/test_routes/test_food_library_routes.py`, `backend/tests/test_routes/test_meal_library_routes.py` | `backend/tests/fakes.py`, `backend/tests/test_services/test_catalog_search_service.py`, `backend/tests/test_services/test_meal_service.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_routes/test_catalog_routes.py`, `backend/tests/test_routes/test_meal_routes.py` | Ver sección 5 |
| frontend | feature `food-library` (datos) | `frontend/src/features/food-library/api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` | — | Llamadas, claves de TanStack Query y validación de `/api/food-library` |
| frontend | lib | `frontend/src/lib/useDebouncedValue.ts` | — | Retardo de 300 ms con «disparo inmediato» para Intro (REQ-013) |
| frontend | diary · componentes | `frontend/src/features/diary/components/FoodSearchPanel.tsx`, `frontend/src/features/diary/components/LibraryFoodList.tsx` | `AddFoodDialog.tsx`, `PhotoReview.tsx`, `CustomFoodForm.tsx` (`ProposalEntryRow.tsx` y `MealPhotoDialog.tsx` no hizo falta cambiarlos: las filas propias usan la variante `custom` existente y sin `confirmContainer` no hay nada que pasar) | Búsqueda compartida (REQ-013 a REQ-018), totales al día (REQ-019), aviso del formulario (AC-016.2) |
| frontend | diary · componentes (iteración 2) | — | `FoodSearchPanel.tsx` (confirmación en línea, Escape, foco, `onCustomFoodDeleted`), `LibraryFoodList.tsx` (`renderInline`, `onDelete` con el botón), `PhotoReview.tsx` (`proposalReviewSchema` sin `as never`, `unlinkCustomFood`) | F1, F2, F6, F7 (REQ-017, REQ-018, NFR-002) |
| frontend | lib (iteración 2) | `frontend/src/lib/useEscapeCapture.ts` | — | Escape en captura sobre `window` mientras la confirmación está abierta (F1, AC-017.5, AC-017.6) |
| frontend | diary · lógica (iteración 2) | — | `frontend/src/features/diary/proposal.ts` (quita `catalogEntry`, añade `unlinkCustomFood`), `frontend/src/features/diary/schemas.ts` (`proposalReviewSchema`) | F5, F6, F7 |
| frontend | retirada (iteración 2) | — | se borran `frontend/src/features/catalog/api.ts`, `hooks.ts`, `schemas.ts`, `schemas.test.ts`, `types.ts`, `components/CatalogResultList.tsx`, `components/CatalogResultList.test.tsx` (la carpeta `features/catalog/` desaparece), `frontend/src/features/foods/api.ts` y `frontend/src/test/catalogFixtures.ts`; en `frontend/src/features/foods/schemas.ts` se quita `foodSearchResponseSchema` y en `frontend/src/features/foods/types.ts`, `FoodPer100g`, `Food` y `FoodSearchResponse` | REQ-020 ampliado (F5): código que solo usaban la pantalla de la 021 o la búsqueda de la 023 |
| backend | services (iteración 2) | — | `backend/services/catalog_search_service.py` (`TypoSearchStats`, `TypoDistances`, `typo_comparison_bound`, `stats` en `rank_candidates`, `rank_catalog` y `CatalogSearchService.search`), `backend/services/food_library_service.py` (favoritos visibles, `remove_favorite` de un favorito retirado, `stats` en `search`) | F3 (REQ-009), F4 (NFR-004) |
| backend y frontend | tests (iteración 2) | `frontend/src/lib/useEscapeCapture.test.ts` | backend: `tests/fakes.py`, `test_catalog_search_service.py`, `test_food_library_service.py`, `test_food_library_routes.py`, `test_catalog_routes.py`; frontend: `FoodSearchPanel.test.tsx`, `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `proposal.test.ts`, `schemas.test.ts` (diary), `PhotoReview.source.test.ts`, `foodsRoute.test.tsx`, `mealPhotoRoute.test.tsx`, `diaryRoute.test.tsx`; se borran `features/catalog/components/CatalogResultList.test.tsx`, `features/catalog/schemas.test.ts` y `src/test/catalogFixtures.ts` | Sección 5, «Iteración 2» |
| backend | repositories (iteración 2) | — | `backend/repositories/food_favorite_repository.py` (se quita `count_by_user`, sin uso) | F3 |
| frontend | diary · lógica | — | `frontend/src/features/diary/proposal.ts`, `types.ts`, `schemas.ts`, `format.ts`, `errors.ts`, `constants.ts`, `hooks.ts` | Entradas con clave y alimento propio, `custom_food_id`, mensajes, invalidar la biblioteca al añadir |
| frontend | retirada | — | se borran `frontend/src/features/diary/components/ProposalSearchStep.tsx`, `frontend/src/features/foods/pages/FoodsPage.tsx`, `frontend/src/features/foods/pages/FoodsPage.test.tsx`, `frontend/src/features/foods/components/FoodResultList.tsx`, `frontend/src/features/foods/components/FoodSearchForm.tsx`, `frontend/src/features/foods/hooks.ts` | REQ-020 y Q7; sustituidos por `FoodSearchPanel` |
| frontend | legal | — | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx` | REQ-021 |
| frontend | tests | `frontend/src/features/food-library/api.test.ts`, `frontend/src/lib/useDebouncedValue.test.ts`, `frontend/src/features/diary/components/FoodSearchPanel.test.tsx`, `frontend/src/features/diary/components/PhotoReview.source.test.ts` | `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx`, `proposal.test.ts`, `schemas.test.ts`, `api.test.ts` (diary), `PrivacyPolicyPage.test.tsx`, `foodsRoute.test.tsx`, `mealPhotoRoute.test.tsx` | Ver sección 5 |
| docs | ADR | `docs/sdd/decisions/ADR-0036-biblioteca-de-alimentos-propios.md` | `docs/sdd/decisions/README.md` | Decisión nueva (sección 8) |

Sin dependencias nuevas, sin variables de entorno nuevas y sin cambios en `config.py`, `extensions.py` ni Caddy. La
iteración 2 no cambia modelos ni migraciones, ni las rutas HTTP (`food_library_routes.py` y `catalog_routes.py` siguen
igual: no pasan `stats`).

## 3. Diseño
### 3.1 Datos y migraciones

**`public.custom_foods`** (`backend/models/custom_food.py`, clase `CustomFood`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `Integer` PK autoincremental | `custom_food_id` |
| `user_id` | `UUID` FK `public.users.id` | sin `ondelete`, como `meals` |
| `name` | `Text` no nulo | último nombre registrado, ya recortado; `CHECK ck_custom_foods_name_length`: `char_length(name) BETWEEN 1 AND 100` |
| `name_key` | `Text` no nulo | `custom_food_name_key(name)` |
| `calories_kcal`, `protein_g`, `carbs_g`, `fat_g` | `Float` no nulos | por 100 g; `CHECK ck_custom_foods_calories` (0 a 900) y `ck_custom_foods_macros` (cada macro de 0 a 100) |
| `created_at`, `updated_at` | `DateTime` con `server_default now()` | `updated_at` con `onupdate` |

Restricción `UNIQUE (user_id, name_key)` con nombre `uq_custom_foods_user_id_name_key` (también sirve de índice por
usuario).

**`public.food_favorites`** (`backend/models/food_favorite.py`, clase `FoodFavorite`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `Integer` PK | |
| `user_id` | `UUID` FK `public.users.id` | |
| `catalog_id` | `String(60)` nulo | sin FK (ADR-0031): un favorito vuelve a aparecer si una carga devuelve el alimento |
| `custom_food_id` | `Integer` nulo, FK `public.custom_foods.id` `ON DELETE CASCADE`, nombre `fk_food_favorites_custom_food_id` | |
| `created_at` | `DateTime` | |

`CHECK ck_food_favorites_one_food`: `(catalog_id IS NULL) <> (custom_food_id IS NULL)`;
`UNIQUE (user_id, catalog_id)` `uq_food_favorites_user_id_catalog_id` y `UNIQUE (user_id, custom_food_id)`
`uq_food_favorites_user_id_custom_food_id` (en Postgres los `NULL` no chocan).

**`public.meal_items`** (`backend/models/meal.py`): columna `custom_food_id: Mapped[int | None]`, `Integer` nula,
`ForeignKey("public.custom_foods.id", ondelete="SET NULL", name="fk_meal_items_custom_food_id")`, índice
`ix_meal_items_custom_food_id` y `CHECK ck_meal_items_custom_food_source`: `custom_food_id IS NULL OR source = 'custom'`.
No se tocan las `CHECK` existentes. Sin `relationship` entre los modelos: el borrado en cascada y el `SET NULL` los
hace la base.

`backend/models/__init__.py` importa `CustomFood` y `FoodFavorite` (para `create_all()` de los tests).

**Migración `e6a8c0d2f4b7_create_food_library.py`** (`down_revision = 'd4f6a8c0e2b5'`, la cabeza actual):
- `upgrade()`:
  1. `create_table('custom_foods', …)` y `create_table('food_favorites', …)` con las restricciones anteriores, todas
     con nombre explícito (iguales a las del modelo, para que el `downgrade` funcione igual sobre una base creada con
     `create_all()`).
  2. `add_column('meal_items', custom_food_id)`, `create_foreign_key('fk_meal_items_custom_food_id', …,
     ondelete='SET NULL')`, `create_index('ix_meal_items_custom_food_id', …)` y
     `create_check_constraint('ck_meal_items_custom_food_source', …)`.
  3. **Relleno (REQ-005):** con `op.get_bind()` y `sa.text` con parámetros enlazados (Art. P3.4):
     - lee `mi.id, m.user_id, mi.name, mi.per_100g_* , mi.created_at` de `meal_items` unido a `meals` con
       `mi.source = 'custom'`, ordenado por `mi.created_at, mi.id`;
     - agrupa en Python por `(user_id, clave)` con una copia **local** de la regla de clave (la migración no importa
       código de la app, que puede cambiar): `" ".join(_fold(name).split())`, con `_fold` = `casefold` + NFKD sin marcas
       combinantes;
     - por grupo, inserta un `custom_foods` con el nombre y los valores del **último** registro del grupo
       (`RETURNING id`) y ejecuta `UPDATE public.meal_items SET custom_food_id = :id WHERE id = ANY(:ids)`;
     - no aplica el límite de 500.
- `downgrade()`: quita la `CHECK`, el índice, la FK y la columna de `meal_items`; después `drop_table('food_favorites')`
  y `drop_table('custom_foods')`. Se pierden los favoritos; los alimentos propios se regeneran con otro `upgrade`.
- Es aditiva y **no se aplica sola**: el `doc-keeper` añade el caso a `docs/deploy-runbook.md` (volcado completo
  verificado en `C:/Users/alber/fitnerd-backups` y `flask db upgrade` con `FLASK_ENV` bien puesto **antes del merge**,
  como la 022 y la 023), Art. P4.

### 3.2 Contratos e interfaces

#### API HTTP (todas con `@require_auth`; `user_id` siempre de `g.decoded_token["id"]`, Art. P3.1)

| Petición | Respuesta | Errores |
|---|---|---|
| `GET /api/food-library/search?q=` | 200 `{"results": [LibraryFood]}` (≤ 20) | 400 con los mensajes de `normalize_query` (023) |
| `GET /api/food-library/recent` | 200 `{"results": [LibraryFood + last_grams]}` (≤ 10) | — |
| `GET /api/food-library/favorites` | 200 `{"results": [LibraryFood]}` | — |
| `PUT /api/food-library/favorites/catalog/<catalog_id>` | 204 | 404 `No encontramos ese alimento.`; 400 `Ya tienes 100 favoritos. Quita alguno para añadir otro.` |
| `PUT /api/food-library/favorites/custom/<custom_food_id>` | 204 | ídem |
| `DELETE /api/food-library/favorites/catalog/<catalog_id>` | 204 | 404 |
| `DELETE /api/food-library/favorites/custom/<custom_food_id>` | 204 | 404 |
| `DELETE /api/food-library/custom/<custom_food_id>` | 204 | 404 |

Los parámetros de ruta son **texto** (no `<int:…>`), para que `abc` llegue al servicio y responda el 404 con el mensaje
de la spec (AC-004.3). `LibraryFood` serializado:
`{"kind": "catalog"|"custom", "id": str|int, "name": str, "per_100g": {cuatro float}, "favorite": bool}` y, solo en
recientes, `"last_grams": float`.

`/api/meals`: cada alimento de las respuestas añade `"custom_food_id": int | null`; `POST /api/meals` acepta
`{"custom_food_id": int, "grams": number}`. Mensajes nuevos: `Ya tienes 500 alimentos propios. Borra alguno para crear
otro.` (400) y `No encontramos ese alimento.` (400, el `FOOD_NOT_FOUND_MESSAGE` existente).

#### Backend · firmas exactas (esqueletos: `raise NotImplementedError("not implemented")`, Art. P1.backend.5)

`backend/services/food_library_rules.py`:
```python
MAX_CUSTOM_FOODS = 500
MAX_FAVORITES = 100
MAX_RECENT_FOODS = 10
CUSTOM_FOODS_LIMIT_MESSAGE = "Ya tienes 500 alimentos propios. Borra alguno para crear otro."
FAVORITES_LIMIT_MESSAGE = "Ya tienes 100 favoritos. Quita alguno para añadir otro."
LIBRARY_KINDS: tuple[str, ...] = ("catalog", "custom")

@dataclass(frozen=True)
class LibraryFood:
    kind: str                      # "catalog" | "custom"
    id: str | int
    name: str
    per_100g: dict[str, float]
    favorite: bool
    last_grams: Decimal | None = None

@dataclass(frozen=True)
class RecentFoodRow:
    catalog_id: str | None
    custom_food_id: int | None
    grams: Decimal

def custom_food_name_key(name: str) -> str: ...
def parse_custom_food_id(value: object) -> int | None: ...   # int o texto de dígitos entre 1 y 2.147.483.647; si no, None
```

`backend/services/catalog_search_service.py` (se conservan `MAX_RESULTS`, `GROUP_*`, `match_group`, `rank_catalog` y
`CatalogSearchService` con su firma):
```python
def query_forms(query: str) -> list[tuple[str, ...]]: ...       # añade la forma «-ces» → «z» (≥ 3 caracteres)
def edit_distance(a: str, b: str) -> int: ...                   # OSA: insertar, borrar, cambiar, intercambiar contiguas
def prefix_edit_distance(form: str, word: str) -> int: ...      # mínimo frente a la palabra y a cada uno de sus inicios
def typo_tolerance(form: str) -> int: ...                       # < 4 → 0; 4 a 7 → 1; ≥ 8 → 2
def typo_distance(name: str, synonyms: Sequence[str], query: list[tuple[str, ...]]) -> int | None: ...

@dataclass(frozen=True)
class SearchCandidate:
    name: str
    synonyms: Sequence[str]
    source_order: int      # 0 catálogo, 1 propio
    key: str               # desempate estable (id como texto)
    item: object

def rank_candidates(candidates: Iterable[SearchCandidate], query: str, limit: int = MAX_RESULTS) -> list: ...
```

**(iteración 2, F4, NFR-004)** en el mismo módulo (las firmas anteriores ganan un último parámetro opcional; con
`None` se comportan igual que hoy, así los tests existentes siguen valiendo):
```python
TYPO_MIN_FORM_LENGTH = 4    # formas más cortas: tolerancia 0, sin cálculo de distancia

@dataclass
class TypoSearchStats:
    comparisons: int = 0    # cálculos de prefix_edit_distance hechos en la pasada con tolerancia

class TypoDistances:
    """Memoria de distancias de una búsqueda, por pareja (forma, palabra), con contador."""
    def __init__(self, stats: TypoSearchStats | None = None): ...
    def within_tolerance(self, form: str, word: str) -> int | None: ...   # distancia si ≤ typo_tolerance(form); si no, None

def typo_distance(name: str, synonyms: Sequence[str], query: list[tuple[str, ...]],
                  distances: TypoDistances | None = None) -> int | None: ...
def typo_comparison_bound(candidates: Iterable[SearchCandidate], query: str) -> int: ...   # F × P (sección 3.3)
def rank_candidates(candidates: Iterable[SearchCandidate], query: str, limit: int = MAX_RESULTS,
                    stats: TypoSearchStats | None = None) -> list: ...
def rank_catalog(foods: Iterable, query: str, limit: int = MAX_RESULTS,
                 stats: TypoSearchStats | None = None) -> list: ...

class CatalogSearchService:
    def __init__(self, catalog_repository): ...                        # sin cambios
    def search(self, raw_query: str | None, stats: TypoSearchStats | None = None) -> list[CatalogFood]: ...
```

`backend/services/food_library_service.py`:
```python
class FoodLibraryService:
    def __init__(self, catalog_repository, custom_food_repository, favorite_repository,
                 meal_repository, user_repository, unit_of_work): ...
    def search(self, user_id, raw_query: str | None,
               stats: TypoSearchStats | None = None) -> list[LibraryFood]: ...   # stats: iteración 2
    def recent(self, user_id) -> list[LibraryFood]: ...
    def favorites(self, user_id) -> list[LibraryFood]: ...
    def add_favorite(self, user_id, kind: str, food_id: object) -> None: ...
    def remove_favorite(self, user_id, kind: str, food_id: object) -> None: ...
    def delete_custom_food(self, user_id, custom_food_id: object) -> None: ...
    def _visible_favorite_count(self, user_id) -> int: ...   # iteración 2 (F3), privado
```

`backend/services/meal_rules.py` (añadidos):
```python
@dataclass(frozen=True)
class LibraryItemInput:
    custom_food_id: int
    grams: Decimal

# RemovedItemSnapshot gana un último campo con valor por defecto:
#     custom_food_id: int | None = None
# parse_items(...) -> list[CatalogItemInput | UsdaItemInput | CustomItemInput | LibraryItemInput]
```

`backend/services/meal_service.py`: `MealService.__init__(…, catalog_repository=None, restore_signer=None,
custom_food_repository=None)` (kwarg nuevo al final; con `None` no se guarda en la biblioteca, como hoy con
`catalog_repository`, para no romper los tests unitarios existentes).

`backend/repositories/custom_food_repository.py`:
```python
class CustomFoodRepository(BaseRepository):
    def __init__(self, session): ...
    def list_by_user(self, user_id) -> list[CustomFood]: ...
    def get_by_id_and_user(self, custom_food_id: int, user_id) -> CustomFood | None: ...
    def get_by_ids_and_user(self, ids: list[int], user_id) -> list[CustomFood]: ...
    def get_by_name_keys(self, user_id, name_keys: list[str]) -> list[CustomFood]: ...
    def count_by_user(self, user_id) -> int: ...
    def create(self, food: CustomFood) -> CustomFood: ...   # add + flush (para tener id); nunca commit
```

`backend/repositories/food_favorite_repository.py`:
```python
class FoodFavoriteRepository(BaseRepository):
    def __init__(self, session): ...
    def list_by_user(self, user_id) -> list[FoodFavorite]: ...
    def get_for_food(self, user_id, catalog_id: str | None = None,
                     custom_food_id: int | None = None) -> FoodFavorite | None: ...
    # (iteración 2, F3) se quita `count_by_user`: el límite cuenta los visibles en el servicio.
```

`backend/repositories/meal_repository.py`: `def list_recent_foods(self, user_id, limit: int) -> list[RecentFoodRow]`.

`backend/routes/food_library_routes.py`: `food_library_bp = Blueprint("food_library", __name__,
url_prefix="/api/food-library")`, `def _build_food_library_service() -> FoodLibraryService` y
`def library_food_to_json(food: LibraryFood) -> dict`.

#### Frontend · firmas exactas (esqueletos: `throw new Error("not implemented")`, parámetros con `_`, Art. P1.frontend.5)

`frontend/src/features/food-library/types.ts`:
```ts
export type LibraryNutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type LibraryPer100g = Record<LibraryNutrientKey, number>
export type CatalogLibraryFood = { kind: "catalog"; id: string; name: string; per_100g: LibraryPer100g; favorite: boolean }
export type CustomLibraryFood = { kind: "custom"; id: number; name: string; per_100g: LibraryPer100g; favorite: boolean }
export type LibraryFood = CatalogLibraryFood | CustomLibraryFood
export type RecentFood = LibraryFood & { last_grams: number }
```

`frontend/src/features/food-library/schemas.ts`: `libraryFoodSchema` (unión discriminada por `kind`),
`libraryResultsSchema` (`{ results: LibraryFood[] }`) y `recentResultsSchema` (`{ results: RecentFood[] }`).

`frontend/src/features/food-library/api.ts`:
```ts
export async function searchFoodLibrary(query: string): Promise<LibraryFood[]>
export async function getRecentFoods(): Promise<RecentFood[]>
export async function getFavoriteFoods(): Promise<LibraryFood[]>
export async function setFoodFavorite(food: Pick<LibraryFood, "kind" | "id">, favorite: boolean): Promise<void>
export async function deleteCustomFood(customFoodId: number): Promise<void>
```
(`setFoodFavorite` hace `PUT` o `DELETE` a `/api/food-library/favorites/{kind}/{encodeURIComponent(String(id))}`.)

`frontend/src/features/food-library/hooks.ts`:
```ts
export const foodLibraryKeys = {
  all: ["food-library"] as const,
  search: (query: string) => ["food-library", "search", query] as const,
  recent: () => ["food-library", "recent"] as const,
  favorites: () => ["food-library", "favorites"] as const,
}
export function useFoodLibrarySearch(query: string | null): UseQueryResult<LibraryFood[], Error>
export function useRecentFoods(): UseQueryResult<RecentFood[], Error>
export function useFavoriteFoods(): UseQueryResult<LibraryFood[], Error>
export function useSetFoodFavorite(): UseMutationResult<void, Error, { food: LibraryFood; favorite: boolean }>
export function useDeleteCustomFood(): UseMutationResult<void, Error, number>
```

`frontend/src/lib/useDebouncedValue.ts`:
```ts
export function useDebouncedValue<T>(value: T, delayMs: number): [T, (next: T) => void]
```

`frontend/src/features/diary/components/FoodSearchPanel.tsx` (iteración 2: sin `confirmContainer`, que nunca se
implementó, y con `onCustomFoodDeleted`):
```ts
export function FoodSearchPanel(props: {
  initialQuery?: string
  onQueryChange?: (query: string) => void
  onSelect: (food: LibraryFood, defaultGrams: string) => void
  onCreateCustom: (name: string) => void
  onCustomFoodDeleted?: (customFoodId: number) => void   // tras un borrado correcto (también el 404)
  actions?: ReactNode
}): ReactElement
```
La confirmación sigue siendo un componente interno, no exportado, de `FoodSearchPanel.tsx`
(`DeleteConfirmation({ title, description, isPending, onConfirm, onCancel })`, sin la prop `error` de la iteración 1).

`frontend/src/features/diary/components/LibraryFoodList.tsx` (iteración 2: `onDelete` recibe el alimento propio y su
botón, y `renderInline` pinta contenido dentro del elemento de un alimento):
```ts
export function LibraryFoodList(props: {
  label: string
  foods: LibraryFood[]
  onSelect: (food: LibraryFood) => void
  onToggleFavorite: (food: LibraryFood) => void
  onDelete: (food: CustomLibraryFood, trigger: HTMLButtonElement) => void
  renderInline?: (food: LibraryFood) => ReactNode
  disabled?: boolean
}): ReactElement
```

`frontend/src/lib/useEscapeCapture.ts` (iteración 2, F1):
```ts
export function useEscapeCapture(onEscape: () => void, active: boolean): void
```

`frontend/src/features/diary`:
- `types.ts`: `MealItem.custom_food_id: number | null`; `LibraryItemPayload = { custom_food_id: number; grams: number }`;
  `SavableItemPayload = CatalogItemPayload | CustomItemPayload | LibraryItemPayload`; `AddMealItemsPayload.items`
  admite `LibraryItemPayload`; la variante `custom` de `ProposalEntry` gana `customFoodId?: number` (opcional: los
  creados en la propuesta no lo llevan); `ProposalFormEntry = ProposalEntry & { key: string }`;
  `ProposalFormValues = { entries: ProposalFormEntry[] }`.
- `schemas.ts`: `custom_food_id: z.number().nullable().default(null)` en los alimentos de `mealResponseSchema`;
  `key: z.string().optional()` en las tres variantes de `proposalEntrySchema` y `customFoodId: z.number().optional()`
  en la `custom`.
- `proposal.ts`:
  ```ts
  export function libraryEntry(food: LibraryFood, grams: string): ProposalEntry
  export function withEntryKey(entry: ProposalEntry): ProposalFormEntry
  export function mergeProposalEntries(
    fields: ProposalFormEntry[],
    watched: readonly (Partial<ProposalFormEntry> | undefined)[] | undefined
  ): ProposalFormEntry[]
  ```
  (`proposalItems` convierte un `custom` con `customFoodId` en `{ custom_food_id, grams }`.)
  (iteración 2) Se quita `export function catalogEntry(food: CatalogFood, grams: string)` (F5; `libraryEntry` cubre el
  caso del catálogo con la misma etiqueta «Añadido por ti») y se añade (F7):
  ```ts
  // Si la entrada es el alimento propio borrado, la misma entrada sin `customFoodId` (y sin `key`); si no, null.
  export function unlinkCustomFood(entry: ProposalEntry, customFoodId: number): ProposalEntry | null
  ```
- `schemas.ts` (iteración 2, F6): las tres variantes de la propuesta y la validación de gramos se definen una vez y se
  combinan en dos esquemas:
  ```ts
  export const proposalFormSchema            // el de la 025 y la 028: `key` opcional (sin cambios de comportamiento)
  export const proposalReviewSchema: z.ZodType<ProposalFormValues, ProposalFormValues>   // `key` obligatoria
  ```
  `PhotoReview` usa `useForm<ProposalFormValues>({ resolver: zodResolver(proposalReviewSchema), defaultValues })` y
  `mergeProposalEntries(fields, watched)`, sin `as never` ni `as unknown as`. La anotación de tipo hace que `tsc` falle
  si el esquema y `ProposalFormValues` se desalinean.
- `format.ts`: `export function gramsText(value: number): string` (150 → `"150"`, 12.5 → `"12,5"`).
- `errors.ts`: `FAVORITE_FAILED_MESSAGE = "No se pudo actualizar tus favoritos."`,
  `export function favoriteErrorMessage(error: unknown): string` (400 → mensaje del servidor),
  `DELETE_CUSTOM_FOOD_FAILED_MESSAGE = "No se pudo borrar el alimento."`,
  `LIBRARY_LOAD_FAILED_MESSAGE = "No se pudieron cargar tus alimentos."`.
- `constants.ts`: `SEARCH_DEBOUNCE_MS = 300` y `CUSTOM_FOOD_LIBRARY_NOTICE = "Se guardará en tus alimentos para usarlo
  otro día. Si ya tienes uno con el mismo nombre, se actualizarán sus valores."`.
- `PhotoReview`: sin props nuevas (iteración 2, F8: la prop `confirmContainer` del primer plan no existe; la
  confirmación en línea no la necesita y `MealPhotoDialog` no cambia).

### 3.3 Lógica

**Clave de nombre (`custom_food_name_key`):** `" ".join(fold(name).split())`, reutilizando `fold` de
`services/catalog_rules.py` (casefold + NFKD sin marcas: «Piña» = «Pina»). Solo mayúsculas, tildes y espacios; la
puntuación sí distingue.

**`MealService.add_items` (REQ-001 a REQ-003):**
1. `parse_items` cuenta `custom_food_id` como cuarto origen: exactamente uno de `catalog_id`, `fdc_id`, `name`,
   `custom_food_id` (si no, `ITEM_SOURCE_MESSAGE`); valida gramos como hoy; `custom_food_id` debe cumplir `is_db_id`
   (si no, `ValidationError(FOOD_NOT_FOUND_MESSAGE)`, 400, AC-003.2). `_load_foods` pasa a filtrar por
   `isinstance(entry, UsdaItemInput)` (hoy filtra «lo que no es catálogo ni personalizado», que incluiría los nuevos).
2. Tras `_lock_user` (ADR-0020): `_load_custom_foods(user_id, inputs)` carga por id los `LibraryItemInput` con
   `get_by_ids_and_user` (falta alguno → 400 `FOOD_NOT_FOUND_MESSAGE`) y **copia sus valores en ese momento**, antes de
   tocar la biblioteca.
3. `_save_custom_foods(user_id, inputs)` (solo si hay `custom_food_repository`): agrupa los `CustomItemInput` por clave
   conservando el orden (el último de la petición gana, AC-001.6); busca las existentes con `get_by_name_keys`; si
   `count_by_user + nuevas > MAX_CUSTOM_FOODS` → `ValidationError(CUSTOM_FOODS_LIMIT_MESSAGE)` antes de escribir nada
   (AC-002.1 a AC-002.3); actualiza `name` y los cuatro valores de las existentes y crea las nuevas con `create`
   (flush para el id). Devuelve `{clave: CustomFood}`.
4. Cada alimento se crea como hoy; los `custom` llevan `custom_food_id` (el de su clave o el pedido). Los
   `LibraryItemInput` se guardan con `source="custom"`, el nombre y los valores copiados en el paso 2.
5. Cualquier error → `unit_of_work.rollback()` (no queda nada, AC-001.7, AC-002.x). Concurrencia (AC-001.8): el
   bloqueo de la fila del usuario serializa las dos peticiones; la segunda ve el alimento ya creado. La restricción
   única es la red de seguridad.

**`MealService.remove_item` / `restore_item` (REQ-012):** el snapshot lleva `custom_food_id`. `snapshot_payload`
añade `"cf"` **solo si no es `None`** (el test de la 026 que fija el conjunto exacto de claves sigue válido).
`parse_snapshot_payload`: `cf` ausente → `None`; presente → debe cumplir `is_db_id` y `source == "custom"`, si no el
token no es válido (404, como la 027). Al restaurar con `cf`, se vincula solo si
`custom_food_repository.get_by_id_and_user(cf, user_id)` lo encuentra; si no, `None` (AC-012.2).

**`FoodLibraryService`:**
- `search`: `normalize_query` (023) → `favorites = _favorite_keys(user_id)` → candidatos: todo el catálogo
  (`source_order=0`, sinónimos) y la biblioteca del usuario (`list_by_user`, `source_order=1`, sin sinónimos) →
  `rank_candidates(…, MAX_RESULTS)` → `LibraryFood` con `favorite`.
- `recent`: `meal_repository.list_recent_foods(user_id, MAX_RECENT_FOODS)` → carga los del catálogo por id
  (`catalog_repository.get_by_ids`) y los propios (`get_by_ids_and_user`), mantiene el orden de las filas, salta los que
  ya no existan y pone `last_grams` de la fila y los valores **actuales** (AC-008.8).
- `favorites`: `favorite_repository.list_by_user` → carga catálogo y propios; omite los del catálogo que ya no están
  (AC-010.2); ordena por `(fold(name), source_order, name, id)`.
- `add_favorite` / `remove_favorite`: `kind` fuera de `LIBRARY_KINDS` → 404. Valida el id (`is_catalog_id` o
  `parse_custom_food_id`) y la existencia (`catalog_repository.get_by_ids([id])` o `get_by_id_and_user`); si no →
  `ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)`. `add`: bloquea la fila del usuario; si ya es favorito, no hace nada
  (204); si los favoritos visibles son `>= MAX_FAVORITES` → `ValidationError(FAVORITES_LIMIT_MESSAGE)`; si no, crea y
  `commit`. `remove`: borra si existe y `commit`. (La iteración 1 contaba con `count_by_user` y exigía la existencia
  también al quitar; la iteración 2 lo cambia, ver el punto siguiente.)
- **(iteración 2, F3, Q11)** cambios en los favoritos:
  - `add_favorite` usa `_visible_favorite_count(user_id)` en lugar de `count_by_user`: `favorite_repository.list_by_user`
    → los propios cuentan todos (el `CASCADE` no deja huérfanos) y los del catálogo solo si
    `catalog_repository.get_by_ids(ids)` los devuelve (se reutiliza `_load`, la misma regla que `favorites()`). Si ya
    es favorito, 204 sin contar (AC-009.4). Si un alimento retirado vuelve sin haberlo quitado y deja más de 100
    visibles, marcar uno nuevo da el 400 hasta bajar de 100 (Q11).
  - `remove_favorite` con `kind == "catalog"`, tras validar el id y bloquear la fila del usuario:
    `existing = get_for_food(user_id, catalog_id=…)`; si existe, se borra (aunque el alimento ya no esté en el
    catálogo, AC-009.7) y `commit`; si no existe, se exige el alimento en el catálogo (`_require_food`): si está, 204
    sin cambios (AC-009.2); si no, 404 `FOOD_NOT_FOUND_MESSAGE` (AC-009.8; `get_for_food` filtra por usuario, así el
    favorito de otro usuario no cuenta y no se toca). Con `kind == "custom"` no cambia.
  - `FoodFavoriteRepository.count_by_user` deja de usarse y se quita.
- `delete_custom_food`: `parse_custom_food_id` → bloquea la fila del usuario → `get_by_id_and_user` (si no, 404) →
  `delete` → `commit`. La base pone `meal_items.custom_food_id` a `NULL` y borra sus favoritos.
- Ningún método llama a proveedores externos ni usa `rate_limiter` (NFR-001).

**`MealRepository.list_recent_foods`:** consulta con el ORM (sin SQL concatenado):
`row_number() OVER (PARTITION BY meal_items.catalog_id, meal_items.custom_food_id ORDER BY meal_items.created_at DESC,
meal_items.id DESC)` sobre `meal_items JOIN meals` del usuario, con
`(source = 'catalog' AND catalog_id IN (SELECT id FROM catalog_foods)) OR custom_food_id IS NOT NULL`; fuera, `rn = 1`
ordenado por `created_at DESC, id DESC` y `LIMIT`. Editar gramos no cambia `created_at` (AC-008.3); restaurar crea una
fila nueva (AC-012.1).

**Búsqueda (`rank_candidates`, REQ-006 y REQ-007):**
1. `forms = query_forms(query)`; vacío → `[]`.
2. **Pasada exacta:** `match_group(name, synonyms, forms)`; orden `(grupo, fold(name), source_order, name, key)`.
3. Si no hay **ninguna** coincidencia: **pasada con tolerancia**: `typo_distance` = mínimo, entre el nombre y cada
   sinónimo, de la suma por palabra de la consulta del mínimo `prefix_edit_distance(forma, palabra)` entre sus formas y
   las palabras del término, contando solo las que cumplen `≤ typo_tolerance(forma)`; si alguna palabra de la consulta
   no tiene coincidencia, el término no vale. Orden `(distancia, fold(name), source_order, name, key)`.
4. `prefix_edit_distance` calcula la tabla OSA de `form` frente a `word` y devuelve el mínimo de la última fila (la
   forma completa frente a cada inicio de la palabra, incluida la palabra entera).
5. `rank_catalog(foods, query, limit)` pasa a ser `rank_candidates` con todos los alimentos en `source_order=0`; el
   orden de la 023 no cambia (la columna nueva es constante).
Comprobación con los AC: «arorz»/«arroz» = 1 (intercambio); «ijol» frente a «frijoles» > 1 (AC-006.8); «huevi» frente a
«hueso» = 2 > 1 (AC-006.9); «pam» no tiene tolerancia (AC-006.7); «nueces» → forma «nuez» (AC-006.10).

**(iteración 2, F4, NFR-004) Cota determinista de la pasada con tolerancia:**
1. `rank_candidates(…, stats)` crea **un** `TypoDistances(stats)` por búsqueda y lo pasa a `typo_distance` de cada
   candidato. La pasada exacta no lo usa: con coincidencias exactas `stats.comparisons` queda en 0 (AC-N004.3).
2. `TypoDistances.within_tolerance(form, word)`:
   - `tol = typo_tolerance(form)`; si `tol == 0` (forma de menos de `TYPO_MIN_FORM_LENGTH`) → `0` si
     `word.startswith(form)`, si no `None`. **No** cuenta como comparación (equivale a la distancia 0 frente a un
     inicio). Así `q=pam` no hace ninguna (AC-N004.3).
   - si `len(word) < len(form) - tol` → `None` sin calcular: la distancia frente a cualquier inicio de la palabra es al
     menos `len(form) - len(word)`. No cuenta.
   - si la pareja `(form, word)` ya está en la memoria, se usa; si no, `prefix_edit_distance(form, word)`, se guarda y
     `stats.comparisons += 1` (si hay `stats`).
   - devuelve la distancia si es `≤ tol`; si no, `None`.
3. `typo_distance` usa `within_tolerance` en lugar de llamar a `prefix_edit_distance` directamente. Sigue recorriendo
   las palabras de la consulta en su orden, **con repeticiones** (la suma de distancias y por tanto el orden de
   REQ-006 no cambian), y corta el término en la primera palabra sin coincidencia, como hoy. Las repeticiones solo
   encuentran parejas ya calculadas: repetir palabras no añade comparaciones, y como el orden de aparición de las
   palabras distintas es el mismo, `"arroces " * 12 + "qzxw"` y `arroces qzxw` hacen exactamente las mismas (AC-N004.1).
   Sin `distances`, `typo_distance` crea una memoria propia (los tests unitarios de la iteración 1 siguen valiendo).
4. Cada pareja se calcula como mucho una vez y solo con formas de 4 o más caracteres y palabras de los términos
   candidatos, así que `stats.comparisons ≤ F × P`.
5. `typo_comparison_bound(candidates, query)`: **F** = número de formas distintas con `len ≥ TYPO_MIN_FORM_LENGTH` del
   conjunto de `query_forms(query)` (palabras repetidas una vez); **P** = número de palabras distintas de
   `words(name)` y `words(synonym)` de todos los candidatos. Devuelve `F * P`. Lo usan los tests y documenta la cota;
   el código de producción no lo necesita.
6. `rank_catalog(…, stats)`, `CatalogSearchService.search(raw_query, stats=None)` y
   `FoodLibraryService.search(user_id, raw_query, stats=None)` solo reenvían `stats`. Las rutas no lo pasan y los
   contratos HTTP no cambian (AC-006.12).

Ejemplo de AC-N004.1: «arroces» tiene las formas `arroces`, `arroce`, `arroc` y `arroz` (todas de 4 o más caracteres)
y «qzxw», una: F = 5 en las dos consultas.

**Frontend · `FoodSearchPanel` (REQ-013 a REQ-017):**
- Formulario react-hook-form con `foodSearchFormSchema` de `features/foods/schemas.ts` (se conserva), `mode` y
  `reValidateMode` `"onSubmit"` (sin avisos mientras se escribe, Q6). El texto se lee con `useWatch`.
- `const [active, flush] = useDebouncedValue(typed.trim(), SEARCH_DEBOUNCE_MS)`; `query = active` si tiene de 2 a 100
  caracteres, si no `null`. Intro válido → `flush(trimmed)` (búsqueda en el acto; cuando vence el retardo el valor es
  el mismo y no hay otra petición, AC-013.6). Intro no válido → mensaje de zod, sin petición.
- `useFoodLibrarySearch(query)`: `useQuery` con clave `foodLibraryKeys.search(query)`, `enabled: query !== null`,
  `retry: false`, `staleTime: 60_000`. Al ser por clave, una respuesta tardía de «pollo» nunca se muestra con «arroz»
  (AC-013.3). «Reintentar» = `refetch()`.
- Con el texto recortado de menos de 2 caracteres: `useFavoriteFoods()` y `useRecentFoods()` (`staleTime: 0`,
  `retry: false`; se vuelven a pedir al montar, AC-014.6) en dos `LibraryFoodList` con encabezado «Favoritos» y
  «Recientes»; sin ninguno, el texto de la 023; si cualquiera falla, `LIBRARY_LOAD_FAILED_MESSAGE` con «Reintentar»
  (refetch de las dos).
- Con 2 o más caracteres y el retardo pendiente (texto distinto de `active`), la región muestra «Buscando…».
- Región `role="status" aria-live="polite"` con: «Buscando…», sin resultados (con «Crear alimento personalizado», que
  llama a `onCreateCustom(query)`), error con «Reintentar» (`searchErrorView` de `features/foods/searchError.ts`), error
  de carga de tus alimentos y el texto inicial (NFR-002). Fuera de la región: el botón «Crear alimento personalizado»
  cuando hay resultados (`onCreateCustom("")`), la lista «Resultados» y `actions`.
- Gramos al elegir: desde «Recientes», `gramsText(last_grams)`; desde «Resultados» o «Favoritos», `"100"`.
- Favorito: `useSetFoodFavorite` (sin actualización optimista; `onSuccess` devuelve la promesa de invalidar
  `foodLibraryKeys.all`, así el botón cambia cuando llegan los datos nuevos). Error → `favoriteErrorMessage` en un
  `role="alert"`; el botón no cambia (AC-015.4 y AC-015.5). Los botones de favorito se deshabilitan mientras hay una
  petición en curso.
- Borrar **(iteración 2, F1, F2 y F8; sustituye al `ConfirmDialog` con `confirmContainer` del primer plan, que la
  implementación ya cambió por una confirmación en línea porque un modal de Radix oculta la búsqueda con
  `aria-hidden`)**:
  - Estado del panel: `target: { food: CustomLibraryFood; list: "Resultados" | "Favoritos" | "Recientes"; trigger:
    HTMLButtonElement } | null` y `confirming: boolean`. Al ser `CustomLibraryFood`, el id ya es `number` y desaparece
    el `toDelete.id as number` de la iteración 1.
  - `onDelete(food, trigger)` de cada lista: `deleteFood.reset()`, `target = { food, list: <su etiqueta>, trigger }`,
    `confirming = true`.
  - Cada `LibraryFoodList` recibe `renderInline`: para el alimento de `target` en la lista de `target.list` (misma
    `kind` e `id`), pinta `DeleteConfirmation` si `confirming`; si no y `deleteFood.isError`, un
    `<p role="alert">No se pudo borrar el alimento.</p>`. En el resto, nada. Así la confirmación sale **dentro del
    `<li>`** donde se pulsó «Borrar» y no en otra lista con el mismo alimento (AC-017.7). No es modal: las listas
    siguen accesibles por rol, sin `aria-hidden` (AC-017.3, AC-017.7).
  - `DeleteConfirmation`: `role="alertdialog"` con `aria-labelledby` (título `¿Borrar «{nombre}» de tus alimentos?`) y
    `aria-describedby` («Las comidas ya registradas no cambian.»), «Borrar» (destructivo) y «Cancelar»; el foco va a
    «Cancelar» al montarse (AC-N002.3). Llama a `useEscapeCapture(cancelar, true)` y se quita el `onKeyDown` de
    Escape, que nunca se ejecutaba (F1). Con el borrado en curso, Escape se consume sin hacer nada (no hay cancelación
    a medias).
  - Cancelar (botón o Escape; ignorado si `isPending`): `confirming = false`, `target = null`, `deleteFood.reset()` y
    foco al `trigger` (AC-N002.4).
  - Confirmar: `deleteFood.mutate(food.id, { onSuccess, onError })` (el hook ya invalida `foodLibraryKeys.all` y toma
    el 404 como éxito):
    - `onSuccess`: `onCustomFoodDeleted?.(food.id)`, `form.setFocus("query")` (AC-N002.5), `confirming = false`,
      `target = null`. Como TanStack Query espera la invalidación del hook antes de llamar a este `onSuccess`, el
      alimento ya ha desaparecido cuando se mueve el foco.
    - `onError`: `confirming = false` (se conserva `target` para pintar el error en su elemento, AC-017.3) y foco al
      `trigger` (AC-N002.4).
  - Foco de vuelta (`focusTrigger`): `trigger.focus()` si `trigger.isConnected`; si no (la lista se desmontó),
    `form.setFocus("query")`. El foco nunca queda en `body`.
- **`useEscapeCapture(onEscape, active)` (iteración 2, F1):** con `active`, en un `useEffect` registra
  `window.addEventListener("keydown", handler, { capture: true })` y lo quita al limpiar. `handler`: si
  `event.key === "Escape"`, `event.preventDefault()`, `event.stopPropagation()` y `onEscape()` (leído de una ref para
  no volver a registrar el listener en cada render). Motivo: Radix (`DismissableLayer`, `useEscapeKeydown`) escucha
  `keydown` en `document` en captura, y la captura en `window` va antes; al detener la propagación, ni el diálogo
  «Añadir a {sección}» se cierra ni `MealPhotoDialog` abre la confirmación de descartar (026), y React tampoco recibe
  el evento. Al cerrar la confirmación el listener se quita y el siguiente Escape vuelve a llegar a Radix (segunda
  parte de AC-017.5). Solo hay una confirmación abierta a la vez (un único `target`).
- `LibraryFoodList`: `<ul aria-label={label}>`; por alimento: nombre; «Personalizado» si `kind === "custom"`; macros con
  `formatCalories`/`formatGrams` de `features/foods/format.ts`; «Elegir» (`aria-label="Elegir {nombre}"`); favorito
  (`aria-pressed`, `aria-label` «Añadir {nombre} a favoritos» o «Quitar {nombre} de favoritos», icono `Star` de
  `lucide-react`, ya instalado); en los propios, «Borrar» (`aria-label="Borrar {nombre} de tus alimentos"`). Clave
  React `${kind}:${id}`. (iteración 2) «Borrar» llama a `onDelete(food, event.currentTarget)` (solo existe con
  `kind === "custom"`, así el tipo se estrecha a `CustomLibraryFood`) y, al final de cada `<li>`, se pinta
  `renderInline?.(food)`.

**Frontend · `AddFoodDialog` (REQ-013 a REQ-017):** paso `search` = `FoodSearchPanel` con `actions` = «Cancelar»; el
diálogo guarda la última consulta (`onQueryChange`) para que «Volver a la búsqueda» la recupere (la caché de TanStack
Query devuelve los resultados sin pedirlos otra vez). Paso `portion`: nombre, «Personalizado» si es propio,
`PortionForm` con `defaultGrams` recibido; envía `{ catalog_id }` o `{ custom_food_id }` (AC-016.1). Paso `custom`:
`CustomFoodForm` con el nombre recibido. `useAddMealItems` invalida además `foodLibraryKeys.all`.

**Frontend · `CustomFoodForm` (AC-016.2, AC-016.3):** muestra `CUSTOM_FOOD_LIBRARY_NOTICE` en todos sus usos. El 400
del límite ya sale como mensaje del servidor con `saveErrorMessage`, y el formulario no se desmonta.

**Frontend · `PhotoReview` (REQ-018, REQ-019, NFR-003):**
- `defaultValues: { entries: initialEntries.map(withEntryKey) }`; `useFieldArray` para `append`, `update` y `remove`.
- Se quita `form.watch`. `const watched = useWatch({ control: form.control, name: "entries" })` y
  `const entries = mergeProposalEntries(fields as ProposalFormEntry[], watched)`: por cada `field`, si hay un valor
  observado con la misma `key`, toma sus `grams`; si no, los del `field`. Toda entrada que se añade o sustituye pasa
  por `withEntryKey` (clave nueva), así un valor obsoleto de `useWatch` nunca se aplica a otra fila. La clave sale de un
  contador del módulo (`proposal.ts`).
- Vistas: `list`; `search` (`{ name: "search", index: number | null }`, `null` = añadir) con `FoodSearchPanel`
  (`initialQuery` = nombre del alimento sin coincidencia o vacío, `actions` = «Volver a la propuesta» y, desde la
  iteración 2, `onCustomFoodDeleted`); `custom`
  (`{ index: number | null, name, grams }`). Elegir: al resolver, `update(index, withEntryKey(libraryEntry(food,
  String(current.grams))))`; al añadir, `append(withEntryKey(libraryEntry(food, defaultGrams)))`. Crear desde la
  búsqueda: al añadir, formulario con el nombre buscado y gramos vacíos; al resolver, con el nombre y los gramos del
  alimento sin coincidencia (AC-018.6). «Añadir a la propuesta» hace `append` o `update` con `customEntry`.
- `libraryEntry`: catálogo → `{ kind: "catalog", catalogId, name, per100g, grams, tag: "user" }` (etiqueta «Añadido
  por ti», lo que hacía `catalogEntry`, que se retira en la iteración 2); propio → `{ kind: "custom", customFoodId: id,
  name, per100g, grams }` (etiqueta «Personalizado»).
- **(iteración 2, F6)** `useForm<ProposalFormValues>({ resolver: zodResolver(proposalReviewSchema), defaultValues })` y
  `mergeProposalEntries(fields, watched)`: `fields` ya es `ProposalFormEntry & { id }`, así que sobran `as never` y
  `as unknown as`.
- **(iteración 2, F7, Q12)** la vista `search` pasa a `FoodSearchPanel`
  `onCustomFoodDeleted={(id) => forgetCustomFood(id)}`; `forgetCustomFood` lee `form.getValues("entries")` (valores
  actuales, gramos incluidos; `getValues` no es `watch` y no suscribe a nada) y, por cada índice en que
  `unlinkCustomFood(entry, id)` devuelve una entrada, hace `update(index, withEntryKey(unlinked))`. La fila conserva
  nombre, valores, gramos y «Personalizado» y, sin `customFoodId`, `proposalItems` la envía con `name`, `grams` y
  `per_100g` (AC-018.7); `POST /api/meals` la vuelve a guardar en la biblioteca (REQ-001). Si el borrado se hizo en
  otro sitio, el 400 «No encontramos ese alimento.» ya sale con `saveErrorMessage` en `MealPhotoDialog` y la propuesta
  se conserva, como cualquier error de guardado de la 025 (AC-018.8; sin cambios de código, solo test nuevo).

**Frontend · retirada (REQ-020):** se borran `FoodsPage.tsx` y su test, `FoodResultList.tsx`, `FoodSearchForm.tsx`
(sustituido por la caja del panel), `foods/hooks.ts` y `ProposalSearchStep.tsx`. En la iteración 1 se conservaban
`foods/api.ts` (en la iteración 2 se borra, ver el párrafo siguiente),
`foods/schemas.ts`, `foods/format.ts`, `foods/searchError.ts` y `foods/types.ts` (los usan el diario o los mocks de las
pruebas de rutas). `router.tsx` no cambia: `/foods` sigue redirigiendo a `/diary`.

**Frontend · retirada ampliada (iteración 2, F5, REQ-020):** el diario ya solo busca con `FoodSearchPanel`, así que
quedan sin uso, salvo en tests, y se borran:
- `features/catalog/` entero: `api.ts` (`searchCatalog`), `hooks.ts` (`useCatalogSearch`), `components/CatalogResultList.tsx`
  y su test, y también `schemas.ts` (con su test) y `types.ts`, que solo usaban `api.ts`, `catalogEntry` y
  `src/test/catalogFixtures.ts`.
- `features/foods/api.ts` (`searchFoods`); de `features/foods/schemas.ts`, `foodSearchResponseSchema`; de
  `features/foods/types.ts`, `FoodPer100g`, `Food` y `FoodSearchResponse`. Se conservan `foodSearchFormSchema` y los
  mensajes de la consulta (los usa el panel), `FoodDataType` (lo usan `diary/types.ts` y `foods/format.ts`),
  `foods/format.ts` y `foods/searchError.ts`.
- `catalogEntry` de `diary/proposal.ts` y `src/test/catalogFixtures.ts` (`makeCatalogFood`).
- Los `vi.mock("@/features/catalog/api", …)` y `vi.mock("@/features/foods/api", …)` de los tests y sus aserciones
  «no se llamó» (ver la sección 5, «Iteración 2»).
El backend no cambia: `GET /api/foods/search` y `GET /api/catalog/search` se conservan («Fuera de alcance» y REQ-006).

**Frontend · Política de privacidad (REQ-021):** solo el `<li>` «Diario de comidas:» añade «los alimentos
personalizados que guardas para reutilizarlos y los que marcas como favoritos»; `updatedAt="27 de octubre de 2026"`.
No se menciona «favoritos» en «Actividad en la app» ni en «Para qué usamos tu información» (los guardas de la 012 lo
prohíben).

### 3.4 Interfaz de usuario
- **Diálogo «Añadir a {sección}»:** caja «Buscar alimento» (ejemplo «Ej.: arroz blanco cocido, banano»), sin botón
  «Buscar». Debajo, la región de estado; con la caja vacía, «Favoritos» y «Recientes»; al escribir, «Resultados». Pie:
  «Crear alimento personalizado» y «Cancelar». Al elegir: nombre (y «Personalizado»), «Gramos» y vista previa.
- **Propuesta de foto:** «Añadir otro alimento» y «Buscar» de un alimento sin coincidencia abren el mismo panel con
  «Volver a la propuesta»; «Crear alimento personalizado» abre el formulario con «Añadir a la propuesta». Las filas y el
  total se recalculan en cada cambio.
- **Confirmación de borrado (iteración 2):** en línea, dentro del elemento del alimento en la lista donde se pulsó
  «Borrar», con borde destructivo, el título, el texto, «Borrar» y «Cancelar» de la sección 6 de la spec; no tapa ni
  oculta el resto de la búsqueda. Escape la cierra como «Cancelar». Si el borrado falla, se cierra y el elemento muestra
  «No se pudo borrar el alimento.».
- Validación: zod para la consulta (`foodSearchFormSchema`), para las respuestas (`food-library/schemas.ts`) y para los
  formularios existentes (Art. P3.2).

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `MealService._save_custom_foods` y `add_items`; `custom_food_name_key`; `CustomFoodRepository`; `custom_foods` con `uq_custom_foods_user_id_name_key`; `custom_food_id` en `_serialize_item` |
| REQ-002 | `MAX_CUSTOM_FOODS` y `CUSTOM_FOODS_LIMIT_MESSAGE`; comprobación en `_save_custom_foods` antes de escribir |
| REQ-003 | `LibraryItemInput` en `parse_items`; `MealService._load_custom_foods`; `_load_foods` filtrado por `UsdaItemInput` |
| REQ-004 | `FoodLibraryService.delete_custom_food`; `DELETE /api/food-library/custom/<id>`; FK `ON DELETE SET NULL` y `CASCADE` |
| REQ-005 | Migración `e6a8c0d2f4b7` (relleno en `upgrade()`) |
| REQ-006 | `query_forms` («-ces»), `edit_distance`, `prefix_edit_distance`, `typo_tolerance`, `typo_distance`, `rank_candidates`; `rank_catalog` (y así `GET /api/catalog/search`) |
| REQ-007 | `FoodLibraryService.search`; `GET /api/food-library/search`; `library_food_to_json` |
| REQ-008 | `MealRepository.list_recent_foods`; `FoodLibraryService.recent`; `GET /api/food-library/recent` |
| REQ-009 | `FoodLibraryService.add_favorite` / `remove_favorite`; `food_favorites`; rutas `PUT`/`DELETE …/favorites/{catalog,custom}/<id>`; (iteración 2) `_visible_favorite_count` y `remove_favorite` de un favorito retirado (AC-009.6 a AC-009.8) |
| REQ-010 | `FoodLibraryService.favorites`; `GET /api/food-library/favorites` |
| REQ-011 | `@require_auth` en todas las rutas de `food_library_routes.py` |
| REQ-012 | `RemovedItemSnapshot.custom_food_id`, `snapshot_payload`/`parse_snapshot_payload` con `cf`, `MealService.restore_item` |
| REQ-013 | `FoodSearchPanel` + `useDebouncedValue` + `useFoodLibrarySearch`; `AddFoodDialog` y `PhotoReview` lo usan |
| REQ-014 | `FoodSearchPanel` (listas con la caja vacía), `useRecentFoods`, `useFavoriteFoods`, `gramsText`; invalidación en `useAddMealItems` |
| REQ-015 | `LibraryFoodList` (etiqueta, botón de favorito), `useSetFoodFavorite`, `favoriteErrorMessage` |
| REQ-016 | `AddFoodDialog` (paso `portion` con `custom_food_id`), `CustomFoodForm` (`CUSTOM_FOOD_LIBRARY_NOTICE`), `saveErrorMessage` |
| REQ-017 | `LibraryFoodList` («Borrar», `renderInline`), `DeleteConfirmation` en línea de `FoodSearchPanel`, `useEscapeCapture` (iteración 2: AC-017.5, AC-017.6), confirmación dentro del `<li>` de su lista (AC-017.7), `useDeleteCustomFood`, `DELETE_CUSTOM_FOOD_FAILED_MESSAGE` |
| REQ-018 | `PhotoReview` (vistas `search` y `custom`), `libraryEntry`, `proposalItems` con `customFoodId`; (iteración 2) `onCustomFoodDeleted` + `unlinkCustomFood` (AC-018.7) y `saveErrorMessage` de `MealPhotoDialog` sin cambios (AC-018.8) |
| REQ-019 | `PhotoReview` con `useWatch` + `mergeProposalEntries` + `withEntryKey` |
| REQ-020 | Retirada de `FoodsPage`, `FoodResultList`, `FoodSearchForm`, `foods/hooks.ts`; `router.tsx` sin cambios; (iteración 2) retirada de `features/catalog/`, `foods/api.ts`, `foodSearchResponseSchema`, los tipos de la respuesta de USDA, `catalogEntry` y `catalogFixtures.ts` |
| REQ-021 | `PrivacyPolicyPage.tsx` |
| NFR-001 | `FoodLibraryService` sin `embedding_client` ni `rate_limiter` |
| NFR-002 | Región `role="status"` del panel, `aria-label` de las listas y botones, `aria-pressed` del favorito; (iteración 2) foco de la confirmación: «Cancelar» al abrir, `focusTrigger` al cancelar, con Escape o tras un fallo, `form.setFocus("query")` tras un borrado correcto (AC-N002.3 a AC-N002.5) |
| NFR-003 | `PhotoReview.tsx` sin `form.watch` (`useWatch`) |
| NFR-004 (iteración 2) | `TypoDistances` (memoria por pareja, formas cortas con `startswith`, descarte por longitud), `TypoSearchStats`, `typo_comparison_bound`, `stats` en `rank_candidates`, `rank_catalog`, `CatalogSearchService.search` y `FoodLibraryService.search` |
| F6 y F8 (internos, sin REQ) | `proposalReviewSchema` sin `as never` (F6); este plan y la ADR-0036 con la confirmación en línea (F8) |

## 5. Estrategia de pruebas

**Entorno:** Postgres de prueba (`TEST_DATABASE_URL`, `docker compose up -d postgres redis`, puerto 5433) para el
backend; Vitest con jsdom para el frontend. Ningún test llama a servicios externos (Art. B5.4).

### backend
- **Aislamiento (Art. P1.backend.3):** unitarios con fakes escritos a mano e inyectados por constructor; sin
  `unittest.mock` ni `monkeypatch`. Fakes nuevos en `backend/tests/fakes.py`:
  - `make_custom_food(id, user_id, name, calories_kcal=…, protein_g=…, carbs_g=…, fat_g=…)` (`SimpleNamespace` con
    `name_key` calculada con `custom_food_name_key`);
  - `FakeCustomFoodRepository` (en memoria, filtra por usuario; `create` asigna id creciente; `deleted` y `created` para
    las aserciones; implementa todos los métodos de la sección 3.2);
  - `FakeFoodFavoriteRepository` (`list_by_user`, `get_for_food`, `create`, `delete`; `count_by_user` se quita en la
    iteración 2);
  - `FakeMealRepository.list_recent_foods(user_id, limit)` que devuelve las filas precargadas en `recent_rows`.
  Se reutilizan `FakeUnitOfWork`, `FakeLockingUserRepository`, `FakeCatalogFoodRepository`, `make_catalog_food`,
  `FakeClock` y `RestoreTokenSigner` real.
- **Unitarios:**
  - `test_food_library_rules.py`: `custom_food_name_key` (AC-001.2, AC-001.4, AC-001.10), `parse_custom_food_id`
    (AC-003.2, AC-004.3).
  - `test_catalog_search_service.py` (ampliado): `edit_distance`, `prefix_edit_distance`, `typo_tolerance`,
    `query_forms` con «-ces», `rank_catalog` y `rank_candidates` con los casos de AC-006.1 a AC-006.11 (datos «solo para
    la prueba» con `make_catalog_food`), y el orden catálogo antes que propio con el mismo nombre (AC-007.3).
  - `test_food_library_service.py`: búsqueda conjunta con favoritos y ajenos (AC-007.1 a AC-007.5, AC-007.7), recientes
    con valores actuales y `last_grams` y omisiones (AC-008.1, AC-008.4, AC-008.8), favoritos (AC-009.1 a AC-009.4,
    AC-010.1, AC-010.2), borrado (AC-004.2, AC-004.3) y que no usa proveedores (AC-N001.1, con un servicio construido
    sin ellos).
  - `test_meal_service.py` (ampliado): guardar o actualizar en la biblioteca (AC-001.1, AC-001.2, AC-001.4 a AC-001.7,
    AC-001.10), límite (AC-002.1 a AC-002.3), alimento por id (AC-003.1 a AC-003.5), restaurar con `cf`
    (AC-012.1, AC-012.2).
  - `test_meal_rules.py` (ampliado): `parse_items` con `custom_food_id` y mezclas (AC-003.2, AC-003.3, AC-003.5);
    `snapshot_payload` con y sin `cf` y `parse_snapshot_payload` que rechaza `cf` no válido o en otro origen.
  - `test_food_library_migration.py` (patrón de `test_catalog_migration.py` y `tests/migration_helpers.py`):
    `run_downgrade` y después datos insertados con SQL (`created_at` explícitos del 1 y del 5 de octubre) y `run_upgrade`,
    todo dentro de la transacción de la prueba con `rollback()` final (AC-005.1 a AC-005.3); y que el `downgrade` quita
    la columna y las tablas.
- **Integración** (`client`, usuarios registrados por la API como en `test_meal_routes.py`):
  - `test_food_library_routes.py`: REQ-004 (AC-004.1 a AC-004.4), REQ-006 por la búsqueda conjunta (AC-006.1 a
    AC-006.11 con un catálogo cargado como en `test_meal_routes.py`), REQ-007 (AC-007.1 a AC-007.7), REQ-008 (AC-008.1
    a AC-008.8; para AC-008.4 se quita un alimento de `catalog_foods` con la sesión), REQ-009 (AC-009.1 a AC-009.5),
    REQ-010 (AC-010.1 a AC-010.3), REQ-011 (AC-011.1 en las ocho rutas, sin token y con uno caducado firmado con
    `jwt_manager`), NFR-001 (AC-N001.1 con `FakeVoyageClient` instalado en `embedding_client.client` y `calls == []`;
    AC-N001.2 con 60 búsquedas).
  - `test_meal_library_routes.py`: REQ-001 (AC-001.1 a AC-001.10; AC-001.8 con el patrón de dos hilos y la fila del
    usuario bloqueada desde otra conexión de `test_password_reset_routes.py`), REQ-002, REQ-003, REQ-012 (AC-012.1,
    AC-012.2) y AC-001.9.
  - `test_catalog_routes.py` (ampliado): AC-006.12 (`q=aroz` con el formato de la 023).
- **Tests existentes cuyo comportamiento sustituye la spec aprobada** (se reescriben con el marcador de la 028, no se
  debilitan, Art. B5.3):
  - `test_catalog_search_service.py::test_search_does_not_tolerate_typos` (023 AC-004.16, sustituido por AC-006.2):
    pasa a afirmar que `guevos` y `huevoz` sí encuentran «Huevo cocido».
  - `test_meal_routes.py::test_post_response_has_the_full_contract_shape`: el conjunto exacto de claves del alimento
    incluye `custom_food_id` (sección 6 de la spec).
- **Marcadores:** `# SDD: 028 REQ-… AC-…` (Art. P1.1).

### frontend
- **Aislamiento (Art. P1.frontend.4):** `vi.mock("@/features/food-library/api", …)` con `searchFoodLibrary`,
  `getRecentFoods`, `getFavoriteFoods`, `setFoodFavorite` y `deleteCustomFood`, y `vi.mock("@/features/diary/api", …)`
  como hoy. Los tests que abren el diálogo de añadir o la propuesta (`AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`,
  `DiaryPage.test.tsx` y, si la abre, `mealPhotoRoute.test.tsx`) añaden ese mock. El retardo se prueba con
  `vi.useFakeTimers({ shouldAdvanceTime: true })` y `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`; las
  carreras (AC-013.3), con promesas controladas a mano.
- **Unitarios:**
  - `lib/useDebouncedValue.test.ts`: retardo, reinicio en cada cambio y `flush` inmediato (AC-013.2, AC-013.6).
  - `food-library/api.test.ts` (mock de `apiClient`): rutas, métodos, `encodeURIComponent` y validación con zod.
  - `diary/proposal.test.ts`: `libraryEntry`, `withEntryKey`, `mergeProposalEntries` (valor observado por clave, entrada
    nueva sin observar, observados obsoletos tras quitar) y `proposalItems` con `customFoodId` (AC-018.4, AC-019.1 a
    AC-019.4).
  - `diary/schemas.test.ts`: `custom_food_id` en `mealResponseSchema` (con `null` por defecto).
- **Componentes:**
  - `FoodSearchPanel.test.tsx`: REQ-013 (AC-013.1 a AC-013.8), REQ-014 (AC-014.1 a AC-014.4), REQ-015 (AC-015.1 a
    AC-015.5), REQ-017 (AC-017.1 a AC-017.4), NFR-002 (AC-N002.1, AC-N002.2).
  - `AddFoodDialog.test.tsx` (se reescribe sobre el panel): AC-013.9, AC-014.5, AC-014.6, REQ-016 (AC-016.1 a
    AC-016.3). Los casos de la 023 que siguen vigentes (elegir, porción, personalizado, errores al guardar) se adaptan a
    la búsqueda nueva (escribir e Intro en lugar del botón) y conservan su marcador.
  - `MealPhotoDialog.test.tsx` (ampliado): REQ-018 (AC-018.1 a AC-018.6), REQ-019 (AC-019.1 a AC-019.4) y AC-013.9 en la
    propuesta; las búsquedas existentes de la 025 pasan al mock de `food-library`.
  - `PhotoReview.source.test.ts`: AC-N003.1 como escaneo del código (`?raw`): `PhotoReview.tsx` no llama a
    `form.watch`/`.watch(`; el `verifier` además ejecuta `npm run lint`.
  - `PrivacyPolicyPage.test.tsx`: AC-021.1. El test «la última actualización es la del 22 de octubre de 2026» (025) se
    reescribe con la fecha nueva (sustituido por REQ-021).
  - `foodsRoute.test.tsx`: AC-020.1 (se añade el marcador 028 al test existente de `/foods` → `/diary` o un test nuevo).
- **Tests que se borran:** `features/foods/pages/FoodsPage.test.tsx`, con el código que prueba (REQ-020 y Q7 retiran la
  pantalla; Art. B5.3 no aplica a tests de código retirado por la spec).
- **Marcadores:** `// SDD: 028 REQ-… AC-…`; nombres en español (Art. P1.frontend.3).

### Iteración 2: tests que cambian y tests nuevos
Mismo entorno y mismo aislamiento que arriba (fakes a mano en el backend; `vi.mock` de los `api.ts` en el frontend). Sin
dobles nuevos: en el backend bastan `FakeCatalogFoodRepository`, `FakeCustomFoodRepository`, `FakeFoodFavoriteRepository`,
`make_catalog_food`, `make_custom_food` y `make_favorite`; en el frontend, los mocks de `@/features/food-library/api` y
`@/features/diary/api` y las fábricas de `src/test/foodLibraryFixtures.ts`. El catálogo de la 023 que piden los AC de
NFR-004 se lee, solo para leer, con `read_catalog_csv` (`services/catalog_csv_reader.py`) de
`backend/scripts/data/food_catalog.csv` y se convierte con `make_catalog_food`; los 500 alimentos propios se generan en
el test con nombres deterministas de 2 a 5 palabras.

**Tests existentes de la 028 que cambian porque la spec cambió en la iteración 2** (Art. B5.3: se adaptan, no se
debilitan; conservan su marcador y añaden el del AC nuevo si aplica):
- backend:
  - `test_food_library_service.py`: `hundred_favorites()` y los dos tests que lo usan con el catálogo de solo «Banano»
    o «Fruta 000» (`test_add_favorite_with_100_favorites_is_rejected_with_the_limit_message` y
    `test_add_favorite_that_already_is_a_favorite_works_with_100_favorites`): las 100 frutas deben estar **en el
    catálogo** del `Env`, porque desde AC-009.6 los favoritos retirados no cuentan.
  - `test_food_library_routes.py`: `test_marking_a_new_food_with_100_favorites_is_400_and_an_existing_one_is_204` y
    `test_a_favorite_can_be_marked_again_after_removing_one_at_the_limit` siembran con `seed(app, …)` las 100 frutas,
    no solo «fruta-000», por el mismo motivo.
  - `tests/fakes.py`: `FakeFoodFavoriteRepository.count_by_user` se quita, como el método real.
- frontend:
  - `FoodSearchPanel.test.tsx`, «si el borrado falla muestra «No se pudo borrar el alimento.» y el alimento sigue en la
    lista» (AC-017.3): tras el fallo ya **no** hay `alertdialog` (AC-N002.4: el borrado que falla cierra la
    confirmación); el mensaje se busca dentro del elemento de «Gallo pinto» de «Resultados», que sigue en la lista.
  - `AddFoodDialog.test.tsx`: se quitan `import { searchCatalog }`, `import { searchFoods }`, sus `vi.mock`, los
    `catalogSearchMock`/`usdaSearchMock` y las dos aserciones «no se llamó» del test que comprueba la búsqueda nueva
    (sigue comprobando `searchFoodLibrary`). Motivo: REQ-020 ampliado borra esos módulos.
  - `MealPhotoDialog.test.tsx`: igual con `searchCatalog`, `catalogSearchMock` y su aserción «no se llamó».
  - `foodsRoute.test.tsx` y `mealPhotoRoute.test.tsx` (028): se quitan los `vi.mock` de `@/features/catalog/api` y
    `@/features/foods/api`, y el comentario de `foodsRoute.test.tsx` que decía que `foods/api.ts` se conservaba.
  - `proposal.test.ts`: los tests de la 025 sobre `catalogEntry` («catalogEntry y customEntry», la etiqueta «Añadido
    por ti» y el que vuelve a añadir «Arroz blanco cocido») pasan a `libraryEntry` con un alimento del catálogo de
    `makeLibraryFood`, con el mismo resultado esperado; se quita el import de `catalogFixtures`. Conservan su marcador
    de la 025 y añaden `// SDD: 028 REQ-020`.
- Otro test existente que cambia sin ser de la 028: `src/app/diaryRoute.test.tsx` quita el `vi.mock` de
  `@/features/foods/api` (el módulo deja de existir; ninguna aserción cambia).
- **Se borran** con su código (REQ-020; Art. B5.3 no aplica a tests de código retirado por la spec):
  `features/catalog/components/CatalogResultList.test.tsx` y `features/catalog/schemas.test.ts`, y la fábrica
  `src/test/catalogFixtures.ts`.

**Tests nuevos (iteración 2):**
- backend · unitarios:
  - `test_catalog_search_service.py`: `TypoDistances.within_tolerance` (forma de 3 caracteres: `startswith` y 0
    comparaciones; palabra demasiado corta: `None` y 0 comparaciones; la misma pareja dos veces: 1 comparación;
    distancia por encima de la tolerancia: `None`); `typo_comparison_bound` con un catálogo pequeño y un valor
    calculado a mano; con el catálogo de la 023 (`rank_catalog` y `stats`): la consulta de AC-N004.1 da `[]`,
    `comparisons ≤ typo_comparison_bound` e igual que con `arroces qzxw` (AC-N004.2, parte de `GET /api/catalog/search`),
    `arroces integrale` incluye «Arroz integral cocido» dentro de la cota y `arroz` y `pam` hacen 0 comparaciones
    (AC-N004.3). Los tests de REQ-006 de la iteración 1 siguen igual y prueban que el orden no cambia.
  - `test_food_library_service.py`: AC-009.6 (99 visibles más uno retirado: marcar uno nuevo crea el favorito y
    `favorites()` devuelve 100 con el nuevo); AC-009.7 (quitar un favorito retirado lo borra y confirma; con el
    alimento de vuelta en el catálogo del fake, `favorites()` no lo trae); AC-009.8 (id válido que no está en el
    catálogo ni en los favoritos del usuario, aunque sí en los de otro: 404 y los del otro intactos); AC-N004.1 a
    AC-N004.3 en la búsqueda conjunta (`search(USER, q, stats=…)`, catálogo de la 023 y 500 propios).
- backend · integración:
  - `test_food_library_routes.py`: AC-009.6 a AC-009.8 por HTTP (retirar con `delete(CatalogFood)` en la sesión y
    devolver con `seed`, como el test existente de AC-010.2); AC-N004.1 por HTTP: la consulta de 100 caracteres
    responde 200 con `results` vacío.
  - `test_catalog_routes.py`: AC-N004.2 por HTTP: la misma consulta en `GET /api/catalog/search` responde 200 con
    `results` vacío y el formato de la 023.
- frontend · unitarios:
  - `src/lib/useEscapeCapture.test.ts` (nuevo, con `renderHook`): activo, Escape llama a `onEscape`, marca
    `defaultPrevented` y no llega a un listener de captura en `document` (como el de Radix); otras teclas pasan;
    inactivo o desmontado, no hace nada (AC-017.5, AC-017.6).
  - `proposal.test.ts`: `unlinkCustomFood` (la fila del id borrado sin `customFoodId` ni `key`, con nombre, valores y
    gramos; otro id, una fila del catálogo o una sin coincidencia → `null`) y `proposalItems` de la fila desvinculada
    con `name` y `per_100g` (AC-018.7).
  - `schemas.test.ts`: `proposalReviewSchema` rechaza una entrada sin `key`, conserva `key` y `customFoodId` y da los
    mismos mensajes de gramos que `proposalFormSchema` (F6).
  - `PhotoReview.source.test.ts`: `PhotoReview.tsx` no contiene `as never` ni `as unknown as` y usa
    `proposalReviewSchema` (F6; el `verifier` además ejecuta `npx tsc -b`). Marcador `// SDD: 028 NFR-003 AC-N003.1`
    (es el archivo de la propuesta y la deuda que dejó la 025).
- frontend · componentes:
  - `FoodSearchPanel.test.tsx`: Escape con la confirmación abierta la cierra sin petición, conserva el texto y el
    alimento (AC-017.5, parte del panel); con «Gallo pinto» en «Favoritos» y «Recientes», «Borrar» de «Recientes» pinta
    el `alertdialog` dentro del elemento de «Recientes» y no en «Favoritos», y las dos listas siguen accesibles por rol
    (AC-017.7); foco en «Cancelar» al abrir (AC-N002.3); foco en «Borrar Gallo pinto de tus alimentos» de «Recientes»
    tras «Cancelar», tras Escape y tras un borrado que falla (AC-N002.4); foco en «Buscar alimento» tras un 204
    (AC-N002.5); `onCustomFoodDeleted` con el id tras un 204 o un 404 y no tras un fallo.
  - `AddFoodDialog.test.tsx`: AC-017.5 completo: con «gallo» y la confirmación abierta, Escape deja el diálogo «Añadir a
    {sección}» abierto con «gallo» y «Gallo pinto»; un segundo Escape lo cierra (`onClose`).
  - `MealPhotoDialog.test.tsx`: AC-017.6 (Escape en la búsqueda de «Añadir otro alimento» con la confirmación abierta:
    sin borrado, sin la confirmación de descartar de la 026 y con la búsqueda y su texto visibles); AC-018.7 (elegir
    «Gallo pinto» propio con 250 g, borrarlo desde «Añadir otro alimento», volver y guardar: la fila sigue con
    «Personalizado» y se envía `{name, grams: 250, per_100g}` sin `custom_food_id`); AC-018.8 (guardar con 400 «No
    encontramos ese alimento.»: se ve el mensaje y la propuesta conserva sus dos filas, gramos y total).
  - `foodsRoute.test.tsx`: `// SDD: 028 REQ-020` «el código sin uso de la búsqueda de la 023 y de USDA ya no existe»
    (`import.meta.glob` de `features/catalog/**`, `features/foods/api.ts` y `src/test/catalogFixtures.ts` vacío) y
    escaneo `?raw` de `diary/proposal.ts` (sin `catalogEntry`), `foods/schemas.ts` (sin `foodSearchResponseSchema`) y
    `foods/types.ts` (sin `FoodSearchResponse`).
- **Cobertura de los AC nuevos:** AC-009.6 a AC-009.8, AC-017.5 a AC-017.7, AC-018.7, AC-018.8, AC-N002.3 a AC-N002.5 y
  AC-N004.1 a AC-N004.3 tienen al menos un test; REQ-020 ampliado, el suyo de `foodsRoute.test.tsx`; F6, el escaneo y
  `tsc`.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| `useWatch` devuelve valores obsoletos tras `update()` y los totales quedan mal (lo que pasó en la 025) | Media | Alto | Gramos emparejados por `key` en `mergeProposalEntries` y clave nueva en cada entrada sustituida; tests de AC-019.x en `proposal.test.ts` y `MealPhotoDialog.test.tsx` |
| La clave de nombre de la migración y la del servicio divergen y el relleno crea duplicados que el servicio no encuentra | Baja | Medio | Copia literal de la misma regla; test de migración con «Gallo pinto»/«gallo pinto» (AC-005.1) y test de servicio con los mismos casos |
| Consulta de recientes lenta con muchos alimentos | Baja | Bajo | Ventana por usuario sobre `meals` (índice único por `user_id`) y `ix_meal_items_meal_id`; volumen personal |
| Escaneos de la 012 (`test_no_catalog_leftovers.py`, `noRetiredSections.test.ts`) prohíben la cadena `/api/favorites` | Media | Medio | Las rutas son `/api/food-library/favorites`; no escribir nunca `/api/favorites` en código ni comentarios |
| Tests existentes que abren el diálogo de añadir sin mock de `food-library` hacen peticiones reales o fallan | Alta | Medio | Lista de archivos en la sección 5; el `test-author` añade el mock |
| Pruebas con temporizadores falsos y `userEvent` inestables | Media | Bajo | `shouldAdvanceTime` y `advanceTimers` de `userEvent`; sin esperas reales |
| Despliegue sin aplicar la migración: `POST /api/meals` falla por la columna `custom_food_id` | Media | Alto | Paso manual antes del merge en `docs/deploy-runbook.md` (doc-keeper), como la 022 y la 023 |
| (iteración 2) El listener de Escape en captura sobre `window` se queda registrado o se traga Escape fuera de la confirmación | Baja | Medio | Solo existe mientras `DeleteConfirmation` está montada (limpieza del `useEffect`); tests de `useEscapeCapture` (desmontado e inactivo) y la segunda parte de AC-017.5 (el segundo Escape cierra el diálogo) |
| (iteración 2) El descarte por longitud o la memoria de distancias cambian resultados u orden de REQ-006 | Baja | Alto | El descarte es una cota inferior exacta de la distancia; la memoria devuelve el mismo valor; la suma recorre las palabras con repeticiones como hoy. Los tests de AC-006.x de la iteración 1 siguen sin cambios |
| (iteración 2) Los tests congelados que se adaptan se debilitan sin querer | Media | Medio | Lista cerrada en la sección 5 («Iteración 2») con el motivo de cada cambio; solo se cambia lo que la spec cambió (límite de favoritos visibles, error de borrado fuera de la confirmación, módulos retirados) |
| (iteración 2) `proposalReviewSchema` y `proposalFormSchema` divergen en la validación de gramos | Baja | Medio | Comparten variantes y `superRefine`; test de `schemas.test.ts` con los mismos mensajes en los dos |
| (iteración 2) El foco de vuelta apunta a un botón que ya no está (la lista cambió mientras la confirmación estaba abierta) | Baja | Bajo | `focusTrigger` comprueba `isConnected` y, si no, enfoca la caja de búsqueda |

## 7. Cumplimiento de la constitución
- **Art. B1/B4/B5:** todos los REQ y NFR mapeados (sección 4) y todos los AC con test previsto (sección 5). Tests antes
  de la implementación; esqueletos con las firmas de 3.2. Los tests existentes que se reescriben lo hacen porque la spec
  aprobada sustituye ese comportamiento (023 AC-004.16, botón «Buscar» de la 023 REQ-009, fecha de la Política,
  contrato del alimento de `/api/meals`); no se debilitan. Se borra `FoodsPage.test.tsx` junto al código que la spec
  retira (REQ-020).
- **Art. B5.7:** sin errores de lint nuevos; NFR-003 quita un aviso existente.
- **Art. P1:** marcadores con `028`; fakes a mano sin `unittest.mock` ni `monkeypatch`; mocks en la capa `api.ts`.
- **Art. P2.backend:** capas respetadas; servicios con dependencias por constructor y `_build_*_service()`; solo
  `UnitOfWork` hace commit (`CustomFoodRepository.create` solo hace `flush`); errores con `ValidationError` y
  `ResourceNotFoundError`; migración incluida y revisada a mano (P2.4, P4); se reutilizan `fold`, `words`,
  `word_forms`, `match_group`, `normalize_query`, `is_db_id`, `is_catalog_id`, `RestoreTokenSigner` y el bloqueo de
  la fila del usuario.
- **Art. P2.frontend:** feature `food-library` con `api.ts`, `hooks.ts`, `types.ts` y `schemas.ts`, sin `components/`
  ni `pages/` porque es solo de datos (la interfaz pertenece al diario y vive en `diary/components/`, lo que evita una
  dependencia en los dos sentidos entre features); HTTP solo por `apiFetch`; TanStack Query y react-hook-form con zod.
- **Art. P3:** las ocho rutas con `@require_auth` y filtradas por el `user_id` del token; entradas validadas en el
  servicio y con zod; sin proveedores de IA (no hace falta rate limiting, NFR-001); ORM y parámetros enlazados; sin
  variables nuevas.
- **Art. P4:** migración incluida; paso manual de producción a documentar en `docs/deploy-runbook.md`.
- **Art. P5:** la ADR-0036 queda «Propuesta»; la acepta la sesión principal con la aprobación del usuario.
- **Iteración 2:**
  - Art. B5.3: los tests congelados de la 028 que cambian lo hacen porque la spec aprobada en la iteración 2 cambió
    ese comportamiento (AC-009.6, AC-N002.4, REQ-020 ampliado); la lista y el motivo están en la sección 5. Los tests
    borrados acompañan al código que REQ-020 retira.
  - Art. P1.backend.3: la cota de NFR-004 se observa con un contador que reciben las funciones puras y los servicios
    (`stats`), sin `mock` ni `monkeypatch` ni medir tiempos.
  - Art. P2.backend.1 y P2.backend.2: la regla de favoritos visibles vive en el servicio, con los repositorios que ya
    recibe por constructor; las rutas no cambian. Se quita `FoodFavoriteRepository.count_by_user`, sin uso.
  - Art. P2.frontend.1: `useEscapeCapture` es un hook genérico sin dependencia de ninguna feature y va a `src/lib`, como
    `useDebouncedValue`. `features/catalog/` desaparece entera porque ya no tiene código en uso.
  - Art. P2.frontend.5 y B5.7: sin errores de lint nuevos; F6 quita dos aserciones de tipo.
  - Art. P3.1: sin endpoints nuevos; `DELETE …/favorites/catalog/{id}` sigue filtrando por el `user_id` del token y no
    toca favoritos de otros usuarios (AC-009.8).
  - Art. P4: sin cambios de modelo ni migración nueva; el paso manual de la `e6a8c0d2f4b7` sigue pendiente de la etapa
    docs.
- Ningún «DEBERÍA» queda sin cumplir.

## 8. ADRs
- [ADR-0036](../../docs/sdd/decisions/ADR-0036-biblioteca-de-alimentos-propios.md): biblioteca de alimentos propios,
  vínculo con `ON DELETE SET NULL`, favoritos, recientes sin estado, búsqueda en dos pasadas con distancia OSA,
  migración con relleno y propuesta de foto con `useWatch` emparejado por clave (Propuesta). En la iteración 2 se
  revisa (sigue «Propuesta»): límite de favoritos que solo cuenta los visibles y `DELETE` de favoritos retirados
  (decisión 3), cota determinista F × P con memoria y contador (decisión 5), `proposalReviewSchema` y filas que
  pierden el vínculo al borrar el alimento propio (decisión 7) y confirmación de borrado en línea con Escape en
  captura sobre `window` y foco gestionado, en lugar de `ConfirmDialog`/`confirmContainer` (decisión 9, nueva).

## 9. Iteración 3 (hallazgos F9, F10 y F11 de la review de la iteración 2)
Lo de las secciones 1 a 8 sigue vigente; esta sección solo añade o sustituye lo que se indica. La spec no cambia: F9
corrige un estado obsoleto dentro de lo que ya piden REQ-017 y NFR-002, y F10 y F11 son internos. No hay migración nueva
ni cambios de contrato HTTP, de dependencias ni de variables.

### 9.1 Impacto
| Ámbito | Archivo | Cambio |
|---|---|---|
| frontend | `frontend/src/features/diary/components/FoodSearchPanel.tsx` | F9: la confirmación de borrado (y su error) se cierra si cambia el texto de la caja o si su alimento deja de mostrarse en su lista |
| frontend | `frontend/src/features/diary/components/FoodSearchPanel.test.tsx` | F9: cinco tests nuevos (9.4) |
| frontend | `frontend/src/features/diary/schemas.ts` | F11: se retira `proposalFormSchema`; queda `proposalReviewSchema` |
| frontend | `frontend/src/features/diary/schemas.test.ts` | F11: los tests de `proposalFormSchema` pasan a `proposalReviewSchema` y un test nuevo (9.4) |
| backend | `backend/services/catalog_search_service.py` | F10: `typo_tolerance` usa `TYPO_MIN_FORM_LENGTH` |
| docs | `docs/sdd/decisions/ADR-0036-biblioteca-de-alimentos-propios.md` | Contenido de las decisiones 7 (F11) y 9 (F9); el estado y la fila del índice no cambian |

Sin cambios en `LibraryFoodList.tsx`, `useEscapeCapture.ts`, `AddFoodDialog.tsx`, `MealPhotoDialog.tsx` ni
`PhotoReview.tsx`.

### 9.2 Contratos e interfaces
- **Sin símbolos exportados nuevos**, así que no hace falta paso de esqueletos (Art. B5.6).
- **F9:** el tipo interno de `FoodSearchPanel.tsx` gana el texto de la caja en el momento de abrir la confirmación:
  ```ts
  type DeleteTarget = {
    food: CustomLibraryFood
    list: ListLabel
    trigger: HTMLButtonElement
    query: string // valor de la caja (sin recortar) al pulsar «Borrar»
  }
  ```
  Y dos funciones internas del componente, sin exportar: `isTargetShown(current: DeleteTarget): boolean` y
  `dismissDelete(): void`.
- **F10:** `TYPO_MIN_FORM_LENGTH = 4` se mueve antes de `typo_tolerance(form: str) -> int`; las firmas no cambian.
- **F11:** `schemas.ts` deja de exportar `proposalFormSchema`. `proposalReviewSchema` conserva su firma
  (`z.ZodType<ProposalFormValues, ProposalFormValues>`). `proposalEntryUnion` pasa a no recibir parámetros y fija
  `key: z.string()`, porque ya solo tiene un uso. `validateProposalGrams` y `gramsError` no cambian.

### 9.3 Lógica
**F9 · `FoodSearchPanel` (REQ-017 y NFR-002):** la confirmación pertenece a la vista en la que se abrió. Si el usuario
cambia el texto de la caja, o si su alimento deja de mostrarse en esa lista, se cierra en silencio, igual que con
«Cancelar» pero **sin mover el foco**. Así, al volver a montarse la lista, ni reaparece la confirmación ni roba el foco
hacia «Cancelar», y tampoco se repinta «No se pudo borrar el alimento.».
- `startDelete(list)` guarda además `query: form.getValues("query")`.
- `isTargetShown(current)`, calculado en el render con los mismos datos que pintan las listas:
  - `"Resultados"`: `hasResults` y `search.data` contiene un alimento con la misma `kind` e `id`;
  - `"Favoritos"`: `showLists` y `favoriteFoods` lo contiene;
  - `"Recientes"`: `showLists` y `recentFoods` lo contiene.
  TanStack Query conserva `data` mientras vuelve a pedir una consulta (por ejemplo, tras la invalidación de
  `foodLibraryKeys.all` al marcar un favorito), así que un refetch no cierra la confirmación por sí solo.
- `dismissDelete()`: `setConfirming(false)`, `setTarget(null)` y `deleteFood.reset()`. Solo si el foco se ha quedado en
  el cuerpo de la página (`document.activeElement` es `null` o `document.body`, porque el elemento enfocado se
  desmontó), `form.setFocus("query")` (NFR-002: el foco no queda en el cuerpo). En cualquier otro caso no toca el foco.
- Un `useEffect` con dependencias `[target, typed, shown, deleteFood.isPending, deleteFood.isSuccess]`, donde
  `shown = target !== null && isTargetShown(target)`:
  ```ts
  if (!target || deleteFood.isPending || deleteFood.isSuccess) return
  if (typed !== target.query || !shown) dismissDelete()
  ```
  - Con el borrado en curso no se cierra nada: no hay cancelación a medias, como con Escape (sección 3.3).
  - `isSuccess` también se excluye. Entre el éxito de la mutación y el `onSuccess` de `mutate`, el alimento ya no está
    en las listas; si el efecto llamara antes a `deleteFood.reset()`, se perdería el `onSuccess` y con él
    `onCustomFoodDeleted` (AC-018.7). Ese `onSuccess` ya deja `target = null`.
  - Al abrir, `typed === target.query` y el alimento está a la vista, así que el efecto no cierra nada.
- `confirmDelete`, `onError`: `setConfirming(false)` y, si `form.getValues("query") === current.query`,
  `focusTrigger(current)` como hasta ahora (AC-N002.4). Si el texto cambió mientras el borrado estaba en curso, no mueve
  el foco (el usuario está escribiendo) y vuelve a anclar la confirmación al texto actual:
  `setTarget({ ...current, query: form.getValues("query") })`. Así el aviso «No se pudo borrar el alimento.» se ve en
  su elemento si este sigue a la vista (AC-017.3) y, si no, el efecto lo retira.
- `onSuccess`, `cancelDelete`, `focusTrigger`, `renderInline`, `DeleteConfirmation` y `useEscapeCapture` no cambian. El
  listener de Escape se quita al desmontarse `DeleteConfirmation`, como ya pasaba.

**F10 · `catalog_search_service.py`:** `typo_tolerance` pasa a `if len(form) < TYPO_MIN_FORM_LENGTH: return 0`, y la
constante se declara antes de la función, junto a las demás de módulo. `typo_comparison_bound` ya la usa, así que la
tolerancia y la cota no pueden divergir. El comportamiento no cambia.

**F11 · `schemas.ts`:** se borra `proposalFormSchema` y el comentario «Como proposalFormSchema pero…» pasa a describir
`proposalReviewSchema` por sí mismo («Esquema del formulario de la propuesta (PhotoReview): `key` obligatoria y gramos
validados salvo en las entradas sin coincidencia.»). `PhotoReview` ya usa `proposalReviewSchema` (F6), así que no
cambia nada en producción.

### 9.4 Estrategia de pruebas
Mismo entorno y aislamiento que en la sección 5: `vi.mock("@/features/food-library/api", …)` con las fábricas de
`src/test/foodLibraryFixtures.ts` y promesas controladas a mano para el borrado en curso. **No hace falta ningún doble
nuevo** ni ningún servicio nuevo en el entorno.

**F9 · tests nuevos en `FoodSearchPanel.test.tsx`** (bloque `describe` de la iteración 3; rojo legítimo hoy porque la
confirmación reaparece, el error se repinta o el foco salta). Trazan a AC existentes, ya que no piden comportamiento
nuevo, sino que la confirmación y el foco de REQ-017 y NFR-002 sigan siendo correctos cuando cambia la vista:
1. `// SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3` «si se escribe con la confirmación abierta en «Favoritos» y se
   vuelve a vaciar la caja, «Favoritos» vuelve sin la confirmación y el foco sigue en «Buscar alimento»». Con «Gallo
   pinto» en «Favoritos», pulsar su «Borrar», escribir «ar» en la caja (las listas se ocultan) y vaciarla. Comprueba
   que no hay ningún `alertdialog`, que el foco está en el campo «Buscar alimento» y que `deleteCustomFood` no se llamó.
2. `// SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3` «si cambia la consulta con la confirmación abierta en
   «Resultados» y «Gallo pinto» vuelve a aparecer, sale sin la confirmación». Con «gallo» y la confirmación abierta,
   escribir « p» y volver a «gallo» (pasado el retardo, «Gallo pinto» vuelve a «Resultados»). Mismas comprobaciones que
   el test 1.
3. `// SDD: 028 REQ-017 AC-017.3 AC-017.7` «el aviso «No se pudo borrar el alimento.» no reaparece tras ocultar y
   volver a mostrar la lista». Con un borrado que falla en «Favoritos», el aviso está en su elemento (como hoy); tras
   escribir «ar» y vaciar la caja, «Gallo pinto» sigue en «Favoritos» sin el aviso.
4. `// SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3` «si el alimento sale de «Favoritos» con la confirmación abierta y
   vuelve, sale sin la confirmación». Con la confirmación abierta en «Favoritos», pulsar «Quitar Gallo pinto de
   favoritos» (el mock de `getFavoriteFoods` pasa a devolver `[]`) y después «Añadir Gallo pinto a favoritos» desde
   «Recientes» (vuelve a devolverlo). Comprueba que no hay ningún `alertdialog`, que el foco no está en «Cancelar» y
   que `deleteCustomFood` no se llamó.
5. `// SDD: 028 REQ-017 AC-017.3 NFR-002 AC-N002.4` «si se escribe mientras el borrado está en curso y falla, se ve el
   aviso sin que el foco salga de la caja». Con la confirmación abierta en «Favoritos», confirmar con una promesa
   pendiente, escribir «a» en la caja (las listas siguen a la vista) y rechazarla. Comprueba que el foco sigue en
   «Buscar alimento», que el aviso está en el elemento de «Gallo pinto» de «Favoritos» y que, tras escribir «r» y
   vaciar la caja, ya no está.

Los tests de REQ-017 y NFR-002 de las iteraciones 1 y 2 (abrir, cancelar, Escape, fallo, 204 y 404, foco y
`onCustomFoodDeleted`) **no cambian**: ninguno escribe en la caja con la confirmación abierta. Siguen probando que
cancelar, Escape y un fallo devuelven el foco al botón (AC-N002.4), que un 204 lo lleva a la caja (AC-N002.5) y que
`onCustomFoodDeleted` se llama tras un 204 o un 404 (AC-018.7).

**F10 · sin test nuevo.** Es una refactorización sin cambio de comportamiento (Art. B5.1 pide tests del comportamiento,
y no cambia). La cubre la suite existente:
- `test_typo_tolerance_by_length_of_the_form`: los límites 3/4 y 7/8;
- los tests de `TypoDistances` (forma de 3 caracteres con `startswith`) y los de AC-006.x y AC-N004.x de
  `test_catalog_search_service.py`, `test_food_library_service.py`, `test_food_library_routes.py` y
  `test_catalog_routes.py`.

Un test que comparara la constante con `typo_tolerance` pasaría ya sin implementar y sería solo una guarda; no se
añade.

**F11 · tests que cambian en `frontend/src/features/diary/schemas.test.ts`** (Art. B5.3: se adaptan porque el símbolo
desaparece; ninguno se debilita, todos conservan sus marcadores y sus aserciones de comportamiento):
- Import: se quita `proposalFormSchema`.
- `proposalIssues(entries)` pasa a validar con `proposalReviewSchema` y da a cada entrada sin clave una
  (``key: entry.key ?? `k${index}` ``). Los mensajes esperados por posición no cambian. Lo usan los tests de 025
  AC-007.3 (rangos y decimales, personalizado, sin coincidencia y posición) y de 028 AC-019.1.
- `describe("proposalFormSchema")` pasa a `describe("proposalReviewSchema · validación de la propuesta")`, y cada
  `proposalFormSchema.safeParse(...)` a `proposalReviewSchema.safeParse(...)` con entradas con `key`:
  - «acepta los gramos %j» (025 AC-007.2): `{ ...RICE_ENTRY, key: "k1", grams }`.
  - «conserva la `key`…» (028 AC-019.3) y «conserva el `customFoodId`…» (028 AC-018.4): ya llevan `key`, solo cambia
    el esquema.
  - «un personalizado creado en la propuesta, sin `customFoodId`, sigue siendo válido» (028 AC-018.2): las dos
    entradas llevan `key` (`"k1"`). Lo que prueba es la ausencia de `customFoodId`, no la de `key`; en la propuesta
    toda entrada tiene clave desde `withEntryKey`.
  - «valida los gramos de una entrada con clave igual que sin ella» (028 AC-019.1) pasa a «valida los gramos de una
    entrada con clave y la conserva». La parte «sin ella» ya no existe: una entrada sin clave se rechaza, y eso lo
    prueba el bloque siguiente.
- `describe("proposalReviewSchema")` (las guardas de regresión de la excepción ratificada a B5.2 y B5.6):
  - «rechaza una entrada %s sin `key`, que el esquema de la 025 sí acepta» pasa a «rechaza una entrada %s sin `key`».
    Se quita la línea `expect(proposalFormSchema.safeParse(...).success).toBe(true)`, que hablaba de un esquema que ya
    no existe. Se mantienen el rechazo y la ruta `key` del error.
  - «da con los gramos %j el mismo mensaje «%s» que proposalFormSchema» pasa a «da con los gramos %j el mensaje «%s»
    de los gramos de la propuesta». Se mantiene `toEqual({ 0: message, 1: message })`. La comparación con
    `proposalIssues`, que ahora sería tautológica, se cambia por una con la regla compartida:
    `toEqual({ 0: gramsError(grams), 1: gramsError(grams) })` (`gramsError` ya se exporta de `schemas.ts`).
  - «conserva la `key`… y el `customFoodId`…» y «no valida los gramos de una entrada sin coincidencia» no cambian.

**F11 · test nuevo en `schemas.test.ts`:** `// SDD: 028 REQ-018 AC-018.7` «`schemas.ts` ya no exporta
`proposalFormSchema`, que solo usaban los tests», con `import * as diarySchemas from "./schemas"` y
`expect(Object.keys(diarySchemas)).not.toContain("proposalFormSchema")`. Es rojo legítimo hasta que se retire. El
escaneo de `PhotoReview.source.test.ts` («no usa `proposalFormSchema`») sigue igual.

**Excepción a B5.2 y B5.6:** F11 **no la amplía ni la invalida**. Las cuatro pruebas (nueve casos) de
`proposalReviewSchema` siguen siendo guardas de regresión de un esquema declarativo y conservan su marcador
`regression guard`. Solo pierden la comparación con el esquema retirado, que se sustituye por la regla `gramsError`. El
único test nuevo de F11 tiene rojo legítimo.

**Cobertura:** no hay AC nuevos. Los AC afectados (AC-017.3, AC-017.7, AC-N002.3, AC-N002.4, AC-007.2 y AC-007.3 de la
025, AC-018.2, AC-018.4, AC-018.7, AC-019.1 y AC-019.3) siguen con al menos un test con marcador.

### 9.5 Mapa de los hallazgos → diseño
| Hallazgo | REQ / NFR | Dónde se resuelve |
|---|---|---|
| F9 | REQ-017 (AC-017.3, AC-017.7), NFR-002 (AC-N002.3 a AC-N002.5) | `DeleteTarget.query`, `isTargetShown`, `dismissDelete`, el efecto de cierre y `onError` de `confirmDelete` en `FoodSearchPanel.tsx` |
| F10 | REQ-006, NFR-004 (sin cambio de comportamiento) | `typo_tolerance` con `TYPO_MIN_FORM_LENGTH` en `catalog_search_service.py` |
| F11 | Interno (como F6); REQ-018 y REQ-019 a través de `proposalReviewSchema` | Retirada de `proposalFormSchema` en `schemas.ts` |

El resto del mapa (sección 4) no cambia.

### 9.6 Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El efecto de cierre llama a `deleteFood.reset()` antes del `onSuccess` de `mutate` y se pierde `onCustomFoodDeleted` | Baja | Alto | El efecto no actúa con `isPending` ni con `isSuccess`; los tests existentes de `onCustomFoodDeleted` (204 y 404) y AC-018.7 en `MealPhotoDialog.test.tsx` lo vigilan |
| Un refetch de las listas (por ejemplo, tras marcar un favorito) cierra la confirmación sin que el usuario haga nada | Baja | Bajo | TanStack Query conserva `data` durante el refetch; solo cierra si el alimento ya no está en los datos nuevos, y entonces su elemento ya no existe |
| Cerrar la confirmación deja el foco en el cuerpo de la página | Baja | Medio | `dismissDelete` enfoca la caja si el foco quedó en `body`; en otro caso no lo toca (test 4) |
| Al adaptar `schemas.test.ts` se debilita alguna aserción | Baja | Medio | Lista cerrada en 9.4 con el motivo de cada cambio; los mensajes esperados y los marcadores no cambian |

El riesgo de la sección 6 «`proposalReviewSchema` y `proposalFormSchema` divergen» desaparece con F11.

### 9.7 Cumplimiento de la constitución
- **Art. B1.3:** la spec no cambia. F9 se ciñe a REQ-017 («dentro de su elemento de la lista en la que se pulsó»,
  «cerrar solo la confirmación, como Cancelar») y a NFR-002 (el foco no salta ni queda en el cuerpo). No hace falta un
  AC nuevo: los tests trazan a AC existentes.
- **Art. B5.1, B5.2 y B5.3:** los tests nuevos de F9 y F11 se escriben antes de implementar y fallan hoy por
  comportamiento ausente. F10 no cambia comportamiento y no añade tests. Los tests de `schemas.test.ts` que cambian lo
  hacen porque desaparece el símbolo, sin debilitarse (lista en 9.4). La excepción ratificada a B5.2 y B5.6 no cambia.
- **Art. B5.6:** sin esqueletos, porque no hay símbolos exportados nuevos.
- **Art. B5.7 y P2.frontend.5:** sin errores nuevos de lint, tipos ni ratchet. El efecto nuevo declara todas sus
  dependencias, sin `eslint-disable`.
- **Art. P1:** marcadores `028`, nombres en español y mocks en la capa `api.ts`. No hay tests nuevos en el backend.
- **Art. P2.frontend.3:** el panel sigue con react-hook-form (`form.getValues`, `form.setFocus`) y TanStack Query.
- **Art. P2.backend.5:** F10 reutiliza la constante existente en lugar de duplicar el literal.
- **Art. P4:** sin cambios de modelo ni migración.
- **Art. P5.2:** la ADR-0036 ya está «Aceptada» (la aceptó la sesión principal). Este plan solo ajusta el texto de sus
  decisiones 7 y 9 para que siga describiendo el código, sin tocar su estado ni la fila del índice.
- Ningún «DEBERÍA» queda sin cumplir.

### 9.8 ADRs
- [ADR-0036](../../docs/sdd/decisions/ADR-0036-biblioteca-de-alimentos-propios.md), revisión de contenido:
  - decisión 7: se quita la mención a `proposalFormSchema` (F11);
  - decisión 9: la confirmación se cierra sin mover el foco si cambia el texto de la caja o si su alimento deja de
    mostrarse en su lista (F9).
- No hay ADR nueva: F9 aplica la decisión 9 a un caso límite y F10 y F11 son internos.
