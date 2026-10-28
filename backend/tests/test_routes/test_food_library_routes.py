"""Integración de `/api/food-library` (spec 028) contra la app, los servicios y
los repositorios reales y el Postgres de prueba. Los usuarios se registran por
`/api/auth/register` (las tablas nuevas tienen FK a `users`); el catálogo y los
alimentos propios se siembran con el ORM; las comidas, con `POST /api/meals`.
Voyage y Redis son dobles instalados en los singletons (se restauran al
terminar): nada sale a la red y la biblioteca no debe usarlos (NFR-001).
"""

import threading
import time
from datetime import datetime

import pytest
from sqlalchemy import delete, select, text

from extensions import db, embedding_client, jwt_manager, rate_limiter
from models import CatalogFood, CustomFood, Food, FoodFavorite, User
from models.meal import MealItem
from repositories.catalog_food_repository import CatalogFoodRepository
from repositories.custom_food_repository import CustomFoodRepository
from routes.food_library_routes import _build_food_library_service
from services.catalog_rules import fold
from services.catalog_search_service import (
    SearchCandidate,
    TypoSearchStats,
    typo_comparison_bound,
)
from tests.fakes import FakeRedisClient, FakeVoyageClient

URL = "/api/food-library"
MEALS_URL = "/api/meals"
NOW = datetime(2026, 10, 21, 3, 0)
TODAY = "2026-10-21"
PASSWORD = "ClaveSegura123"

EMPTY_MESSAGE = {"error": "Escribe qué alimento quieres buscar."}
SHORT_MESSAGE = {"error": "La búsqueda debe tener al menos 2 caracteres."}
LONG_MESSAGE = {"error": "La búsqueda no puede superar los 100 caracteres."}
NOT_FOUND = {"error": "No encontramos ese alimento."}
FAVORITES_LIMIT = {"error": "Ya tienes 100 favoritos. Quita alguno para añadir otro."}


@pytest.fixture(autouse=True)
def fixed_clock(app_clock):
    app_clock.set(NOW)
    return app_clock


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


def register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "first_name": "Ana",
            "last_name": "Pérez",
            "date_of_birth": "2000-01-01",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.get_json()['token']}"}


@pytest.fixture
def headers(client):
    return register(client, "ana@example.com")


@pytest.fixture
def other_headers(client):
    return register(client, "luis@example.com")


def user_id_of(app, email):
    with app.app_context():
        return db.session.scalar(select(User.id).where(User.email == email))


def seed(app, *foods):
    """Inserta alimentos del catálogo: dicts con `id` y `name` (el resto opcional)."""
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


def seed_custom(app, email, name, calories=180.0, protein=6.0, carbs=30.0, fat=4.0):
    """Inserta un alimento propio y devuelve su identificador."""
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        food = CustomFood(
            user_id=user_id,
            name=name,
            name_key=" ".join(fold(name).split()),
            calories_kcal=calories,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
        )
        db.session.add(food)
        db.session.commit()
        return food.id


def seed_favorite(app, email, catalog_id=None, custom_food_id=None):
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        db.session.add(
            FoodFavorite(user_id=user_id, catalog_id=catalog_id, custom_food_id=custom_food_id)
        )
        db.session.commit()


def favorites_in_database(app):
    with app.app_context():
        return db.session.query(FoodFavorite).count()


def search(client, headers, query, **extra):
    params = {"q": query, **extra} if query is not None else dict(extra)
    return client.get(f"{URL}/search", query_string=params, headers=headers)


def names_of(response):
    assert response.status_code == 200
    return [item["name"] for item in response.get_json()["results"]]


def results_of(response):
    assert response.status_code == 200
    return response.get_json()["results"]


def recent(client, headers):
    return client.get(f"{URL}/recent", headers=headers)


def favorites(client, headers):
    return client.get(f"{URL}/favorites", headers=headers)


def post_meal(client, headers, items, meal_type="lunch", date=TODAY):
    response = client.post(
        MEALS_URL, json={"date": date, "meal_type": meal_type, "items": items}, headers=headers
    )
    assert response.status_code in (200, 201), response.get_json()
    return response.get_json()


def custom_item(name="Gallo pinto", grams=200, calories=180, protein=6, carbs=30, fat=4):
    return {
        "name": name,
        "grams": grams,
        "per_100g": {
            "calories_kcal": calories,
            "protein_g": protein,
            "carbs_g": carbs,
            "fat_g": fat,
        },
    }


def catalog_item(catalog_id="banano", grams=100):
    return {"catalog_id": catalog_id, "grams": grams}


WHITE_RICE = {"id": "arroz-blanco-cocido", "name": "Arroz blanco cocido",
              "calories_kcal": 130.0, "protein_g": 2.69, "carbs_g": 28.17, "fat_g": 0.28}
BROWN_RICE = {"id": "arroz-integral-cocido", "name": "Arroz integral cocido"}
BEANS = {"id": "frijoles-negros-cocidos", "name": "Frijoles negros cocidos"}
CHICKEN = {"id": "pechuga-de-pollo-a-la-plancha", "name": "Pechuga de pollo a la plancha"}
COCOA = {"id": "cacao-en-polvo", "name": "Cacao en polvo"}
BANANA = {"id": "banano", "name": "Banano", "synonyms": ["guineo"], "calories_kcal": 89.0,
          "protein_g": 1.09, "carbs_g": 22.84, "fat_g": 0.33}
OATS = {"id": "avena-cocida", "name": "Avena cocida"}
YOGURT = {"id": "yogur-natural", "name": "Yogur natural"}


def hundred_fruits():
    """Las 100 frutas de los favoritos: desde AC-009.6 deben estar en el catálogo para contar."""
    return [{"id": f"fruta-{n:03d}", "name": f"Fruta {n:03d}"} for n in range(100)]


# --------------------------------------------------------------------------
# Búsqueda: erratas y plural en «-ces» (REQ-006)
# --------------------------------------------------------------------------


# SDD: 028 REQ-006 AC-006.1
@pytest.mark.parametrize("query", ["aroz", "arrox", "arorz"])
def test_search_finds_the_rice_with_a_missing_changed_or_swapped_letter(
    client, app, headers, query
):
    """`aroz`, `arrox` y `arorz` encuentran «Arroz blanco cocido»."""
    seed(app, WHITE_RICE)

    assert names_of(search(client, headers, query)) == ["Arroz blanco cocido"]


# SDD: 028 REQ-006 AC-006.2
@pytest.mark.parametrize("query", ["guevos", "huevoz"])
def test_search_finds_huevo_cocido_with_a_typo(client, app, headers, query):
    """`guevos` y `huevoz` encuentran «Huevo cocido»."""
    seed(app, {"id": "huevo-cocido", "name": "Huevo cocido"})

    assert names_of(search(client, headers, query)) == ["Huevo cocido"]


# SDD: 028 REQ-006 AC-006.3
def test_search_finds_a_food_with_a_typo_in_two_words(client, app, headers):
    """`pechga de polo` encuentra «Pechuga de pollo a la plancha»."""
    seed(app, CHICKEN)

    assert names_of(search(client, headers, "pechga de polo")) == [
        "Pechuga de pollo a la plancha"
    ]


# SDD: 028 REQ-006 AC-006.4
def test_search_finds_almendras_with_two_edits_in_a_long_word(client, app, headers):
    """`almendars` encuentra «Almendras»."""
    seed(app, {"id": "almendras", "name": "Almendras"})

    assert names_of(search(client, headers, "almendars")) == ["Almendras"]


