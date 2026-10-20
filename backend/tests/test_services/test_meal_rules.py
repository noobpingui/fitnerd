"""Tests UNITARIOS de las reglas puras del diario de comidas (spec 022): sin
base de datos ni red. Los mensajes se comparan con el texto literal de la
sección 6 de la spec, no con las constantes del módulo.
"""

from datetime import date
from decimal import Decimal

import pytest

from exceptions.custom_exceptions import ValidationError
from services.meal_rules import (
    CustomItemInput,
    UsdaItemInput,
    check_add_window,
    is_db_id,
    parse_items,
    parse_meal_date,
    parse_meal_type,
    portion_nutrients,
    sum_nutrients,
    validate_grams,
)

DATE_INVALID = "La fecha no es válida."
OUT_OF_WINDOW = "Solo puedes registrar comidas de hoy."
MEAL_TYPE_INVALID = "El tipo de comida no es válido."
ITEMS_REQUIRED = "Añade al menos un alimento."
TOO_MANY = "Una comida no puede tener más de 50 alimentos."
ITEM_SOURCE = "Cada alimento debe ser de USDA o personalizado."
GRAMS_RANGE = "Los gramos deben estar entre 1 y 2000."
GRAMS_DECIMALS = "Los gramos admiten como mucho un decimal."
NAME_REQUIRED = "Escribe el nombre del alimento."
NAME_TOO_LONG = "El nombre no puede superar los 100 caracteres."
PER_100G_REQUIRED = "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
CALORIES_RANGE = "Las calorías por 100 g deben estar entre 0 y 900."
MACROS_RANGE = "Los macros por 100 g deben estar entre 0 y 100 g."
MACROS_SUM = "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."

CHICKEN_PER_100G = {"calories_kcal": 165, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.57}


def custom(per_100g=None, name="Gallo pinto", grams=250):
    """Alimento personalizado válido; `per_100g` sustituye al de por defecto."""
    return {
        "name": name,
        "grams": grams,
        "per_100g": per_100g
        if per_100g is not None
        else {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2},
    }


def macros(calories=100, protein=10, carbs=10, fat=10):
    return {"calories_kcal": calories, "protein_g": protein, "carbs_g": carbs, "fat_g": fat}


def message_of(callable_, *args):
    with pytest.raises(ValidationError) as exc_info:
        callable_(*args)
    return str(exc_info.value)


# --------------------------------------------------------------------------
# Fecha, ventana y tipo de comida
# --------------------------------------------------------------------------


# SDD: 022 REQ-004 AC-004.3
def test_parse_meal_date_accepts_a_real_iso_date():
    """`2026-10-20` se convierte en la fecha real."""
    assert parse_meal_date("2026-10-20") == date(2026, 10, 20)


# SDD: 022 REQ-004 AC-004.3
@pytest.mark.parametrize(
    "value", [None, "", "20-10-2026", "2026-02-30", "2026-13-01", "2026/10/20", 20261020, True]
)
def test_parse_meal_date_rejects_missing_wrong_format_or_unreal_dates(value):
    """Ausente, con otro formato, inexistente o no texto: «La fecha no es válida.»."""
    assert message_of(parse_meal_date, value) == DATE_INVALID


# SDD: 022 REQ-005 AC-005.6
@pytest.mark.parametrize("value", [None, "no-es-fecha", "2026-00-10"])
def test_parse_meal_date_rejects_an_invalid_date_for_the_diary_query(value):
    """La consulta del diario usa la misma regla de fecha."""
    assert message_of(parse_meal_date, value) == DATE_INVALID


# SDD: 022 REQ-004 AC-004.1
@pytest.mark.parametrize("day", [20, 21, 22])
def test_check_add_window_accepts_yesterday_today_and_tomorrow(day):
    """Con hoy el 2026-10-21, se aceptan el 20, el 21 y el 22."""
    check_add_window(date(2026, 10, day), date(2026, 10, 21))


# SDD: 022 REQ-004 AC-004.2
@pytest.mark.parametrize("day", [19, 23])
def test_check_add_window_rejects_two_days_away(day):
    """Con hoy el 2026-10-21, el 19 y el 23 quedan fuera de la ventana."""
    assert message_of(check_add_window, date(2026, 10, day), date(2026, 10, 21)) == OUT_OF_WINDOW


# SDD: 022 REQ-003 AC-003.2
@pytest.mark.parametrize("value", ["breakfast", "lunch", "dinner", "snack"])
def test_parse_meal_type_accepts_the_four_types(value):
    """Los cuatro tipos de comida son válidos y se devuelven tal cual."""
    assert parse_meal_type(value) == value


