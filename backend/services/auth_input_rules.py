"""Reglas del cuerpo de las peticiones de autenticación y de los nombres del registro."""
from exceptions.custom_exceptions import ValidationError  # noqa: F401

INVALID_REQUEST_MESSAGE = "La petición no es válida"
FIRST_NAME_REQUIRED_MESSAGE = "El nombre es obligatorio"
FIRST_NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres"
LAST_NAME_REQUIRED_MESSAGE = "El apellido es obligatorio"
LAST_NAME_TOO_LONG_MESSAGE = "El apellido no puede superar los 100 caracteres"
MAX_NAME_CHARS = 100


def require_json_object(_body: object) -> dict:
    """Devuelve `body` si es un dict; si no (None, lista, número, texto...), lanza
    ValidationError(INVALID_REQUEST_MESSAGE)."""
    raise NotImplementedError("not implemented")


def validate_first_name(_value: object) -> str:
    """Devuelve el nombre sin los espacios de los extremos. Lanza ValidationError con
    FIRST_NAME_REQUIRED_MESSAGE si no es texto o queda vacío, y con
    FIRST_NAME_TOO_LONG_MESSAGE si recortado supera MAX_NAME_CHARS caracteres."""
    raise NotImplementedError("not implemented")


def validate_last_name(_value: object) -> str:
    """Igual que validate_first_name, con los mensajes del apellido."""
    raise NotImplementedError("not implemented")
