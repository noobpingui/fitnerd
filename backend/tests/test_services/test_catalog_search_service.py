"""Tests UNITARIOS de la búsqueda en el catálogo (spec 023): el servicio recibe
por constructor un `FakeCatalogFoodRepository`, sin base de datos ni red. Los
catálogos de cada prueba son los de los AC de la spec."""

import inspect

import pytest

from exceptions.custom_exceptions import ValidationError
from services.catalog_search_service import (
    GROUP_EXACT,
    GROUP_NAME_PREFIX,
    GROUP_OTHER,
    MAX_RESULTS,
    CatalogSearchService,
    match_group,
    query_forms,
    rank_catalog,
)
from tests.fakes import FakeCatalogFoodRepository, make_catalog_food

EMPTY_QUERY = "Escribe qué alimento quieres buscar."
SHORT_QUERY = "La búsqueda debe tener al menos 2 caracteres."
LONG_QUERY = "La búsqueda no puede superar los 100 caracteres."


def food(name, synonyms=(), food_id=None):
    """Alimento del catálogo con un identificador derivado del nombre."""
    return make_catalog_food(food_id or name.lower().replace(" ", "-"), name, synonyms)


def search(foods, query):
    """Nombres de los resultados de buscar `query` en un catálogo con `foods`."""
    service = CatalogSearchService(FakeCatalogFoodRepository(foods))
    return [result.name for result in service.search(query)]


RICE_CATALOG = [
    food("Arroz blanco cocido"),
    food("Arroz integral cocido"),
    food("Frijoles negros cocidos"),
]


# --------------------------------------------------------------------------
# Coincidencia
# --------------------------------------------------------------------------


# SDD: 023 REQ-004 AC-004.1
def test_search_finds_the_two_rices_first_white_and_not_the_beans():
    """`arroz`: los dos arroces, primero el blanco, y sin los frijoles."""
    assert search(RICE_CATALOG, "arroz") == ["Arroz blanco cocido", "Arroz integral cocido"]


# SDD: 023 REQ-004 AC-004.2
def test_search_does_not_depend_on_the_order_of_the_query_words():
    """`cocido arroz` encuentra los dos arroces."""
    assert sorted(search(RICE_CATALOG, "cocido arroz")) == [
        "Arroz blanco cocido",
        "Arroz integral cocido",
    ]


# SDD: 023 REQ-004 AC-004.2
def test_search_requires_every_query_word_to_match():
    """`arroz negros`: ninguna palabra suelta basta, todas deben coincidir en
    el mismo nombre o sinónimo."""
    assert search(RICE_CATALOG, "arroz negros") == []


# SDD: 023 REQ-004 AC-004.3
@pytest.mark.parametrize("query", ["PLATANO", "plátano", "  platano  "])
def test_search_ignores_case_accents_and_surrounding_spaces(query):
    """«Plátano maduro cocido» aparece con las tres escrituras."""
    assert search([food("Plátano maduro cocido")], query) == ["Plátano maduro cocido"]


# SDD: 023 REQ-004 AC-004.4
def test_search_finds_a_food_by_a_synonym_and_puts_it_first():
    """`guineo` encuentra «Banano», primero."""
    assert search([food("Banano", ["guineo"])], "guineo") == ["Banano"]


# SDD: 023 REQ-004 AC-004.4
def test_a_food_with_the_synonym_equal_to_the_query_goes_before_a_name_that_starts_with_it():
    """El sinónimo igual a la consulta (grupo 0) va antes que un nombre que
    empieza por ella (grupo 1), aunque este sea anterior en el alfabeto."""
    foods = [food("Banano", ["guineo"]), food("Guineo deshidratado")]

    assert search(foods, "guineo") == ["Banano", "Guineo deshidratado"]


# SDD: 023 REQ-004 AC-004.4
def test_every_query_word_must_match_the_same_synonym():
    """Las palabras de la consulta no se reparten entre el nombre y un sinónimo
    ni entre dos sinónimos."""
    foods = [food("Banano", ["guineo verde", "cuadrado"])]

    assert search(foods, "guineo verde") == ["Banano"]
    assert search(foods, "guineo cuadrado") == []
    assert search(foods, "banano guineo") == []


# SDD: 023 REQ-004 AC-004.5
def test_search_matches_the_start_of_a_word_but_not_the_middle():
    """`frijol` encuentra «Frijoles negros cocidos» y `ijol` no."""
    foods = [food("Frijoles negros cocidos")]

    assert search(foods, "frijol") == ["Frijoles negros cocidos"]
    assert search(foods, "ijol") == []


# SDD: 023 REQ-004 AC-004.6
@pytest.mark.parametrize("query", ["pina", "Piña", "PIÑA"])
def test_search_treats_enye_as_n(query):
    """`pina` encuentra «Piña»."""
    assert search([food("Piña")], query) == ["Piña"]


# --------------------------------------------------------------------------
# Orden
# --------------------------------------------------------------------------