# SDD: 028 REQ-006 AC-006.5
def test_search_with_a_typo_keeps_requiring_every_word(client, app, headers):
    """`arroz blanko` encuentra el arroz blanco y no el integral."""
    seed(app, WHITE_RICE, BROWN_RICE)

    assert names_of(search(client, headers, "arroz blanko")) == ["Arroz blanco cocido"]


# SDD: 028 REQ-006 AC-006.6
def test_search_does_not_apply_tolerance_when_there_are_exact_matches(client, app, headers):
    """`pollo` encuentra la pechuga y no «Cacao en polvo»."""
    seed(app, CHICKEN, COCOA)

    assert names_of(search(client, headers, "pollo")) == ["Pechuga de pollo a la plancha"]


# SDD: 028 REQ-006 AC-006.7
def test_search_with_a_form_of_three_characters_has_no_tolerance(client, app, headers):
    """`pam` no encuentra «Pan blanco»."""
    seed(app, {"id": "pan-blanco", "name": "Pan blanco"})

    assert results_of(search(client, headers, "pam")) == []


# SDD: 028 REQ-006 AC-006.8
def test_search_with_a_typo_does_not_match_the_inside_of_a_word(client, app, headers):
    """`ijol` no encuentra «Frijoles negros cocidos»."""
    seed(app, BEANS)

    assert results_of(search(client, headers, "ijol")) == []


# SDD: 028 REQ-006 AC-006.9
def test_search_orders_the_typo_results_by_distance_and_then_by_name(client, app, headers):
    """`huevi`: «Hueva de pescado» y después «Huevo cocido»; sin «Hueso de res»."""
    seed(
        app,
        {"id": "huevo-cocido", "name": "Huevo cocido"},
        {"id": "hueva-de-pescado", "name": "Hueva de pescado"},
        {"id": "hueso-de-res", "name": "Hueso de res"},
    )

    assert names_of(search(client, headers, "huevi")) == ["Hueva de pescado", "Huevo cocido"]


# SDD: 028 REQ-006 AC-006.10
def test_search_finds_nuez_with_the_plural_nueces(client, app, headers):
    """`nueces` encuentra «Nuez»."""
    seed(app, {"id": "nuez", "name": "Nuez"})

    assert names_of(search(client, headers, "nueces")) == ["Nuez"]


# SDD: 028 REQ-006 AC-006.11
def test_search_without_any_match_returns_200_and_an_empty_list(client, app, headers):
    """`zzxqv` no encuentra nada: 200 con `results` vacío."""
    seed(app, WHITE_RICE, BEANS)

    response = search(client, headers, "zzxqv")

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# --------------------------------------------------------------------------
# Búsqueda conjunta (REQ-007)
# --------------------------------------------------------------------------


# SDD: 028 REQ-007 AC-007.1
def test_search_returns_catalog_and_own_foods_with_their_kind(client, app, headers):
    """`arroz`: el del catálogo y el propio «Arroz con pollo de mamá», cada uno con su `kind`."""
    seed(app, WHITE_RICE)
    own_id = seed_custom(app, "ana@example.com", "Arroz con pollo de mamá")

    results = results_of(search(client, headers, "arroz"))

    assert [(r["kind"], r["id"], r["name"]) for r in results] == [
        ("catalog", "arroz-blanco-cocido", "Arroz blanco cocido"),
        ("custom", own_id, "Arroz con pollo de mamá"),
    ]


# SDD: 028 REQ-007 AC-007.1
def test_search_result_has_the_contract_shape_with_numbers_for_the_values(client, app, headers):
    """Cada resultado lleva exactamente `kind`, `id`, `name`, `per_100g` y `favorite`."""
    seed(app, WHITE_RICE)
    seed_custom(app, "ana@example.com", "Arroz casero", 150, 5, 20, 3)

    catalog_food, own_food = results_of(search(client, headers, "arroz"))

    assert set(catalog_food) == {"kind", "id", "name", "per_100g", "favorite"}
    assert catalog_food["per_100g"] == {
        "calories_kcal": 130.0,
        "protein_g": 2.69,
        "carbs_g": 28.17,
        "fat_g": 0.28,
    }
    assert own_food["per_100g"] == {
        "calories_kcal": 150.0,
        "protein_g": 5.0,
        "carbs_g": 20.0,
        "fat_g": 3.0,
    }
    assert isinstance(catalog_food["id"], str) and isinstance(own_food["id"], int)
    assert catalog_food["favorite"] is False and own_food["favorite"] is False


# SDD: 028 REQ-007 AC-007.2
def test_search_never_shows_the_own_foods_of_another_user(client, app, headers, other_headers):
    """El «Gallo pinto» de Luis no aparece para Ana, y Luis sí lo ve."""
    seed_custom(app, "luis@example.com", "Gallo pinto")

    assert results_of(search(client, headers, "gallo")) == []
    assert names_of(search(client, other_headers, "gallo")) == ["Gallo pinto"]


# SDD: 028 REQ-007 AC-007.3
def test_search_puts_the_catalog_food_first_when_an_own_food_has_the_same_name(
    client, app, headers
):
    """Un propio «Arroz blanco cocido» y el del catálogo: aparecen los dos,
    el del catálogo primero."""
    seed(app, WHITE_RICE)
    seed_custom(app, "ana@example.com", "Arroz blanco cocido")

    results = results_of(search(client, headers, "arroz blanco cocido"))

    assert [r["kind"] for r in results] == ["catalog", "custom"]


# SDD: 028 REQ-007 AC-007.4
def test_search_marks_the_favorites_of_the_user(client, app, headers, other_headers):
    """Un favorito del catálogo y uno propio llevan `favorite: true`; los demás, no
    (ni los favoritos de otro usuario)."""
    seed(app, WHITE_RICE, BROWN_RICE)
    favorite_own = seed_custom(app, "ana@example.com", "Arroz del campo")
    plain_own = seed_custom(app, "ana@example.com", "Arroz de la casa")
    seed_favorite(app, "ana@example.com", catalog_id="arroz-blanco-cocido")
    seed_favorite(app, "ana@example.com", custom_food_id=favorite_own)
    seed_favorite(app, "luis@example.com", catalog_id="arroz-integral-cocido")

    results = results_of(search(client, headers, "arroz"))

    assert {(r["kind"], r["id"]): r["favorite"] for r in results} == {
        ("catalog", "arroz-blanco-cocido"): True,
        ("catalog", "arroz-integral-cocido"): False,
        ("custom", favorite_own): True,
        ("custom", plain_own): False,
    }


# SDD: 028 REQ-007 AC-007.5
def test_search_returns_exactly_20_of_15_catalog_and_10_own_matches(client, app, headers):
    """15 del catálogo y 10 propios que coinciden: la respuesta tiene exactamente 20."""
    seed(app, *[{"id": f"arroz-{n:02d}", "name": f"Arroz {n:02d}"} for n in range(15)])
    for n in range(10):
        seed_custom(app, "ana@example.com", f"Arroz propio {n:02d}")

    assert len(results_of(search(client, headers, "arroz"))) == 20


# SDD: 028 REQ-007 AC-007.6
@pytest.mark.parametrize(
    "query, body",
    [(None, EMPTY_MESSAGE), ("", EMPTY_MESSAGE), ("   ", EMPTY_MESSAGE),
     ("a", SHORT_MESSAGE), ("a" * 101, LONG_MESSAGE)],
)
def test_search_rejects_an_invalid_query_with_the_messages_of_spec_023(
    client, headers, query, body
):
    """Sin `q`, con `q=a` o con 101 caracteres: el 400 de la 023."""
    response = search(client, headers, query)

    assert response.status_code == 400
    assert response.get_json() == body


