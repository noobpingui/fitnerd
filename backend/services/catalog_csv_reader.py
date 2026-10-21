import csv
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from services.catalog_rules import (
    CALORIES_RANGE,
    CATALOG_NAME_LENGTH,
    FORBIDDEN_NAME_WORDS,
    MACRO_RANGE,
    SYNONYM_LENGTH,
    is_catalog_id,
    term_key,
    words,
)

REQUIRED_COLUMNS: tuple[str, ...] = (
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
NUTRIENT_COLUMNS: tuple[str, ...] = ("calories_kcal", "protein_g", "carbs_g", "fat_g")

_NUMBER_PATTERN = re.compile(r"[0-9]+(\.[0-9]+)?")
_INTEGER_PATTERN = re.compile(r"[0-9]+")
_MACRO_COLUMNS = ("protein_g", "carbs_g", "fat_g")
_MAX_MACRO_SUM = MACRO_RANGE[1]

ID_RULE = (
    "el identificador debe tener de 2 a 60 caracteres, solo minúsculas sin tildes, "
    "dígitos y guiones sueltos"
)
NAME_RULE = "el nombre debe tener de 2 a 80 caracteres y empezar por mayúscula"
SYNONYM_RULE = "cada sinónimo debe tener de 2 a 80 caracteres"
NOT_A_NUMBER_RULE = "«{column}» debe ser un número con punto decimal"
MISSING_VALUE_RULE = "falta el valor de «{column}»"
CALORIES_RULE = "«calories_kcal» debe estar entre 0 y 900"
MACRO_RULE = "«{column}» debe estar entre 0 y 100"
MACROS_SUM_RULE = "la proteína, los carbohidratos y la grasa no pueden sumar más de 100 g"
SOURCE_RULE = "«source» debe ser usda o manual"
USDA_NEEDS_FDC_ID_RULE = "las filas usda necesitan «fdc_id»"
FDC_ID_RULE = "«fdc_id» debe ser un número entero positivo"
MANUAL_NEEDS_REFERENCE_RULE = "las filas manual necesitan «reference»"
MANUAL_NO_FDC_ID_RULE = "las filas manual deben dejar «fdc_id» vacío"


class CatalogFileError(Exception):
    def __init__(self, path: Path, message: str):
        super().__init__(message)
        self.path = path
        self.message = message


@dataclass(frozen=True)
class CatalogRecord:
    row: int
    id: str
    name: str
    synonyms: tuple[str, ...]
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source: str
    fdc_id: int | None
    reference: str | None


def _cell(row: dict, column: str) -> str:
    return (row.get(column) or "").strip()


def _name_errors(name: str) -> list[str]:
    errors = []
    low, high = CATALOG_NAME_LENGTH
    if not low <= len(name) <= high or not name[0].isupper():
        errors.append(NAME_RULE)
    forbidden = next((word for word in words(name) if word in FORBIDDEN_NAME_WORDS), None)
    if forbidden is not None:
        errors.append(f"el nombre no puede contener la palabra «{forbidden}»")
    return errors


def _parse_synonyms(cell: str) -> tuple[list[str], list[str]]:
    if not cell:
        return [], []
    synonyms = [part.strip() for part in cell.split("|")]
    low, high = SYNONYM_LENGTH
    if any(not low <= len(synonym) <= high for synonym in synonyms):
        return synonyms, [SYNONYM_RULE]
    return synonyms, []


def _parse_values(row: dict) -> tuple[dict[str, float], list[str]]:
    errors = []
    texts: dict[str, str] = {}
    for column in NUTRIENT_COLUMNS:
        text = _cell(row, column)
        if not text:
            errors.append(MISSING_VALUE_RULE.format(column=column))
        elif _NUMBER_PATTERN.fullmatch(text) is None:
            errors.append(NOT_A_NUMBER_RULE.format(column=column))
        else:
            texts[column] = text
    in_range = True
    for column, text in texts.items():
        if column == "calories_kcal":
            low, high = CALORIES_RANGE
            rule = CALORIES_RULE
        else:
            low, high = MACRO_RANGE
            rule = MACRO_RULE.format(column=column)
        if not low <= Decimal(text) <= high:
            errors.append(rule)
            in_range = False
    if in_range and all(column in texts for column in _MACRO_COLUMNS):
        if sum(Decimal(texts[column]) for column in _MACRO_COLUMNS) > _MAX_MACRO_SUM:
            errors.append(MACROS_SUM_RULE)
    return {column: float(text) for column, text in texts.items()}, errors


def _parse_source(source: str, fdc_text: str, reference: str) -> tuple[int | None, list[str]]:
    if source == "usda":
        if not fdc_text:
            return None, [USDA_NEEDS_FDC_ID_RULE]
        if _INTEGER_PATTERN.fullmatch(fdc_text) is None or int(fdc_text) < 1:
            return None, [FDC_ID_RULE]
        return int(fdc_text), []
    if source == "manual":
        errors = []
        if fdc_text:
            errors.append(MANUAL_NO_FDC_ID_RULE)
        if not reference:
            errors.append(MANUAL_NEEDS_REFERENCE_RULE)
        return None, errors
    return None, [SOURCE_RULE]


def _check_uniqueness(entries: list[dict]) -> list[str]:
    """Unicidad de identificadores, nombres y sinónimos entre filas."""
    errors = []
    ids: dict[str, int] = {}
    terms: dict[str, tuple[int, str]] = {}
    for entry in entries:
        row = entry["row"]
        if entry["id_valid"]:
            if entry["id"] in ids:
                errors.append(
                    f"- Filas {ids[entry['id']]} y {row}: identificador repetido «{entry['id']}»."
                )
            else:
                ids[entry["id"]] = row
        candidates = [("name", entry["name"], entry["name_valid"])] + [
            ("synonym", synonym, entry["synonyms_valid"]) for synonym in entry["synonyms"]
        ]
        for kind, text, valid in candidates:
            key = term_key(text)
            if not valid or not key:
                continue
            if key not in terms:
                terms[key] = (row, kind)
                continue
            first_row, first_kind = terms[key]
            if kind == "name" and first_kind == "name":
                errors.append(f"- Filas {first_row} y {row}: nombre repetido «{text}».")
            elif first_row == row:
                errors.append(
                    f"- Fila {row} ({entry['id'] or 'sin identificador'}): "
                    f"«{text}» se repite como nombre o sinónimo."
                )
            else:
                errors.append(
                    f"- Filas {first_row} y {row}: «{text}» se repite como nombre o sinónimo."
                )
    return errors


def read_catalog_csv(path: Path | str) -> list[CatalogRecord]:
    path = Path(path)
    if not path.is_file():
        raise CatalogFileError(path, f"No se encontró el archivo {path}.")
    try:
        with open(path, newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames or []
            for column in REQUIRED_COLUMNS:
                if column not in fieldnames:
                    raise CatalogFileError(
                        path, f"Al archivo {path} le falta la columna obligatoria «{column}»."
                    )
            rows = list(reader)
    except UnicodeDecodeError:
        raise CatalogFileError(path, f"El archivo {path} no está codificado en UTF-8.") from None

    errors: list[str] = []
    entries: list[dict] = []
    records: list[CatalogRecord] = []
    for number, row in enumerate(rows, start=1):
        row_id = _cell(row, "id")
        name = _cell(row, "name")
        reference = _cell(row, "reference")
        row_errors: list[str] = []

        id_valid = is_catalog_id(row_id)
        if not id_valid:
            row_errors.append(ID_RULE)
        name_errors = _name_errors(name)
        row_errors += name_errors
        synonyms, synonym_errors = _parse_synonyms(_cell(row, "synonyms"))
        row_errors += synonym_errors
        values, value_errors = _parse_values(row)
        row_errors += value_errors
        source = _cell(row, "source")
        fdc_id, source_errors = _parse_source(source, _cell(row, "fdc_id"), reference)
        row_errors += source_errors

        label = row_id or "sin identificador"
        errors += [f"- Fila {number} ({label}): {rule}." for rule in row_errors]
        entries.append(
            {
                "row": number,
                "id": row_id,
                "id_valid": id_valid,
                "name": name,
                "name_valid": not name_errors,
                "synonyms": synonyms,
                "synonyms_valid": not synonym_errors,
            }
        )
        if not row_errors:
            records.append(
                CatalogRecord(
                    row=number,
                    id=row_id,
                    name=name,
                    synonyms=tuple(synonyms),
                    calories_kcal=values["calories_kcal"],
                    protein_g=values["protein_g"],
                    carbs_g=values["carbs_g"],
                    fat_g=values["fat_g"],
                    source=source,
                    fdc_id=fdc_id,
                    reference=reference or None,
                )
            )

    errors += _check_uniqueness(entries)
    if errors:
        raise CatalogFileError(path, "\n".join([f"El archivo {path} tiene errores:", *errors]))
    return records
