"""Tests de INTEGRACION: usan `client` (el test client de Flask) para pegarle
a las rutas reales por HTTP, que a su vez llaman al service real, que a su
vez habla con la base de datos de test real (fitnerd_test) a traves del
repository real. A diferencia de los tests unitarios de
test_body_metric_service.py, aca no hay nada "falso" - se prueba que todas
las capas realmente se conectan bien entre si, tal como lo haria un
request real del frontend.
"""


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
