import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError, ValidationError
from models.password_reset_request import PasswordResetRequest

logger = logging.getLogger(__name__)

REQUEST_ACCEPTED_MESSAGE = (
    "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."
)
PASSWORD_UPDATED_MESSAGE = "Contraseña actualizada"
INVALID_EMAIL_MESSAGE = "Email inválido"
IP_RATE_LIMITED_MESSAGE = "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."
EMAIL_RATE_LIMITED_MESSAGE = (
    "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."
)
EMAIL_SEND_FAILED_MESSAGE = "No se pudo enviar el correo. Inténtalo de nuevo más tarde."
INVALID_LINK_MESSAGE = "El enlace no es válido o ha caducado. Solicita uno nuevo."
PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres"
PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga"

EMAIL_COOLDOWN = timedelta(minutes=2)
IP_WINDOW = timedelta(minutes=10)
IP_MAX_REQUESTS = 3
TOKEN_TTL = timedelta(minutes=5)

MIN_PASSWORD_CHARS = 8
MAX_PASSWORD_BYTES = 72

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


class PasswordResetService:

    def __init__(self, user_repository, password_reset_repository, unit_of_work, email_sender,
                 frontend_base_url, clock=utc_now):
        self.user_repository = user_repository
        self.password_reset_repository = password_reset_repository
        self.unit_of_work = unit_of_work
        self.email_sender = email_sender
        self.frontend_base_url = frontend_base_url
        self.clock = clock

    def request_reset(self, email, client_ip):
        if not isinstance(email, str) or not EMAIL_PATTERN.match(email.strip()):
            raise ValidationError(INVALID_EMAIL_MESSAGE)
        email = email.strip()

        repo = self.password_reset_repository
        try:
            repo.lock_keys([f"password-reset:email:{email}", f"password-reset:ip:{client_ip}"])
            now = self.clock()

            if repo.count_recent_by_ip(client_ip, now - IP_WINDOW) >= IP_MAX_REQUESTS:
                raise RateLimitError(IP_RATE_LIMITED_MESSAGE)

            last = repo.get_latest_by_email(email)
            if last is not None and now - last.created_at < EMAIL_COOLDOWN:
                raise RateLimitError(EMAIL_RATE_LIMITED_MESSAGE)

            user = self.user_repository.get_by_email(email)
            if user is None or not user.password_hash:
                repo.create(PasswordResetRequest(
                    email=email, client_ip=client_ip, user_id=None, token_hash=None, created_at=now,
                ))
                self.unit_of_work.commit()
                return

            token = secrets.token_urlsafe(32)
            reset_url = f"{self.frontend_base_url.rstrip('/')}/reset-password?token={token}"

            # Primero el envío: si falla, no se escribe nada y no se consume ningún límite.
            try:
                self.email_sender.send(
                    to=user.email,
                    subject="Restablece tu contraseña de fitnerd",
                    text=(
                        "Hola,\n\n"
                        "Para restablecer tu contraseña de fitnerd abre este enlace:\n"
                        f"{reset_url}\n\n"
                        "El enlace caduca a los 5 minutos.\n"
                        "Si no pediste este cambio, puedes ignorar este correo.\n"
                    ),
                    html=(
                        "<p>Hola,</p>"
                        "<p>Para restablecer tu contraseña de fitnerd abre este enlace:</p>"
                        f'<p><a href="{reset_url}">Restablecer contraseña</a></p>'
                        "<p>El enlace caduca a los 5 minutos.</p>"
                        "<p>Si no pediste este cambio, puedes ignorar este correo.</p>"
                    ),
                )
            except Exception:
                logger.exception("Fallo al enviar el correo de restablecimiento")
                raise ServiceUnavailableError(EMAIL_SEND_FAILED_MESSAGE)

            repo.invalidate_active_for_user(user.id, now)
            repo.create(PasswordResetRequest(
                email=email, client_ip=client_ip, user_id=user.id,
                token_hash=hash_token(token), created_at=now,
            ))
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def reset_password(self, token, password):
        if not isinstance(token, str) or not token:
            raise ValidationError(INVALID_LINK_MESSAGE)

        row = self.password_reset_repository.get_by_token_hash(hash_token(token))
        now = self.clock()
        if (
            row is None
            or row.user_id is None
            or row.used_at is not None
            or row.invalidated_at is not None
            or now - row.created_at >= TOKEN_TTL
        ):
            raise ValidationError(INVALID_LINK_MESSAGE)

        if not isinstance(password, str) or len(password) < MIN_PASSWORD_CHARS:
            raise ValidationError(PASSWORD_TOO_SHORT_MESSAGE)
        if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValidationError(PASSWORD_TOO_LONG_MESSAGE)

        user = self.user_repository.get_by_id(row.user_id)
        if user is None:
            raise ValidationError(INVALID_LINK_MESSAGE)

        try:
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
            user.password_hash = hashed.decode("utf-8")
            row.used_at = now
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
