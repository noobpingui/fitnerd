from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import TranscriptChunk, Video


class TranscriptChunkRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, TranscriptChunk)

    def find_similar(self, query_embedding, limit=5):
        #cosine_distance -> operador <=> de pgvector. Cuanto MAS CHICO el numero, mas parecidos son los vectores
        #(0 = identicos, 1 = sin relacion, 2 = opuestos). Por eso ordenamos ascendente.
        distance = self.model.embedding.cosine_distance(query_embedding).label("distance")

        stmt = (
            select(self.model, Video.title, distance)
            .join(Video, self.model.video_id == Video.id)
            .order_by(distance)
            .limit(limit)
        )

        return self.session.execute(stmt).all()
