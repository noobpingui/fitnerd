from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, ForeignKey, func
import uuid
from datetime import datetime


class ExerciseCategory(Base):
    __tablename__ = "exercise_categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    #Nivel 1 del catalogo (Tren Superior/Inferior/Zona Media). nullable=False: toda
    #categoria tiene que colgar de una region, no existen categorias "sueltas".
    body_region_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.body_regions.id"), nullable=False, index=True
    )

    #unique=True: no tiene sentido tener dos categorias "Pecho" - es data de catalogo, no de usuario.
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    #Soft delete: "borrar" una categoria significa ocultarla del catalogo (is_active=False),
    #nunca un DELETE fisico - los exercises que la referencian no deben romperse ni perder sentido.
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
