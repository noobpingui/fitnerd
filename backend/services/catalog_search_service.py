from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from models import CatalogFood
from services.catalog_rules import MIN_REDUCED_FORM_LENGTH, fold, word_forms, words
from services.food_search_service import normalize_query

MAX_RESULTS = 20
GROUP_EXACT, GROUP_NAME_PREFIX, GROUP_OTHER = 0, 1, 2


def _query_word_forms(word: str) -> tuple[str, ...]:
    forms = word_forms(word)
    if word.endswith("ces"):
        singular = word[:-3] + "z"  # nueces → nuez
        if len(singular) >= MIN_REDUCED_FORM_LENGTH and singular not in forms:
            forms = (*forms, singular)
    return forms


def query_forms(query: str) -> list[tuple[str, ...]]:
    return [_query_word_forms(word) for word in words(query)]


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


def edit_distance(a: str, b: str) -> int:
    # Distancia de Damerau-Levenshtein restringida (OSA): insertar, borrar, cambiar
    # e intercambiar dos letras contiguas cuestan 1.
    rows = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        rows[i][0] = i
    for j in range(len(b) + 1):
        rows[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            best = min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                best = min(best, rows[i - 2][j - 2] + 1)
            rows[i][j] = best
    return rows[len(a)][len(b)]


def prefix_edit_distance(form: str, word: str) -> int:
    # Mínimo frente a la palabra entera y a cada uno de sus inicios: la última fila de la tabla.
    previous = list(range(len(word) + 1))
    before: list[int] | None = None
    for i in range(1, len(form) + 1):
        current = [i] + [0] * len(word)
        for j in range(1, len(word) + 1):
            cost = 0 if form[i - 1] == word[j - 1] else 1
            best = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            swapped = j > 1 and form[i - 1] == word[j - 2] and form[i - 2] == word[j - 1]
            if before is not None and swapped:
                best = min(best, before[j - 2] + 1)
            current[j] = best
        before, previous = previous, current
    return min(previous)


TYPO_MIN_FORM_LENGTH = 4


def typo_tolerance(form: str) -> int:
    if len(form) < TYPO_MIN_FORM_LENGTH:
        return 0
    return 1 if len(form) < 8 else 2


def typo_distance(
    name: str,
    synonyms: Sequence[str],
    query: list[tuple[str, ...]],
    distances: "TypoDistances | None" = None,
) -> int | None:
    distances = distances or TypoDistances()
    best: int | None = None
    for term in [name, *synonyms]:
        term_words = words(term)
        total = 0
        for forms in query:
            word_best = min(
                (
                    distance
                    for form in forms
                    for word in term_words
                    if (distance := distances.within_tolerance(form, word)) is not None
                ),
                default=None,
            )
            if word_best is None:
                total = None
                break
            total += word_best
        if total is not None and (best is None or total < best):
            best = total
    return best


@dataclass(frozen=True)
class SearchCandidate:
    name: str
    synonyms: Sequence[str]
    source_order: int  # 0 catálogo, 1 propio
    key: str  # desempate estable (id como texto)
    item: object


@dataclass
class TypoSearchStats:
    comparisons: int = 0


class TypoDistances:
    """Memoria de distancias de una búsqueda, por pareja (forma, palabra), con contador."""

    def __init__(self, stats: TypoSearchStats | None = None):
        self.stats = stats
        self._memory: dict[tuple[str, str], int] = {}

    def within_tolerance(self, form: str, word: str) -> int | None:
        tolerance = typo_tolerance(form)
        if tolerance == 0:
            return 0 if word.startswith(form) else None
        if len(word) < len(form) - tolerance:
            return None
        key = (form, word)
        distance = self._memory.get(key)
        if distance is None:
            distance = prefix_edit_distance(form, word)
            self._memory[key] = distance
            if self.stats is not None:
                self.stats.comparisons += 1
        return distance if distance <= tolerance else None


def typo_comparison_bound(candidates: Iterable[SearchCandidate], query: str) -> int:
    query_forms_ = {
        form
        for forms in query_forms(query)
        for form in forms
        if len(form) >= TYPO_MIN_FORM_LENGTH
    }
    candidate_words: set[str] = set()
    for candidate in candidates:
        for term in [candidate.name, *candidate.synonyms]:
            candidate_words.update(words(term))
    return len(query_forms_) * len(candidate_words)


def rank_candidates(
    candidates: Iterable[SearchCandidate],
    query: str,
    limit: int = MAX_RESULTS,
    stats: TypoSearchStats | None = None,
) -> list:
    forms = query_forms(query)
    if not forms:
        return []
    candidates = list(candidates)
    distances = TypoDistances(stats)
    exact = []
    for candidate in candidates:
        group = match_group(candidate.name, candidate.synonyms, forms)
        if group is not None:
            exact.append(
                (group, fold(candidate.name), candidate.source_order, candidate.name,
                 candidate.key, candidate)
            )
    if exact:
        ranked = exact
    else:
        ranked = []
        for candidate in candidates:
            distance = typo_distance(candidate.name, candidate.synonyms, forms, distances)
            if distance is not None:
                ranked.append(
                    (distance, fold(candidate.name), candidate.source_order, candidate.name,
                     candidate.key, candidate)
                )
    ranked.sort(key=lambda entry: entry[:5])
    return [entry[5].item for entry in ranked[:limit]]


def rank_catalog(
    foods: Iterable, query: str, limit: int = MAX_RESULTS, stats: TypoSearchStats | None = None
) -> list:
    candidates = (
        SearchCandidate(food.name, food.synonyms, 0, str(food.id), food) for food in foods
    )
    return rank_candidates(candidates, query, limit, stats)


class CatalogSearchService:

    def __init__(self, catalog_repository):
        self.catalog_repository = catalog_repository

    def search(
        self, raw_query: str | None, stats: TypoSearchStats | None = None
    ) -> list[CatalogFood]:
        query = normalize_query(raw_query)
        return rank_catalog(self.catalog_repository.list_all(), query, stats=stats)
