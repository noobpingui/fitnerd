from models import CatalogFood
from repositories.base_repository import BaseRepository


class CatalogFoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, CatalogFood)

    def list_all(self) -> list[CatalogFood]:
        raise NotImplementedError("not implemented")

    def get_by_ids(self, _ids: list[str]) -> list[CatalogFood]:
        raise NotImplementedError("not implemented")
