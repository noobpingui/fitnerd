import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

# También es el orden del diario.
MEAL_TYPES: tuple[str, ...] = ("breakfast", "lunch", "dinner", "snack")
MEAL_ITEM_SOURCES: tuple[str, ...] = ("usda", "custom")


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False)
    meal_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    items: Mapped[list["MealItem"]] = relationship(
        back_populates="meal",
        cascade="all, delete-orphan",
        order_by="(MealItem.position, MealItem.id)",
    )

    __table_args__ = (
        CheckConstraint(
            "meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')",
            name="ck_meals_meal_type",
        ),
        UniqueConstraint(
            "user_id", "meal_date", "meal_type", name="uq_meals_user_id_meal_date_meal_type"
        ),
        {"schema": "public"},
    )


class MealItem(Base):
    __tablename__ = "meal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meal_id: Mapped[int] = mapped_column(
        ForeignKey("public.meals.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False)
    # Sin FK a foods: el historial no depende de la tabla de alimentos (ADR-0030).
    fdc_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    data_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    grams: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)

    # Copia de los valores por 100 g; None = sin dato.
    per_100g_calories_kcal: Mapped[float | None] = mapped_column(Float, nullable=True)
    per_100g_protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    per_100g_carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    per_100g_fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Nutrientes de la porción; None si su valor por 100 g es None.
    calories_kcal: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    protein_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    carbs_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    fat_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    meal: Mapped["Meal"] = relationship(back_populates="items")

    __table_args__ = (
        CheckConstraint("source IN ('usda', 'custom')", name="ck_meal_items_source"),
        CheckConstraint(
            "data_type IS NULL OR data_type IN ('foundation', 'sr_legacy')",
            name="ck_meal_items_data_type",
        ),
        CheckConstraint("grams >= 1 AND grams <= 2000", name="ck_meal_items_grams"),
        CheckConstraint(
            "(source = 'usda' AND fdc_id IS NOT NULL AND data_type IS NOT NULL) OR "
            "(source = 'custom' AND fdc_id IS NULL AND data_type IS NULL)",
            name="ck_meal_items_source_fields",
        ),
        Index("ix_meal_items_meal_id", "meal_id"),
        {"schema": "public"},
    )
