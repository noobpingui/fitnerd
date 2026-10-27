import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class CustomFood(Base):
    __tablename__ = "custom_foods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    name_key: Mapped[str] = mapped_column(Text, nullable=False)

    # Valores por 100 g.
    calories_kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="ck_custom_foods_name_length"),
        CheckConstraint(
            "calories_kcal >= 0 AND calories_kcal <= 900", name="ck_custom_foods_calories"
        ),
        CheckConstraint(
            "protein_g >= 0 AND protein_g <= 100 AND carbs_g >= 0 AND carbs_g <= 100 "
            "AND fat_g >= 0 AND fat_g <= 100",
            name="ck_custom_foods_macros",
        ),
        UniqueConstraint("user_id", "name_key", name="uq_custom_foods_user_id_name_key"),
        {"schema": "public"},
    )
