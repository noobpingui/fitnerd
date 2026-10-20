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


def read_usda_dataset(directory: Path | str, data_type: str) -> list[UsdaFoodRecord]:
    raise NotImplementedError("not implemented")
