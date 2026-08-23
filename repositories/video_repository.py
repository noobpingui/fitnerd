from sqlalchemy import select

from repositories.base_repository import BaseRepository

from models import Video

class VideoRepository(BaseRepository):


    def __init__(self, session):
        super().__init__(session, Video)


    def get_by_source_key(self, source_key):
        stmt = select(self.model).where(self.model.source_key == source_key)

        return self.session.scalars(stmt).first()

    