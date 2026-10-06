from sqlalchemy import func, select, update

from models.password_reset_request import PasswordResetRequest
from repositories.base_repository import BaseRepository


class PasswordResetRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, PasswordResetRequest)

    def lock_keys(self, keys):
        # Advisory locks transaccionales: se liberan solos en el commit o el rollback.
        # El orden alfabético fijo evita interbloqueos entre peticiones concurrentes.
        for key in sorted(keys):
            self.session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))

    def count_recent_by_ip(self, client_ip, since):
        stmt = (
            select(func.count())
            .select_from(PasswordResetRequest)
            .where(PasswordResetRequest.client_ip == client_ip)
            .where(PasswordResetRequest.created_at > since)
        )
        return self.session.scalar(stmt)

    def get_latest_by_email(self, email):
        stmt = (
            select(PasswordResetRequest)
            .where(PasswordResetRequest.email == email)
            .order_by(PasswordResetRequest.created_at.desc())
            .limit(1)
        )
        return self.session.scalars(stmt).first()

    def get_by_token_hash(self, token_hash):
        stmt = select(PasswordResetRequest).where(PasswordResetRequest.token_hash == token_hash)
        return self.session.scalars(stmt).first()

    def invalidate_active_for_user(self, user_id, at):
        stmt = (
            update(PasswordResetRequest)
            .where(PasswordResetRequest.user_id == user_id)
            .where(PasswordResetRequest.used_at.is_(None))
            .where(PasswordResetRequest.invalidated_at.is_(None))
            .values(invalidated_at=at)
        )
        self.session.execute(stmt)
