"""Utilidad de test (spec 023): escribe CSV del catálogo de alimentos para
probar el lector y la carga sin depender del archivo real del repositorio."""

import csv
from pathlib import Path

CATALOG_COLUMNS = [
    "id",
    "name",
    "synonyms",
    "calories_kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "source",
    "fdc_id",
    "reference",
]


def catalog_row(**overrides):
    """Una fila válida de origen `usda` (la pechuga de pollo, FDC ID 171477,
    con los valores de USDA); `overrides` sustituye cualquier columna."""
    row = {
        "id": "pechuga-de-pollo-a-la-plancha",
        "name": "Pechuga de pollo a la plancha",
        "synonyms": "",
        "calories_kcal": "165.0",
        "protein_g": "31.0",
        "carbs_g": "0.0",
        "fat_g": "3.57",
        "source": "usda",
        "fdc_id": "171477",
        "reference": "",
    }
    row.update(overrides)
    return row


def write_catalog_csv(path, rows, columns=CATALOG_COLUMNS):
    """Escribe `rows` (lista de dicts) en `path` como UTF-8 con cabecera
    `columns`; las columnas que no estén en `columns` se omiten."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(columns), extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path