# SDD: 028 REQ-007 AC-007.6
def test_search_accepts_a_query_of_100_characters(client, headers):
    """100 caracteres es válido: 200 y sin resultados."""
    response = search(client, headers, "a" * 100)

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 028 REQ-007 AC-007.7
def test_search_tolerates_a_typo_in_an_own_food(client, app, headers):
    """`galo pinto` encuentra el alimento propio «Gallo pinto»."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    results = results_of(search(client, headers, "galo pinto"))

    assert [(r["kind"], r["id"]) for r in results] == [("custom", own_id)]


# SDD: 028 REQ-007 AC-007.1
def test_search_finds_a_catalog_food_by_synonym(client, app, headers):
    """El sinónimo `guineo` encuentra «Banano» también en la búsqueda conjunta."""
    seed(app, BANANA)

    assert names_of(search(client, headers, "guineo")) == ["Banano"]


# --------------------------------------------------------------------------
# Recientes (REQ-008)
# --------------------------------------------------------------------------


# SDD: 028 REQ-008 AC-008.1
def test_recent_orders_the_foods_by_when_they_were_added_without_repeating_them(
    client, app, headers
):
    """«Banano» (120 g), «Gallo pinto» propio (200 g) y otra vez «Banano» (150 g):
    primero «Banano» con `last_grams` 150 y después «Gallo pinto» con 200."""
    seed(app, BANANA)
    post_meal(client, headers, [catalog_item("banano", 120)])
    post_meal(client, headers, [custom_item("Gallo pinto", 200)], meal_type="dinner")
    post_meal(client, headers, [catalog_item("banano", 150)], meal_type="snack")

    results = results_of(recent(client, headers))

    assert [(r["kind"], r["name"], r["last_grams"]) for r in results] == [
        ("catalog", "Banano", 150.0),
        ("custom", "Gallo pinto", 200.0),
    ]
    assert set(results[0]) == {"kind", "id", "name", "per_100g", "favorite", "last_grams"}


# SDD: 028 REQ-008 AC-008.2
def test_recent_returns_only_the_10_most_recent_of_12_foods(client, app, headers):
    """12 alimentos distintos registrados: se reciben los 10 más recientes."""
    seed(app, *[{"id": f"fruta-{n:02d}", "name": f"Fruta {n:02d}"} for n in range(12)])
    for n in range(12):
        post_meal(client, headers, [catalog_item(f"fruta-{n:02d}")], meal_type="lunch")

    results = results_of(recent(client, headers))

    assert [r["id"] for r in results] == [f"fruta-{n:02d}" for n in range(11, 1, -1)]


# SDD: 028 REQ-008 AC-008.3
def test_recent_gives_the_grams_after_an_edit_without_changing_the_position(client, app, headers):
    """Cambiar los gramos de «Banano» a 180 deja `last_grams` 180 y no lo adelanta."""
    seed(app, BANANA, OATS)
    meal = post_meal(client, headers, [catalog_item("banano", 120)])
    post_meal(client, headers, [catalog_item("avena-cocida", 50)], meal_type="dinner")
    item_id = meal["items"][0]["id"]

    patched = client.patch(
        f"{MEALS_URL}/{meal['id']}/items/{item_id}", json={"grams": 180}, headers=headers
    )
    assert patched.status_code == 200

    results = results_of(recent(client, headers))

    assert [(r["name"], r["last_grams"]) for r in results] == [
        ("Avena cocida", 50.0),
        ("Banano", 180.0),
    ]


# SDD: 028 REQ-008 AC-008.4
def test_recent_leaves_out_usda_foods_removed_catalog_foods_and_deleted_own_foods(
    client, app, headers
):
    """Un alimento de USDA, uno del catálogo que dejó de existir y un propio
    borrado de la biblioteca no aparecen; el resto sí."""
    seed(app, BANANA, OATS)
    with app.app_context():
        db.session.add(Food(
            fdc_id=171477, description="Chicken", data_type="sr_legacy", calories_kcal=165.0,
            protein_g=31.0, carbs_g=0.0, fat_g=3.57, embedding=None,
        ))
        db.session.commit()
    post_meal(client, headers, [{"fdc_id": 171477, "grams": 100}], meal_type="breakfast")
    post_meal(client, headers, [catalog_item("banano")], meal_type="lunch")
    post_meal(client, headers, [custom_item("Gallo pinto")], meal_type="dinner")
    post_meal(client, headers, [catalog_item("avena-cocida")], meal_type="snack")
    with app.app_context():
        db.session.execute(delete(CatalogFood).where(CatalogFood.id == "banano"))
        db.session.execute(delete(CustomFood))
        db.session.commit()

    assert names_of(recent(client, headers)) == ["Avena cocida"]


# SDD: 028 REQ-008 AC-008.5
def test_recent_does_not_include_a_food_removed_from_the_diary(client, app, headers):
    """Un alimento quitado del diario (sin deshacer) y sin otro registro no aparece."""
    seed(app, BANANA, OATS)
    meal = post_meal(client, headers, [catalog_item("banano"), catalog_item("avena-cocida")])
    banana_item = next(i for i in meal["items"] if i["name"] == "Banano")
    removed = client.delete(f"{MEALS_URL}/{meal['id']}/items/{banana_item['id']}", headers=headers)
    assert removed.status_code == 204

    assert names_of(recent(client, headers)) == ["Avena cocida"]


# SDD: 028 REQ-008 AC-008.6
def test_recent_of_a_user_without_meals_is_200_and_empty(client, headers):
    """Sin comidas: 200 con `results` vacío."""
    response = recent(client, headers)

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 028 REQ-008 AC-008.7
def test_recent_does_not_show_what_only_another_user_registered(
    client, app, headers, other_headers
):
    """Lo que solo registró Luis no aparece en los recientes de Ana."""
    seed(app, BANANA)
    post_meal(client, other_headers, [catalog_item("banano"), custom_item("Gallo pinto")])

    assert results_of(recent(client, headers)) == []
    assert names_of(recent(client, other_headers)) == ["Gallo pinto", "Banano"]


# SDD: 028 REQ-008 AC-008.7
def test_recent_keeps_the_own_food_of_each_user_apart(client, app, headers, other_headers):
    """Los dos registran su «Gallo pinto»: cada uno ve el suyo, con su identificador."""
    post_meal(client, headers, [custom_item("Gallo pinto", calories=180)])
    post_meal(client, other_headers, [custom_item("Gallo pinto", calories=111)])

    ana, luis = results_of(recent(client, headers)), results_of(recent(client, other_headers))

    assert [r["per_100g"]["calories_kcal"] for r in ana] == [180.0]
    assert [r["per_100g"]["calories_kcal"] for r in luis] == [111.0]
    assert ana[0]["id"] != luis[0]["id"]


# SDD: 028 REQ-008 AC-008.8
def test_recent_gives_the_current_values_of_an_own_food_after_it_is_updated(client, app, headers):
    """Registrar otra vez el mismo nombre con otros valores actualiza el reciente."""
    post_meal(client, headers, [custom_item("Gallo pinto", calories=180)])
    post_meal(client, headers, [custom_item("gallo pinto", calories=170)], meal_type="dinner")

    results = results_of(recent(client, headers))

    assert len(results) == 1
    assert results[0]["name"] == "gallo pinto"
    assert results[0]["per_100g"]["calories_kcal"] == 170.0


# SDD: 028 REQ-008 AC-008.1
def test_recent_marks_the_favorites_of_the_user(client, app, headers):
    """Un reciente que también es favorito lleva `favorite: true`."""
    seed(app, BANANA, OATS)
    post_meal(client, headers, [catalog_item("banano"), catalog_item("avena-cocida")])
    seed_favorite(app, "ana@example.com", catalog_id="banano")

    assert {r["name"]: r["favorite"] for r in results_of(recent(client, headers))} == {
        "Banano": True,
        "Avena cocida": False,
    }


# --------------------------------------------------------------------------
# Favoritos (REQ-010)
# --------------------------------------------------------------------------


# SDD: 028 REQ-010 AC-010.1
def test_favorites_are_ordered_by_name_with_kind_and_favorite_true(client, app, headers):
    """«Avena cocida», «Gallo pinto» y «Yogur natural», cada uno con su `kind`
    y `favorite: true`."""
    seed(app, YOGURT, OATS)
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    seed_favorite(app, "ana@example.com", catalog_id="yogur-natural")
    seed_favorite(app, "ana@example.com", custom_food_id=own_id)
    seed_favorite(app, "ana@example.com", catalog_id="avena-cocida")

    results = results_of(favorites(client, headers))

    assert [(r["kind"], r["name"], r["favorite"]) for r in results] == [
        ("catalog", "Avena cocida", True),
        ("custom", "Gallo pinto", True),
        ("catalog", "Yogur natural", True),
    ]
    assert "last_grams" not in results[0]


# SDD: 028 REQ-010 AC-010.2
def test_favorites_omit_a_removed_catalog_food_and_bring_it_back_when_a_load_returns_it(
    client, app, headers
):
    """Un favorito del catálogo que una carga quita no aparece; si otra lo devuelve, vuelve."""
    seed(app, OATS, YOGURT)
    seed_favorite(app, "ana@example.com", catalog_id="yogur-natural")
    seed_favorite(app, "ana@example.com", catalog_id="avena-cocida")
    with app.app_context():
        db.session.execute(delete(CatalogFood).where(CatalogFood.id == "yogur-natural"))
        db.session.commit()
    assert names_of(favorites(client, headers)) == ["Avena cocida"]

    seed(app, YOGURT)

    assert names_of(favorites(client, headers)) == ["Avena cocida", "Yogur natural"]


# SDD: 028 REQ-010 AC-010.3
def test_favorites_of_a_user_without_any_is_200_and_empty(client, headers):
    """Sin favoritos: 200 con `results` vacío."""
    response = favorites(client, headers)

    assert response.status_code == 200
    assert response.get_json() == {"results": []}


# SDD: 028 REQ-009 AC-009.5
def test_favorites_of_one_user_do_not_appear_for_another(client, app, headers, other_headers):
    """Ana marca «Banano»; los favoritos de Luis no lo traen."""
    seed(app, BANANA)
    seed_favorite(app, "ana@example.com", catalog_id="banano")

    assert names_of(favorites(client, headers)) == ["Banano"]
    assert results_of(favorites(client, other_headers)) == []


# --------------------------------------------------------------------------
# Marcar y quitar favoritos (REQ-009)
# --------------------------------------------------------------------------


def put_favorite(client, headers, kind, food_id):
    return client.put(f"{URL}/favorites/{kind}/{food_id}", headers=headers)


def delete_favorite(client, headers, kind, food_id):
    return client.delete(f"{URL}/favorites/{kind}/{food_id}", headers=headers)


# SDD: 028 REQ-009 AC-009.1
def test_marking_a_catalog_food_twice_gives_204_both_times_and_one_favorite(client, app, headers):
    """Dos `PUT` de «banano»: 204 las dos veces y «Banano» una sola vez en los favoritos."""
    seed(app, BANANA)

    first = put_favorite(client, headers, "catalog", "banano")
    second = put_favorite(client, headers, "catalog", "banano")

    assert (first.status_code, second.status_code) == (204, 204)
    assert first.data == b"" and second.data == b""
    assert names_of(favorites(client, headers)) == ["Banano"]
    assert favorites_in_database(app) == 1


# SDD: 028 REQ-009 AC-009.1
def test_marking_an_own_food_gives_204_and_shows_it_in_the_favorites(client, app, headers):
    """`PUT …/favorites/custom/{id}` marca un alimento propio."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = put_favorite(client, headers, "custom", own_id)

    assert response.status_code == 204
    assert [(r["kind"], r["id"]) for r in results_of(favorites(client, headers))] == [
        ("custom", own_id)
    ]


