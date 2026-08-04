from models.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Enum as sqlAlchemyEnum, Date, func
from enum import Enum as PyEnum
import uuid
from datetime import date, datetime


class UserRoles(str, PyEnum):
    admin = "admin"
    user = "user"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    first_name: Mapped[str] = mapped_column(String(250), nullable=False)
    last_name: Mapped[str] = mapped_column(String(250), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)

    
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    user_role: Mapped[UserRoles] = mapped_column(sqlAlchemyEnum(UserRoles), default=UserRoles.user)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)


