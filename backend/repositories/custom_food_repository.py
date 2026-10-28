from sqlalchemy import func, select

from models import CustomFood
from repositories.base_repository import BaseRepository


class CustomFoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, CustomFood)

    def list_by_user(self, user_id) -> list[CustomFood]:
        stmt = select(CustomFood).where(CustomFood.user_id == user_id).order_by(CustomFood.id)
        return list(self.session.scalars(stmt).all())

    def get_by_id_and_user(self, custom_food_id: int, user_id) -> CustomFood | None:
        # Filtra por usuario en la misma consulta: uno ajeno es indistinguible de uno inexistente.
        stmt = select(CustomFood).where(
            CustomFood.id == custom_food_id, CustomFood.user_id == user_id
        )
        return self.session.scalars(stmt).first()

    def get_by_ids_and_user(self, ids: list[int], user_id) -> list[CustomFood]:
        if not ids:
            return []
        stmt = select(CustomFood).where(CustomFood.id.in_(ids), CustomFood.user_id == user_id)
        return list(self.session.scalars(stmt).all())

    def get_by_name_keys(self, user_id, name_keys: list[str]) -> list[CustomFood]:
        if not name_keys:
            return []
        stmt = select(CustomFood).where(
            CustomFood.user_id == user_id, CustomFood.name_key.in_(name_keys)
        )
        return list(self.session.scalars(stmt).all())

    def count_by_user(self, user_id) -> int:
        stmt = select(func.count()).select_from(CustomFood).where(CustomFood.user_id == user_id)
        return int(self.session.scalar(stmt) or 0)

    def create(self, food: CustomFood) -> CustomFood:
        # Solo flush: hace falta el id; el commit lo hace UnitOfWork.
        self.session.add(food)
        self.session.flush()
        return food
