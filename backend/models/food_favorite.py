import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class FoodFavorite(Base):
    __tablename__ = "food_favorites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False)
    # Sin FK a catalog_foods (ADR-0031).
    catalog_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    custom_food_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "public.custom_foods.id", ondelete="CASCADE", name="fk_food_favorites_custom_food_id"
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "(catalog_id IS NULL) <> (custom_food_id IS NULL)", name="ck_food_favorites_one_food"
        ),
        UniqueConstraint("user_id", "catalog_id", name="uq_food_favorites_user_id_catalog_id"),
        UniqueConstraint(
            "user_id", "custom_food_id", name="uq_food_favorites_user_id_custom_food_id"
        ),
        {"schema": "public"},
    )
