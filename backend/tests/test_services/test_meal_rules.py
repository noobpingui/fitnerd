"""Tests UNITARIOS de las reglas puras del diario de comidas (spec 022): sin
base de datos ni red. Los mensajes se comparan con el texto literal de la
sección 6 de la spec, no con las constantes del módulo.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest

from exceptions.custom_exceptions import ValidationError
from services.meal_rules import (
    CatalogItemInput,
    CustomItemInput,
    LibraryItemInput,
    RemovedItemSnapshot,
    UsdaItemInput,
    check_add_window,
    epoch_seconds,
    is_db_id,
    parse_items,
    parse_meal_date,
    parse_meal_type,
    parse_snapshot_payload,
    portion_nutrients,
    snapshot_payload,
    sum_nutrients,
    validate_grams,
)

DATE_INVALID = "La fecha no es válida."
OUT_OF_WINDOW = "Solo puedes registrar comidas de hoy o del último año."
MEAL_TYPE_INVALID = "El tipo de comida no es válido."
ITEMS_REQUIRED = "Añade al menos un alimento."
TOO_MANY = "Una comida no puede tener más de 50 alimentos."
ITEM_SOURCE = "Cada alimento debe ser del catálogo, de USDA o personalizado."
FOOD_NOT_FOUND = "No encontramos ese alimento."
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


# SDD: 026 REQ-001 AC-001.1
@pytest.mark.parametrize("value", [date(2025, 10, 20), date(2026, 1, 15)])
def test_check_add_window_accepts_past_dates_up_to_366_days_back(value):
    """Con hoy el 2026-10-21, se aceptan desde el 2025-10-20."""
    check_add_window(value, date(2026, 10, 21))


# Guarda de regresión de la 022: pasa sin implementar la 026.
# SDD: 022 REQ-004 AC-004.1
# Ayer, hoy y mañana siguen aceptándose.
@pytest.mark.parametrize("value", [date(2026, 10, 20), date(2026, 10, 21), date(2026, 10, 22)])
def test_check_add_window_still_accepts_yesterday_today_and_tomorrow(value):
    check_add_window(value, date(2026, 10, 21))


# SDD: 026 REQ-001 AC-001.2
@pytest.mark.parametrize("value", [date(2025, 10, 19), date(2026, 10, 23)])
def test_check_add_window_rejects_dates_outside_the_window(value):
    """Con hoy el 2026-10-21, el 2025-10-19 y el 2026-10-23 quedan fuera de la ventana."""
    assert message_of(check_add_window, value, date(2026, 10, 21)) == OUT_OF_WINDOW


# --------------------------------------------------------------------------
# Instantánea de un alimento quitado (ADR-0035)
# --------------------------------------------------------------------------


def snapshot(**overrides):
    values = {
        "meal_date": date(2026, 10, 20),
        "meal_type": "breakfast",
        "position": 1,
        "source": "catalog",
        "catalog_id": "platano",
        "fdc_id": None,
        "name": "Plátano",
        "data_type": None,
        "grams": Decimal("120.0"),
        "per_100g": {"calories_kcal": 89.0, "protein_g": 1.1, "carbs_g": 22.8, "fat_g": 0.3},
        "expires_at": 1792979000,
    }
    values.update(overrides)
    return RemovedItemSnapshot(**values)


# SDD: 026 REQ-007 AC-007.4
@pytest.mark.parametrize(
    "item",
    [
        snapshot(),
        snapshot(
            source="usda",
            catalog_id=None,
            fdc_id=171477,
            name="Chicken",
            data_type="sr_legacy_food",
            per_100g={"calories_kcal": 165.0, "protein_g": 31.0, "carbs_g": None, "fat_g": None},
        ),
        snapshot(source="custom", catalog_id=None, name="Gallo pinto", grams=Decimal("250.5")),
    ],
)
def test_snapshot_payload_round_trips_through_parse(item):
    """Catálogo, USDA con valores `None` y personalizado vuelven iguales."""
    assert parse_snapshot_payload(snapshot_payload(item)) == item


# SDD: 026 REQ-007 AC-007.4
def test_snapshot_payload_uses_the_documented_keys():
    """El payload lleva las claves del contrato del plan."""
    payload = snapshot_payload(snapshot())

    assert set(payload) == {"v", "d", "t", "p", "s", "c", "f", "n", "dt", "g", "per", "exp"}
    assert payload["v"] == 1
    assert payload["d"] == "2026-10-20"


# SDD: 026 REQ-007 AC-007.4
def test_epoch_seconds_converts_a_naive_utc_instant():
    """Un instante naive en UTC se convierte en segundos desde 1970."""
    assert epoch_seconds(datetime(1970, 1, 1, 0, 1, 0)) == 60
    assert epoch_seconds(datetime(2026, 10, 21, 3, 0, 0)) == 1792551600


_VALID_PAYLOAD = {
    "v": 1,
    "d": "2026-10-20",
    "t": "breakfast",
    "p": 1,
    "s": "catalog",
    "c": "platano",
    "f": None,
    "n": "Plátano",
    "dt": None,
    "g": "120.0",
    "per": {"calories_kcal": 89.0, "protein_g": 1.1, "carbs_g": 22.8, "fat_g": 0.3},
    "exp": 1792979000,
}


def _payload_with(**changes):
    """Copia del payload válido del plan con los cambios dados (sin llamar al código)."""
    payload = dict(_VALID_PAYLOAD)
    for key, value in changes.items():
        if value is _REMOVE:
            payload.pop(key, None)
        else:
            payload[key] = value
    return payload


_REMOVE = object()

MAX_INT = 2_147_483_647


def _usda_payload(**changes):
    """Payload válido de un alimento de USDA con los cambios dados."""
    values = {"s": "usda", "c": None, "f": 171477, "dt": "sr_legacy_food", **changes}
    return _payload_with(**values)


# SDD: 027 REQ-004 AC-004.1
def test_parse_snapshot_payload_rejects_version_1_0():
    """`1.0` vale 1 en Python, pero no es el entero 1 que emite el servidor."""
    assert parse_snapshot_payload(_payload_with(v=1.0)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-004 AC-004.2
def test_parse_snapshot_payload_rejects_version_true():
    assert parse_snapshot_payload(_payload_with(v=True)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-004 AC-004.2
@pytest.mark.parametrize("version", ["1", 2, 0, None, _REMOVE])
def test_parse_snapshot_payload_still_rejects_other_versions(version):
    assert parse_snapshot_payload(_payload_with(v=version)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-004 AC-004.3
def test_parse_snapshot_payload_accepts_version_one_with_the_full_snapshot():
    assert parse_snapshot_payload(_payload_with(v=1)) == snapshot()


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-005 AC-005.1
# SDD: 027 REQ-005 AC-005.4
@pytest.mark.parametrize("position", [0, MAX_INT])
def test_parse_snapshot_payload_accepts_the_position_limits(position):
    result = parse_snapshot_payload(_payload_with(p=position))

    assert result == snapshot(position=position)


# SDD: 027 REQ-005 AC-005.2
@pytest.mark.parametrize("position", [MAX_INT + 1, 10**20])
def test_parse_snapshot_payload_rejects_a_position_beyond_the_database_range(position):
    assert parse_snapshot_payload(_payload_with(p=position)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-005 AC-005.3
def test_parse_snapshot_payload_rejects_a_position_of_1_0():
    assert parse_snapshot_payload(_payload_with(p=1.0)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-005 AC-005.3
def test_parse_snapshot_payload_rejects_a_position_of_true():
    assert parse_snapshot_payload(_payload_with(p=True)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-005 AC-005.3
@pytest.mark.parametrize("position", [-1, "3", None, _REMOVE])
def test_parse_snapshot_payload_still_rejects_other_invalid_positions(position):
    assert parse_snapshot_payload(_payload_with(p=position)) is None


# SDD: 027 REQ-006 AC-006.1
# SDD: 027 REQ-006 AC-006.2
@pytest.mark.parametrize("fdc_id", [MAX_INT + 1, 0, -5])
def test_parse_snapshot_payload_rejects_a_usda_id_out_of_range(fdc_id):
    assert parse_snapshot_payload(_usda_payload(f=fdc_id)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-006 AC-006.2
def test_parse_snapshot_payload_rejects_a_usda_id_of_1_0():
    assert parse_snapshot_payload(_usda_payload(f=1.0)) is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-006 AC-006.3
@pytest.mark.parametrize("fdc_id", [1, MAX_INT])
def test_parse_snapshot_payload_accepts_the_usda_id_limits(fdc_id):
    result = parse_snapshot_payload(_usda_payload(f=fdc_id))

    assert result is not None
    assert result.source == "usda"
    assert result.fdc_id == fdc_id


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-006 AC-006.4
@pytest.mark.parametrize(
    "payload",
    [
        dict(_VALID_PAYLOAD),
        _payload_with(s="custom", c=None, f=None),
    ],
)
def test_parse_snapshot_payload_accepts_catalog_and_custom_without_a_usda_id(payload):
    result = parse_snapshot_payload(payload)

    assert result is not None
    assert result.fdc_id is None


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 NFR-001 AC-N001.1
@pytest.mark.parametrize("position", [0, 1, MAX_INT])
@pytest.mark.parametrize(
    "overrides",
    [
        {},
        {
            "source": "usda",
            "catalog_id": None,
            "fdc_id": 171477,
            "name": "Chicken",
            "data_type": "sr_legacy_food",
        },
        {"source": "custom", "catalog_id": None, "name": "Gallo pinto"},
    ],
)
def test_snapshot_payload_round_trips_by_source_and_position(overrides, position):
    """Los snapshots que emite el servidor cumplen las reglas nuevas, en cualquier posición."""
    item = snapshot(position=position, **overrides)

    assert parse_snapshot_payload(snapshot_payload(item)) == item


# SDD: 026 REQ-007 AC-007.4
def test_parse_snapshot_payload_accepts_the_documented_payload():
    """El payload de ejemplo del plan se convierte en el snapshot esperado."""
    assert parse_snapshot_payload(dict(_VALID_PAYLOAD)) == snapshot()


# SDD: 026 REQ-007 AC-007.4
@pytest.mark.parametrize(
    "payload",
    [
        None,
        "texto",
        [],
        42,
        _payload_with(v=2),
        _payload_with(v=_REMOVE),
        _payload_with(d="2026-02-30"),
        _payload_with(d="20-10-2026"),
        _payload_with(d=_REMOVE),
        _payload_with(t="brunch"),
        _payload_with(p=-1),
        _payload_with(p="1"),
        _payload_with(s="otro"),
        _payload_with(n=""),
        _payload_with(n=None),
        _payload_with(g="0"),
        _payload_with(g="2001"),
        _payload_with(g="no-es-numero"),
        _payload_with(per={"calories_kcal": 1.0}),
        _payload_with(per="x"),
        _payload_with(per={"calories_kcal": "a", "protein_g": 1, "carbs_g": 1, "fat_g": 1}),
        _payload_with(exp="mañana"),
        _payload_with(exp=_REMOVE),
    ],
)
def test_parse_snapshot_payload_returns_none_for_malformed_payloads(payload):
    """Cualquier campo ausente, de otro tipo o fuera de rango da `None`."""
    assert parse_snapshot_payload(payload) is None


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
# SDD: 023 REQ-006 AC-006.4
@pytest.mark.parametrize(
    "item",
    [
        {"fdc_id": 171477, "name": "Pollo", "grams": 100},
        {"catalog_id": "arroz-blanco-cocido", "fdc_id": 171477, "grams": 100},
        {"catalog_id": "arroz-blanco-cocido", "name": "Pollo", "grams": 100},
        {"catalog_id": "arroz-blanco-cocido", "fdc_id": 171477, "name": "Pollo", "grams": 100},
        {"grams": 100},
        {},
        "pollo",
        None,
        [1, 2],
    ],
)
def test_parse_items_rejects_an_item_that_is_not_exactly_catalog_usda_or_custom(item):
    """Más de uno de `catalog_id`, `fdc_id` y `name`, ninguno o un elemento
    que no es objeto: mensaje nuevo que sustituye al de la 022."""
    assert message_of(parse_items, [item]) == ITEM_SOURCE


# SDD: 023 REQ-006 AC-006.1
def test_parse_items_parses_a_catalog_item():
    """Un alimento del catálogo se convierte en `CatalogItemInput` con gramos Decimal."""
    result = parse_items([{"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150}])

    assert result == [
        CatalogItemInput(catalog_id="pechuga-de-pollo-a-la-plancha", grams=Decimal("150"))
    ]


# SDD: 023 REQ-006 AC-006.2
def test_parse_items_accepts_a_mix_of_catalog_usda_and_custom_items_in_order():
    """Una misma petición mezcla los tres tipos y conserva el orden."""
    result = parse_items(
        [{"catalog_id": "banano", "grams": 100}, {"fdc_id": 171477, "grams": 150}, custom()]
    )

    assert isinstance(result[0], CatalogItemInput)
    assert isinstance(result[1], UsdaItemInput)
    assert isinstance(result[2], CustomItemInput)


# SDD: 023 REQ-006 AC-006.4
def test_parse_items_ignores_keys_with_null_value_when_counting_sources():
    """Una clave con valor `null` no cuenta como presente."""
    result = parse_items([{"catalog_id": "banano", "fdc_id": None, "name": None, "grams": 100}])

    assert result == [CatalogItemInput(catalog_id="banano", grams=Decimal("100"))]


# SDD: 023 REQ-006 AC-006.5
@pytest.mark.parametrize("grams", [None, 0, 2001, "100"])
def test_parse_items_validates_the_grams_of_a_catalog_item(grams):
    """Gramos ausentes, no numéricos o fuera de rango en un alimento del catálogo."""
    item = {"catalog_id": "banano", "grams": grams}
    if grams is None:
        item.pop("grams")

    assert message_of(parse_items, [item]) == GRAMS_RANGE


# SDD: 023 REQ-006 AC-006.5
def test_parse_items_rejects_two_decimals_in_a_catalog_item():
    """150,25 g en un alimento del catálogo: «Los gramos admiten como mucho un decimal.»."""
    assert message_of(parse_items, [{"catalog_id": "banano", "grams": 150.25}]) == GRAMS_DECIMALS


# SDD: 023 REQ-006 AC-006.3
@pytest.mark.parametrize(
    "catalog_id",
    ["Banano", "plátano", "piña", "-banano", "banano-", "a--b", "a", "a" * 61, 5, True, [1]],
)
def test_parse_items_rejects_a_catalog_id_with_an_invalid_format(catalog_id):
    """Un identificador con formato no válido es un alimento que no existe."""
    assert message_of(parse_items, [{"catalog_id": catalog_id, "grams": 100}]) == FOOD_NOT_FOUND


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


# --------------------------------------------------------------------------
# Spec 028: alimento propio por identificador y `cf` del token
# --------------------------------------------------------------------------


# SDD: 028 REQ-003 AC-003.1
def test_parse_items_parses_an_own_food_by_custom_food_id():
    """`{"custom_food_id": 3, "grams": 250}` se convierte en `LibraryItemInput`."""
    result = parse_items([{"custom_food_id": 3, "grams": 250}])

    assert result == [LibraryItemInput(custom_food_id=3, grams=Decimal("250"))]


# SDD: 028 REQ-003 AC-003.1
def test_parse_items_accepts_the_four_origins_in_the_order_of_the_request():
    """Catálogo, USDA, personalizado y alimento propio en una petición."""
    result = parse_items(
        [
            {"catalog_id": "banano", "grams": 100},
            {"fdc_id": 171477, "grams": 150},
            custom(),
            {"custom_food_id": 9, "grams": 80.5},
        ]
    )

    assert [type(entry) for entry in result] == [
        CatalogItemInput,
        UsdaItemInput,
        CustomItemInput,
        LibraryItemInput,
    ]
    assert result[3].grams == Decimal("80.5")


# SDD: 028 REQ-003 AC-003.1
@pytest.mark.parametrize("food_id", [1, 2_147_483_647])
def test_parse_items_accepts_the_limits_of_the_custom_food_id(food_id):
    """1 y 2.147.483.647 son identificadores válidos."""
    result = parse_items([{"custom_food_id": food_id, "grams": 100}])

    assert result[0].custom_food_id == food_id


# SDD: 028 REQ-003 AC-003.2
@pytest.mark.parametrize("food_id", [0, -1, 2_147_483_648, "3", "abc", 1.5, 1.0, True, [], {}])
def test_parse_items_rejects_a_custom_food_id_that_is_not_an_integer_in_range(food_id):
    """Cero, negativo, fuera del rango de la base, texto, decimal o bool: «No encontramos ese alimento.»."""
    assert message_of(parse_items, [{"custom_food_id": food_id, "grams": 100}]) == FOOD_NOT_FOUND


# SDD: 028 REQ-003 AC-003.3
@pytest.mark.parametrize(
    "item",
    [
        {"custom_food_id": 3, "name": "Gallo pinto", "grams": 100},
        {"custom_food_id": 3, "catalog_id": "banano", "grams": 100},
        {"custom_food_id": 3, "fdc_id": 171477, "grams": 100},
    ],
)
def test_parse_items_rejects_a_custom_food_id_together_with_another_source(item):
    """`custom_food_id` junto con `name`, `catalog_id` o `fdc_id`: el 400 de origen."""
    assert message_of(parse_items, [item]) == ITEM_SOURCE


# SDD: 028 REQ-003 AC-003.3
def test_parse_items_ignores_a_null_custom_food_id_when_counting_sources():
    """`custom_food_id: null` no cuenta como presente."""
    result = parse_items([{"catalog_id": "banano", "custom_food_id": None, "grams": 100}])

    assert result == [CatalogItemInput(catalog_id="banano", grams=Decimal("100"))]
    # Contraste: con un valor presente (no nulo) si cuenta como otra fuente (028).
    present = {"catalog_id": "banano", "custom_food_id": 3, "grams": 100}
    assert message_of(parse_items, [present]) == ITEM_SOURCE


# SDD: 028 REQ-003 AC-003.5
@pytest.mark.parametrize("grams", [None, 0, 2001, "100"])
def test_parse_items_validates_the_grams_of_an_own_food(grams):
    """Gramos ausentes, no numéricos o fuera de rango: el mismo mensaje de la 022."""
    assert message_of(parse_items, [{"custom_food_id": 3, "grams": grams}]) == GRAMS_RANGE


# SDD: 028 REQ-003 AC-003.5
def test_parse_items_rejects_two_decimals_in_an_own_food():
    """Dos decimales en los gramos: «Los gramos admiten como mucho un decimal.»."""
    assert (
        message_of(parse_items, [{"custom_food_id": 3, "grams": 10.55}]) == GRAMS_DECIMALS
    )


# SDD: 028 REQ-012 AC-012.1
def test_snapshot_payload_adds_cf_only_when_there_is_a_custom_food_id():
    """`cf` solo aparece si el alimento está vinculado; sin él, las claves son las de la 026."""
    linked = snapshot_payload(
        snapshot(source="custom", catalog_id=None, name="Gallo pinto", custom_food_id=7)
    )
    unlinked = snapshot_payload(snapshot(source="custom", catalog_id=None, name="Gallo pinto"))

    assert linked["cf"] == 7
    assert "cf" not in unlinked
    assert set(unlinked) == {"v", "d", "t", "p", "s", "c", "f", "n", "dt", "g", "per", "exp"}


# SDD: 028 REQ-012 AC-012.1
def test_snapshot_with_a_custom_food_id_round_trips_through_parse():
    """El `custom_food_id` ida y vuelta por el payload."""
    item = snapshot(source="custom", catalog_id=None, name="Gallo pinto", custom_food_id=7)

    parsed = parse_snapshot_payload(snapshot_payload(item))

    assert parsed == item
    assert parsed.custom_food_id == 7


# SDD: 028 REQ-012 AC-012.1
def test_parse_snapshot_payload_without_cf_has_no_custom_food_id():
    """Un token anterior a la 028 (sin `cf`) sigue siendo válido y sin vínculo."""
    parsed = parse_snapshot_payload(_payload_with(s="custom", c=None, f=None))

    assert parsed is not None
    assert parsed.custom_food_id is None
    # Contraste: con `cf` el mismo payload si lleva el vinculo (028).
    linked = parse_snapshot_payload(_payload_with(s="custom", c=None, f=None, cf=7))
    assert linked is not None and linked.custom_food_id == 7


# SDD: 028 REQ-012 AC-012.1
@pytest.mark.parametrize("food_id", [1, 7, MAX_INT])
def test_parse_snapshot_payload_accepts_a_cf_of_a_custom_item_in_range(food_id):
    """`cf` entre 1 y 2.147.483.647 en un alimento `custom`."""
    parsed = parse_snapshot_payload(_payload_with(s="custom", c=None, f=None, cf=food_id))

    assert parsed is not None
    assert parsed.custom_food_id == food_id


# SDD: 028 REQ-012 AC-012.2
@pytest.mark.parametrize("food_id", [0, -1, MAX_INT + 1, "7", 7.0, 1.5, True, [], {}])
def test_parse_snapshot_payload_rejects_a_cf_that_is_not_a_valid_id(food_id):
    """`cf` de otro tipo o fuera de rango: el token no es válido (`None`)."""
    assert parse_snapshot_payload(_payload_with(s="custom", c=None, f=None, cf=food_id)) is None


# SDD: 028 REQ-012 AC-012.2
@pytest.mark.parametrize(
    "payload",
    [
        _payload_with(cf=7),
        _usda_payload(cf=7),
        _payload_with(s="catalog", c="banano", cf=7),
    ],
)
def test_parse_snapshot_payload_rejects_a_cf_in_a_source_other_than_custom(payload):
    """`cf` solo vale en alimentos `custom`: con `catalog` o `usda` el token no es válido."""
    assert parse_snapshot_payload(payload) is None
