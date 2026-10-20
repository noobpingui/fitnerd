from datetime import date

from models import Meal
from repositories.base_repository import BaseRepository


class MealRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Meal)

    def list_by_user_and_date(self, _user_id, _meal_date: date) -> list[Meal]:
        raise NotImplementedError("not implemented")

    def get_by_user_date_and_type(
        self, _user_id, _meal_date: date, _meal_type: str
    ) -> Meal | None:
        raise NotImplementedError("not implemented")

    def get_by_id_and_user(self, _meal_id: int, _user_id) -> Meal | None:
        raise NotImplementedError("not implemented")
