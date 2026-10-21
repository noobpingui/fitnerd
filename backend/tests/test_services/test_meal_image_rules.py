"""Tests UNITARIOS de las reglas puras del análisis de la foto de una comida
(spec 024): `build_analysis`, `parse_estimated_grams`, `parse_confidence`,
`clean_unmatched_name` y `build_user_prompt`. No tocan Postgres ni ningún
proveedor: el catálogo es una lista de `make_catalog_food`.
"""

from decimal import Decimal

import pytest

from services.meal_image_rules import (
    build_analysis,
    build_user_prompt,
    clean_unmatched_name,
    parse_confidence,
    parse_estimated_grams,
)
from tests.fakes import make_catalog_food

RICE = make_catalog_food(
    "arroz-blanco-cocido",
    "Arroz blanco cocido",
    calories_kcal=130.0,
    protein_g=2.69,
    carbs_g=28.17,
    fat_g=0.28,
)
CHICKEN = make_catalog_food(
    "pechuga-de-pollo-a-la-plancha",
    "Pechuga de pollo a la plancha",
    calories_kcal=165.0,
    protein_g=31.0,
    carbs_g=0.0,
    fat_g=3.57,
)
CATALOG = {food.id: food for food in (RICE, CHICKEN)}

RICE_PER_100G = {"calories_kcal": 130.0, "protein_g": 2.69, "carbs_g": 28.17, "fat_g": 0.28}
ZERO_TOTALS = {
    "calories_kcal": Decimal("0"),
    "protein_g": Decimal("0"),
    "carbs_g": Decimal("0"),
    "fat_g": Decimal("0"),
}


def raw(catalog_id, grams, confidence="high", name="Nombre del modelo"):
    return {"catalog_id": catalog_id, "name": name, "grams": grams, "confidence": confidence}


# SDD: 024 REQ-001 REQ-006 AC-001.1
def test_rice_150_grams_has_catalog_name_per_100g_and_nutrients():
    """150 g de arroz: nombre y valores del catálogo, y nutrientes del diario."""
    analysis = build_analysis([raw("arroz-blanco-cocido", 150)], CATALOG)

    assert len(analysis.items) == 1
    item = analysis.items[0]
    assert item.catalog_id == "arroz-blanco-cocido"
    assert item.name == "Arroz blanco cocido"
    assert item.grams == 150
    assert item.confidence == "high"
    assert item.per_100g == RICE_PER_100G
    assert item.nutrients == {
        "calories_kcal": Decimal("195.0"),
        "protein_g": Decimal("4.04"),
        "carbs_g": Decimal("42.26"),
        "fat_g": Decimal("0.42"),
    }
    assert analysis.unmatched == []
    assert analysis.totals == item.nutrients


# SDD: 024 REQ-001 AC-001.4
def test_items_keep_the_provider_order_and_totals_are_their_sum():
    """Dos alimentos: `items` en el orden del proveedor y `totals` es la suma."""
    analysis = build_analysis(
        [raw("pechuga-de-pollo-a-la-plancha", 100), raw("arroz-blanco-cocido", 150)], CATALOG
    )

    assert [item.catalog_id for item in analysis.items] == [
        "pechuga-de-pollo-a-la-plancha",
        "arroz-blanco-cocido",
    ]
    assert analysis.totals == {
        "calories_kcal": Decimal("360.0"),
        "protein_g": Decimal("35.04"),
        "carbs_g": Decimal("42.26"),
        "fat_g": Decimal("3.99"),
    }


# SDD: 024 REQ-001 AC-001.5
def test_empty_provider_list_gives_empty_lists_and_zero_totals():
    """El proveedor no reconoce nada: listas vacías y cuatro totales en 0."""
    analysis = build_analysis([], CATALOG)

    assert analysis.items == []
    assert analysis.unmatched == []
    assert analysis.totals == ZERO_TOTALS


