"""Reglas puras de la estimación de porciones (spec 030): validación de la
pregunta y saneado de lo que devuelve el modelo."""

import pytest

from exceptions.custom_exceptions import ValidationError
from services.portion_estimate_rules import (
    NOT_FOOD_MESSAGE,
    QUESTION_REQUIRED_MESSAGE,
    QUESTION_TOO_LONG_MESSAGE,
    UNKNOWN_MESSAGE,
    PortionEstimate,
    build_estimate,
    clean_text,
    parse_grams,
    parse_question,
)

INVALID = "La petición no es válida"


def food(grams=250, unit="5 huevos grandes", note="Unos 50 g por huevo.", **extra):
    data = {"is_food": True, "grams": grams, "unit": unit, "note": note}
    data.update(extra)
    return data


def unknown():
    return PortionEstimate("unknown", None, None, None, UNKNOWN_MESSAGE)


# --- parse_question ---------------------------------------------------------


# SDD: 030 REQ-005 AC-005.1
@pytest.mark.parametrize("data", [None, [], ["question"], 5, "texto"])
def test_parse_question_rejects_a_body_that_is_not_an_object(data):
    """Si el cuerpo no es un objeto JSON, la petición no es válida."""
    with pytest.raises(ValidationError) as error:
        parse_question(data)

    assert str(error.value) == INVALID


# SDD: 030 REQ-005 AC-005.2
@pytest.mark.parametrize("data", [{}, {"question": ""}, {"question": "   "}])
def test_parse_question_requires_a_non_blank_question(data):
    """Pregunta ausente, vacía o de solo espacios: se pide el alimento."""
    with pytest.raises(ValidationError) as error:
        parse_question(data)

    assert str(error.value) == QUESTION_REQUIRED_MESSAGE


# SDD: 030 REQ-005 AC-005.3
@pytest.mark.parametrize("value", [5, ["huevo"], None])
def test_parse_question_rejects_a_question_that_is_not_text(value):
    """Una pregunta que no es texto (número, lista, null) no es válida."""
    with pytest.raises(ValidationError) as error:
        parse_question({"question": value})

    assert str(error.value) == INVALID


# SDD: 030 REQ-005 AC-005.4
def test_parse_question_rejects_201_characters():
    """201 caracteres superan el máximo."""
    with pytest.raises(ValidationError) as error:
        parse_question({"question": "a" * 201})

    assert str(error.value) == QUESTION_TOO_LONG_MESSAGE


# SDD: 030 REQ-005 AC-005.5
def test_parse_question_accepts_200_characters_and_strips_the_edges():
    """200 caracteres rodeados de espacios se aceptan y se devuelven sin ellos."""
    question = "a" * 200

    assert parse_question({"question": f"  {question}\n "}) == question


# SDD: 030 REQ-005 AC-005.5
def test_parse_question_counts_the_length_after_stripping():
    """Los espacios de los extremos no cuentan para el máximo."""
    assert parse_question({"question": "  5 huevos  "}) == "5 huevos"


# --- parse_grams ------------------------------------------------------------


# SDD: 030 REQ-001 AC-001.2
@pytest.mark.parametrize(
    "value, expected",
    [(152.6, 153), (152.4, 152), (0.5, 1), (2.5, 3), (250, 250), (1, 1), (5000, 5000), (5000.4, 5000)],
)
def test_parse_grams_rounds_half_up_to_an_integer(value, expected):
    """Redondea al entero más cercano; las mitades suben."""
    assert parse_grams(value) == expected


# SDD: 030 REQ-004 AC-004.1
@pytest.mark.parametrize(
    "value", [0, 0.4, -10, 5001, 5000.5, None, "250", True, False, float("nan"), float("inf"), [], {}]
)
def test_parse_grams_returns_none_when_not_valid(value):
    """Fuera de 1 a 5000 tras redondear, o no numérico: no hay gramos."""
    assert parse_grams(value) is None


# --- clean_text -------------------------------------------------------------


# SDD: 030 REQ-001 AC-001.4
@pytest.mark.parametrize("value", [None, "", "   ", 5, ["x"]])
def test_clean_text_returns_none_when_missing_or_blank(value):
    """Ausente, vacío, de espacios o no textual: None."""
    assert clean_text(value, 50) is None


# SDD: 030 REQ-002 AC-002.3
def test_clean_text_strips_the_edges():
    """Quita los espacios de los extremos."""
    assert clean_text("  un filete mediano  ", 50) == "un filete mediano"


# SDD: 030 REQ-002 AC-002.2
def test_clean_text_truncates_without_trailing_space():
    """Recorta al máximo y el resultado no termina en espacio."""
    value = "a" * 49 + " " + "b" * 30

    result = clean_text(value, 50)

    assert len(result) <= 50
    assert value.startswith(result)
    assert not result.endswith(" ")


# --- build_estimate: estimated ---------------------------------------------


