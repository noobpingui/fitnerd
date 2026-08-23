from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, UniqueConstraint, func
import uuid
from datetime import datetime


class ExerciseFavorite(Base):
    __tablename__ = "exercise_favorites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False, index=True)
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.exercises.id"), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        #Evita marcar el mismo ejercicio como favorito dos veces para el mismo usuario.
        UniqueConstraint("user_id", "exercise_id", name="uq_user_exercise_favorite"),
        {"schema": "public"},
    )
