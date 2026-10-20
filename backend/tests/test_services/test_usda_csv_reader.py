"""Lectura de los CSV de USDA (spec 021): función pura, sin base de datos ni
red. Los archivos de muestra se escriben en `tmp_path`.
"""

import pytest

from services.usda_csv_reader import UsdaFileError, read_usda_dataset
from tests.usda_samples import (
    CARBS,
    ENERGY_ATWATER_GENERAL,
    ENERGY_ATWATER_SPECIFIC,
    ENERGY_KCAL,
    FOUNDATION_TYPE,
    PROTEIN,
    SODIUM,
    SR_LEGACY_TYPE,
    macro_nutrients,
    write_usda_dataset,
)


def by_id(records):
    return {record.fdc_id: record for record in records}


# SDD: 021 REQ-001 AC-001.1
def test_reads_foundation_foods_with_type_description_and_four_values(tmp_path):
    """Tres alimentos de Foundation salen con tipo, descripción y los cuatro
    valores por 100 g iguales a los del archivo."""
    foods = [
        (1001, FOUNDATION_TYPE, "Chicken, breast, raw"),
        (1002, FOUNDATION_TYPE, "Rice, white, raw"),
        (1003, FOUNDATION_TYPE, "Egg, whole, raw"),
    ]
    nutrients = (
        macro_nutrients(1001, kcal=120.0, protein=22.5, carbs=0.0, fat=2.6)
        + macro_nutrients(1002, kcal=365.0, protein=7.1, carbs=80.0, fat=0.7)
        + macro_nutrients(1003, kcal=143.0, protein=12.6, carbs=0.7, fat=9.5)
    )
    write_usda_dataset(tmp_path, foods, nutrients)

    records = by_id(read_usda_dataset(tmp_path, "foundation"))

    assert set(records) == {1001, 1002, 1003}
    chicken = records[1001]
    assert chicken.description == "Chicken, breast, raw"
    assert chicken.data_type == "foundation"
    assert (chicken.calories_kcal, chicken.protein_g, chicken.carbs_g, chicken.fat_g) == (
        120.0,
        22.5,
        0.0,
        2.6,
    )
    assert records[1002].carbs_g == 80.0
    assert records[1003].fat_g == 9.5


# SDD: 021 REQ-001 AC-001.2
def test_reads_sr_legacy_foods_with_their_type(tmp_path):
    """Dos alimentos de SR Legacy salen con el tipo `sr_legacy` y sus valores."""
    foods = [
        (2001, SR_LEGACY_TYPE, "Milk, whole, 3.25% milkfat"),
        (2002, SR_LEGACY_TYPE, "Bread, white"),
    ]
    nutrients = macro_nutrients(2001, kcal=61.0, protein=3.2, carbs=4.8, fat=3.3) + macro_nutrients(
        2002, kcal=266.0, protein=8.9, carbs=50.6, fat=3.3
    )
    write_usda_dataset(tmp_path, foods, nutrients)

    records = by_id(read_usda_dataset(tmp_path, "sr_legacy"))

    assert set(records) == {2001, 2002}
    assert records[2001].data_type == "sr_legacy"
    assert records[2001].calories_kcal == 61.0
    assert records[2002].protein_g == 8.9


# SDD: 021 REQ-001 AC-001.3
def test_energy_falls_back_to_atwater_general_then_atwater_specific(tmp_path):
    """Sin kcal, la energía es Atwater general (120); sin kcal ni Atwater
    general, es Atwater específico (95)."""
    foods = [
        (1, FOUNDATION_TYPE, "Food with both Atwater"),
        (2, FOUNDATION_TYPE, "Food with specific Atwater only"),
    ]
    nutrients = [
        (1, ENERGY_ATWATER_GENERAL, 120.0),
        (1, ENERGY_ATWATER_SPECIFIC, 118.0),
        (2, ENERGY_ATWATER_SPECIFIC, 95.0),
    ]
    write_usda_dataset(tmp_path, foods, nutrients)

    records = by_id(read_usda_dataset(tmp_path, "foundation"))

    assert records[1].calories_kcal == 120.0
    assert records[2].calories_kcal == 95.0


