"""Tests de la migración e5b7d9f1a3c6 (spec 019) contra Postgres real: deja
canónicos (sin espacios en los extremos y en minúsculas) los correos de las
cuentas y de las solicitudes de restablecimiento, falla sin modificar nada si
hay conflictos y crea o retira las restricciones CHECK.

Cada test quita antes las restricciones (`drop_canonical_email_checks`) para
reproducir la base anterior a la 019, prepara datos "sucios", ejecuta la
migración con la API pública de Alembic y termina con `rollback()`, que
restaura las restricciones (el DDL de Postgres es transaccional).
"""

from datetime import date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from models.password_reset_request import PasswordResetRequest
from models.user import User
from tests.migration_helpers import (
    CANONICAL_EMAILS_MIGRATION,
    drop_canonical_email_checks,
    existing_canonical_email_checks,
    run_downgrade,
    run_upgrade,
)

USERS_CHECK = "ck_users_email_canonical"
RESET_REQUESTS_CHECK = "ck_password_reset_requests_email_canonical"
CONFLICT_PREFIX = (
    "Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; "
    "resuélvelas a mano antes de migrar: "
)
CREATED_AT = datetime(2026, 1, 2, 3, 4, 5)


def upgrade(db_session):
    run_upgrade(db_session.connection(), CANONICAL_EMAILS_MIGRATION)


def downgrade(db_session):
    run_downgrade(db_session.connection(), CANONICAL_EMAILS_MIGRATION)


def stored_user_emails(db_session):
    rows = db_session.execute(text("SELECT email FROM public.users")).all()
    return sorted(row[0] for row in rows)


def stored_request_emails(db_session):
    rows = db_session.execute(text("SELECT email FROM public.password_reset_requests")).all()
    return sorted(row[0] for row in rows)


def user_row(db_session, user_id):
    result = db_session.execute(
        text("SELECT * FROM public.users WHERE id = :id"), {"id": user_id}
    )
    return dict(result.mappings().one())


def request_row(db_session, request_id):
    result = db_session.execute(
        text("SELECT * FROM public.password_reset_requests WHERE id = :id"), {"id": request_id}
    )
    return dict(result.mappings().one())


def add_request(db_session, email, **fields):
    reset_request = PasswordResetRequest(
        email=email, client_ip="203.0.113.7", created_at=CREATED_AT, **fields
    )
    db_session.add(reset_request)
    db_session.flush()
    return reset_request.id


def conflict_groups(message):
    """Parte el texto tras el prefijo en grupos de correos entre comillas."""
    assert message.startswith(CONFLICT_PREFIX)
    groups = message[len(CONFLICT_PREFIX):].split("; ")
    return [frozenset(groups_item.split(", ")) for groups_item in groups]


# ---------------------------------------------------------------- REQ-001

# SDD: 019 REQ-001 AC-001.1
def test_upgrade_trims_the_spaces_around_an_account_email(db_session):
    """'  ana@example.com ' pasa a 'ana@example.com'."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add(User(email="  ana@example.com "))
        db_session.flush()

        upgrade(db_session)

        assert stored_user_emails(db_session) == ["ana@example.com"]
    finally:
        db_session.rollback()


# SDD: 019 REQ-001 AC-001.2
def test_upgrade_lowercases_and_trims_an_account_email(db_session):
    """' Ana@Example.COM' pasa a 'ana@example.com'."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add(User(email=" Ana@Example.COM"))
        db_session.flush()

        upgrade(db_session)

        assert stored_user_emails(db_session) == ["ana@example.com"]
    finally:
        db_session.rollback()


# SDD: 019 REQ-001 AC-001.3
def test_upgrade_keeps_every_other_column_of_accounts_untouched(db_session):
    """La cuenta canónica queda idéntica fila a fila, y la no canónica solo
    cambia el correo (también conserva updated_at)."""
    try:
        drop_canonical_email_checks(db_session.connection())
        canonical = User(
            email="luis@example.com",
            password_hash="hash-de-mentira-1",
            first_name="Luis",
            last_name="Gómez",
            date_of_birth=date(1985, 3, 4),
            google_id="g-luis",
            avatar_url="https://example.com/luis.png",
            onboarding_completed_at=datetime(2026, 2, 3, 4, 5, 6),
            created_at=datetime(2026, 1, 1, 1, 1, 1),
            updated_at=datetime(2026, 1, 2, 2, 2, 2),
        )
        dirty = User(
            email=" Ana@Example.com ",
            password_hash="hash-de-mentira-2",
            first_name="Ana",
            last_name="Pérez",
            date_of_birth=date(1990, 6, 15),
            google_id="g-ana",
            created_at=datetime(2026, 1, 1, 1, 1, 1),
            updated_at=datetime(2026, 1, 2, 2, 2, 2),
        )
        db_session.add_all([canonical, dirty])
        db_session.flush()
        canonical_id, dirty_id = canonical.id, dirty.id
        canonical_before = user_row(db_session, canonical_id)
        dirty_before = user_row(db_session, dirty_id)

        upgrade(db_session)

        assert user_row(db_session, canonical_id) == canonical_before
        dirty_after = user_row(db_session, dirty_id)
        assert dirty_after["email"] == "ana@example.com"
        assert {k: v for k, v in dirty_after.items() if k != "email"} == {
            k: v for k, v in dirty_before.items() if k != "email"
        }
    finally:
        db_session.rollback()


