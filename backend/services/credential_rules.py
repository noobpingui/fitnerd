"""Reglas de correo y contraseña compartidas por el registro, el login y el restablecimiento."""
import re

from exceptions.custom_exceptions import ValidationError

INVALID_EMAIL_MESSAGE = "Email inválido"
PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres"
PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga"
MIN_PASSWORD_CHARS = 8
MAX_PASSWORD_BYTES = 72
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: object) -> str:
    if not isinstance(email, str) or not EMAIL_PATTERN.match(email.strip()):
        raise ValidationError(INVALID_EMAIL_MESSAGE)
    return normalize_email(email)


def validate_new_password(password: object) -> str:
    if not isinstance(password, str) or len(password) < MIN_PASSWORD_CHARS:
        raise ValidationError(PASSWORD_TOO_SHORT_MESSAGE)
    if exceeds_bcrypt_limit(password):
        raise ValidationError(PASSWORD_TOO_LONG_MESSAGE)
    return password


def exceeds_bcrypt_limit(password: str) -> bool:
    return len(password.encode("utf-8")) > MAX_PASSWORD_BYTES
