from sqlalchemy import select

from repositories.base_repository import BaseRepository
from models import ExerciseFavorite, Exercise


class ExerciseFavoriteRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, ExerciseFavorite)

    def get_by_user_and_exercise(self, user_id, exercise_id):
        #Filtramos por user_id en la MISMA query (mismo patron que body_metrics) para que
        #un favorito de otro usuario nunca se pueda ver ni tocar desde aca.
        stmt = select(self.model).where(
            self.model.user_id == user_id,
            self.model.exercise_id == exercise_id,
        )
        return self.session.scalars(stmt).first()

    def list_exercises_by_user(self, user_id):
        #Devolvemos el Exercise completo (via join), no el registro de favorito en si,
        #para que el cliente reciba el detalle del ejercicio sin una segunda llamada.
        #Filtramos is_active: si el ejercicio se desactivo, se oculta de "mis favoritos"
        #tambien - el registro de favorito en si NO se borra, asi que si se reactiva el
        #ejercicio mas adelante, vuelve a aparecer automaticamente, sin que el usuario
        #tenga que volver a marcarlo.
        stmt = (
            select(Exercise)
            .join(self.model, self.model.exercise_id == Exercise.id)
            .where(self.model.user_id == user_id, Exercise.is_active == True)
            .order_by(Exercise.name)
        )
        return self.session.scalars(stmt).all()
