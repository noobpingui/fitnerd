"""Tests de INTEGRACION: usan `client` (el test client de Flask) para pegarle
a las rutas reales por HTTP, que a su vez llaman al service real, que a su
vez habla con la base de datos de test real (fitnerd_test) a traves del
repository real. A diferencia de los tests unitarios de
test_body_metric_service.py, aca no hay nada "falso" - se prueba que todas
las capas realmente se conectan bien entre si, tal como lo haria un
request real del frontend.
"""

import bcrypt
from sqlalchemy import func, select

from extensions import db
from models.user import User


def test_register_creates_a_user_and_returns_a_token(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "nueva@example.com",
            "password": "password123",
            "first_name": "Nueva",
            "last_name": "Usuaria",
            "date_of_birth": "1995-05-20",
        },
    )

    assert response.status_code == 201
    assert "token" in response.get_json()


def test_register_rejects_a_duplicate_email(client):
    payload = {
        "email": "repetido@example.com",
        "password": "password123",
        "first_name": "Una",
        "last_name": "Persona",
        "date_of_birth": "1990-01-01",
    }

    first_attempt = client.post("/api/auth/register", json=payload)
    assert first_attempt.status_code == 201

    second_attempt = client.post("/api/auth/register", json=payload)
    assert second_attempt.status_code == 409


def test_login_with_the_wrong_password_fails(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "login@example.com",
            "password": "correcta123",
            "first_name": "Login",
            "last_name": "Test",
            "date_of_birth": "1990-01-01",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "incorrecta"},
    )

    assert response.status_code == 401


def test_login_with_the_right_credentials_returns_a_token(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "login2@example.com",
            "password": "correcta123",
            "first_name": "Login",
            "last_name": "Test",
            "date_of_birth": "1990-01-01",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "login2@example.com", "password": "correcta123"},
    )

    assert response.status_code == 200
    assert "token" in response.get_json()


