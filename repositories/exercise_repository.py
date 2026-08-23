from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import Exercise


class ExerciseRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Exercise)

    def list_by_category(self, category_id):
        #Solo ejercicios activos - uno desactivado no debe aparecer en el catalogo,
        #aunque la fila siga existiendo en la base (soft delete).
        stmt = (
            select(self.model)
            .where(self.model.category_id == category_id, self.model.is_active == True)
            .order_by(self.model.name)
        )
        return self.session.scalars(stmt).all()

    def get_by_category_and_name(self, category_id, name):
        stmt = select(self.model).where(
            self.model.category_id == category_id,
            self.model.name == name,
        )
        return self.session.scalars(stmt).first()
