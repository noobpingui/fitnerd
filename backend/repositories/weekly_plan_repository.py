from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import WeeklyPlanEntry


class WeeklyPlanRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, WeeklyPlanEntry)

    def get_by_user_exercise_day(self, user_id, exercise_id, day_of_week):
        stmt = select(self.model).where(
            self.model.user_id == user_id,
            self.model.exercise_id == exercise_id,
            self.model.day_of_week == day_of_week,
        )
        return self.session.scalars(stmt).first()

    def get_by_id_for_user(self, entry_id, user_id):
        #Filtramos por user_id en la MISMA query (mismo patron que favorites/body_metrics)
        #para que una entrada de otro usuario nunca se pueda borrar desde aca.
        stmt = select(self.model).where(
            self.model.id == entry_id,
            self.model.user_id == user_id,
        )
        return self.session.scalars(stmt).first()

    def list_by_user(self, user_id):
        stmt = select(self.model).where(self.model.user_id == user_id)
        return self.session.scalars(stmt).all()
