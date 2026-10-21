"""Tests UNITARIOS del lector del CSV del catálogo (spec 023): leen archivos
temporales (`tmp_path`) escritos con `write_catalog_csv`; no tocan la base de
datos. Los mensajes se comparan con el texto del plan (sección 3.2)."""

import pytest

from services.catalog_csv_reader import (
    NUTRIENT_COLUMNS,
    REQUIRED_COLUMNS,
    CatalogFileError,
    CatalogRecord,
    read_catalog_csv,
)
from tests.catalog_samples import CATALOG_COLUMNS, catalog_row, write_catalog_csv


def chicken(**overrides):
    return catalog_row(**overrides)


def rice(**overrides):
    values = dict(
        id="arroz-blanco-cocido",
        name="Arroz blanco cocido",
        calories_kcal="130.0",
        protein_g="2.69",
        carbs_g="28.17",
        fat_g="0.28",
        fdc_id="168878",
    )
    values.update(overrides)
    return catalog_row(**values)


def banana(**overrides):
    values = dict(
        id="banano",
        name="Banano",
        synonyms="guineo|cambur",
        calories_kcal="89.0",
        protein_g="1.09",
        carbs_g="22.84",
        fat_g="0.33",
        fdc_id="173944",
    )
    values.update(overrides)
    return catalog_row(**values)


def manual(**overrides):
    values = dict(
        id="tortilla-de-maiz",
        name="Tortilla de maíz",
        source="manual",
        fdc_id="",
        reference="Tabla de composición de alimentos, código 123",
    )
    values.update(overrides)
    return catalog_row(**values)


def read_error(path):
    with pytest.raises(CatalogFileError) as exc_info:
        read_catalog_csv(path)
    return str(exc_info.value)


def csv_with(tmp_path, rows, columns=CATALOG_COLUMNS):
    return write_catalog_csv(tmp_path / "food_catalog.csv", rows, columns)


# --------------------------------------------------------------------------
# Constantes públicas
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.2
def test_required_columns_are_the_ten_columns_of_the_csv(tmp_path):
    """Las diez columnas obligatorias, en el orden del contrato; un CSV que
    solo trae esas columnas se lee."""
    path = csv_with(tmp_path, [rice()], columns=REQUIRED_COLUMNS)
    assert [record.id for record in read_catalog_csv(path)] == ["arroz-blanco-cocido"]
    assert REQUIRED_COLUMNS == (
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
    )
    assert NUTRIENT_COLUMNS == ("calories_kcal", "protein_g", "carbs_g", "fat_g")


# --------------------------------------------------------------------------
# Archivo y columnas
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.1
def test_a_missing_file_names_the_file(tmp_path):
    """El archivo no existe: el error nombra la ruta."""
    path = tmp_path / "no-existe.csv"

    message = read_error(path)

    assert message == f"No se encontró el archivo {path}."


# SDD: 023 REQ-003 AC-003.1
def test_the_error_keeps_the_path_and_the_message(tmp_path):
    """`CatalogFileError` guarda `path` y `message`, y `str(error)` es el mensaje."""
    path = tmp_path / "no-existe.csv"

    with pytest.raises(CatalogFileError) as exc_info:
        read_catalog_csv(path)

    assert exc_info.value.path == path
    assert exc_info.value.message == str(exc_info.value)


# SDD: 023 REQ-003 AC-003.1
def test_the_path_can_be_given_as_text(tmp_path):
    """Una ruta en texto funciona igual que un `Path`."""
    path = csv_with(tmp_path, [chicken()])

    assert len(read_catalog_csv(str(path))) == 1


# SDD: 023 REQ-003 AC-003.2
def test_a_missing_synonyms_column_names_the_file_and_the_column(tmp_path):
    """Sin la columna `synonyms`: el error nombra el archivo y la columna."""
    columns = [column for column in CATALOG_COLUMNS if column != "synonyms"]
    path = csv_with(tmp_path, [chicken()], columns)

    message = read_error(path)

    assert message == f"Al archivo {path} le falta la columna obligatoria «synonyms»."


