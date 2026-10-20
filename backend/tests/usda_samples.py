"""Utilidad de test (spec 021): escribe archivos CSV con la forma real de los
de USDA FoodData Central para probar la lectura y la importación sin red."""

import csv
from pathlib import Path

FOOD_HEADERS = ["fdc_id", "data_type", "description", "food_category_id", "publication_date"]
NUTRIENT_HEADERS = ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id"]

FOUNDATION_TYPE = "foundation_food"
SR_LEGACY_TYPE = "sr_legacy_food"

ENERGY_KCAL = 1008
ENERGY_ATWATER_GENERAL = 2047
ENERGY_ATWATER_SPECIFIC = 2048
PROTEIN = 1003
FAT = 1004
CARBS = 1005
SODIUM = 1093


def macro_nutrients(fdc_id, kcal=None, protein=None, carbs=None, fat=None):
    """Filas de `food_nutrient.csv` (fdc_id, nutrient_id, amount) para los
    valores indicados; los que valen None no se escriben."""
    pairs = [(ENERGY_KCAL, kcal), (PROTEIN, protein), (CARBS, carbs), (FAT, fat)]
    return [(fdc_id, nutrient_id, amount) for nutrient_id, amount in pairs if amount is not None]


def write_usda_dataset(directory, foods, nutrients, food_columns=None, nutrient_columns=None):
    """Escribe `food.csv` y `food_nutrient.csv` en `directory`.

    `foods`: lista de (fdc_id, data_type_de_usda, description).
    `nutrients`: lista de (fdc_id, nutrient_id, amount); `amount` None = vacío.
    `food_columns` / `nutrient_columns`: columnas a escribir (por defecto todas
    las cabeceras reales); sirven para omitir una columna obligatoria.
    """
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    food_columns = list(food_columns or FOOD_HEADERS)
    nutrient_columns = list(nutrient_columns or NUTRIENT_HEADERS)

    with open(directory / "food.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=food_columns, quoting=csv.QUOTE_ALL, extrasaction="ignore"
        )
        writer.writeheader()
        for fdc_id, data_type, description in foods:
            writer.writerow(
                {
                    "fdc_id": fdc_id,
                    "data_type": data_type,
                    "description": description,
                    "food_category_id": "1",
                    "publication_date": "2024-04-18",
                }
            )

    with open(directory / "food_nutrient.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=nutrient_columns, quoting=csv.QUOTE_ALL, extrasaction="ignore"
        )
        writer.writeheader()
        for index, (fdc_id, nutrient_id, amount) in enumerate(nutrients, start=1):
            writer.writerow(
                {
                    "id": index,
                    "fdc_id": fdc_id,
                    "nutrient_id": nutrient_id,
                    "amount": "" if amount is None else amount,
                    "data_points": "1",
                    "derivation_id": "",
                }
            )
    return directory
