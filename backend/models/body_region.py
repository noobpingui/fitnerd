from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, func
import uuid
from datetime import datetime


class BodyRegion(Base):
    __tablename__ = "body_regions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    #unique=True: mismo criterio que ExerciseCategory.name - no tiene sentido tener dos
    #regiones "Tren Superior", es data de catalogo, no de usuario.
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    #Soft delete: identico criterio que ExerciseCategory - "borrar" una region oculta
    #tambien (indirectamente) a todas las categorias que cuelgan de ella, pero no las toca
    #en la base de datos.
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