# SDD: 023 REQ-004 AC-004.7
def test_name_that_starts_with_the_query_goes_before_the_rest_which_are_alphabetical():
    """`pollo`: «Pollo desmenuzado cocido» primero; luego los otros por nombre."""
    foods = [
        food("Pechuga de pollo a la plancha"),
        food("Muslo de pollo al horno"),
        food("Pollo desmenuzado cocido"),
    ]

    assert search(foods, "pollo") == [
        "Pollo desmenuzado cocido",
        "Muslo de pollo al horno",
        "Pechuga de pollo a la plancha",
    ]


# SDD: 023 REQ-004 AC-004.7
def test_two_foods_without_synonyms_are_ordered_by_name():
    """Sin el alimento que empieza por «pollo», los dos van por nombre."""
    foods = [food("Pechuga de pollo a la plancha"), food("Muslo de pollo al horno")]

    assert search(foods, "pollo") == ["Muslo de pollo al horno", "Pechuga de pollo a la plancha"]


# SDD: 023 REQ-004 AC-004.7
def test_the_exact_name_goes_before_a_name_that_starts_with_the_query():
    """Nombre igual a la consulta, luego nombre que empieza por ella, luego el resto."""
    foods = [food("Pollo desmenuzado"), food("Caldo de pollo"), food("Pollo")]

    assert search(foods, "pollo") == ["Pollo", "Pollo desmenuzado", "Caldo de pollo"]


# SDD: 023 REQ-004 AC-004.7
def test_alphabetical_order_ignores_case_and_accents():
    """Dentro de un grupo, el orden por nombre no distingue tildes: «Ácido» antes que «Bote»."""
    foods = [food("Bote de maíz"), food("Ácido de maíz")]

    assert search(foods, "maiz") == ["Ácido de maíz", "Bote de maíz"]


# SDD: 023 REQ-004 AC-004.8
def test_search_returns_at_most_20_results():
    """30 alimentos coinciden: la respuesta tiene exactamente 20, los primeros
    por nombre."""
    foods = [food(f"Fruta {number:02d}") for number in range(30)]

    names = search(foods, "fruta")

    assert len(names) == 20
    assert names == [f"Fruta {number:02d}" for number in range(20)]


# SDD: 023 REQ-004 AC-004.8
def test_the_maximum_number_of_results_is_20():
    """La constante pública vale 20 y la búsqueda no devuelve más."""
    foods = [food(f"Arroz {number:02d}") for number in range(25)]

    assert MAX_RESULTS == 20
    assert len(search(foods, "arroz")) == 20


# SDD: 023 REQ-004 AC-004.9
def test_search_without_matches_returns_an_empty_list():
    """`zzxqv` no encuentra nada."""
    assert search(RICE_CATALOG, "zzxqv") == []


# SDD: 023 REQ-004 AC-004.11
def test_search_in_an_empty_catalog_returns_an_empty_list():
    """Sin alimentos cargados, la lista es vacía y no falla."""
    assert search([], "arroz") == []


# SDD: 023 REQ-004 AC-004.3
def test_search_returns_the_catalog_objects_not_copies():
    """El servicio devuelve los alimentos del repositorio tal cual."""
    banano = food("Banano")
    service = CatalogSearchService(FakeCatalogFoodRepository([banano]))

    assert service.search("banano") == [banano]


# --------------------------------------------------------------------------
# Plurales
# --------------------------------------------------------------------------


# SDD: 023 REQ-004 AC-004.12
@pytest.mark.parametrize("query", ["huevos", "huevos cocidos"])
def test_search_removes_a_final_s_from_each_query_word(query):
    """`huevos` y `huevos cocidos` encuentran «Huevo cocido»."""
    assert search([food("Huevo cocido")], query) == ["Huevo cocido"]


# SDD: 023 REQ-004 AC-004.13
def test_search_removes_a_final_es_from_each_query_word():
    """`limones` encuentra «Limón»."""
    assert search([food("Limón")], "limones") == ["Limón"]


# SDD: 023 REQ-004 AC-004.14
def test_the_name_equal_to_the_query_with_a_reduced_form_goes_first():
    """`bananos`: «Banano» (igual con la forma reducida) antes que «Batido de banano»."""
    foods = [food("Batido de banano"), food("Banano")]

    assert search(foods, "bananos") == ["Banano", "Batido de banano"]


# SDD: 023 REQ-004 AC-004.14
def test_a_synonym_equal_to_the_query_with_a_reduced_form_also_counts_as_exact():
    """La comparación de «igual a la consulta» acepta cualquier forma de cada palabra."""
    foods = [food("Aguacate", ["palta"]), food("Palta en crema")]

    assert search(foods, "paltas") == ["Aguacate", "Palta en crema"]


# SDD: 023 REQ-004 AC-004.15
def test_a_reduced_form_shorter_than_three_characters_is_not_used():
    """`es`: encuentra «Espinaca cocida» y no «Elote cocido»."""
    foods = [food("Espinaca cocida"), food("Elote cocido")]

    assert search(foods, "es") == ["Espinaca cocida"]


