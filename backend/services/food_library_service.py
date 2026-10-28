from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models import FoodFavorite
from services.catalog_rules import fold, is_catalog_id
from services.catalog_search_service import (
    MAX_RESULTS,
    SearchCandidate,
    TypoSearchStats,
    rank_candidates,
)
from services.food_library_rules import (
    FAVORITES_LIMIT_MESSAGE,
    LIBRARY_KINDS,
    MAX_FAVORITES,
    MAX_RECENT_FOODS,
    LibraryFood,
    parse_custom_food_id,
)
from services.food_search_service import normalize_query
from services.meal_rules import FOOD_NOT_FOUND_MESSAGE, NUTRIENT_KEYS
from services.profile_service import USER_NOT_FOUND_MESSAGE


def _library_food(kind: str, food, favorite: bool, last_grams=None) -> LibraryFood:
    return LibraryFood(
        kind=kind,
        id=food.id,
        name=food.name,
        per_100g={key: float(getattr(food, key)) for key in NUTRIENT_KEYS},
        favorite=favorite,
        last_grams=last_grams,
    )


class FoodLibraryService:

    def __init__(
        self,
        catalog_repository,
        custom_food_repository,
        favorite_repository,
        meal_repository,
        user_repository,
        unit_of_work,
    ):
        self.catalog_repository = catalog_repository
        self.custom_food_repository = custom_food_repository
        self.favorite_repository = favorite_repository
        self.meal_repository = meal_repository
        self.user_repository = user_repository
        self.unit_of_work = unit_of_work

    def update_custom_food(self, _user_id, _custom_food_id, _data):
        raise NotImplementedError("not implemented")

    def search(
        self, user_id, raw_query: str | None, stats: TypoSearchStats | None = None
    ) -> list[LibraryFood]:
        query = normalize_query(raw_query)
        favorites = self._favorite_keys(user_id)
        candidates = [
            SearchCandidate(
                name=food.name,
                synonyms=food.synonyms,
                source_order=0,
                key=str(food.id),
                item=_library_food("catalog", food, ("catalog", food.id) in favorites),
            )
            for food in self.catalog_repository.list_all()
        ]
        candidates.extend(
            SearchCandidate(
                name=food.name,
                synonyms=(),
                source_order=1,
                key=str(food.id),
                item=_library_food("custom", food, ("custom", food.id) in favorites),
            )
            for food in self.custom_food_repository.list_by_user(user_id)
        )
        return rank_candidates(candidates, query, MAX_RESULTS, stats)

    def recent(self, user_id) -> list[LibraryFood]:
        rows = self.meal_repository.list_recent_foods(user_id, MAX_RECENT_FOODS)
        favorites = self._favorite_keys(user_id)
        catalog, customs = self._load(
            user_id,
            [row.catalog_id for row in rows if row.catalog_id is not None],
            [row.custom_food_id for row in rows if row.custom_food_id is not None],
        )
        results = []
        for row in rows:
            if row.custom_food_id is not None:
                food = customs.get(row.custom_food_id)
                kind = "custom"
            else:
                food = catalog.get(row.catalog_id)
                kind = "catalog"
            if food is not None:
                results.append(
                    _library_food(kind, food, (kind, food.id) in favorites, row.grams)
                )
        return results

    def favorites(self, user_id) -> list[LibraryFood]:
        rows = self.favorite_repository.list_by_user(user_id)
        catalog, customs = self._load(
            user_id,
            [row.catalog_id for row in rows if row.catalog_id is not None],
            [row.custom_food_id for row in rows if row.custom_food_id is not None],
        )
        results = []
        for row in rows:
            if row.custom_food_id is not None:
                food = customs.get(row.custom_food_id)
                kind = "custom"
            else:
                food = catalog.get(row.catalog_id)
                kind = "catalog"
            if food is not None:
                results.append(_library_food(kind, food, True))
        results.sort(
            key=lambda food: (fold(food.name), food.kind != "catalog", food.name, str(food.id))
        )
        return results

    def add_favorite(self, user_id, kind: str, food_id: object) -> None:
        catalog_id, custom_food_id = self._parse_target(kind, food_id)
        try:
            self._lock_user(user_id)
            self._require_food(user_id, catalog_id, custom_food_id)
            existing = self.favorite_repository.get_for_food(
                user_id, catalog_id=catalog_id, custom_food_id=custom_food_id
            )
            if existing is None:
                if self._visible_favorite_count(user_id) >= MAX_FAVORITES:
                    raise ValidationError(FAVORITES_LIMIT_MESSAGE)
                self.favorite_repository.create(
                    FoodFavorite(
                        user_id=user_id, catalog_id=catalog_id, custom_food_id=custom_food_id
                    )
                )
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def remove_favorite(self, user_id, kind: str, food_id: object) -> None:
        catalog_id, custom_food_id = self._parse_target(kind, food_id)
        try:
            self._lock_user(user_id)
            existing = self.favorite_repository.get_for_food(
                user_id, catalog_id=catalog_id, custom_food_id=custom_food_id
            )
            if existing is not None:
                # Se puede quitar aunque el alimento ya no esté en el catálogo (AC-009.7).
                self.favorite_repository.delete(existing)
            else:
                self._require_food(user_id, catalog_id, custom_food_id)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def delete_custom_food(self, user_id, custom_food_id: object) -> None:
        parsed = parse_custom_food_id(custom_food_id)
        if parsed is None:
            raise ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)
        try:
            self._lock_user(user_id)
            food = self.custom_food_repository.get_by_id_and_user(parsed, user_id)
            if food is None:
                raise ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)
            # La base pone meal_items.custom_food_id a NULL y borra sus favoritos.
            self.custom_food_repository.delete(food)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def _lock_user(self, user_id) -> None:
        # Serializa las escrituras del usuario (patrón de ADR-0020).
        if self.user_repository.get_by_id_for_update(user_id) is None:
            raise ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)

    def _visible_favorite_count(self, user_id) -> int:
        rows = self.favorite_repository.list_by_user(user_id)
        catalog_ids = [row.catalog_id for row in rows if row.catalog_id is not None]
        visible_customs = sum(1 for row in rows if row.custom_food_id is not None)
        if not catalog_ids:
            return visible_customs
        found = self.catalog_repository.get_by_ids(list(dict.fromkeys(catalog_ids)))
        return visible_customs + len({food.id for food in found})

    def _favorite_keys(self, user_id) -> set[tuple[str, object]]:
        keys: set[tuple[str, object]] = set()
        for favorite in self.favorite_repository.list_by_user(user_id):
            if favorite.custom_food_id is not None:
                keys.add(("custom", favorite.custom_food_id))
            elif favorite.catalog_id is not None:
                keys.add(("catalog", favorite.catalog_id))
        return keys

    def _load(self, user_id, catalog_ids: list[str], custom_ids: list[int]) -> tuple[dict, dict]:
        catalog = {}
        if catalog_ids:
            found = self.catalog_repository.get_by_ids(list(dict.fromkeys(catalog_ids)))
            catalog = {food.id: food for food in found}
        customs = {}
        if custom_ids:
            found = self.custom_food_repository.get_by_ids_and_user(
                list(dict.fromkeys(custom_ids)), user_id
            )
            customs = {food.id: food for food in found}
        return catalog, customs

    @staticmethod
    def _parse_target(kind: object, food_id: object) -> tuple[str | None, int | None]:
        not_found = ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)
        if kind not in LIBRARY_KINDS:
            raise not_found
        if kind == "catalog":
            if not is_catalog_id(food_id):
                raise not_found
            return food_id, None
        parsed = parse_custom_food_id(food_id)
        if parsed is None:
            raise not_found
        return None, parsed

    def _require_food(self, user_id, catalog_id: str | None, custom_food_id: int | None) -> None:
        if catalog_id is not None:
            found = bool(self.catalog_repository.get_by_ids([catalog_id]))
        else:
            found = (
                self.custom_food_repository.get_by_id_and_user(custom_food_id, user_id)
                is not None
            )
        if not found:
            raise ResourceNotFoundError(FOOD_NOT_FOUND_MESSAGE)
