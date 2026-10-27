"""Tests de INTEGRACIÓN de `/api/meals` (spec 022): cliente HTTP real contra la
app, los servicios y los repositorios reales y el Postgres de prueba. El
reloj del servidor se fija con `app_clock` en 2026-10-21 03:00 (UTC); los
usuarios se registran por `/api/auth/register` porque `meals.user_id` tiene
FK a `users`. Los alimentos de USDA se siembran con `db.session.add(Food(...))`.
"""

from datetime import datetime

import pytest

from extensions import db, jwt_manager
from models import CatalogFood, Food
from models.meal import Meal, MealItem
from repositories.catalog_food_repository import CatalogFoodRepository
from repositories.food_repository import FoodRepository
from services.catalog_load_service import CatalogLoadService
from tests.catalog_samples import catalog_row, write_catalog_csv
from unit_of_work.unit_of_work import UnitOfWork

URL = "/api/meals"
NOW = datetime(2026, 10, 21, 3, 0)
TODAY = "2026-10-21"
PASSWORD = "ClaveSegura123"

CHICKEN_NAME = "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
CHICKEN = {
    "fdc_id": 171477,
    "description": CHICKEN_NAME,
    "data_type": "sr_legacy",
    "calories_kcal": 165.0,
    "protein_g": 31.0,
    "carbs_g": 0.0,
    "fat_g": 3.57,
}
GALLO = {
    "name": "  Gallo pinto  ",
    "grams": 250,
    "per_100g": {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2},
}

INVALID_REQUEST = {"error": "La petición no es válida"}
MEAL_NOT_FOUND = {"error": "No encontramos esa comida."}
ITEM_NOT_FOUND = {"error": "No encontramos ese alimento en la comida."}


@pytest.fixture(autouse=True)
def fixed_clock(app_clock):
    app_clock.set(NOW)
    return app_clock


def register(client, email="ana@example.com"):
    """Registra un usuario real y devuelve sus cabeceras de sesión."""
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
    return register(client)


def seed_food(app, **overrides):
    with app.app_context():
        db.session.add(Food(**{**CHICKEN, "embedding": None, **overrides}))
        db.session.commit()


@pytest.fixture
def chicken(app):
    seed_food(app)


def post(client, headers, items, date=TODAY, meal_type="lunch"):
    return client.post(
        URL, json={"date": date, "meal_type": meal_type, "items": items}, headers=headers
    )


def diary(client, headers, date=TODAY):
    response = client.get(URL, query_string={"date": date}, headers=headers)
    assert response.status_code == 200
    return response.get_json()


def counts(app):
    with app.app_context():
        return (
            db.session.query(Meal).count(),
            db.session.query(MealItem).count(),
        )


def usda(grams=150, fdc_id=171477):
    return {"fdc_id": fdc_id, "grams": grams}


# --------------------------------------------------------------------------
# POST: creación y forma de la respuesta
# --------------------------------------------------------------------------


# SDD: 022 REQ-001 AC-001.1
def test_post_creates_the_meal_with_the_computed_nutrients(client, headers, chicken):
    """201 con la comida `lunch` y el pollo de 150 g con sus nutrientes."""
    response = post(client, headers, [usda(150)])

    assert response.status_code == 201
    body = response.get_json()
    assert body["meal_type"] == "lunch"
    item = body["items"][0]
    assert item["source"] == "usda"
    assert item["fdc_id"] == 171477
    assert item["name"] == CHICKEN_NAME
    assert item["grams"] == 150
    assert item["nutrients"] == {
        "calories_kcal": 247.5,
        "protein_g": 46.5,
        "carbs_g": 0.0,
        "fat_g": 5.36,
    }


# SDD: 022 REQ-001 AC-001.6
def test_post_response_has_the_full_contract_shape(client, headers, chicken):
    """La respuesta incluye los campos de la sección 6 con `per_100g` de USDA."""
    body = post(client, headers, [usda(150)]).get_json()

    assert set(body) == {"id", "date", "meal_type", "items", "totals", "incomplete"}
    assert body["date"] == TODAY
    assert body["totals"] == {
        "calories_kcal": 247.5,
        "protein_g": 46.5,
        "carbs_g": 0.0,
        "fat_g": 5.36,
    }
    assert body["incomplete"] == []
    item = body["items"][0]
    assert set(item) == {
        "id", "source", "fdc_id", "catalog_id", "name", "data_type", "grams", "per_100g",
        "nutrients",
    }
    assert item["catalog_id"] is None
    assert item["data_type"] == "sr_legacy"
    assert item["per_100g"] == {
        "calories_kcal": 165.0,
        "protein_g": 31.0,
        "carbs_g": 0.0,
        "fat_g": 3.57,
    }


# SDD: 022 REQ-001 AC-001.2
def test_post_to_an_existing_meal_returns_200_with_both_items_in_order(client, headers, chicken):
    """Segundo alimento al mismo día y tipo: 200, mismo `id`, dos alimentos."""
    first = post(client, headers, [usda(150)])

    second = post(client, headers, [GALLO])

    assert second.status_code == 200
    assert second.get_json()["id"] == first.get_json()["id"]
    assert [i["source"] for i in second.get_json()["items"]] == ["usda", "custom"]


# SDD: 022 REQ-001 AC-001.3
def test_post_to_another_meal_type_creates_a_distinct_meal(client, headers, chicken):
    """`dinner` junto a un `lunch` existente: 201 y otro `id`."""
    lunch = post(client, headers, [usda()]).get_json()

    dinner = post(client, headers, [usda()], meal_type="dinner")

    assert dinner.status_code == 201
    assert dinner.get_json()["id"] != lunch["id"]


# SDD: 022 REQ-001 AC-001.4
def test_post_keeps_null_for_a_nutrient_without_data(client, app, headers):
    """Sin dato de carbohidratos en USDA, `carbs_g` es `null` en `nutrients` y
    en `per_100g`, y los demás se calculan."""
    seed_food(app, fdc_id=7, description="Mystery food", carbs_g=None)

    item = post(client, headers, [usda(200, fdc_id=7)]).get_json()["items"][0]

    assert item["per_100g"]["carbs_g"] is None
    assert item["nutrients"]["carbs_g"] is None
    assert item["nutrients"]["calories_kcal"] == 330.0


# SDD: 022 REQ-001 AC-001.5
def test_post_with_three_items_keeps_the_request_order(client, app, headers, chicken):
    """Tres alimentos en una petición quedan en el orden de `items`."""
    seed_food(app, fdc_id=8, description="Rice")

    items = post(client, headers, [usda(10, 8), GALLO, usda(30)]).get_json()["items"]

    assert [i["fdc_id"] for i in items] == [8, None, 171477]


# SDD: 022 REQ-002 AC-002.1
def test_post_custom_item_is_saved_with_stripped_name_and_nutrients(client, headers):
    """Gallo pinto de 250 g: `source=custom`, sin FDC ID, 400 kcal, 13,75 g..."""
    response = post(client, headers, [GALLO])

    assert response.status_code == 201
    item = response.get_json()["items"][0]
    assert item["source"] == "custom"
    assert item["fdc_id"] is None
    assert item["data_type"] is None
    assert item["name"] == "Gallo pinto"
    assert item["grams"] == 250
    assert item["nutrients"] == {
        "calories_kcal": 400.0,
        "protein_g": 13.75,
        "carbs_g": 67.5,
        "fat_g": 8.0,
    }


# SDD: 022 REQ-002 AC-002.2
def test_post_accepts_a_usda_and_a_custom_item_together(client, headers, chicken):
    """La comida tiene los dos, cada uno con su `source`."""
    items = post(client, headers, [usda(), GALLO]).get_json()["items"]

    assert [i["source"] for i in items] == ["usda", "custom"]