def test_me_without_a_token_is_rejected(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_with_a_valid_token_returns_the_current_user(client, registered_user):
    response = client.get("/api/auth/me", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.get_json()["email"] == "test@example.com"


# ---------------------------------------------------------------- Spec 014

TOO_SHORT = {"error": "La contraseña debe tener al menos 8 caracteres"}
TOO_LONG = {"error": "La contraseña es demasiado larga"}
INVALID_EMAIL = {"error": "Email inválido"}
WRONG_CREDENTIALS = {"error": "Wrong Credentials"}
DUPLICATE = {"error": "Email already registered"}


def register_payload(**overrides):
    payload = {
        "email": "ana@example.com",
        "password": "Clave123",
        "first_name": "Ana",
        "last_name": "Pérez",
        "date_of_birth": "1990-01-01",
    }
    payload.update(overrides)
    return payload


def post_register(client, **overrides):
    return client.post("/api/auth/register", json=register_payload(**overrides))


def post_login(client, **body):
    return client.post("/api/auth/login", json=body)


def count_users(app):
    with app.app_context():
        return db.session.scalar(select(func.count()).select_from(User))


def insert_legacy_user(app, email, password):
    """Cuenta anterior a la spec 014: correo guardado tal cual, con mayúsculas."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")
    with app.app_context():
        db.session.add(User(email=email, password_hash=hashed, first_name="Ana"))
        db.session.commit()


# SDD: 014 REQ-001 AC-001.1
def test_register_stores_and_returns_the_email_trimmed_and_lowercase(client):
    """Registrar '  Ana@Example.COM ' da 201 y /me devuelve 'ana@example.com'."""
    response = post_register(client, email="  Ana@Example.COM ")

    assert response.status_code == 201
    token = response.get_json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.get_json()["email"] == "ana@example.com"


# SDD: 014 REQ-001 AC-001.2
def test_register_rejects_a_duplicate_email_that_differs_only_in_case(client, app):
    """Registrar 'ANA@example.com' con 'ana@example.com' existente da 409 y no crea cuenta."""
    assert post_register(client).status_code == 201

    response = post_register(client, email="ANA@example.com")

    assert response.status_code == 409
    assert response.get_json() == DUPLICATE
    assert count_users(app) == 1


# SDD: 014 REQ-005 AC-005.2
def test_register_rejects_an_email_matching_a_legacy_account_with_uppercase(client, app):
    """Con una cuenta guardada como 'Ana@Example.com', registrar 'ana@example.com' da 409."""
    insert_legacy_user(app, "Ana@Example.com", "Clave123")

    response = post_register(client, email="ana@example.com")

    assert response.status_code == 409
    assert count_users(app) == 1


# SDD: 014 REQ-006 AC-006.1
def test_register_rejects_a_short_password_and_creates_no_account(client):
    """Contraseña 'corta': 400 con el mensaje de mínimo y el login posterior da 401."""
    response = post_register(client, password="corta")

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT
    assert post_login(client, email="ana@example.com", password="corta").status_code == 401


# SDD: 014 REQ-006 AC-006.2
def test_register_rejects_a_missing_password(client):
    """Sin campo password: 400 con el mensaje de mínimo."""
    payload = register_payload()
    del payload["password"]

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT


# SDD: 014 REQ-006 AC-006.3
def test_register_rejects_a_numeric_password(client):
    """Con password numérico: 400 con el mensaje de mínimo, nunca 5xx."""
    response = post_register(client, password=12345678)

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT


# SDD: 014 REQ-006 AC-006.4
def test_register_accepts_a_password_of_exactly_8_characters(client):
    """'Clave123' da 201 y el login con ella funciona."""
    assert post_register(client, password="Clave123").status_code == 201

    assert post_login(client, email="ana@example.com", password="Clave123").status_code == 200


# SDD: 014 REQ-006 AC-006.5
def test_register_rejects_a_password_of_73_bytes(client):
    """73 bytes: 400 de demasiado larga y el login posterior da 401."""
    password = "a" * 73

    response = post_register(client, password=password)

    assert response.status_code == 400
    assert response.get_json() == TOO_LONG
    assert post_login(client, email="ana@example.com", password=password).status_code == 401


# SDD: 014 REQ-006 AC-006.6
def test_register_accepts_a_password_of_72_bytes(client):
    """72 bytes exactos: 201 y el login funciona."""
    password = "a" * 72
    assert post_register(client, password=password).status_code == 201

    assert post_login(client, email="ana@example.com", password=password).status_code == 200


# SDD: 014 REQ-006 AC-006.7
def test_register_rejects_37_enyes_that_are_74_bytes(client, app):
    """37 'ñ' (74 bytes): 400 de demasiado larga, nunca 5xx, sin cuenta."""
    response = post_register(client, password="ñ" * 37)

    assert response.status_code == 400
    assert response.get_json() == TOO_LONG
    assert count_users(app) == 0


# SDD: 014 REQ-006 AC-006.8
def test_register_accepts_36_enyes_that_are_72_bytes(client):
    """36 'ñ' (72 bytes exactos): 201 y el login funciona."""
    password = "ñ" * 36
    assert post_register(client, password=password).status_code == 201

    assert post_login(client, email="ana@example.com", password=password).status_code == 200


# SDD: 014 REQ-006 AC-006.9
def test_register_counts_an_emoji_as_one_character(client):
    """7 emojis son 7 caracteres: 400 de mínimo."""
    response = post_register(client, password="😀" * 7)

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT


# SDD: 014 REQ-006 AC-006.10
def test_register_validates_the_password_before_the_duplicate_check(client):
    """Con la cuenta ya existente y contraseña 'corta', gana el 400 de contraseña."""
    assert post_register(client).status_code == 201

    response = post_register(client, password="corta")

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT


# SDD: 014 REQ-007 AC-007.1
def test_register_rejects_a_missing_email(client):
    """Sin campo email: 400 'Email inválido'."""
    payload = register_payload()
    del payload["email"]

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    assert response.get_json() == INVALID_EMAIL


# SDD: 014 REQ-007 AC-007.2
def test_register_rejects_an_email_without_email_format(client, app):
    """'no-es-un-correo': 400 'Email inválido' y no se crea cuenta."""
    response = post_register(client, email="no-es-un-correo")

    assert response.status_code == 400
    assert response.get_json() == INVALID_EMAIL
    assert count_users(app) == 0


# SDD: 014 REQ-007 AC-007.3
def test_register_validates_the_email_before_the_password(client):
    """Correo inválido y contraseña corta: gana 'Email inválido'."""
    response = post_register(client, email="no-es-un-correo", password="corta")

    assert response.status_code == 400
    assert response.get_json() == INVALID_EMAIL


# SDD: 014 REQ-007 AC-007.4
def test_register_rejects_a_numeric_email(client):
    """Con email numérico: 400 'Email inválido', nunca 5xx."""
    response = post_register(client, email=123)

    assert response.status_code == 400
    assert response.get_json() == INVALID_EMAIL


# SDD: 014 REQ-002 AC-002.1
def test_login_accepts_an_email_with_different_case(client):
    """Cuenta 'ana@example.com': el login con 'ANA@Example.com' da 200 con token."""
    post_register(client)

    response = post_login(client, email="ANA@Example.com", password="Clave123")

    assert response.status_code == 200
    assert "token" in response.get_json()


# SDD: 014 REQ-002 AC-002.2
def test_login_accepts_an_email_with_surrounding_spaces(client):
    """El login con ' ana@example.com  ' da 200 con token."""
    post_register(client)

    response = post_login(client, email=" ana@example.com  ", password="Clave123")

    assert response.status_code == 200
    assert "token" in response.get_json()


# SDD: 014 REQ-002 AC-002.3
def test_login_with_uppercase_email_and_wrong_password_returns_401(client):
    """Correo con mayúsculas y contraseña errónea: 401 'Wrong Credentials'."""
    post_register(client)

    response = post_login(client, email="ANA@example.com", password="Otra1234")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-005 AC-005.1
def test_login_finds_a_legacy_account_stored_with_uppercase(client, app):
    """Cuenta guardada como 'Ana@Example.com': el login con 'ana@example.com' da 200."""
    insert_legacy_user(app, "Ana@Example.com", "Clave123")

    response = post_login(client, email="ana@example.com", password="Clave123")

    assert response.status_code == 200
    assert "token" in response.get_json()


# SDD: 014 REQ-009 AC-009.1
def test_login_with_a_password_of_73_bytes_returns_401(client):
    """Contraseña de 73 bytes: 401 'Wrong Credentials', nunca 5xx."""
    post_register(client)

    response = post_login(client, email="ana@example.com", password="a" * 73)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.2
def test_login_without_password_returns_401(client):
    """Sin campo password: 401 'Wrong Credentials'."""
    post_register(client)

    response = post_login(client, email="ana@example.com")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.3
def test_login_without_email_returns_401(client):
    """Sin campo email: 401 'Wrong Credentials'."""
    response = post_login(client, password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.4
def test_login_with_a_numeric_email_returns_401(client):
    """Con email numérico: 401 'Wrong Credentials'."""
    post_register(client)

    response = post_login(client, email=123, password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.5
def test_login_with_a_numeric_password_returns_401(client):
    """Con password numérico: 401 'Wrong Credentials'."""
    post_register(client)

    response = post_login(client, email="ana@example.com", password=12345678)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS
