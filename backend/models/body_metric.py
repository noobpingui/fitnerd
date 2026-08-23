from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, Text, Date, func
import uuid
from datetime import date, datetime


class BodyMetric(Base):
    __tablename__ = "body_metrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False, index=True)

    #Todos nullable a proposito: es un "check-in" combinado, pero no todos los campos
    #se cargan siempre (ej. puede que un dia solo se registre el peso).
    weight: Mapped[float | None] = mapped_column(nullable=True)
    body_fat_percentage: Mapped[float | None] = mapped_column(nullable=True)
    muscle_mass_percentage: Mapped[float | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    #La fecha a la que corresponde el registro (puede cargarse en el momento o despues,
    #a diferencia de created_at que siempre es "ahora mismo").
    recorded_at: Mapped[date] = mapped_column(Date, nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "public"},
    )
