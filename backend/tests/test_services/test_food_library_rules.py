"""Tests UNITARIOS de las reglas puras de la biblioteca de alimentos (spec 028):
la clave de nombre de un alimento propio y la validación de su identificador.
Sin base de datos ni red.
"""

import pytest

from services.food_library_rules import (
    custom_food_name_key,
    parse_custom_food_id,
)

MAX_INT = 2_147_483_647


# SDD: 028 REQ-001 AC-001.2
@pytest.mark.parametrize(
    "name", ["Gallo pinto", "gallo pinto", "GALLO PINTO", "  gallo PINTO ", "\tGallo pinto\n"]
)
def test_name_key_ignores_case_and_surrounding_spaces(name):
    """Mayúsculas y espacios en los extremos no distinguen nombres."""
    assert custom_food_name_key(name) == custom_food_name_key("Gallo pinto")


# SDD: 028 REQ-001 AC-001.4
def test_name_key_ignores_accents_and_the_enye():
    """«Piña colada» y «Pina colada» tienen la misma clave."""
    assert custom_food_name_key("Piña colada") == custom_food_name_key("Pina colada")
    assert custom_food_name_key("Café con LECHE") == custom_food_name_key("cafe con leche")


# SDD: 028 REQ-001 AC-001.10
@pytest.mark.parametrize("name", ["Gallo    pinto", "Gallo \t pinto", " Gallo  pinto "])
def test_name_key_counts_repeated_spaces_as_one(name):
    """Los espacios repetidos entre palabras cuentan como uno."""
    assert custom_food_name_key(name) == custom_food_name_key("Gallo pinto")


# SDD: 028 REQ-001 AC-001.2
def test_name_key_is_still_distinct_for_different_names_and_punctuation():
    """Solo mayúsculas, tildes y espacios se ignoran: la puntuación y otras
    palabras sí distinguen nombres."""
    assert custom_food_name_key("Gallo pinto") != custom_food_name_key("Gallo pintos")
    assert custom_food_name_key("Gallo-pinto") != custom_food_name_key("Gallo pinto")
    assert custom_food_name_key("Arroz") != custom_food_name_key("Arroz blanco")


# SDD: 028 REQ-004 AC-004.3
@pytest.mark.parametrize(
    "value, expected",
    [(1, 1), (12, 12), (MAX_INT, MAX_INT), ("7", 7), ("12", 12), (str(MAX_INT), MAX_INT)],
)
def test_parse_custom_food_id_accepts_integers_and_digit_text_in_range(value, expected):
    """Un entero o un texto de dígitos entre 1 y 2.147.483.647 se convierte en entero."""
    assert parse_custom_food_id(value) == expected


# SDD: 028 REQ-003 AC-003.2
@pytest.mark.parametrize(
    "value",
    [
        0,
        -1,
        MAX_INT + 1,
        "0",
        "-1",
        "abc",
        "12abc",
        "1.5",
        "",
        str(MAX_INT + 1),
        None,
        1.5,
        True,
        [],
        {},
    ],
)
def test_parse_custom_food_id_returns_none_for_everything_else(value):
    """Cero, negativos, fuera del rango de la base, texto no numérico y tipos
    que no son un identificador dan `None`."""
    assert parse_custom_food_id(value) is None
