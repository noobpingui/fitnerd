"""Tests UNITARIOS de las reglas puras del catálogo de alimentos (spec 023):
sin base de datos ni red."""

import pytest

from services.catalog_rules import fold, is_catalog_id, term_key, word_forms, words


# SDD: 023 REQ-004 AC-004.3
@pytest.mark.parametrize(
    "text, expected",
    [
        ("PLÁTANO", "platano"),
        ("plátano", "platano"),
        ("  Plátano  ", "  platano  "),
        ("Piña", "pina"),
        ("Pingüino", "pinguino"),
        ("Ñoño", "nono"),
        ("Brócoli", "brocoli"),
    ],
)
def test_fold_ignores_case_accents_dieresis_and_enye(text, expected):
    """Mayúsculas, tildes, diéresis y «ñ» quedan iguales a su letra base."""
    assert fold(text) == expected


# SDD: 023 REQ-004 AC-004.6
def test_fold_makes_pina_and_piña_equal():
    """«Piña» y «pina» se pliegan al mismo texto."""
    assert fold("Piña") == fold("pina") == "pina"


# SDD: 023 REQ-004 AC-004.3
def test_words_splits_on_spaces_commas_and_hyphens_after_folding():
    """Las palabras son tramos de letras y dígitos sin tildes ni mayúsculas."""
    assert words("Pechuga de pollo, a la plancha") == [
        "pechuga",
        "de",
        "pollo",
        "a",
        "la",
        "plancha",
    ]
    assert words("  Té-verde 2x ") == ["te", "verde", "2x"]


# SDD: 023 REQ-004 AC-004.3
def test_words_of_a_text_without_letters_or_digits_is_empty():
    """Solo signos: no hay palabras."""
    assert words("--") == []
    assert words("   ") == []


# SDD: 023 REQ-004 AC-004.6
def test_term_key_joins_the_folded_words_with_single_spaces():
    """La clave de unicidad no distingue mayúsculas, tildes ni separadores."""
    assert term_key("  Piña,   Tropical ") == "pina tropical"
    assert term_key("PIÑA") == term_key("pina")


# SDD: 023 REQ-004 AC-004.12
def test_word_forms_of_a_plural_with_s_has_the_written_and_the_form_without_s():
    """«huevos» → escrita y sin «s» («huevo»); no termina en «es», así que no
    hay tercera forma."""
    assert word_forms("huevos") == ("huevos", "huevo")


# SDD: 023 REQ-004 AC-004.13
def test_word_forms_of_a_plural_with_es_includes_the_form_without_es():
    """«limones» → «limones», «limone» y «limon»."""
    assert word_forms("limones") == ("limones", "limone", "limon")


# SDD: 023 REQ-004 AC-004.14
def test_word_forms_of_bananos():
    """«bananos» → «bananos» y «banano» (no termina en «es»)."""
    assert word_forms("bananos") == ("bananos", "banano")


# SDD: 023 REQ-004 AC-004.15
def test_word_forms_discards_reduced_forms_shorter_than_three_characters():
    """«es» solo tiene su forma escrita: «e» y la vacía se descartan."""
    assert word_forms("es") == ("es",)


# SDD: 023 REQ-004 AC-004.15
def test_word_forms_keeps_a_reduced_form_of_exactly_three_characters():
    """«ajos» → «ajos» y «ajo» (3 caracteres); la de «es» no aplica."""
    assert word_forms("ajos") == ("ajos", "ajo")
    assert word_forms("arroz") == ("arroz",)


# SDD: 023 REQ-004 AC-004.15
def test_word_forms_has_no_repeated_forms():
    """Una palabra que termina en «ses» o «s» no repite formas."""
    forms = word_forms("pases")
    assert len(forms) == len(set(forms))
    assert forms[0] == "pases"
    assert "pase" in forms and "pas" in forms


# SDD: 023 REQ-004 AC-004.12
def test_word_forms_of_a_word_without_final_s_is_only_the_written_form():
    """Sin «s» final no hay formas reducidas."""
    assert word_forms("huevo") == ("huevo",)


# SDD: 023 REQ-001 AC-001.1
@pytest.mark.parametrize(
    "value",
    [
        "arroz-blanco-cocido",
        "ab",
        "pechuga-de-pollo-a-la-plancha",
        "a1",
        "2-3",
        "a" * 60,
    ],
)
def test_is_catalog_id_accepts_valid_identifiers(value):
    """Minúsculas, dígitos y guiones sueltos, de 2 a 60 caracteres."""
    assert is_catalog_id(value) is True


# SDD: 023 REQ-001 AC-001.1
@pytest.mark.parametrize(
    "value",
    [
        "Arroz-blanco",
        "plátano",
        "piña",
        "ñame",
        "-arroz",
        "arroz-",
        "arroz--blanco",
        "a",
        "",
        "a" * 61,
        "arroz blanco",
        "arroz_blanco",
        None,
        5,
        True,
        ["arroz"],
    ],
)
def test_is_catalog_id_rejects_everything_else(value):
    """Mayúsculas, tildes, «ñ», guiones al principio, al final o dobles,
    longitudes 1 y 61 y valores que no son texto."""
    assert is_catalog_id(value) is False
