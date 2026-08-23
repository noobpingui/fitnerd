from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func, ForeignKey, Text, UniqueConstraint
from pgvector.sqlalchemy import Vector

import uuid
from datetime import  datetime

class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    video_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.videos.id"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(nullable=False) 
    chunk_text: Mapped[str] = mapped_column(Text)

    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=True) #Embedding with 1024 dimentions for Voyage ai 
    
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)


    #Restrictions
    __table_args__ = (

        UniqueConstraint('video_id', 'chunk_index', name='uq_video_chunk'), #To force PostgresSQL to restrict saving duplicated chuncks with the same 'indice'
        {"schema": "public"}, #Se necesita indicar nuevamente porque si no este __table_args__ invalida el de base.py
    )

