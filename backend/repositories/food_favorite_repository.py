from models import FoodFavorite
from repositories.base_repository import BaseRepository


class FoodFavoriteRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, FoodFavorite)

    def list_by_user(self, _user_id) -> list[FoodFavorite]:
        raise NotImplementedError("not implemented")

    def get_for_food(
        self, _user_id, _catalog_id: str | None = None, _custom_food_id: int | None = None
    ) -> FoodFavorite | None:
        raise NotImplementedError("not implemented")

    def count_by_user(self, _user_id) -> int:
        raise NotImplementedError("not implemented")
