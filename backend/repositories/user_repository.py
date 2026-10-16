from sqlalchemy import func, select

from repositories.base_repository import BaseRepository
from models import User

#May access generic methods from BaseRepository plus add custom methods such as get_by_email

class UserRepository(BaseRepository): #Since BaseRepository already receives session and model, then UserRepository
                                      #may get advantage of that and add specifi queries for User

    def __init__(self, session):
        super().__init__(session, User) #When instancing an object like user_repository = UserRepository(session)
                                        #BaseRepository receives:
                                        #self.session = session
                                        #self.model = User

    def get_by_email(self, email):
        # Sin distinguir mayúsculas (ADR-0025); con varias coincidencias antiguas gana la cuenta más vieja.
        stmt = (
            select(self.model)
            .where(func.lower(self.model.email) == email.lower())
            .order_by(self.model.created_at, self.model.id)
        )

        return self.session.scalars(stmt).first() #Execute the query and return the first user found or None if it does not exist

    # Bloquea la fila del usuario hasta el commit: serializa guardados simultáneos del perfil.
    def get_by_id_for_update(self, user_id):
        stmt = select(self.model).where(self.model.id == user_id).with_for_update()
        return self.session.scalars(stmt).first()