# SDD: 028 REQ-009 AC-009.2
def test_unmarking_a_favorite_twice_gives_204_both_times_and_removes_it(client, app, headers):
    """Dos `DELETE` de «banano»: 204 las dos veces y ya no está en los favoritos."""
    seed(app, BANANA, OATS)
    seed_favorite(app, "ana@example.com", catalog_id="banano")
    seed_favorite(app, "ana@example.com", catalog_id="avena-cocida")

    first = delete_favorite(client, headers, "catalog", "banano")
    second = delete_favorite(client, headers, "catalog", "banano")

    assert (first.status_code, second.status_code) == (204, 204)
    assert names_of(favorites(client, headers)) == ["Avena cocida"]


# SDD: 028 REQ-009 AC-009.2
def test_unmarking_an_own_food_that_was_not_a_favorite_gives_204(client, app, headers):
    """Quitar de favoritos un propio que no lo era: 204."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    assert delete_favorite(client, headers, "custom", own_id).status_code == 204


# SDD: 028 REQ-009 AC-009.3
def test_marking_a_catalog_food_that_does_not_exist_is_404(client, app, headers):
    """Un `catalog_id` que no existe: 404 con el mensaje de la spec y nada guardado."""
    seed(app, BANANA)

    response = put_favorite(client, headers, "catalog", "no-existe")

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert favorites_in_database(app) == 0


# SDD: 028 REQ-009 AC-009.3
def test_marking_an_own_food_of_another_user_is_404(client, app, headers, other_headers):
    """El alimento propio de Luis no se puede marcar desde la cuenta de Ana."""
    luis_food = seed_custom(app, "luis@example.com", "Gallo pinto")

    response = put_favorite(client, headers, "custom", luis_food)

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert favorites_in_database(app) == 0


# SDD: 028 REQ-009 AC-009.3
@pytest.mark.parametrize("food_id", ["abc", "0", "99999999999", "999999"])
def test_marking_an_own_food_with_an_invalid_or_missing_id_is_404(client, headers, food_id):
    """`abc`, 0, un entero fuera de rango o un id inexistente: 404 y no un error del servidor."""
    response = put_favorite(client, headers, "custom", food_id)

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND


# SDD: 028 REQ-009 AC-009.3
def test_unmarking_a_food_that_does_not_exist_is_404(client, app, headers, other_headers):
    """`DELETE` de un alimento inexistente o ajeno: 404."""
    luis_food = seed_custom(app, "luis@example.com", "Gallo pinto")

    assert delete_favorite(client, headers, "catalog", "no-existe").status_code == 404
    assert delete_favorite(client, headers, "custom", luis_food).status_code == 404
    response = delete_favorite(client, headers, "custom", "abc")
    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND


# SDD: 028 REQ-009 AC-009.3
def test_the_favorites_routes_reject_an_unknown_kind_with_404(client, app, headers):
    """Un tipo distinto de `catalog` y `custom` no existe como ruta o responde 404."""
    seed(app, BANANA)

    assert put_favorite(client, headers, "foods", "banano").status_code == 404
    assert delete_favorite(client, headers, "foods", "banano").status_code == 404
    # Contraste: con un tipo valido la ruta si existe (028).
    assert put_favorite(client, headers, "catalog", "banano").status_code == 204


# SDD: 028 REQ-009 AC-009.4
def test_marking_a_new_food_with_100_favorites_is_400_and_an_existing_one_is_204(
    client, app, headers
):
    """Con 100 favoritos, uno nuevo da el 400 del límite; volver a marcar uno que
    ya es favorito da 204."""
    seed(app, BANANA, *hundred_fruits())
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == "ana@example.com"))
        db.session.add_all(
            [FoodFavorite(user_id=user_id, catalog_id=f"fruta-{n:03d}") for n in range(100)]
        )
        db.session.commit()

    rejected = put_favorite(client, headers, "catalog", "banano")
    repeated = put_favorite(client, headers, "catalog", "fruta-000")

    assert rejected.status_code == 400
    assert rejected.get_json() == FAVORITES_LIMIT
    assert repeated.status_code == 204
    assert favorites_in_database(app) == 100


# SDD: 028 REQ-009 AC-009.4
def test_a_favorite_can_be_marked_again_after_removing_one_at_the_limit(client, app, headers):
    """Con 100 favoritos, quitar uno deja marcar otro."""
    seed(app, BANANA, *hundred_fruits())
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == "ana@example.com"))
        db.session.add_all(
            [FoodFavorite(user_id=user_id, catalog_id=f"fruta-{n:03d}") for n in range(100)]
        )
        db.session.commit()
    assert delete_favorite(client, headers, "catalog", "fruta-000").status_code == 204

    assert put_favorite(client, headers, "catalog", "banano").status_code == 204


# --------------------------------------------------------------------------
# Borrar un alimento propio (REQ-004)
# --------------------------------------------------------------------------


def delete_custom(client, headers, food_id):
    return client.delete(f"{URL}/custom/{food_id}", headers=headers)


def diary_items(client, headers, date=TODAY):
    response = client.get(MEALS_URL, query_string={"date": date}, headers=headers)
    assert response.status_code == 200
    return [item for meal in response.get_json()["meals"] for item in meal["items"]]


# SDD: 028 REQ-004 AC-004.1
def test_deleting_an_own_food_removes_it_everywhere_and_keeps_the_registered_food(
    client, app, headers
):
    """Un propio favorito y registrado en una comida: 204; ya no aparece en la
    búsqueda, los recientes ni los favoritos, y el diario lo devuelve con su
    nombre, valores y nutrientes y `custom_food_id: null`."""
    meal = post_meal(client, headers, [custom_item("Gallo pinto", grams=250)])
    own_id = meal["items"][0]["custom_food_id"]
    assert isinstance(own_id, int)
    assert put_favorite(client, headers, "custom", own_id).status_code == 204

    response = delete_custom(client, headers, own_id)

    assert response.status_code == 204 and response.data == b""
    assert results_of(search(client, headers, "gallo")) == []
    assert results_of(recent(client, headers)) == []
    assert results_of(favorites(client, headers)) == []
    (item,) = diary_items(client, headers)
    assert item["name"] == "Gallo pinto"
    assert item["custom_food_id"] is None
    assert item["per_100g"] == {
        "calories_kcal": 180.0, "protein_g": 6.0, "carbs_g": 30.0, "fat_g": 4.0,
    }
    assert item["nutrients"] == {
        "calories_kcal": 450.0, "protein_g": 15.0, "carbs_g": 75.0, "fat_g": 10.0,
    }


# SDD: 028 REQ-004 AC-004.2
def test_deleting_an_own_food_of_another_user_is_404_and_leaves_it_intact(
    client, app, headers, other_headers
):
    """Ana no puede borrar el alimento de Luis: 404 y Luis lo sigue viendo."""
    luis_food = seed_custom(app, "luis@example.com", "Gallo pinto")

    response = delete_custom(client, headers, luis_food)

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert names_of(search(client, other_headers, "gallo")) == ["Gallo pinto"]


# SDD: 028 REQ-004 AC-004.3
@pytest.mark.parametrize("food_id", ["999999", "abc", "0", "-5", "99999999999"])
def test_deleting_an_own_food_that_does_not_exist_or_is_not_valid_is_404(client, headers, food_id):
    """Un identificador inexistente, `abc` o fuera de rango: 404 con el mensaje de la spec."""
    response = delete_custom(client, headers, food_id)

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND


# SDD: 028 REQ-004 AC-004.4
def test_registering_the_same_name_after_deleting_creates_a_new_own_food(client, app, headers):
    """Tras borrar «Gallo pinto», registrar otro con el mismo nombre crea uno nuevo, con otro id."""
    first = post_meal(client, headers, [custom_item("Gallo pinto")])["items"][0]["custom_food_id"]
    assert delete_custom(client, headers, first).status_code == 204

    second = post_meal(client, headers, [custom_item("Gallo pinto")], meal_type="dinner")[
        "items"
    ][-1]["custom_food_id"]

    assert isinstance(second, int) and second != first
    assert [r["id"] for r in results_of(search(client, headers, "gallo"))] == [second]


# SDD: 028 REQ-004 AC-004.1
def test_deleting_an_own_food_does_not_change_the_meal_items_in_the_database(client, app, headers):
    """Los alimentos registrados siguen en la base (solo pierden el vínculo)."""
    own_id = post_meal(client, headers, [custom_item()])["items"][0]["custom_food_id"]

    delete_custom(client, headers, own_id)

    with app.app_context():
        assert db.session.query(MealItem).count() == 1
        assert db.session.query(CustomFood).count() == 0


# --------------------------------------------------------------------------
# Editar un alimento propio (spec 029, REQ-001 a REQ-004)
# --------------------------------------------------------------------------

NAME_REQUIRED_MESSAGE = {"error": "Escribe el nombre del alimento."}
NAME_TOO_LONG_MESSAGE = {"error": "El nombre no puede superar los 100 caracteres."}
PER_100G_REQUIRED_MESSAGE = {
    "error": "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
}
CALORIES_RANGE_MESSAGE = {"error": "Las calorías por 100 g deben estar entre 0 y 900."}
MACROS_RANGE_MESSAGE = {"error": "Los macros por 100 g deben estar entre 0 y 100 g."}
MACROS_SUM_MESSAGE = {
    "error": "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
}
INVALID_REQUEST_MESSAGE = {"error": "La petición no es válida"}
NAME_TAKEN_MESSAGE = {"error": "Ya tienes un alimento con ese nombre."}
GALLO_PER_100G = {"calories_kcal": 180.0, "protein_g": 6.0, "carbs_g": 30.0, "fat_g": 4.0}


def edit_payload(name="Gallo pinto con huevo", **values):
    per_100g = {"calories_kcal": 200, "protein_g": 9, "carbs_g": 28, "fat_g": 6, **values}
    return {"name": name, "per_100g": per_100g}


def patch_custom(client, headers, food_id, body):
    return client.patch(f"{URL}/custom/{food_id}", json=body, headers=headers)


def custom_rows(app, email=None):
    """Alimentos propios (del usuario, o de todos) como (id, nombre, kcal, p, c, g)."""
    with app.app_context():
        query = select(
            CustomFood.id, CustomFood.name, CustomFood.calories_kcal, CustomFood.protein_g,
            CustomFood.carbs_g, CustomFood.fat_g,
        ).order_by(CustomFood.id)
        if email is not None:
            user_id = db.session.scalar(select(User.id).where(User.email == email))
            query = query.where(CustomFood.user_id == user_id)
        return [tuple(row) for row in db.session.execute(query).all()]


def gallo_row(food_id, name="Gallo pinto"):
    return (food_id, name, 180.0, 6.0, 30.0, 4.0)


# SDD: 029 REQ-001 AC-001.1
def test_editing_an_own_food_answers_200_with_the_library_format(client, app, headers):
    """«Gallo pinto» favorito, editado con el nombre con espacios: 200 con `kind`, `id`,
    el nombre recortado, los cuatro valores como número y `favorite: true`."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    seed_favorite(app, "ana@example.com", custom_food_id=food_id)

    response = patch_custom(
        client, headers, food_id, edit_payload(name="  Gallo pinto con huevo ")
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "kind": "custom",
        "id": food_id,
        "name": "Gallo pinto con huevo",
        "per_100g": {"calories_kcal": 200.0, "protein_g": 9.0, "carbs_g": 28.0, "fat_g": 6.0},
        "favorite": True,
    }
    assert custom_rows(app, "ana@example.com") == [
        (food_id, "Gallo pinto con huevo", 200.0, 9.0, 28.0, 6.0)
    ]


