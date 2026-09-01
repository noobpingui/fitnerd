"""Tests de integracion enfocados en AUTORIZACION - un patron distinto al
de test_auth_routes.py (que probaba autenticacion: quien sos). Aca se prueba
que @require_admin realmente bloquea a quien no tiene el rol, no solo a
quien no tiene ningun token.
"""

from models import BodyRegion, ExerciseCategory


def test_creating_an_exercise_without_any_token_is_unauthorized(client):
    response = client.post(
        "/api/exercises",
        json={"category_id": "00000000-0000-0000-0000-000000000000", "name": "x", "video_url": "https://x"},
    )

    assert response.status_code == 401


def test_creating_an_exercise_as_a_regular_user_is_forbidden(client, registered_user):
    # registered_user pasa por /api/auth/register, que siempre crea
    # usuarios con el rol default ("user") - no hay forma de que este
    # token tenga user_role "admin".
    response = client.post(
        "/api/exercises",
        json={"category_id": "00000000-0000-0000-0000-000000000000", "name": "x", "video_url": "https://x"},
        headers=registered_user["headers"],
    )

    # 403 (Forbidden), no 401 (Unauthorized): el token es valido y sabemos
    # quien es - simplemente no tiene permiso para esta accion.
    assert response.status_code == 403


def test_creating_an_exercise_as_admin_succeeds(client, admin_headers, db_session):
    # A diferencia de los dos tests de arriba (que nunca deberian llegar al
    # service), este SI necesita una categoria real en la base para que la
    # creacion tenga exito de punta a punta - la sembramos directo con
    # db_session en vez de por HTTP, porque lo que este test quiere probar
    # es la ruta de ejercicios, no la de categorias.
    region = BodyRegion(name="Región de prueba")
    db_session.add(region)
    db_session.flush()  # asigna region.id sin hacer commit todavia

    category = ExerciseCategory(body_region_id=region.id, name="Categoría de prueba")
    db_session.add(category)
    db_session.commit()

    response = client.post(
        "/api/exercises",
        json={
            "category_id": str(category.id),
            "name": "Sentadilla",
            "video_url": "https://example.com/video",
        },
        headers=admin_headers,
    )

    assert response.status_code == 201
    assert response.get_json()["name"] == "Sentadilla"
