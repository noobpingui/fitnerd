from dataclasses import dataclass
from decimal import Decimal

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


@dataclass(frozen=True)
class RecentFoodRow:
    catalog_id: str | None
    custom_food_id: int | None
    grams: Decimal


def custom_food_name_key(_name: str) -> str:
    raise NotImplementedError("not implemented")


def parse_custom_food_id(_value: object) -> int | None:
    raise NotImplementedError("not implemented")
