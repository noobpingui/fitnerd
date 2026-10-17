"""Tests de INTEGRACIÓN de /api/body-metrics (spec 008): cliente HTTP real contra
la app, el service y los repositories reales y Postgres de test. El reloj del
servidor es el real, así que las fechas se calculan relativas a la fecha UTC de
hoy; los ejemplos con fecha exacta (2026-10-12) están en los unitarios.
"""

import json
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from extensions import db, jwt_manager
from models.body_metric import BodyMetric
from models.user import User

URL = "/api/body-metrics"

PROFILE_KG = {
    "date_of_birth": "1990-06-15",
    "gender": "male",
    "height_unit": "cm",
    "height_cm": 175.5,
    "weight_unit": "kg",
    "weight": 80,
    "activity_level": "moderate",
    "goal": "maintain",
}
PROFILE_LB = {
    "date_of_birth": "1990-06-15",
    "gender": "female",
    "height_unit": "ft",
    "height_ft": 5,
    "height_in": 9,
    "weight_unit": "lb",
    "weight": 173.1,
    "activity_level": "high",
    "goal": "lose_slow",
}

NO_VALUES = "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)"
WEIGHT_INVALID = "El peso debe estar entre 29,9 y 300 kg"
FAT_INVALID = "El porcentaje de grasa corporal debe estar entre 3 y 60"
MUSCLE_INVALID = "El porcentaje de masa muscular debe estar entre 10 y 70"
DATE_INVALID = "La fecha de la medición no es válida"
DATE_FUTURE = "La fecha de la medición no puede ser futura"
BODY_INVALID = "Los datos de la medición no son válidos"
NOT_FOUND = "Registro no encontrado"


def today():
    return datetime.now(timezone.utc).date()


def day(offset):
    """Fecha ISO relativa a hoy (UTC): day(-1) es ayer."""
    return (today() + timedelta(days=offset)).isoformat()


