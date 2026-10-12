import math
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models.user_profile import UserProfile

INVALID_BODY_MESSAGE = "Los datos del perfil no son válidos"
INVALID_DOB_MESSAGE = "La fecha de nacimiento no es válida"
FUTURE_DOB_MESSAGE = "La fecha de nacimiento no puede ser futura"
AGE_RANGE_MESSAGE = "Debes tener entre 14 y 100 años"
INVALID_GENDER_MESSAGE = "El género debe ser masculino o femenino"
INVALID_HEIGHT_UNIT_MESSAGE = "La unidad de altura debe ser cm o ft"
HEIGHT_CM_MESSAGE = "La altura debe estar entre 100 y 250 cm"
HEIGHT_FT_MESSAGE = "La altura debe estar entre 3 y 8 ft, y las pulgadas entre 0 y 11"
INVALID_WEIGHT_UNIT_MESSAGE = "La unidad de peso debe ser kg o lb"
WEIGHT_KG_MESSAGE = "El peso debe estar entre 30 y 300 kg"
WEIGHT_LB_MESSAGE = "El peso debe estar entre 66 y 660 lb"
INVALID_ACTIVITY_MESSAGE = "El nivel de actividad no es válido"
INVALID_GOAL_MESSAGE = "La meta no es válida"
USER_NOT_FOUND_MESSAGE = "Usuario no encontrado"

GENDERS = ("male", "female")
HEIGHT_UNITS = ("cm", "ft")
WEIGHT_UNITS = ("kg", "lb")
ACTIVITY_LEVELS = ("low", "moderate", "high", "very_high", "athlete")
GOALS = ("lose", "lose_slow", "maintain", "gain_slow", "gain")

MIN_AGE = 14
MAX_AGE = 100
WEIGHT_RANGES = {"kg": (30, 300, WEIGHT_KG_MESSAGE), "lb": (66, 660, WEIGHT_LB_MESSAGE)}

DOB_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def age_on(date_of_birth, today):
    """Años cumplidos; quien cumple hoy ya tiene la edad nueva."""
    before_birthday = (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    return today.year - date_of_birth.year - before_birthday


def _is_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _round1(value):
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _parse_dob(value, today):
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


def _validate(data, today):
    """Función pura: devuelve los datos limpios o lanza el primer ValidationError."""
    if not isinstance(data, dict):
        raise ValidationError(INVALID_BODY_MESSAGE)

    dob = _parse_dob(data.get("date_of_birth"), today)

    gender = data.get("gender")
    if gender not in GENDERS:
        raise ValidationError(INVALID_GENDER_MESSAGE)

    height_unit = data.get("height_unit")
    if height_unit not in HEIGHT_UNITS:
        raise ValidationError(INVALID_HEIGHT_UNIT_MESSAGE)

    height_cm = height_ft = height_in = None
    if height_unit == "cm":
        raw = data.get("height_cm")
        if not _is_number(raw) or not 100 <= raw <= 250:
            raise ValidationError(HEIGHT_CM_MESSAGE)
        height_cm = _round1(raw)
    else:
        height_ft = data.get("height_ft")
        if not _is_int(height_ft) or not 3 <= height_ft <= 8:
            raise ValidationError(HEIGHT_FT_MESSAGE)
        height_in = data.get("height_in")
        if height_in is None:
            height_in = 0
        elif not _is_int(height_in) or not 0 <= height_in <= 11:
            raise ValidationError(HEIGHT_FT_MESSAGE)

    weight_unit = data.get("weight_unit")
    if weight_unit not in WEIGHT_UNITS:
        raise ValidationError(INVALID_WEIGHT_UNIT_MESSAGE)
    low, high, message = WEIGHT_RANGES[weight_unit]
    weight = data.get("weight")
    if not _is_number(weight) or not low <= weight <= high:
        raise ValidationError(message)

    activity_level = data.get("activity_level")
    if activity_level not in ACTIVITY_LEVELS:
        raise ValidationError(INVALID_ACTIVITY_MESSAGE)

    goal = data.get("goal")
    if goal not in GOALS:
        raise ValidationError(INVALID_GOAL_MESSAGE)

    return {
        "date_of_birth": dob,
        "gender": gender,
        "height_unit": height_unit,
        "height_cm": height_cm,
        "height_ft": height_ft,
        "height_in": height_in,
        "weight_unit": weight_unit,
        "weight": _round1(weight),
        "activity_level": activity_level,
        "goal": goal,
    }


@dataclass
class ProfileState:
    user: object
    profile: object


class ProfileService:
    def __init__(self, user_repository, user_profile_repository, unit_of_work, clock=utc_now):
        self.user_repository = user_repository
        self.user_profile_repository = user_profile_repository
        self.unit_of_work = unit_of_work
        self.clock = clock

    def get_profile(self, user_id):
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)
        profile = self.user_profile_repository.get_by_user_id(user.id)
        return ProfileState(user, profile)

    def save_profile(self, user_id, data):
        # Se valida antes de tocar nada: un 400 no modifica el estado.
        cleaned = _validate(data, self.clock().date())

        try:
            user = self.user_repository.get_by_id_for_update(user_id)
            if user is None:
                raise ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)

            user.date_of_birth = cleaned.pop("date_of_birth")

            profile = self.user_profile_repository.get_by_user_id(user.id)
            if profile is None:
                profile = UserProfile(user_id=user.id)
                self.user_profile_repository.create(profile)
            for column, value in cleaned.items():
                setattr(profile, column, value)

            if user.onboarding_completed_at is None:
                user.onboarding_completed_at = self.clock()

            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

        return ProfileState(user, profile)
