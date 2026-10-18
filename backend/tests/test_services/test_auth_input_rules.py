"""Unitarios de las reglas del cuerpo y de los nombres del registro (spec 018).
Funciones puras: no hay base de datos ni dobles de prueba."""

import pytest

from exceptions.custom_exceptions import ValidationError
from services.auth_input_rules import (
    FIRST_NAME_REQUIRED_MESSAGE,
    FIRST_NAME_TOO_LONG_MESSAGE,
    INVALID_REQUEST_MESSAGE,
    LAST_NAME_REQUIRED_MESSAGE,
    LAST_NAME_TOO_LONG_MESSAGE,
    require_json_object,
    validate_first_name,
    validate_last_name,
)


# SDD: 018 REQ-001 AC-001.3 AC-001.4 REQ-002 AC-002.3 AC-002.4
def test_require_json_object_returns_the_same_dict():
    """Un dict (incluso vacío) se devuelve tal cual."""
    body = {"email": "ana@example.com"}

    assert require_json_object(body) is body
    assert require_json_object({}) == {}


# SDD: 018 REQ-001 AC-001.3 AC-001.4 REQ-002 AC-002.3 AC-002.4
@pytest.mark.parametrize("body", [None, [], [{"email": "a@b.co"}], 5, 1.5, "texto", True])
def test_require_json_object_rejects_anything_that_is_not_an_object(body):
    """None, listas, números, textos y booleanos dan 'La petición no es válida'."""
    with pytest.raises(ValidationError) as exc_info:
        require_json_object(body)

    assert str(exc_info.value) == INVALID_REQUEST_MESSAGE
    assert INVALID_REQUEST_MESSAGE == "La petición no es válida"


# SDD: 018 REQ-003 AC-003.1 AC-003.2 AC-003.3
@pytest.mark.parametrize("value", [None, "", "   ", 123, [], {}, True])
def test_validate_first_name_requires_a_non_blank_text(value):
    """Ausente, no texto o en blanco: 'El nombre es obligatorio'."""
    with pytest.raises(ValidationError) as exc_info:
        validate_first_name(value)

    assert str(exc_info.value) == FIRST_NAME_REQUIRED_MESSAGE
    assert FIRST_NAME_REQUIRED_MESSAGE == "El nombre es obligatorio"


# SDD: 018 REQ-003 AC-003.4 AC-003.7
@pytest.mark.parametrize("length", [101, 300])
def test_validate_first_name_rejects_more_than_100_characters(length):
    """101 y 300 caracteres dan 'El nombre no puede superar los 100 caracteres'."""
    with pytest.raises(ValidationError) as exc_info:
        validate_first_name("a" * length)

    assert str(exc_info.value) == "El nombre no puede superar los 100 caracteres"
    assert FIRST_NAME_TOO_LONG_MESSAGE == "El nombre no puede superar los 100 caracteres"


# SDD: 018 REQ-003 AC-003.5
def test_validate_first_name_trims_before_measuring_the_length():
    """100 caracteres rodeados de espacios se aceptan y se devuelven recortados."""
    assert validate_first_name("  " + "a" * 100 + "  ") == "a" * 100


# SDD: 018 REQ-003 AC-003.6
def test_validate_first_name_keeps_inner_spaces_and_accents():
    """'  María José ' se devuelve como 'María José'."""
    assert validate_first_name("  María José ") == "María José"


# SDD: 018 REQ-004 AC-004.1 AC-004.2 AC-004.3
@pytest.mark.parametrize("value", [None, "", "   ", 123, [], {}, True])
def test_validate_last_name_requires_a_non_blank_text(value):
    """Ausente, no texto o en blanco: 'El apellido es obligatorio'."""
    with pytest.raises(ValidationError) as exc_info:
        validate_last_name(value)

    assert str(exc_info.value) == LAST_NAME_REQUIRED_MESSAGE
    assert LAST_NAME_REQUIRED_MESSAGE == "El apellido es obligatorio"


# SDD: 018 REQ-004 AC-004.4
def test_validate_last_name_rejects_more_than_100_characters():
    """101 caracteres dan 'El apellido no puede superar los 100 caracteres'."""
    with pytest.raises(ValidationError) as exc_info:
        validate_last_name("a" * 101)

    assert str(exc_info.value) == "El apellido no puede superar los 100 caracteres"
    assert LAST_NAME_TOO_LONG_MESSAGE == "El apellido no puede superar los 100 caracteres"


# SDD: 018 REQ-004 AC-004.5
def test_validate_last_name_trims_the_value():
    """' Pérez  ' se devuelve como 'Pérez' y 100 caracteres con espacios se aceptan."""
    assert validate_last_name(" Pérez  ") == "Pérez"
    assert validate_last_name(" " + "b" * 100 + " ") == "b" * 100