# SDD: 029 REQ-001 AC-001.2
def test_after_editing_favorites_and_search_show_the_new_values(client, app, headers):
    """Los favoritos y `search?q=gallo` devuelven el alimento con los valores nuevos,
    el mismo id y `favorite: true`, sin ningún «Gallo pinto» antiguo."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    seed_favorite(app, "ana@example.com", custom_food_id=food_id)
    assert patch_custom(client, headers, food_id, edit_payload()).status_code == 200

    favorite_results = results_of(favorites(client, headers))
    found = results_of(search(client, headers, "gallo"))

    expected = {
        "kind": "custom",
        "id": food_id,
        "name": "Gallo pinto con huevo",
        "per_100g": {"calories_kcal": 200.0, "protein_g": 9.0, "carbs_g": 28.0, "fat_g": 6.0},
        "favorite": True,
    }
    assert favorite_results == [expected]
    assert found == [expected]
    assert all(item["name"] != "Gallo pinto" for item in found)


# SDD: 029 REQ-001 AC-001.3
def test_editing_only_the_case_of_the_own_name_is_200(client, app, headers):
    """«gallo PINTO» con los mismos valores: 200 y el nombre queda como se escribió."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(
        client,
        headers,
        food_id,
        edit_payload(name="gallo PINTO", calories_kcal=180, protein_g=6, carbs_g=30, fat_g=4),
    )

    assert response.status_code == 200
    assert response.get_json()["name"] == "gallo PINTO"
    assert custom_rows(app) == [gallo_row(food_id, "gallo PINTO")]


