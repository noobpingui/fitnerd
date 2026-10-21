from dataclasses import dataclass
from pathlib import Path


@dataclass
class CatalogLoadSummary:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0


class CatalogLoadService:

    def __init__(self, catalog_repository, food_repository, unit_of_work):
        self.catalog_repository = catalog_repository
        self.food_repository = food_repository
        self.unit_of_work = unit_of_work

    def run(self, _path: Path | str) -> CatalogLoadSummary:
        raise NotImplementedError("not implemented")


def format_catalog_summary(_summary: CatalogLoadSummary) -> str:
    raise NotImplementedError("not implemented")
