from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import Meal
from repositories.base_repository import BaseRepository


class MealRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Meal)

    def list_by_user_and_date(self, user_id, meal_date: date) -> list[Meal]:
        stmt = (
            select(Meal)
            .options(selectinload(Meal.items))
            .where(Meal.user_id == user_id, Meal.meal_date == meal_date)
        )
        return list(self.session.scalars(stmt).all())

    def get_by_user_date_and_type(
        self, user_id, meal_date: date, meal_type: str
    ) -> Meal | None:
        stmt = select(Meal).where(
            Meal.user_id == user_id,
            Meal.meal_date == meal_date,
            Meal.meal_type == meal_type,
        )
        return self.session.scalars(stmt).first()

    def get_by_id_and_user(self, meal_id: int, user_id) -> Meal | None:
        # Filtra por usuario en la misma consulta: una comida ajena es
        # indistinguible de una inexistente.
        stmt = select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
        return self.session.scalars(stmt).first()
