"""Tests de INTEGRACIÓN del reloj fijable de la app (spec 020, REQ-005 y
NFR-001): cliente HTTP real contra la app, los servicios y los repositorios
reales y Postgres de prueba. Con la configuración de pruebas el instante
«actual» del servidor se fija con el fixture `app_clock`; con las
configuraciones de producción y desarrollo (apps de `make_app`) el reloj es
siempre el real y no se puede alterar desde la petición.
"""

import re
from datetime import datetime, timezone

from extensions import email_sender

NOW = datetime(2026, 10, 12, 12, 0, 0)
METRICS_URL = "/api/body-metrics"
REGISTER_URL = "/api/auth/register"
PASSWORD = "ClaveSegura123"

DATE_TOO_OLD = {"error": "La fecha de la medición no puede tener más de un año de antigüedad"}
DATE_FUTURE = {"error": "La fecha de la medición no puede ser futura"}
AGE_RANGE = {"error": "Debes tener entre 14 y 100 años"}
INVALID_LINK = {"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}
PROD_URL = "https://fitnerd.betofallas.dev"


def register_payload(email="ana@example.com", date_of_birth="2000-01-01"):
    return {
        "email": email,
        "password": PASSWORD,
        "first_name": "Ana",
        "last_name": "Pérez",
        "date_of_birth": date_of_birth,
    }


def register_headers(client, email="ana@example.com"):
    """Registra un usuario por la API y devuelve sus cabeceras de sesión."""
    response = client.post(REGISTER_URL, json=register_payload(email))
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.get_json()['token']}"}


def post_metric(client, headers, payload, **kwargs):
    return client.post(METRICS_URL, json=payload, headers=headers, **kwargs)


def metrics_list(client, headers):
    response = client.get(METRICS_URL, headers=headers)
    assert response.status_code == 200
    return response.get_json()


def utc_today():
    return datetime.now(timezone.utc).date()


def token_from_outbox():
    message = email_sender.transport.outbox[-1]
    match = re.search(r"token=([A-Za-z0-9_-]+)", message.text)
    assert match, "el correo no contiene un enlace con token"
    return match.group(1)


def forgot(client, email="ana@example.com"):
    return client.post(
        "/api/auth/forgot-password",
        json={"email": email},
        headers={"X-Forwarded-For": "203.0.113.50"},
    )


def reset(client, token):
    return client.post("/api/auth/reset-password", json={"token": token, "password": "NuevaClave456"})


# --------------------------------------------------------------------------
# Mediciones con el instante fijado
# --------------------------------------------------------------------------


# SDD: 020 REQ-005 AC-005.1
def test_post_without_recorded_at_uses_the_fixed_date(client, app_clock):
    app_clock.set(NOW)
    headers = register_headers(client)

    response = post_metric(client, headers, {"weight": 80})

    assert response.status_code == 201
    assert response.get_json()["recorded_at"] == "2026-10-12"


# SDD: 020 REQ-005 AC-005.2
def test_post_accepts_a_date_one_year_back_and_rejects_one_day_more(client, app_clock):
    app_clock.set(NOW)
    headers = register_headers(client)

    accepted = post_metric(client, headers, {"weight": 80, "recorded_at": "2025-10-11"})
    rejected = post_metric(client, headers, {"weight": 80, "recorded_at": "2025-10-10"})

    assert accepted.status_code == 201
    assert rejected.status_code == 400
    assert rejected.get_json() == DATE_TOO_OLD
    assert [m["recorded_at"] for m in metrics_list(client, headers)] == ["2025-10-11"]


# SDD: 020 REQ-005 AC-005.3
def test_post_accepts_tomorrow_and_rejects_the_day_after_with_the_fixed_instant(client, app_clock):
    app_clock.set(NOW)
    headers = register_headers(client)

    accepted = post_metric(client, headers, {"weight": 80, "recorded_at": "2026-10-13"})
    rejected = post_metric(client, headers, {"weight": 80, "recorded_at": "2026-10-14"})

    assert accepted.status_code == 201
    assert rejected.status_code == 400
    assert rejected.get_json() == DATE_FUTURE


# SDD: 020 REQ-005 AC-005.5
def test_the_default_date_changes_exactly_at_midnight_utc(client, app_clock):
    headers = register_headers(client)

    app_clock.set(datetime(2026, 10, 12, 23, 59, 0))
    before_midnight = post_metric(client, headers, {"weight": 80})
    app_clock.set(datetime(2026, 10, 13, 0, 0, 0))
    after_midnight = post_metric(client, headers, {"weight": 80})

    assert before_midnight.get_json()["recorded_at"] == "2026-10-12"
    assert after_midnight.get_json()["recorded_at"] == "2026-10-13"


# SDD: 020 REQ-005 AC-005.6
def test_without_a_fixed_instant_the_real_utc_date_is_used(client, app_clock):
    headers = register_headers(client)
    before = utc_today()

    response = post_metric(client, headers, {"weight": 80})

    after = utc_today()
    assert response.status_code == 201
    assert response.get_json()["recorded_at"] in {before.isoformat(), after.isoformat()}


