import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


# Una fila por cada solicitud de restablecimiento aceptada. Sirve de registro para los
# límites por correo y por IP, y de almacén del hash del token (nunca el token en claro).
class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    email: Mapped[str] = mapped_column(nullable=False, index=True)

    client_ip: Mapped[str] = mapped_column(String(45), nullable=False)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("public.users.id"), nullable=True, index=True
    )

    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)

    created_at: Mapped[datetime] = mapped_column(nullable=False)

    used_at: Mapped[datetime | None] = mapped_column(nullable=True)

    invalidated_at: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_public_password_reset_requests_client_ip_created_at", "client_ip", "created_at"),
        {"schema": "public"},
    )
