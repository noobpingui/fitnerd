"""Integración de GET /api/foods/search (spec 021) contra el Postgres de
prueba. Voyage y Redis son dobles instalados en los singletons
`embedding_client` y `rate_limiter` (se restauran al terminar): nada sale a
la red.
"""

import pytest

from extensions import db, embedding_client, jwt_manager, rate_limiter
from models import Food
from repositories.food_repository import FoodRepository
from services.food_import_service import FoodImportService, UsdaSource
from tests.fakes import (
    FakeFoodEmbeddingClient,
    FakeRedisClient,
    FakeVoyageClient,
    basis_vector,
    vector_with_similarity,
)
from tests.usda_samples import FOUNDATION_TYPE, macro_nutrients, write_usda_dataset
from unit_of_work.unit_of_work import UnitOfWork

URL = "/api/foods/search"
EMPTY_MESSAGE = "Escribe qué alimento quieres buscar."
SHORT_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
LONG_MESSAGE = "La búsqueda no puede superar los 100 caracteres."
LIMIT_MESSAGE = "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
UNAVAILABLE_MESSAGE = "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."

# Vector que la consulta recibe por defecto: ortogonal a los de los alimentos.
UNRELATED = basis_vector(5)


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
    """Sustituye el cliente de Voyage del singleton por un doble. Por defecto,
    toda consulta recibe `basis_vector(1)`."""
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
    """Inserta alimentos. Cada uno es un dict con `fdc_id` y `description`; el
    resto de campos son opcionales (`data_type` por defecto `foundation`)."""
    with app.app_context():
        for spec in foods:
            fields = {"data_type": "foundation", "embedding": None}
            fields.update(spec)
            db.session.add(Food(**fields))
        db.session.commit()


def search(client, app, query, user_id="user-1", **extra):
    params = {"q": query, **extra} if query is not None else dict(extra)
    return client.get(URL, query_string=params, headers=auth_headers(app, user_id))


def ids_of(response):
    assert response.status_code == 200
    return [item["fdc_id"] for item in response.get_json()["results"]]


CHICKEN = {
    "fdc_id": 171477,
    "description": "Chicken, broilers or fryers, breast, meat only, raw",
    "embedding": basis_vector(10),
}
RICE = {
    "fdc_id": 168878,
    "description": "Rice, white, long-grain, regular, raw",
    "embedding": basis_vector(11),
}


# SDD: 021 REQ-006 AC-006.1
def test_chicken_breast_query_returns_the_chicken_first(client, app):
    """`q=chicken breast` pone el pollo primero y no devuelve el arroz."""
    seed(app, RICE, CHICKEN)

    response = search(client, app, "chicken breast")

    assert response.status_code == 200
    assert ids_of(response)[0] == CHICKEN["fdc_id"]
    assert RICE["fdc_id"] not in ids_of(response)


# SDD: 021 REQ-006 AC-006.2
def test_spanish_query_finds_the_chicken_by_semantic_similarity(client, app, voyage):
    """`q=pechuga de pollo` no comparte palabras con la descripción, pero el
    proveedor la sitúa junto al pollo y este aparece."""
    seed(app, {**CHICKEN, "embedding": basis_vector(0)}, RICE)
    voyage.vectors["pechuga de pollo"] = vector_with_similarity(0.9)

    response = search(client, app, "pechuga de pollo")

    assert response.status_code == 200
    assert CHICKEN["fdc_id"] in ids_of(response)
    assert RICE["fdc_id"] not in ids_of(response)


# SDD: 021 REQ-006 AC-006.3
def test_food_matching_by_text_and_similarity_comes_before_a_similarity_only_match(client, app, voyage):
    """Quien coincide por texto y por similitud va antes que quien solo
    coincide por similitud, aunque este último esté más cerca del vector."""
    seed(
        app,
        {"fdc_id": 1, "description": "Turkey, breast, raw", "embedding": basis_vector(0)},
        {"fdc_id": 2, "description": "Chicken, thigh, raw", "embedding": vector_with_similarity(0.8)},
    )
    voyage.vectors["chicken"] = basis_vector(0)

    response = search(client, app, "chicken")

    assert ids_of(response) == [2, 1]


# SDD: 021 REQ-006 AC-006.4
def test_search_returns_exactly_20_of_30_matches(client, app):
    """Con 30 alimentos que coinciden, la respuesta tiene exactamente 20."""
    seed(app, *({"fdc_id": 100 + n, "description": f"Chicken variety {n}"} for n in range(30)))

    response = search(client, app, "chicken")

    assert response.status_code == 200
    assert len(ids_of(response)) == 20


# SDD: 021 REQ-006 AC-006.5
@pytest.mark.parametrize("query", ["CHICKEN", "  chicken  ", "chicken"])
def test_query_ignores_case_and_surrounding_spaces(client, app, query):
    """El pollo aparece igual con mayúsculas o con espacios en los extremos."""
    seed(app, CHICKEN, RICE)

    response = search(client, app, query)

    assert response.status_code == 200
    assert ids_of(response) == [CHICKEN["fdc_id"]]


