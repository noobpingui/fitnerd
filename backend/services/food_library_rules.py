from dataclasses import dataclass
from decimal import Decimal

from repositories.meal_repository import RecentFoodRow  # noqa: F401 (se reexporta)
from services.catalog_rules import fold
from services.meal_rules import is_db_id

MAX_CUSTOM_FOODS = 500
MAX_FAVORITES = 100
MAX_RECENT_FOODS = 10
CUSTOM_FOODS_LIMIT_MESSAGE = "Ya tienes 500 alimentos propios. Borra alguno para crear otro."
FAVORITES_LIMIT_MESSAGE = "Ya tienes 100 favoritos. Quita alguno para añadir otro."
LIBRARY_KINDS: tuple[str, ...] = ("catalog", "custom")


@dataclass(frozen=True)
class LibraryFood:
    kind: str  # "catalog" | "custom"
    id: str | int
    name: str
    per_100g: dict[str, float]
    favorite: bool
    last_grams: Decimal | None = None


def custom_food_name_key(name: str) -> str:
    # Solo mayúsculas, tildes y espacios no distinguen nombres.
    return " ".join(fold(name).split())


def parse_custom_food_id(value: object) -> int | None:
    if isinstance(value, str):
        if not (value.isascii() and value.isdigit()):
            return None
        value = int(value)
    if not is_db_id(value):
        return None
    return value