# SDD: 029 REQ-001 AC-001.4
def test_editing_with_the_current_name_and_values_is_200_and_unchanged(client, app, headers):
    """Mismos nombre y valores: 200 con el alimento sin cambios."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(
        client,
        headers,
        food_id,
        edit_payload(name="Gallo pinto", calories_kcal=180, protein_g=6, carbs_g=30, fat_g=4),
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["name"] == "Gallo pinto" and body["per_100g"] == GALLO_PER_100G
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-001 AC-001.5
def test_editing_with_the_name_of_a_catalog_food_is_200(client, app, headers):
    """«Arroz blanco cocido» es del catálogo: no cuenta como repetido."""
    seed(app, WHITE_RICE)
    food_id = seed_custom(app, "ana@example.com", "Arroz de la casa")

    response = patch_custom(client, headers, food_id, edit_payload(name="Arroz blanco cocido"))

    assert response.status_code == 200
    assert response.get_json()["name"] == "Arroz blanco cocido"


# SDD: 029 REQ-001 AC-001.6
def test_editing_a_non_favorite_answers_favorite_false_and_stays_so(client, app, headers):
    """Sin favorito: `favorite: false` y la tabla de favoritos sigue vacía."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, edit_payload())

    assert response.status_code == 200
    assert response.get_json()["favorite"] is False
    assert favorites_in_database(app) == 0


# SDD: 029 REQ-001 AC-001.1
def test_editing_keeps_the_favorite_row_of_the_food(client, app, headers):
    """La edición no recrea el favorito: sigue una sola fila, la misma."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    seed_favorite(app, "ana@example.com", custom_food_id=food_id)

    response = patch_custom(client, headers, food_id, edit_payload())

    assert response.status_code == 200
    with app.app_context():
        rows = db.session.query(FoodFavorite).all()
        assert [row.custom_food_id for row in rows] == [food_id]


# SDD: 029 REQ-002 AC-002.1
@pytest.mark.parametrize("body", ["hola", None, [], [{"name": "x"}], 5])
def test_editing_with_a_body_that_is_not_an_object_is_400(client, app, headers, body):
    """Texto, `null`, lista o número: 400 «La petición no es válida» y el alimento no cambia."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, body)

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.1
def test_editing_with_malformed_json_is_400(client, app, headers):
    """JSON malformado: el mismo 400 y el alimento no cambia."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = client.patch(
        f"{URL}/custom/{food_id}", data="{no es json", content_type="application/json",
        headers=headers,
    )

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.1
def test_editing_with_a_literal_json_null_is_400(client, app, headers):
    """El cuerpo `null` enviado de verdad (el parámetro `json=None` del cliente no lo manda)."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = client.patch(
        f"{URL}/custom/{food_id}", data="null", content_type="application/json", headers=headers
    )

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.1
def test_editing_without_a_json_body_is_400(client, app, headers):
    """Sin cuerpo ni tipo de contenido: 400 y sin cambios."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = client.patch(f"{URL}/custom/{food_id}", headers=headers)

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


def without(body, key):
    body = dict(body)
    del body[key]
    return body


# SDD: 029 REQ-002 AC-002.2
@pytest.mark.parametrize("name", ["", "   ", None])
def test_editing_without_a_usable_name_is_400(client, app, headers, name):
    """Nombre vacío, solo espacios o `null`: «Escribe el nombre del alimento.»."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, edit_payload(name=name))

    assert response.status_code == 400
    assert response.get_json() == NAME_REQUIRED_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.2
def test_editing_without_the_name_key_is_400(client, app, headers):
    """Sin la clave `name`."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, without(edit_payload(), "name"))

    assert response.status_code == 400
    assert response.get_json() == NAME_REQUIRED_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.3
def test_editing_with_a_name_of_101_characters_is_400_and_of_100_is_200(client, app, headers):
    """101 caracteres tras recortar: 400; 100 caracteres: 200 y se guarda."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    too_long = patch_custom(client, headers, food_id, edit_payload(name=" " + "a" * 101 + " "))
    assert too_long.status_code == 400
    assert too_long.get_json() == NAME_TOO_LONG_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]

    accepted = patch_custom(client, headers, food_id, edit_payload(name="a" * 100))
    assert accepted.status_code == 200
    assert custom_rows(app)[0][1] == "a" * 100


# SDD: 029 REQ-002 AC-002.4
@pytest.mark.parametrize(
    "per_100g",
    [
        None,
        {"calories_kcal": 100, "protein_g": 10, "carbs_g": 10},
        {"calories_kcal": 100, "protein_g": 10, "carbs_g": 10, "fat_g": None},
    ],
)
def test_editing_without_the_four_values_is_400(client, app, headers, per_100g):
    """`per_100g` ausente o incompleto: «Indica las calorías, proteína, …»."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    body = {"name": "Gallo pinto con huevo"}
    if per_100g is not None:
        body["per_100g"] = per_100g

    response = patch_custom(client, headers, food_id, body)

    assert response.status_code == 400
    assert response.get_json() == PER_100G_REQUIRED_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.5
@pytest.mark.parametrize("calories", [-1, 901])
def test_editing_with_calories_out_of_range_is_400(client, app, headers, calories):
    """Calorías de -1 y de 901."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(
        client, headers, food_id, edit_payload(calories_kcal=calories, protein_g=0, carbs_g=0, fat_g=0)
    )

    assert response.status_code == 400
    assert response.get_json() == CALORIES_RANGE_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.6