# SDD: 030 REQ-001 AC-001.1
def test_build_estimate_returns_the_estimation_for_valid_food():
    """Comida con gramos válidos: estimated con los cinco campos."""
    estimate = build_estimate(
        food(250, "5 huevos grandes", "Unos 50 g por huevo sin cáscara.")
    )

    assert estimate == PortionEstimate(
        "estimated", 250, "5 huevos grandes", "Unos 50 g por huevo sin cáscara.", None
    )


# SDD: 030 REQ-001 AC-001.2
def test_build_estimate_rounds_the_grams():
    """152,6 g se devuelve como 153."""
    assert build_estimate(food(152.6)).grams == 153


# SDD: 030 REQ-001 AC-001.3
@pytest.mark.parametrize("grams", [1, 5000])
def test_build_estimate_accepts_the_range_limits(grams):
    """1 y 5000 son estimaciones válidas."""
    estimate = build_estimate(food(grams))

    assert estimate.status == "estimated"
    assert estimate.grams == grams


# SDD: 030 REQ-001 AC-001.4
def test_build_estimate_leaves_unit_and_note_none_when_the_model_omits_them():
    """Sin porción ni nota, ambas quedan en None."""
    estimate = build_estimate({"is_food": True, "grams": 100})

    assert estimate.status == "estimated"
    assert estimate.unit is None
    assert estimate.note is None


# SDD: 030 REQ-001 AC-001.4
@pytest.mark.parametrize("blank", ["", "   ", None])
def test_build_estimate_leaves_unit_and_note_none_when_blank(blank):
    """Textos vacíos o de espacios: unit y note son None."""
    estimate = build_estimate(food(100, blank, blank))

    assert estimate.status == "estimated"
    assert estimate.unit is None
    assert estimate.note is None


# SDD: 030 REQ-002 AC-002.1
def test_build_estimate_truncates_a_long_note_to_100():
    """Una nota de 180 caracteres sale con 100 como máximo y sin espacio final."""
    note = ("palabra " * 30).strip()[:180]

    estimate = build_estimate(food(100, "x", note))

    assert len(estimate.note) <= 100
    assert note.startswith(estimate.note)
    assert not estimate.note.endswith(" ")


# SDD: 030 REQ-002 AC-002.2
def test_build_estimate_truncates_a_long_unit_to_50():
    """Una porción de 80 caracteres sale con 50 como máximo y sin espacio final."""
    unit = ("trozo " * 20).strip()[:80]

    estimate = build_estimate(food(100, unit, "nota"))

    assert len(estimate.unit) <= 50
    assert unit.startswith(estimate.unit)
    assert not estimate.unit.endswith(" ")


# SDD: 030 REQ-002 AC-002.3
def test_build_estimate_strips_the_unit():
    """La porción se devuelve sin espacios en los extremos."""
    assert build_estimate(food(100, "  un filete mediano  ")).unit == "un filete mediano"


# --- build_estimate: not_food ----------------------------------------------


# SDD: 030 REQ-003 AC-003.1
def test_build_estimate_returns_not_food_with_the_fixed_message():
    """is_food false: not_food con el mensaje fijo y nada más."""
    estimate = build_estimate({"is_food": False})

    assert estimate == PortionEstimate("not_food", None, None, None, NOT_FOOD_MESSAGE)


# SDD: 030 REQ-003 AC-003.2
def test_build_estimate_ignores_everything_else_when_not_food():
    """Aunque el modelo incluya gramos, porción y nota, no salen en la respuesta."""
    estimate = build_estimate(
        {"is_food": False, "grams": 250, "unit": "algo", "note": "texto del modelo"}
    )

    assert estimate == PortionEstimate("not_food", None, None, None, NOT_FOOD_MESSAGE)


# --- build_estimate: unknown -----------------------------------------------


# SDD: 030 REQ-004 AC-004.1
@pytest.mark.parametrize("grams", [0, 5001, -10, 0.4, None, "250", True])
def test_build_estimate_is_unknown_when_the_grams_are_not_valid(grams):
    """Comida con gramos no válidos: unknown con el mensaje fijo."""
    assert build_estimate(food(grams)) == unknown()


# SDD: 030 REQ-004 AC-004.1
def test_build_estimate_is_unknown_when_the_grams_are_missing():
    """Comida sin la clave grams: unknown."""
    assert build_estimate({"is_food": True, "unit": "x"}) == unknown()


# SDD: 030 REQ-004 AC-004.3
@pytest.mark.parametrize(
    "tool_input",
    [
        {},
        {"grams": 250},
        {"is_food": None, "grams": 250},
        {"is_food": "true", "grams": 250},
        {"is_food": 1, "grams": 250},
        None,
        [],
        "texto",
    ],
)
def test_build_estimate_is_unknown_when_the_structure_is_not_the_expected(tool_input):
    """Sin estructura esperada (sin is_food, is_food no booleano, no dict): unknown."""
    assert build_estimate(tool_input) == unknown()
