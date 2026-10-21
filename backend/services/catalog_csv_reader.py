from dataclasses import dataclass
from pathlib import Path

REQUIRED_COLUMNS: tuple[str, ...] = (
    "id",
    "name",
    "synonyms",
    "calories_kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "source",
    "fdc_id",
    "reference",
)
NUTRIENT_COLUMNS: tuple[str, ...] = ("calories_kcal", "protein_g", "carbs_g", "fat_g")


class CatalogFileError(Exception):
    def __init__(self, path: Path, message: str):
        super().__init__(message)
        self.path = path
        self.message = message


@dataclass(frozen=True)
class CatalogRecord:
    row: int
    id: str
    name: str
    synonyms: tuple[str, ...]
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source: str
    fdc_id: int | None
    reference: str | None


def read_catalog_csv(_path: Path | str) -> list[CatalogRecord]:
    raise NotImplementedError("not implemented")
