import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


# Datos físicos del usuario tal como los escribió (en su unidad). 1:1 con users:
# la clave primaria es user_id. Los valores permitidos los garantiza ProfileService.
class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), primary_key=True)

    gender: Mapped[str] = mapped_column(String(8), nullable=False)

    height_unit: Mapped[str] = mapped_column(String(2), nullable=False)
    height_cm: Mapped[float | None] = mapped_column(nullable=True)
    height_ft: Mapped[int | None] = mapped_column(nullable=True)
    height_in: Mapped[int | None] = mapped_column(nullable=True)

    weight_unit: Mapped[str] = mapped_column(String(2), nullable=False)
    weight: Mapped[float] = mapped_column(nullable=False)

    activity_level: Mapped[str] = mapped_column(String(16), nullable=False)
    goal: Mapped[str] = mapped_column(String(16), nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = ({"schema": "public"},)