# SDD: 021 REQ-006 AC-006.6
def test_food_without_semantic_representation_is_found_by_text(client, app):
    """Un alimento sin vector aparece al buscar una palabra de su descripción."""
    seed(app, {"fdc_id": 5, "description": "Avocado, raw", "embedding": None})

    response = search(client, app, "avocado")

    assert ids_of(response) == [5]


# SDD: 021 REQ-006 AC-006.7
def test_result_has_the_contract_format_with_null_for_missing_data(client, app):
    """Cada resultado trae FDC ID, descripción, origen y los cuatro valores,
    con `null` en los que no tienen dato."""
    seed(
        app,
        {
            "fdc_id": 171477,
            "description": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
            "data_type": "sr_legacy",
            "calories_kcal": 165.0,
            "protein_g": 31.0,
            "carbs_g": None,
            "fat_g": 3.57,
        },
    )

    response = search(client, app, "chicken")

    assert response.get_json() == {
        "results": [
            {
                "fdc_id": 171477,
                "description": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
                "data_type": "sr_legacy",
                "per_100g": {
                    "calories_kcal": 165.0,
                    "protein_g": 31.0,
                    "carbs_g": None,
                    "fat_g": 3.57,
                },
            }
        ]
    }


# SDD: 021 REQ-006 AC-006.8
def test_limit_parameter_is_ignored(client, app):
    """Con `limit=50` la respuesta sigue teniendo exactamente 20 resultados."""
    seed(app, *({"fdc_id": 100 + n, "description": f"Chicken variety {n}"} for n in range(30)))

    response = search(client, app, "chicken", limit=50)

    assert response.status_code == 200
    assert len(ids_of(response)) == 20


# SDD: 021 REQ-006 AC-006.9
def test_foundation_and_sr_legacy_versions_of_the_same_food_are_both_returned(client, app):
    """«Milk, whole, 3.25% milkfat» guardada como Foundation y como SR Legacy
    aparece dos veces, cada una con su FDC ID y su origen."""
    seed(
        app,
        {"fdc_id": 1, "description": "Milk, whole, 3.25% milkfat", "data_type": "foundation"},
        {"fdc_id": 2, "description": "Milk, whole, 3.25% milkfat", "data_type": "sr_legacy"},
    )

    response = search(client, app, "whole milk")

    results = {item["fdc_id"]: item["data_type"] for item in response.get_json()["results"]}
    assert results == {1: "foundation", 2: "sr_legacy"}


# SDD: 021 REQ-007 AC-007.1
def test_query_without_text_match_or_close_similarity_returns_an_empty_list(client, app):
    """Sin coincidencia de texto y con similitud por debajo del mínimo con
    todos, la respuesta es 200 con `results` vacío."""
    seed(app, CHICKEN, RICE)

    response = search(client, app, "zzxqv")

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 021 REQ-007 AC-007.2
def test_search_on_an_empty_database_returns_an_empty_list(client, app):
    """Con una base sin alimentos, la respuesta es 200 con `results` vacío."""
    response = search(client, app, "chicken")

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 021 REQ-008 AC-008.1
@pytest.mark.parametrize("query_string", ["", "q=", "q=%20%20%20"])
def test_missing_empty_or_blank_query_returns_400(client, app, query_string):
    """Sin `q`, con `q=` o con solo espacios: 400 con el mensaje exacto."""
    response = client.get(f"{URL}?{query_string}", headers=auth_headers(app))

    assert response.status_code == 400
    assert response.get_json() == {"error": EMPTY_MESSAGE}


# SDD: 021 REQ-008 AC-008.2
def test_one_character_query_returns_400(client, app):
    """`q=a` da 400 con el mensaje de longitud mínima."""
    response = search(client, app, "a")

    assert response.status_code == 400
    assert response.get_json() == {"error": SHORT_MESSAGE}


# SDD: 021 REQ-008 AC-008.3
def test_101_character_query_returns_400_and_100_returns_200(client, app):
    """101 caracteres dan 400 con el mensaje de longitud máxima; 100, 200."""
    too_long = search(client, app, "a" * 101)
    exact = search(client, app, "a" * 100)

    assert too_long.status_code == 400
    assert too_long.get_json() == {"error": LONG_MESSAGE}
    assert exact.status_code == 200


# SDD: 021 REQ-008 AC-008.4
@pytest.mark.parametrize("query", [None, "", "   ", "a", "a" * 101])
def test_invalid_query_does_not_call_the_provider_or_consume_the_limit(
    client, app, voyage, redis_fake, query
):
    """Una búsqueda que recibe 400 no pide ningún vector y el contador de uso
    del usuario no cambia."""
    response = search(client, app, query)

    assert response.status_code == 400
    assert voyage.calls == []
    assert redis_fake.counts == {}


# SDD: 021 REQ-009 AC-009.1
def test_request_without_authorization_header_returns_401(client, voyage):
    """Sin cabecera de autorización: 401 y ninguna llamada al proveedor."""
    response = client.get(URL, query_string={"q": "chicken"})

    assert response.status_code == 401
    assert voyage.calls == []