def create_user(app, email):
    """Crea un usuario directamente y devuelve su id y sus cabeceras."""
    with app.app_context():
        user = User(email=email, date_of_birth=date(2000, 1, 1))
        db.session.add(user)
        db.session.commit()
        token = jwt_manager.generate_token({"id": str(user.id), "user_role": "user"}, 30)
        user_id = str(user.id)
    return {"id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def post(client, headers, payload):
    return client.post(URL, json=payload, headers=headers)


def put(client, headers, metric_id, payload):
    return client.put(f"{URL}/{metric_id}", json=payload, headers=headers)


def delete(client, headers, metric_id):
    return client.delete(f"{URL}/{metric_id}", headers=headers)


def listing(client, headers):
    response = client.get(URL, headers=headers)
    assert response.status_code == 200
    return response.get_json()


def save_profile(client, headers, body):
    response = client.put("/api/profile", json=body, headers=headers)
    assert response.status_code == 200
    return response.get_json()


def read_profile(client, headers):
    response = client.get("/api/profile", headers=headers)
    assert response.status_code == 200
    return response.get_json()


# --------------------------------------------------------------------------
# REQ-001: una sola medicion por dia
# --------------------------------------------------------------------------


# SDD: REQ-001 AC-001.1
def test_post_creates_a_metric_with_201(client, registered_user):
    """Sin medición ese día: 201 y el historial tiene una con peso 80."""
    headers = registered_user["headers"]

    response = post(client, headers, {"weight": 80, "recorded_at": day(0)})

    assert response.status_code == 201
    assert response.get_json()["weight"] == 80
    items = listing(client, headers)
    assert len(items) == 1
    assert items[0]["recorded_at"] == day(0)
    assert items[0]["weight"] == 80
    # La medicion creada es corregible por su id (PUT nuevo de la feature).
    corrected = put(client, headers, response.get_json()["id"], {"weight": 79})
    assert corrected.status_code == 200
    assert listing(client, headers)[0]["weight"] == 79


# SDD: REQ-001 AC-001.2
def test_post_on_the_same_day_updates_with_200_and_the_same_id(client, registered_user):
    """El segundo POST del día es 200, mismo id, conserva la grasa y no duplica."""
    headers = registered_user["headers"]
    first = post(client, headers, {"weight": 80, "body_fat_percentage": 20, "recorded_at": day(0)})
    assert first.status_code == 201

    second = post(client, headers, {"weight": 79.5, "recorded_at": day(0)})

    assert second.status_code == 200
    data = second.get_json()
    assert data["id"] == first.get_json()["id"]
    assert data["weight"] == 79.5
    assert data["body_fat_percentage"] == 20
    assert len(listing(client, headers)) == 1


# SDD: REQ-001 AC-001.4
def test_post_on_another_day_creates_a_second_metric(client, registered_user):
    """Un día distinto es 201 y el historial tiene dos mediciones."""
    headers = registered_user["headers"]
    older = post(client, headers, {"weight": 80, "recorded_at": day(-1)})
    assert older.status_code == 201

    response = post(client, headers, {"weight": 79, "recorded_at": day(0)})

    assert response.status_code == 201
    assert [m["recorded_at"] for m in listing(client, headers)] == [day(0), day(-1)]
    # Corregir la anterior no toca la de hoy ni duplica fechas.
    assert put(client, headers, older.get_json()["id"], {"weight": 78}).status_code == 200
    assert [m["weight"] for m in listing(client, headers)] == [79, 78]


# SDD: REQ-001 AC-001.5
def test_post_of_another_user_on_the_same_day_creates_its_own(client, app):
    """B registra el mismo día que A: 201 propio y la de A no cambia."""
    user_a = create_user(app, "a@example.com")
    user_b = create_user(app, "b@example.com")
    post(client, user_a["headers"], {"weight": 80, "recorded_at": day(0)})

    response = post(client, user_b["headers"], {"weight": 70, "recorded_at": day(0)})

    assert response.status_code == 201
    own = put(client, user_b["headers"], response.get_json()["id"], {"weight": 71})
    assert own.status_code == 200
    assert listing(client, user_a["headers"])[0]["weight"] == 80
    assert listing(client, user_b["headers"])[0]["weight"] == 71


# SDD: REQ-001 AC-001.6
def test_post_without_recorded_at_uses_todays_utc_date(client, registered_user):
    """Sin recorded_at: fecha UTC del servidor y la misma regla de uno por día."""
    headers = registered_user["headers"]

    first = post(client, headers, {"weight": 80})
    second = post(client, headers, {"weight": 79})

    assert first.status_code == 201
    assert first.get_json()["recorded_at"] == today().isoformat()
    assert second.status_code == 200
    assert len(listing(client, headers)) == 1


# SDD: REQ-001 AC-001.7
def test_history_never_repeats_a_date_after_post_put_and_delete(client, registered_user):
    """Una secuencia de POST, PUT y DELETE deja fechas únicas en el GET."""
    headers = registered_user["headers"]
    first = post(client, headers, {"weight": 80, "recorded_at": day(-2)}).get_json()
    post(client, headers, {"weight": 79, "recorded_at": day(-2)})
    second = post(client, headers, {"weight": 78, "recorded_at": day(-1)}).get_json()
    assert put(client, headers, second["id"], {"weight": 77}).status_code == 200
    post(client, headers, {"body_fat_percentage": 20, "recorded_at": day(-1)})
    assert delete(client, headers, first["id"]).status_code == 204
    post(client, headers, {"weight": 76, "recorded_at": day(-2)})
    post(client, headers, {"weight": 75})
    post(client, headers, {"weight": 74})

    dates = [m["recorded_at"] for m in listing(client, headers)]

    assert len(dates) == len(set(dates))
    assert len(dates) == 3


# SDD: REQ-001 AC-001.7
def test_database_rejects_a_duplicate_user_and_date(client, app, registered_user):
    """La restricción única (user_id, recorded_at) impide el duplicado en la base."""
    post(client, registered_user["headers"], {"weight": 80, "recorded_at": day(0)})

    with app.app_context():
        existing = db.session.query(BodyMetric).first()
        db.session.add(
            BodyMetric(user_id=existing.user_id, weight=79, recorded_at=existing.recorded_at)
        )
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


# --------------------------------------------------------------------------
# REQ-002: validacion por HTTP
# --------------------------------------------------------------------------


def assert_post_rejected(client, headers, payload, message):
    response = post(client, headers, payload)
    assert response.status_code == 400
    assert response.get_json() == {"error": message}
    assert listing(client, headers) == []


# SDD: REQ-002 AC-002.1
@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"notes": "nada"},
        {"weight": None, "body_fat_percentage": None, "muscle_mass_percentage": None},
    ],
)
def test_post_without_any_value_is_400(client, registered_user, payload):
    """Sin peso, grasa ni músculo (ausentes o null): mensaje literal, en POST y en PUT."""
    headers = registered_user["headers"]
    assert_post_rejected(client, headers, payload, NO_VALUES)
    metric = post(client, headers, {"weight": 80}).get_json()
    response = put(client, headers, metric["id"], payload)
    assert response.status_code == 400
    assert response.get_json() == {"error": NO_VALUES}
    assert listing(client, headers)[0]["weight"] == 80


