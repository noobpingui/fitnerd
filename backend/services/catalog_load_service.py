from dataclasses import dataclass
from pathlib import Path

from models import CatalogFood
from services.catalog_csv_reader import NUTRIENT_COLUMNS, CatalogFileError, read_catalog_csv

_COMPARED_FIELDS = (
    "name",
    "synonyms",
    *NUTRIENT_COLUMNS,
    "source",
    "fdc_id",
    "reference",
)


@dataclass
class CatalogLoadSummary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0


def _values(record) -> dict:
    values = {field: getattr(record, field) for field in _COMPARED_FIELDS}
    values["synonyms"] = list(record.synonyms)
    return values


class CatalogLoadService:

    def __init__(self, catalog_repository, food_repository, unit_of_work):
        self.catalog_repository = catalog_repository
        self.food_repository = food_repository
        self.unit_of_work = unit_of_work

    def run(self, path: Path | str) -> CatalogLoadSummary:
        path = Path(path)
        records = read_catalog_csv(path)
        self._check_against_usda(path, records)

        summary = CatalogLoadSummary()
        try:
            existing = {food.id: food for food in self.catalog_repository.list_all()}
            for record in records:
                values = _values(record)
                food = existing.get(record.id)
                if food is None:
                    self.catalog_repository.create(CatalogFood(id=record.id, **values))
                    summary.added += 1
                elif any(getattr(food, field) != values[field] for field in _COMPARED_FIELDS):
                    for field, value in values.items():
                        setattr(food, field, value)
                    self.catalog_repository.update(food)
                    summary.updated += 1
                else:
                    summary.unchanged += 1
            in_file = {record.id for record in records}
            for food_id, food in existing.items():
                if food_id not in in_file:
                    self.catalog_repository.delete(food)
                    summary.removed += 1
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise
        return summary

    def _check_against_usda(self, path: Path, records) -> None:
        usda_records = [record for record in records if record.source == "usda"]
        fdc_ids = list(dict.fromkeys(record.fdc_id for record in usda_records))
        foods = {food.fdc_id: food for food in self.food_repository.get_by_fdc_ids(fdc_ids)}
        errors = []
        for record in usda_records:
            food = foods.get(record.fdc_id)
            label = f"- Fila {record.row} ({record.id}):"
            if food is None:
                errors.append(
                    f"{label} el FDC ID {record.fdc_id} no existe en la base de USDA."
                )
                continue
            for column in NUTRIENT_COLUMNS:
                csv_value = getattr(record, column)
                usda_value = getattr(food, column)
                if usda_value is None or csv_value != usda_value:
                    shown = "sin dato" if usda_value is None else usda_value
                    errors.append(
                        f"{label} «{column}» es {csv_value} y en USDA "
                        f"(FDC ID {record.fdc_id}) es {shown}."
                    )
        if errors:
            raise CatalogFileError(
                path, "\n".join([f"El archivo {path} tiene errores:", *errors])
            )


def format_catalog_summary(summary: CatalogLoadSummary) -> str:
    return (
        f"Catálogo: {summary.added} añadidos, {summary.updated} actualizados, "
        f"{summary.unchanged} sin cambios, {summary.removed} quitados."
    )
