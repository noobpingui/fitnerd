"""Tests del CSV del catálogo que vive en el repositorio (spec 023):
`backend/scripts/data/food_catalog.csv`. No usan la base de datos: la
igualdad de los valores `usda` con `public.foods` la comprueba la carga real
(tarea T-124 y el verifier)."""

from pathlib import Path

import pytest

from services.catalog_csv_reader import read_catalog_csv
from services.catalog_rules import FORBIDDEN_NAME_WORDS, term_key, words

CATALOG_CSV = Path(__file__).parents[2] / "scripts" / "data" / "food_catalog.csv"

# Lista mínima de la sección 6 de la spec (39 alimentos, sin yuca).
MINIMUM_LIST = [
    "Arroz blanco cocido",
    "Arroz integral cocido",
    "Frijoles negros cocidos",
    "Frijoles rojos cocidos",
    "Lentejas cocidas",
    "Garbanzos cocidos",
    "Avena cocida",
    "Pasta cocida",
    "Papa cocida",
    "Plátano maduro cocido",
    "Tortilla de maíz",
    "Pan blanco",
    "Pan integral",
    "Pechuga de pollo a la plancha",
    "Carne de res molida cocida",
    "Lomo de cerdo a la plancha",
    "Atún en agua",
    "Salmón al horno",
    "Huevo cocido",
    "Leche entera",
    "Leche descremada",
    "Yogur natural",
    "Queso blanco",
    "Banano",
    "Manzana",
    "Naranja",
    "Papaya",
    "Piña",
    "Mango",
    "Fresas",
    "Aguacate",
    "Tomate",
    "Lechuga",
    "Pepino",
    "Zanahoria",
    "Brócoli cocido",
    "Maní",
    "Almendras",
    "Aceite de oliva",
]


@pytest.fixture(scope="module")
def records():
    """Los registros del CSV real, leídos con el lector y sus reglas."""
    return read_catalog_csv(CATALOG_CSV)


# SDD: 023 REQ-001 AC-001.4
def test_the_minimum_list_has_39_foods(records):
    """La lista mínima tiene 39 alimentos distintos y el CSV real los contiene
    todos, cada uno en una fila distinta."""
    assert len(MINIMUM_LIST) == 39
    assert len({term_key(name) for name in MINIMUM_LIST}) == 39

    rows_by_term = {}
    for index, record in enumerate(records):
        for term in [record.name, *record.synonyms]:
            rows_by_term.setdefault(term_key(term), index)

    rows = {rows_by_term.get(term_key(name)) for name in MINIMUM_LIST}

    assert None not in rows
    assert len(rows) == 39
    assert "yuca-cocida" not in {record.id for record in records}


# SDD: 023 REQ-001 AC-001.1
def test_the_repository_csv_validates_without_errors_and_has_250_to_350_foods(records):
    """El lector no lanza ningún error y hay entre 250 y 350 alimentos."""
    assert 250 <= len(records) <= 350


# SDD: 023 REQ-001 AC-001.2
def test_no_name_or_synonym_is_repeated_ignoring_case_and_accents(records):
    """Todos los nombres y sinónimos son distintos entre sí, sin distinguir
    mayúsculas ni tildes."""
    keys = []
    for record in records:
        keys.append(term_key(record.name))
        keys.extend(term_key(synonym) for synonym in record.synonyms)

    repeated = sorted({key for key in keys if keys.count(key) > 1})

    assert repeated == []


# SDD: 023 REQ-001 AC-001.2
def test_no_identifier_is_repeated(records):
    """Los identificadores son únicos."""
    ids = [record.id for record in records]

    assert len(ids) == len(set(ids))


# SDD: 023 REQ-001 AC-001.3
def test_no_name_contains_a_forbidden_word(records):
    """Ningún nombre contiene como palabra «con», «frito», «frita», «fritos» ni «fritas»."""
    offenders = [
        record.name
        for record in records
        if set(words(record.name)) & set(FORBIDDEN_NAME_WORDS)
    ]

    assert offenders == []


