import logging
from dataclasses import dataclass
from pathlib import Path

from models import Food
from models.food import FOOD_DATA_TYPES
from services.usda_csv_reader import read_usda_dataset

logger = logging.getLogger(__name__)

EMBEDDING_BATCH_SIZE = 128
DATA_TYPE_LABELS: dict[str, str] = {"foundation": "Foundation", "sr_legacy": "SR Legacy"}


@dataclass(frozen=True)
class UsdaSource:
    data_type: str
    directory: Path


@dataclass
class SourceSummary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    missing_embedding: int = 0


@dataclass
class ImportSummary:
    sources: dict[str, SourceSummary]
    embedding_failed: bool = False


class FoodImportService:
    def __init__(self, food_repository, unit_of_work, embedding_client,
                 batch_size: int = EMBEDDING_BATCH_SIZE):
        self.food_repository = food_repository
        self.unit_of_work = unit_of_work
        self.embedding_client = embedding_client
        self.batch_size = batch_size

    def run(self, sources: list[UsdaSource]) -> ImportSummary:
        # Validación previa: se lee todo antes de escribir nada
        datasets = []
        for source in sources:
            if source.data_type not in FOOD_DATA_TYPES:
                raise ValueError(f"Tipo de datos no válido: {source.data_type}")
            datasets.append((source, read_usda_dataset(source.directory, source.data_type)))

        summary = ImportSummary(sources={})
        try:
            for source, records in datasets:
                summary.sources[source.data_type] = self._store_records(records)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

        summary.embedding_failed = not self._complete_embeddings()

        missing = self.food_repository.count_missing_embedding_by_data_type()
        for data_type, source_summary in summary.sources.items():
            source_summary.missing_embedding = missing.get(data_type, 0)
        return summary

    def _store_records(self, records) -> SourceSummary:
        result = SourceSummary()
        existing = {
            food.fdc_id: food
            for food in self.food_repository.get_by_fdc_ids([record.fdc_id for record in records])
        }
        for record in records:
            food = existing.get(record.fdc_id)
            if food is None:
                self.food_repository.create(
                    Food(
                        fdc_id=record.fdc_id,
                        description=record.description,
                        data_type=record.data_type,
                        calories_kcal=record.calories_kcal,
                        protein_g=record.protein_g,
                        carbs_g=record.carbs_g,
                        fat_g=record.fat_g,
                    )
                )
                result.added += 1
                continue

            description_changed = food.description != record.description
            changed = (
                description_changed
                or food.data_type != record.data_type
                or food.calories_kcal != record.calories_kcal
                or food.protein_g != record.protein_g
                or food.carbs_g != record.carbs_g
                or food.fat_g != record.fat_g
            )
            if not changed:
                result.unchanged += 1
                continue

            food.description = record.description
            food.data_type = record.data_type
            food.calories_kcal = record.calories_kcal
            food.protein_g = record.protein_g
            food.carbs_g = record.carbs_g
            food.fat_g = record.fat_g
            if description_changed:
                food.embedding = None
            self.food_repository.update(food)
            result.updated += 1
        return result

    def _complete_embeddings(self) -> bool:
        """Calcula los vectores pendientes por lotes; False si el proveedor falla."""
        while True:
            pending = self.food_repository.list_missing_embedding(self.batch_size)
            if not pending:
                return True
            try:
                vectors = self.embedding_client.embed_documents(
                    [food.description for food in pending]
                )
                for food, vector in zip(pending, vectors):
                    food.embedding = vector
                self.unit_of_work.commit()
            except Exception:
                self.unit_of_work.rollback()
                logger.exception("Falló el proveedor de embeddings durante la importación")
                return False


def format_summary(summary: ImportSummary) -> str:
    lines = [
        f"{DATA_TYPE_LABELS[data_type]}: {item.added} añadidos, {item.updated} actualizados, "
        f"{item.unchanged} sin cambios, {item.missing_embedding} sin representación semántica."
        for data_type, item in summary.sources.items()
    ]
    if summary.embedding_failed:
        lines.append(
            "El proveedor de embeddings falló: vuelve a ejecutar la importación para "
            "completar las representaciones semánticas pendientes."
        )
    return "\n".join(lines)
