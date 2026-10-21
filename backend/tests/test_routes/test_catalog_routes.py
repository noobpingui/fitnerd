"""Integración de GET /api/catalog/search (spec 023) contra el Postgres de
prueba. Voyage y Redis son dobles instalados en los singletons
`embedding_client` y `rate_limiter` (se restauran al terminar): nada sale a la
red y la búsqueda del catálogo no debe usarlos (NFR-001).
"""

import pytest

from extensions import db, embedding_client, jwt_manager, rate_limiter
from models import CatalogFood
from tests.fakes import FakeRedisClient, FakeVoyageClient

URL = "/api/catalog/search"
EMPTY_MESSAGE = "Escribe qué alimento quieres buscar."
SHORT_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
LONG_MESSAGE = "La búsqueda no puede superar los 100 caracteres."


@pytest.fixture(autouse=True)
def redis_fake():
    """Sustituye el cliente de Redis del `RateLimiter` por uno en memoria."""
    original = rate_limiter.client
    fake = FakeRedisClient()
    rate_limiter.client = fake
    yield fake
    rate_limiter.client = original


@pytest.fixture(autouse=True)
def voyage():
    """Sustituye el cliente de Voyage del singleton por un doble."""
    original = embedding_client.client
    fake = FakeVoyageClient()
    embedding_client.client = fake
    yield fake
    embedding_client.client = original


def auth_headers(app, user_id="user-1", minutes=30):
    with app.app_context():
        token = jwt_manager.generate_token({"id": user_id, "user_role": "user"}, minutes)
    return {"Authorization": f"Bearer {token}"}


def seed(app, *foods):
    """Inserta alimentos del catálogo. Cada uno es un dict con `id` y `name`;
    el resto es opcional (origen `manual` con referencia por defecto)."""
    with app.app_context():
        for spec in foods:
            fields = dict(
                synonyms=[],
                calories_kcal=100.0,
                protein_g=10.0,
                carbs_g=10.0,
                fat_g=5.0,
                source="manual",
                fdc_id=None,
                reference="Tabla de prueba",
            )
            fields.update(spec)
            db.session.add(CatalogFood(**fields))
        db.session.commit()


def search(client, app, query, user_id="user-1", **extra):
    params = {"q": query, **extra} if query is not None else dict(extra)
    return client.get(URL, query_string=params, headers=auth_headers(app, user_id))


def names_of(response):
    assert response.status_code == 200
    return [item["name"] for item in response.get_json()["results"]]


WHITE_RICE = {"id": "arroz-blanco-cocido", "name": "Arroz blanco cocido"}
BROWN_RICE = {"id": "arroz-integral-cocido", "name": "Arroz integral cocido"}
BLACK_BEANS = {"id": "frijoles-negros-cocidos", "name": "Frijoles negros cocidos"}
CHICKEN = {
    "id": "pechuga-de-pollo-a-la-plancha",
    "name": "Pechuga de pollo a la plancha",
    "synonyms": ["pollo asado"],
    "calories_kcal": 165.0,
    "protein_g": 31.0,
    "carbs_g": 0.0,
    "fat_g": 3.57,
    "source": "usda",
    "fdc_id": 171477,
    "reference": "SR Legacy",
}


# SDD: 023 REQ-004 AC-004.1
def test_rice_query_returns_both_rices_white_first_and_no_beans(client, app):
    """`q=arroz`: los dos arroces, primero el blanco, y sin los frijoles."""
    seed(app, BLACK_BEANS, BROWN_RICE, WHITE_RICE)

    response = search(client, app, "arroz")

    assert names_of(response) == ["Arroz blanco cocido", "Arroz integral cocido"]


# SDD: 023 REQ-004 AC-004.1
def test_query_matches_a_synonym_and_ignores_case_accents_and_plurals(client, app):
    """Por sinónimo, sin tildes ni mayúsculas y con plural."""
    seed(app, CHICKEN)

    assert names_of(search(client, app, "POLLO ASADO")) == ["Pechuga de pollo a la plancha"]
    assert names_of(search(client, app, "pechugas")) == ["Pechuga de pollo a la plancha"]


# SDD: 023 REQ-004 AC-004.8
def test_search_returns_exactly_20_of_30_matches(client, app):
    """30 alimentos coinciden: la respuesta tiene exactamente 20."""
    seed(app, *[{"id": f"fruta-{n:02d}", "name": f"Fruta {n:02d}"} for n in range(30)])

    response = search(client, app, "fruta")

    assert len(names_of(response)) == 20


# SDD: 023 REQ-004 AC-004.8
def test_limit_parameter_is_ignored(client, app):
    """Con `limit=50` también son 20; cualquier otro parámetro se ignora."""
    seed(app, *[{"id": f"fruta-{n:02d}", "name": f"Fruta {n:02d}"} for n in range(30)])

    response = search(client, app, "fruta", limit=50, otro="x")

    assert len(names_of(response)) == 20


