"""Tests de INTEGRACION de la spec 019: con la garantía de correo canónico
activa en la base de pruebas (la crean los modelos con `create_all()`), el
registro, el login y el restablecimiento siguen aceptando correos con
mayúsculas o espacios y los guardan canónicos. También se comprueba que una
cuenta antigua migrada puede entrar con su correo normal.

El correo sale por el transporte "memory" (`email_sender.transport.outbox`),
nunca por la red.
"""

import bcrypt
from sqlalchemy import func, select, text

from extensions import db, email_sender
from models.password_reset_request import PasswordResetRequest
from models.user import User
from tests.migration_helpers import (
    CANONICAL_EMAILS_MIGRATION,
    drop_canonical_email_checks,
    existing_canonical_email_checks,
    run_upgrade,
)

PASSWORD = "Clave123"
DUPLICATE = {"error": "Ya existe una cuenta con este correo"}
ACCEPTED = {
    "message": (
        "Si el correo pertenece a una cuenta con contraseña, "
        "recibirás un enlace para restablecerla."
    )
}
FORGOT_IP = "10.19.0.1"


def register_payload(**overrides):
    payload = {
        "email": "ana@example.com",
        "password": PASSWORD,
        "first_name": "Ana",
        "last_name": "Pérez",
        "date_of_birth": "1990-01-01",
    }
    payload.update(overrides)
    return payload


def post_register(client, **overrides):
    return client.post("/api/auth/register", json=register_payload(**overrides))


def post_login(client, email):
    return client.post("/api/auth/login", json={"email": email, "password": PASSWORD})


def me_id(client, token):
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.get_json()["id"]


def assert_guarantee_is_active(app):
    """Precondición: la base de pruebas tiene la restricción del modelo."""
    with app.app_context():
        names = existing_canonical_email_checks(db.session.connection())
        db.session.rollback()
    assert "ck_users_email_canonical" in names


def stored_emails(app):
    with app.app_context():
        return sorted(db.session.scalars(select(User.email)).all())


def count_users(app):
    with app.app_context():
        return db.session.scalar(select(func.count()).select_from(User))


# SDD: 019 REQ-001 AC-001.4
def test_login_works_after_migrating_an_old_account_stored_with_a_leading_space(client, app):
    """Cuenta guardada como ' ana@example.com' y migrada: el login con
    'ana@example.com' da 200 y el token es de esa cuenta."""
    hashed = bcrypt.hashpw(PASSWORD.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")
    with app.app_context():
        try:
            drop_canonical_email_checks(db.session.connection())
            user = User(email=" ana@example.com", password_hash=hashed, first_name="Ana")
            db.session.add(user)
            db.session.flush()
            user_id = str(user.id)
            run_upgrade(db.session.connection(), CANONICAL_EMAILS_MIGRATION)
            db.session.commit()
        finally:
            db.session.rollback()

    response = post_login(client, "ana@example.com")

    assert response.status_code == 200
    assert me_id(client, response.get_json()["token"]) == user_id
    assert stored_emails(app) == ["ana@example.com"]


# SDD: 019 REQ-005 AC-005.1
def test_register_with_uppercase_and_spaces_stores_the_canonical_email(client, app):
    """Registrar ' Ana@Example.com ' da 201 y la fila guarda 'ana@example.com'."""
    assert_guarantee_is_active(app)

    response = post_register(client, email=" Ana@Example.com ")

    assert response.status_code == 201
    assert stored_emails(app) == ["ana@example.com"]


# SDD: 019 REQ-005 AC-005.2
def test_login_with_uppercase_and_leading_space_finds_the_registered_account(client, app):
    """Cuenta 'ana@example.com': el login con ' ANA@example.com' da 200 con su token."""
    assert_guarantee_is_active(app)
    registered = post_register(client)
    assert registered.status_code == 201

    response = post_login(client, " ANA@example.com")

    assert response.status_code == 200
    assert me_id(client, response.get_json()["token"]) == me_id(
        client, registered.get_json()["token"]
    )


# SDD: 019 REQ-005 AC-005.3
def test_register_with_a_case_variant_of_an_existing_email_returns_409(client, app):
    """Registrar 'Ana@Example.com' con 'ana@example.com' existente: 409 y una sola cuenta."""
    assert_guarantee_is_active(app)
    assert post_register(client).status_code == 201

    response = post_register(client, email="Ana@Example.com")

    assert response.status_code == 409
    assert response.get_json() == DUPLICATE
    assert count_users(app) == 1


# SDD: 019 REQ-005 AC-005.5
def test_forgot_password_with_uppercase_and_spaces_sends_mail_and_stores_canonical(client, app):
    """' ANA@example.com ': 200 como hoy, un correo a ana@example.com y la
    solicitud guardada con 'ana@example.com'."""
    assert_guarantee_is_active(app)
    assert post_register(client).status_code == 201

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": " ANA@example.com "},
        headers={"X-Forwarded-For": FORGOT_IP},
    )

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert [message.to for message in email_sender.transport.outbox] == ["ana@example.com"]
    with app.app_context():
        rows = db.session.execute(select(PasswordResetRequest.email)).all()
        assert [row[0] for row in rows] == ["ana@example.com"]
        count = db.session.execute(
            text("SELECT count(*) FROM public.password_reset_requests")
        ).scalar_one()
        assert count == 1
