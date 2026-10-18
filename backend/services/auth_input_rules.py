"""Reglas del cuerpo de las peticiones de autenticación y de los nombres del registro."""
from exceptions.custom_exceptions import ValidationError

INVALID_REQUEST_MESSAGE = "La petición no es válida"
FIRST_NAME_REQUIRED_MESSAGE = "El nombre es obligatorio"
FIRST_NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres"
LAST_NAME_REQUIRED_MESSAGE = "El apellido es obligatorio"
LAST_NAME_TOO_LONG_MESSAGE = "El apellido no puede superar los 100 caracteres"
MAX_NAME_CHARS = 100


def require_json_object(body: object) -> dict:
    """Devuelve `body` si es un dict; si no (None, lista, número, texto...), lanza
    ValidationError(INVALID_REQUEST_MESSAGE)."""
    if not isinstance(body, dict):
        raise ValidationError(INVALID_REQUEST_MESSAGE)
    return body


def _validate_name(value: object, required_message: str, too_long_message: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(required_message)
    cleaned = value.strip()
    if cleaned == "":
        raise ValidationError(required_message)
    if len(cleaned) > MAX_NAME_CHARS:
        raise ValidationError(too_long_message)
    return cleaned


def validate_first_name(value: object) -> str:
    """Devuelve el nombre sin los espacios de los extremos. Lanza ValidationError con
    FIRST_NAME_REQUIRED_MESSAGE si no es texto o queda vacío, y con
    FIRST_NAME_TOO_LONG_MESSAGE si recortado supera MAX_NAME_CHARS caracteres."""
    return _validate_name(value, FIRST_NAME_REQUIRED_MESSAGE, FIRST_NAME_TOO_LONG_MESSAGE)


def validate_last_name(value: object) -> str:
    """Igual que validate_first_name, con los mensajes del apellido."""
    return _validate_name(value, LAST_NAME_REQUIRED_MESSAGE, LAST_NAME_TOO_LONG_MESSAGE)
