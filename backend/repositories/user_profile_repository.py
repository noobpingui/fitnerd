from sqlalchemy import select

from models.user_profile import UserProfile
from repositories.base_repository import BaseRepository


class UserProfileRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, UserProfile)

    def get_by_user_id(self, user_id):
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        return self.session.scalars(stmt).first()