# SDD: 022 REQ-003 AC-003.2
@pytest.mark.parametrize("value", [None, "", "brunch", "Breakfast", 1, ["lunch"]])
def test_parse_meal_type_rejects_missing_or_unknown_types(value):
    """Ausente o desconocido: «El tipo de comida no es válido.»."""
    assert message_of(parse_meal_type, value) == MEAL_TYPE_INVALID


# --------------------------------------------------------------------------
# Gramos
# --------------------------------------------------------------------------


# SDD: 022 REQ-003 AC-003.4
@pytest.mark.parametrize("value", [1, 2000, 150, 150.5, 1.0])
def test_validate_grams_accepts_the_limits_and_one_decimal(value):
    """1 y 2000 son válidos, y también un decimal."""
    assert validate_grams(value) == Decimal(str(value))


# SDD: 022 REQ-003 AC-003.5
def test_validate_grams_returns_a_decimal():
    """El resultado es un `Decimal` con un decimal."""
    result = validate_grams(150.5)

    assert isinstance(result, Decimal)
    assert result == Decimal("150.5")


# SDD: 022 REQ-003 AC-003.4
@pytest.mark.parametrize("value", [0, 0.9, 2001, 2000.5, -5, "150", True, None, [150], {}])
def test_validate_grams_rejects_missing_non_numeric_or_out_of_range(value):
    """Faltan, no son número o salen de 1 a 2000: mensaje de rango."""
    assert message_of(validate_grams, value) == GRAMS_RANGE


# SDD: 022 REQ-003 AC-003.5
@pytest.mark.parametrize("value", [150.25, 1.05, 999.99])
def test_validate_grams_rejects_more_than_one_decimal(value):
    """Con más de un decimal: «Los gramos admiten como mucho un decimal.»."""
    assert message_of(validate_grams, value) == GRAMS_DECIMALS


# --------------------------------------------------------------------------
# is_db_id
# --------------------------------------------------------------------------


# SDD: 022 REQ-009 AC-009.5
@pytest.mark.parametrize("value", [1, 12, 2_147_483_647])
def test_is_db_id_accepts_integers_in_the_database_range(value):
    """Un entero entre 1 y 2 147 483 647 es un id posible."""
    assert is_db_id(value) is True


# SDD: 022 REQ-009 AC-009.5
@pytest.mark.parametrize("value", [0, -1, 2_147_483_648, True, "1", 1.0, None])
def test_is_db_id_rejects_everything_else(value):
    """Fuera de rango, booleanos, textos y decimales no son ids."""
    assert is_db_id(value) is False


# --------------------------------------------------------------------------
# parse_items
# --------------------------------------------------------------------------


# SDD: 022 REQ-003 AC-003.3
@pytest.mark.parametrize("value", [None, [], "pollo", {"fdc_id": 1}, 5])
def test_parse_items_requires_a_non_empty_list(value):
    """`items` ausente, vacío o no lista: «Añade al menos un alimento.»."""
    assert message_of(parse_items, value) == ITEMS_REQUIRED


# SDD: 022 REQ-003 AC-003.13
def test_parse_items_rejects_more_than_50_items_before_validating_each_one():
    """51 elementos dan el error del tope aunque ninguno sea válido."""
    assert message_of(parse_items, [{}] * 51) == TOO_MANY


# SDD: 022 REQ-003 AC-003.13
def test_parse_items_accepts_exactly_50_items():
    """50 elementos válidos se aceptan."""
    result = parse_items([{"fdc_id": 171477, "grams": 10}] * 50)

    assert len(result) == 50


# SDD: 022 REQ-001 AC-001.5
def test_parse_items_parses_a_usda_item():
    """Un alimento de USDA se convierte en `UsdaItemInput` con gramos Decimal."""
    result = parse_items([{"fdc_id": 171477, "grams": 150}])

    assert result == [UsdaItemInput(fdc_id=171477, grams=Decimal("150"))]


# SDD: 022 REQ-001 AC-001.5
def test_parse_items_keeps_the_order_of_the_request():
    """Los alimentos salen en el orden de la petición."""
    result = parse_items(
        [{"fdc_id": 3, "grams": 10}, {"fdc_id": 1, "grams": 20}, {"fdc_id": 2, "grams": 30}]
    )

    assert [item.fdc_id for item in result] == [3, 1, 2]


