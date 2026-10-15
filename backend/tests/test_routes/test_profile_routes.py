"""Tests de INTEGRACION de GET/PUT /api/profile: cliente HTTP real contra la
app, el service y los repositories reales y Postgres de test. Las fechas de
nacimiento validas estan lejos de los limites de edad (los limites exactos se
prueban en los unitarios con un reloj fijo).
"""

import json
from datetime import datetime

import pytest

from extensions import db, jwt_manager
from models.user import User

PROFILE_BODY = {
    "date_of_birth": "1990-06-15",
    "gender": "male",
    "height_unit": "cm",
    "height_cm": 175.5,
    "weight_unit": "kg",
    "weight": 72.5,
    "activity_level": "moderate",
    "goal": "maintain",
}
FT_LB_BODY = {
    "date_of_birth": "1990-06-15",
    "gender": "female",
    "height_unit": "ft",
    "height_ft": 5,
    "height_in": 9,
    "weight_unit": "lb",
    "weight": 160,
    "activity_level": "high",
    "goal": "lose_slow",
}
NO_PROFILE = {
    "onboarding_completed": False,
    "onboarding_completed_at": None,
    "date_of_birth": None,
    "profile": None,
}


def body(**overrides):
    data = dict(PROFILE_BODY)
    data.update(overrides)
    return data