# ---------------------------------------------------------------- REQ-002

# SDD: 019 REQ-002 AC-002.1
def test_upgrade_fails_listing_conflicting_emails_exactly_as_stored(db_session):
    """'ana@example.com' y ' ana@example.com' chocan: RuntimeError con el
    mensaje de la spec, los correos entre comillas y nada modificado."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add_all(
            [
                User(email="ana@example.com"),
                User(email=" ana@example.com"),
                User(email="Otro@Example.com"),
            ]
        )
        db_session.flush()

        with pytest.raises(RuntimeError) as exc_info:
            upgrade(db_session)

        assert str(exc_info.value) == CONFLICT_PREFIX + '" ana@example.com", "ana@example.com"'
        assert stored_user_emails(db_session) == [
            " ana@example.com",
            "Otro@Example.com",
            "ana@example.com",
        ]
    finally:
        db_session.rollback()


# SDD: 019 REQ-002 AC-002.2
def test_upgrade_groups_conflicts_by_canonical_form_and_modifies_nothing(db_session):
    """'Ana@Example.com ' y 'ana@example.com' van en el mismo grupo; un segundo
    conflicto va en otro grupo separado por '; '."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add_all(
            [
                User(email="Ana@Example.com "),
                User(email="ana@example.com"),
                User(email="BEA@example.com"),
                User(email=" bea@example.com"),
            ]
        )
        db_session.flush()

        with pytest.raises(RuntimeError) as exc_info:
            upgrade(db_session)

        assert set(conflict_groups(str(exc_info.value))) == {
            frozenset(['"Ana@Example.com "', '"ana@example.com"']),
            frozenset(['"BEA@example.com"', '" bea@example.com"']),
        }
        assert stored_user_emails(db_session) == [
            " bea@example.com",
            "Ana@Example.com ",
            "BEA@example.com",
            "ana@example.com",
        ]
    finally:
        db_session.rollback()


# SDD: 019 REQ-002 AC-002.3
def test_failed_upgrade_creates_no_guarantee_and_leaves_requests_untouched(db_session):
    """Tras el fallo no existen las restricciones, la base acepta
    'Bea@Example.com' y la solicitud conserva su correo sucio."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add_all([User(email="ana@example.com"), User(email=" ana@example.com")])
        request_id = add_request(db_session, " Ana@Example.com")

        with pytest.raises(RuntimeError) as exc_info:
            upgrade(db_session)

        assert str(exc_info.value).startswith(CONFLICT_PREFIX)
        assert existing_canonical_email_checks(db_session.connection()) == []
        assert request_row(db_session, request_id)["email"] == " Ana@Example.com"
        db_session.add(User(email="Bea@Example.com"))
        db_session.flush()
        assert "Bea@Example.com" in stored_user_emails(db_session)
    finally:
        db_session.rollback()


# ---------------------------------------------------------------- REQ-003

# SDD: 019 REQ-003 AC-003.1
def test_upgrade_canonicalizes_a_request_email_and_keeps_its_other_fields(db_session):
    """' Ana@Example.com' pasa a 'ana@example.com'; fecha, enlace y estado igual."""
    try:
        drop_canonical_email_checks(db_session.connection())
        request_id = add_request(
            db_session,
            " Ana@Example.com",
            token_hash="a" * 64,
            used_at=datetime(2026, 1, 2, 3, 10, 0),
            invalidated_at=datetime(2026, 1, 2, 3, 20, 0),
        )
        before = request_row(db_session, request_id)

        upgrade(db_session)

        after = request_row(db_session, request_id)
        assert after["email"] == "ana@example.com"
        assert {k: v for k, v in after.items() if k != "email"} == {
            k: v for k, v in before.items() if k != "email"
        }
        assert after["created_at"] == CREATED_AT
        assert after["token_hash"] == "a" * 64
    finally:
        db_session.rollback()


# SDD: 019 REQ-003 AC-003.2
def test_upgrade_keeps_duplicate_requests_without_counting_them_as_conflict(db_session):
    """'ANA@example.com' y 'ana@example.com' se conservan, las dos canónicas."""
    try:
        drop_canonical_email_checks(db_session.connection())
        add_request(db_session, "ANA@example.com")
        add_request(db_session, "ana@example.com")

        upgrade(db_session)

        assert stored_request_emails(db_session) == ["ana@example.com", "ana@example.com"]
    finally:
        db_session.rollback()


# ---------------------------------------------------------------- REQ-004

# SDD: 019 REQ-004 AC-004.1
def test_guarantee_rejects_an_account_with_uppercase_email(db_session):
    """Insertar 'Ana@example.com' lanza IntegrityError de la restricción y no crea la cuenta."""
    try:
        drop_canonical_email_checks(db_session.connection())
        upgrade(db_session)

        with pytest.raises(IntegrityError) as exc_info:
            with db_session.begin_nested():
                db_session.add(User(email="Ana@example.com"))
                db_session.flush()

        assert USERS_CHECK in str(exc_info.value)
        assert stored_user_emails(db_session) == []
    finally:
        db_session.rollback()


# SDD: 019 REQ-004 AC-004.2
def test_guarantee_rejects_an_account_with_surrounding_spaces(db_session):
    """Insertar ' ana@example.com' lanza IntegrityError de la restricción."""
    try:
        drop_canonical_email_checks(db_session.connection())
        upgrade(db_session)

        with pytest.raises(IntegrityError) as exc_info:
            with db_session.begin_nested():
                db_session.add(User(email=" ana@example.com"))
                db_session.flush()

        assert USERS_CHECK in str(exc_info.value)
    finally:
        db_session.rollback()


# SDD: 019 REQ-004 AC-004.3
def test_guarantee_rejects_changing_an_account_email_to_non_canonical(db_session):
    """Cambiar el correo a 'ANA@example.com' falla y sigue 'ana@example.com'."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add(User(email="ana@example.com"))
        db_session.flush()
        upgrade(db_session)

        with pytest.raises(IntegrityError) as exc_info:
            with db_session.begin_nested():
                db_session.execute(
                    text("UPDATE public.users SET email = :new WHERE email = :old"),
                    {"new": "ANA@example.com", "old": "ana@example.com"},
                )

        assert USERS_CHECK in str(exc_info.value)
        assert stored_user_emails(db_session) == ["ana@example.com"]
    finally:
        db_session.rollback()


