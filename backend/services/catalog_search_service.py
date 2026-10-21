from collections.abc import Iterable, Sequence

from models import CatalogFood
from services.catalog_rules import fold, word_forms, words
from services.food_search_service import normalize_query

MAX_RESULTS = 20
GROUP_EXACT, GROUP_NAME_PREFIX, GROUP_OTHER = 0, 1, 2


def query_forms(query: str) -> list[tuple[str, ...]]:
    return [word_forms(word) for word in words(query)]


def _matches(term_words: list[str], query: list[tuple[str, ...]]) -> bool:
    # Cada palabra de la consulta debe ser el inicio de alguna palabra del mismo término.
    return all(
        any(word.startswith(form) for form in forms for word in term_words) for forms in query
    )


def _is_equal(term_words: list[str], query: list[tuple[str, ...]]) -> bool:
    return len(term_words) == len(query) and all(
        word in forms for word, forms in zip(term_words, query)
    )


def _name_starts_with(term_words: list[str], query: list[tuple[str, ...]]) -> bool:
    if len(term_words) < len(query):
        return False
    *head, last = query
    if any(word not in forms for word, forms in zip(term_words, head)):
        return False
    tail = term_words[len(head)]
    return any(tail.startswith(form) for form in last)


def match_group(name: str, synonyms: Sequence[str], query: list[tuple[str, ...]]) -> int | None:
    name_words = words(name)
    terms = [name_words] + [words(synonym) for synonym in synonyms]
    if not any(_matches(term, query) for term in terms):
        return None
    if any(_is_equal(term, query) for term in terms):
        return GROUP_EXACT
    if _name_starts_with(name_words, query):
        return GROUP_NAME_PREFIX
    return GROUP_OTHER


def rank_catalog(foods: Iterable, query: str, limit: int = MAX_RESULTS) -> list:
    forms = query_forms(query)
    if not forms:
        return []
    ranked = []
    for food in foods:
        group = match_group(food.name, food.synonyms, forms)
        if group is not None:
            ranked.append((group, fold(food.name), food.name, food.id, food))
    ranked.sort(key=lambda entry: entry[:4])
    return [entry[4] for entry in ranked[:limit]]


class CatalogSearchService:

    def __init__(self, catalog_repository):
        self.catalog_repository = catalog_repository

    def search(self, raw_query: str | None) -> list[CatalogFood]:
        query = normalize_query(raw_query)
        return rank_catalog(self.catalog_repository.list_all(), query)
