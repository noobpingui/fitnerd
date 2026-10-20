from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, Computed, Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

FOOD_DATA_TYPES: tuple[str, ...] = ("foundation", "sr_legacy")


class Food(Base):
    __tablename__ = "foods"

    fdc_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    data_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # None = sin dato
    calories_kcal: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    # None = sin representación semántica (pendiente)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024), nullable=True)

    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english'::regconfig, description)", persisted=True),
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("data_type IN ('foundation', 'sr_legacy')", name="ck_foods_data_type"),
        Index("ix_foods_search_vector", "search_vector", postgresql_using="gin"),
        {"schema": "public"},
    )
