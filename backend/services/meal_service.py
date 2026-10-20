from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from models.meal import Meal
from services.profile_service import utc_now


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

    def __init__(
        self,
        meal_repository,
        food_repository,
        user_repository,
        unit_of_work,
        clock=utc_now,
    ):
        self.meal_repository = meal_repository
        self.food_repository = food_repository
        self.user_repository = user_repository
        self.unit_of_work = unit_of_work
        self.clock = clock

    def get_diary(self, _user_id, _date_value: object) -> DiarySummary:
        raise NotImplementedError("not implemented")

    def add_items(self, _user_id, _data: object) -> AddItemsResult:
        raise NotImplementedError("not implemented")

    def update_item_grams(self, _user_id, _meal_id: int, _item_id: int, _data: object) -> MealSummary:
        raise NotImplementedError("not implemented")

    def remove_item(self, _user_id, _meal_id: int, _item_id: int) -> None:
        raise NotImplementedError("not implemented")

    def delete_meal(self, _user_id, _meal_id: int) -> None:
        raise NotImplementedError("not implemented")
