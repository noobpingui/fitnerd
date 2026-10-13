"""Tests de INTEGRACIÓN de POST /api/body-metrics/analysis (spec 010): cliente
HTTP real contra la app, el service y los repositories reales y Postgres de
test. Ningún caso llega al modelo de IA (no se llama a Anthropic): los casos
que sí lo generan (200 con análisis y 503) se prueban en los unitarios con un
`FakeLLMClient`. El reloj del servidor es el real, así que las fechas se
calculan relativas a la fecha UTC de hoy.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from extensions import db
from models.progress_analysis import ProgressAnalysis
from models.user import User

URL = "/api/body-metrics/analysis"
EMAIL = "test@example.com"

NO_PROFILE_MESSAGE = "Completa tu perfil para poder generar un análisis."
NO_DATA_MESSAGE = (
    "Todavía no hay registros de métricas en los últimos 12 meses. "
    "Registra al menos uno para poder generar un análisis."
)
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 2 análisis cada 24 horas. "
    "Vuelve a intentarlo más tarde."
)
INVALID_MESSAGE = "Los datos del análisis no son válidos."

PROFILE_BODY = {
    "date_of_birth": "1990-06-15",
    "gender": "male",
    "height_unit": "cm",
    "height_cm": 180,
    "weight_unit": "kg",
    "weight": 80,
    "activity_level": "high",
    "goal": "lose",
}


def utc_today():
    return datetime.now(timezone.utc).date()


def valid_body():
    """Cuerpo válido (plan 3.2) sin ritmo: el caso más simple."""
    return {
        "today": utc_today().isoformat(),
        "indicators": {
            "weight": "80 kg",
            "weight_change_30d": None,
            "body_fat": None,
            "body_fat_change_30d": None,
            "rate": None,
            "pace_status": "insufficient",
            "fat_mass": None,
            "lean_mass": None,
            "bmi": "24,7",
            "ffmi": None,
            "streak_weeks": 1,
            "records_last_30_days": 1,
            "total_records": 1,
            "last_record_date": (utc_today() - timedelta(days=1)).isoformat(),
        },
        "rate_kg_per_week": None,
        "latest_weight_kg": None,
        "calories": {"maintenance_kcal": 2750, "target_kcal": 2200},
    }


def save_profile(client, headers):
    response = client.put("/api/profile", json=PROFILE_BODY, headers=headers)
    assert response.status_code == 200


def add_measurement(client, headers):
    response = client.post(
        "/api/body-metrics",
        json={"weight": 80, "recorded_at": (utc_today() - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert response.status_code in (200, 201)


def seed_analyses(app, count):
    """Siembra `count` análisis recientes del usuario registrado."""
    with app.app_context():
        user_id = db.session.scalars(select(User.id).where(User.email == EMAIL)).one()
        for _ in range(count):
            db.session.add(ProgressAnalysis(user_id=user_id))
        db.session.commit()


def analysis_rows(app):
    with app.app_context():
        return db.session.scalar(select(func.count()).select_from(ProgressAnalysis))


# SDD: REQ-010 AC-010.4
def test_analysis_without_a_token_is_unauthorized(client):
    """Sin sesión, el análisis responde 401."""
    response = client.post(URL, json=valid_body())

    assert response.status_code == 401


# SDD: REQ-009 AC-009.1
def test_without_a_profile_and_with_measurements_it_returns_conflict(
    client, app, registered_user
):
    """Sin perfil y con mediciones: 409 con el mensaje y sin ninguna fila nueva."""
    headers = registered_user["headers"]
    add_measurement(client, headers)

    response = client.post(URL, json=valid_body(), headers=headers)

    assert response.status_code == 409
    assert response.get_json() == {"error": NO_PROFILE_MESSAGE}
    assert analysis_rows(app) == 0


# SDD: REQ-009 AC-009.2
def test_without_a_profile_and_without_measurements_it_returns_conflict(
    client, app, registered_user
):
    """Sin perfil ni mediciones: 409 y no el mensaje de falta de datos."""
    response = client.post(URL, json=valid_body(), headers=registered_user["headers"])

    assert response.status_code == 409
    assert response.get_json() == {"error": NO_PROFILE_MESSAGE}
    assert analysis_rows(app) == 0


# SDD: REQ-009 AC-009.3
def test_without_a_profile_the_conflict_wins_over_the_rate_limit(
    client, app, registered_user
):
    """Sin perfil y con dos análisis en 24 horas: 409, no 429, y sin filas nuevas."""
    headers = registered_user["headers"]
    add_measurement(client, headers)
    seed_analyses(app, 2)

    response = client.post(URL, json=valid_body(), headers=headers)

    assert response.status_code == 409
    assert response.get_json() == {"error": NO_PROFILE_MESSAGE}
    assert analysis_rows(app) == 2


# SDD: REQ-010 AC-010.2
def test_with_a_profile_and_no_measurements_it_returns_the_corrected_no_data_text(
    client, app, registered_user
):
    """Con perfil y sin mediciones: 200 con el texto corregido, sin sugerencia ni fila."""
    headers = registered_user["headers"]
    save_profile(client, headers)

    response = client.post(URL, headers=headers)

    assert response.status_code == 200
    assert response.get_json() == {
        "analysis": NO_DATA_MESSAGE,
        "calorie_suggestion": None,
    }
    assert analysis_rows(app) == 0


# SDD: REQ-010 AC-010.1
def test_with_the_quota_exhausted_it_returns_too_many_requests(
    client, app, registered_user
):
    """Con perfil, mediciones, dos análisis recientes y cuerpo válido: 429."""
    headers = registered_user["headers"]
    save_profile(client, headers)
    add_measurement(client, headers)
    seed_analyses(app, 2)

    response = client.post(URL, json=valid_body(), headers=headers)

    assert response.status_code == 429
    assert response.get_json() == {"error": RATE_LIMIT_MESSAGE}
    assert analysis_rows(app) == 2


# SDD: NFR-001 AC-N001.1
def test_an_invalid_body_returns_bad_request_and_creates_no_row(
    client, app, registered_user
):
    """Un cuerpo con un estado de ritmo desconocido es un 400 que no cuenta."""
    headers = registered_user["headers"]
    save_profile(client, headers)
    add_measurement(client, headers)
    body = valid_body()
    body["indicators"]["pace_status"] = "desconocido"

    response = client.post(URL, json=body, headers=headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": INVALID_MESSAGE}
    assert analysis_rows(app) == 0
