from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import ExerciseCategory


class ExerciseCategoryRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, ExerciseCategory)

    def list_active(self):
        #A diferencia de list_all() (heredado, sin filtro - usado para casos internos),
        #esto es lo que se expone al catalogo publico: solo categorias no desactivadas.
        stmt = select(self.model).where(self.model.is_active == True).order_by(self.model.name)
        return self.session.scalars(stmt).all()

    def get_by_name(self, name):
        stmt = select(self.model).where(self.model.name == name)
        return self.session.scalars(stmt).first()