# SDD: 024 REQ-001 AC-001.5
def test_entries_that_are_not_objects_are_discarded():
    """Lo que no sea un objeto se descarta sin romper el análisis."""
    analysis = build_analysis(["arroz", 5, None, ["x"]], CATALOG)

    assert analysis.items == []
    assert analysis.unmatched == []
    assert analysis.totals == ZERO_TOTALS


# SDD: 024 REQ-006 AC-006.1
def test_model_name_and_macros_for_a_catalog_food_are_ignored():
    """El modelo propone «Arroz frito» con 300 kcal: se usa lo del catálogo."""
    entry = raw("arroz-blanco-cocido", 100, name="Arroz frito")
    entry["per_100g"] = {"calories_kcal": 300.0}
    entry["calories_kcal"] = 300.0

    analysis = build_analysis([entry], CATALOG)

    assert analysis.items[0].name == "Arroz blanco cocido"
    assert analysis.items[0].per_100g == RICE_PER_100G
    assert analysis.items[0].nutrients["calories_kcal"] == Decimal("130.0")


# SDD: 024 REQ-006 AC-006.2
def test_unknown_catalog_id_with_a_name_goes_to_unmatched():
    """`gallo-pinto` no existe en el catálogo: va a `unmatched` con su nombre."""
    analysis = build_analysis(
        [raw("gallo-pinto", 200, confidence="medium", name="Gallo pinto")], CATALOG
    )

    assert analysis.items == []
    assert len(analysis.unmatched) == 1
    unmatched = analysis.unmatched[0]
    assert unmatched.name == "Gallo pinto"
    assert unmatched.grams == 200
    assert unmatched.confidence == "medium"
    assert analysis.totals == ZERO_TOTALS


# SDD: 024 REQ-006 AC-006.2
def test_null_catalog_id_with_a_name_goes_to_unmatched():
    """Sin `catalog_id` (nulo) y con nombre: alimento sin coincidencia."""
    analysis = build_analysis([raw(None, 30, confidence="low", name="Salsa de tomate")], CATALOG)

    assert [(u.name, u.grams, u.confidence) for u in analysis.unmatched] == [
        ("Salsa de tomate", 30, "low")
    ]