# SDD: 022 REQ-002 AC-002.1
def test_parse_items_strips_the_name_of_a_custom_item():
    """El nombre personalizado pierde los espacios de los extremos."""
    result = parse_items([custom(name="  Gallo pinto  ")])

    assert result == [
        CustomItemInput(
            name="Gallo pinto",
            grams=Decimal("250"),
            per_100g={"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2},
        )
    ]


# SDD: 022 REQ-002 AC-002.2
def test_parse_items_accepts_a_mix_of_usda_and_custom_items():
    """Una misma petición puede mezclar los dos tipos de alimento."""
    result = parse_items([{"fdc_id": 171477, "grams": 150}, custom()])

    assert isinstance(result[0], UsdaItemInput)
    assert isinstance(result[1], CustomItemInput)


# SDD: 022 REQ-003 AC-003.7
@pytest.mark.parametrize(
    "item",
    [
        {"fdc_id": 171477, "name": "Pollo", "grams": 100},
        {"grams": 100},
        {},
        "pollo",
        None,
        [1, 2],
    ],
)
def test_parse_items_rejects_an_item_that_is_not_exactly_usda_or_custom(item):
    """`fdc_id` y `name` a la vez, ninguno o un elemento que no es objeto."""
    assert message_of(parse_items, [item]) == ITEM_SOURCE


# SDD: 022 REQ-003 AC-003.4
@pytest.mark.parametrize("grams", [None, 0, 2001, "100"])
def test_parse_items_validates_the_grams_of_each_item(grams):
    """Gramos ausentes, no numéricos o fuera de rango: mensaje de rango."""
    item = {"fdc_id": 171477, "grams": grams}
    if grams is None:
        item.pop("grams")

    assert message_of(parse_items, [item]) == GRAMS_RANGE


# SDD: 022 REQ-003 AC-003.5
def test_parse_items_rejects_grams_with_two_decimals():
    """150,25 g: «Los gramos admiten como mucho un decimal.»."""
    assert message_of(parse_items, [{"fdc_id": 171477, "grams": 150.25}]) == GRAMS_DECIMALS


# SDD: 022 REQ-003 AC-003.8
@pytest.mark.parametrize("name", ["", "   ", None, 5])
def test_parse_items_requires_the_name_of_a_custom_item(name):
    """Nombre vacío, de solo espacios o no texto: «Escribe el nombre del alimento.»."""
    item = custom()
    if name is None:
        # Con `name: None` el alimento tampoco trae `fdc_id`: no es de ninguna clase.
        item["name"] = None
        expected = ITEM_SOURCE
    else:
        item["name"] = name
        expected = NAME_REQUIRED

    assert message_of(parse_items, [item]) == expected


# SDD: 022 REQ-003 AC-003.8
def test_parse_items_accepts_a_name_of_100_characters_after_stripping():
    """100 caracteres tras quitar los espacios de los extremos se aceptan."""
    result = parse_items([custom(name="  " + "a" * 100 + "  ")])

    assert result[0].name == "a" * 100


# SDD: 022 REQ-003 AC-003.8
def test_parse_items_rejects_a_name_of_101_characters_after_stripping():
    """101 caracteres tras quitar los espacios: «El nombre no puede superar…»."""
    assert message_of(parse_items, [custom(name=" " + "a" * 101 + " ")]) == NAME_TOO_LONG


# SDD: 022 REQ-003 AC-003.9
@pytest.mark.parametrize("missing", ["calories_kcal", "protein_g", "carbs_g", "fat_g"])
def test_parse_items_requires_the_four_values_per_100g(missing):
    """Si falta cualquiera de los cuatro valores por 100 g."""
    per_100g = macros()
    del per_100g[missing]

    assert message_of(parse_items, [custom(per_100g=per_100g)]) == PER_100G_REQUIRED


# SDD: 022 REQ-003 AC-003.9
@pytest.mark.parametrize("value", ["10", None, True, [1]])
def test_parse_items_rejects_a_non_numeric_value_per_100g(value):
    """Un valor por 100 g que no es número."""
    per_100g = macros()
    per_100g["protein_g"] = value

    assert message_of(parse_items, [custom(per_100g=per_100g)]) == PER_100G_REQUIRED


# SDD: 022 REQ-003 AC-003.9
@pytest.mark.parametrize("per_100g", [None, "160", [160, 5, 27, 3]])
def test_parse_items_rejects_a_per_100g_that_is_not_an_object(per_100g):
    """`per_100g` ausente o que no es un objeto."""
    item = custom()
    item["per_100g"] = per_100g

    assert message_of(parse_items, [item]) == PER_100G_REQUIRED


# SDD: 022 REQ-003 AC-003.10
@pytest.mark.parametrize("calories", [0, 900])
def test_parse_items_accepts_the_calorie_limits(calories):
    """0 y 900 kcal por 100 g se aceptan."""
    result = parse_items([custom(per_100g=macros(calories=calories, protein=0, carbs=0, fat=0))])

    assert result[0].per_100g["calories_kcal"] == calories


# SDD: 022 REQ-003 AC-003.10
@pytest.mark.parametrize("calories", [-1, 901, 900.1])
def test_parse_items_rejects_calories_out_of_range(calories):
    """Menos de 0 o más de 900 kcal por 100 g."""
    per_100g = macros(calories=calories, protein=0, carbs=0, fat=0)

    assert message_of(parse_items, [custom(per_100g=per_100g)]) == CALORIES_RANGE


# SDD: 022 REQ-003 AC-003.11
@pytest.mark.parametrize("field", ["protein_g", "carbs_g", "fat_g"])
@pytest.mark.parametrize("value", [-1, 101])
def test_parse_items_rejects_a_macro_out_of_range(field, value):
    """Proteína, carbohidratos o grasa menores que 0 o mayores que 100."""
    per_100g = macros(calories=100, protein=0, carbs=0, fat=0)
    per_100g[field] = value

    assert message_of(parse_items, [custom(per_100g=per_100g)]) == MACROS_RANGE


# SDD: 022 REQ-003 AC-003.12
def test_parse_items_accepts_macros_that_add_up_to_exactly_100():
    """33,3 + 33,3 + 33,4 suman 100: se aceptan (sin error binario)."""
    result = parse_items([custom(per_100g=macros(protein=33.3, carbs=33.3, fat=33.4))])

    assert len(result) == 1


# SDD: 022 REQ-003 AC-003.12
def test_parse_items_accepts_a_single_macro_of_100():
    """100 de proteína y 0 de los otros dos suman 100."""
    result = parse_items([custom(per_100g=macros(protein=100, carbs=0, fat=0))])

    assert len(result) == 1


# SDD: 022 REQ-003 AC-003.12
@pytest.mark.parametrize(
    "protein, carbs, fat", [(33.3, 33.3, 33.5), (50, 50, 0.1), (100, 0.1, 0)]
)
def test_parse_items_rejects_macros_that_add_up_to_more_than_100(protein, carbs, fat):
    """Una suma de proteína, carbohidratos y grasa mayor que 100 g."""
    per_100g = macros(protein=protein, carbs=carbs, fat=fat)

    assert message_of(parse_items, [custom(per_100g=per_100g)]) == MACROS_SUM


# SDD: 022 REQ-003 AC-003.14
def test_parse_items_raises_the_first_error_even_after_valid_items():
    """Con dos alimentos válidos y uno no válido, la lista entera se rechaza."""
    items = [
        {"fdc_id": 1, "grams": 10},
        {"fdc_id": 2, "grams": 20},
        {"fdc_id": 3, "grams": 0},
    ]

    assert message_of(parse_items, items) == GRAMS_RANGE


# --------------------------------------------------------------------------
# portion_nutrients
# --------------------------------------------------------------------------


# SDD: 022 REQ-001 AC-001.1
def test_portion_nutrients_rounds_half_up_the_chicken_example():
    """Pollo con 150 g: 247,5 kcal, 46,5 g, 0 g y 5,36 g (5,355 sube)."""
    result = portion_nutrients(CHICKEN_PER_100G, Decimal("150"))

    assert result == {
        "calories_kcal": Decimal("247.50"),
        "protein_g": Decimal("46.50"),
        "carbs_g": Decimal("0.00"),
        "fat_g": Decimal("5.36"),
    }


# SDD: 022 REQ-006 AC-006.1
def test_portion_nutrients_recalculates_the_chicken_for_200_grams():
    """Pollo con 200 g: 330, 62, 0 y 7,14."""
    result = portion_nutrients(CHICKEN_PER_100G, Decimal("200"))

    assert result == {
        "calories_kcal": Decimal("330.00"),
        "protein_g": Decimal("62.00"),
        "carbs_g": Decimal("0.00"),
        "fat_g": Decimal("7.14"),
    }


# SDD: 022 REQ-001 AC-001.4
def test_portion_nutrients_keeps_none_for_a_nutrient_without_data():
    """Un valor por 100 g `None` se queda `None` y los demás se calculan."""
    per_100g = {"calories_kcal": 165, "protein_g": 31.0, "carbs_g": None, "fat_g": 3.57}

    result = portion_nutrients(per_100g, Decimal("200"))

    assert result["carbs_g"] is None
    assert result["calories_kcal"] == Decimal("330.00")


# SDD: 022 REQ-002 AC-002.3
def test_portion_nutrients_keeps_zero_as_zero_not_none():
    """Un valor por 100 g igual a 0 da 0, no `None`."""
    per_100g = {"calories_kcal": 0, "protein_g": 0, "carbs_g": 0.0, "fat_g": 0}

    result = portion_nutrients(per_100g, Decimal("250"))

    assert all(value is not None and value == 0 for value in result.values())


# SDD: 022 REQ-002 AC-002.1
def test_portion_nutrients_computes_the_gallo_pinto_example():
    """Gallo pinto, 250 g: 400, 13,75, 67,5 y 8,0."""
    per_100g = {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2}

    result = portion_nutrients(per_100g, Decimal("250"))

    assert result == {
        "calories_kcal": Decimal("400.00"),
        "protein_g": Decimal("13.75"),
        "carbs_g": Decimal("67.50"),
        "fat_g": Decimal("8.00"),
    }


# SDD: 022 REQ-006 AC-006.2
def test_portion_nutrients_with_100_grams_returns_the_values_per_100g():
    """Con 100 g la porción es igual al valor por 100 g."""
    per_100g = {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2}

    result = portion_nutrients(per_100g, Decimal("100"))

    assert result == {
        "calories_kcal": Decimal("160.00"),
        "protein_g": Decimal("5.50"),
        "carbs_g": Decimal("27.00"),
        "fat_g": Decimal("3.20"),
    }


# SDD: 022 REQ-001 AC-001.1
def test_portion_nutrients_returns_decimals_with_two_places():
    """Los resultados son `Decimal` cuantizados a 2 decimales."""
    result = portion_nutrients(CHICKEN_PER_100G, Decimal("150"))

    assert all(isinstance(value, Decimal) for value in result.values())
    assert result["fat_g"].as_tuple().exponent == -2


# --------------------------------------------------------------------------
# sum_nutrients
# --------------------------------------------------------------------------


# SDD: 022 REQ-005 AC-005.3
def test_sum_nutrients_adds_each_nutrient():
    """247,5 + 400,0 kcal dan 647,5; sin faltas, `incomplete` queda vacío."""
    first = {
        "calories_kcal": Decimal("247.50"),
        "protein_g": Decimal("46.50"),
        "carbs_g": Decimal("0.00"),
        "fat_g": Decimal("5.36"),
    }
    second = {
        "calories_kcal": Decimal("400.00"),
        "protein_g": Decimal("13.75"),
        "carbs_g": Decimal("67.50"),
        "fat_g": Decimal("8.00"),
    }

    totals, incomplete = sum_nutrients([first, second])

    assert totals == {
        "calories_kcal": Decimal("647.50"),
        "protein_g": Decimal("60.25"),
        "carbs_g": Decimal("67.50"),
        "fat_g": Decimal("13.36"),
    }
    assert incomplete == []


# SDD: 022 REQ-005 AC-005.4
def test_sum_nutrients_sums_known_values_and_reports_the_incomplete_ones():
    """Con un `None` en carbohidratos, el total suma el otro (67,5) y avisa."""
    first = {
        "calories_kcal": Decimal("100"),
        "protein_g": Decimal("10"),
        "carbs_g": None,
        "fat_g": Decimal("1"),
    }
    second = {
        "calories_kcal": Decimal("400"),
        "protein_g": Decimal("13.75"),
        "carbs_g": Decimal("67.50"),
        "fat_g": Decimal("8"),
    }

    totals, incomplete = sum_nutrients([first, second])

    assert totals["carbs_g"] == Decimal("67.50")
    assert incomplete == ["carbs_g"]


# SDD: 022 REQ-005 AC-005.4
def test_sum_nutrients_lists_incomplete_keys_in_the_canonical_order():
    """Con varios nutrientes sin dato, salen en el orden calorías, proteína,
    carbohidratos y grasa."""
    item = {
        "calories_kcal": None,
        "protein_g": Decimal("1"),
        "carbs_g": None,
        "fat_g": None,
    }

    _, incomplete = sum_nutrients([item])

    assert incomplete == ["calories_kcal", "carbs_g", "fat_g"]


# SDD: 022 REQ-005 AC-005.2
def test_sum_nutrients_of_an_empty_list_is_all_zeros_and_complete():
    """Sin alimentos, los cuatro totales valen 0 y `incomplete` está vacío."""
    totals, incomplete = sum_nutrients([])

    assert totals == {
        "calories_kcal": Decimal("0"),
        "protein_g": Decimal("0"),
        "carbs_g": Decimal("0"),
        "fat_g": Decimal("0"),
    }
    assert incomplete == []