# SDD: 021 REQ-001 AC-001.4
def test_missing_nutrient_is_none_not_zero(tmp_path):
    """Un nutriente ausente queda como None; un 0 real del archivo se conserva."""
    foods = [(1, FOUNDATION_TYPE, "Food without carbs"), (2, FOUNDATION_TYPE, "Food with zero carbs")]
    nutrients = [
        (1, ENERGY_KCAL, 100.0),
        (1, PROTEIN, 10.0),
        (2, CARBS, 0.0),
    ]
    write_usda_dataset(tmp_path, foods, nutrients)

    records = by_id(read_usda_dataset(tmp_path, "foundation"))

    assert records[1].carbs_g is None
    assert records[1].fat_g is None
    assert records[2].carbs_g == 0.0
    assert records[2].protein_g is None


# SDD: 021 REQ-001 AC-001.4
def test_empty_amount_is_no_data(tmp_path):
    """Un `amount` vacío en el archivo cuenta como sin dato."""
    foods = [(1, FOUNDATION_TYPE, "Food with empty amount")]
    nutrients = [(1, PROTEIN, None), (1, ENERGY_KCAL, 50.0)]
    write_usda_dataset(tmp_path, foods, nutrients)

    record = by_id(read_usda_dataset(tmp_path, "foundation"))[1]

    assert record.protein_g is None
    assert record.calories_kcal == 50.0


# SDD: 021 REQ-001 AC-001.5
def test_nutrients_other_than_the_four_are_ignored(tmp_path):
    """Un nutriente distinto (sodio) no altera los cuatro valores guardados."""
    foods = [(1, FOUNDATION_TYPE, "Food with sodium")]
    nutrients = macro_nutrients(1, kcal=100.0, protein=5.0, carbs=10.0, fat=2.0) + [(1, SODIUM, 999.0)]
    write_usda_dataset(tmp_path, foods, nutrients)

    record = by_id(read_usda_dataset(tmp_path, "foundation"))[1]

    assert (record.calories_kcal, record.protein_g, record.carbs_g, record.fat_g) == (
        100.0,
        5.0,
        10.0,
        2.0,
    )
    assert not any(value == 999.0 for value in vars(record).values())


# SDD: 021 REQ-001 AC-001.6
def test_kcal_energy_wins_over_atwater_values(tmp_path):
    """Con energía en kcal (165) y Atwater distintos, se guarda 165."""
    foods = [(1, FOUNDATION_TYPE, "Food with kcal")]
    nutrients = [
        (1, ENERGY_KCAL, 165.0),
        (1, ENERGY_ATWATER_GENERAL, 170.0),
        (1, ENERGY_ATWATER_SPECIFIC, 160.0),
    ]
    write_usda_dataset(tmp_path, foods, nutrients)

    assert by_id(read_usda_dataset(tmp_path, "foundation"))[1].calories_kcal == 165.0


# SDD: 021 REQ-001 AC-001.7
def test_energy_is_never_computed_from_macros(tmp_path):
    """Sin ningún valor de energía, queda None aunque haya proteína,
    carbohidratos y grasa."""
    foods = [(1, FOUNDATION_TYPE, "Food without energy")]
    nutrients = [(1, PROTEIN, 10.0), (1, CARBS, 20.0), (1, 1004, 5.0)]
    write_usda_dataset(tmp_path, foods, nutrients)

    record = by_id(read_usda_dataset(tmp_path, "foundation"))[1]

    assert record.calories_kcal is None
    assert (record.protein_g, record.carbs_g, record.fat_g) == (10.0, 20.0, 5.0)


# SDD: 021 REQ-001 AC-001.1
def test_rows_that_are_not_final_foods_are_discarded(tmp_path):
    """Las filas `sample_food` (y otras) de la descarga de Foundation no se
    importan."""
    foods = [
        (1, FOUNDATION_TYPE, "Real foundation food"),
        (2, "sample_food", "A lab sample"),
        (3, "sub_sample_food", "A sub sample"),
        (4, SR_LEGACY_TYPE, "Legacy food in the same file"),
    ]
    nutrients = macro_nutrients(1, kcal=10.0) + macro_nutrients(2, kcal=20.0)
    write_usda_dataset(tmp_path, foods, nutrients)

    records = read_usda_dataset(tmp_path, "foundation")

    assert [record.fdc_id for record in records] == [1]