# SDD: 023 REQ-003 AC-003.2
@pytest.mark.parametrize("column", ["id", "name", "fdc_id", "reference", "source"])
def test_each_required_column_is_checked(tmp_path, column):
    """Falta cualquiera de las columnas obligatorias: se nombra."""
    columns = [c for c in CATALOG_COLUMNS if c != column]
    path = csv_with(tmp_path, [chicken()], columns)

    message = read_error(path)

    assert f"«{column}»" in message
    assert str(path) in message


# SDD: 023 REQ-003 AC-003.2
def test_extra_columns_are_ignored(tmp_path):
    """Las columnas que no son obligatorias no impiden la lectura."""
    rows = [dict(chicken(), notes="algo")]
    path = csv_with(tmp_path, rows, CATALOG_COLUMNS + ["notes"])

    assert [record.id for record in read_catalog_csv(path)] == ["pechuga-de-pollo-a-la-plancha"]


# SDD: 023 REQ-003 AC-003.2
def test_a_file_with_a_byte_order_mark_is_read(tmp_path):
    """Un CSV UTF-8 con BOM (como lo guarda Excel) se lee igual."""
    path = tmp_path / "bom.csv"
    header = ",".join(CATALOG_COLUMNS)
    row = "pechuga-de-pollo-a-la-plancha,Pechuga de pollo a la plancha,,165.0,31.0,0.0,3.57,usda,171477,"
    path.write_text(header + "\n" + row + "\n", encoding="utf-8-sig")

    records = read_catalog_csv(path)

    assert records[0].id == "pechuga-de-pollo-a-la-plancha"


# --------------------------------------------------------------------------
# Filas válidas
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.1
def test_valid_rows_are_returned_in_file_order_with_typed_fields(tmp_path):
    """Dos filas válidas: registros en el orden del archivo, con `row` desde 1,
    sinónimos como tupla, números como float y FDC ID como entero."""
    path = csv_with(tmp_path, [banana(), chicken(), manual()])

    records = read_catalog_csv(path)

    assert records[0] == CatalogRecord(
        row=1,
        id="banano",
        name="Banano",
        synonyms=("guineo", "cambur"),
        calories_kcal=89.0,
        protein_g=1.09,
        carbs_g=22.84,
        fat_g=0.33,
        source="usda",
        fdc_id=173944,
        reference=None,
    )
    assert [record.row for record in records] == [1, 2, 3]
    assert records[1].fat_g == 3.57
    assert records[1].synonyms == ()
    assert records[2].source == "manual"
    assert records[2].fdc_id is None
    assert records[2].reference == "Tabla de composición de alimentos, código 123"


# SDD: 023 REQ-003 AC-003.1
def test_cells_are_stripped_and_synonyms_split_by_pipe(tmp_path):
    """Los espacios de los extremos de cada celda y de cada sinónimo se quitan."""
    path = csv_with(
        tmp_path,
        [banana(id=" banano ", name=" Banano ", synonyms=" guineo | cambur ", fdc_id=" 173944 ")],
    )

    record = read_catalog_csv(path)[0]

    assert (record.id, record.name) == ("banano", "Banano")
    assert record.synonyms == ("guineo", "cambur")
    assert record.fdc_id == 173944


# SDD: 023 REQ-003 AC-003.1
def test_an_usda_row_may_carry_a_reference(tmp_path):
    """La referencia es opcional en `usda`: si está, se conserva."""
    path = csv_with(tmp_path, [chicken(reference="SR Legacy")])

    assert read_catalog_csv(path)[0].reference == "SR Legacy"


# SDD: 023 REQ-003 AC-003.1
def test_the_limits_of_the_values_are_accepted(tmp_path):
    """900 kcal y un macro de 100 g (sumando 100) se aceptan; también ceros."""
    path = csv_with(
        tmp_path,
        [
            chicken(calories_kcal="900", protein_g="0", carbs_g="0", fat_g="100"),
            rice(calories_kcal="0", protein_g="0.0", carbs_g="0", fat_g="0"),
            banana(protein_g="30", carbs_g="40", fat_g="30"),
        ],
    )

    assert len(read_catalog_csv(path)) == 3


