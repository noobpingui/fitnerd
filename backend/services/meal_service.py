from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models.meal import MEAL_TYPES, Meal, MealItem
from services.auth_input_rules import require_json_object
from services.meal_rules import (
    FOOD_NOT_FOUND_MESSAGE,
    ITEM_NOT_FOUND_MESSAGE,
    MAX_ITEMS_PER_MEAL,
    MEAL_NOT_FOUND_MESSAGE,
    NUTRIENT_KEYS,
    RESTORE_TOKEN_TTL_SECONDS,
    TOO_MANY_ITEMS_MESSAGE,
    CatalogItemInput,
    CustomItemInput,
    RemovedItemSnapshot,
    check_add_window,
    epoch_seconds,
    is_db_id,
    parse_items,
    parse_meal_date,
    parse_meal_type,
    parse_snapshot_payload,
    portion_nutrients,
    snapshot_payload,
    sum_nutrients,
    validate_grams,
)
from services.profile_service import USER_NOT_FOUND_MESSAGE
from utils.clock import utc_now


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


def _per_100g(item: MealItem) -> dict[str, float | None]:
    return {key: getattr(item, f"per_100g_{key}") for key in NUTRIENT_KEYS}


def _item_nutrients(item: MealItem) -> dict[str, Decimal | None]:
    return {key: getattr(item, key) for key in NUTRIENT_KEYS}


def _summarize(meal: Meal) -> MealSummary:
    totals, incomplete = sum_nutrients([_item_nutrients(item) for item in meal.items])
    return MealSummary(meal=meal, totals=totals, incomplete=incomplete)


def _new_item(position: int, grams: Decimal, per_100g: dict, **identity) -> MealItem:
    nutrients = portion_nutrients(per_100g, grams)
    return MealItem(
        position=position,
        grams=grams,
        per_100g_calories_kcal=per_100g["calories_kcal"],
        per_100g_protein_g=per_100g["protein_g"],
        per_100g_carbs_g=per_100g["carbs_g"],
        per_100g_fat_g=per_100g["fat_g"],
        **nutrients,
        **identity,
    )


