from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint, func
import uuid
from datetime import datetime


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.exercise_categories.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    #Guardamos solo la URL (ej. un link de YouTube) - nunca un archivo de video.
    #Sin costo de storage, sin problema de derechos de autor por hostear el video nosotros.
    video_url: Mapped[str] = mapped_column(String(500), nullable=False)

    #Soft delete: "borrar" un ejercicio significa ocultarlo del catalogo (is_active=False),
    #nunca un DELETE fisico - favoritos existentes (y a futuro, historial de workouts) no
    #deben romperse ni perder sentido si el ejercicio deja de estar disponible.
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        #Evita cargar el mismo ejercicio dos veces dentro de la misma categoria.
        UniqueConstraint("category_id", "name", name="uq_category_exercise_name"),
        {"schema": "public"},
    )
