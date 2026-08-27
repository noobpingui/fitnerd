from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, func
import uuid
from datetime import datetime


#Un registro por cada vez que ProgressAnalysisService realmente le pega a Claude (no se
#loguea el intento cuando corta antes por "no hay datos" - eso no gasta tokens, ver
#ProgressAnalysisService.analyze). Solo existe para poder contar cuantas veces corrio en
#las ultimas 24hs y frenar el limite - no guardamos el texto del analisis en si, no hace
#falta para la regla de negocio actual.
class ProgressAnalysis(Base):
    __tablename__ = "progress_analyses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.users.id"), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "public"},
    )