# SDD: 022 REQ-002 AC-002.3
def test_post_custom_item_with_a_zero_value_keeps_zero_not_null(client, headers):
    """Un valor por 100 g igual a 0 da un nutriente igual a 0."""
    item = {
        "name": "Agua",
        "grams": 300,
        "per_100g": {"calories_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
    }

    nutrients = post(client, headers, [item]).get_json()["items"][0]["nutrients"]

    assert nutrients == {"calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}


# --------------------------------------------------------------------------
# POST: validación
# --------------------------------------------------------------------------


# SDD: 022 REQ-003 AC-003.1
@pytest.mark.parametrize(
    "kwargs",
    [
        {"data": "texto", "content_type": "text/plain"},
        {"data": "null", "content_type": "application/json"},
        {"data": "[1, 2]", "content_type": "application/json"},
        {"data": "{malformado", "content_type": "application/json"},
    ],
)
def test_post_rejects_a_body_that_is_not_a_json_object(client, headers, kwargs):
    """Texto, `null`, lista o JSON malformado: 400 «La petición no es válida»."""
    response = client.post(URL, headers=headers, **kwargs)

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# (mensaje esperado, cuerpo de la petición)
VALIDATION_CASES = {
    "meal_type_missing": (
        "El tipo de comida no es válido.",
        {"date": TODAY, "items": [usda()]},
    ),
    "meal_type_unknown": (
        "El tipo de comida no es válido.",
        {"date": TODAY, "meal_type": "brunch", "items": [usda()]},
    ),
    "items_missing": ("Añade al menos un alimento.", {"date": TODAY, "meal_type": "lunch"}),
    "items_not_a_list": (
        "Añade al menos un alimento.",
        {"date": TODAY, "meal_type": "lunch", "items": "pollo"},
    ),
    "items_empty": (
        "Añade al menos un alimento.",
        {"date": TODAY, "meal_type": "lunch", "items": []},
    ),
    "grams_missing": (
        "Los gramos deben estar entre 1 y 2000.",
        {"date": TODAY, "meal_type": "lunch", "items": [{"fdc_id": 171477}]},
    ),
    "grams_text": (
        "Los gramos deben estar entre 1 y 2000.",
        {"date": TODAY, "meal_type": "lunch", "items": [usda("150")]},
    ),
    "grams_below": (
        "Los gramos deben estar entre 1 y 2000.",
        {"date": TODAY, "meal_type": "lunch", "items": [usda(0.5)]},
    ),
    "grams_above": (
        "Los gramos deben estar entre 1 y 2000.",
        {"date": TODAY, "meal_type": "lunch", "items": [usda(2001)]},
    ),
    "grams_two_decimals": (
        "Los gramos admiten como mucho un decimal.",
        {"date": TODAY, "meal_type": "lunch", "items": [usda(150.25)]},
    ),
    "fdc_id_unknown": (
        "No encontramos ese alimento.",
        {"date": TODAY, "meal_type": "lunch", "items": [usda(100, 999999)]},
    ),
    "fdc_id_and_name": (
        "Cada alimento debe ser del catálogo, de USDA o personalizado.",
        {"date": TODAY, "meal_type": "lunch", "items": [{**usda(), "name": "Pollo"}]},
    ),
    "neither_fdc_id_nor_name": (
        "Cada alimento debe ser del catálogo, de USDA o personalizado.",
        {"date": TODAY, "meal_type": "lunch", "items": [{"grams": 100}]},
    ),
    "catalog_id_and_fdc_id": (
        "Cada alimento debe ser del catálogo, de USDA o personalizado.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "banano", "fdc_id": 171477, "grams": 100}],
        },
    ),
    "catalog_id_and_name": (
        "Cada alimento debe ser del catálogo, de USDA o personalizado.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "banano", "name": "Pollo", "grams": 100}],
        },
    ),
    "catalog_id_fdc_id_and_name": (
        "Cada alimento debe ser del catálogo, de USDA o personalizado.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "banano", "fdc_id": 171477, "name": "Pollo", "grams": 100}],
        },
    ),
    "catalog_grams_missing": (
        "Los gramos deben estar entre 1 y 2000.",
        {"date": TODAY, "meal_type": "lunch", "items": [{"catalog_id": "banano"}]},
    ),
    "catalog_grams_above": (
        "Los gramos deben estar entre 1 y 2000.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "banano", "grams": 2001}],
        },
    ),
    "catalog_grams_two_decimals": (
        "Los gramos admiten como mucho un decimal.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "banano", "grams": 150.25}],
        },
    ),
    "catalog_id_unknown": (
        "No encontramos ese alimento.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "no-existe", "grams": 100}],
        },
    ),
    "catalog_id_invalid_format": (
        "No encontramos ese alimento.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{"catalog_id": "Banano Maduro", "grams": 100}],
        },
    ),
    "name_blank": (
        "Escribe el nombre del alimento.",
        {"date": TODAY, "meal_type": "lunch", "items": [{**GALLO, "name": "   "}]},
    ),
    "name_too_long": (
        "El nombre no puede superar los 100 caracteres.",
        {"date": TODAY, "meal_type": "lunch", "items": [{**GALLO, "name": "a" * 101}]},
    ),
    "per_100g_missing_value": (
        "Indica las calorías, proteína, carbohidratos y grasa por 100 g.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [{**GALLO, "per_100g": {"calories_kcal": 100, "protein_g": 1, "carbs_g": 1}}],
        },
    ),
    "per_100g_not_a_number": (
        "Indica las calorías, proteína, carbohidratos y grasa por 100 g.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {
                        "calories_kcal": "mucho",
                        "protein_g": 1,
                        "carbs_g": 1,
                        "fat_g": 1,
                    },
                }
            ],
        },
    ),
    "calories_below": (
        "Las calorías por 100 g deben estar entre 0 y 900.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {"calories_kcal": -1, "protein_g": 1, "carbs_g": 1, "fat_g": 1},
                }
            ],
        },
    ),
    "calories_above": (
        "Las calorías por 100 g deben estar entre 0 y 900.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {"calories_kcal": 901, "protein_g": 1, "carbs_g": 1, "fat_g": 1},
                }
            ],
        },
    ),
    "macro_below": (
        "Los macros por 100 g deben estar entre 0 y 100 g.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {"calories_kcal": 100, "protein_g": -1, "carbs_g": 1, "fat_g": 1},
                }
            ],
        },
    ),
    "macro_above": (
        "Los macros por 100 g deben estar entre 0 y 100 g.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {"calories_kcal": 100, "protein_g": 1, "carbs_g": 101, "fat_g": 1},
                }
            ],
        },
    ),
    "macro_sum": (
        "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g.",
        {
            "date": TODAY,
            "meal_type": "lunch",
            "items": [
                {
                    **GALLO,
                    "per_100g": {"calories_kcal": 100, "protein_g": 50, "carbs_g": 50, "fat_g": 1},
                }
            ],
        },
    ),
}


