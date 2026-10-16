import re

INVALID_EMAIL_MESSAGE = "Email inválido"
PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres"
PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga"
MIN_PASSWORD_CHARS = 8
MAX_PASSWORD_BYTES = 72
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(_email: str) -> str:
    raise NotImplementedError("not implemented")


def validate_email(_email: object) -> str:
    raise NotImplementedError("not implemented")


def validate_new_password(_password: object) -> str:
    raise NotImplementedError("not implemented")


def exceeds_bcrypt_limit(_password: str) -> bool:
    raise NotImplementedError("not implemented")
