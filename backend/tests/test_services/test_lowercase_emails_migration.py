"""Tests de la migración a7d3f9c1e5b2 (spec 014) contra Postgres real: pasa los
correos guardados a minúsculas y falla sin modificar nada si hay correos que
solo se diferencian en mayúsculas. Todo ocurre en la transacción de
`db_session` y termina con `rollback()`.

La migración se carga por ruta y se ejecuta con la API pública de Alembic
(`MigrationContext` y `Operations`), sin mocks.
"""

import importlib.util
from datetime import date
from pathlib import Path

import pytest
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy import text

from models.body_metric import BodyMetric
from models.user import User
from models.user_profile import UserProfile

MIGRATION_PATH = (
    Path(__file__).parents[2]
    / "migrations"
    / "versions"
    / "a7d3f9c1e5b2_lowercase_user_emails.py"
)


def load_migration():
    spec = importlib.util.spec_from_file_location("lowercase_emails_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_upgrade(db_session):
    """Ejecuta upgrade() sobre la conexión de la transacción de la prueba."""
    module = load_migration()
    context = MigrationContext.configure(db_session.connection())
    with Operations.context(context):
        module.upgrade()


def stored_emails(db_session):
    rows = db_session.execute(text("SELECT email FROM public.users")).all()
    return sorted(row[0] for row in rows)


# SDD: 014 REQ-005 AC-005.3
def test_upgrade_lowercases_the_email_and_keeps_the_rest_of_the_data(db_session):
    """Una cuenta con 'Ana@Example.com' pasa a 'ana@example.com' y conserva
    contraseña, vínculo con Google, perfil y mediciones."""
    try:
        user = User(
            email="Ana@Example.com",
            password_hash="hash-bcrypt-de-mentira",
            first_name="Ana",
            last_name="Pérez",
            date_of_birth=date(1990, 6, 15),
            google_id="g-123",
        )
        db_session.add(user)
        db_session.flush()
        user_id = user.id
        db_session.add(
            UserProfile(
                user_id=user_id,
                gender="female",
                height_unit="cm",
                height_cm=165.0,
                weight_unit="kg",
                weight=60.0,
                activity_level="moderate",
                goal="maintain",
            )
        )
        db_session.add(BodyMetric(user_id=user_id, recorded_at=date(2026, 10, 10), weight=60.0))
        db_session.flush()

        run_upgrade(db_session)

        db_session.expire_all()
        migrated = db_session.get(User, user_id)
        assert migrated.email == "ana@example.com"
        assert migrated.password_hash == "hash-bcrypt-de-mentira"
        assert migrated.google_id == "g-123"
        assert migrated.first_name == "Ana"
        assert migrated.date_of_birth == date(1990, 6, 15)
        assert db_session.get(UserProfile, user_id).weight == 60.0
        metrics = db_session.query(BodyMetric).filter_by(user_id=user_id).all()
        assert len(metrics) == 1
        assert metrics[0].weight == 60.0
    finally:
        db_session.rollback()


# SDD: 014 REQ-005 AC-005.3
def test_upgrade_leaves_already_lowercase_emails_untouched(db_session):
    """Un correo que ya está en minúsculas no cambia."""
    try:
        db_session.add(User(email="luis@example.com"))
        db_session.flush()

        run_upgrade(db_session)

        assert stored_emails(db_session) == ["luis@example.com"]
    finally:
        db_session.rollback()


# SDD: 014 REQ-005 AC-005.4
def test_upgrade_fails_without_changes_when_emails_differ_only_in_case(db_session):
    """Con 'Ana@Example.com' y 'ana@example.com' el upgrade lanza un error que
    nombra los dos correos y no modifica, fusiona ni borra ninguna cuenta."""
    try:
        db_session.add(User(email="Ana@Example.com"))
        db_session.add(User(email="ana@example.com"))
        db_session.add(User(email="Otro@Example.com"))
        db_session.flush()

        with pytest.raises(Exception) as exc_info:
            run_upgrade(db_session)

        message = str(exc_info.value)
        assert "Ana@Example.com" in message
        assert "ana@example.com" in message
        assert stored_emails(db_session) == [
            "Ana@Example.com",
            "Otro@Example.com",
            "ana@example.com",
        ]
    finally:
        db_session.rollback()
