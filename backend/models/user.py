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

    # nullable=True: un usuario que se registro con Google no tiene
    # contrasena nuestra - AuthService.login ya se encarga de rechazar un
    # intento de login por password contra una cuenta que no tiene una.
    password_hash: Mapped[str | None] = mapped_column(nullable=True)

    # nullable=True en los 3: Google devuelve given_name/family_name en la
    # mayoria de los casos (no garantizado al 100%), y NUNCA devuelve
    # fecha de nacimiento via los scopes basicos de OpenID - no hay forma
    # de pedirsela en el flujo de Google sign-in.
    first_name: Mapped[str | None] = mapped_column(String(250), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(250), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)

    # sub claim del token de Google - identificador estable de esa cuenta
    # de Google, MAS confiable que el email como llave de vinculacion (un
    # email teoricamente podria cambiar de dueno; el sub no). unique=True
    # para que dos usuarios nuestros no puedan terminar apuntando a la
    # misma cuenta de Google.
    google_id: Mapped[str | None] = mapped_column(unique=True, nullable=True)

    # URL a la foto de perfil de Google (claim "picture") - null para
    # cuentas que nunca hicieron login con Google. El frontend (UserMenu)
    # ya tiene el prop listo para recibir esto.
    avatar_url: Mapped[str | None] = mapped_column(nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    user_role: Mapped[UserRoles] = mapped_column(sqlAlchemyEnum(UserRoles), default=UserRoles.user)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)