# SDD: 023 REQ-004 AC-004.16
@pytest.mark.parametrize("query", ["guevos", "huevoz"])
def test_search_does_not_tolerate_typos(query):
    """`guevos` y `huevoz` no encuentran «Huevo cocido»."""
    assert search([food("Huevo cocido")], query) == []


# SDD: 023 REQ-004 AC-004.13
def test_a_plural_query_finds_a_singular_name_and_the_other_way_round():
    """`frijoles` (forma «frijol») encuentra «Frijol negro» y `frijol` encuentra
    «Frijoles negros» por inicio de palabra."""
    assert search([food("Frijol negro")], "frijoles") == ["Frijol negro"]
    assert search([food("Frijoles negros")], "frijol") == ["Frijoles negros"]


# --------------------------------------------------------------------------
# Funciones puras
# --------------------------------------------------------------------------


# SDD: 023 REQ-004 AC-004.12
def test_query_forms_gives_the_forms_of_each_query_word_in_order():
    """Una tupla de formas por palabra de la consulta, sin tildes."""
    assert query_forms("Huevos cocidos") == [("huevos", "huevo"), ("cocidos", "cocido")]
    assert query_forms("limones") == [("limones", "limone", "limon")]


# SDD: 023 REQ-004 AC-004.1
def test_match_group_returns_the_three_groups_and_none():
    """0 igual, 1 nombre que empieza por la consulta, 2 el resto y None si no coincide."""
    query = query_forms("pollo")

    assert match_group("Pollo", [], query) == GROUP_EXACT
    assert match_group("Gallina", ["pollo"], query) == GROUP_EXACT
    assert match_group("Pollo asado", [], query) == GROUP_NAME_PREFIX
    assert match_group("Caldo de pollo", [], query) == GROUP_OTHER
    assert match_group("Arroz", ["cereal"], query) is None
    assert (GROUP_EXACT, GROUP_NAME_PREFIX, GROUP_OTHER) == (0, 1, 2)


# SDD: 023 REQ-004 AC-004.8
def test_rank_catalog_respects_the_limit_argument():
    """`rank_catalog` devuelve como mucho `limit` alimentos."""
    foods = [food(f"Fruta {number:02d}") for number in range(30)]

    assert len(rank_catalog(foods, "fruta", 5)) == 5
    assert len(rank_catalog(foods, "fruta")) == 20


# SDD: 023 REQ-004 AC-004.9
def test_rank_catalog_of_a_query_without_words_is_empty():
    """Una consulta de solo signos no tiene palabras y no encuentra nada."""
    assert rank_catalog([food("Banano")], "--") == []


# --------------------------------------------------------------------------
# Validación de la consulta (REQ-005) y NFR-001
# --------------------------------------------------------------------------


# SDD: 023 REQ-005 AC-005.1
@pytest.mark.parametrize("query", [None, "", "   "])
def test_search_rejects_a_missing_or_blank_query_before_reading_the_catalog(query):
    """Falta, vacía o solo espacios: «Escribe qué alimento quieres buscar.»."""
    repository = FakeCatalogFoodRepository([food("Banano")])
    service = CatalogSearchService(repository)

    with pytest.raises(ValidationError) as exc_info:
        service.search(query)

    assert str(exc_info.value) == EMPTY_QUERY
    assert repository.list_calls == []


# SDD: 023 REQ-005 AC-005.2
@pytest.mark.parametrize("query", ["a", " a "])
def test_search_rejects_a_one_character_query_before_reading_the_catalog(query):
    """Menos de 2 caracteres tras quitar los espacios."""
    repository = FakeCatalogFoodRepository([food("Banano")])
    service = CatalogSearchService(repository)

    with pytest.raises(ValidationError) as exc_info:
        service.search(query)

    assert str(exc_info.value) == SHORT_QUERY
    assert repository.list_calls == []


# SDD: 023 REQ-005 AC-005.3
def test_search_rejects_a_101_character_query_and_accepts_100():
    """101 caracteres: error sin leer el catálogo; 100: se busca."""
    repository = FakeCatalogFoodRepository([food("Banano")])
    service = CatalogSearchService(repository)

    with pytest.raises(ValidationError) as exc_info:
        service.search("a" * 101)

    assert str(exc_info.value) == LONG_QUERY
    assert repository.list_calls == []
    assert service.search("a" * 100) == []
    assert len(repository.list_calls) == 1


# SDD: 023 REQ-005 AC-005.3
def test_a_valid_query_reads_the_catalog_once():
    """Una búsqueda válida lee el catálogo una sola vez."""
    repository = FakeCatalogFoodRepository([food("Banano")])

    CatalogSearchService(repository).search("banano")

    assert len(repository.list_calls) == 1


# SDD: 023 REQ-005 NFR-001 AC-N001.1
def test_the_service_only_depends_on_the_catalog_repository():
    """El constructor no recibe proveedor de embeddings ni limitador de uso."""
    parameters = list(inspect.signature(CatalogSearchService.__init__).parameters)
    repository = FakeCatalogFoodRepository([food("Banano")])

    results = CatalogSearchService(repository).search("banano")

    assert parameters == ["self", "catalog_repository"]
    assert [result.name for result in results] == ["Banano"]