# SDD: 023 REQ-001 AC-001.4
def test_the_catalog_covers_the_minimum_list_by_name_or_synonym(records):
    """Cada uno de los 39 alimentos de la lista mínima aparece, por su nombre o
    por un sinónimo."""
    available = set()
    for record in records:
        available.add(term_key(record.name))
        available.update(term_key(synonym) for synonym in record.synonyms)

    missing = [name for name in MINIMUM_LIST if term_key(name) not in available]

    assert missing == []


# SDD: 023 REQ-001 AC-001.1
def test_every_manual_row_has_a_reference_and_every_usda_row_an_fdc_id(records):
    """Las filas `manual` traen su fuente y las `usda`, su FDC ID."""
    manual_without_reference = [r.id for r in records if r.source == "manual" and not r.reference]
    usda_without_fdc_id = [r.id for r in records if r.source == "usda" and r.fdc_id is None]

    assert manual_without_reference == []
    assert usda_without_fdc_id == []


# SDD: 023 REQ-001 AC-001.4
def test_there_is_no_yuca_row(records):
    """La yuca salió de la lista mínima y no hay fila `yuca-cocida`."""
    assert "yuca-cocida" not in {record.id for record in records}


# SDD: 023 REQ-001 AC-001.1
def test_every_manual_row_declares_its_reference(records):
    """El formato admite filas `manual`, pero toda fila `manual` trae `reference`."""
    manual = [r for r in records if r.source == "manual"]

    assert [r.id for r in manual if not (r.reference or "").strip()] == []


# SDD: 023 REQ-001 AC-001.2
def test_the_iceberg_lettuce_row_is_named_iceberg_and_keeps_repollada_as_synonym(records):
    """«Lechuga repollada» es un regionalismo: el nombre principal de la fila de
    lechuga de USDA 2346388 es «Lechuga iceberg» y «lechuga repollada» es sinónimo."""
    rows = [r for r in records if r.fdc_id == 2346388]

    assert len(rows) == 1
    assert rows[0].name == "Lechuga iceberg"
    assert "lechuga repollada" in {term_key(s) for s in rows[0].synonyms}
    assert "lechuga repollada" not in {term_key(r.name) for r in records}


def _synonym_words(records):
    """Pares (id, palabras sueltas) de cada sinónimo del catálogo."""
    return [(r.id, set(words(synonym))) for r in records for synonym in r.synonyms]


# SDD: 023 REQ-001 AC-001.2
def test_no_synonym_is_a_brand_name(records):
    """Las marcas comerciales están fuera de alcance: ni «pan bimbo» ni «queso filadelfia»."""
    brands = {"bimbo", "filadelfia", "philadelphia"}

    offenders = [row_id for row_id, found in _synonym_words(records) if found & brands]

    assert offenders == []


# SDD: 023 REQ-001 AC-001.2
def test_contramuslo_is_not_a_synonym_of_the_drumstick(records):
    """«contramuslo» es el muslo, no la pierna (drumstick)."""
    leg = [r for r in records if r.id == "pierna-de-pollo-cocida"]

    offenders = [
        synonym for r in leg for synonym in r.synonyms if "contramuslo" in words(synonym)
    ]

    assert offenders == []


# SDD: 023 REQ-001 AC-001.2
def test_limonada_is_not_a_synonym_of_lemon_juice(records):
    """La limonada es jugo diluido (una combinación), no jugo de limón puro."""
    juice = [r for r in records if r.id == "jugo-de-limon"]

    offenders = [
        synonym for r in juice for synonym in r.synonyms if "limonada" in words(synonym)
    ]

    assert offenders == []


# SDD: 023 REQ-001 AC-001.3
@pytest.mark.parametrize(
    "first, second",
    [
        ("zanahoria", "zanahoria-cocida"),
        ("champinones", "champinones-cocidos"),
        ("frijoles-blancos-cocidos", "frijoles-navy-cocidos"),
    ],
)
def test_a_food_does_not_have_two_versions(records, first, second):
    """Una sola versión por alimento (regla 3): no coexisten ambas filas."""
    ids = {record.id for record in records}

    assert not {first, second} <= ids
