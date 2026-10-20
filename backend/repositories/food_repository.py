from sqlalchemy import func, select
from sqlalchemy.orm import defer

from models import Food
from repositories.base_repository import BaseRepository


class FoodRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Food)

    def get_by_fdc_ids(self, fdc_ids: list[int]) -> list[Food]:
        if not fdc_ids:
            return []
        stmt = select(Food).options(defer(Food.embedding)).where(Food.fdc_id.in_(fdc_ids))
        return list(self.session.scalars(stmt).all())

    def find_text_matches(self, query: str, limit: int) -> list[int]:
        # websearch_to_tsquery no falla con entradas arbitrarias
        tsquery = func.websearch_to_tsquery("english", query)
        # Normalización 2 (divide por la longitud del documento): sin ella, las
        # descripciones largas que solo mencionan la palabra desplazan a las
        # cortas y exactas (p. ej. «Bananas, raw» con la consulta «banana»).
        rank = func.ts_rank_cd(Food.search_vector, tsquery, 2)
        stmt = (
            select(Food.fdc_id)
            .where(Food.search_vector.op("@@")(tsquery))
            .order_by(rank.desc(), Food.fdc_id.asc())
            .limit(limit)
        )
        return list(self.session.scalars(stmt).all())

    def find_semantic_matches(
        self, vector: list[float], max_distance: float, limit: int
    ) -> list[int]:
        distance = Food.embedding.cosine_distance(vector)
        stmt = (
            select(Food.fdc_id)
            .where(Food.embedding.is_not(None), distance <= max_distance)
            .order_by(distance.asc(), Food.fdc_id.asc())
            .limit(limit)
        )
        return list(self.session.scalars(stmt).all())

    def list_missing_embedding(self, limit: int) -> list[Food]:
        stmt = (
            select(Food)
            .options(defer(Food.embedding))
            .where(Food.embedding.is_(None))
            .order_by(Food.fdc_id.asc())
            .limit(limit)
        )
        return list(self.session.scalars(stmt).all())

    def count_missing_embedding_by_data_type(self) -> dict[str, int]:
        stmt = (
            select(Food.data_type, func.count())
            .where(Food.embedding.is_(None))
            .group_by(Food.data_type)
        )
        counts = {"foundation": 0, "sr_legacy": 0}
        for data_type, count in self.session.execute(stmt).all():
            counts[data_type] = count
        return counts