def create_user(app, email, date_of_birth=None):
    """Crea un usuario directamente (sin pasar por el registro), como una
    cuenta de Google sin fecha de nacimiento, y devuelve sus cabeceras."""
    with app.app_context():
        user = User(email=email, date_of_birth=date_of_birth)
        db.session.add(user)
        db.session.commit()
        token = jwt_manager.generate_token({"id": str(user.id), "user_role": "user"}, 30)
        user_id = str(user.id)
    return {"id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def get_profile(client, headers):
    return client.get("/api/profile", headers=headers)


def read_profile(client, headers):
    """GET /api/profile comprobando el 200 antes de leer el cuerpo."""
    response = get_profile(client, headers)
    assert response.status_code == 200
    return response.get_json()


def put_profile(client, headers, payload):
    return client.put("/api/profile", json=payload, headers=headers)


# SDD: REQ-001 AC-001.1
def test_get_returns_the_saved_profile(client, registered_user):
    """Tras un PUT, el GET devuelve exactamente lo guardado y la hora ISO con zona."""
    headers = registered_user["headers"]
    put_profile(client, headers, PROFILE_BODY)

    response = get_profile(client, headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["onboarding_completed"] is True
    completed_at = datetime.fromisoformat(data["onboarding_completed_at"])
    assert completed_at.tzinfo is not None
    assert data["date_of_birth"] == "1990-06-15"
    assert data["profile"] == {
        "gender": "male",
        "height_unit": "cm",
        "height_cm": 175.5,
        "height_ft": None,
        "height_in": None,
        "weight_unit": "kg",
        "weight": 72.5,
        "activity_level": "moderate",
        "goal": "maintain",
    }


# SDD: REQ-001 AC-001.2
def test_get_for_a_google_user_without_birth_date_or_profile(client, app):
    """Una cuenta sin fecha ni perfil recibe el cuerpo exacto de 'pendiente'."""
    user = create_user(app, "google@example.com")

    response = get_profile(client, user["headers"])

    assert response.status_code == 200
    assert response.get_json() == NO_PROFILE


# SDD: REQ-001 AC-001.3
def test_get_for_a_user_without_profile_is_pending(client, registered_user):
    """Un usuario existente sin perfil tiene el onboarding pendiente."""
    response = get_profile(client, registered_user["headers"])

    assert response.status_code == 200
    data = response.get_json()
    assert data["onboarding_completed"] is False
    assert data["onboarding_completed_at"] is None
    assert data["profile"] is None


# SDD: REQ-001 AC-001.4
def test_get_returns_the_registration_birth_date_without_profile(client):
    """Un usuario registrado con 1995-05-20 recibe esa fecha aunque no tenga perfil."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "dob@example.com",
            "password": "testpassword123",
            "first_name": "Dob",
            "last_name": "User",
            "date_of_birth": "1995-05-20",
        },
    )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.get_json()['token']}"}

    response = get_profile(client, headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["onboarding_completed"] is False
    assert data["profile"] is None
    assert data["date_of_birth"] == "1995-05-20"


# SDD: REQ-002 AC-002.1
def test_put_creates_the_profile_and_get_returns_the_same(client, registered_user):
    """El PUT responde con lo enviado y un GET posterior devuelve lo mismo."""
    headers = registered_user["headers"]

    response = put_profile(client, headers, PROFILE_BODY)

    assert response.status_code == 200
    data = response.get_json()
    assert data["date_of_birth"] == "1990-06-15"
    assert data["profile"]["gender"] == "male"
    assert data["profile"]["height_cm"] == 175.5
    assert read_profile(client, headers) == data


# SDD: REQ-002 AC-002.2
def test_put_replaces_the_previous_profile(client, registered_user):
    """El segundo PUT deja solo los valores nuevos."""
    headers = registered_user["headers"]
    put_profile(client, headers, PROFILE_BODY)

    response = put_profile(client, headers, FT_LB_BODY)

    assert response.status_code == 200
    stored = get_profile(client, headers)
    assert stored.status_code == 200
    profile = stored.get_json()["profile"]
    assert profile["gender"] == "female"
    assert profile["goal"] == "lose_slow"
    assert profile["activity_level"] == "high"
    assert profile["height_unit"] == "ft"
    assert profile["height_cm"] is None


# SDD: REQ-002 AC-002.3
def test_put_keeps_feet_inches_and_pounds(client, registered_user):
    """ft/in y lb se leen tal cual, con height_cm en null."""
    headers = registered_user["headers"]
    put_profile(client, headers, FT_LB_BODY)

    profile = read_profile(client, headers)["profile"]

    assert profile["height_unit"] == "ft"
    assert profile["height_ft"] == 5
    assert profile["height_in"] == 9
    assert profile["height_cm"] is None
    assert profile["weight_unit"] == "lb"
    assert profile["weight"] == 160


# SDD: REQ-002 AC-002.4
def test_put_keeps_centimeters_with_one_decimal(client, registered_user):
    """cm devuelve 175.5 con ft/in en null."""
    headers = registered_user["headers"]
    put_profile(client, headers, body(height_cm=175.5))

    profile = read_profile(client, headers)["profile"]

    assert profile["height_cm"] == 175.5
    assert profile["height_ft"] is None
    assert profile["height_in"] is None


# SDD: REQ-002 AC-002.7
def test_put_changes_the_birth_date_of_an_email_account(client, registered_user):
    """Una cuenta de email con 2000-01-01 pasa a la fecha guardada."""
    headers = registered_user["headers"]
    assert read_profile(client, headers)["date_of_birth"] == "2000-01-01"

    put_profile(client, headers, body(date_of_birth="1996-03-01"))

    assert read_profile(client, headers)["date_of_birth"] == "1996-03-01"


# SDD: REQ-002 AC-002.8
def test_put_sets_the_birth_date_of_an_account_without_one(client, app):
    """Una cuenta de Google sin fecha la recibe al guardar."""
    user = create_user(app, "google@example.com")

    put_profile(client, user["headers"], body(date_of_birth="2000-01-15"))

    assert read_profile(client, user["headers"])["date_of_birth"] == "2000-01-15"


# SDD: REQ-002 AC-002.9
def test_response_does_not_include_age(client, registered_user):
    """Aunque se envie age, la respuesta no lo incluye ni en profile."""
    response = put_profile(client, registered_user["headers"], body(age=28))

    assert response.status_code == 200
    data = response.get_json()
    assert "age" not in data
    assert "age" not in data["profile"]


# SDD: REQ-003 AC-003.1
def test_first_put_completes_the_onboarding(client, registered_user):
    """El primer PUT devuelve onboarding_completed true y la fecha-hora no nula."""
    response = put_profile(client, registered_user["headers"], PROFILE_BODY)

    assert response.status_code == 200
    data = response.get_json()
    assert data["onboarding_completed"] is True
    assert data["onboarding_completed_at"] is not None


# SDD: REQ-003 AC-003.2
def test_second_put_keeps_the_completion_timestamp(client, registered_user):
    """Un segundo PUT conserva onboarding_completed_at del primero."""
    headers = registered_user["headers"]
    first_response = put_profile(client, headers, PROFILE_BODY)
    second_response = put_profile(client, headers, FT_LB_BODY)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first = first_response.get_json()
    second = second_response.get_json()

    assert second["onboarding_completed_at"] == first["onboarding_completed_at"]
    assert read_profile(client, headers)["onboarding_completed_at"] == (
        first["onboarding_completed_at"]
    )


# SDD: REQ-003 AC-003.3
def test_invalid_put_leaves_the_onboarding_pending(client, registered_user):
    """Un PUT invalido no completa el onboarding."""
    headers = registered_user["headers"]

    response = put_profile(client, headers, body(goal="nope"))

    assert response.status_code == 400
    stored = get_profile(client, headers)
    assert stored.status_code == 200
    data = stored.get_json()
    assert data["onboarding_completed"] is False
    assert data["profile"] is None


# SDD: REQ-004 AC-004.14
def test_invalid_put_keeps_the_previous_profile_and_birth_date(client, registered_user):
    """Un PUT con solo la fecha futura devuelve 400 y no cambia nada anterior."""
    headers = registered_user["headers"]
    put_profile(client, headers, PROFILE_BODY)
    before = read_profile(client, headers)

    response = put_profile(
        client, headers, FT_LB_BODY | {"date_of_birth": "2999-01-01"}
    )

    assert response.status_code == 400
    assert read_profile(client, headers) == before


# SDD: REQ-004 AC-004.1
def test_invalid_gender_returns_400_with_the_message(client, registered_user):
    """El error sale como {"error": ...} con 400."""
    response = put_profile(client, registered_user["headers"], body(gender="other"))

    assert response.status_code == 400
    assert response.get_json() == {"error": "El género debe ser masculino o femenino"}


# SDD: REQ-004 AC-004.2
def test_invalid_birth_date_returns_400_with_the_message(client, registered_user):
    """Una fecha inexistente da el mensaje de fecha no valida."""
    response = put_profile(
        client, registered_user["headers"], body(date_of_birth="2001-02-30")
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "La fecha de nacimiento no es válida"}


# SDD: REQ-004 AC-004.9
def test_invalid_weight_returns_400_with_the_message(client, registered_user):
    """Un peso en kg fuera de rango da su mensaje."""
    response = put_profile(client, registered_user["headers"], body(weight=29))

    assert response.status_code == 400
    assert response.get_json() == {"error": "El peso debe estar entre 30 y 300 kg"}


# SDD: REQ-004 AC-004.13
def test_put_without_a_body_returns_400(client, registered_user):
    """Un PUT sin cuerpo da el mensaje de datos no validos."""
    response = client.put("/api/profile", headers=registered_user["headers"])

    assert response.status_code == 400
    assert response.get_json() == {"error": "Los datos del perfil no son válidos"}


# SDD: REQ-004 AC-004.13
def test_put_with_invalid_json_returns_400(client, registered_user):
    """Un cuerpo que no es JSON valido da el mismo mensaje."""
    response = client.put(
        "/api/profile",
        data="no-json",
        content_type="application/json",
        headers=registered_user["headers"],
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "Los datos del perfil no son válidos"}


# SDD: REQ-004 AC-004.13
def test_put_with_a_list_body_returns_400(client, registered_user):
    """Un cuerpo que es una lista (no un objeto) da el mismo mensaje."""
    response = put_profile(client, registered_user["headers"], [1, 2])

    assert response.status_code == 400
    assert response.get_json() == {"error": "Los datos del perfil no son válidos"}


# SDD: REQ-005 AC-005.1
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer basura"}])
def test_get_without_a_valid_token_returns_401(client, headers):
    """Sin token o con un token invalido, la lectura da 401."""
    assert client.get("/api/profile", headers=headers).status_code == 401


# SDD: REQ-005 AC-005.2
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer basura"}])
def test_put_without_a_valid_token_returns_401_and_changes_nothing(
    client, registered_user, headers
):
    """El PUT sin sesion da 401 y el perfil y la fecha del usuario no cambian."""
    owner = registered_user["headers"]
    put_profile(client, owner, PROFILE_BODY)
    before = read_profile(client, owner)

    response = client.put("/api/profile", json=FT_LB_BODY, headers=headers)

    assert response.status_code == 401
    assert read_profile(client, owner) == before


# SDD: NFR-001 AC-N001.1
def test_each_user_reads_only_their_own_profile(client, app, registered_user):
    """A y B con perfiles distintos: cada uno lee solo lo suyo."""
    user_a = registered_user["headers"]
    user_b = create_user(app, "other@example.com")["headers"]
    put_profile(client, user_a, PROFILE_BODY)
    put_profile(client, user_b, FT_LB_BODY | {"date_of_birth": "1985-02-03"})

    data_a = read_profile(client, user_a)
    data_b = read_profile(client, user_b)

    assert data_a["date_of_birth"] == "1990-06-15"
    assert data_a["profile"]["gender"] == "male"
    assert data_b["date_of_birth"] == "1985-02-03"
    assert data_b["profile"]["gender"] == "female"


# SDD: NFR-001 AC-N001.2
def test_a_user_id_in_the_body_does_not_affect_another_user(client, app, registered_user):
    """A envia el user_id de B: cambia A y B queda igual (sin perfil)."""
    user_a = registered_user["headers"]
    other = create_user(app, "other@example.com")

    response = put_profile(client, user_a, body(user_id=other["id"]))

    assert response.status_code == 200
    assert read_profile(client, user_a)["profile"]["gender"] == "male"
    assert read_profile(client, other["headers"]) == NO_PROFILE


# --------------------------------------------------------------------------
# Enteros enormes (spec 013, REQ-001)
# --------------------------------------------------------------------------

HUGE = 10**400


# SDD: 013 REQ-001 AC-001.1
def test_put_with_a_huge_integer_height_returns_400_with_the_range_message(
    client, registered_user
):
    """Una altura de 10^400 cm da el 400 de rango, no un 500."""
    response = put_profile(
        client, registered_user["headers"], body(height_unit="cm", height_cm=HUGE)
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "La altura debe estar entre 100 y 250 cm"}


# SDD: 013 REQ-001 AC-001.2
def test_put_with_a_huge_integer_weight_in_kg_returns_400_with_the_range_message(
    client, registered_user
):
    """Un peso de 10^400 kg da el 400 de rango en kg."""
    response = put_profile(
        client, registered_user["headers"], body(weight_unit="kg", weight=HUGE)
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "El peso debe estar entre 30 y 300 kg"}


# SDD: 013 REQ-001 AC-001.3
def test_put_with_a_huge_negative_weight_in_lb_returns_400_with_the_range_message(
    client, registered_user
):
    """Un peso de -10^400 lb da el 400 de rango en lb."""
    response = put_profile(
        client, registered_user["headers"], body(weight_unit="lb", weight=-HUGE)
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "El peso debe estar entre 66 y 660 lb"}


# SDD: 013 REQ-001 AC-001.4
def test_a_rejected_huge_weight_leaves_the_saved_profile_untouched(client, registered_user):
    """Tras el 400 por un peso de 10^400, el GET devuelve el mismo perfil que antes."""
    headers = registered_user["headers"]
    assert put_profile(client, headers, PROFILE_BODY).status_code == 200
    before = read_profile(client, headers)

    response = put_profile(client, headers, body(weight=HUGE))

    assert response.status_code == 400
    assert read_profile(client, headers) == before


# SDD: 013 REQ-001 AC-001.5
def test_put_with_a_5000_digit_weight_returns_400_and_never_500(client, registered_user):
    """Un entero de 5000 dígitos no se puede parsear: 400 de datos no válidos."""
    digits = "1" + "0" * 4999
    raw = json.dumps(body(weight=0)).replace('"weight": 0', '"weight": ' + digits)
    assert digits in raw

    response = client.put(
        "/api/profile",
        data=raw,
        content_type="application/json",
        headers=registered_user["headers"],
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "Los datos del perfil no son válidos"}