class MealService:

    def __init__(
        self,
        meal_repository,
        food_repository,
        user_repository,
        unit_of_work,
        clock=utc_now,
        catalog_repository=None,
        restore_signer=None,
    ):
        self.restore_signer = restore_signer
        self.catalog_repository = catalog_repository
        self.meal_repository = meal_repository
        self.food_repository = food_repository
        self.user_repository = user_repository
        self.unit_of_work = unit_of_work
        self.clock = clock

    def get_diary(self, user_id, date_value: object) -> DiarySummary:
        meal_date = parse_meal_date(date_value)
        meals = self.meal_repository.list_by_user_and_date(user_id, meal_date)
        meals = sorted(meals, key=lambda meal: MEAL_TYPES.index(meal.meal_type))
        summaries = [_summarize(meal) for meal in meals]
        all_nutrients = [_item_nutrients(item) for meal in meals for item in meal.items]
        totals, incomplete = sum_nutrients(all_nutrients)
        return DiarySummary(
            date=meal_date, meals=summaries, totals=totals, incomplete=incomplete
        )

    def add_items(self, user_id, data: object) -> AddItemsResult:
        body = require_json_object(data)
        meal_date = parse_meal_date(body.get("date"))
        check_add_window(meal_date, self.clock().date())
        meal_type = parse_meal_type(body.get("meal_type"))
        inputs = parse_items(body.get("items"))

        try:
            self._lock_user(user_id)
            foods = self._load_foods(inputs)
            catalog_foods = self._load_catalog_foods(inputs)

            meal = self.meal_repository.get_by_user_date_and_type(
                user_id, meal_date, meal_type
            )
            current = len(meal.items) if meal is not None else 0
            if current + len(inputs) > MAX_ITEMS_PER_MEAL:
                raise ValidationError(TOO_MANY_ITEMS_MESSAGE)

            created = meal is None
            if created:
                meal = self.meal_repository.create(
                    Meal(user_id=user_id, meal_date=meal_date, meal_type=meal_type)
                )

            position = max((item.position for item in meal.items), default=-1) + 1
            for entry in inputs:
                if isinstance(entry, CustomItemInput):
                    item = _new_item(
                        position,
                        entry.grams,
                        entry.per_100g,
                        source="custom",
                        catalog_id=None,
                        fdc_id=None,
                        name=entry.name,
                        data_type=None,
                    )
                elif isinstance(entry, CatalogItemInput):
                    catalog_food = catalog_foods[entry.catalog_id]
                    per_100g = {key: getattr(catalog_food, key) for key in NUTRIENT_KEYS}
                    item = _new_item(
                        position,
                        entry.grams,
                        per_100g,
                        source="catalog",
                        catalog_id=catalog_food.id,
                        fdc_id=None,
                        name=catalog_food.name,
                        data_type=None,
                    )
                else:
                    food = foods[entry.fdc_id]
                    per_100g = {key: getattr(food, key) for key in NUTRIENT_KEYS}
                    item = _new_item(
                        position,
                        entry.grams,
                        per_100g,
                        source="usda",
                        catalog_id=None,
                        fdc_id=food.fdc_id,
                        name=food.description,
                        data_type=food.data_type,
                    )
                meal.items.append(item)
                position += 1

            if not created:
                meal.touch()
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
        return AddItemsResult(meal=_summarize(meal), created=created)

    def update_item_grams(
        self, user_id, meal_id: int, item_id: int, data: object
    ) -> MealSummary:
        try:
            self._lock_user(user_id)
            meal, item = self._find_item(user_id, meal_id, item_id)
            body = require_json_object(data)
            grams = validate_grams(body.get("grams"))
            item.grams = grams
            meal.touch()
            for key, value in portion_nutrients(_per_100g(item), grams).items():
                setattr(item, key, value)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
        return _summarize(meal)

    def remove_item(self, user_id, meal_id: int, item_id: int) -> str | None:
        try:
            self._lock_user(user_id)
            meal, item = self._find_item(user_id, meal_id, item_id)
            snapshot = RemovedItemSnapshot(
                meal_date=meal.meal_date,
                meal_type=meal.meal_type,
                position=item.position,
                source=item.source,
                catalog_id=item.catalog_id,
                fdc_id=item.fdc_id,
                name=item.name,
                data_type=item.data_type,
                grams=item.grams,
                per_100g=_per_100g(item),
                expires_at=epoch_seconds(self.clock()) + RESTORE_TOKEN_TTL_SECONDS,
            )
            meal.items.remove(item)
            if not meal.items:
                self.meal_repository.delete(meal)
            else:
                meal.touch()
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
        if self.restore_signer is None:
            return None
        return self.restore_signer.sign(user_id, snapshot_payload(snapshot))

    def restore_item(self, user_id, data: object) -> AddItemsResult:
        body = require_json_object(data)
        if self.restore_signer is None:
            raise ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)
        payload = self.restore_signer.verify(user_id, body.get("restore_token"))
        snapshot = parse_snapshot_payload(payload)
        if snapshot is None or epoch_seconds(self.clock()) > snapshot.expires_at:
            raise ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)

        try:
            self._lock_user(user_id)
            meal = self.meal_repository.get_by_user_date_and_type(
                user_id, snapshot.meal_date, snapshot.meal_type
            )
            if meal is not None and len(meal.items) >= MAX_ITEMS_PER_MEAL:
                raise ValidationError(TOO_MANY_ITEMS_MESSAGE)

            created = meal is None
            if created:
                meal = self.meal_repository.create(
                    Meal(
                        user_id=user_id,
                        meal_date=snapshot.meal_date,
                        meal_type=snapshot.meal_type,
                    )
                )

            item = _new_item(
                snapshot.position,
                snapshot.grams,
                snapshot.per_100g,
                source=snapshot.source,
                catalog_id=snapshot.catalog_id,
                fdc_id=snapshot.fdc_id,
                name=snapshot.name,
                data_type=snapshot.data_type,
            )
            index = next(
                (i for i, other in enumerate(meal.items) if other.position > snapshot.position),
                len(meal.items),
            )
            meal.items.insert(index, item)

            if not created:
                meal.touch()
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
        return AddItemsResult(meal=_summarize(meal), created=created)

    def delete_meal(self, user_id, meal_id: int) -> None:
        try:
            self._lock_user(user_id)
            meal = self._find_meal(user_id, meal_id)
            self.meal_repository.delete(meal)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def _lock_user(self, user_id) -> None:
        # Serializa las escrituras del usuario (patrón de ADR-0020).
        if self.user_repository.get_by_id_for_update(user_id) is None:
            raise ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)

    def _load_foods(self, inputs) -> dict:
        fdc_ids = [
            entry.fdc_id
            for entry in inputs
            if not isinstance(entry, (CustomItemInput, CatalogItemInput))
        ]
        if not fdc_ids:
            return {}
        found = self.food_repository.get_by_fdc_ids(list(dict.fromkeys(fdc_ids)))
        foods = {food.fdc_id: food for food in found}
        if any(fdc_id not in foods for fdc_id in fdc_ids):
            raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
        return foods

    def _load_catalog_foods(self, inputs) -> dict:
        catalog_ids = [entry.catalog_id for entry in inputs if isinstance(entry, CatalogItemInput)]
        if not catalog_ids:
            return {}
        if self.catalog_repository is None:
            raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
        found = self.catalog_repository.get_by_ids(list(dict.fromkeys(catalog_ids)))
        foods = {food.id: food for food in found}
        if any(catalog_id not in foods for catalog_id in catalog_ids):
            raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
        return foods

    def _find_meal(self, user_id, meal_id: int) -> Meal:
        meal = None
        if is_db_id(meal_id):
            meal = self.meal_repository.get_by_id_and_user(meal_id, user_id)
        if meal is None:
            raise ResourceNotFoundError(MEAL_NOT_FOUND_MESSAGE)
        return meal

    def _find_item(self, user_id, meal_id: int, item_id: int) -> tuple[Meal, MealItem]:
        meal = self._find_meal(user_id, meal_id)
        item = None
        if is_db_id(item_id):
            item = next((i for i in meal.items if i.id == item_id), None)
        if item is None:
            raise ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)
        return meal, item
