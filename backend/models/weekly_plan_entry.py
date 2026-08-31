from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, UniqueConstraint, SmallInteger, func
import uuid
from datetime import datetime


class WeeklyPlanEntry(Base):
    __tablename__ = "weekly_plan_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False, index=True)
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.exercises.id"), nullable=False, index=True)

    #0 = Domingo ... 6 = Sabado (mismo criterio que Date.getDay() en JS, asi el
    #frontend no tiene que traducir el numero).
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        #Soltar el mismo ejercicio dos veces sobre el mismo dia es un no-op, no un
        #duplicado - la constraint es lo que hace cumplir eso a nivel de datos.
        UniqueConstraint("user_id", "exercise_id", "day_of_week", name="uq_user_exercise_day"),
        {"schema": "public"},
    )
