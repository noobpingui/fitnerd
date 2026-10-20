from dataclasses import dataclass
from pathlib import Path

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
        raise NotImplementedError("not implemented")


def format_summary(summary: ImportSummary) -> str:
    raise NotImplementedError("not implemented")
