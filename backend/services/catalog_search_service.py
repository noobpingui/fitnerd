from collections.abc import Iterable, Sequence

from models import CatalogFood

MAX_RESULTS = 20
GROUP_EXACT, GROUP_NAME_PREFIX, GROUP_OTHER = 0, 1, 2


def query_forms(_query: str) -> list[tuple[str, ...]]:
    raise NotImplementedError("not implemented")


def match_group(
    _name: str, _synonyms: Sequence[str], _query: list[tuple[str, ...]]
) -> int | None:
    raise NotImplementedError("not implemented")


def rank_catalog(_foods: Iterable, _query: str, _limit: int = MAX_RESULTS) -> list:
    raise NotImplementedError("not implemented")


class CatalogSearchService:

    def __init__(self, catalog_repository):
        self.catalog_repository = catalog_repository

    def search(self, _raw_query: str | None) -> list[CatalogFood]:
        raise NotImplementedError("not implemented")
