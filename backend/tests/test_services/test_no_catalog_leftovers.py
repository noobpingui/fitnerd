"""Escaneo del codigo fuente del backend (spec 012, NFR-001): no quedan
referencias a los endpoints retirados ni a las cinco tablas retiradas.

Quedan fuera del escaneo las dependencias instaladas (.venv), el historial de
migraciones (que incluye la de esta feature) y los tests, que tienen que
nombrar las rutas y las tablas retiradas (Q8).
"""

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).parents[2]

EXCLUDED_DIRS = {".venv", "venv", "__pycache__", "node_modules", "tests", ".pytest_cache"}

RETIRED_ROUTES = [
    "/api/body-regions",
    "/api/exercise-categories",
    "/api/exercises",
    "/api/favorites",
    "/api/weekly-plan",
]
RETIRED_TABLES = [
    "body_regions",
    "exercise_categories",
    "exercises",
    "exercise_favorites",
    "weekly_plan_entries",
]


def source_files():
    for path in BACKEND_ROOT.rglob("*.py"):
        relative = path.relative_to(BACKEND_ROOT)
        parts = relative.parts
        if any(part in EXCLUDED_DIRS for part in parts):
            continue
        if parts[:2] == ("migrations", "versions"):
            continue
        yield relative, path.read_text(encoding="utf-8", errors="ignore")


# SDD: 012 NFR-001 AC-N001.2
def test_backend_source_has_no_retired_routes_or_table_names():
    """Ningun .py del backend (salvo migraciones, tests y .venv) nombra las
    rutas retiradas ni las cinco tablas como palabra completa."""
    scanned = list(source_files())
    scanned_names = {relative.as_posix() for relative, _ in scanned}
    assert "app.py" in scanned_names
    assert "routes/__init__.py" in scanned_names

    table_patterns = [(name, re.compile(rf"\b{name}\b")) for name in RETIRED_TABLES]
    offenders = []
    for relative, content in scanned:
        for route in RETIRED_ROUTES:
            if route in content:
                offenders.append(f"{relative.as_posix()}: {route}")
        for name, pattern in table_patterns:
            if pattern.search(content):
                offenders.append(f"{relative.as_posix()}: {name}")

    assert offenders == []


# SDD: 012 NFR-001 AC-N001.2
def test_catalog_migration_script_to_production_no_longer_exists():
    """El script de migracion del catalogo a produccion fue retirado."""
    assert not (BACKEND_ROOT / "scripts" / "migrate_catalog_to_prod.py").exists()
