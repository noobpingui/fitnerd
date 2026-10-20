"""FoodSearchService (spec 021) con un repositorio, un cliente de embeddings y
un limitador de uso de mentira, inyectados por constructor - sin Postgres,
Voyage ni Redis.
"""

from types import SimpleNamespace

import pytest

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError, ValidationError
from services.food_search_service import (
    DEFAULT_MAX_DISTANCE,
    EMPTY_QUERY_MESSAGE,
    LONG_QUERY_MESSAGE,
    MAX_RESULTS,
    RATE_LIMIT_MESSAGE,
    SEMANTIC_CANDIDATES,
    SHORT_QUERY_MESSAGE,
    TEXT_CANDIDATES,
    UNAVAILABLE_MESSAGE,
    FoodSearchService,
    fuse_rankings,
    normalize_query,
)
from tests.fakes import FakeFoodEmbeddingClient, FakeFoodRepository, FakeRateLimiter, basis_vector


def make_foods(*fdc_ids):
    return [SimpleNamespace(fdc_id=fdc_id, description=f"Food {fdc_id}") for fdc_id in fdc_ids]


def make_service(text_ids=None, semantic_ids=None, foods=None, allowed=True, raise_error=None):
    all_ids = set(text_ids or []) | set(semantic_ids or [])
    repository = FakeFoodRepository(
        foods=foods if foods is not None else make_foods(*sorted(all_ids, reverse=True)),
        text_ids=text_ids,
        semantic_ids=semantic_ids,
    )
    embedding_client = FakeFoodEmbeddingClient(default_vector=basis_vector(3), raise_error=raise_error)
    rate_limiter = FakeRateLimiter(allowed=allowed)
    service = FoodSearchService(repository, embedding_client, rate_limiter)
    return service, repository, embedding_client, rate_limiter


# SDD: 021 REQ-008 AC-008.1
@pytest.mark.parametrize("raw", [None, "", "   "])
def test_normalize_query_rejects_missing_empty_or_blank_queries(raw):
    """Una consulta ausente, vacía o solo con espacios da el mensaje de vacío."""
    with pytest.raises(ValidationError) as error:
        normalize_query(raw)

    assert error.value.message == EMPTY_QUERY_MESSAGE
    assert error.value.message == "Escribe qué alimento quieres buscar."
    assert error.value.status_code == 400


# SDD: 021 REQ-008 AC-008.2
@pytest.mark.parametrize("raw", ["a", "  a  "])
def test_normalize_query_rejects_a_single_character(raw):
    """Un solo carácter (tras quitar espacios) da el mensaje de longitud mínima."""
    with pytest.raises(ValidationError) as error:
        normalize_query(raw)

    assert error.value.message == SHORT_QUERY_MESSAGE
    assert error.value.message == "La búsqueda debe tener al menos 2 caracteres."


# SDD: 021 REQ-008 AC-008.3
def test_normalize_query_rejects_101_characters_and_accepts_100():
    """101 caracteres dan el mensaje de longitud máxima; 100 se aceptan."""
    with pytest.raises(ValidationError) as error:
        normalize_query("a" * 101)

    assert error.value.message == LONG_QUERY_MESSAGE
    assert error.value.message == "La búsqueda no puede superar los 100 caracteres."
    assert normalize_query("a" * 100) == "a" * 100


# SDD: 021 REQ-008 AC-008.3
def test_normalize_query_measures_the_length_after_trimming():
    """Los espacios de los extremos no cuentan para el máximo."""
    assert normalize_query("  " + "a" * 100 + "  ") == "a" * 100


# SDD: 021 REQ-006 AC-006.5
def test_normalize_query_strips_the_ends():
    """Los espacios de los extremos se quitan."""
    assert normalize_query("  chicken  ") == "chicken"


# SDD: 021 REQ-008 AC-008.4
@pytest.mark.parametrize("raw", [None, "", "   ", "a", "a" * 101])
def test_invalid_query_does_not_touch_limiter_provider_or_repository(raw):
    """Una consulta no válida no consume el límite, no pide ningún vector y no
    consulta la base."""
    service, repository, client, limiter = make_service(text_ids=[1])

    with pytest.raises(ValidationError):
        service.search("user-1", raw)

    assert limiter.calls == []
    assert client.query_calls == []
    assert repository.text_calls == []
    assert repository.semantic_calls == []


# SDD: 021 REQ-010 AC-010.1
def test_search_counts_against_the_limit_of_30_per_minute_per_user():
    """El límite se aplica con la clave del usuario, 30 búsquedas y ventana de
    60 segundos."""
    service, _, _, limiter = make_service(text_ids=[1])

    service.search("user-1", "chicken")

    assert limiter.calls == [("ratelimit:foods:search:user-1", 30, 60)]


# SDD: 021 REQ-010 AC-010.1
def test_search_over_the_limit_raises_429_without_calling_the_provider():
    """Pasado el límite se lanza el error 429 con el mensaje exacto y no se
    pide ningún vector ni se consulta la base."""
    service, repository, client, _ = make_service(text_ids=[1], allowed=False)

    with pytest.raises(RateLimitError) as error:
        service.search("user-1", "chicken")

    assert error.value.status_code == 429
    assert error.value.message == RATE_LIMIT_MESSAGE
    assert error.value.message == (
        "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
    )
    assert client.query_calls == []
    assert repository.text_calls == []


