import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError, ValidationError
from models.password_reset_request import PasswordResetRequest
from services.credential_rules import (  # noqa: F401  (se reexportan: otros módulos las importan desde aquí)
    EMAIL_PATTERN,
    INVALID_EMAIL_MESSAGE,
    MAX_PASSWORD_BYTES,
    MIN_PASSWORD_CHARS,
    PASSWORD_TOO_LONG_MESSAGE,
    PASSWORD_TOO_SHORT_MESSAGE,
    validate_email,
    validate_new_password,
)

logger = logging.getLogger(__name__)

REQUEST_ACCEPTED_MESSAGE = (
    "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."
)
PASSWORD_UPDATED_MESSAGE = "Contraseña actualizada"
IP_RATE_LIMITED_MESSAGE = "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."
EMAIL_RATE_LIMITED_MESSAGE = (
    "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."
)
EMAIL_SEND_FAILED_MESSAGE = "No se pudo enviar el correo. Inténtalo de nuevo más tarde."
INVALID_LINK_MESSAGE = "El enlace no es válido o ha caducado. Solicita uno nuevo."

EMAIL_COOLDOWN = timedelta(minutes=2)
IP_WINDOW = timedelta(minutes=10)
IP_MAX_REQUESTS = 3
TOKEN_TTL = timedelta(minutes=5)


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
        email = validate_email(email)

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

    def _ensure_link_is_usable(self, row, now):
        if (
            row is None
            or row.user_id is None
            or row.used_at is not None
            or row.invalidated_at is not None
            or now - row.created_at >= TOKEN_TTL
        ):
            raise ValidationError(INVALID_LINK_MESSAGE)

    def reset_password(self, token, password):
        # Un único instante por petición para todas las comprobaciones y para used_at.
        now = self.clock()
        if not isinstance(token, str) or not token:
            raise ValidationError(INVALID_LINK_MESSAGE)

        try:
            token_hash = hash_token(token)
            repo = self.password_reset_repository

            # Primero sin bloqueo: un enlace o una contraseña inválidos fallan sin esperar
            # ni consumir el enlace.
            row = repo.get_by_token_hash(token_hash)
            self._ensure_link_is_usable(row, now)
            validate_new_password(password)
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

            # Después se relee con FOR UPDATE y se revalida: si otra petición consumió el
            # enlace mientras esperábamos, esta recibe "enlace no válido". El rollback de
            # abajo libera el bloqueo también cuando se lanza un ValidationError.
            row = repo.get_by_token_hash_for_update(token_hash)
            self._ensure_link_is_usable(row, now)

            user = self.user_repository.get_by_id(row.user_id)
            if user is None:
                raise ValidationError(INVALID_LINK_MESSAGE)

            user.password_hash = hashed.decode("utf-8")
            row.used_at = now
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
