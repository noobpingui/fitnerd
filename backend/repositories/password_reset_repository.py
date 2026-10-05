from repositories.base_repository import BaseRepository
from models.password_reset_request import PasswordResetRequest


class PasswordResetRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, PasswordResetRequest)

    def lock_keys(self, _keys):
        raise NotImplementedError

    def count_recent_by_ip(self, _client_ip, _since):
        raise NotImplementedError

    def get_latest_by_email(self, _email):
        raise NotImplementedError

    def get_by_token_hash(self, _token_hash):
        raise NotImplementedError

    def invalidate_active_for_user(self, _user_id, _at):
        raise NotImplementedError