# SDD: REQ-002 AC-002.2
@pytest.mark.parametrize("weight", ["80", 29.8, 300.1, 0, True])
def test_post_with_an_invalid_weight_is_400(client, registered_user, weight):
    """Peso como texto o fuera de 29,9 a 300."""
    assert_post_rejected(client, registered_user["headers"], {"weight": weight}, WEIGHT_INVALID)


# SDD: REQ-002 AC-002.3
@pytest.mark.parametrize("fat", ["20", 2.9, 60.1])
def test_post_with_an_invalid_body_fat_is_400(client, registered_user, fat):
    """Grasa como texto o fuera de 3 a 60."""
    assert_post_rejected(
        client, registered_user["headers"], {"body_fat_percentage": fat}, FAT_INVALID
    )


# SDD: REQ-002 AC-002.4
@pytest.mark.parametrize("muscle", ["40", 9.9, 70.1])
def test_post_with_an_invalid_muscle_mass_is_400(client, registered_user, muscle):
    """Masa muscular como texto o fuera de 10 a 70."""
    assert_post_rejected(
        client, registered_user["headers"], {"muscle_mass_percentage": muscle}, MUSCLE_INVALID
    )


# SDD: REQ-002 AC-002.5
@pytest.mark.parametrize("recorded_at", ["2026-02-30", "20261012", "12/10/2026", 123])
def test_post_with_an_invalid_date_is_400(client, registered_user, recorded_at):
    """Fecha con formato incorrecto, inexistente o que no es texto."""
    assert_post_rejected(
        client,
        registered_user["headers"],
        {"weight": 80, "recorded_at": recorded_at},
        DATE_INVALID,
    )


# SDD: REQ-002 AC-002.6
def test_post_accepts_tomorrow_and_rejects_the_day_after(client, registered_user):
    """Hoy+1 se acepta (zonas adelantadas) y hoy+2 se rechaza como futura."""
    headers = registered_user["headers"]

    accepted = post(client, headers, {"weight": 80, "recorded_at": day(1)})
    rejected = post(client, headers, {"weight": 80, "recorded_at": day(2)})

    assert accepted.status_code == 201
    assert rejected.status_code == 400
    assert rejected.get_json() == {"error": DATE_FUTURE}
    assert len(listing(client, headers)) == 1


# SDD: REQ-002 AC-002.7
def test_post_without_a_body_is_400(client, registered_user):
    """Sin cuerpo JSON: 400 con el mensaje de datos no válidos."""
    response = client.post(URL, headers=registered_user["headers"])

    assert response.status_code == 400
    assert response.get_json() == {"error": BODY_INVALID}