# SDD: 021 REQ-009 AC-009.2
def test_malformed_token_returns_401(client):
    """Un token mal formado da 401."""
    response = client.get(
        URL, query_string={"q": "chicken"}, headers={"Authorization": "Bearer not-a-token"}
    )

    assert response.status_code == 401


# SDD: 021 REQ-009 AC-009.2
def test_expired_token_returns_401(client, app):
    """Un token caducado da 401."""
    response = client.get(
        URL, query_string={"q": "chicken"}, headers=auth_headers(app, minutes=-5)
    )

    assert response.status_code == 401


# SDD: 021 REQ-010 AC-010.1
def test_search_number_31_in_a_minute_returns_429_without_calling_the_provider(
    client, app, voyage
):
    """Tras 30 búsquedas válidas, la 31 recibe 429 con el mensaje exacto y no
    se pide ningún vector más."""
    for _ in range(30):
        assert search(client, app, "chicken").status_code == 200
    calls_before = len(voyage.calls)

    response = search(client, app, "chicken")

    assert response.status_code == 429
    assert response.get_json() == {"error": LIMIT_MESSAGE}
    assert len(voyage.calls) == calls_before == 30


# SDD: 021 REQ-010 AC-010.2
def test_the_limit_is_per_user(client, app):
    """Si el usuario A alcanzó el límite, el usuario B sigue recibiendo 200."""
    for _ in range(31):
        search(client, app, "chicken", user_id="user-a")

    assert search(client, app, "chicken", user_id="user-a").status_code == 429
    assert search(client, app, "chicken", user_id="user-b").status_code == 200


# SDD: 021 REQ-010 AC-010.3
def test_search_number_30_in_a_minute_is_still_allowed(client, app):
    """Con 29 búsquedas hechas, la 30 recibe 200."""
    for _ in range(29):
        assert search(client, app, "chicken").status_code == 200

    assert search(client, app, "chicken").status_code == 200


# SDD: 021 REQ-010 AC-010.1
def test_searches_that_end_in_503_also_count_against_the_limit(client, app, voyage):
    """Las búsquedas válidas que terminan en 503 cuentan para el límite."""
    voyage.raise_error = RuntimeError("voyage down")
    for _ in range(30):
        assert search(client, app, "chicken").status_code == 503

    response = search(client, app, "chicken")

    assert response.status_code == 429


# SDD: 021 REQ-011 AC-011.1
def test_provider_failure_returns_503_even_when_the_query_matches_by_text(client, app, voyage):
    """Con el proveedor caído, `q=chicken` (coincide por texto) da 503 con el
    mensaje exacto y sin `results`."""
    seed(app, CHICKEN)
    voyage.raise_error = RuntimeError("voyage down")

    response = search(client, app, "chicken")

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE_MESSAGE}


# SDD: 021 REQ-011 AC-011.2
def test_provider_failure_returns_503_for_a_spanish_query(client, app, voyage):
    """Con el proveedor caído, `q=pechuga de pollo` da 503 con el mismo mensaje."""
    seed(app, CHICKEN)
    voyage.raise_error = RuntimeError("voyage down")

    response = search(client, app, "pechuga de pollo")

    assert response.status_code == 503
    assert response.get_json() == {"error": UNAVAILABLE_MESSAGE}


# SDD: 021 REQ-011 AC-011.3
def test_the_same_search_works_after_the_provider_recovers(client, app, voyage):
    """Falla en la primera búsqueda y responde en la segunda: la repetición da
    200 e incluye el pollo."""
    seed(app, CHICKEN)
    voyage.raise_error = RuntimeError("voyage down")
    first = search(client, app, "chicken")
    voyage.raise_error = None

    second = search(client, app, "chicken")

    assert first.status_code == 503
    assert second.status_code == 200
    assert CHICKEN["fdc_id"] in ids_of(second)


# SDD: 021 REQ-002 AC-002.3
def test_food_missing_from_a_reimport_still_appears_in_search(client, app, tmp_path):
    """De extremo a extremo: tras reimportar un archivo que ya no incluye un
    alimento, ese alimento sigue guardado y aparece en la búsqueda."""
    first = write_usda_dataset(
        tmp_path / "v1",
        [(1, FOUNDATION_TYPE, "Avocado, raw"), (2, FOUNDATION_TYPE, "Banana, raw")],
        macro_nutrients(1, kcal=160.0) + macro_nutrients(2, kcal=89.0),
    )
    second = write_usda_dataset(
        tmp_path / "v2", [(2, FOUNDATION_TYPE, "Banana, raw")], macro_nutrients(2, kcal=89.0)
    )
    with app.app_context():
        service = FoodImportService(
            FoodRepository(db.session),
            UnitOfWork(db.session),
            FakeFoodEmbeddingClient(default_vector=basis_vector(12)),
        )
        service.run([UsdaSource("foundation", first)])
        service.run([UsdaSource("foundation", second)])

    response = search(client, app, "avocado")

    assert response.status_code == 200
    assert ids_of(response) == [1]
