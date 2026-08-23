from sqlalchemy import select

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
        stmt = select(self.model).where(self.model.email == email) #Same as stmt = select(User).where(User.email == email)

        return self.session.scalars(stmt).first() #Execute the query and return the first user found or None if it does not exist
    