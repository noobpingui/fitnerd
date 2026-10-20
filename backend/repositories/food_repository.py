from models import Food
from repositories.base_repository import BaseRepository


class FoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Food)

    def get_by_fdc_ids(self, fdc_ids: list[int]) -> list[Food]:
        raise NotImplementedError("not implemented")

    def find_text_matches(self, query: str, limit: int) -> list[int]:
        raise NotImplementedError("not implemented")

    def find_semantic_matches(
        self, vector: list[float], max_distance: float, limit: int
    ) -> list[int]:
        raise NotImplementedError("not implemented")

    def list_missing_embedding(self, limit: int) -> list[Food]:
        raise NotImplementedError("not implemented")

    def count_missing_embedding_by_data_type(self) -> dict[str, int]:
        raise NotImplementedError("not implemented")