# SDD: 023 REQ-001 AC-001.3
def test_words_that_only_contain_a_forbidden_word_as_part_are_accepted(tmp_path):
    """«Conejo» y «Confitura» no contienen la palabra «con»."""
    path = csv_with(
        tmp_path,
        [
            chicken(id="conejo", name="Conejo asado", fdc_id="1"),
            rice(id="confitura", name="Confitura de fresa"),
        ],
    )

    assert [record.id for record in read_catalog_csv(path)] == ["conejo", "confitura"]


# --------------------------------------------------------------------------
# AC-003.3 y reglas por fila
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.3
def test_a_third_row_with_120_protein_names_the_row_the_id_and_the_rule(tmp_path):
    """Dos filas válidas y una tercera con 120 g de proteína: nombra el archivo,
    la fila 3, su identificador y la regla."""
    path = csv_with(
        tmp_path, [chicken(), rice(), banana(protein_g="120")]
    )

    message = read_error(path)

    assert f"El archivo {path} tiene errores:" in message
    assert "- Fila 3 (banano): «protein_g» debe estar entre 0 y 100." in message
    assert "Fila 1" not in message and "Fila 2" not in message


# SDD: 023 REQ-003 AC-003.3
def test_calories_out_of_range_name_their_own_rule(tmp_path):
    """901 kcal: «calories_kcal» debe estar entre 0 y 900."""
    message = read_error(csv_with(tmp_path, [chicken(calories_kcal="901")]))

    assert "- Fila 1 (pechuga-de-pollo-a-la-plancha): «calories_kcal» debe estar entre 0 y 900." in message


# SDD: 023 REQ-003 AC-003.3
@pytest.mark.parametrize("column", ["protein_g", "carbs_g", "fat_g"])
def test_each_macro_above_100_is_rejected(tmp_path, column):
    """Cada macro por encima de 100 g da su propio error."""
    message = read_error(csv_with(tmp_path, [chicken(**{column: "100.5"})]))

    assert f"«{column}» debe estar entre 0 y 100" in message


# SDD: 023 REQ-003 AC-003.3
def test_macros_that_add_up_to_more_than_100_are_rejected(tmp_path):
    """60 + 30 + 20 g: la suma supera 100 g."""
    message = read_error(
        csv_with(tmp_path, [chicken(protein_g="60", carbs_g="30", fat_g="20")])
    )

    assert (
        "- Fila 1 (pechuga-de-pollo-a-la-plancha): "
        "la proteína, los carbohidratos y la grasa no pueden sumar más de 100 g." in message
    )


# SDD: 023 REQ-003 AC-003.3
@pytest.mark.parametrize("value", ["1,5", "abc", "-1", "1e3", ".5", "5."])
def test_a_value_that_is_not_a_number_with_decimal_point_is_rejected(tmp_path, value):
    """Coma decimal, texto, negativos, notación científica: no es un número con punto."""
    message = read_error(csv_with(tmp_path, [chicken(protein_g=value)]))

    assert "«protein_g» debe ser un número con punto decimal" in message


# SDD: 023 REQ-003 AC-003.8
@pytest.mark.parametrize("column", ["calories_kcal", "protein_g", "carbs_g", "fat_g"])
def test_an_empty_value_names_the_row_and_the_column(tmp_path, column):
    """Un valor por 100 g vacío: «falta el valor de «columna»»."""
    message = read_error(csv_with(tmp_path, [chicken(), rice(**{column: ""})]))

    assert f"- Fila 2 (arroz-blanco-cocido): falta el valor de «{column}»." in message


# SDD: 023 REQ-003 AC-003.8
def test_a_value_with_only_spaces_counts_as_empty(tmp_path):
    """Un valor de solo espacios se trata como vacío."""
    message = read_error(csv_with(tmp_path, [chicken(fat_g="   ")]))

    assert "falta el valor de «fat_g»" in message


# SDD: 023 REQ-003 AC-003.7
def test_a_manual_row_without_reference_names_the_row(tmp_path):
    """Fila `manual` sin fuente."""
    message = read_error(csv_with(tmp_path, [chicken(), manual(reference="")]))

    assert "- Fila 2 (tortilla-de-maiz): las filas manual necesitan «reference»." in message