# SDD: 022 REQ-003 AC-003.2
# SDD: 022 REQ-003 AC-003.3
# SDD: 022 REQ-003 AC-003.4
# SDD: 022 REQ-003 AC-003.5
# SDD: 022 REQ-003 AC-003.6
# SDD: 022 REQ-003 AC-003.7
# SDD: 022 REQ-003 AC-003.8
# SDD: 022 REQ-003 AC-003.9
# SDD: 022 REQ-003 AC-003.10
# SDD: 022 REQ-003 AC-003.11
# SDD: 022 REQ-003 AC-003.12
# SDD: 023 REQ-006 AC-006.3
# SDD: 023 REQ-006 AC-006.4
# SDD: 023 REQ-006 AC-006.5
@pytest.mark.parametrize("case", sorted(VALIDATION_CASES))
def test_post_validation_message_and_nothing_saved(client, app, headers, chicken, case):
    """Cada caso de la tabla de límites da 400 con su mensaje exacto y no
    guarda ninguna comida ni alimento."""
    message, body = VALIDATION_CASES[case]

    response = client.post(URL, json=body, headers=headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": message}
    assert counts(app) == (0, 0)


# SDD: 022 REQ-003 AC-003.4
@pytest.mark.parametrize("grams", [1, 2000])
def test_post_accepts_the_grams_limits(client, headers, chicken, grams):
    """1 y 2000 g se aceptan."""
    assert post(client, headers, [usda(grams)]).status_code == 201


# SDD: 022 REQ-003 AC-003.5
def test_post_accepts_one_decimal_in_the_grams(client, headers, chicken):
    """150,5 g se acepta."""
    item = post(client, headers, [usda(150.5)]).get_json()["items"][0]

    assert item["grams"] == 150.5


# SDD: 022 REQ-003 AC-003.10
@pytest.mark.parametrize("calories", [0, 900])
def test_post_accepts_the_calorie_limits(client, headers, calories):
    """0 y 900 kcal por 100 g se aceptan."""
    item = {
        "name": "X",
        "grams": 100,
        "per_100g": {"calories_kcal": calories, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
    }

    assert post(client, headers, [item]).status_code == 201


# SDD: 022 REQ-003 AC-003.12
def test_post_accepts_macros_that_add_up_to_exactly_100(client, headers):
    """Si suman exactamente 100 g por 100 g, se añade."""
    item = {
        "name": "Aceite",
        "grams": 100,
        "per_100g": {"calories_kcal": 884, "protein_g": 0, "carbs_g": 0, "fat_g": 100},
    }

    assert post(client, headers, [item]).status_code == 201


# SDD: 022 REQ-003 AC-003.13
def test_post_rejects_items_beyond_50_per_meal_and_keeps_the_meal(client, app, headers):
    """Con 48 alimentos, 3 más dan 400 y siguen 48; 2 más dejan 50."""
    custom = {**GALLO, "name": "Alimento"}
    first = post(client, headers, [custom] * 48)
    assert first.status_code == 201

    too_many = post(client, headers, [custom] * 3)
    fits = post(client, headers, [custom] * 2)

    assert too_many.status_code == 400
    assert too_many.get_json() == {"error": "Una comida no puede tener más de 50 alimentos."}
    assert fits.status_code == 200
    assert len(fits.get_json()["items"]) == 50
    assert counts(app) == (1, 50)


# SDD: 022 REQ-003 AC-003.14
def test_post_with_one_invalid_item_saves_nothing(client, app, headers, chicken):
    """Dos alimentos válidos y uno no válido: 400, sin comida ni alimentos."""
    response = post(client, headers, [usda(100), GALLO, usda(0)])

    assert response.status_code == 400
    assert counts(app) == (0, 0)


# --------------------------------------------------------------------------
# POST: fechas
# --------------------------------------------------------------------------


# SDD: 026 REQ-001 AC-001.1
@pytest.mark.parametrize("date", ["2025-10-20", "2026-01-15"])
def test_post_accepts_past_dates_up_to_366_days_back(client, headers, date):
    """Con el reloj en 2026-10-21 03:00, 366 días atrás y fechas intermedias se guardan."""
    response = post(client, headers, [GALLO], date=date)

    assert response.status_code == 201
    assert response.get_json()["date"] == date
    assert len(diary(client, headers, date)["meals"]) == 1


# Guarda de regresión de la 022: pasa sin implementar la 026.
# SDD: 022 REQ-004 AC-004.1
# Ayer, hoy y mañana siguen aceptándose.
@pytest.mark.parametrize("date", ["2026-10-20", "2026-10-21", "2026-10-22"])
def test_post_still_accepts_yesterday_today_and_tomorrow(client, headers, date):
    """Con el reloj en 2026-10-21 03:00 se guarda en la comida de esa fecha."""
    response = post(client, headers, [GALLO], date=date)

    assert response.status_code == 201
    assert response.get_json()["date"] == date
    assert len(diary(client, headers, date)["meals"]) == 1


# SDD: 026 REQ-001 AC-001.1
def test_post_to_an_existing_meal_of_a_past_date_returns_200(client, headers):
    """Una segunda petición al mismo día pasado y tipo responde 200."""
    first = post(client, headers, [GALLO], date="2026-01-15")

    second = post(client, headers, [GALLO], date="2026-01-15")

    assert first.status_code == 201
    assert second.status_code == 200
    assert len(second.get_json()["items"]) == 2


# SDD: 022 REQ-004 AC-004.2
# SDD: 026 REQ-001 AC-001.2
@pytest.mark.parametrize("date", ["2025-10-19", "2026-10-23"])
def test_post_rejects_dates_outside_the_window(client, app, headers, date):
    """El 2025-10-19 y el 2026-10-23: «Solo puedes registrar comidas de hoy o del
    último año.» y nada guardado."""
    response = post(client, headers, [GALLO], date=date)

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Solo puedes registrar comidas de hoy o del último año."
    }
    assert counts(app) == (0, 0)


# SDD: 026 REQ-001 AC-001.4
def test_patch_and_delete_work_on_a_meal_from_200_days_ago(client, headers):
    """Cambiar los gramos y quitar un alimento de hace 200 días funciona como hoy."""
    meal = post(client, headers, [GALLO, {**GALLO, "name": "Arroz"}], date="2026-04-04").get_json()
    first, second = (item["id"] for item in meal["items"])

    patched = patch(client, headers, meal["id"], first, {"grams": 100})
    removed = delete_item(client, headers, meal["id"], second)

    assert patched.status_code == 200
    assert patched.get_json()["items"][0]["grams"] == 100
    assert removed.status_code == 204
    items = diary(client, headers, "2026-04-04")["meals"][0]["items"]
    assert [i["id"] for i in items] == [first]


# SDD: 022 REQ-004 AC-004.3
@pytest.mark.parametrize("date", [None, "20-10-2026", "2026-02-30"])
def test_post_rejects_a_missing_or_invalid_date(client, headers, date):
    """Sin fecha, con otro formato o inexistente: «La fecha no es válida.»."""
    body = {"meal_type": "lunch", "items": [GALLO]}
    if date is not None:
        body["date"] = date

    response = client.post(URL, json=body, headers=headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": "La fecha no es válida."}


# --------------------------------------------------------------------------
# GET: el diario
# --------------------------------------------------------------------------


# SDD: 022 REQ-005 AC-005.1
def test_get_returns_the_meals_ordered_by_type(client, headers):
    """`dinner` guardada antes que `breakfast`: salen desayuno y luego cena."""
    post(client, headers, [GALLO], meal_type="dinner")
    post(client, headers, [GALLO], meal_type="breakfast")

    body = diary(client, headers)

    assert body["date"] == TODAY
    assert [m["meal_type"] for m in body["meals"]] == ["breakfast", "dinner"]


# SDD: 022 REQ-005 AC-005.2
def test_get_of_an_empty_day_has_zero_totals(client, headers):
    """Sin comidas: `meals` vacío, totales a 0 e `incomplete` vacío."""
    body = diary(client, headers)

    assert body["meals"] == []
    assert body["totals"] == {
        "calories_kcal": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
    }
    assert body["incomplete"] == []


# SDD: 022 REQ-005 AC-005.3
def test_get_sums_the_meal_subtotal_and_the_day_total(client, headers, chicken):
    """247,5 + 400,0 kcal dan 647,5 en la comida y en el día."""
    post(client, headers, [usda(150), GALLO])

    body = diary(client, headers)

    assert body["meals"][0]["totals"]["calories_kcal"] == 647.5
    assert body["totals"]["calories_kcal"] == 647.5


# SDD: 022 REQ-005 AC-005.4
def test_get_reports_incomplete_nutrients_in_the_meal_and_the_day(client, app, headers):
    """Un alimento sin carbohidratos y otro con 67,5 g: total 67,5 e
    `incomplete=["carbs_g"]` en la comida y en el día."""
    seed_food(app, fdc_id=7, description="Mystery food", carbs_g=None)
    post(client, headers, [usda(100, 7), GALLO])
    post(client, headers, [GALLO], meal_type="dinner")

    body = diary(client, headers)

    lunch, dinner = body["meals"]
    assert body["totals"]["carbs_g"] == 135.0
    assert lunch["totals"]["carbs_g"] == 67.5
    assert lunch["incomplete"] == ["carbs_g"]
    assert dinner["incomplete"] == []
    assert body["incomplete"] == ["carbs_g"]


# SDD: 022 REQ-005 AC-005.5
def test_get_only_returns_the_meals_of_the_requested_date(client, headers):
    """Comidas del 20 y del 21: pedir el 20 solo devuelve la del 20."""
    post(client, headers, [GALLO], date="2026-10-20")
    post(client, headers, [GALLO], date="2026-10-21")

    body = diary(client, headers, "2026-10-20")

    assert body["date"] == "2026-10-20"
    assert [m["date"] for m in body["meals"]] == ["2026-10-20"]


# SDD: 022 REQ-005 AC-005.6
@pytest.mark.parametrize("query", [{}, {"date": "20-10-2026"}, {"date": "2026-02-30"}])
def test_get_rejects_a_missing_or_invalid_date(client, headers, query):
    """Sin fecha o con una no válida: 400 «La fecha no es válida.»."""
    response = client.get(URL, query_string=query, headers=headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": "La fecha no es válida."}


# SDD: 022 REQ-005 AC-005.7
def test_get_accepts_a_date_far_outside_the_add_window(client, app, headers):
    """Con el reloj en 2026-10-21, se leen las comidas del 2026-09-01."""
    post(client, headers, [GALLO], date="2026-10-21")
    with app.app_context():
        db.session.query(Meal).update({"meal_date": datetime(2026, 9, 1).date()})
        db.session.commit()

    body = diary(client, headers, "2026-09-01")

    assert len(body["meals"]) == 1
    assert body["meals"][0]["date"] == "2026-09-01"


# --------------------------------------------------------------------------
# PATCH
# --------------------------------------------------------------------------


def make_chicken_meal(client, headers):
    response = post(client, headers, [usda(150)])
    assert response.status_code == 201
    meal = response.get_json()
    return meal["id"], meal["items"][0]["id"]


def patch(client, headers, meal_id, item_id, body):
    return client.patch(f"{URL}/{meal_id}/items/{item_id}", json=body, headers=headers)


# SDD: 022 REQ-006 AC-006.1
def test_patch_recalculates_the_nutrients_with_the_new_grams(client, headers, chicken):
    """150 g pasan a 200 g: 330, 62, 0 y 7,14."""
    meal_id, item_id = make_chicken_meal(client, headers)

    response = patch(client, headers, meal_id, item_id, {"grams": 200})

    assert response.status_code == 200
    item = response.get_json()["items"][0]
    assert item["grams"] == 200
    assert item["nutrients"] == {
        "calories_kcal": 330.0,
        "protein_g": 62.0,
        "carbs_g": 0.0,
        "fat_g": 7.14,
    }
    assert response.get_json()["totals"]["calories_kcal"] == 330.0


# SDD: 022 REQ-006 AC-006.2
def test_patch_custom_item_to_100_grams_returns_its_values_per_100g(client, headers):
    """Un personalizado de 250 g a 100 g tiene sus valores por 100 g."""
    meal = post(client, headers, [GALLO]).get_json()

    item = patch(
        client, headers, meal["id"], meal["items"][0]["id"], {"grams": 100}
    ).get_json()["items"][0]

    assert item["nutrients"] == {
        "calories_kcal": 160.0,
        "protein_g": 5.5,
        "carbs_g": 27.0,
        "fat_g": 3.2,
    }


# SDD: 022 REQ-006 AC-006.3
@pytest.mark.parametrize(
    "body, message",
    [
        ({"grams": 0}, "Los gramos deben estar entre 1 y 2000."),
        ({"grams": 2001}, "Los gramos deben estar entre 1 y 2000."),
        ({}, "Los gramos deben estar entre 1 y 2000."),
        ({"grams": 150.25}, "Los gramos admiten como mucho un decimal."),
    ],
)
def test_patch_rejects_invalid_grams_and_keeps_the_item(client, headers, chicken, body, message):
    """Gramos no válidos: 400 con el mensaje de AC-003.4 o AC-003.5 y el
    alimento no cambia."""
    meal_id, item_id = make_chicken_meal(client, headers)

    response = patch(client, headers, meal_id, item_id, body)

    assert response.status_code == 400
    assert response.get_json() == {"error": message}
    assert diary(client, headers)["meals"][0]["items"][0]["grams"] == 150


# SDD: 022 REQ-006 AC-006.4
def test_patch_rejects_a_body_that_is_not_a_json_object(client, headers, chicken):
    """Un cuerpo que no es un objeto: 400 «La petición no es válida»."""
    meal_id, item_id = make_chicken_meal(client, headers)

    response = client.patch(
        f"{URL}/{meal_id}/items/{item_id}",
        data="[1]",
        content_type="application/json",
        headers=headers,
    )

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# SDD: 022 REQ-006 AC-006.5
def test_patch_works_on_a_meal_outside_the_add_window(client, app, headers, chicken):
    """Con el reloj en 2026-10-21, se cambian los gramos de una comida del 2026-09-01."""
    meal_id, item_id = make_chicken_meal(client, headers)
    with app.app_context():
        db.session.query(Meal).update({"meal_date": datetime(2026, 9, 1).date()})
        db.session.commit()

    response = patch(client, headers, meal_id, item_id, {"grams": 200})

    assert response.status_code == 200
    assert response.get_json()["items"][0]["nutrients"]["calories_kcal"] == 330.0


# --------------------------------------------------------------------------
# DELETE
# --------------------------------------------------------------------------


def delete_item(client, headers, meal_id, item_id):
    return client.delete(f"{URL}/{meal_id}/items/{item_id}", headers=headers)


def delete_meal(client, headers, meal_id):
    return client.delete(f"{URL}/{meal_id}", headers=headers)


# SDD: 022 REQ-007 AC-007.1
def test_delete_item_keeps_the_meal_with_the_other_item(client, headers):
    """Quitar uno de dos alimentos: 204 y el diario muestra el otro."""
    meal = post(client, headers, [GALLO, {**GALLO, "name": "Arroz"}]).get_json()

    response = delete_item(client, headers, meal["id"], meal["items"][0]["id"])

    assert response.status_code == 204
    items = diary(client, headers)["meals"][0]["items"]
    assert [i["name"] for i in items] == ["Arroz"]


# SDD: 022 REQ-007 AC-007.2
def test_delete_last_item_deletes_the_meal(client, headers):
    """Quitar el único alimento: 204 y la comida desaparece del diario."""
    meal = post(client, headers, [GALLO]).get_json()

    response = delete_item(client, headers, meal["id"], meal["items"][0]["id"])

    assert response.status_code == 204
    assert diary(client, headers)["meals"] == []


# SDD: 022 REQ-007 AC-007.3
def test_delete_meal_removes_the_meal_and_its_items(client, app, headers):
    """Borrar una comida de tres alimentos: 204, fuera del diario y de la base."""
    meal = post(client, headers, [GALLO] * 3).get_json()

    response = delete_meal(client, headers, meal["id"])

    assert response.status_code == 204
    assert diary(client, headers)["meals"] == []
    assert counts(app) == (0, 0)


# SDD: 022 REQ-007 AC-007.4
def test_adding_after_deleting_a_meal_creates_a_new_one(client, headers):
    """Tras borrar la comida, añadir al mismo día y tipo da 201."""
    meal = post(client, headers, [GALLO]).get_json()
    delete_meal(client, headers, meal["id"])

    response = post(client, headers, [GALLO])

    assert response.status_code == 201


# SDD: 022 REQ-007 AC-007.5
def test_delete_item_and_meal_work_outside_the_add_window(client, app, headers):
    """Con el reloj en 2026-10-21, se quita un alimento y se borra la comida
    del 2026-09-01: las dos respuestas son 204."""
    meal = post(client, headers, [GALLO, GALLO]).get_json()
    with app.app_context():
        db.session.query(Meal).update({"meal_date": datetime(2026, 9, 1).date()})
        db.session.commit()

    removed = delete_item(client, headers, meal["id"], meal["items"][0]["id"])
    deleted = delete_meal(client, headers, meal["id"])

    assert removed.status_code == 204
    assert deleted.status_code == 204
    assert diary(client, headers, "2026-09-01")["meals"] == []


# --------------------------------------------------------------------------
# Historial estable
# --------------------------------------------------------------------------


# SDD: 022 REQ-008 AC-008.1
def test_diary_keeps_the_saved_data_when_usda_changes(client, app, headers, chicken):
    """Cambiar la descripción y la proteína en `foods` no altera el diario."""
    post(client, headers, [usda(150)])
    with app.app_context():
        food = db.session.get(Food, 171477)
        food.description = "Chicken (reimported)"
        food.protein_g = 99.0
        db.session.commit()

    item = diary(client, headers)["meals"][0]["items"][0]

    assert item["name"] == CHICKEN_NAME
    assert item["per_100g"]["protein_g"] == 31.0
    assert item["nutrients"]["protein_g"] == 46.5


# SDD: 022 REQ-008 AC-008.2
def test_patch_after_usda_changes_uses_the_stored_values_per_100g(client, app, headers, chicken):
    """Tras cambiar `foods`, el recálculo usa los valores guardados."""
    meal_id, item_id = make_chicken_meal(client, headers)
    with app.app_context():
        food = db.session.get(Food, 171477)
        food.calories_kcal = 999.0
        food.protein_g = 99.0
        db.session.commit()

    item = patch(client, headers, meal_id, item_id, {"grams": 200}).get_json()["items"][0]

    assert item["nutrients"]["calories_kcal"] == 330.0
    assert item["nutrients"]["protein_g"] == 62.0


# SDD: 022 REQ-008 AC-008.3
def test_diary_keeps_the_item_when_the_food_disappears_from_usda(client, app, headers, chicken):
    """Borrar el alimento de `foods` no borra ni cambia el registrado."""
    post(client, headers, [usda(150)])
    with app.app_context():
        db.session.query(Food).filter_by(fdc_id=171477).delete()
        db.session.commit()

    item = diary(client, headers)["meals"][0]["items"][0]

    assert item["fdc_id"] == 171477
    assert item["name"] == CHICKEN_NAME
    assert item["nutrients"]["calories_kcal"] == 247.5


# --------------------------------------------------------------------------
# Seguridad
# --------------------------------------------------------------------------


ENDPOINTS = [
    ("get", URL),
    ("post", URL),
    ("patch", f"{URL}/1/items/1"),
    ("delete", f"{URL}/1/items/1"),
    ("delete", f"{URL}/1"),
]


# SDD: 022 REQ-009 AC-009.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_endpoint_requires_a_session(client, method, url):
    """Sin cabecera de autorización: 401."""
    assert getattr(client, method)(url, json={}).status_code == 401


# SDD: 022 REQ-009 AC-009.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_endpoint_rejects_an_invalid_token(client, method, url):
    """Un token mal formado: 401."""
    response = getattr(client, method)(
        url, json={}, headers={"Authorization": "Bearer not-a-token"}
    )

    assert response.status_code == 401


# SDD: 022 REQ-009 AC-009.1
@pytest.mark.parametrize("method, url", ENDPOINTS)
def test_every_endpoint_rejects_an_expired_token(client, app, method, url):
    """Un token caducado: 401."""
    with app.app_context():
        token = jwt_manager.generate_token({"id": "user-1", "user_role": "user"}, -5)

    response = getattr(client, method)(
        url, json={}, headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


# SDD: 022 REQ-009 AC-009.2
def test_a_user_does_not_see_the_meals_of_another(client, headers):
    """El usuario B recibe el diario vacío de una fecha en la que A tiene comidas."""
    post(client, headers, [GALLO])
    other = register(client, "beto@example.com")

    assert diary(client, other)["meals"] == []


# SDD: 022 REQ-009 AC-009.3
def test_another_users_meal_is_not_found_and_unchanged(client, headers, chicken):
    """B no puede cambiar, quitar ni borrar la comida de A: 404 y no cambia."""
    meal_id, item_id = make_chicken_meal(client, headers)
    other = register(client, "beto@example.com")

    changed = patch(client, other, meal_id, item_id, {"grams": 200})
    removed = delete_item(client, other, meal_id, item_id)
    deleted = delete_meal(client, other, meal_id)

    for response in (changed, removed, deleted):
        assert response.status_code == 404
        assert response.get_json() == MEAL_NOT_FOUND
    item = diary(client, headers)["meals"][0]["items"][0]
    assert item["grams"] == 150


# SDD: 022 REQ-009 AC-009.4
def test_an_item_that_is_missing_or_from_another_meal_is_not_found(client, headers):
    """Un `item_id` inexistente o de otra comida: 404 con el mensaje de alimento."""
    lunch = post(client, headers, [GALLO]).get_json()
    dinner = post(client, headers, [GALLO], meal_type="dinner").get_json()

    cases = [
        patch(client, headers, lunch["id"], 999999, {"grams": 100}),
        delete_item(client, headers, lunch["id"], 999999),
        patch(client, headers, lunch["id"], dinner["items"][0]["id"], {"grams": 100}),
        delete_item(client, headers, lunch["id"], dinner["items"][0]["id"]),
    ]

    for response in cases:
        assert response.status_code == 404
        assert response.get_json() == ITEM_NOT_FOUND
    assert len(diary(client, headers)["meals"]) == 2


# SDD: 022 REQ-009 AC-009.5
def test_a_meal_that_does_not_exist_is_not_found(client, headers):
    """Cualquier operación sobre un `meal_id` inexistente da 404."""
    cases = [
        patch(client, headers, 999999, 1, {"grams": 100}),
        delete_item(client, headers, 999999, 1),
        delete_meal(client, headers, 999999),
    ]

    for response in cases:
        assert response.status_code == 404
        assert response.get_json() == MEAL_NOT_FOUND


# SDD: 022 REQ-009 AC-009.5
def test_ids_beyond_the_integer_range_are_not_found_without_a_server_error(client, headers):
    """Un id mayor que el INTEGER de Postgres da 404, no 500."""
    huge = 99_999_999_999
    created = post(client, headers, [GALLO])
    assert created.status_code == 201
    real_meal_id = created.get_json()["id"]

    on_meal = [
        delete_meal(client, headers, huge),
        patch(client, headers, huge, 1, {"grams": 100}),
        delete_item(client, headers, huge, 1),
    ]
    on_item = [
        patch(client, headers, real_meal_id, huge, {"grams": 100}),
        delete_item(client, headers, real_meal_id, huge),
    ]

    for response in on_meal:
        assert response.status_code == 404
        assert response.get_json() == MEAL_NOT_FOUND
    for response in on_item:
        assert response.status_code == 404
        assert response.get_json() == ITEM_NOT_FOUND
    assert len(diary(client, headers)["meals"]) == 1


# SDD: 022 REQ-009 AC-009.6
def test_two_users_adding_to_the_same_date_and_type_get_separate_meals(client, headers):
    """B añade a `lunch` de hoy: comida nueva (201) y la de A no cambia."""
    mine = post(client, headers, [GALLO]).get_json()
    other = register(client, "beto@example.com")

    theirs = post(client, other, [{**GALLO, "name": "Arroz"}])

    assert theirs.status_code == 201
    assert theirs.get_json()["id"] != mine["id"]
    assert [i["name"] for i in diary(client, headers)["meals"][0]["items"]] == ["Gallo pinto"]


# --------------------------------------------------------------------------
# Spec 023: alimentos del catálogo
# --------------------------------------------------------------------------

CATALOG_CHICKEN = {
    "id": "pechuga-de-pollo-a-la-plancha",
    "name": "Pechuga de pollo a la plancha",
    "synonyms": ["pollo asado"],
    "calories_kcal": 165.0,
    "protein_g": 31.0,
    "carbs_g": 0.0,
    "fat_g": 3.57,
    "source": "usda",
    "fdc_id": 171477,
    "reference": None,
}
CATALOG_BANANA = {
    "id": "banano",
    "name": "Banano",
    "synonyms": [],
    "calories_kcal": 89.0,
    "protein_g": 1.09,
    "carbs_g": 22.84,
    "fat_g": 0.33,
    "source": "manual",
    "fdc_id": None,
    "reference": "Tabla de prueba",
}
CHICKEN_PER_100G = {"calories_kcal": 165.0, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.57}


def seed_catalog(app, *foods):
    with app.app_context():
        for fields in foods:
            db.session.add(CatalogFood(**fields))
        db.session.commit()


@pytest.fixture
def catalog(app):
    seed_catalog(app, CATALOG_CHICKEN, CATALOG_BANANA)


def catalog_item(grams=150, catalog_id="pechuga-de-pollo-a-la-plancha"):
    return {"catalog_id": catalog_id, "grams": grams}


def load_catalog(app, tmp_path, rows):
    """Ejecuta la carga real (`CatalogLoadService`) sobre `db.session` con un
    CSV temporal."""
    path = write_catalog_csv(tmp_path / "catalogo.csv", rows)
    with app.app_context():
        service = CatalogLoadService(
            CatalogFoodRepository(db.session),
            FoodRepository(db.session),
            UnitOfWork(db.session),
        )
        return service.run(path)


def manual_row(**overrides):
    values = dict(
        id="pechuga-de-pollo-a-la-plancha",
        name="Pechuga renombrada",
        synonyms="",
        calories_kcal="200.0",
        protein_g="99.0",
        carbs_g="0.0",
        fat_g="1.0",
        source="manual",
        fdc_id="",
        reference="Tabla de prueba",
    )
    values.update(overrides)
    return catalog_row(**values)


# SDD: 023 REQ-006 AC-006.1
def test_post_saves_a_catalog_item_with_a_copy_of_the_catalog_data(client, headers, catalog):
    """La pechuga del catálogo con 150 g: 201, `source` catalog con su
    identificador, sin FDC ID ni tipo de dato, y nutrientes 247,5 / 46,5 / 0,0 / 5,36."""
    response = post(client, headers, [catalog_item(150)])

    assert response.status_code == 201
    item = response.get_json()["items"][0]
    assert {key: value for key, value in item.items() if key != "id"} == {
        "source": "catalog",
        "catalog_id": "pechuga-de-pollo-a-la-plancha",
        "fdc_id": None,
        "data_type": None,
        "name": "Pechuga de pollo a la plancha",
        "grams": 150,
        "per_100g": CHICKEN_PER_100G,
        "nutrients": {
            "calories_kcal": 247.5,
            "protein_g": 46.5,
            "carbs_g": 0.0,
            "fat_g": 5.36,
        },
    }


# SDD: 023 REQ-006 AC-006.1
def test_post_to_an_existing_meal_adds_a_catalog_item_and_returns_200(client, headers, catalog):
    """Un alimento del catálogo en una comida existente: 200 y mismo `id`."""
    first = post(client, headers, [catalog_item(150)])

    second = post(client, headers, [catalog_item(100, "banano")])

    assert second.status_code == 200
    assert second.get_json()["id"] == first.get_json()["id"]
    assert [i["name"] for i in second.get_json()["items"]] == [
        "Pechuga de pollo a la plancha",
        "Banano",
    ]


# SDD: 023 REQ-006 AC-006.2
def test_post_accepts_a_catalog_usda_and_custom_item_in_that_order(
    client, headers, catalog, chicken
):
    """Catálogo, USDA y personalizado: los tres, en ese orden, cada uno con su `source`."""
    response = post(client, headers, [catalog_item(), usda(), GALLO])

    assert response.status_code == 201
    items = response.get_json()["items"]
    assert [i["source"] for i in items] == ["catalog", "usda", "custom"]
    assert [i["catalog_id"] for i in items] == ["pechuga-de-pollo-a-la-plancha", None, None]


# SDD: 023 REQ-006 AC-006.3
def test_post_with_a_valid_catalog_item_and_an_unknown_one_saves_nothing(
    client, app, headers, catalog
):
    """Un alimento válido y uno inexistente: 400 y no se guarda ninguno."""
    response = post(client, headers, [catalog_item(), catalog_item(100, "no-existe")])

    assert response.status_code == 400
    assert response.get_json() == {"error": "No encontramos ese alimento."}
    assert counts(app) == (0, 0)


# SDD: 023 REQ-006 AC-006.3
def test_post_with_a_catalog_id_when_the_catalog_is_empty_is_a_400(client, app, headers):
    """Con el catálogo sin cargar, cualquier identificador es inexistente."""
    response = post(client, headers, [catalog_item()])

    assert response.status_code == 400
    assert response.get_json() == {"error": "No encontramos ese alimento."}
    assert counts(app) == (0, 0)


# SDD: 023 REQ-006 AC-006.6
def test_patch_recalculates_a_catalog_item_with_the_stored_values(client, headers, catalog):
    """150 g pasan a 200 g: 330,0 / 62,0 / 0,0 / 7,14."""
    created = post(client, headers, [catalog_item(150)]).get_json()

    response = patch(client, headers, created["id"], created["items"][0]["id"], {"grams": 200})

    assert response.status_code == 200
    item = response.get_json()["items"][0]
    assert item["grams"] == 200
    assert item["nutrients"] == {
        "calories_kcal": 330.0,
        "protein_g": 62.0,
        "carbs_g": 0.0,
        "fat_g": 7.14,
    }
    assert item["source"] == "catalog"
    assert item["catalog_id"] == "pechuga-de-pollo-a-la-plancha"


# SDD: 023 REQ-007 AC-007.1
def test_diary_keeps_the_saved_data_when_a_load_changes_the_food(
    client, app, headers, catalog, tmp_path
):
    """Una carga real cambia el nombre y la proteína por 100 g del alimento:
    el diario devuelve lo que se guardó."""
    post(client, headers, [catalog_item(150)])

    summary = load_catalog(app, tmp_path, [manual_row()])
    assert summary.updated == 1

    item = diary(client, headers)["meals"][0]["items"][0]
    assert item["name"] == "Pechuga de pollo a la plancha"
    assert item["per_100g"]["protein_g"] == 31.0
    assert item["per_100g"]["calories_kcal"] == 165.0
    assert item["nutrients"]["protein_g"] == 46.5
    assert item["nutrients"]["calories_kcal"] == 247.5


# SDD: 023 REQ-007 AC-007.2
def test_patch_after_a_load_changed_the_food_uses_the_stored_values_per_100g(
    client, app, headers, catalog, tmp_path
):
    """Tras una carga que cambia el alimento, cambiar los gramos recalcula con
    los valores por 100 g guardados."""
    created = post(client, headers, [catalog_item(150)]).get_json()
    load_catalog(app, tmp_path, [manual_row()])

    response = patch(client, headers, created["id"], created["items"][0]["id"], {"grams": 200})

    item = response.get_json()["items"][0]
    assert item["nutrients"]["calories_kcal"] == 330.0
    assert item["nutrients"]["protein_g"] == 62.0
    assert item["name"] == "Pechuga de pollo a la plancha"


# SDD: 023 REQ-002 AC-002.4
def test_diary_keeps_the_item_when_a_load_removes_the_food_from_the_catalog(
    client, app, headers, catalog, tmp_path
):
    """Una carga cuyo CSV ya no trae la pechuga la quita del catálogo, pero el
    diario devuelve el alimento con su nombre, sus valores por 100 g y sus
    nutrientes."""
    post(client, headers, [catalog_item(150)])

    summary = load_catalog(
        app,
        tmp_path,
        [manual_row(id="banano", name="Banano", calories_kcal="89.0", protein_g="1.09",
                    carbs_g="22.84", fat_g="0.33")],
    )
    assert summary.removed == 1
    with app.app_context():
        assert db.session.get(CatalogFood, "pechuga-de-pollo-a-la-plancha") is None

    item = diary(client, headers)["meals"][0]["items"][0]

    assert item["source"] == "catalog"
    assert item["catalog_id"] == "pechuga-de-pollo-a-la-plancha"
    assert item["name"] == "Pechuga de pollo a la plancha"
    assert item["per_100g"] == CHICKEN_PER_100G
    assert item["nutrients"] == {
        "calories_kcal": 247.5,
        "protein_g": 46.5,
        "carbs_g": 0.0,
        "fat_g": 5.36,
    }


# SDD: 023 REQ-008 AC-008.1
def test_diary_returns_usda_and_custom_items_with_a_null_catalog_id(client, headers, chicken):
    """Los alimentos de USDA y personalizados llevan `catalog_id: null` y sus
    campos de la 022 sin cambios."""
    post(client, headers, [usda(150), GALLO])

    items = diary(client, headers)["meals"][0]["items"]

    assert [i["catalog_id"] for i in items] == [None, None]
    assert items[0]["source"] == "usda"
    assert items[0]["fdc_id"] == 171477
    assert items[0]["data_type"] == "sr_legacy"
    assert items[0]["name"] == CHICKEN_NAME
    assert items[1]["source"] == "custom"
    assert items[1]["fdc_id"] is None
    assert items[1]["name"] == "Gallo pinto"


# SDD: 023 REQ-008 AC-008.1
def test_items_saved_before_the_spec_are_returned_with_a_null_catalog_id(client, app, headers):
    """Filas guardadas como en la 022 (sin `catalog_id`) se devuelven con `null`."""
    created = post(client, headers, [GALLO]).get_json()
    with app.app_context():
        meal = db.session.get(Meal, created["id"])
        meal.items.append(
            MealItem(
                position=1, source="usda", fdc_id=171477, name=CHICKEN_NAME,
                data_type="sr_legacy", grams=150,
                per_100g_calories_kcal=165.0, per_100g_protein_g=31.0,
                per_100g_carbs_g=0.0, per_100g_fat_g=3.57,
                calories_kcal=247.5, protein_g=46.5, carbs_g=0.0, fat_g=5.36,
            )
        )
        db.session.commit()

    items = diary(client, headers)["meals"][0]["items"]

    assert [i["source"] for i in items] == ["custom", "usda"]
    assert [i["catalog_id"] for i in items] == [None, None]


# SDD: 023 REQ-008 AC-008.2
def test_patch_and_delete_of_a_usda_item_work_as_in_spec_022(client, headers, chicken):
    """Cambiar los gramos de un alimento de USDA recalcula (330 kcal) y quitarlo
    responde 204."""
    meal_id, item_id = make_chicken_meal(client, headers)

    patched = patch(client, headers, meal_id, item_id, {"grams": 200})
    removed = delete_item(client, headers, meal_id, item_id)

    assert patched.status_code == 200
    assert patched.get_json()["items"][0]["nutrients"]["calories_kcal"] == 330.0
    assert patched.get_json()["items"][0]["catalog_id"] is None
    assert removed.status_code == 204


# SDD: 023 REQ-008 AC-008.2
def test_delete_of_a_catalog_item_and_its_meal_work(client, headers, catalog):
    """Quitar el único alimento del catálogo borra la comida (204)."""
    meal_id, item_id = (lambda m: (m["id"], m["items"][0]["id"]))(
        post(client, headers, [catalog_item()]).get_json()
    )

    removed = delete_item(client, headers, meal_id, item_id)

    assert removed.status_code == 204
    assert diary(client, headers)["meals"] == []


# --------------------------------------------------------------------------
# Spec 026: fechas, deshacer y aislamiento
# --------------------------------------------------------------------------

RESTORE_URL = f"{URL}/restore"
TOO_MANY_MESSAGE = {"error": "Una comida no puede tener más de 50 alimentos."}


def delete_with_undo(client, headers, meal_id, item_id):
    return client.delete(f"{URL}/{meal_id}/items/{item_id}?undo=1", headers=headers)


def restore(client, headers, token):
    return client.post(RESTORE_URL, json={"restore_token": token}, headers=headers)


def three_item_breakfast(client, headers):
    """Desayuno de hoy con tres alimentos personalizados: Avena, Plátano y Leche."""
    names = ["Avena", "Plátano", "Leche"]
    meal = post(
        client, headers, [{**GALLO, "name": name} for name in names], meal_type="breakfast"
    ).get_json()
    return meal


# Guarda de regresión de la 022: pasa sin implementar la 026.
# SDD: 026 REQ-001 AC-001.3
@pytest.mark.parametrize("date", [None, "20-10-2026", "2026-02-30"])
def test_post_still_rejects_a_missing_or_invalid_date_with_the_date_message(
    client, app, headers, date
):
    """Con la ventana nueva, una fecha ausente o imposible sigue dando «La fecha no es válida.»."""
    body = {"meal_type": "lunch", "items": [GALLO]}
    if date is not None:
        body["date"] = date

    response = client.post(URL, json=body, headers=headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": "La fecha no es válida."}
    assert counts(app) == (0, 0)


# SDD: 026 REQ-007 AC-007.2
# SDD: 026 REQ-007 AC-007.3
def test_delete_with_undo_returns_200_and_a_restore_token(client, headers):
    """`?undo=1`: 200 con `restore_token` y el alimento ya no está en el diario."""
    meal = three_item_breakfast(client, headers)

    response = delete_with_undo(client, headers, meal["id"], meal["items"][1]["id"])

    assert response.status_code == 200
    body = response.get_json()
    assert set(body) == {"restore_token"}
    assert isinstance(body["restore_token"], str) and body["restore_token"] != ""
    names = [i["name"] for i in diary(client, headers)["meals"][0]["items"]]
    assert names == ["Avena", "Leche"]


# Guarda de regresión de la 022: pasa sin implementar la 026.
# SDD: 026 REQ-007 AC-007.2
def test_delete_without_undo_still_returns_204_with_no_body(client, headers):
    """Sin `undo=1` (o con otro valor), 204 sin cuerpo, como en la 022."""
    meal = three_item_breakfast(client, headers)

    plain = delete_item(client, headers, meal["id"], meal["items"][0]["id"])
    other_value = client.delete(
        f"{URL}/{meal['id']}/items/{meal['items'][1]['id']}?undo=0", headers=headers
    )

    assert plain.status_code == 204 and plain.data == b""
    assert other_value.status_code == 204 and other_value.data == b""


# SDD: 026 REQ-007 AC-007.3
def test_restore_puts_the_item_back_in_the_existing_meal_and_position(client, headers):
    """200 en la comida que existe, con el plátano entre la avena y la leche."""
    meal = three_item_breakfast(client, headers)
    original = meal["items"][1]
    token = delete_with_undo(client, headers, meal["id"], original["id"]).get_json()[
        "restore_token"
    ]

    response = restore(client, headers, token)

    assert response.status_code == 200
    body = response.get_json()
    assert body["id"] == meal["id"]
    assert [i["name"] for i in body["items"]] == ["Avena", "Plátano", "Leche"]
    restored = body["items"][1]
    assert restored["grams"] == original["grams"]
    assert restored["per_100g"] == original["per_100g"]
    assert restored["nutrients"] == original["nutrients"]
    assert restored["source"] == original["source"]
    names = [i["name"] for i in diary(client, headers)["meals"][0]["items"]]
    assert names == ["Avena", "Plátano", "Leche"]
    assert body["totals"] == meal["totals"]


# SDD: 026 REQ-007 AC-007.3
def test_restore_response_has_the_shape_of_post_meals(client, headers):
    """La respuesta es la comida serializada como en `POST /api/meals`."""
    meal = three_item_breakfast(client, headers)
    token = delete_with_undo(client, headers, meal["id"], meal["items"][2]["id"]).get_json()[
        "restore_token"
    ]

    body = restore(client, headers, token).get_json()

    assert set(body) == {"id", "date", "meal_type", "items", "totals", "incomplete"}
    assert body["date"] == TODAY
    assert body["meal_type"] == "breakfast"


# SDD: 026 REQ-007 AC-007.5
def test_restore_recreates_the_meal_with_201_after_removing_its_only_item(client, headers):
    """Quitar el único alimento borra la comida; restaurar responde 201 y la recrea."""
    meal = post(client, headers, [GALLO], meal_type="dinner").get_json()
    token = delete_with_undo(client, headers, meal["id"], meal["items"][0]["id"]).get_json()[
        "restore_token"
    ]
    assert diary(client, headers)["meals"] == []

    response = restore(client, headers, token)

    assert response.status_code == 201
    body = response.get_json()
    assert body["meal_type"] == "dinner" and body["date"] == TODAY
    assert [i["name"] for i in body["items"]] == ["Gallo pinto"]
    assert len(diary(client, headers)["meals"]) == 1


# SDD: 026 REQ-007 AC-007.5
def test_restore_works_on_a_past_day(client, headers):
    """El alimento de un día pasado vuelve a ese día, no a hoy."""
    meal = post(client, headers, [GALLO], date="2026-10-10").get_json()
    token = delete_with_undo(client, headers, meal["id"], meal["items"][0]["id"]).get_json()[
        "restore_token"
    ]

    response = restore(client, headers, token)

    assert response.status_code == 201
    assert response.get_json()["date"] == "2026-10-10"
    assert diary(client, headers)["meals"] == []


# SDD: 026 REQ-007 AC-007.10
def test_restore_into_a_meal_that_reached_50_items_is_a_400_and_changes_nothing(
    client, app, headers
):
    """Quitar uno de 50, añadir otro y restaurar: 400 con el mensaje del tope."""
    custom = {**GALLO, "name": "Alimento"}
    meal = post(client, headers, [custom] * 50).get_json()
    token = delete_with_undo(client, headers, meal["id"], meal["items"][0]["id"]).get_json()[
        "restore_token"
    ]
    assert post(client, headers, [custom]).status_code == 200
    before = counts(app)

    response = restore(client, headers, token)

    assert response.status_code == 400
    assert response.get_json() == TOO_MANY_MESSAGE
    assert counts(app) == before


# SDD: 026 REQ-007 AC-007.3
@pytest.mark.parametrize(
    "body",
    [{}, {"restore_token": None}, {"restore_token": 5}, {"restore_token": "sin-punto"},
     {"restore_token": "a.b"}],
)
def test_restore_with_a_missing_or_invalid_token_is_a_404(client, app, headers, body):
    """Sin token, que no es texto o que no es de este servidor: 404."""
    three_item_breakfast(client, headers)
    before = counts(app)

    response = client.post(RESTORE_URL, json=body, headers=headers)

    assert response.status_code == 404
    assert response.get_json() == ITEM_NOT_FOUND
    assert counts(app) == before


# SDD: 026 REQ-007 AC-007.3
@pytest.mark.parametrize(
    "kwargs",
    [
        {"data": "texto", "content_type": "text/plain"},
        {"data": "null", "content_type": "application/json"},
        {"data": "[1, 2]", "content_type": "application/json"},
    ],
)
def test_restore_rejects_a_body_that_is_not_a_json_object(client, headers, kwargs):
    """Texto, `null` o lista: 400 «La petición no es válida»."""
    response = client.post(RESTORE_URL, headers=headers, **kwargs)

    assert response.status_code == 400
    assert response.get_json() == INVALID_REQUEST


# Guarda de regresión de la 022: pasa sin implementar la 026.
# SDD: 026 NFR-002 AC-N002.1
def test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact(client, headers):
    """A pide borrar la comida de B: 404 «No encontramos esa comida.» y B conserva todo."""
    other = register(client, "beto@example.com")
    theirs = post(client, other, [GALLO, {**GALLO, "name": "Arroz"}]).get_json()

    response = delete_meal(client, headers, theirs["id"])

    assert response.status_code == 404
    assert response.get_json() == MEAL_NOT_FOUND
    items = diary(client, other)["meals"][0]["items"]
    assert [i["name"] for i in items] == ["Gallo pinto", "Arroz"]


# SDD: 026 NFR-002 AC-N002.2
def test_restoring_with_the_token_of_another_user_is_a_404_and_changes_nothing(
    client, app, headers
):
    """El token que obtuvo B no sirve para A: 404 y las comidas de B no cambian."""
    other = register(client, "beto@example.com")
    theirs = three_item_breakfast(client, other)
    token = delete_with_undo(client, other, theirs["id"], theirs["items"][1]["id"]).get_json()[
        "restore_token"
    ]
    before = counts(app)
    their_diary = diary(client, other)

    response = restore(client, headers, token)

    assert response.status_code == 404
    assert response.get_json() == ITEM_NOT_FOUND
    assert counts(app) == before
    assert diary(client, other) == their_diary
    assert diary(client, headers)["meals"] == []


# SDD: 026 NFR-002 AC-N002.3
def test_without_a_session_nothing_is_added_deleted_or_restored(client, app, headers):
    """Sin sesión, `POST /api/meals`, `DELETE /api/meals/{id}`, `DELETE …/items/{id}`
    y `POST /api/meals/restore` dan 401 y no cambian nada."""
    meal = three_item_breakfast(client, headers)
    token = delete_with_undo(client, headers, meal["id"], meal["items"][1]["id"]).get_json()[
        "restore_token"
    ]
    before = counts(app)

    responses = [
        client.post(URL, json={"date": TODAY, "meal_type": "lunch", "items": [GALLO]}),
        client.delete(f"{URL}/{meal['id']}"),
        client.delete(f"{URL}/{meal['id']}/items/{meal['items'][0]['id']}"),
        client.delete(f"{URL}/{meal['id']}/items/{meal['items'][0]['id']}?undo=1"),
        client.post(RESTORE_URL, json={"restore_token": token}),
    ]

    assert [r.status_code for r in responses] == [401] * 5
    assert counts(app) == before
