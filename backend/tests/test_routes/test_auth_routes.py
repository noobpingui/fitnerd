"""Tests de INTEGRACION: usan `client` (el test client de Flask) para pegarle
a las rutas reales por HTTP, que a su vez llaman al service real, que a su
vez habla con la base de datos de test real (fitnerd_test) a traves del
repository real. A diferencia de los tests unitarios de
test_body_metric_service.py, aca no hay nada "falso" - se prueba que todas
las capas realmente se conectan bien entre si, tal como lo haria un
request real del frontend.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import pytest
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
WRONG_CREDENTIALS = {"error": "Correo o contraseña incorrectos"}
DUPLICATE = {"error": "Ya existe una cuenta con este correo"}


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
def test_register_rejects_an_email_matching_a_legacy_account_with_uppercase(
    client, app, legacy_email_schema
):
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
    """Correo con mayúsculas y contraseña errónea: 401 'Correo o contraseña incorrectos'."""
    post_register(client)

    response = post_login(client, email="ANA@example.com", password="Otra1234")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-005 AC-005.1
def test_login_finds_a_legacy_account_stored_with_uppercase(client, app, legacy_email_schema):
    """Cuenta guardada como 'Ana@Example.com': el login con 'ana@example.com' da 200."""
    insert_legacy_user(app, "Ana@Example.com", "Clave123")

    response = post_login(client, email="ana@example.com", password="Clave123")

    assert response.status_code == 200
    assert "token" in response.get_json()


# SDD: 014 REQ-009 AC-009.1
def test_login_with_a_password_of_73_bytes_returns_401(client):
    """Contraseña de 73 bytes: 401 'Correo o contraseña incorrectos', nunca 5xx."""
    post_register(client)

    response = post_login(client, email="ana@example.com", password="a" * 73)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.2
def test_login_without_password_returns_401(client):
    """Sin campo password: 401 'Correo o contraseña incorrectos'."""
    post_register(client)

    response = post_login(client, email="ana@example.com")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.3
def test_login_without_email_returns_401(client):
    """Sin campo email: 401 'Correo o contraseña incorrectos'."""
    response = post_login(client, password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.4
def test_login_with_a_numeric_email_returns_401(client):
    """Con email numérico: 401 'Correo o contraseña incorrectos'."""
    post_register(client)

    response = post_login(client, email=123, password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 014 REQ-009 AC-009.5
def test_login_with_a_numeric_password_returns_401(client):
    """Con password numérico: 401 'Correo o contraseña incorrectos'."""
    post_register(client)

    response = post_login(client, email="ana@example.com", password=12345678)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# ---------------------------------------------------------------- Spec 018

INVALID_REQUEST = {"error": "La petición no es válida"}
FIRST_NAME_REQUIRED = {"error": "El nombre es obligatorio"}
FIRST_NAME_TOO_LONG = {"error": "El nombre no puede superar los 100 caracteres"}
LAST_NAME_REQUIRED = {"error": "El apellido es obligatorio"}
LAST_NAME_TOO_LONG = {"error": "El apellido no puede superar los 100 caracteres"}
INVALID_DOB = {"error": "La fecha de nacimiento no es válida"}
FUTURE_DOB = {"error": "La fecha de nacimiento no puede ser futura"}
AGE_RANGE = {"error": "Debes tener entre 14 y 100 años"}

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

# Spec 020: instante fijado para los tests con fechas absolutas.
FIXED_NOW = datetime(2026, 10, 12, 12, 0, 0)


def years_ago(years, days=0):
    """Fecha ISO de hace `years` años contados desde hoy (UTC), más `days` días.
    El 29 de febrero cae en 28 de febrero si el año de destino no es bisiesto:
    con `days=0` da una edad de `years` años cumplidos y con `days=1` (cumple
    mañana) una edad de `years - 1`."""
    today = datetime.now(timezone.utc).date()
    try:
        anniversary = today.replace(year=today.year - years)
    except ValueError:
        anniversary = today.replace(year=today.year - years, day=28)
    return (anniversary + timedelta(days=days)).isoformat()


def stored_user(app, email="ana@example.com"):
    """Lee (nombre, apellido, fecha de nacimiento) guardados para `email`."""
    with app.app_context():
        user = db.session.scalar(select(User).where(User.email == email))
        return user.first_name, user.last_name, user.date_of_birth


def raw_bodies():
    """Cuerpos que no son un objeto JSON: (descripción, argumentos de client.post)."""
    return [
        ("text-plain", {"data": "hola", "content_type": "text/plain"}),
        ("malformed", {"data": '{"email": ', "content_type": "application/json"}),
        ("null", {"data": "null", "content_type": "application/json"}),
        ("list", {"json": [register_payload()]}),
        ("number", {"data": "5", "content_type": "application/json"}),
        ("string", {"data": '"texto"', "content_type": "application/json"}),
        ("no-body", {}),
    ]


# SDD: 018 REQ-001 AC-001.1
def test_register_rejects_a_plain_text_body(client, app):
    """Cuerpo 'hola' como text/plain: 400 'La petición no es válida' y sin cuentas."""
    response = client.post(REGISTER_URL, data="hola", content_type="text/plain")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert count_users(app) == 0


# SDD: 018 REQ-001 AC-001.2
def test_register_rejects_a_malformed_json_body(client, app):
    """JSON malformado con tipo application/json: 400 'La petición no es válida'."""
    response = client.post(REGISTER_URL, data='{"email": ', content_type="application/json")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert count_users(app) == 0


# SDD: 018 REQ-001 AC-001.3
def test_register_rejects_a_null_body(client, app):
    """El JSON `null`: 400 'La petición no es válida'."""
    response = client.post(REGISTER_URL, data="null", content_type="application/json")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert count_users(app) == 0


# SDD: 018 REQ-001 AC-001.4
def test_register_rejects_a_list_with_a_valid_payload_inside(client, app):
    """Una lista con un registro válido dentro: 400 y no se crea ninguna cuenta."""
    response = client.post(REGISTER_URL, json=[register_payload()])

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert count_users(app) == 0


# SDD: 018 REQ-001 AC-001.5
def test_register_rejects_a_request_without_body(client, app):
    """Sin cuerpo: 400 'La petición no es válida'."""
    response = client.post(REGISTER_URL)

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert count_users(app) == 0


# SDD: 018 REQ-002 AC-002.1
def test_login_rejects_a_plain_text_body_without_a_token(client):
    """Con la cuenta creada, un cuerpo text/plain da 400 y no emite token."""
    assert post_register(client).status_code == 201

    response = client.post(LOGIN_URL, data="ana@example.com", content_type="text/plain")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST
    assert "token" not in response.get_json()


# SDD: 018 REQ-002 AC-002.2
def test_login_rejects_a_malformed_json_body(client):
    """JSON malformado con tipo application/json: 400 'La petición no es válida'."""
    response = client.post(LOGIN_URL, data='{"email": ', content_type="application/json")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# SDD: 018 REQ-002 AC-002.3
def test_login_rejects_a_null_body(client):
    """El JSON `null`: 400 'La petición no es válida'."""
    response = client.post(LOGIN_URL, data="null", content_type="application/json")

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# SDD: 018 REQ-002 AC-002.4
def test_login_rejects_a_list_body(client):
    """Una lista JSON: 400 'La petición no es válida'."""
    response = client.post(LOGIN_URL, json=[{"email": "ana@example.com", "password": "Clave123"}])

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# SDD: 018 REQ-002 AC-002.5
def test_login_with_an_empty_object_is_still_a_401(client):
    """`{}` sigue dando 401 'Correo o contraseña incorrectos', no 400."""
    response = post_login(client)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 018 REQ-003 AC-003.1
def test_register_rejects_a_missing_first_name(client, app):
    """Sin first_name: 400 'El nombre es obligatorio' y sin cuenta."""
    payload = register_payload()
    del payload["first_name"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_REQUIRED
    assert count_users(app) == 0


# SDD: 018 REQ-003 AC-003.2
def test_register_rejects_a_blank_first_name(client):
    """first_name '   ': 400 'El nombre es obligatorio'."""
    response = post_register(client, first_name="   ")

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_REQUIRED


# SDD: 018 REQ-003 AC-003.3
@pytest.mark.parametrize("value", [123, None])
def test_register_rejects_a_non_text_first_name(client, value):
    """first_name numérico o null: 400 'El nombre es obligatorio', nunca 5xx."""
    response = post_register(client, first_name=value)

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_REQUIRED


# SDD: 018 REQ-003 AC-003.4
def test_register_rejects_a_first_name_of_101_characters(client, app):
    """101 caracteres: 400 'El nombre no puede superar los 100 caracteres'."""
    response = post_register(client, first_name="a" * 101)

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_TOO_LONG
    assert count_users(app) == 0


# SDD: 018 REQ-003 AC-003.5
def test_register_accepts_a_first_name_of_100_characters_surrounded_by_spaces(client, app):
    """100 caracteres entre espacios: 201 y se guardan los 100 caracteres sin espacios."""
    response = post_register(client, first_name="  " + "a" * 100 + "  ")

    assert response.status_code == 201
    assert stored_user(app)[0] == "a" * 100


# SDD: 018 REQ-003 AC-003.6
def test_register_stores_the_first_name_trimmed(client, app):
    """'  María José ': 201 y se guarda 'María José'."""
    response = post_register(client, first_name="  María José ")

    assert response.status_code == 201
    assert stored_user(app)[0] == "María José"


# SDD: 018 REQ-003 AC-003.7
def test_register_rejects_a_first_name_of_300_characters_without_a_server_error(client):
    """300 caracteres: 400 de nombre demasiado largo, nunca 5xx."""
    response = post_register(client, first_name="a" * 300)

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_TOO_LONG


# SDD: 018 REQ-004 AC-004.1
def test_register_rejects_a_missing_last_name(client, app):
    """Sin last_name: 400 'El apellido es obligatorio' y sin cuenta."""
    payload = register_payload()
    del payload["last_name"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == LAST_NAME_REQUIRED
    assert count_users(app) == 0


# SDD: 018 REQ-004 AC-004.2
@pytest.mark.parametrize("value", ["", "   "])
def test_register_rejects_an_empty_or_blank_last_name(client, value):
    """last_name '' o '   ': 400 'El apellido es obligatorio'."""
    response = post_register(client, last_name=value)

    assert response.status_code == 400
    assert response.get_json() == LAST_NAME_REQUIRED


# SDD: 018 REQ-004 AC-004.3
@pytest.mark.parametrize("value", [123, None])
def test_register_rejects_a_non_text_last_name(client, value):
    """last_name numérico o null: 400 'El apellido es obligatorio', nunca 5xx."""
    response = post_register(client, last_name=value)

    assert response.status_code == 400
    assert response.get_json() == LAST_NAME_REQUIRED


# SDD: 018 REQ-004 AC-004.4
def test_register_rejects_a_last_name_of_101_characters(client):
    """101 caracteres: 400 'El apellido no puede superar los 100 caracteres'."""
    response = post_register(client, last_name="a" * 101)

    assert response.status_code == 400
    assert response.get_json() == LAST_NAME_TOO_LONG


# SDD: 018 REQ-004 AC-004.5
def test_register_stores_the_last_name_trimmed(client, app):
    """' Pérez  ': 201 y se guarda 'Pérez'."""
    response = post_register(client, last_name=" Pérez  ")

    assert response.status_code == 201
    assert stored_user(app)[1] == "Pérez"


# SDD: 018 REQ-005 AC-005.1
def test_register_rejects_a_missing_date_of_birth(client, app):
    """Sin date_of_birth: 400 'La fecha de nacimiento no es válida' y sin cuenta."""
    payload = register_payload()
    del payload["date_of_birth"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == INVALID_DOB
    assert count_users(app) == 0


# SDD: 018 REQ-005 AC-005.2
@pytest.mark.parametrize("value", [None, "", 19900101, "1990/01/01", "no-es-fecha"])
def test_register_rejects_a_malformed_date_of_birth(client, value):
    """null, '', numérica o con formato erróneo: 400 'no es válida', nunca 5xx."""
    response = post_register(client, date_of_birth=value)

    assert response.status_code == 400
    assert response.get_json() == INVALID_DOB


# SDD: 018 REQ-005 AC-005.3
def test_register_rejects_a_date_of_birth_that_does_not_exist(client):
    """'2001-02-30': 400 'La fecha de nacimiento no es válida'."""
    response = post_register(client, date_of_birth="2001-02-30")

    assert response.status_code == 400
    assert response.get_json() == INVALID_DOB


# SDD: 018 REQ-005 AC-005.4
def test_register_rejects_a_date_of_birth_tomorrow(client, app_clock):
    """Mañana (UTC): 400 'La fecha de nacimiento no puede ser futura'.
    Instante fijado: 2026-10-12 12:00 UTC (spec 020)."""
    app_clock.set(FIXED_NOW)

    response = post_register(client, date_of_birth="2026-10-13")

    assert response.status_code == 400
    assert response.get_json() == FUTURE_DOB


# SDD: 018 REQ-005 AC-005.5
def test_register_rejects_someone_who_turns_14_tomorrow(client, app_clock):
    """13 años cumplidos hoy: 400 'Debes tener entre 14 y 100 años'.
    Instante fijado: 2026-10-12 12:00 UTC (spec 020)."""
    app_clock.set(FIXED_NOW)

    response = post_register(client, date_of_birth="2012-10-13")

    assert response.status_code == 400
    assert response.get_json() == AGE_RANGE


# SDD: 018 REQ-005 AC-005.6
def test_register_accepts_someone_who_turns_14_today(client, app_clock):
    """Cumple 14 hoy: 201. Instante fijado: 2026-10-12 12:00 UTC (spec 020)."""
    app_clock.set(FIXED_NOW)

    response = post_register(client, date_of_birth="2012-10-12")

    assert response.status_code == 201


# SDD: 018 REQ-005 AC-005.7
def test_register_rejects_someone_of_101_years(client, app_clock):
    """101 años cumplidos hoy: 400 'Debes tener entre 14 y 100 años'.
    Instante fijado: 2026-10-12 12:00 UTC (spec 020)."""
    app_clock.set(FIXED_NOW)

    response = post_register(client, date_of_birth="1925-10-12")

    assert response.status_code == 400
    assert response.get_json() == AGE_RANGE


# SDD: 018 REQ-005 AC-005.8
def test_register_accepts_100_years_and_the_profile_returns_the_date(client, app_clock):
    """100 años cumplidos hoy (cumple 101 mañana): 201 y /api/profile devuelve la fecha.
    Instante fijado: 2026-10-12 12:00 UTC (spec 020)."""
    app_clock.set(FIXED_NOW)
    dob = "1925-10-13"

    response = post_register(client, date_of_birth=dob)

    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.get_json()['token']}"}
    profile = client.get("/api/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.get_json()["date_of_birth"] == dob


# SDD: 018 REQ-006 AC-006.1
def test_register_validates_the_email_before_the_first_name(client):
    """Correo inválido y sin nombre: gana 'Email inválido'.

    El nombre ausente se rechaza por sí solo.
    """
    only_missing_name = register_payload()
    del only_missing_name["first_name"]
    assert client.post(REGISTER_URL, json=only_missing_name).get_json() == FIRST_NAME_REQUIRED

    payload = register_payload(email="no-es-un-correo")
    del payload["first_name"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == INVALID_EMAIL


# SDD: 018 REQ-006 AC-006.2
def test_register_validates_the_password_before_the_first_name(client):
    """Contraseña corta y sin nombre: gana el mensaje de contraseña.

    El nombre ausente se rechaza por sí solo.
    """
    only_missing_name = register_payload()
    del only_missing_name["first_name"]
    assert client.post(REGISTER_URL, json=only_missing_name).get_json() == FIRST_NAME_REQUIRED

    payload = register_payload(password="corta")
    del payload["first_name"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == TOO_SHORT


# SDD: 018 REQ-006 AC-006.3
def test_register_validates_the_first_name_before_the_rest(client):
    """Sin nombre, apellido ni fecha: gana 'El nombre es obligatorio'."""
    response = client.post(REGISTER_URL, json={"email": "ana@example.com", "password": "Clave123"})

    assert response.status_code == 400
    assert response.get_json() == FIRST_NAME_REQUIRED


# SDD: 018 REQ-006 AC-006.4
def test_register_validates_the_last_name_before_the_date_of_birth(client):
    """Sin apellido y con fecha futura: gana 'El apellido es obligatorio'."""
    tomorrow = (datetime.now(timezone.utc).date() + timedelta(days=2)).isoformat()
    payload = register_payload(date_of_birth=tomorrow)
    del payload["last_name"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == LAST_NAME_REQUIRED


# SDD: 018 REQ-006 AC-006.5
def test_register_validates_the_date_of_birth_before_the_duplicate_check(client):
    """Cuenta existente y registro sin fecha: 400 de fecha, no 409."""
    assert post_register(client).status_code == 201
    payload = register_payload()
    del payload["date_of_birth"]

    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 400
    assert response.get_json() == INVALID_DOB


# SDD: 018 REQ-007 AC-007.1
def test_login_with_a_wrong_password_returns_the_spanish_message(client):
    """Contraseña errónea: 401 'Correo o contraseña incorrectos'."""
    post_register(client)

    response = post_login(client, email="ana@example.com", password="Otra1234")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.2
def test_login_with_an_unknown_email_returns_the_spanish_message(client):
    """Correo inexistente: 401 'Correo o contraseña incorrectos'."""
    response = post_login(client, email="nadie@example.com", password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.3
def test_login_to_a_google_account_returns_the_spanish_message(client, app):
    """Cuenta de Google sin contraseña: 401 'Correo o contraseña incorrectos'."""
    with app.app_context():
        db.session.add(
            User(email="ana@example.com", password_hash=None, google_id="g-1", first_name="Ana")
        )
        db.session.commit()

    response = post_login(client, email="ana@example.com", password="Clave123")

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.4
@pytest.mark.parametrize(
    "body",
    [
        {"email": 123, "password": "Clave123"},
        {"email": "ana@example.com"},
        {"email": "ana@example.com", "password": "a" * 73},
    ],
)
def test_login_with_anomalous_data_returns_the_spanish_message(client, body):
    """Correo numérico, sin contraseña o de 73 bytes: 401 con el mismo mensaje."""
    post_register(client)

    response = post_login(client, **body)

    assert response.status_code == 401
    assert response.get_json() == WRONG_CREDENTIALS


# SDD: 018 REQ-008 AC-008.1
def test_register_a_duplicate_email_returns_the_spanish_message(client, app):
    """Registrar de nuevo 'ana@example.com': 409 en español y sigue habiendo una cuenta."""
    assert post_register(client).status_code == 201

    response = post_register(client)

    assert response.status_code == 409
    assert response.get_json() == DUPLICATE
    assert count_users(app) == 1


# SDD: 018 REQ-008 AC-008.2
def test_register_a_duplicate_email_in_uppercase_returns_the_spanish_message(client):
    """'ANA@example.com' con 'ana@example.com' existente: 409 en español."""
    assert post_register(client).status_code == 201

    response = post_register(client, email="ANA@example.com")

    assert response.status_code == 409
    assert response.get_json() == DUPLICATE


REGISTER_FIELD_ERRORS = {
    "email": INVALID_EMAIL,
    "password": TOO_SHORT,
    "first_name": FIRST_NAME_REQUIRED,
    "last_name": LAST_NAME_REQUIRED,
    "date_of_birth": INVALID_DOB,
}


def anomalous_requests(url, valid_body, field_errors, empty_object_status, empty_object_error):
    """Batería de peticiones anómalas para `url`: (id, argumentos de client.post,
    estado esperado, error esperado). Cada caso lleva su respuesta exacta."""
    endpoint = url.rsplit("/", 1)[1]
    cases = [
        (f"raw-{name}", kwargs, 400, INVALID_REQUEST) for name, kwargs in raw_bodies()
    ]
    cases.append(("empty-object", {"json": {}}, empty_object_status, empty_object_error))
    for field in valid_body:
        for label, replacement in (("number", 123), ("null", None), ("list", [])):
            kwargs = {"json": {**valid_body, field: replacement}}
            cases.append((f"{field}-{label}", kwargs, empty_object_status, field_errors[field]))
    return [
        pytest.param(url, kwargs, status, error, id=f"{endpoint}-{case_id}")
        for case_id, kwargs, status, error in cases
    ]


LOGIN_BODY = {"email": "ana@example.com", "password": "Clave123"}
FORBIDDEN_TEXTS = ("Wrong Credentials", "Email already registered", "Content-Type", "content type")


# SDD: 018 NFR-001 AC-N001.1
@pytest.mark.parametrize(
    "url, kwargs, status, error",
    anomalous_requests(REGISTER_URL, register_payload(), REGISTER_FIELD_ERRORS, 400, INVALID_EMAIL)
    + anomalous_requests(
        LOGIN_URL,
        LOGIN_BODY,
        {"email": WRONG_CREDENTIALS, "password": WRONG_CREDENTIALS},
        401,
        WRONG_CREDENTIALS,
    ),
)
def test_anomalous_bodies_never_cause_a_server_error(client, url, kwargs, status, error):
    """Cada petición anómala da el 400/401 esperado.

    El mensaje va en español y sin textos en inglés.
    """
    post_register(client, email="otra@example.com")

    response = client.post(url, **kwargs)

    assert response.status_code == status
    body = response.get_json()
    assert body == error
    for text in FORBIDDEN_TEXTS:
        assert text.lower() not in body["error"].lower()
