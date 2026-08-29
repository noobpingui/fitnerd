from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, Text, String, func
import uuid
from datetime import datetime


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False, index=True)

    #String simple en vez de un ENUM de Postgres a proposito: si mas adelante se agrega o
    #renombra una categoria, alcanza con actualizar la validacion en FeedbackService, sin
    #necesidad de una migracion que altere el tipo en la base de datos.
    category: Mapped[str] = mapped_column(String(20), nullable=False)

    message: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "public"},
    )