# SDD: REQ-002 AC-002.7
@pytest.mark.parametrize("raw", ["[]", '"texto"', "80", "no-json"])
def test_post_with_a_body_that_is_not_an_object_is_400(client, registered_user, raw):
    """Un cuerpo que no es un objeto (o no es JSON válido) es 400."""
    response = client.post(
        URL, data=raw, content_type="application/json", headers=registered_user["headers"]
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": BODY_INVALID}


# SDD: REQ-002 AC-002.7
@pytest.mark.parametrize("raw", ["[]", "no-json"])
def test_put_with_a_body_that_is_not_an_object_is_400(client, registered_user, raw):
    """La corrección también rechaza un cuerpo que no es un objeto."""
    headers = registered_user["headers"]
    metric = post(client, headers, {"weight": 80}).get_json()

    response = client.put(
        f"{URL}/{metric['id']}", data=raw, content_type="application/json", headers=headers
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": BODY_INVALID}
    assert listing(client, headers)[0]["weight"] == 80


# SDD: REQ-002 AC-002.8
def test_post_accepts_the_exact_limits(client, registered_user):
    """Los valores límite mínimos y máximos se aceptan."""
    headers = registered_user["headers"]

    low = post(
        client,
        headers,
        {
            "weight": 29.9,
            "body_fat_percentage": 3,
            "muscle_mass_percentage": 10,
            "recorded_at": day(0),
        },
    )
    high = post(
        client,
        headers,
        {
            "weight": 300,
            "body_fat_percentage": 60,
            "muscle_mass_percentage": 70,
            "recorded_at": day(0),
        },
    )

    assert low.status_code == 201
    assert high.status_code == 200
    stored = listing(client, headers)[0]
    assert (stored["weight"], stored["body_fat_percentage"], stored["muscle_mass_percentage"]) == (
        300,
        60,
        70,
    )


# SDD: REQ-002 AC-002.9
def test_a_rejected_weight_leaves_the_stored_metric_unchanged(client, registered_user):
    """Un peso de 400 sobre la medición de hoy da 400 y sigue en 80."""
    headers = registered_user["headers"]
    post(client, headers, {"weight": 80, "recorded_at": day(0)})

    response = post(client, headers, {"weight": 400, "recorded_at": day(0)})

    assert response.status_code == 400
    assert listing(client, headers)[0]["weight"] == 80


# SDD: REQ-002 AC-002.10
def test_get_returns_an_old_metric_out_of_the_new_ranges_unchanged(client, app, registered_user):
    """Una medición guardada antes con grasa 2 se lee tal cual."""
    headers = registered_user["headers"]
    user_id = read_user_id(app, "test@example.com")
    with app.app_context():
        db.session.add(
            BodyMetric(user_id=user_id, body_fat_percentage=2, recorded_at=today())
        )
        db.session.commit()

    items = listing(client, headers)

    assert len(items) == 1
    assert items[0]["body_fat_percentage"] == 2
    # Se puede corregir a un valor dentro de los rangos nuevos.
    fixed = put(client, headers, items[0]["id"], {"body_fat_percentage": 20})
    assert fixed.status_code == 200
    assert listing(client, headers)[0]["body_fat_percentage"] == 20


def read_user_id(app, email):
    with app.app_context():
        return db.session.query(User).filter_by(email=email).one().id


# --------------------------------------------------------------------------
# REQ-003 y REQ-004: PUT y DELETE por HTTP
# --------------------------------------------------------------------------


# SDD: REQ-003 AC-003.1
def test_put_replaces_the_three_values(client, registered_user):
    """La corrección sustituye los tres valores; el ausente queda en null."""
    headers = registered_user["headers"]
    metric = post(
        client,
        headers,
        {
            "weight": 80,
            "body_fat_percentage": 20,
            "muscle_mass_percentage": 40,
            "recorded_at": day(-3),
        },
    ).get_json()

    response = put(client, headers, metric["id"], {"weight": 79, "body_fat_percentage": 19})

    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == metric["id"]
    assert data["weight"] == 79
    assert data["body_fat_percentage"] == 19
    assert data["muscle_mass_percentage"] is None
    assert data["recorded_at"] == day(-3)
    assert listing(client, headers)[0]["muscle_mass_percentage"] is None


# SDD: REQ-003 AC-003.2
def test_put_keeps_the_notes(client, registered_user):
    """Las notas se conservan al corregir."""
    headers = registered_user["headers"]
    metric = post(client, headers, {"weight": 80, "notes": "tras vacaciones"}).get_json()

    response = put(client, headers, metric["id"], {"weight": 79})

    assert response.get_json()["notes"] == "tras vacaciones"


# SDD: REQ-003 AC-003.3
def test_put_ignores_recorded_at(client, registered_user):
    """Enviar otra recorded_at no cambia la fecha de la medición."""
    headers = registered_user["headers"]
    metric = post(client, headers, {"weight": 80, "recorded_at": day(-5)}).get_json()

    response = put(client, headers, metric["id"], {"weight": 79, "recorded_at": day(-9)})

    assert response.status_code == 200
    assert response.get_json()["recorded_at"] == day(-5)


# SDD: REQ-003 AC-003.4
def test_put_without_any_value_is_400_and_changes_nothing(client, registered_user):
    """Sin ningún valor: 400 y la medición no cambia."""
    headers = registered_user["headers"]
    metric = post(client, headers, {"weight": 80, "body_fat_percentage": 20}).get_json()

    response = put(client, headers, metric["id"], {"weight": None})

    assert response.status_code == 400
    assert response.get_json() == {"error": NO_VALUES}
    stored = listing(client, headers)[0]
    assert stored["weight"] == 80
    assert stored["body_fat_percentage"] == 20


# SDD: REQ-003 AC-003.5
def test_put_of_an_unknown_id_is_404(client, registered_user):
    """Un id inexistente da 404 con el mensaje literal."""
    response = put(
        client,
        registered_user["headers"],
        "6f1c0000-0000-4000-8000-000000000000",
        {"weight": 79},
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": NOT_FOUND}


# SDD: REQ-004 AC-004.1
def test_delete_removes_the_metric_with_204(client, registered_user):
    """Borrar una medición propia: 204 y desaparece del historial."""
    headers = registered_user["headers"]
    metric = post(client, headers, {"weight": 80}).get_json()

    response = delete(client, headers, metric["id"])

    assert response.status_code == 204
    assert listing(client, headers) == []
    # Una nueva medicion el mismo dia vuelve a ser 201 (no queda hueco ni duplicado).
    again = post(client, headers, {"weight": 81})
    assert again.status_code == 201
    assert put(client, headers, again.get_json()["id"], {"weight": 82}).status_code == 200


# SDD: REQ-004 AC-004.1
def test_delete_of_the_latest_metric_moves_the_profile_weight_back(client, registered_user):
    """Al borrar la última, el peso del perfil vuelve al de la anterior."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    post(client, headers, {"weight": 82, "recorded_at": day(-3)})
    latest = post(client, headers, {"weight": 78, "recorded_at": day(-1)}).get_json()
    assert read_profile(client, headers)["profile"]["weight"] == 78

    assert delete(client, headers, latest["id"]).status_code == 204

    assert read_profile(client, headers)["profile"]["weight"] == 82


# SDD: REQ-004 AC-004.2
def test_delete_of_an_unknown_id_is_404(client, registered_user):
    """Un id inexistente da 404 con el mensaje literal."""
    headers = registered_user["headers"]
    post(client, headers, {"weight": 80})

    response = delete(client, headers, "6f1c0000-0000-4000-8000-000000000000")

    assert response.status_code == 404
    assert response.get_json() == {"error": NOT_FOUND}
    stored = listing(client, headers)
    assert len(stored) == 1
    assert put(client, headers, stored[0]["id"], {"weight": 79}).status_code == 200


# --------------------------------------------------------------------------
# REQ-005: el peso del perfil sigue a la ultima medicion de peso
# --------------------------------------------------------------------------


# SDD: REQ-005 AC-005.1
def test_put_of_the_latest_metric_moves_the_profile_weight(client, registered_user):
    """Corregir la última medición a 78,4 deja el perfil en 78,4 kg."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    metric = post(client, headers, {"weight": 80, "recorded_at": day(-1)}).get_json()

    put(client, headers, metric["id"], {"weight": 78.4})

    profile = read_profile(client, headers)["profile"]
    assert profile["weight"] == 78.4
    assert profile["weight_unit"] == "kg"


# SDD: REQ-005 AC-005.2
def test_delete_converts_the_previous_weight_to_pounds(client, registered_user):
    """Perfil en lb: borrar la última deja 176,4 lb (80 kg)."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_LB)
    post(client, headers, {"weight": 80, "recorded_at": day(-7)})
    latest = post(client, headers, {"weight": 78.5, "recorded_at": day(-1)}).get_json()

    delete(client, headers, latest["id"])

    profile = read_profile(client, headers)["profile"]
    assert profile["weight"] == 176.4
    assert profile["weight_unit"] == "lb"


# SDD: REQ-005 AC-005.3
def test_delete_of_the_latest_metric_restores_the_previous_weight_in_kg(client, registered_user):
    """Perfil en kg con 78,5: borrar la última lo deja en 80."""
    headers = registered_user["headers"]
    save_profile(client, headers, {**PROFILE_KG, "weight": 78.5})
    post(client, headers, {"weight": 80, "recorded_at": day(-7)})
    latest = post(client, headers, {"weight": 78.5, "recorded_at": day(-1)}).get_json()

    delete(client, headers, latest["id"])

    assert read_profile(client, headers)["profile"]["weight"] == 80


# SDD: REQ-005 AC-005.8
def test_profile_weight_is_clamped_to_the_profile_range(client, registered_user):
    """Perfil en kg con 31 y medición de hoy de 29,9: el perfil queda en 30."""
    headers = registered_user["headers"]
    save_profile(client, headers, {**PROFILE_KG, "weight": 31})

    post(client, headers, {"weight": 29.9, "recorded_at": today().isoformat()})

    assert read_profile(client, headers)["profile"]["weight"] == 30


# SDD: REQ-005 AC-005.9
def test_post_without_a_profile_keeps_the_onboarding_pending(client, registered_user):
    """Sin perfil: la medición se guarda y el onboarding sigue pendiente."""
    headers = registered_user["headers"]

    response = post(client, headers, {"weight": 80})

    assert response.status_code == 201
    state = read_profile(client, headers)
    assert state["profile"] is None
    assert state["onboarding_completed"] is False
    stored = listing(client, headers)
    assert len(stored) == 1
    # Corregir sin perfil tampoco crea ni completa el perfil.
    assert put(client, headers, stored[0]["id"], {"weight": 79}).status_code == 200
    state = read_profile(client, headers)
    assert state["profile"] is None
    assert state["onboarding_completed"] is False


# SDD: REQ-005 AC-005.10
def test_sync_leaves_the_rest_of_the_profile_untouched(client, registered_user):
    """Solo cambia el peso: fecha de nacimiento y onboarding quedan iguales."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    before = read_profile(client, headers)

    post(client, headers, {"weight": 75, "recorded_at": day(-1)})

    after = read_profile(client, headers)
    assert after["profile"]["weight"] == 75
    before["profile"]["weight"] = after["profile"]["weight"]
    assert after == before


# --------------------------------------------------------------------------
# NFR-001: sesion y aislamiento entre usuarios
# --------------------------------------------------------------------------


# SDD: NFR-001 AC-N001.1
@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer token-invalido"}],
    ids=["sin-token", "token-invalido"],
)
def test_put_and_delete_require_a_valid_session(client, registered_user, headers):
    """Sin token o con uno inválido: 401 y nada cambia."""
    own = registered_user["headers"]
    metric = post(client, own, {"weight": 80}).get_json()

    put_response = put(client, headers, metric["id"], {"weight": 70})
    delete_response = delete(client, headers, metric["id"])

    assert put_response.status_code == 401
    assert delete_response.status_code == 401
    stored = listing(client, own)
    assert len(stored) == 1
    assert stored[0]["weight"] == 80


# SDD: NFR-001 AC-N001.2
def test_a_user_cannot_update_or_delete_a_metric_of_another_user(client, app):
    """A contra el id de B: 404 y la medición y el perfil de B no cambian."""
    user_a = create_user(app, "a@example.com")
    user_b = create_user(app, "b@example.com")
    save_profile(client, user_b["headers"], PROFILE_KG)
    metric = post(client, user_b["headers"], {"weight": 80, "recorded_at": day(-1)}).get_json()
    profile_before = read_profile(client, user_b["headers"])

    put_response = put(client, user_a["headers"], metric["id"], {"weight": 60})
    delete_response = delete(client, user_a["headers"], metric["id"])

    assert put_response.status_code == 404
    assert delete_response.status_code == 404
    stored = listing(client, user_b["headers"])
    assert len(stored) == 1
    assert stored[0]["weight"] == 80
    assert read_profile(client, user_b["headers"]) == profile_before


# SDD: NFR-001 AC-N001.3
def test_user_id_in_the_body_is_ignored(client, app):
    """A envía el user_id de B: la medición es de A y B no cambia."""
    user_a = create_user(app, "a@example.com")
    user_b = create_user(app, "b@example.com")
    profile_before = read_profile(client, user_b["headers"])

    response = post(
        client, user_a["headers"], {"weight": 80, "user_id": user_b["id"], "recorded_at": day(0)}
    )

    assert response.status_code == 201
    assert len(listing(client, user_a["headers"])) == 1
    assert listing(client, user_b["headers"]) == []
    assert read_profile(client, user_b["headers"]) == profile_before
    # B tampoco puede corregir la medicion de A.
    metric_id = response.get_json()["id"]
    assert put(client, user_b["headers"], metric_id, {"weight": 1}).status_code == 404


# --------------------------------------------------------------------------
# Enteros enormes (spec 013, REQ-002)
# --------------------------------------------------------------------------

HUGE = 10**400


# SDD: 013 REQ-002 AC-002.1
def test_post_with_a_huge_integer_weight_is_400_and_creates_nothing(client, registered_user):
    """Un peso de 10^400 da el 400 de rango y la lista de mediciones no cambia."""
    headers = registered_user["headers"]
    assert post(client, headers, {"weight": 80}).status_code in (200, 201)
    before = listing(client, headers)
    assert before

    response = post(client, headers, {"weight": HUGE})

    assert response.status_code == 400
    assert response.get_json() == {"error": WEIGHT_INVALID}
    assert listing(client, headers) == before


# SDD: 013 REQ-002 AC-002.2
def test_post_with_a_huge_integer_body_fat_is_400(client, registered_user):
    """Una grasa de 10^400 da el 400 de rango de la grasa."""
    response = post(client, registered_user["headers"], {"body_fat_percentage": HUGE})

    assert response.status_code == 400
    assert response.get_json() == {"error": FAT_INVALID}


# SDD: 013 REQ-002 AC-002.3
def test_post_with_a_huge_negative_integer_muscle_is_400(client, registered_user):
    """Una masa muscular de -10^400 da el 400 de rango de la masa muscular."""
    response = post(client, registered_user["headers"], {"muscle_mass_percentage": -HUGE})

    assert response.status_code == 400
    assert response.get_json() == {"error": MUSCLE_INVALID}


# SDD: 013 REQ-002 AC-002.4
def test_put_with_a_huge_integer_weight_is_400_and_keeps_metric_and_profile(
    client, registered_user
):
    """Corregir con 10^400: 400, la medición sigue en 80 kg y el peso del perfil no cambia."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    created = post(client, headers, {"weight": 80, "recorded_at": day(0)})
    assert created.status_code == 201
    metric_id = created.get_json()["id"]
    profile_before = read_profile(client, headers)

    response = put(client, headers, metric_id, {"weight": HUGE})

    assert response.status_code == 400
    assert response.get_json() == {"error": WEIGHT_INVALID}
    items = listing(client, headers)
    assert len(items) == 1
    assert items[0]["weight"] == 80
    assert read_profile(client, headers) == profile_before


# SDD: 013 REQ-002 AC-002.5
def test_post_with_a_5000_digit_weight_is_400_and_never_500(client, registered_user):
    """Un entero de 5000 dígitos no se puede parsear: 400 de datos no válidos."""
    digits = "1" + "0" * 4999
    raw = json.dumps({"weight": 0}).replace('"weight": 0', '"weight": ' + digits)
    assert digits in raw

    response = client.post(
        URL,
        data=raw,
        content_type="application/json",
        headers=registered_user["headers"],
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": BODY_INVALID}


# --------------------------------------------------------------------------
# Spec 016: mediciones con fecha pasada
# --------------------------------------------------------------------------

DATE_TOO_OLD = "La fecha de la medición no puede tener más de un año de antigüedad"


# SDD: 016 REQ-005 AC-005.1
def test_post_accepts_a_date_366_days_ago(client, registered_user):
    """Hace 366 días se acepta (201)."""
    headers = registered_user["headers"]

    response = post(client, headers, {"weight": 80, "recorded_at": day(-366)})

    assert response.status_code == 201
    assert listing(client, headers)[0]["recorded_at"] == day(-366)


# SDD: 016 REQ-005 AC-005.2
def test_post_rejects_a_date_367_days_ago_and_changes_nothing(client, registered_user):
    """Hace 367 días: 400 con el mensaje y ni el historial ni el perfil cambian."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    assert post(client, headers, {"weight": 80, "recorded_at": day(-1)}).status_code == 201
    history_before = listing(client, headers)
    profile_before = read_profile(client, headers)

    response = post(client, headers, {"weight": 60, "recorded_at": day(-367)})

    assert response.status_code == 400
    assert response.get_json() == {"error": DATE_TOO_OLD}
    assert listing(client, headers) == history_before
    assert read_profile(client, headers) == profile_before


# SDD: 016 REQ-005 AC-005.3
def test_post_two_days_ahead_still_gets_the_future_message(client, registered_user):
    """Dentro de dos días sigue dando 400 de fecha futura."""
    response = post(client, registered_user["headers"], {"weight": 80, "recorded_at": day(2)})

    assert response.status_code == 400
    assert response.get_json() == {"error": DATE_FUTURE}


# SDD: 016 REQ-005 AC-005.4
def test_an_old_metric_can_still_be_corrected_and_deleted(client, app, registered_user):
    """Una medición de hace 600 días admite PUT (200) y DELETE (204)."""
    headers = registered_user["headers"]
    user_id = read_user_id(app, "test@example.com")
    with app.app_context():
        db.session.add(
            BodyMetric(user_id=user_id, weight=80, recorded_at=today() - timedelta(days=600))
        )
        db.session.commit()
    metric_id = listing(client, headers)[0]["id"]

    corrected = put(client, headers, metric_id, {"weight": 79})
    assert corrected.status_code == 200
    assert corrected.get_json()["weight"] == 79

    assert delete(client, headers, metric_id).status_code == 204
    assert listing(client, headers) == []


# SDD: 016 REQ-005 AC-005.5
def test_an_old_metric_is_listed_unchanged(client, app, registered_user):
    """Una medición de hace 600 días aparece en el historial sin cambios."""
    headers = registered_user["headers"]
    user_id = read_user_id(app, "test@example.com")
    old_day = today() - timedelta(days=600)
    with app.app_context():
        db.session.add(BodyMetric(user_id=user_id, weight=80, recorded_at=old_day))
        db.session.commit()

    items = listing(client, headers)

    assert len(items) == 1
    assert items[0]["recorded_at"] == old_day.isoformat()
    assert items[0]["weight"] == 80


# SDD: 016 REQ-003 AC-003.7
def test_post_creates_a_past_metric_with_201(client, registered_user):
    """Sin medición hace 7 días, el POST crea con 201."""
    headers = registered_user["headers"]

    response = post(client, headers, {"weight": 80, "recorded_at": day(-7)})

    assert response.status_code == 201
    assert response.get_json()["recorded_at"] == day(-7)


# SDD: 016 REQ-003 AC-003.8
def test_post_on_a_past_day_merges_with_200_and_the_same_id(client, registered_user):
    """Segundo POST de la misma fecha pasada: 200, mismo id, conserva la grasa."""
    headers = registered_user["headers"]
    first = post(
        client, headers, {"weight": 80, "body_fat_percentage": 20, "recorded_at": day(-7)}
    )
    assert first.status_code == 201

    second = post(client, headers, {"weight": 79, "recorded_at": day(-7)})

    assert second.status_code == 200
    data = second.get_json()
    assert data["id"] == first.get_json()["id"]
    assert data["weight"] == 79
    assert data["body_fat_percentage"] == 20
    assert len(listing(client, headers)) == 1


# SDD: 016 REQ-006 AC-006.5
def test_a_past_post_leaves_the_rest_of_the_profile_untouched(client, registered_user):
    """Un POST pasado solo puede cambiar el peso: el resto del perfil queda igual."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    before = read_profile(client, headers)

    response = post(client, headers, {"weight": 75, "recorded_at": day(-10)})

    assert response.status_code == 201
    after = read_profile(client, headers)
    assert after["profile"]["weight"] == 75
    before["profile"]["weight"] = after["profile"]["weight"]
    assert after == before


# SDD: 016 REQ-009 AC-009.5
def test_a_metric_of_today_keeps_the_profile_weight_of_a_later_dated_metric(
    client, registered_user
):
    """Con una medición de mañana (80), registrar 79 hoy deja el perfil en 80."""
    headers = registered_user["headers"]
    save_profile(client, headers, PROFILE_KG)
    assert post(client, headers, {"weight": 80, "recorded_at": day(1)}).status_code == 201

    response = post(client, headers, {"weight": 79, "recorded_at": day(0)})

    assert response.status_code == 201
    assert read_profile(client, headers)["profile"]["weight"] == 80


# SDD: 016 NFR-001 AC-N001.1
@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer token-invalido"}],
    ids=["sin-token", "token-invalido"],
)
def test_post_with_a_past_date_requires_a_valid_session(client, registered_user, headers):
    """Sin token o con uno inválido: 401 y ninguna medición ni perfil cambia."""
    own = registered_user["headers"]
    save_profile(client, own, PROFILE_KG)
    profile_before = read_profile(client, own)

    response = post(client, headers, {"weight": 70, "recorded_at": day(-5)})

    assert response.status_code == 401
    assert listing(client, own) == []
    assert read_profile(client, own) == profile_before


# SDD: 016 NFR-001 AC-N001.2
def test_a_past_post_with_the_user_id_of_another_user_creates_its_own(client, app):
    """A envía el user_id de B con la fecha en que B ya tiene medición: 201 propio y B intacto."""
    user_a = create_user(app, "a@example.com")
    user_b = create_user(app, "b@example.com")
    save_profile(client, user_b["headers"], PROFILE_KG)
    seeded = post(client, user_b["headers"], {"weight": 80, "recorded_at": day(-5)})
    assert seeded.status_code == 201
    b_history = listing(client, user_b["headers"])
    b_profile = read_profile(client, user_b["headers"])

    response = post(
        client,
        user_a["headers"],
        {"weight": 70, "user_id": user_b["id"], "recorded_at": day(-5)},
    )

    assert response.status_code == 201
    assert len(listing(client, user_a["headers"])) == 1
    assert listing(client, user_b["headers"]) == b_history
    assert read_profile(client, user_b["headers"]) == b_profile
