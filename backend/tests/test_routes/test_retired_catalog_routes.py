"""Tests de INTEGRACION de la retirada del catalogo, los favoritos y el plan
semanal (spec 012): cliente HTTP real contra la app y Postgres de test.

Las rutas retiradas ya no existen en el `url_map`, asi que Werkzeug lanza
`NotFound` y `handle_http_exception` lo traduce a `{"error": ...}` con 404,
con cualquier metodo, con o sin sesion y con cualquier rol (el 404 llega antes
que `@require_auth` o `@require_admin`).
"""

import uuid

import pytest
from werkzeug.exceptions import NotFound

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


def assert_not_found(response):
    assert response.status_code == 404
    body = response.get_json()
    assert body is not None and "error" in body


def assert_rule_retired(app, method, path):
    """La ruta no existe en el url_map: un 404 por entidad inexistente no basta,
    porque una ruta viva con un UUID desconocido tambien responde 404."""
    adapter = app.url_map.bind("localhost")
    try:
        adapter.match(path, method=method)
    except NotFound:
        return
    pytest.fail(f"{method} {path} sigue registrada en el url_map")


# SDD: 012 REQ-001 AC-001.1
@pytest.mark.parametrize(
    "path",
    [
        "/api/body-regions",
        "/api/exercise-categories",
        "/api/exercises",
        "/api/favorites",
        "/api/weekly-plan",
    ],
)
def test_retired_list_endpoints_return_404_for_a_regular_user(client, registered_user, path):
    """Un usuario autenticado con rol user recibe 404 con la clave error en
    los cinco GET de lista retirados."""
    response = client.get(path, headers=registered_user["headers"])

    assert_not_found(response)


# SDD: 012 REQ-001 AC-001.2
def test_retired_admin_post_endpoints_return_404(client, admin_headers):
    """Un admin que crea regiones, categorias o ejercicios con un cuerpo
    valido segun el contrato anterior recibe 404 con error."""
    created_region = client.post(
        "/api/body-regions", json={"name": "Tren Superior"}, headers=admin_headers
    )
    created_category = client.post(
        "/api/exercise-categories",
        json={"name": "Pecho", "body_region_id": str(uuid.uuid4())},
        headers=admin_headers,
    )
    created_exercise = client.post(
        "/api/exercises",
        json={
            "category_id": str(uuid.uuid4()),
            "name": "Press",
            "video_url": "https://youtu.be/x",
        },
        headers=admin_headers,
    )

    assert_not_found(created_region)
    assert_not_found(created_category)
    assert_not_found(created_exercise)


# SDD: 012 REQ-001 AC-001.2
@pytest.mark.parametrize(
    "base", ["/api/body-regions", "/api/exercise-categories", "/api/exercises"]
)
def test_retired_admin_delete_endpoints_return_404(app, client, admin_headers, base):
    """Un admin que borra una region, categoria o ejercicio por UUID recibe
    404 con error: la ruta ya no existe."""
    path = f"{base}/{uuid.uuid4()}"
    assert_rule_retired(app, "DELETE", path)

    response = client.delete(path, headers=admin_headers)

    assert_not_found(response)


# SDD: 012 REQ-001 AC-001.3
def test_retired_favorite_endpoints_return_404(app, client, registered_user):
    """POST y DELETE de /api/exercises/{id}/favorites responden 404 con error."""
    path = f"/api/exercises/{uuid.uuid4()}/favorites"
    assert_rule_retired(app, "POST", path)
    assert_rule_retired(app, "DELETE", path)

    added = client.post(path, headers=registered_user["headers"])
    removed = client.delete(path, headers=registered_user["headers"])

    assert_not_found(added)
    assert_not_found(removed)


# SDD: 012 REQ-001 AC-001.3
def test_retired_weekly_plan_write_endpoints_return_404(app, client, registered_user):
    """POST /api/weekly-plan con cuerpo valido y DELETE /api/weekly-plan/{id}
    responden 404 con error."""
    delete_path = f"/api/weekly-plan/{uuid.uuid4()}"
    assert_rule_retired(app, "POST", "/api/weekly-plan")
    assert_rule_retired(app, "DELETE", delete_path)

    added = client.post(
        "/api/weekly-plan",
        json={"exercise_id": str(uuid.uuid4()), "day_of_week": 1},
        headers=registered_user["headers"],
    )
    removed = client.delete(delete_path, headers=registered_user["headers"])

    assert_not_found(added)
    assert_not_found(removed)


# SDD: 012 REQ-001 AC-001.4
@pytest.mark.parametrize("path", ["/api/exercises", "/api/weekly-plan"])
def test_retired_endpoints_return_404_not_401_without_authorization(client, path):
    """Sin cabecera de autorizacion la respuesta es 404 (no 401) con error."""
    response = client.get(path)

    assert_not_found(response)


# SDD: 012 REQ-002 AC-002.1
def test_url_map_keeps_the_rules_of_the_remaining_areas(app):
    """No regresion: las reglas de auth, perfil, metricas, coach, feedback y
    salud siguen registradas."""
    rules = {rule.rule for rule in app.url_map.iter_rules()}

    for expected in (
        "/api/auth/login",
        "/api/profile",
        "/api/body-metrics",
        "/api/body-metrics/analysis",
        "/api/coach/ask",
        "/api/coach/feedback",
        "/api/feedback",
        "/api/health",
    ):
        assert expected in rules


# SDD: 012 REQ-002 AC-002.2
def test_health_still_returns_200(client):
    """No regresion: GET /api/health responde 200."""
    response = client.get("/api/health")

    assert response.status_code == 200


# SDD: 012 REQ-002 AC-002.3
def test_profile_and_body_metrics_keep_their_format(client, registered_user):
    """No regresion: con perfil guardado, GET /api/profile y GET
    /api/body-metrics responden 200 con el formato de siempre."""
    headers = registered_user["headers"]
    saved = client.put("/api/profile", json=PROFILE_BODY, headers=headers)
    assert saved.status_code == 200

    profile_response = client.get("/api/profile", headers=headers)
    metrics_response = client.get("/api/body-metrics", headers=headers)

    assert profile_response.status_code == 200
    profile = profile_response.get_json()
    assert profile["onboarding_completed"] is True
    assert profile["date_of_birth"] == "1990-06-15"
    assert profile["profile"]["gender"] == "male"
    assert profile["profile"]["goal"] == "maintain"
    assert metrics_response.status_code == 200
    assert isinstance(metrics_response.get_json(), list)
