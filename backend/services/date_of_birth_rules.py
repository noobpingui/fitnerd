"""Reglas de la fecha de nacimiento compartidas por el perfil y el registro."""
import re
from datetime import date

from exceptions.custom_exceptions import ValidationError

INVALID_DOB_MESSAGE = "La fecha de nacimiento no es válida"
FUTURE_DOB_MESSAGE = "La fecha de nacimiento no puede ser futura"
AGE_RANGE_MESSAGE = "Debes tener entre 14 y 100 años"

MIN_AGE = 14
MAX_AGE = 100

DOB_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def age_on(date_of_birth, today):
    """Años cumplidos; quien cumple hoy ya tiene la edad nueva."""
    before_birthday = (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    return today.year - date_of_birth.year - before_birthday


def parse_date_of_birth(value, today):
    # El regex es obligatorio: fromisoformat también acepta "20010101" o "2001-W01-1".
    if not isinstance(value, str) or not DOB_PATTERN.match(value):
        raise ValidationError(INVALID_DOB_MESSAGE)
    try:
        dob = date.fromisoformat(value)
    except ValueError:
        raise ValidationError(INVALID_DOB_MESSAGE)
    if dob > today:
        raise ValidationError(FUTURE_DOB_MESSAGE)
    if not MIN_AGE <= age_on(dob, today) <= MAX_AGE:
        raise ValidationError(AGE_RANGE_MESSAGE)
    return dob
