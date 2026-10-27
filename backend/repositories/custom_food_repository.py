from models import CustomFood
from repositories.base_repository import BaseRepository


class CustomFoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, CustomFood)

    def list_by_user(self, _user_id) -> list[CustomFood]:
        raise NotImplementedError("not implemented")

    def get_by_id_and_user(self, _custom_food_id: int, _user_id) -> CustomFood | None:
        raise NotImplementedError("not implemented")

    def get_by_ids_and_user(self, _ids: list[int], _user_id) -> list[CustomFood]:
        raise NotImplementedError("not implemented")

    def get_by_name_keys(self, _user_id, _name_keys: list[str]) -> list[CustomFood]:
        raise NotImplementedError("not implemented")

    def count_by_user(self, _user_id) -> int:
        raise NotImplementedError("not implemented")

    def create(self, _food: CustomFood) -> CustomFood:
        raise NotImplementedError("not implemented")