@pytest.mark.parametrize(
    "values",
    [{"protein_g": -1, "carbs_g": 0, "fat_g": 0}, {"protein_g": 0, "carbs_g": 0, "fat_g": 101}],
)
def test_editing_with_macros_out_of_range_is_400(client, app, headers, values):
    """Proteína de -1 o grasa de 101."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, edit_payload(**values))

    assert response.status_code == 400
    assert response.get_json() == MACROS_RANGE_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-002 AC-002.7
def test_editing_with_macros_that_add_up_to_more_than_100_is_400(client, app, headers):
    """40 + 40 + 30 supera los 100 g."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(
        client, headers, food_id, edit_payload(protein_g=40, carbs_g=40, fat_g=30)
    )

    assert response.status_code == 400
    assert response.get_json() == MACROS_SUM_MESSAGE
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-003 AC-003.1
def test_editing_with_the_name_of_another_own_food_is_409_and_changes_neither(
    client, app, headers
):
    """«  ARROZ con   pollo de mama » choca con «Arroz con pollo de mamá»: 409 y los dos
    alimentos conservan nombre y valores."""
    first = seed_custom(app, "ana@example.com", "Gallo pinto")
    second = seed_custom(app, "ana@example.com", "Arroz con pollo de mamá", calories=150.0)

    response = patch_custom(
        client, headers, first, edit_payload(name="  ARROZ con   pollo de mama ")
    )

    assert response.status_code == 409
    assert response.get_json() == NAME_TAKEN_MESSAGE
    assert custom_rows(app) == [
        gallo_row(first),
        (second, "Arroz con pollo de mamá", 150.0, 6.0, 30.0, 4.0),
    ]


# SDD: 029 REQ-003 AC-003.1
def test_the_409_applies_to_an_own_food_that_is_not_a_favorite_too(client, app, headers):
    """El repetido no tiene por qué ser favorito."""
    first = seed_custom(app, "ana@example.com", "Gallo pinto")
    seed_custom(app, "ana@example.com", "Avena casera")
    seed_favorite(app, "ana@example.com", custom_food_id=first)

    response = patch_custom(client, headers, first, edit_payload(name="avena CASERA"))

    assert response.status_code == 409
    assert response.get_json() == NAME_TAKEN_MESSAGE


# SDD: 029 REQ-003 AC-003.2
def test_editing_with_a_name_that_only_another_user_has_is_200(
    client, app, headers, other_headers
):
    """El nombre del alimento de Luis no cuenta para Ana."""
    seed_custom(app, "luis@example.com", "Arroz con pollo de mamá")
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, edit_payload(name="Arroz con pollo de mamá"))

    assert response.status_code == 200
    assert response.get_json()["name"] == "Arroz con pollo de mamá"