# SDD: 020 REQ-005 AC-005.6
def test_after_a_reset_the_real_utc_date_is_used_again(client, app_clock):
    headers = register_headers(client)
    app_clock.set(NOW)
    assert post_metric(client, headers, {"weight": 80}).get_json()["recorded_at"] == "2026-10-12"

    app_clock.reset()
    before = utc_today()
    response = post_metric(client, headers, {"weight": 81})
    after = utc_today()

    assert response.get_json()["recorded_at"] in {before.isoformat(), after.isoformat()}


# SDD: 020 REQ-005 AC-005.9
def test_two_posts_without_a_date_with_the_same_instant_update_a_single_metric(client, app_clock):
    app_clock.set(NOW)
    headers = register_headers(client)

    first = post_metric(client, headers, {"weight": 80})
    second = post_metric(client, headers, {"weight": 79})

    assert first.get_json()["recorded_at"] == "2026-10-12"
    assert second.get_json()["recorded_at"] == "2026-10-12"
    assert second.get_json()["id"] == first.get_json()["id"]
    listed = metrics_list(client, headers)
    assert len(listed) == 1
    assert listed[0]["weight"] == 79


# --------------------------------------------------------------------------
# Edad en el registro y plazo del enlace con el instante fijado
# --------------------------------------------------------------------------


# SDD: 020 REQ-005 AC-005.4
def test_register_accepts_someone_who_turns_14_on_the_fixed_day(client, app_clock):
    app_clock.set(NOW)

    response = client.post(REGISTER_URL, json=register_payload(date_of_birth="2012-10-12"))

    assert response.status_code == 201


# SDD: 020 REQ-005 AC-005.4
def test_register_rejects_someone_who_turns_14_the_day_after_the_fixed_day(client, app_clock):
    app_clock.set(NOW)

    response = client.post(REGISTER_URL, json=register_payload(date_of_birth="2012-10-13"))

    assert response.status_code == 400
    assert response.get_json() == AGE_RANGE


# SDD: 020 REQ-005 AC-005.7
def test_reset_link_still_works_at_4_minutes_59_seconds(client, app_clock):
    app_clock.set(datetime(2026, 10, 12, 12, 0, 0))
    register_headers(client)
    assert forgot(client).status_code == 200
    token = token_from_outbox()

    app_clock.set(datetime(2026, 10, 12, 12, 4, 59))
    response = reset(client, token)

    assert response.status_code == 200
    assert response.get_json() == {"message": "Contraseña actualizada"}


# SDD: 020 REQ-005 AC-005.8
def test_reset_link_has_expired_at_exactly_5_minutes(client, app_clock):
    app_clock.set(datetime(2026, 10, 12, 12, 0, 0))
    register_headers(client)
    assert forgot(client).status_code == 200
    token = token_from_outbox()

    app_clock.set(datetime(2026, 10, 12, 12, 5, 0))
    response = reset(client, token)

    assert response.status_code == 400
    assert response.get_json() == INVALID_LINK


# --------------------------------------------------------------------------
# NFR-001: el instante solo se fija en pruebas
# --------------------------------------------------------------------------


# SDD: 020 NFR-001 AC-N001.1
def test_production_app_uses_the_real_utc_date(make_app):
    prod_app = make_app("production", FRONTEND_BASE_URL=PROD_URL)
    prod_client = prod_app.test_client()
    headers = register_headers(prod_client)
    before = utc_today()

    response = post_metric(prod_client, headers, {"weight": 80})

    after = utc_today()
    assert response.status_code == 201
    assert response.get_json()["recorded_at"] in {before.isoformat(), after.isoformat()}


# SDD: 020 NFR-001 AC-N001.1
def test_development_app_uses_the_real_utc_date(make_app):
    dev_app = make_app("development", FRONTEND_BASE_URL=None)
    dev_client = dev_app.test_client()
    headers = register_headers(dev_client)
    before = utc_today()

    response = post_metric(dev_client, headers, {"weight": 80})

    after = utc_today()
    assert response.status_code == 201
    assert response.get_json()["recorded_at"] in {before.isoformat(), after.isoformat()}


# SDD: 020 NFR-001 AC-N001.2
def test_production_app_ignores_dates_and_times_sent_in_the_request(make_app):
    prod_app = make_app("production", FRONTEND_BASE_URL=PROD_URL)
    prod_client = prod_app.test_client()
    headers = register_headers(prod_client)
    headers.update(
        {
            "Date": "Wed, 01 Jan 2020 00:00:00 GMT",
            "X-Now": "2020-01-01T00:00:00Z",
            "X-Fixed-Now": "2020-01-01T00:00:00Z",
        }
    )
    before = utc_today()

    response = post_metric(
        prod_client, headers, {"weight": 80, "now": "2020-01-01T00:00:00Z"}
    )

    after = utc_today()
    assert response.status_code == 201
    assert response.get_json()["recorded_at"] in {before.isoformat(), after.isoformat()}
    assert "2020-01-01" not in response.get_data(as_text=True)
