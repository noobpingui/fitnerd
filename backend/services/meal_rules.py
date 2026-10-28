import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from exceptions.custom_exceptions import ValidationError
from models.meal import MEAL_ITEM_SOURCES, MEAL_TYPES
from services.auth_input_rules import INVALID_REQUEST_MESSAGE  # noqa: F401
from services.catalog_rules import is_catalog_id
from services.number_validation import is_int, is_number

INVALID_DATE_MESSAGE = "La fecha no es válida."
DATE_OUT_OF_WINDOW_MESSAGE = "Solo puedes registrar comidas de hoy o del último año."
INVALID_MEAL_TYPE_MESSAGE = "El tipo de comida no es válido."
ITEMS_REQUIRED_MESSAGE = "Añade al menos un alimento."
TOO_MANY_ITEMS_MESSAGE = "Una comida no puede tener más de 50 alimentos."
ITEM_SOURCE_MESSAGE = "Cada alimento debe ser del catálogo, de USDA o personalizado."
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
ADD_WINDOW_PAST_DAYS = 366
ADD_WINDOW_FUTURE_DAYS = 1
RESTORE_TOKEN_TTL_SECONDS = 120


@dataclass(frozen=True)
class CatalogItemInput:
    catalog_id: str
    grams: Decimal


@dataclass(frozen=True)
class UsdaItemInput:
    fdc_id: int
    grams: Decimal


@dataclass(frozen=True)
class CustomItemInput:
    name: str
    grams: Decimal
    per_100g: dict[str, float]


@dataclass(frozen=True)
class LibraryItemInput:
    custom_food_id: int
    grams: Decimal


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


@dataclass(frozen=True)
class RemovedItemSnapshot:
    meal_date: date
    meal_type: str
    position: int
    source: str
    catalog_id: str | None
    fdc_id: int | None
    name: str
    data_type: str | None
    grams: Decimal
    per_100g: dict[str, float | None]
    expires_at: int
    custom_food_id: int | None = None


def epoch_seconds(instant: datetime) -> int:
    # El instante es naive y está en UTC (utc_now / AdjustableClock).
    return int(instant.replace(tzinfo=timezone.utc).timestamp())


def snapshot_payload(snapshot: RemovedItemSnapshot) -> dict:
    return {
        "v": 1,
        "d": snapshot.meal_date.isoformat(),
        "t": snapshot.meal_type,
        "p": snapshot.position,
        "s": snapshot.source,
        "c": snapshot.catalog_id,
        "f": snapshot.fdc_id,
        "n": snapshot.name,
        "dt": snapshot.data_type,
        "g": str(snapshot.grams),
        "per": {
            key: None if snapshot.per_100g.get(key) is None else float(snapshot.per_100g[key])
            for key in NUTRIENT_KEYS
        },
        "exp": snapshot.expires_at,
        **({} if snapshot.custom_food_id is None else {"cf": snapshot.custom_food_id}),
    }


def _optional_text(value: object) -> bool:
    return value is None or isinstance(value, str)


def _parse_snapshot_per_100g(value: object) -> dict[str, float | None] | None:
    if not isinstance(value, dict):
        return None
    parsed: dict[str, float | None] = {}
    for key in NUTRIENT_KEYS:
        if key not in value:
            return None
        amount = value[key]
        if amount is not None and not is_number(amount):
            return None
        parsed[key] = None if amount is None else float(amount)
    return parsed