def concurrent_patches(app, email, token_headers, requests):
    """Bloquea la fila del usuario desde una conexión propia, lanza un `PATCH` por
    (id, cuerpo) en hilos distintos, espera a que todos queden en espera del bloqueo, lo
    libera y devuelve (estado, json) de cada uno (patrón de `concurrent_posts` de la 028)."""
    results = {}

    def worker(index, food_id, body):
        response = app.test_client().patch(
            f"{URL}/custom/{food_id}", json=body, headers=token_headers
        )
        results[index] = (response.status_code, response.get_json())

    def waiters(monitor):
        return monitor.execute(
            text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND wait_event_type = 'Lock' "
                "AND pid <> pg_backend_pid()"
            )
        ).scalar()

    def wait_until(condition, timeout=10.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if condition():
                return True
            time.sleep(0.05)
        return condition()

    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        lock_conn = db.engine.connect()
        monitor = db.engine.connect().execution_options(isolation_level="AUTOCOMMIT")
        lock_tx = lock_conn.begin()
        threads = []
        try:
            lock_conn.execute(
                text("SELECT id FROM public.users WHERE id = :id FOR UPDATE"), {"id": user_id}
            )
            threads = [
                threading.Thread(target=worker, args=(i, food_id, body), daemon=True)
                for i, (food_id, body) in enumerate(requests)
            ]
            for thread in threads:
                thread.start()
            reached = wait_until(lambda: waiters(monitor) >= len(requests))
            assert reached, (
                "las peticiones no llegaron a esperar el bloqueo de la fila del usuario: "
                "el test no habría probado la concurrencia"
            )
        finally:
            lock_tx.rollback()
            lock_conn.close()
            for thread in threads:
                thread.join(timeout=15)
            monitor.close()

    assert all(not t.is_alive() for t in threads), "una petición quedó colgada"
    return [results[i] for i in range(len(requests))]


# SDD: 029 REQ-003 AC-003.3
def test_two_simultaneous_edits_to_the_same_name_give_one_200_and_one_409(client, app, headers):
    """«Avena» y «Banano» editados a la vez a «Batido»: una responde 200 y la otra 409,
    ninguna 500, y la biblioteca tiene un solo «Batido»."""
    avena = seed_custom(app, "ana@example.com", "Avena")
    banano = seed_custom(app, "ana@example.com", "Banano")

    results = concurrent_patches(
        app,
        "ana@example.com",
        headers,
        [(avena, edit_payload(name="Batido")), (banano, edit_payload(name="Batido"))],
    )

    assert sorted(status for status, _ in results) == [200, 409]
    assert not any(status == 500 for status, _ in results)
    (conflict,) = [body for status, body in results if status == 409]
    assert conflict == NAME_TAKEN_MESSAGE
    names = [row[1] for row in custom_rows(app, "ana@example.com")]
    assert names.count("Batido") == 1
    assert sorted(names) in (["Avena", "Batido"], ["Banano", "Batido"])


# SDD: 029 REQ-004 AC-004.1
def test_editing_an_own_food_of_another_user_is_404_and_leaves_it_intact(
    client, app, headers, other_headers
):
    """Ana no puede editar el alimento de Luis: 404 y Luis sigue viéndolo igual."""
    luis_food = seed_custom(app, "luis@example.com", "Gallo pinto")

    response = patch_custom(client, headers, luis_food, edit_payload())

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert custom_rows(app, "luis@example.com") == [gallo_row(luis_food)]
    assert names_of(search(client, other_headers, "gallo")) == ["Gallo pinto"]


# SDD: 029 REQ-004 AC-004.2
@pytest.mark.parametrize("food_id", ["abc", "0", "2147483648", "999999", "-5"])
def test_editing_with_an_id_that_does_not_exist_or_is_not_valid_is_404(
    client, app, headers, food_id
):
    """Inexistente, `abc`, `0` o `2147483648`: 404 con un cuerpo válido."""
    own = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = patch_custom(client, headers, food_id, edit_payload())

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert custom_rows(app) == [gallo_row(own)]


# SDD: 029 REQ-004 AC-004.3
def test_editing_an_own_food_that_was_deleted_is_404(client, app, headers):
    """Tras `DELETE /custom/{id}` (028) la edición responde 404."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    assert delete_custom(client, headers, food_id).status_code == 204

    response = patch_custom(client, headers, food_id, edit_payload())

    assert response.status_code == 404
    assert response.get_json() == NOT_FOUND
    assert custom_rows(app) == []


# SDD: 029 REQ-004 AC-004.4
def test_editing_without_an_authorization_header_is_401_and_changes_nothing(
    client, app, headers
):
    """Sin cabecera de autorización: 401 y el alimento no cambia."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = client.patch(f"{URL}/custom/{food_id}", json=edit_payload())

    assert response.status_code == 401
    assert custom_rows(app) == [gallo_row(food_id)]


# SDD: 029 REQ-004 AC-004.4
def test_editing_with_an_expired_token_is_401(client, app, headers):
    """Un token caducado: 401 y el alimento no cambia."""
    food_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    with app.app_context():
        token = jwt_manager.generate_token({"id": "user-1", "user_role": "user"}, -5)

    response = client.patch(
        f"{URL}/custom/{food_id}",
        json=edit_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert custom_rows(app) == [gallo_row(food_id)]


# --------------------------------------------------------------------------
# Sesión (REQ-011) y sin proveedores ni límite (NFR-001)
# --------------------------------------------------------------------------

ENDPOINTS = [
    ("get", f"{URL}/search?q=arroz"),
    ("get", f"{URL}/recent"),
    ("get", f"{URL}/favorites"),
    ("put", f"{URL}/favorites/catalog/banano"),
    ("put", f"{URL}/favorites/custom/1"),
    ("delete", f"{URL}/favorites/catalog/banano"),
    ("delete", f"{URL}/favorites/custom/1"),
    ("delete", f"{URL}/custom/1"),
]


# SDD: 028 REQ-011 AC-011.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_route_requires_a_session(client, method, url):
    """Sin cabecera de autorización: 401 en las ocho rutas."""
    assert getattr(client, method)(url).status_code == 401


# SDD: 028 REQ-011 AC-011.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_route_rejects_an_expired_token(client, app, method, url):
    """Un token caducado: 401 en las ocho rutas."""
    with app.app_context():
        token = jwt_manager.generate_token({"id": "user-1", "user_role": "user"}, -5)

    response = getattr(client, method)(url, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


# SDD: 028 REQ-011 AC-011.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_route_rejects_an_invalid_token(client, method, url):
    """Un token mal formado: 401."""
    response = getattr(client, method)(url, headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401


# SDD: 028 REQ-011 AC-011.1
def test_a_request_without_a_session_changes_nothing(client, app, headers):
    """Las escrituras sin sesión no marcan ni borran nada."""
    seed(app, BANANA)
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    client.put(f"{URL}/favorites/catalog/banano")
    client.delete(f"{URL}/custom/{own_id}")

    assert favorites_in_database(app) == 0
    with app.app_context():
        assert db.session.query(CustomFood).count() == 1
    # Contraste: con sesion la misma escritura si marca el favorito (028).
    assert put_favorite(client, headers, "catalog", "banano").status_code == 204
    assert favorites_in_database(app) == 1


# SDD: 028 NFR-001 AC-N001.1
def test_search_recent_and_favorites_never_ask_voyage_for_an_embedding(
    client, app, headers, voyage
):
    """Con un proveedor de embeddings simulado, las tres lecturas no le piden nada."""
    seed(app, BANANA)
    seed_favorite(app, "ana@example.com", catalog_id="banano")
    post_meal(client, headers, [catalog_item("banano")])

    assert search(client, headers, "banano").status_code == 200
    assert search(client, headers, "bnano").status_code == 200
    assert recent(client, headers).status_code == 200
    assert favorites(client, headers).status_code == 200

    assert voyage.calls == []


# SDD: 028 NFR-001 AC-N001.2
def test_60_valid_searches_in_a_row_all_answer_200(client, app, headers, redis_fake):
    """Sin límite de uso: la búsqueda 60 sigue respondiendo 200 y no usa Redis."""
    seed(app, BANANA)
    counts_before = dict(redis_fake.counts)

    statuses = [search(client, headers, "banano").status_code for _ in range(60)]

    assert statuses == [200] * 60
    assert redis_fake.counts == counts_before


# --------------------------------------------------------------------------
# Iteración 2: favoritos retirados del catálogo (REQ-009, F3)
# --------------------------------------------------------------------------


def remove_from_catalog(app, catalog_id):
    """Quita un alimento del catálogo con la sesión, como haría una carga."""
    with app.app_context():
        db.session.execute(delete(CatalogFood).where(CatalogFood.id == catalog_id))
        db.session.commit()


# SDD: 028 REQ-009 AC-009.6
def test_a_favorite_removed_from_the_catalog_does_not_count_for_the_limit(client, app, headers):
    """100 favoritos, uno retirado del catálogo: marcar «Banano» da 204 y la lista
    de favoritos tiene 100 alimentos, entre ellos «Banano»."""
    seed(app, BANANA, *hundred_fruits())
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == "ana@example.com"))
        db.session.add_all(
            [FoodFavorite(user_id=user_id, catalog_id=f"fruta-{n:03d}") for n in range(100)]
        )
        db.session.commit()
    remove_from_catalog(app, "fruta-099")

    response = put_favorite(client, headers, "catalog", "banano")

    assert response.status_code == 204
    listed = names_of(favorites(client, headers))
    assert len(listed) == 100
    assert "Banano" in listed


# SDD: 028 REQ-009 AC-009.7
def test_unmarking_a_favorite_removed_from_the_catalog_is_204_and_it_does_not_come_back(
    client, app, headers
):
    """El favorito «Banano» retirado del catálogo se quita con 204; si una carga
    posterior devuelve «Banano», no aparece en los favoritos."""
    seed(app, BANANA)
    seed_favorite(app, "ana@example.com", catalog_id="banano")
    remove_from_catalog(app, "banano")

    response = delete_favorite(client, headers, "catalog", "banano")

    assert response.status_code == 204
    assert favorites_in_database(app) == 0
    seed(app, BANANA)
    assert names_of(favorites(client, headers)) == []


# SDD: 028 REQ-009 AC-009.8
def test_unmarking_a_food_that_is_nowhere_for_this_user_is_404_and_leaves_the_other_user_alone(
    client, app, headers, other_headers
):
    """«queso» es favorito retirado de Luis, no de Ana: Ana recibe 404 y el favorito de
    Luis sigue. En el mismo escenario, el favorito retirado de Ana se quita con 204."""
    seed_favorite(app, "luis@example.com", catalog_id="queso")
    seed_favorite(app, "ana@example.com", catalog_id="avena-cocida")

    removed = delete_favorite(client, headers, "catalog", "avena-cocida")
    rejected = delete_favorite(client, headers, "catalog", "queso")

    assert removed.status_code == 204
    assert rejected.status_code == 404
    assert rejected.get_json() == NOT_FOUND
    with app.app_context():
        remaining = db.session.scalars(select(FoodFavorite.catalog_id)).all()
    assert remaining == ["queso"]


# SDD: 028 NFR-004 AC-N004.1
def test_a_search_of_100_characters_answers_200_empty_within_the_comparison_bound(
    client, app, headers
):
    """`"arroces " * 12 + "qzxw"` responde 200 con `results` vacío; el servicio, con la base
    real y un alimento propio, hace las mismas comparaciones que con `arroces qzxw`
    y como mucho F × P."""
    seed(app, WHITE_RICE, BROWN_RICE, BEANS)
    seed_custom(app, "ana@example.com", "Gallo pinto")
    long_query = "arroces " * 12 + "qzxw"
    assert len(long_query) == 100

    response = search(client, headers, long_query)

    assert response.status_code == 200
    assert response.get_json() == {"results": []}
    user_id = user_id_of(app, "ana@example.com")
    with app.app_context():
        service = _build_food_library_service()
        candidates = [
            SearchCandidate(food.name, food.synonyms, 0, str(food.id), food)
            for food in CatalogFoodRepository(db.session).list_all()
        ] + [
            SearchCandidate(food.name, (), 1, str(food.id), food)
            for food in CustomFoodRepository(db.session).list_by_user(user_id)
        ]
        long_stats, short_stats = TypoSearchStats(), TypoSearchStats()
        assert service.search(user_id, long_query, stats=long_stats) == []
        assert service.search(user_id, "arroces qzxw", stats=short_stats) == []
        assert short_stats.comparisons > 0
        assert long_stats.comparisons == short_stats.comparisons
        assert long_stats.comparisons <= typo_comparison_bound(candidates, long_query)