# SDD: 023 REQ-003 AC-003.7
def test_an_usda_row_without_fdc_id_names_the_row(tmp_path):
    """Fila `usda` sin FDC ID."""
    message = read_error(csv_with(tmp_path, [chicken(fdc_id="")]))

    assert (
        "- Fila 1 (pechuga-de-pollo-a-la-plancha): las filas usda necesitan «fdc_id»." in message
    )


# SDD: 023 REQ-003 AC-003.7
def test_a_manual_row_with_fdc_id_is_rejected(tmp_path):
    """Una fila `manual` debe dejar `fdc_id` vacío."""
    message = read_error(csv_with(tmp_path, [manual(fdc_id="171477")]))

    assert "las filas manual deben dejar «fdc_id» vacío" in message


# SDD: 023 REQ-003 AC-003.7
@pytest.mark.parametrize("value", ["abc", "0", "-5", "12.5", "1e3"])
def test_an_fdc_id_that_is_not_a_positive_integer_is_rejected(tmp_path, value):
    """FDC ID con texto, cero, negativo o decimales."""
    message = read_error(csv_with(tmp_path, [chicken(fdc_id=value)]))

    assert "«fdc_id» debe ser un número entero positivo" in message


# SDD: 023 REQ-003 AC-003.7
@pytest.mark.parametrize("value", ["", "otro", "USDA"])
def test_a_source_that_is_not_usda_or_manual_is_rejected(tmp_path, value):
    """`source` vacío o con otro valor."""
    message = read_error(csv_with(tmp_path, [chicken(source=value)]))

    assert "«source» debe ser usda o manual" in message


# SDD: 023 REQ-003 AC-003.3
@pytest.mark.parametrize(
    "value",
    ["", "a", "Arroz-Blanco", "arroz blanco", "plátano", "-arroz", "arroz-", "arroz--blanco", "a" * 61],
)
def test_an_invalid_id_names_the_row_and_the_rule(tmp_path, value):
    """Identificadores con mayúsculas, tildes, espacios, guiones mal puestos o
    de longitud fuera de rango."""
    message = read_error(csv_with(tmp_path, [chicken(id=value)]))

    expected_id = value if value else "sin identificador"
    assert (
        f"- Fila 1 ({expected_id}): el identificador debe tener de 2 a 60 caracteres, "
        "solo minúsculas sin tildes, dígitos y guiones sueltos." in message
    )


# SDD: 023 REQ-003 AC-003.3
@pytest.mark.parametrize("value", ["", "A", "arroz blanco", "Á" + "a" * 80])
def test_an_invalid_name_names_the_row_and_the_rule(tmp_path, value):
    """Nombre vacío, de un carácter, sin mayúscula inicial o de 81 caracteres."""
    message = read_error(csv_with(tmp_path, [chicken(name=value)]))

    assert (
        "el nombre debe tener de 2 a 80 caracteres y empezar por mayúscula." in message
    )


# SDD: 023 REQ-001 AC-001.3
@pytest.mark.parametrize(
    "name, word",
    [
        ("Arroz con frijoles", "con"),
        ("Huevo frito", "frito"),
        ("Papa frita", "frita"),
        ("Plátanos fritos", "fritos"),
        ("Papas fritas", "fritas"),
        ("CON arroz", "con"),
        ("Arroz, con pollo", "con"),
    ],
)
def test_a_name_with_a_forbidden_word_is_rejected(tmp_path, name, word):
    """Las palabras «con», «frito», «frita», «fritos» y «fritas» no pueden estar
    en un nombre, aunque vayan con otra mayúscula o signos."""
    message = read_error(csv_with(tmp_path, [chicken(name=name)]))

    assert f"el nombre no puede contener la palabra «{word}»" in message


# SDD: 023 REQ-003 AC-003.4
@pytest.mark.parametrize("synonyms", ["a", "x|b||c", "b|" + "s" * 81])
def test_a_synonym_with_a_length_out_of_range_or_empty_is_rejected(tmp_path, synonyms):
    """Sinónimos de un carácter, vacíos (`a||b`) o de 81 caracteres."""
    message = read_error(csv_with(tmp_path, [banana(synonyms=synonyms)]))

    assert "cada sinónimo debe tener de 2 a 80 caracteres" in message