def parse_snapshot_payload(payload: object) -> RemovedItemSnapshot | None:
    if not isinstance(payload, dict):
        return None
    version = payload.get("v")
    if not is_int(version) or version != 1:
        return None

    raw_date = payload.get("d")
    if not isinstance(raw_date, str) or not _DATE_PATTERN.fullmatch(raw_date):
        return None
    try:
        meal_date = date.fromisoformat(raw_date)
    except ValueError:
        return None

    meal_type = payload.get("t")
    source = payload.get("s")
    position = payload.get("p")
    name = payload.get("n")
    catalog_id = payload.get("c")
    fdc_id = payload.get("f")
    data_type = payload.get("dt")
    expires_at = payload.get("exp")
    if meal_type not in MEAL_TYPES or source not in MEAL_ITEM_SOURCES:
        return None
    if not is_int(position) or not 0 <= position <= MAX_DB_INTEGER or not is_int(expires_at):
        return None
    if not isinstance(name, str) or not name:
        return None
    if not _optional_text(catalog_id) or not _optional_text(data_type):
        return None
    if fdc_id is not None and not is_db_id(fdc_id):
        return None
    if source == "catalog" and not catalog_id:
        return None
    if source == "usda" and fdc_id is None:
        return None
    custom_food_id = payload.get("cf")
    if "cf" in payload and (not is_db_id(custom_food_id) or source != "custom"):
        return None

    raw_grams = payload.get("g")
    if not isinstance(raw_grams, str):
        return None
    try:
        grams = Decimal(raw_grams)
    except InvalidOperation:
        return None
    if not grams.is_finite() or not GRAMS_RANGE[0] <= grams <= GRAMS_RANGE[1]:
        return None

    per_100g = _parse_snapshot_per_100g(payload.get("per"))
    if per_100g is None:
        return None

    return RemovedItemSnapshot(
        meal_date=meal_date,
        meal_type=meal_type,
        position=position,
        source=source,
        catalog_id=catalog_id,
        fdc_id=fdc_id,
        name=name,
        data_type=data_type,
        grams=grams,
        per_100g=per_100g,
        expires_at=expires_at,
        custom_food_id=custom_food_id,
    )


def check_add_window(meal_date: date, today: date) -> None:
    earliest = today - timedelta(days=ADD_WINDOW_PAST_DAYS)
    latest = today + timedelta(days=ADD_WINDOW_FUTURE_DAYS)
    if not earliest <= meal_date <= latest:
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


@dataclass(frozen=True)
class CustomFoodFields:
    name: str
    per_100g: dict[str, float]


def parse_custom_food_fields(item: dict) -> CustomFoodFields:
    name = item.get("name")
    cleaned = name.strip() if isinstance(name, str) else ""
    if cleaned == "":
        raise ValidationError(NAME_REQUIRED_MESSAGE)
    if len(cleaned) > MAX_NAME_CHARS:
        raise ValidationError(NAME_TOO_LONG_MESSAGE)
    return CustomFoodFields(name=cleaned, per_100g=_parse_per_100g(item.get("per_100g")))


def _parse_custom_item(item: dict, grams: Decimal) -> CustomItemInput:
    fields = parse_custom_food_fields(item)
    return CustomItemInput(name=fields.name, grams=grams, per_100g=fields.per_100g)


def _parse_catalog_item(item: dict, grams: Decimal) -> CatalogItemInput:
    catalog_id = item.get("catalog_id")
    if not is_catalog_id(catalog_id):
        raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
    return CatalogItemInput(catalog_id=catalog_id, grams=grams)


def _parse_library_item(item: dict, grams: Decimal) -> LibraryItemInput:
    custom_food_id = item.get("custom_food_id")
    if not is_db_id(custom_food_id):
        raise ValidationError(FOOD_NOT_FOUND_MESSAGE)
    return LibraryItemInput(custom_food_id=custom_food_id, grams=grams)


def parse_items(
    value: object,
) -> list[CatalogItemInput | UsdaItemInput | CustomItemInput | LibraryItemInput]:
    if not isinstance(value, list) or not value:
        raise ValidationError(ITEMS_REQUIRED_MESSAGE)
    if len(value) > MAX_ITEMS_PER_MEAL:
        raise ValidationError(TOO_MANY_ITEMS_MESSAGE)
    parsed: list[CatalogItemInput | UsdaItemInput | CustomItemInput | LibraryItemInput] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValidationError(ITEM_SOURCE_MESSAGE)
        present = [
            key
            for key in ("catalog_id", "fdc_id", "name", "custom_food_id")
            if item.get(key) is not None
        ]
        if len(present) != 1:
            raise ValidationError(ITEM_SOURCE_MESSAGE)
        grams = validate_grams(item.get("grams"))
        if present[0] == "catalog_id":
            parsed.append(_parse_catalog_item(item, grams))
        elif present[0] == "fdc_id":
            parsed.append(_parse_usda_item(item, grams))
        elif present[0] == "custom_food_id":
            parsed.append(_parse_library_item(item, grams))
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
