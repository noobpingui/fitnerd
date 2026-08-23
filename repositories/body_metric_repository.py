from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import BodyMetric


class BodyMetricRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, BodyMetric)

    def list_by_user(self, user_id):
        stmt = (
            select(self.model)
            .where(self.model.user_id == user_id)
            .order_by(self.model.recorded_at.desc())
        )
        return self.session.scalars(stmt).all()

    def get_by_id_and_user(self, metric_id, user_id):
        #Filtramos por user_id en la MISMA query, no en un paso aparte despues de traer
        #el registro - asi si el id existe pero es de otro usuario, esto devuelve None
        #directo, en vez de encontrarlo y tener que decidir "ocultarlo" en otra capa.
        stmt = select(self.model).where(
            self.model.id == metric_id,
            self.model.user_id == user_id,
        )
        return self.session.scalars(stmt).first()
