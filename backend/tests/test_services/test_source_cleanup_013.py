"""Escaneo del código fuente del backend (spec 013, limpieza de las features
006 a 010): definiciones únicas de constantes compartidas, ortografía de los
docstrings de un archivo de tests y un comentario concreto del servicio de
análisis. Sigue el patrón de test_no_catalog_leftovers.py.
"""

import ast
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).parents[2]

EXCLUDED_DIRS = {".venv", "venv", "__pycache__", "node_modules", "tests", ".pytest_cache"}

USER_NOT_FOUND_LITERAL = '"Usuario no encontrado"'
PACE_CONSTANT_DEFINITION = "PACE_STATUSES_WITH_RATE ="
PACE_TUPLE = '("on_track", "too_slow", "too_fast", "off_range")'

MISSPELLED_WORDS = ["unicas", "restriccion", "medicion", "invalido", "valido"]


def source_files():
    for path in BACKEND_ROOT.rglob("*.py"):
        relative = path.relative_to(BACKEND_ROOT)
        parts = relative.parts
        if any(part in EXCLUDED_DIRS for part in parts):
            continue
        yield relative, path.read_text(encoding="utf-8", errors="ignore")


def occurrences(needle):
    found = []
    for relative, content in source_files():
        found.extend([relative.as_posix()] * content.count(needle))
    return found


# SDD: 013 NFR-002 AC-N002.9
def test_user_not_found_message_is_defined_once():
    """El mensaje "Usuario no encontrado" aparece una sola vez en el código de producción."""
    assert len(occurrences(USER_NOT_FOUND_LITERAL)) == 1, occurrences(USER_NOT_FOUND_LITERAL)


# SDD: 013 NFR-002 AC-N002.9
def test_pace_statuses_with_rate_are_defined_once():
    """La constante y la tupla de estados de ritmo con ritmo se definen una sola vez."""
    assert len(occurrences(PACE_CONSTANT_DEFINITION)) == 1, occurrences(PACE_CONSTANT_DEFINITION)
    assert len(occurrences(PACE_TUPLE)) == 1, occurrences(PACE_TUPLE)


def docstrings_of(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    docstrings = []
    module_doc = ast.get_docstring(tree)
    if module_doc:
        docstrings.append(module_doc)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            doc = ast.get_docstring(node)
            if doc:
                docstrings.append(doc)
    return docstrings


# SDD: 013 NFR-003 AC-N003.1
def test_body_metric_routes_test_docstrings_have_their_accents():
    """Los docstrings de test_body_metric_routes.py no tienen palabras sin tilde."""
    path = BACKEND_ROOT / "tests" / "test_routes" / "test_body_metric_routes.py"
    docstrings = docstrings_of(path)
    assert len(docstrings) > 10

    offenders = []
    for doc in docstrings:
        for word in MISSPELLED_WORDS:
            if re.search(rf"\b{word}\b", doc, flags=re.IGNORECASE):
                offenders.append(f"{word}: {doc.splitlines()[0]}")

    assert offenders == []


# SDD: 013 NFR-003 AC-N003.2
def test_progress_analysis_service_has_no_regional_wording():
    """progress_analysis_service.py no contiene la palabra "prolijo"."""
    content = (BACKEND_ROOT / "services" / "progress_analysis_service.py").read_text(
        encoding="utf-8"
    )
    assert "prolijo" not in content
