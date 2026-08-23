from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, func
import uuid
from datetime import  datetime

class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    source_key: Mapped[str] = mapped_column(String(250), nullable=False) #The route/key file in S3
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

