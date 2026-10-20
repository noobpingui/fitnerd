from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from services.auth_input_rules import INVALID_REQUEST_MESSAGE  # noqa: F401

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


def parse_meal_date(_value: object) -> date:
    raise NotImplementedError("not implemented")


def check_add_window(_meal_date: date, _today: date) -> None:
    raise NotImplementedError("not implemented")


def parse_meal_type(_value: object) -> str:
    raise NotImplementedError("not implemented")


def validate_grams(_value: object) -> Decimal:
    raise NotImplementedError("not implemented")


def parse_items(_value: object) -> list[UsdaItemInput | CustomItemInput]:
    raise NotImplementedError("not implemented")


def portion_nutrients(
    _per_100g: dict[str, float | int | None], _grams: Decimal
) -> dict[str, Decimal | None]:
    raise NotImplementedError("not implemented")


def sum_nutrients(
    _nutrients: list[dict[str, Decimal | None]],
) -> tuple[dict[str, Decimal], list[str]]:
    raise NotImplementedError("not implemented")


def is_db_id(_value: object) -> bool:
    raise NotImplementedError("not implemented")
