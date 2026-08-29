from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import BodyRegion


class BodyRegionRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, BodyRegion)

    def list_active(self):
        #Identico criterio que ExerciseCategoryRepository.list_active() - orden fijo por
        #nombre para que el catalogo no salte de posicion entre cargas.
        stmt = select(self.model).where(self.model.is_active == True).order_by(self.model.name)
        return self.session.scalars(stmt).all()

    def get_by_name(self, name):
        stmt = select(self.model).where(self.model.name == name)
        return self.session.scalars(stmt).first()
