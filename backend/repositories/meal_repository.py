from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from models import CatalogFood, Meal, MealItem
from repositories.base_repository import BaseRepository


@dataclass(frozen=True)
class RecentFoodRow:
    catalog_id: str | None
    custom_food_id: int | None
    grams: Decimal


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

    def list_recent_foods(self, user_id, limit: int) -> list[RecentFoodRow]:
        # Una fila por alimento (el último registro), solo del catálogo vigente o propios.
        position = (
            func.row_number()
            .over(
                partition_by=(MealItem.catalog_id, MealItem.custom_food_id),
                order_by=(MealItem.created_at.desc(), MealItem.id.desc()),
            )
            .label("position")
        )
        usable = or_(
            (MealItem.source == "catalog") & MealItem.catalog_id.in_(select(CatalogFood.id)),
            MealItem.custom_food_id.is_not(None),
        )
        ranked = (
            select(
                MealItem.id,
                MealItem.catalog_id,
                MealItem.custom_food_id,
                MealItem.grams,
                MealItem.created_at,
                position,
            )
            .join(Meal, Meal.id == MealItem.meal_id)
            .where(Meal.user_id == user_id, usable)
            .subquery()
        )
        stmt = (
            select(ranked.c.catalog_id, ranked.c.custom_food_id, ranked.c.grams)
            .where(ranked.c.position == 1)
            .order_by(ranked.c.created_at.desc(), ranked.c.id.desc())
            .limit(limit)
        )
        return [
            RecentFoodRow(
                catalog_id=row.catalog_id, custom_food_id=row.custom_food_id, grams=row.grams
            )
            for row in self.session.execute(stmt)
        ]

    def get_by_id_and_user(self, meal_id: int, user_id) -> Meal | None:
        # Filtra por usuario en la misma consulta: una comida ajena es
        # indistinguible de una inexistente.
        stmt = select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
        return self.session.scalars(stmt).first()
