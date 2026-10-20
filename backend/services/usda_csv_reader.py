import csv
from dataclasses import dataclass
from pathlib import Path

FOOD_FILE = "food.csv"
FOOD_NUTRIENT_FILE = "food_nutrient.csv"
USDA_DATA_TYPES: dict[str, str] = {"foundation": "foundation_food", "sr_legacy": "sr_legacy_food"}
NUTRIENT_ENERGY_KCAL = 1008
NUTRIENT_ENERGY_ATWATER_GENERAL = 2047
NUTRIENT_ENERGY_ATWATER_SPECIFIC = 2048
NUTRIENT_PROTEIN = 1003
NUTRIENT_FAT = 1004
NUTRIENT_CARBS = 1005


class UsdaFileError(Exception):
    def __init__(self, path: Path, message: str):
        super().__init__(message)
        self.path = path
        self.message = message


@dataclass(frozen=True)
class UsdaFoodRecord:
    fdc_id: int
    description: str
    data_type: str
    calories_kcal: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None


FOOD_REQUIRED_COLUMNS = ("fdc_id", "data_type", "description")
NUTRIENT_REQUIRED_COLUMNS = ("fdc_id", "nutrient_id", "amount")
_WANTED_NUTRIENTS = frozenset(
    {
        NUTRIENT_ENERGY_KCAL,
        NUTRIENT_ENERGY_ATWATER_GENERAL,
        NUTRIENT_ENERGY_ATWATER_SPECIFIC,
        NUTRIENT_PROTEIN,
        NUTRIENT_FAT,
        NUTRIENT_CARBS,
    }
)


def _open_csv(path: Path, required_columns: tuple[str, ...]):
    """Abre el CSV validando que exista y que tenga las columnas obligatorias."""
    if not path.is_file():
        raise UsdaFileError(path, f"No se encontró el archivo {path}.")
    handle = path.open(encoding="utf-8-sig", newline="")
    reader = csv.DictReader(handle)
    fieldnames = reader.fieldnames or []
    for column in required_columns:
        if column not in fieldnames:
            handle.close()
            raise UsdaFileError(
                path, f"Al archivo {path} le falta la columna obligatoria «{column}»."
            )
    return handle, reader


def _invalid_value(path: Path, column: str, line: int) -> UsdaFileError:
    return UsdaFileError(
        path, f"El archivo {path} tiene un valor no válido en la columna «{column}» (línea {line})."
    )


def _to_int(value: str | None, path: Path, column: str, line: int) -> int:
    try:
        return int((value or "").strip())
    except ValueError:
        raise _invalid_value(path, column, line) from None


def _read_foods(path: Path, usda_type: str) -> dict[int, str]:
    handle, reader = _open_csv(path, FOOD_REQUIRED_COLUMNS)
    foods: dict[int, str] = {}
    with handle:
        for row in reader:
            if (row["data_type"] or "").strip() != usda_type:
                continue
            fdc_id = _to_int(row["fdc_id"], path, "fdc_id", reader.line_num)
            foods.setdefault(fdc_id, row["description"] or "")
    if not foods:
        raise UsdaFileError(path, f"El archivo {path} no contiene alimentos de tipo {usda_type}.")
    return foods


def _read_nutrients(path: Path, fdc_ids: set[int]) -> dict[int, dict[int, float | None]]:
    handle, reader = _open_csv(path, NUTRIENT_REQUIRED_COLUMNS)
    values: dict[int, dict[int, float | None]] = {}
    with handle:
        for row in reader:
            fdc_id = _to_int(row["fdc_id"], path, "fdc_id", reader.line_num)
            if fdc_id not in fdc_ids:
                continue
            nutrient_id = _to_int(row["nutrient_id"], path, "nutrient_id", reader.line_num)
            if nutrient_id not in _WANTED_NUTRIENTS:
                continue
            raw_amount = (row["amount"] or "").strip()
            amount: float | None = None
            if raw_amount:
                try:
                    amount = float(raw_amount)
                except ValueError:
                    raise _invalid_value(path, "amount", reader.line_num) from None
            values.setdefault(fdc_id, {}).setdefault(nutrient_id, amount)
    return values


def read_usda_dataset(directory: Path | str, data_type: str) -> list[UsdaFoodRecord]:
    directory = Path(directory)
    foods = _read_foods(directory / FOOD_FILE, USDA_DATA_TYPES[data_type])
    nutrients = _read_nutrients(directory / FOOD_NUTRIENT_FILE, set(foods))

    records = []
    for fdc_id, description in foods.items():
        found = nutrients.get(fdc_id, {})
        calories = None
        for nutrient_id in (
            NUTRIENT_ENERGY_KCAL,
            NUTRIENT_ENERGY_ATWATER_GENERAL,
            NUTRIENT_ENERGY_ATWATER_SPECIFIC,
        ):
            if found.get(nutrient_id) is not None:
                calories = found[nutrient_id]
                break
        records.append(
            UsdaFoodRecord(
                fdc_id=fdc_id,
                description=description,
                data_type=data_type,
                calories_kcal=calories,
                protein_g=found.get(NUTRIENT_PROTEIN),
                carbs_g=found.get(NUTRIENT_CARBS),
                fat_g=found.get(NUTRIENT_FAT),
            )
        )
    return records
