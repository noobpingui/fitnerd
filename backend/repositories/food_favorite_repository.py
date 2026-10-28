from sqlalchemy import select

from models import FoodFavorite
from repositories.base_repository import BaseRepository


class FoodFavoriteRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, FoodFavorite)

    def list_by_user(self, user_id) -> list[FoodFavorite]:
        stmt = select(FoodFavorite).where(FoodFavorite.user_id == user_id).order_by(FoodFavorite.id)
        return list(self.session.scalars(stmt).all())

    def get_for_food(
        self, user_id, catalog_id: str | None = None, custom_food_id: int | None = None
    ) -> FoodFavorite | None:
        stmt = select(FoodFavorite).where(FoodFavorite.user_id == user_id)
        if catalog_id is not None:
            stmt = stmt.where(FoodFavorite.catalog_id == catalog_id)
        elif custom_food_id is not None:
            stmt = stmt.where(FoodFavorite.custom_food_id == custom_food_id)
        else:
            return None
        return self.session.scalars(stmt).first()