# --------------------------------------------------------------------------
# Unicidad
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.4
def test_two_rows_with_the_same_id_name_both_rows(tmp_path):
    """Mismo identificador en las filas 1 y 3."""
    path = csv_with(tmp_path, [rice(), banana(), rice(name="Arroz distinto")])

    message = read_error(path)

    assert "- Filas 1 y 3: identificador repetido «arroz-blanco-cocido»." in message


# SDD: 023 REQ-003 AC-003.4
def test_two_rows_with_the_same_name_name_both_rows(tmp_path):
    """Mismo nombre en las filas 1 y 2."""
    path = csv_with(tmp_path, [rice(), rice(id="arroz-otro")])

    message = read_error(path)

    assert "- Filas 1 y 2: nombre repetido «Arroz blanco cocido»." in message


# SDD: 023 REQ-003 AC-003.4
def test_names_that_only_differ_in_case_or_accents_are_repeated(tmp_path):
    """«Piña» y «PINA» son el mismo nombre."""
    path = csv_with(
        tmp_path,
        [rice(id="pina", name="Piña"), banana(id="pina-2", name="PINA", synonyms="")],
    )

    message = read_error(path)

    assert "Filas 1 y 2: nombre repetido" in message


# SDD: 023 REQ-003 AC-003.4
def test_a_synonym_equal_to_the_name_of_another_food_is_rejected(tmp_path):
    """El sinónimo «Arroz blanco cocido» de la fila 2 es el nombre de la fila 1."""
    path = csv_with(tmp_path, [rice(), banana(synonyms="guineo|arroz blanco cocido")])

    message = read_error(path)

    assert "- Filas 1 y 2:" in message
    assert "se repite como nombre o sinónimo" in message


# SDD: 023 REQ-003 AC-003.4
def test_a_synonym_equal_to_a_synonym_of_another_food_is_rejected(tmp_path):
    """El mismo sinónimo en dos alimentos."""
    path = csv_with(
        tmp_path,
        [banana(synonyms="guineo"), rice(synonyms="Guíneo")],
    )

    message = read_error(path)

    assert "- Filas 1 y 2:" in message
    assert "se repite como nombre o sinónimo" in message


# SDD: 023 REQ-003 AC-003.4
def test_a_synonym_equal_to_the_name_of_the_same_food_is_rejected(tmp_path):
    """Un sinónimo igual al nombre del propio alimento también se repite."""
    path = csv_with(tmp_path, [banana(synonyms="BANANO")])

    message = read_error(path)

    assert "se repite como nombre o sinónimo" in message


# SDD: 023 REQ-003 AC-003.4
def test_the_same_synonym_twice_in_one_food_is_rejected(tmp_path):
    """Un sinónimo repetido dentro del mismo alimento."""
    path = csv_with(tmp_path, [banana(synonyms="guineo|Guineo")])

    message = read_error(path)

    assert "se repite como nombre o sinónimo" in message


# --------------------------------------------------------------------------
# Todos los errores en un mensaje
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.3
def test_all_the_errors_come_in_one_message_in_row_order(tmp_path):
    """Tres filas con errores distintos: un único mensaje con una línea por
    error, en el orden de las filas."""
    path = csv_with(
        tmp_path,
        [
            chicken(protein_g="120"),
            rice(fat_g=""),
            banana(source="otro"),
        ],
    )

    message = read_error(path)

    lines = message.splitlines()
    assert lines[0] == f"El archivo {path} tiene errores:"
    assert all(line.startswith("- ") for line in lines[1:])
    positions = [message.index(f"Fila {number} (") for number in (1, 2, 3)]
    assert positions == sorted(positions)


# SDD: 023 REQ-003 AC-003.3
def test_several_errors_in_the_same_row_are_all_reported(tmp_path):
    """Una fila con identificador, valor y origen mal: tres líneas de la fila 1."""
    path = csv_with(tmp_path, [chicken(id="Mal Id", calories_kcal="", source="otro")])

    message = read_error(path)

    assert message.count("- Fila 1 (Mal Id):") >= 3
