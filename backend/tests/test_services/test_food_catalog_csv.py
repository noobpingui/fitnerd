"""Tests del CSV del catálogo que vive en el repositorio (spec 023):
`backend/scripts/data/food_catalog.csv`. No usan la base de datos: la
igualdad de los valores `usda` con `public.foods` la comprueba la carga real
(tarea T-124 y el verifier)."""

from pathlib import Path

import pytest

from services.catalog_csv_reader import read_catalog_csv
from services.catalog_rules import FORBIDDEN_NAME_WORDS, term_key, words

CATALOG_CSV = Path(__file__).parents[2] / "scripts" / "data" / "food_catalog.csv"

# Lista mínima de la sección 6 de la spec (40 alimentos).
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
    "Yuca cocida",
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
def test_the_minimum_list_has_40_foods():
    """La constante del test es la lista de 40 alimentos de la spec."""
    assert len(MINIMUM_LIST) == 40
    assert len({term_key(name) for name in MINIMUM_LIST}) == 40


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
    """Cada uno de los 40 alimentos de la lista mínima aparece, por su nombre o
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
