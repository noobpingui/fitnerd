import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from exceptions.custom_exceptions import ValidationError
from models.meal import MEAL_TYPES
from services.auth_input_rules import INVALID_REQUEST_MESSAGE  # noqa: F401
from services.number_validation import is_int, is_number

INVALID_DATE_MESSAGE = "La fecha no es válida."
DATE_OUT_OF_WINDOW_MESSAGE = "Solo puedes registrar comidas de hoy."
INVALID_MEAL_TYPE_MESSAGE = "El tipo de comida no es válido."
ITEMS_REQUIRED_MESSAGE = "Añade al menos un alimento."
TOO_MANY_ITEMS_MESSAGE = "Una comida no puede tener más de 50 alimentos."
ITEM_SOURCE_MESSAGE = "Cada alimento debe ser de USDA o personalizado."
GRAMS_RANGE_MESSAGE = "Los gramos deben estar entre 1 y 2000."
GRAMS_DECIMALS_MESSAGE = "Los gramos admiten como mucho un decimal."
FOOD_NOT_FOUND_MESSAGE = "No encontramos ese alimento."
NAME_REQUIRED_MESSAGE = "Escribe el nombre del alimento."
NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres."
PER_100G_REQUIRED_MESSAGE = "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
CALORIES_RANGE_MESSAGE = "Las calorías por 100 g deben estar entre 0 y 900."
MACROS_RANGE_MESSAGE = "Los macros por 100 g deben estar entre 0 y 100 g."
MACROS_SUM_MESSAGE = (
    "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
)
MEAL_NOT_FOUND_MESSAGE = "No encontramos esa comida."
ITEM_NOT_FOUND_MESSAGE = "No encontramos ese alimento en la comida."

NUTRIENT_KEYS: tuple[str, ...] = ("calories_kcal", "protein_g", "carbs_g", "fat_g")
MAX_ITEMS_PER_MEAL = 50
MAX_NAME_CHARS = 100
GRAMS_RANGE = (1, 2000)
CALORIES_PER_100G_RANGE = (0, 900)
MACRO_PER_100G_RANGE = (0, 100)
MAX_DB_INTEGER = 2_147_483_647


@dataclass(frozen=True)
class UsdaItemInput:
    fdc_id: int
    grams: Decimal


@dataclass(frozen=True)
class CustomItemInput:
    name: str
    grams: Decimal
    per_100g: dict[str, float]


_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CENTS = Decimal("0.01")
_TENTH = Decimal("0.1")


def parse_meal_date(value: object) -> date:
    if not isinstance(value, str) or not _DATE_PATTERN.fullmatch(value):
        raise ValidationError(INVALID_DATE_MESSAGE)
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError(INVALID_DATE_MESSAGE) from None


def check_add_window(meal_date: date, today: date) -> None:
    if not (today - timedelta(days=1) <= meal_date <= today + timedelta(days=1)):
        raise ValidationError(DATE_OUT_OF_WINDOW_MESSAGE)


def parse_meal_type(value: object) -> str:
    if not isinstance(value, str) or value not in MEAL_TYPES:
        raise ValidationError(INVALID_MEAL_TYPE_MESSAGE)
    return value


def validate_grams(value: object) -> Decimal:
    low, high = GRAMS_RANGE
    if not is_number(value) or value < low or value > high:
        raise ValidationError(GRAMS_RANGE_MESSAGE)
    exact = Decimal(repr(value))
    if exact.normalize().as_tuple().exponent < -1:
        raise ValidationError(GRAMS_DECIMALS_MESSAGE)
    return exact.quantize(_TENTH)


def _parse_usda_item(item: dict, grams: Decimal) -> UsdaItemInput:
    fdc_id = item.get("fdc_id")
    if not is_int(fdc_id) or not 1 <= fdc_id <= MAX_DB_INTEGER:
        raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
    return UsdaItemInput(fdc_id=fdc_id, grams=grams)


def _parse_per_100g(value: object) -> dict[str, float]:
    if not isinstance(value, dict):
        raise ValidationError(PER_100G_REQUIRED_MESSAGE)
    for key in NUTRIENT_KEYS:
        if not is_number(value.get(key)):
            raise ValidationError(PER_100G_REQUIRED_MESSAGE)
    calories_low, calories_high = CALORIES_PER_100G_RANGE
    if not calories_low <= value["calories_kcal"] <= calories_high:
        raise ValidationError(CALORIES_RANGE_MESSAGE)
    macro_low, macro_high = MACRO_PER_100G_RANGE
    macros = [value[key] for key in NUTRIENT_KEYS if key != "calories_kcal"]
    if any(not macro_low <= macro <= macro_high for macro in macros):
        raise ValidationError(MACROS_RANGE_MESSAGE)
    if sum(Decimal(repr(macro)) for macro in macros) > macro_high:
        raise ValidationError(MACROS_SUM_MESSAGE)
    return {key: float(value[key]) for key in NUTRIENT_KEYS}


def _parse_custom_item(item: dict, grams: Decimal) -> CustomItemInput:
    name = item.get("name")
    cleaned = name.strip() if isinstance(name, str) else ""
    if cleaned == "":
        raise ValidationError(NAME_REQUIRED_MESSAGE)
    if len(cleaned) > MAX_NAME_CHARS:
        raise ValidationError(NAME_TOO_LONG_MESSAGE)
    return CustomItemInput(
        name=cleaned, grams=grams, per_100g=_parse_per_100g(item.get("per_100g"))
    )


def parse_items(value: object) -> list[UsdaItemInput | CustomItemInput]:
    if not isinstance(value, list) or not value:
        raise ValidationError(ITEMS_REQUIRED_MESSAGE)
    if len(value) > MAX_ITEMS_PER_MEAL:
        raise ValidationError(TOO_MANY_ITEMS_MESSAGE)
    parsed: list[UsdaItemInput | CustomItemInput] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValidationError(ITEM_SOURCE_MESSAGE)
        has_fdc_id = item.get("fdc_id") is not None
        has_name = item.get("name") is not None
        if has_fdc_id == has_name:
            raise ValidationError(ITEM_SOURCE_MESSAGE)
        grams = validate_grams(item.get("grams"))
        if has_fdc_id:
            parsed.append(_parse_usda_item(item, grams))
        else:
            parsed.append(_parse_custom_item(item, grams))
    return parsed


def portion_nutrients(
    per_100g: dict[str, float | int | None], grams: Decimal
) -> dict[str, Decimal | None]:
    result: dict[str, Decimal | None] = {}
    for key in NUTRIENT_KEYS:
        raw = per_100g.get(key)
        if raw is None:
            result[key] = None
            continue
        amount = Decimal(raw) if is_int(raw) else Decimal(repr(raw))
        result[key] = (amount * grams / Decimal(100)).quantize(_CENTS, ROUND_HALF_UP)
    return result


def sum_nutrients(
    nutrients: list[dict[str, Decimal | None]],
) -> tuple[dict[str, Decimal], list[str]]:
    totals = {key: Decimal("0") for key in NUTRIENT_KEYS}
    incomplete: list[str] = []
    for key in NUTRIENT_KEYS:
        for entry in nutrients:
            amount = entry.get(key)
            if amount is None:
                if key not in incomplete:
                    incomplete.append(key)
            else:
                totals[key] += amount
    return totals, incomplete


def is_db_id(value: object) -> bool:
    return is_int(value) and 1 <= value <= MAX_DB_INTEGER