# SDD: 019 REQ-004 AC-004.4
def test_guarantee_rejects_a_request_with_non_canonical_email(db_session):
    """Insertar una solicitud con 'Ana@example.com ' lanza IntegrityError de la restricción."""
    try:
        drop_canonical_email_checks(db_session.connection())
        upgrade(db_session)

        with pytest.raises(IntegrityError) as exc_info:
            with db_session.begin_nested():
                add_request(db_session, "Ana@example.com ")

        assert RESET_REQUESTS_CHECK in str(exc_info.value)
        assert stored_request_emails(db_session) == []
    finally:
        db_session.rollback()


# SDD: 019 REQ-004 AC-004.5
def test_guarantee_accepts_a_canonical_account_email(db_session):
    """Insertar 'ana@example.com' se acepta y las dos restricciones existen."""
    try:
        drop_canonical_email_checks(db_session.connection())
        upgrade(db_session)

        db_session.add(User(email="ana@example.com"))
        db_session.flush()

        assert stored_user_emails(db_session) == ["ana@example.com"]
        assert existing_canonical_email_checks(db_session.connection()) == [
            RESET_REQUESTS_CHECK,
            USERS_CHECK,
        ]
    finally:
        db_session.rollback()


# ---------------------------------------------------------------- REQ-006

# SDD: 019 REQ-006 AC-006.1
def test_downgrade_removes_the_guarantee_without_touching_emails(db_session):
    """Tras upgrade y downgrade el correo sigue canónico y 'Bea@example.com' se acepta."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add(User(email=" Ana@example.com"))
        db_session.flush()
        upgrade(db_session)

        downgrade(db_session)

        assert stored_user_emails(db_session) == ["ana@example.com"]
        assert existing_canonical_email_checks(db_session.connection()) == []
        db_session.add(User(email="Bea@example.com"))
        db_session.flush()
        assert stored_user_emails(db_session) == ["Bea@example.com", "ana@example.com"]
    finally:
        db_session.rollback()


# SDD: 019 REQ-006 AC-006.2
def test_upgrade_again_on_canonical_data_changes_nothing_and_reactivates_guarantee(db_session):
    """upgrade, downgrade y upgrade sobre datos canónicos: sin error, correos
    iguales y la garantía vuelve a rechazar correos no canónicos."""
    try:
        drop_canonical_email_checks(db_session.connection())
        db_session.add(User(email="ana@example.com"))
        add_request(db_session, "ana@example.com")
        db_session.flush()
        upgrade(db_session)
        downgrade(db_session)

        upgrade(db_session)

        assert stored_user_emails(db_session) == ["ana@example.com"]
        assert stored_request_emails(db_session) == ["ana@example.com"]
        with pytest.raises(IntegrityError) as exc_info:
            with db_session.begin_nested():
                db_session.add(User(email="Bea@example.com"))
                db_session.flush()
        assert USERS_CHECK in str(exc_info.value)
    finally:
        db_session.rollback()