# SDD: 021 REQ-011 AC-011.1
def test_provider_failure_raises_503_even_when_there_are_text_matches():
    """Si el proveedor falla, el error es 503 con el mensaje exacto aunque la
    consulta coincida por texto: no hay resultados parciales."""
    service, _, _, limiter = make_service(
        text_ids=[1], raise_error=RuntimeError("voyage down")
    )

    with pytest.raises(ServiceUnavailableError) as error:
        service.search("user-1", "chicken")

    assert error.value.status_code == 503
    assert error.value.message == UNAVAILABLE_MESSAGE
    assert error.value.message == (
        "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."
    )
    assert len(limiter.calls) == 1


# SDD: 021 REQ-011 AC-011.2
def test_provider_failure_raises_503_for_a_query_without_text_matches():
    """Una consulta sin palabras en común con la descripción también da 503."""
    service, _, _, _ = make_service(semantic_ids=[1], raise_error=RuntimeError("voyage down"))

    with pytest.raises(ServiceUnavailableError) as error:
        service.search("user-1", "pechuga de pollo")

    assert error.value.message == UNAVAILABLE_MESSAGE


# SDD: 021 REQ-006 AC-006.2
def test_search_embeds_the_normalized_query_and_asks_both_candidate_lists():
    """Se pide el vector de la consulta recortada y se piden candidatos por
    texto y por similitud con los parámetros del plan."""
    service, repository, client, _ = make_service(text_ids=[1], semantic_ids=[1])

    service.search("user-1", "  pechuga de pollo  ")

    assert client.query_calls == ["pechuga de pollo"]
    assert repository.text_calls == [("pechuga de pollo", TEXT_CANDIDATES)]
    assert repository.semantic_calls == [
        (basis_vector(3), DEFAULT_MAX_DISTANCE, SEMANTIC_CANDIDATES)
    ]
    assert (TEXT_CANDIDATES, SEMANTIC_CANDIDATES, DEFAULT_MAX_DISTANCE) == (40, 40, 0.6)


# SDD: 021 REQ-006 AC-006.3
def test_search_returns_foods_in_fused_relevance_order():
    """Los alimentos salen en el orden de la fusión, no en el que devuelve el
    repositorio al cargarlos."""
    service, _, _, _ = make_service(text_ids=[2, 1], semantic_ids=[3, 1])

    foods = service.search("user-1", "chicken")

    assert [food.fdc_id for food in foods] == [1, 2, 3]


# SDD: 021 REQ-006 AC-006.4
def test_search_returns_at_most_20_foods():
    """Con 30 coincidencias, la búsqueda devuelve exactamente 20."""
    service, _, _, _ = make_service(text_ids=list(range(1, 31)))

    foods = service.search("user-1", "chicken")

    assert len(foods) == MAX_RESULTS == 20


# SDD: 021 REQ-007 AC-007.2
def test_search_without_candidates_returns_an_empty_list():
    """Sin candidatos por texto ni por similitud, la lista es vacía."""
    service, _, _, _ = make_service(text_ids=[], semantic_ids=[], foods=[])

    assert service.search("user-1", "zzxqv") == []


# SDD: 021 REQ-006 AC-006.3
def test_fuse_rankings_puts_foods_found_by_both_ways_first():
    """Quien aparece en las dos listas va antes que quien aparece en una sola,
    aunque este último sea el primero de la suya."""
    assert fuse_rankings(text_ids=[2], semantic_ids=[9, 2]) == [2, 9]


# SDD: 021 REQ-006 AC-006.3
def test_fuse_rankings_double_hit_wins_even_at_the_end_of_both_lists():
    """Con 40 candidatos por lista, uno que ocupa el último puesto de las dos
    supera al primero de una sola (el comportamiento que fija k = 60)."""
    text_ids = list(range(100, 139)) + [7]
    semantic_ids = list(range(200, 239)) + [7]

    fused = fuse_rankings(text_ids, semantic_ids, limit=100)

    assert fused[0] == 7


# SDD: 021 REQ-006 AC-006.4
def test_fuse_rankings_returns_at_most_20_by_default():
    """Por defecto se devuelven como máximo 20 identificadores."""
    assert len(fuse_rankings(list(range(1, 41)), list(range(41, 81)))) == 20


# SDD: 021 REQ-006 AC-006.4
def test_fuse_rankings_respects_an_explicit_limit():
    """El parámetro `limit` acota el resultado."""
    assert fuse_rankings([1, 2, 3, 4], [], limit=2) == [1, 2]


# SDD: 021 REQ-006 AC-006.3
def test_fuse_rankings_breaks_ties_by_ascending_fdc_id():
    """Con la misma puntuación, gana el FDC ID menor."""
    assert fuse_rankings(text_ids=[5], semantic_ids=[3]) == [3, 5]


# SDD: 021 REQ-006 AC-006.3
def test_fuse_rankings_scores_by_reciprocal_rank():
    """La posición cuenta: el primero de una lista supera al segundo."""
    assert fuse_rankings(text_ids=[8, 4], semantic_ids=[]) == [8, 4]


# SDD: 021 REQ-007 AC-007.2
def test_fuse_rankings_without_candidates_is_empty():
    """Sin candidatos la fusión es una lista vacía."""
    assert fuse_rankings([], []) == []
