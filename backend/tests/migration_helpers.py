"""Utilidades compartidas de los tests de migraciones (spec 019): cargar una
migración por ruta, ejecutar su `upgrade()` o `downgrade()` sobre la conexión
de la transacción de la prueba y quitar o restaurar las restricciones CHECK del
correo canónico para reproducir una base anterior a la 019.

No hay mocks: se usa la API pública de Alembic (`MigrationContext` y
`Operations`) contra el Postgres de prueba.
"""

import importlib.util
from pathlib import Path
from types import ModuleType

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy.schema import AddConstraint

from models.password_reset_request import PasswordResetRequest
from models.user import User

VERSIONS_DIR = Path(__file__).parents[1] / "migrations" / "versions"

CANONICAL_EMAILS_MIGRATION = "e5b7d9f1a3c6_canonical_email_check_constraints.py"

# Tabla de cada restricción, para poder quitarla con ALTER TABLE.
CANONICAL_EMAIL_CHECKS = {
    "ck_users_email_canonical": "users",
    "ck_password_reset_requests_email_canonical": "password_reset_requests",
}


def load_migration(filename: str) -> ModuleType:
    """Carga un archivo de `migrations/versions/` por su ruta."""
    spec = importlib.util.spec_from_file_location("migration_under_test", VERSIONS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_upgrade(connection, filename: str) -> None:
    """Ejecuta `upgrade()` sobre la conexión de la transacción de la prueba."""
    module = load_migration(filename)
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        module.upgrade()


def run_downgrade(connection, filename: str) -> None:
    """Ejecuta `downgrade()` sobre la conexión de la transacción de la prueba."""
    module = load_migration(filename)
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        module.downgrade()


def existing_canonical_email_checks(connection) -> list[str]:
    """Nombres de las restricciones del correo canónico que existen en la base."""
    names = ", ".join(f"'{name}'" for name in CANONICAL_EMAIL_CHECKS)
    rows = connection.exec_driver_sql(
        f"SELECT conname FROM pg_constraint WHERE conname IN ({names}) ORDER BY conname"
    ).all()
    return [row[0] for row in rows]


def drop_canonical_email_checks(connection) -> list[str]:
    """Quita las restricciones que existan (con IF EXISTS, así funciona igual
    antes y después de la implementación) y devuelve los nombres que había."""
    connection.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
    existing = existing_canonical_email_checks(connection)
    for name, table in CANONICAL_EMAIL_CHECKS.items():
        connection.exec_driver_sql(f"ALTER TABLE public.{table} DROP CONSTRAINT IF EXISTS {name}")
    return existing


def restore_canonical_email_checks(connection, names: list[str]) -> None:
    """Vuelve a crear, desde los `CheckConstraint` de los modelos, las
    restricciones cuyo nombre esté en `names`."""
    connection.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
    for table in (User.__table__, PasswordResetRequest.__table__):
        for constraint in table.constraints:
            if constraint.name in names:
                connection.execute(AddConstraint(constraint))
