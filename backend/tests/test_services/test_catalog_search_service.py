"""Tests UNITARIOS de la búsqueda en el catálogo (spec 023): el servicio recibe
por constructor un `FakeCatalogFoodRepository`, sin base de datos ni red. Los
catálogos de cada prueba son los de los AC de la spec."""

import inspect
from pathlib import Path

import pytest

from exceptions.custom_exceptions import ValidationError
from services.catalog_csv_reader import read_catalog_csv
from services.catalog_search_service import (
    GROUP_EXACT,
    GROUP_NAME_PREFIX,
    GROUP_OTHER,
    MAX_RESULTS,
    CatalogSearchService,
    SearchCandidate,
    TypoDistances,
    TypoSearchStats,
    edit_distance,
    match_group,
    prefix_edit_distance,
    query_forms,
    rank_candidates,
    rank_catalog,
    typo_comparison_bound,
    typo_tolerance,
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


# Sustituye al test de la 023 (AC-004.16, «no tolera erratas»): la spec 028
# cambia ese comportamiento (REQ-006).
# SDD: 028 REQ-006 AC-006.2
@pytest.mark.parametrize("query", ["guevos", "huevoz"])
def test_search_tolerates_typos_in_huevo(query):
    """`guevos` y `huevoz` sí encuentran «Huevo cocido»."""
    assert search([food("Huevo cocido")], query) == ["Huevo cocido"]


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


# --------------------------------------------------------------------------
# Spec 028: erratas (REQ-006)
# --------------------------------------------------------------------------


# SDD: 028 REQ-006 AC-006.1
@pytest.mark.parametrize("query", ["aroz", "arrox", "arorz"])
def test_search_tolerates_a_missing_changed_or_swapped_letter(query):
    """`aroz` (falta una letra), `arrox` (una cambiada) y `arorz` (dos
    contiguas intercambiadas) encuentran «Arroz blanco cocido»."""
    assert search([food("Arroz blanco cocido")], query) == ["Arroz blanco cocido"]


# SDD: 028 REQ-006 AC-006.3
def test_search_tolerates_a_typo_in_several_words():
    """`pechga de polo` encuentra «Pechuga de pollo a la plancha»."""
    foods = [food("Pechuga de pollo a la plancha")]

    assert search(foods, "pechga de polo") == ["Pechuga de pollo a la plancha"]


# SDD: 028 REQ-006 AC-006.4
def test_search_tolerates_two_edits_in_a_word_of_eight_or_more_characters():
    """`almendars` (9 caracteres) encuentra «Almendras»."""
    assert search([food("Almendras")], "almendars") == ["Almendras"]


# SDD: 028 REQ-006 AC-006.5
def test_search_with_a_typo_still_requires_every_word_to_match():
    """`arroz blanko` encuentra el arroz blanco y no el integral."""
    foods = [food("Arroz blanco cocido"), food("Arroz integral cocido")]

    assert search(foods, "arroz blanko") == ["Arroz blanco cocido"]


# SDD: 028 REQ-006 AC-006.6
def test_typo_tolerance_is_not_applied_when_there_are_exact_matches():
    """Con coincidencias exactas para `pollo`, no aparece «Cacao en polvo»."""
    foods = [food("Pechuga de pollo a la plancha"), food("Cacao en polvo")]

    assert search(foods, "pollo") == ["Pechuga de pollo a la plancha"]
    # Sin coincidencias exactas, la tolerancia si actua (028).
    assert search(foods, "pello") == ["Pechuga de pollo a la plancha"]


# SDD: 028 REQ-006 AC-006.7
def test_a_form_of_less_than_four_characters_has_no_tolerance():
    """`pam` no encuentra «Pan blanco»."""
    assert search([food("Pan blanco")], "pam") == []
    # Con una forma de 4 o mas caracteres, la tolerancia si actua (028).
    assert search([food("Arroz blanco")], "aroz") == ["Arroz blanco"]


# SDD: 028 REQ-006 AC-006.8
def test_typo_tolerance_compares_with_the_start_of_the_word_not_its_inside():
    """`ijol` no encuentra «Frijoles negros cocidos»."""
    assert search([food("Frijoles negros cocidos")], "ijol") == []
    # Mientras que una errata al comienzo de la palabra si se tolera (028).
    assert search([food("Frijoles negros cocidos")], "frjoles") == ["Frijoles negros cocidos"]


# SDD: 028 REQ-006 AC-006.9
def test_typo_results_are_ordered_by_distance_and_then_by_name():
    """`huevi`: «Hueva de pescado» y «Huevo cocido» (distancia 1, por nombre) y
    no «Hueso de res» (distancia 2 en una palabra de 5 letras)."""
    foods = [food("Huevo cocido"), food("Hueva de pescado"), food("Hueso de res")]

    assert search(foods, "huevi") == ["Hueva de pescado", "Huevo cocido"]


# SDD: 028 REQ-006 AC-006.9
def test_typo_results_with_a_smaller_total_distance_go_first_even_if_later_by_name():
    """La suma de distancias manda sobre el orden alfabético: `almendro
    tostada` da distancia 1 a «Almendro tostado» y 2 a «Almendra tostado»."""
    foods = [food("Almendra tostado"), food("Almendro tostado")]

    assert search(foods, "almendro tostada") == ["Almendro tostado", "Almendra tostado"]


# SDD: 028 REQ-006 AC-006.10
def test_search_finds_a_word_ending_in_ces_by_its_singular_in_z():
    """`nueces` encuentra «Nuez»."""
    assert search([food("Nuez")], "nueces") == ["Nuez"]


# SDD: 028 REQ-006 AC-006.11
def test_search_with_a_gibberish_query_returns_nothing_even_with_tolerance():
    """`zzxqv` no encuentra nada ni con tolerancia."""
    assert search(RICE_CATALOG, "zzxqv") == []
    # Una errata real en la misma busqueda si encuentra el arroz (028).
    assert search(RICE_CATALOG, "aroz blanco") == ["Arroz blanco cocido"]


# SDD: 028 REQ-006 AC-006.1
def test_typo_search_returns_the_catalog_objects_not_copies():
    """Con tolerancia también se devuelven los alimentos del repositorio tal cual."""
    arroz = food("Arroz blanco cocido")
    service = CatalogSearchService(FakeCatalogFoodRepository([arroz]))

    assert service.search("aroz") == [arroz]


# SDD: 028 REQ-006 AC-006.10
def test_query_forms_adds_the_z_form_for_a_word_ending_in_ces():
    """`nueces` suma la forma `nuez` (conserva las de la 023) y `paces` la forma `paz`."""
    assert "nuez" in query_forms("nueces")[0]
    assert "nueces" in query_forms("nueces")[0]
    assert "paz" in query_forms("paces")[0]
    assert "luz" in query_forms("luces")[0]


# SDD: 028 REQ-006 AC-006.10
def test_query_forms_does_not_add_a_z_form_shorter_than_three_characters():
    """`ces` daría `z` (1 carácter): no se añade."""
    assert "z" not in query_forms("ces")[0]
    # La forma `z` de tres o mas caracteres si se anade (028).
    assert "luz" in query_forms("luces")[0]


# SDD: 028 REQ-006 AC-006.10
def test_query_forms_keeps_each_word_in_its_own_tuple_with_ces():
    """Una tupla por palabra, también cuando una de ellas termina en «ces»."""
    forms = query_forms("nueces cocidas")

    assert len(forms) == 2
    assert "nuez" in forms[0] and "nuez" not in forms[1]


# SDD: 028 REQ-006 AC-006.1
@pytest.mark.parametrize(
    "a, b, expected",
    [
        ("arroz", "arroz", 0),
        ("", "", 0),
        ("", "abc", 3),
        ("arroz", "aroz", 1),
        ("arroz", "arrox", 1),
        ("arroz", "arorz", 1),
        ("gato", "pato", 1),
        ("abc", "xyz", 3),
    ],
)
def test_edit_distance_counts_insertions_deletions_changes_and_swaps(a, b, expected):
    """Cada operación de una letra (insertar, borrar, cambiar o intercambiar
    dos contiguas) cuesta 1."""
    assert edit_distance(a, b) == expected
    assert edit_distance(b, a) == expected


# SDD: 028 REQ-006 AC-006.4
def test_prefix_edit_distance_compares_with_the_word_and_each_of_its_starts():
    """El mínimo frente a la palabra y frente a cada uno de sus inicios."""
    assert prefix_edit_distance("arroz", "arroz") == 0
    assert prefix_edit_distance("pol", "pollo") == 0
    assert prefix_edit_distance("polo", "pollo") == 1
    assert prefix_edit_distance("pechga", "pechuga") == 1
    assert prefix_edit_distance("almendars", "almendras") == 1
    assert prefix_edit_distance("huevi", "huevo") == 1
    assert prefix_edit_distance("huevi", "hueso") == 2


# SDD: 028 REQ-006 AC-006.8
def test_prefix_edit_distance_does_not_match_the_inside_of_a_word():
    """`ijol` frente a «frijoles» queda por encima de la tolerancia (1)."""
    assert prefix_edit_distance("ijol", "frijoles") > typo_tolerance("ijol")


# SDD: 028 REQ-006 AC-006.7
@pytest.mark.parametrize(
    "form, expected",
    [("", 0), ("a", 0), ("pam", 0), ("pan", 0), ("pola", 1), ("arroz", 1), ("almendr", 1),
     ("almendra", 2), ("almendras", 2), ("a" * 20, 2)],
)
def test_typo_tolerance_by_length_of_the_form(form, expected):
    """Menos de 4 caracteres: 0; de 4 a 7: 1; 8 o más: 2."""
    assert typo_tolerance(form) == expected


# --------------------------------------------------------------------------
# Spec 028: candidatos de varios orígenes (REQ-007)
# --------------------------------------------------------------------------


def candidate(name, source_order=0, key=None, synonyms=()):
    """Candidato cuyo `item` es una etiqueta legible: `catalogo:` o `propio:`."""
    label = ("catalogo" if source_order == 0 else "propio") + ":" + name
    return SearchCandidate(
        name=name,
        synonyms=list(synonyms),
        source_order=source_order,
        key=key or name.lower().replace(" ", "-"),
        item=label,
    )


# SDD: 028 REQ-007 AC-007.3
def test_rank_candidates_puts_the_catalog_food_before_the_own_one_with_the_same_name():
    """Mismo nombre: primero el del catálogo, aunque llegue después en la lista."""
    candidates = [
        candidate("Arroz blanco cocido", source_order=1, key="5"),
        candidate("Arroz blanco cocido", source_order=0, key="arroz-blanco-cocido"),
    ]

    assert rank_candidates(candidates, "arroz blanco cocido") == [
        "catalogo:Arroz blanco cocido",
        "propio:Arroz blanco cocido",
    ]


# SDD: 028 REQ-007 AC-007.1
def test_rank_candidates_mixes_both_origins_by_group_and_then_by_name():
    """Igual a la consulta, luego nombre que empieza por ella y luego el resto,
    sin importar el origen."""
    candidates = [
        candidate("Caldo de arroz", source_order=0),
        candidate("Arroz con pollo de mamá", source_order=1, key="1"),
        candidate("Arroz", source_order=1, key="2"),
        candidate("Arroz blanco cocido", source_order=0),
    ]

    assert rank_candidates(candidates, "arroz") == [
        "propio:Arroz",
        "catalogo:Arroz blanco cocido",
        "propio:Arroz con pollo de mamá",
        "catalogo:Caldo de arroz",
    ]


# SDD: 028 REQ-007 AC-007.5
def test_rank_candidates_returns_at_most_20_of_both_origins():
    """15 del catálogo y 10 propios que coinciden: exactamente 20."""
    candidates = [candidate(f"Arroz {n:02d}", source_order=0) for n in range(15)] + [
        candidate(f"Arroz propio {n:02d}", source_order=1, key=str(n)) for n in range(10)
    ]

    assert len(rank_candidates(candidates, "arroz")) == 20
    assert len(rank_candidates(candidates, "arroz", 5)) == 5


# SDD: 028 REQ-007 AC-007.7
def test_rank_candidates_applies_typo_tolerance_to_own_foods():
    """`galo pinto` encuentra el alimento propio «Gallo pinto»."""
    candidates = [candidate("Gallo pinto", source_order=1, key="1")]

    assert rank_candidates(candidates, "galo pinto") == ["propio:Gallo pinto"]


# SDD: 028 REQ-007 AC-007.1
def test_rank_candidates_uses_the_synonyms_of_a_candidate():
    """Un candidato con sinónimo se encuentra por él y va antes que un nombre que empieza igual."""
    candidates = [
        candidate("Guineo deshidratado", source_order=0),
        candidate("Banano", source_order=0, synonyms=["guineo"]),
    ]

    assert rank_candidates(candidates, "guineo") == [
        "catalogo:Banano",
        "catalogo:Guineo deshidratado",
    ]


# SDD: 028 REQ-006 AC-006.6
def test_rank_candidates_does_not_tolerate_typos_when_something_matches_exactly():
    """Si un candidato coincide, los que solo coinciden con erratas no aparecen."""
    candidates = [candidate("Pollo asado"), candidate("Polla de mar")]

    assert rank_candidates(candidates, "pollo") == ["catalogo:Pollo asado"]


# SDD: 028 REQ-006 AC-006.11
def test_rank_candidates_of_a_query_without_words_or_matches_is_empty():
    """Sin palabras o sin coincidencias, lista vacía."""
    candidates = [candidate("Banano")]

    assert rank_candidates(candidates, "--") == []
    assert rank_candidates(candidates, "zzxqv") == []
    assert rank_candidates([], "banano") == []


# SDD: 028 REQ-006 AC-006.1
def test_rank_catalog_keeps_working_with_typos_through_rank_candidates():
    """`rank_catalog` (la búsqueda del catálogo) usa las mismas reglas."""
    foods = [food("Arroz blanco cocido"), food("Frijoles negros cocidos")]

    assert [f.name for f in rank_catalog(foods, "aroz")] == ["Arroz blanco cocido"]


# --------------------------------------------------------------------------
# Spec 028, iteración 2: coste acotado de la búsqueda con tolerancia (NFR-004)
# --------------------------------------------------------------------------

CATALOG_CSV = Path(__file__).resolve().parents[2] / "scripts" / "data" / "food_catalog.csv"
LONG_GIBBERISH = "arroces " * 12 + "qzxw"


def catalog_023():
    """El catálogo real de la 023 (solo lectura), con la forma de `CatalogFood`."""
    return [
        make_catalog_food(record.id, record.name, record.synonyms)
        for record in read_catalog_csv(CATALOG_CSV)
    ]


def comparisons_of(foods, query):
    """Resultados y comparaciones que hace `rank_catalog` con tolerancia."""
    stats = TypoSearchStats()
    results = rank_catalog(foods, query, stats=stats)
    return results, stats.comparisons


# SDD: 028 NFR-004 AC-N004.3
def test_within_tolerance_of_a_form_shorter_than_four_characters_does_not_compare():
    """«pam» (3 caracteres) solo coincide con el inicio de una palabra y no
    cuenta como comparación; una forma larga sí cuenta."""
    stats = TypoSearchStats()
    distances = TypoDistances(stats)

    assert distances.within_tolerance("pam", "pamplona") == 0
    assert distances.within_tolerance("pam", "pan") is None
    assert stats.comparisons == 0

    assert distances.within_tolerance("arroz", "arroz") == 0
    assert stats.comparisons == 1


# SDD: 028 NFR-004 AC-N004.1
def test_within_tolerance_skips_a_word_too_short_to_be_within_the_tolerance():
    """Una palabra más corta que la forma menos su tolerancia no se compara;
    una justo en el límite sí."""
    stats = TypoSearchStats()
    distances = TypoDistances(stats)

    assert distances.within_tolerance("arroz", "ar") is None
    assert distances.within_tolerance("arroz", "arr") is None
    assert stats.comparisons == 0

    assert distances.within_tolerance("arroz", "arro") == 1
    assert stats.comparisons == 1


# SDD: 028 NFR-004 AC-N004.1
def test_within_tolerance_remembers_each_pair_form_word():
    """La misma pareja dos veces es una sola comparación, con el mismo valor;
    otra pareja suma una."""
    stats = TypoSearchStats()
    distances = TypoDistances(stats)

    assert distances.within_tolerance("arroz", "aroz") == 1
    assert distances.within_tolerance("arroz", "aroz") == 1
    assert stats.comparisons == 1

    assert distances.within_tolerance("arroz", "arrozal") == 0
    assert stats.comparisons == 2


# SDD: 028 NFR-004 AC-N004.1
def test_within_tolerance_returns_none_above_the_tolerance_and_counts_the_comparison():
    """«arroz» frente a «arxxx» está a 3, por encima de 1; la tolerancia de una
    forma de 9 caracteres es 2."""
    stats = TypoSearchStats()
    distances = TypoDistances(stats)

    assert distances.within_tolerance("arroz", "arxxx") is None
    assert stats.comparisons == 1

    assert distances.within_tolerance("integrale", "integral") == 1
    assert stats.comparisons == 2


# SDD: 028 NFR-004 AC-N004.1
def test_typo_comparison_bound_is_forms_times_distinct_words():
    """F cuenta formas distintas de 4 o más caracteres; P, palabras distintas de
    nombres y sinónimos, sin mayúsculas ni tildes. Valores calculados a mano."""
    candidates = [
        SearchCandidate("Arroz blanco cocido", ["arroz", "Arroz Blanco"], 0, "1", None),
        SearchCandidate("Frijoles negros", [], 0, "2", None),
        SearchCandidate("Arroz propio", [], 1, "3", None),
    ]
    # Palabras: arroz, blanco, cocido, frijoles, negros, propio = 6.

    assert typo_comparison_bound(candidates, "arroces integrale") == 5 * 6
    assert typo_comparison_bound(candidates, "arroces arroces") == 4 * 6
    assert typo_comparison_bound(candidates, "arroces pam") == 4 * 6
    assert typo_comparison_bound(candidates, "pam") == 0
    assert typo_comparison_bound([], "arroces integrale") == 0


# SDD: 028 NFR-004 AC-N004.1
def test_the_long_query_of_repeated_words_makes_the_same_comparisons_as_the_short_one():
    """`"arroces " * 12 + "qzxw"` (100 caracteres) no encuentra nada, hace
    como mucho F × P comparaciones y las mismas que `arroces qzxw`."""
    foods = catalog_023()
    assert len(LONG_GIBBERISH) == 100
    candidates = [SearchCandidate(f.name, f.synonyms, 0, str(f.id), f) for f in foods]

    long_results, long_comparisons = comparisons_of(foods, LONG_GIBBERISH)
    short_results, short_comparisons = comparisons_of(foods, "arroces qzxw")

    assert long_results == [] and short_results == []
    assert short_comparisons > 0
    assert long_comparisons == short_comparisons
    assert long_comparisons <= typo_comparison_bound(candidates, LONG_GIBBERISH)
    assert typo_comparison_bound(candidates, LONG_GIBBERISH) == typo_comparison_bound(
        candidates, "arroces qzxw"
    )


# SDD: 028 NFR-004 AC-N004.2
def test_a_typo_search_with_results_stays_within_the_bound_and_finds_the_food():
    """`arroces integrale` encuentra «Arroz integral cocido» sin pasar de F × P."""
    foods = catalog_023()
    candidates = [SearchCandidate(f.name, f.synonyms, 0, str(f.id), f) for f in foods]

    results, comparisons = comparisons_of(foods, "arroces integrale")

    assert "Arroz integral cocido" in [food.name for food in results]
    assert 0 < comparisons <= typo_comparison_bound(candidates, "arroces integrale")


# SDD: 028 NFR-004 AC-N004.3
def test_exact_matches_and_forms_shorter_than_four_characters_make_no_comparisons():
    """`arroz` ya coincide y `pam` no tiene formas de 4 caracteres: 0
    comparaciones; la búsqueda que sí necesita tolerancia, más de 0."""
    foods = catalog_023()

    rice, rice_comparisons = comparisons_of(foods, "arroz")
    _, pam_comparisons = comparisons_of(foods, "pam")
    _, typo_comparisons = comparisons_of(foods, "arroces qzxw")

    assert "Arroz blanco cocido" in [food.name for food in rice]
    assert rice_comparisons == 0
    assert pam_comparisons == 0
    assert typo_comparisons > 0
