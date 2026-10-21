from datetime import datetime

from sqlalchemy import CheckConstraint, Float, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

CATALOG_SOURCES: tuple[str, ...] = ("usda", "manual")


class CatalogFood(Base):
    __tablename__ = "catalog_foods"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    synonyms: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'")
    )

    # Valores por 100 g.
    calories_kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    source: Mapped[str] = mapped_column(String(10), nullable=False)
    # Sin FK a foods (ADR-0031).
    fdc_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reference: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "char_length(id) BETWEEN 2 AND 60 AND id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
            name="ck_catalog_foods_id_format",
        ),
        CheckConstraint(
            "char_length(name) BETWEEN 2 AND 80", name="ck_catalog_foods_name_length"
        ),
        CheckConstraint(
            "calories_kcal >= 0 AND calories_kcal <= 900", name="ck_catalog_foods_calories"
        ),
        CheckConstraint(
            "protein_g >= 0 AND protein_g <= 100 AND carbs_g >= 0 AND carbs_g <= 100 "
            "AND fat_g >= 0 AND fat_g <= 100",
            name="ck_catalog_foods_macros",
        ),
        CheckConstraint("source IN ('usda', 'manual')", name="ck_catalog_foods_source"),
        CheckConstraint(
            "(source = 'usda' AND fdc_id IS NOT NULL) OR "
            "(source = 'manual' AND fdc_id IS NULL AND reference IS NOT NULL)",
            name="ck_catalog_foods_source_fields",
        ),
        {"schema": "public"},
    )