# SDD: 024 REQ-006 AC-006.3
def test_unknown_catalog_id_without_a_name_is_discarded():
    """Identificador inexistente sin nombre: no aparece en ninguna lista."""
    entries = [
        {"catalog_id": "gallo-pinto", "grams": 200, "confidence": "high"},
        raw("gallo-pinto", 200, name=""),
        raw("gallo-pinto", 200, name=None),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert analysis.items == []
    assert analysis.unmatched == []


# SDD: 024 REQ-007 AC-007.1
@pytest.mark.parametrize(
    "value, expected",
    [(152.6, 153), (150, 150), (150.0, 150), (1, 1), (1.4, 1), (2000, 2000), (2500, 2000)],
)
def test_parse_estimated_grams_rounds_and_caps_at_2000(value, expected):
    """Se redondea al entero más cercano y lo que supera 2000 se lleva a 2000."""
    assert parse_estimated_grams(value) == expected


# SDD: 024 REQ-007 AC-007.1
def test_grams_above_the_cap_compute_nutrients_with_2000():
    """2500 g: `grams` es 2000 y los nutrientes se calculan con 2000."""
    analysis = build_analysis([raw("arroz-blanco-cocido", 2500)], CATALOG)

    assert analysis.items[0].grams == 2000
    assert analysis.items[0].nutrients["calories_kcal"] == Decimal("2600.0")


# SDD: 024 REQ-007 AC-007.1
def test_fractional_grams_are_rounded_in_the_analysis():
    """152,6 g: `grams` es 153."""
    analysis = build_analysis([raw("arroz-blanco-cocido", 152.6)], CATALOG)

    assert analysis.items[0].grams == 153


# SDD: 024 REQ-007 AC-007.2
@pytest.mark.parametrize(
    "value", [0.3, 0, -5, "mucho", "150", None, True, False, float("nan"), float("inf"), [], {}]
)
def test_parse_estimated_grams_rejects_invalid_values(value):
    """0,3, negativos, texto, ausentes, booleanos y no finitos se descartan."""
    assert parse_estimated_grams(value) is None


# SDD: 024 REQ-007 AC-007.2
def test_foods_with_invalid_grams_do_not_appear_in_the_analysis():
    """Ninguno de los alimentos con gramos inválidos aparece, ni en `items` ni
    en `unmatched`."""
    entries = [
        raw("arroz-blanco-cocido", 0.3),
        raw("arroz-blanco-cocido", -5),
        raw("arroz-blanco-cocido", "mucho"),
        {"catalog_id": "arroz-blanco-cocido", "name": "Arroz", "confidence": "high"},
        raw(None, "mucho", name="Salsa"),
        raw(None, -1, name="Salsa"),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert analysis.items == []
    assert analysis.unmatched == []


# SDD: 024 REQ-007 AC-007.3
@pytest.mark.parametrize(
    "value, expected",
    [("high", "high"), ("medium", "medium"), ("low", "low"), ("alta", "low"), (None, "low"), (5, "low")],
)
def test_parse_confidence_defaults_to_low(value, expected):
    """`high`, `medium` y `low` se respetan; cualquier otro valor o ninguno da `low`."""
    assert parse_confidence(value) == expected


# SDD: 024 REQ-007 AC-007.3
def test_confidences_in_the_analysis_follow_the_rules():
    """`high`, `medium`, `low`, `alta` y ausente dan `high`, `medium`, `low`,
    `low` y `low`."""
    entries = [
        raw(None, 10, confidence="high", name="A"),
        raw(None, 10, confidence="medium", name="B"),
        raw(None, 10, confidence="low", name="C"),
        raw(None, 10, confidence="alta", name="D"),
        {"catalog_id": None, "name": "E", "grams": 10},
    ]

    analysis = build_analysis(entries, CATALOG)

    assert [u.confidence for u in analysis.unmatched] == ["high", "medium", "low", "low", "low"]


# SDD: 024 REQ-007 AC-007.4
def test_clean_unmatched_name_trims_spaces():
    """«  Salsa de tomate  » queda como «Salsa de tomate»."""
    assert clean_unmatched_name("  Salsa de tomate  ") == "Salsa de tomate"


# SDD: 024 REQ-007 AC-007.4
def test_clean_unmatched_name_keeps_the_first_100_characters():
    """Un nombre de 150 caracteres queda en los 100 primeros."""
    name = "abcdefghij" * 15

    assert clean_unmatched_name(name) == name[:100]


# SDD: 024 REQ-007 AC-007.4
@pytest.mark.parametrize("value", ["", "   ", None, 5, ["Salsa"]])
def test_clean_unmatched_name_discards_empty_or_non_text(value):
    """Vacío, solo espacios o algo que no es texto se descarta."""
    assert clean_unmatched_name(value) is None


# SDD: 024 REQ-007 AC-007.4
def test_unmatched_names_in_the_analysis_are_cleaned_and_blank_ones_discarded():
    """El nombre se recorta y se limita a 100; el de solo espacios se descarta."""
    entries = [
        raw(None, 30, name="  Salsa de tomate  "),
        raw(None, 30, name="abcdefghij" * 15),
        raw(None, 30, name="    "),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert [u.name for u in analysis.unmatched] == ["Salsa de tomate", ("abcdefghij" * 15)[:100]]


# SDD: 024 REQ-008 AC-008.1
def test_duplicate_catalog_food_is_merged_in_the_first_position():
    """Arroz 100 g `high` y, más tarde, 80 g `medium`: un solo arroz con 180 g,
    confianza `medium` y en la posición del primero."""
    entries = [
        raw("arroz-blanco-cocido", 100, confidence="high"),
        raw("pechuga-de-pollo-a-la-plancha", 120, confidence="high"),
        raw("arroz-blanco-cocido", 80, confidence="medium"),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert [item.catalog_id for item in analysis.items] == [
        "arroz-blanco-cocido",
        "pechuga-de-pollo-a-la-plancha",
    ]
    assert analysis.items[0].grams == 180
    assert analysis.items[0].confidence == "medium"
    assert analysis.items[0].nutrients["calories_kcal"] == Decimal("234.0")


# SDD: 024 REQ-008 AC-008.1
def test_merged_duplicate_grams_are_capped_at_2000():
    """La suma de gramos de un duplicado llega como mucho a 2000."""
    entries = [raw("arroz-blanco-cocido", 1500), raw("arroz-blanco-cocido", 1500)]

    analysis = build_analysis(entries, CATALOG)

    assert len(analysis.items) == 1
    assert analysis.items[0].grams == 2000


# SDD: 024 REQ-008 AC-008.1
def test_duplicate_keeps_the_lowest_confidence_whatever_the_order():
    """Si el primero es `low` y el segundo `high`, la confianza sigue siendo `low`."""
    entries = [
        raw("arroz-blanco-cocido", 50, confidence="low"),
        raw("arroz-blanco-cocido", 50, confidence="high"),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert analysis.items[0].confidence == "low"


# SDD: 024 REQ-008 AC-008.1
def test_invalid_duplicate_is_discarded_before_merging():
    """Un duplicado con gramos inválidos no suma ni cambia la confianza."""
    entries = [
        raw("arroz-blanco-cocido", 100, confidence="high"),
        raw("arroz-blanco-cocido", "mucho", confidence="low"),
    ]

    analysis = build_analysis(entries, CATALOG)

    assert analysis.items[0].grams == 100
    assert analysis.items[0].confidence == "high"


# SDD: 024 REQ-008 AC-008.2
def test_at_most_20_foods_are_kept_in_the_provider_order():
    """25 alimentos válidos (15 del catálogo y 10 sin coincidencia, intercalados):
    `items` y `unmatched` suman 20, los 20 primeros del proveedor."""
    catalog_foods = [make_catalog_food(f"alimento-{n:02d}", f"Alimento {n:02d}") for n in range(15)]
    catalog = {food.id: food for food in catalog_foods}
    entries = []
    catalog_index = 0
    unmatched_index = 0
    for position in range(25):
        if position % 5 < 3:
            entries.append(raw(f"alimento-{catalog_index:02d}", 100))
            catalog_index += 1
        else:
            entries.append(raw(None, 50, name=f"Sin coincidencia {unmatched_index:02d}"))
            unmatched_index += 1
    assert catalog_index == 15 and unmatched_index == 10

    analysis = build_analysis(entries, catalog)

    assert len(analysis.items) + len(analysis.unmatched) == 20
    assert [item.catalog_id for item in analysis.items] == [
        f"alimento-{n:02d}" for n in range(12)
    ]
    assert [u.name for u in analysis.unmatched] == [f"Sin coincidencia {n:02d}" for n in range(8)]


# SDD: 024 REQ-008 AC-008.2
def test_the_limit_of_20_counts_after_discarding_and_merging():
    """Los descartados y los duplicados no ocupan puesto en el máximo de 20."""
    entries = []
    for n in range(30):
        entries.append(raw(None, "mucho", name=f"Descartado {n}"))
        entries.append(raw("arroz-blanco-cocido", 10))
    for n in range(20):
        entries.append(raw(None, 10, name=f"Valido {n:02d}"))

    analysis = build_analysis(entries, CATALOG)

    assert [item.catalog_id for item in analysis.items] == ["arroz-blanco-cocido"]
    assert analysis.items[0].grams == 300
    assert len(analysis.unmatched) == 19
    assert analysis.unmatched[0].name == "Valido 00"


# SDD: 024 REQ-001 AC-001.3
def test_user_prompt_contains_every_catalog_id_and_name():
    """El texto para el proveedor incluye el identificador y el nombre de todos
    los alimentos del catálogo."""
    foods = [
        RICE,
        CHICKEN,
        make_catalog_food("frijoles-negros-cocidos", "Frijoles negros cocidos"),
    ]

    prompt = build_user_prompt(foods)

    for food in foods:
        assert food.id in prompt
        assert food.name in prompt