# SDD: 023 REQ-004 AC-004.9
def test_query_without_matches_returns_an_empty_list(client, app):
    """`q=zzxqv`: 200 con `results` vacío."""
    seed(app, WHITE_RICE)

    response = search(client, app, "zzxqv")

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 023 REQ-004 AC-004.11
def test_search_on_an_empty_catalog_returns_an_empty_list(client, app):
    """Catálogo sin cargar: 200 con `results` vacío."""
    response = search(client, app, "arroz")

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 023 REQ-004 AC-004.10
def test_result_has_exactly_the_contract_format(client, app):
    """Cada resultado trae `id`, `name` y `per_100g` con los cuatro valores y
    nada más: ni sinónimos, ni FDC ID, ni fuente."""
    seed(app, CHICKEN)

    response = search(client, app, "pechuga")

    assert response.status_code == 200
    assert response.get_json() == {
        "results": [
            {
                "id": "pechuga-de-pollo-a-la-plancha",
                "name": "Pechuga de pollo a la plancha",
                "per_100g": {
                    "calories_kcal": 165.0,
                    "protein_g": 31.0,
                    "carbs_g": 0.0,
                    "fat_g": 3.57,
                },
            }
        ]
    }


# SDD: 023 REQ-004 AC-004.10
def test_result_values_are_numbers_not_strings(client, app):
    """Los valores salen como números JSON."""
    seed(app, CHICKEN)

    result = search(client, app, "pechuga").get_json()["results"][0]

    assert all(isinstance(value, float) for value in result["per_100g"].values())


# SDD: 023 REQ-005 AC-005.1
@pytest.mark.parametrize("query_string", ["", "q=", "q=%20%20"])
def test_missing_empty_or_blank_query_returns_400(client, app, query_string):
    """Sin `q`, con `q=` o con `q=%20%20`: 400 con el mensaje exacto."""
    response = client.get(f"{URL}?{query_string}", headers=auth_headers(app))

    assert response.status_code == 400
    assert response.get_json() == {"error": EMPTY_MESSAGE}


# SDD: 023 REQ-005 AC-005.2
def test_one_character_query_returns_400(client, app):
    """`q=a`: 400 con el mensaje de longitud mínima."""
    response = search(client, app, "a")

    assert response.status_code == 400
    assert response.get_json() == {"error": SHORT_MESSAGE}


# SDD: 023 REQ-005 AC-005.3
def test_101_character_query_returns_400_and_100_returns_200(client, app):
    """101 caracteres dan 400 con el mensaje de longitud máxima; 100, 200."""
    too_long = search(client, app, "a" * 101)
    exact = search(client, app, "a" * 100)

    assert too_long.status_code == 400
    assert too_long.get_json() == {"error": LONG_MESSAGE}
    assert exact.status_code == 200


# SDD: 023 REQ-005 AC-005.4
def test_request_without_authorization_header_returns_401(client):
    """Sin cabecera de autorización: 401."""
    response = client.get(URL, query_string={"q": "arroz"})

    assert response.status_code == 401


# SDD: 023 REQ-005 AC-005.4
def test_malformed_token_returns_401(client):
    """Un token mal formado da 401."""
    response = client.get(
        URL, query_string={"q": "arroz"}, headers={"Authorization": "Bearer not-a-token"}
    )

    assert response.status_code == 401


# SDD: 023 REQ-005 AC-005.4
def test_expired_token_returns_401(client, app):
    """Un token caducado da 401."""
    response = client.get(
        URL, query_string={"q": "arroz"}, headers=auth_headers(app, minutes=-5)
    )

    assert response.status_code == 401


# SDD: 023 REQ-005 NFR-001 AC-N001.1
def test_valid_searches_never_ask_the_embedding_provider(client, app, voyage):
    """Búsquedas válidas (con y sin resultados): Voyage no recibe ninguna llamada."""
    seed(app, WHITE_RICE)

    assert search(client, app, "arroz").status_code == 200
    assert search(client, app, "zzxqv").status_code == 200

    assert voyage.calls == []


# SDD: 023 REQ-005 NFR-001 AC-N001.1
def test_a_failing_embedding_provider_does_not_affect_the_search(client, app, voyage):
    """Aunque Voyage fallara, la búsqueda del catálogo responde 200."""
    seed(app, WHITE_RICE)
    voyage.raise_error = RuntimeError("voyage down")

    response = search(client, app, "arroz")

    assert names_of(response) == ["Arroz blanco cocido"]
    assert voyage.calls == []


# SDD: 023 NFR-001 AC-N001.2
def test_search_number_31_in_a_minute_is_still_200_and_uses_no_counter(
    client, app, redis_fake
):
    """31 búsquedas válidas seguidas del mismo usuario: todas 200 y el
    limitador de Redis no cuenta nada."""
    seed(app, WHITE_RICE)

    statuses = [search(client, app, "arroz").status_code for _ in range(31)]

    assert statuses == [200] * 31
    assert redis_fake.counts == {}