# SDD: 021 REQ-001 AC-001.1
def test_accepts_the_directory_as_a_string(tmp_path):
    """La carpeta puede llegar como `str` o como `Path`."""
    write_usda_dataset(tmp_path, [(1, FOUNDATION_TYPE, "Food")], macro_nutrients(1, kcal=10.0))

    assert len(read_usda_dataset(str(tmp_path), "foundation")) == 1


# SDD: 021 REQ-004 AC-004.1
def test_missing_food_file_raises_an_error_that_names_the_file(tmp_path):
    """Si falta `food.csv`, el error nombra ese archivo con el mensaje exacto."""
    write_usda_dataset(tmp_path, [(1, FOUNDATION_TYPE, "Food")], [])
    (tmp_path / "food.csv").unlink()

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    assert str(error.value) == f"No se encontró el archivo {tmp_path / 'food.csv'}."
    assert error.value.path == tmp_path / "food.csv"


# SDD: 021 REQ-004 AC-004.1
def test_missing_nutrient_file_raises_an_error_that_names_the_file(tmp_path):
    """Si falta `food_nutrient.csv`, el error nombra ese archivo."""
    write_usda_dataset(tmp_path, [(1, FOUNDATION_TYPE, "Food")], [])
    (tmp_path / "food_nutrient.csv").unlink()

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    assert str(error.value) == f"No se encontró el archivo {tmp_path / 'food_nutrient.csv'}."


# SDD: 021 REQ-004 AC-004.1
def test_missing_directory_raises_an_error_that_names_the_file(tmp_path):
    """Una carpeta que no existe produce el mismo error de archivo inexistente."""
    missing = tmp_path / "does-not-exist"

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(missing, "foundation")

    assert "food.csv" in str(error.value)


# SDD: 021 REQ-004 AC-004.2
def test_missing_required_column_in_food_file_names_file_and_column(tmp_path):
    """A `food.csv` sin la columna `description` le falta una columna
    obligatoria: el error nombra el archivo y la columna."""
    write_usda_dataset(
        tmp_path,
        [(1, FOUNDATION_TYPE, "Food")],
        [],
        food_columns=["fdc_id", "data_type", "publication_date"],
    )

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    path = tmp_path / "food.csv"
    assert str(error.value) == f"Al archivo {path} le falta la columna obligatoria «description»."


# SDD: 021 REQ-004 AC-004.2
def test_missing_required_column_in_nutrient_file_names_file_and_column(tmp_path):
    """A `food_nutrient.csv` sin `amount` le falta una columna obligatoria."""
    write_usda_dataset(
        tmp_path,
        [(1, FOUNDATION_TYPE, "Food")],
        [(1, ENERGY_KCAL, 10.0)],
        nutrient_columns=["id", "fdc_id", "nutrient_id"],
    )

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    path = tmp_path / "food_nutrient.csv"
    assert str(error.value) == f"Al archivo {path} le falta la columna obligatoria «amount»."


# SDD: 021 REQ-004 AC-004.2
def test_file_without_foods_of_the_expected_type_raises_an_error(tmp_path):
    """Un archivo sin alimentos del tipo pedido (aquí, solo SR Legacy cuando se
    pide Foundation) termina con un error que nombra el archivo y el tipo."""
    write_usda_dataset(tmp_path, [(1, SR_LEGACY_TYPE, "Legacy food")], [])

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    path = tmp_path / "food.csv"
    assert str(error.value) == f"El archivo {path} no contiene alimentos de tipo foundation_food."


# SDD: 021 REQ-004 AC-004.2
def test_non_numeric_amount_raises_an_error_with_the_line(tmp_path):
    """Un `amount` no numérico produce un error con archivo, columna y línea."""
    write_usda_dataset(tmp_path, [(1, FOUNDATION_TYPE, "Food")], [(1, ENERGY_KCAL, "abc")])

    with pytest.raises(UsdaFileError) as error:
        read_usda_dataset(tmp_path, "foundation")

    path = tmp_path / "food_nutrient.csv"
    assert str(error.value) == (
        f"El archivo {path} tiene un valor no válido en la columna «amount» (línea 2)."
    )
