from sqlalchemy import select

from models import CatalogFood
from repositories.base_repository import BaseRepository


class CatalogFoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, CatalogFood)

    def list_all(self) -> list[CatalogFood]:
        stmt = select(CatalogFood).order_by(CatalogFood.id)
        return list(self.session.scalars(stmt).all())

    def get_by_ids(self, ids: list[str]) -> list[CatalogFood]:
        if not ids:
            return []
        stmt = select(CatalogFood).where(CatalogFood.id.in_(ids))
        return list(self.session.scalars(stmt).all())
