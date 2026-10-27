"""Integración de `/api/meals` con la biblioteca de alimentos propios (spec 028):
cliente HTTP real contra la app, los servicios y los repositorios reales y el
Postgres de prueba. El reloj del servidor se fija con `app_clock` en 2026-10-21
03:00 (UTC); los usuarios se registran por `/api/auth/register`.
"""

import threading
import time
from datetime import datetime

import pytest
from sqlalchemy import select, text

from extensions import db
from models import CatalogFood, CustomFood, Food, User
from models.meal import Meal, MealItem
from services.catalog_rules import fold

URL = "/api/meals"
RESTORE_URL = "/api/meals/restore"
LIBRARY_URL = "/api/food-library"
NOW = datetime(2026, 10, 21, 3, 0)
TODAY = "2026-10-21"
YESTERDAY = "2026-10-20"
PASSWORD = "ClaveSegura123"

NOT_FOUND = {"error": "No encontramos ese alimento."}
ITEM_SOURCE = {"error": "Cada alimento debe ser del catálogo, de USDA o personalizado."}
GRAMS_RANGE = {"error": "Los gramos deben estar entre 1 y 2000."}
CUSTOM_LIMIT = {"error": "Ya tienes 500 alimentos propios. Borra alguno para crear otro."}

GALLO_VALUES = {"calories_kcal": 180.0, "protein_g": 6.0, "carbs_g": 30.0, "fat_g": 4.0}


@pytest.fixture(autouse=True)
def fixed_clock(app_clock):
    app_clock.set(NOW)
    return app_clock


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


def post(client, headers, items, date=TODAY, meal_type="lunch"):
    return client.post(
        URL, json={"date": date, "meal_type": meal_type, "items": items}, headers=headers
    )


def diary(client, headers, date=TODAY):
    response = client.get(URL, query_string={"date": date}, headers=headers)
    assert response.status_code == 200
    return response.get_json()


def items_of(client, headers, date=TODAY):
    return [item for meal in diary(client, headers, date)["meals"] for item in meal["items"]]


def name_key(name):
    return " ".join(fold(name).split())


def library(app, email="ana@example.com"):
    """Alimentos propios del usuario como (id, name, calorías, proteína, carbs, grasa)."""
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        rows = db.session.execute(
            select(
                CustomFood.id, CustomFood.name, CustomFood.calories_kcal, CustomFood.protein_g,
                CustomFood.carbs_g, CustomFood.fat_g,
            )
            .where(CustomFood.user_id == user_id)
            .order_by(CustomFood.id)
        ).all()
        return [tuple(row) for row in rows]


def seed_custom(app, email, name, calories=180.0, protein=6.0, carbs=30.0, fat=4.0):
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        food = CustomFood(
            user_id=user_id,
            name=name,
            name_key=name_key(name),
            calories_kcal=calories,
            protein_g=protein,
            carbs_g=carbs,
            fat_g=fat,
        )
        db.session.add(food)
        db.session.commit()
        return food.id


def seed_many_customs(app, email, count):
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == email))
        db.session.add_all(
            [
                CustomFood(
                    user_id=user_id, name=f"Alimento {n}", name_key=name_key(f"Alimento {n}"),
                    calories_kcal=100.0, protein_g=1.0, carbs_g=1.0, fat_g=1.0,
                )
                for n in range(count)
            ]
        )
        db.session.commit()


def counts(app):
    with app.app_context():
        return (
            db.session.query(Meal).count(),
            db.session.query(MealItem).count(),
            db.session.query(CustomFood).count(),
        )


# --------------------------------------------------------------------------
# REQ-001: guardar en la biblioteca los personalizados que se registran
# --------------------------------------------------------------------------


# SDD: 028 REQ-001 AC-001.1
def test_post_of_a_new_custom_item_saves_it_in_the_library_and_returns_its_id(client, app, headers):
    """201; el alimento tiene `source: custom` y un `custom_food_id` entero; la
    biblioteca tiene «Gallo pinto» con esos cuatro valores y ese identificador."""
    response = post(client, headers, [custom_item()])

    assert response.status_code == 201
    item = response.get_json()["items"][0]
    assert item["source"] == "custom"
    assert isinstance(item["custom_food_id"], int)
    assert library(app) == [(item["custom_food_id"], "Gallo pinto", 180.0, 6.0, 30.0, 4.0)]


# SDD: 028 REQ-001 AC-001.2
def test_post_of_the_same_name_updates_the_own_food_and_keeps_its_id(client, app, headers):
    """«  gallo PINTO » con otros valores: sigue un solo alimento propio, con el
    mismo id, el nombre «gallo PINTO» y 170, 7, 28 y 3."""
    first = post(client, headers, [custom_item()]).get_json()["items"][0]["custom_food_id"]

    response = post(
        client,
        headers,
        [custom_item("  gallo PINTO ", 150, 170, 7, 28, 3)],
        date=YESTERDAY,
    )

    assert response.status_code == 201
    assert response.get_json()["items"][0]["custom_food_id"] == first
    assert library(app) == [(first, "gallo PINTO", 170.0, 7.0, 28.0, 3.0)]


# SDD: 028 REQ-001 AC-001.3
def test_the_item_registered_before_keeps_its_name_values_and_nutrients(client, app, headers):
    """Tras actualizar el alimento propio, el del primer día conserva «Gallo pinto»,
    sus valores por 100 g y sus nutrientes."""
    post(client, headers, [custom_item(grams=200)])
    post(client, headers, [custom_item("gallo pinto", 150, 170, 7, 28, 3)], date=YESTERDAY)

    (item,) = items_of(client, headers, TODAY)

    assert item["name"] == "Gallo pinto"
    assert item["per_100g"] == GALLO_VALUES
    assert item["nutrients"] == {
        "calories_kcal": 360.0, "protein_g": 12.0, "carbs_g": 60.0, "fat_g": 8.0,
    }
    # Y ambos dias enlazan con el mismo alimento propio (028).
    (later,) = items_of(client, headers, YESTERDAY)
    assert item["custom_food_id"] is not None
    assert later["custom_food_id"] == item["custom_food_id"]


# SDD: 028 REQ-001 AC-001.4
def test_post_of_a_name_without_accents_updates_the_one_with_accents(client, app, headers):
    """«Pina colada» actualiza «Piña colada»: un solo alimento propio."""
    first = post(client, headers, [custom_item("Piña colada")]).get_json()["items"][0]
    second = post(client, headers, [custom_item("Pina colada")], date=YESTERDAY).get_json()[
        "items"
    ][0]

    assert second["custom_food_id"] == first["custom_food_id"]
    assert [row[1] for row in library(app)] == ["Pina colada"]


# SDD: 028 REQ-001 AC-001.5
def test_two_users_get_their_own_food_with_the_same_name(client, app, headers, other_headers):
    """Ana y Luis registran «Gallo pinto»: cada uno tiene el suyo, con otro id y sus valores."""
    ana = post(client, headers, [custom_item(calories=180)]).get_json()["items"][0]
    luis = post(client, other_headers, [custom_item(calories=111)]).get_json()["items"][0]

    assert ana["custom_food_id"] != luis["custom_food_id"]
    assert library(app, "ana@example.com")[0][2] == 180.0
    assert library(app, "luis@example.com")[0][2] == 111.0


# SDD: 028 REQ-001 AC-001.6
def test_two_custom_items_with_the_same_name_in_a_request_leave_one_own_food(client, app, headers):
    """La biblioteca guarda los valores del último; los dos alimentos de la comida
    llevan el mismo `custom_food_id`."""
    response = post(
        client,
        headers,
        [custom_item(grams=100, calories=100), custom_item(grams=50, calories=222)],
    )

    items = response.get_json()["items"]
    assert len(library(app)) == 1
    (saved,) = library(app)
    assert saved[2] == 222.0
    assert [item["custom_food_id"] for item in items] == [saved[0], saved[0]]
    assert [item["per_100g"]["calories_kcal"] for item in items] == [100.0, 222.0]


# SDD: 028 REQ-001 AC-001.7
def test_post_with_an_invalid_custom_item_is_400_and_the_library_does_not_change(
    client, app, headers
):
    """Macros que suman más de 100 g: 400 de la 022 y no se guarda nada."""
    seed_custom(app, "ana@example.com", "Existente", calories=50)
    before = counts(app)

    response = post(
        client,
        headers,
        [custom_item("Nuevo"), custom_item("Existente", calories=900, protein=60, carbs=50, fat=10)],
    )

    assert response.status_code == 400
    assert "no pueden sumar más de 100 g" in response.get_json()["error"]
    assert counts(app) == before
    assert library(app)[0][2] == 50.0
    # Contraste: una peticion valida con el mismo nombre nuevo si guarda (028).
    assert post(client, headers, [custom_item("Nuevo")]).status_code == 201
    assert [row[1] for row in library(app)] == ["Existente", "Nuevo"]


# SDD: 028 REQ-001 AC-001.9
def test_diary_items_from_the_catalog_and_usda_have_a_null_custom_food_id(client, app, headers):
    """Un alimento del catálogo y otro de USDA llevan `custom_food_id: null`."""
    with app.app_context():
        db.session.add(CatalogFood(
            id="banano", name="Banano", synonyms=[], calories_kcal=89.0, protein_g=1.09,
            carbs_g=22.84, fat_g=0.33, source="manual", fdc_id=None, reference="Tabla de prueba",
        ))
        db.session.add(Food(
            fdc_id=171477, description="Chicken", data_type="sr_legacy", calories_kcal=165.0,
            protein_g=31.0, carbs_g=0.0, fat_g=3.57, embedding=None,
        ))
        db.session.commit()

    created = post(
        client, headers, [{"catalog_id": "banano", "grams": 100}, {"fdc_id": 171477, "grams": 100}]
    )

    assert created.status_code == 201
    assert [i["custom_food_id"] for i in created.get_json()["items"]] == [None, None]
    assert [i["custom_food_id"] for i in items_of(client, headers)] == [None, None]
    assert library(app) == []


# SDD: 028 REQ-001 AC-001.10
def test_post_of_a_name_with_repeated_spaces_updates_the_same_own_food(client, app, headers):
    """«Gallo    pinto» actualiza «Gallo pinto» y devuelve su id."""
    first = post(client, headers, [custom_item("Gallo pinto")]).get_json()["items"][0]
    second = post(client, headers, [custom_item("Gallo    pinto")], date=YESTERDAY).get_json()[
        "items"
    ][0]

    assert second["custom_food_id"] == first["custom_food_id"]
    assert len(library(app)) == 1


# SDD: 028 REQ-001 AC-001.9
def test_get_and_patch_carry_the_custom_food_id_of_the_item(client, app, headers):
    """El diario y el `PATCH` devuelven el `custom_food_id` del alimento propio vinculado."""
    meal = post(client, headers, [custom_item()]).get_json()
    own_id = meal["items"][0]["custom_food_id"]

    patched = client.patch(
        f"{URL}/{meal['id']}/items/{meal['items'][0]['id']}", json={"grams": 100}, headers=headers
    )

    assert patched.status_code == 200
    assert patched.get_json()["items"][0]["custom_food_id"] == own_id
    assert items_of(client, headers)[0]["custom_food_id"] == own_id


# SDD: 028 REQ-001 AC-001.9
def test_items_saved_before_the_spec_have_a_null_custom_food_id(client, app, headers):
    """Un personalizado insertado sin vínculo (anterior a la 028) devuelve `null`."""
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == "ana@example.com"))
        meal = Meal(user_id=user_id, meal_date=datetime(2026, 10, 21).date(), meal_type="lunch")
        meal.items.append(MealItem(
            position=0, source="custom", name="Viejo", grams=100, per_100g_calories_kcal=100.0,
            per_100g_protein_g=1.0, per_100g_carbs_g=1.0, per_100g_fat_g=1.0,
            calories_kcal=100, protein_g=1, carbs_g=1, fat_g=1,
        ))
        db.session.add(meal)
        db.session.commit()

    assert items_of(client, headers)[0]["custom_food_id"] is None


# --------------------------------------------------------------------------
# REQ-001 AC-001.8: dos peticiones simultáneas
# --------------------------------------------------------------------------


def wait_until(condition, timeout=10.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.05)
    return condition()


def count_lock_waiters(monitor):
    return monitor.execute(
        text(
            "SELECT count(*) FROM pg_stat_activity "
            "WHERE datname = current_database() AND wait_event_type = 'Lock' "
            "AND pid <> pg_backend_pid()"
        )
    ).scalar()


def concurrent_posts(app, email, token_headers, bodies):
    """Bloquea la fila del usuario desde una conexión propia, lanza un
    `POST /api/meals` por cuerpo en hilos distintos, espera a que todos queden
    en espera del bloqueo, lo libera y devuelve (estado, json) de cada uno."""
    results = {}

    def worker(index, body):
        response = app.test_client().post(URL, json=body, headers=token_headers)
        results[index] = (response.status_code, response.get_json())

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
                threading.Thread(target=worker, args=(i, body), daemon=True)
                for i, body in enumerate(bodies)
            ]
            for thread in threads:
                thread.start()
            reached = wait_until(lambda: count_lock_waiters(monitor) >= len(bodies))
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
    return [results[i] for i in range(len(bodies))]


# SDD: 028 REQ-001 AC-001.8
def test_two_simultaneous_posts_of_a_new_custom_item_leave_one_own_food(client, app, headers):
    """Dos peticiones del mismo usuario con «Avena con leche» nueva (cada una a
    una comida distinta): las dos responden 201 y la biblioteca tiene un solo
    alimento con ese nombre, enlazado desde los dos registros."""
    bodies = [
        {"date": TODAY, "meal_type": "breakfast", "items": [custom_item("Avena con leche")]},
        {"date": TODAY, "meal_type": "dinner", "items": [custom_item("Avena con leche")]},
    ]

    results = concurrent_posts(app, "ana@example.com", headers, bodies)

    assert [status for status, _ in results] == [201, 201]
    assert len(library(app)) == 1
    (saved,) = library(app)
    assert saved[1] == "Avena con leche"
    assert [body["items"][0]["custom_food_id"] for _, body in results] == [saved[0], saved[0]]


# --------------------------------------------------------------------------
# REQ-002: límite de 500 alimentos propios
# --------------------------------------------------------------------------


# SDD: 028 REQ-002 AC-002.1
def test_post_of_a_new_name_with_500_own_foods_is_400_and_changes_nothing(client, app, headers):
    """Con 500 alimentos propios, un nombre nuevo da el 400 de la spec; ni la comida ni la biblioteca cambian."""
    seed_many_customs(app, "ana@example.com", 500)

    response = post(client, headers, [custom_item("Nombre nuevo")])

    assert response.status_code == 400
    assert response.get_json() == CUSTOM_LIMIT
    assert counts(app) == (0, 0, 500)


# SDD: 028 REQ-002 AC-002.2
def test_post_of_the_name_of_an_existing_own_food_with_500_is_201_and_updates_it(
    client, app, headers
):
    """Con 500 alimentos propios, el nombre de uno de ellos actualiza ese alimento."""
    seed_many_customs(app, "ana@example.com", 500)

    response = post(client, headers, [custom_item("alimento 7", calories=77)])

    assert response.status_code == 201
    assert counts(app)[2] == 500
    with app.app_context():
        updated = db.session.scalar(select(CustomFood).where(CustomFood.name_key == "alimento 7"))
        assert (updated.name, updated.calories_kcal) == ("alimento 7", 77.0)


# SDD: 028 REQ-002 AC-002.3
def test_post_of_two_new_names_with_499_own_foods_is_400_and_saves_nothing(client, app, headers):
    """499 propios y dos nombres nuevos en una petición: 400 y no se guarda nada."""
    seed_many_customs(app, "ana@example.com", 499)

    response = post(client, headers, [custom_item("Nuevo A"), custom_item("Nuevo B")])

    assert response.status_code == 400
    assert response.get_json() == CUSTOM_LIMIT
    assert counts(app) == (0, 0, 499)


# SDD: 028 REQ-002 AC-002.3
def test_post_of_one_new_name_with_499_own_foods_is_201(client, app, headers):
    """499 propios y un nombre nuevo: se llega a 500."""
    seed_many_customs(app, "ana@example.com", 499)

    assert post(client, headers, [custom_item("Nuevo A")]).status_code == 201
    assert counts(app)[2] == 500


# --------------------------------------------------------------------------
# REQ-003: añadir un alimento propio por identificador
# --------------------------------------------------------------------------


# SDD: 028 REQ-003 AC-003.1
def test_post_by_custom_food_id_adds_the_own_food_with_copied_values(client, app, headers):
    """250 g de «Gallo pinto» (180/6/30/4): 201, `source` custom, su nombre y
    su id, sin catálogo ni FDC y nutrientes 450 / 15 / 75 / 10."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = post(client, headers, [{"custom_food_id": own_id, "grams": 250}])

    assert response.status_code == 201
    item = response.get_json()["items"][0]
    assert item["source"] == "custom"
    assert item["name"] == "Gallo pinto"
    assert item["custom_food_id"] == own_id
    assert item["catalog_id"] is None and item["fdc_id"] is None
    assert item["per_100g"] == GALLO_VALUES
    assert item["nutrients"] == {
        "calories_kcal": 450.0, "protein_g": 15.0, "carbs_g": 75.0, "fat_g": 10.0,
    }
    assert [row[0] for row in library(app)] == [own_id]


# SDD: 028 REQ-003 AC-003.2
@pytest.mark.parametrize("food_id", [999999, 0, -1, 2_147_483_648, "3", "abc", 1.5])
def test_post_by_an_unknown_or_invalid_custom_food_id_is_400_and_saves_nothing(
    client, app, headers, food_id
):
    """Un id que no existe o no es un entero válido: 400 «No encontramos ese alimento.»."""
    response = post(client, headers, [{"custom_food_id": food_id, "grams": 100}])

    assert response.status_code == 400
    assert response.get_json() == NOT_FOUND
    assert counts(app) == (0, 0, 0)


# SDD: 028 REQ-003 AC-003.2
def test_post_by_the_custom_food_id_of_another_user_is_400_and_saves_nothing(
    client, app, headers, other_headers
):
    """El alimento propio de Luis no se puede añadir desde la cuenta de Ana."""
    luis_food = seed_custom(app, "luis@example.com", "Gallo pinto")

    response = post(client, headers, [{"custom_food_id": luis_food, "grams": 100}])

    assert response.status_code == 400
    assert response.get_json() == NOT_FOUND
    assert counts(app) == (0, 0, 1)


# SDD: 028 REQ-003 AC-003.3
@pytest.mark.parametrize(
    "extra", [{"name": "Gallo pinto"}, {"catalog_id": "banano"}, {"fdc_id": 171477}]
)
def test_post_with_a_custom_food_id_and_another_source_is_400(client, app, headers, extra):
    """`custom_food_id` junto con `name`, `catalog_id` o `fdc_id`: el 400 de origen."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = post(client, headers, [{"custom_food_id": own_id, "grams": 100, **extra}])

    assert response.status_code == 400
    assert response.get_json() == ITEM_SOURCE
    assert counts(app) == (0, 0, 1)


# SDD: 028 REQ-003 AC-003.4
def test_a_registered_own_food_keeps_its_values_when_the_library_is_updated_later(
    client, app, headers
):
    """Tras actualizar el alimento propio, el registrado conserva sus valores
    copiados y al cambiar sus gramos se recalcula con ellos."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")
    meal = post(client, headers, [{"custom_food_id": own_id, "grams": 250}]).get_json()
    post(client, headers, [custom_item("Gallo pinto", calories=500, protein=1, carbs=1, fat=1)],
         meal_type="dinner")

    patched = client.patch(
        f"{URL}/{meal['id']}/items/{meal['items'][0]['id']}", json={"grams": 100}, headers=headers
    )

    assert patched.status_code == 200
    item = patched.get_json()["items"][0]
    assert item["per_100g"] == GALLO_VALUES
    assert item["nutrients"]["calories_kcal"] == 180.0
    assert library(app)[0][2] == 500.0


# SDD: 028 REQ-003 AC-003.5
@pytest.mark.parametrize("grams", [0, 2001, "100", None])
def test_post_by_custom_food_id_with_invalid_grams_gives_the_grams_message(
    client, app, headers, grams
):
    """Gramos no válidos: el mismo 400 de gramos de la 022."""
    own_id = seed_custom(app, "ana@example.com", "Gallo pinto")

    response = post(client, headers, [{"custom_food_id": own_id, "grams": grams}])

    assert response.status_code == 400
    assert response.get_json() == GRAMS_RANGE


# SDD: 028 REQ-003 AC-003.1
def test_post_keeps_the_order_of_a_mix_of_own_new_custom_catalog_and_usda_items(
    client, app, headers
):
    """Alimento propio por id, personalizado nuevo, catálogo y USDA en una petición."""
    own_id = seed_custom(app, "ana@example.com", "Avena casera")
    with app.app_context():
        db.session.add(CatalogFood(
            id="banano", name="Banano", synonyms=[], calories_kcal=89.0, protein_g=1.09,
            carbs_g=22.84, fat_g=0.33, source="manual", fdc_id=None, reference="Tabla de prueba",
        ))
        db.session.add(Food(
            fdc_id=171477, description="Chicken", data_type="sr_legacy", calories_kcal=165.0,
            protein_g=31.0, carbs_g=0.0, fat_g=3.57, embedding=None,
        ))
        db.session.commit()

    response = post(
        client,
        headers,
        [
            {"custom_food_id": own_id, "grams": 100},
            custom_item("Nuevo"),
            {"catalog_id": "banano", "grams": 100},
            {"fdc_id": 171477, "grams": 100},
        ],
    )

    assert response.status_code == 201
    items = response.get_json()["items"]
    assert [i["name"] for i in items] == ["Avena casera", "Nuevo", "Banano", "Chicken"]
    assert [i["source"] for i in items] == ["custom", "custom", "catalog", "usda"]
    assert items[0]["custom_food_id"] == own_id
    assert isinstance(items[1]["custom_food_id"], int)
    assert items[2]["custom_food_id"] is None and items[3]["custom_food_id"] is None


# --------------------------------------------------------------------------
# REQ-012: deshacer al quitar un alimento propio
# --------------------------------------------------------------------------


def remove_with_undo(client, headers, meal, item_index=0):
    response = client.delete(
        f"{URL}/{meal['id']}/items/{meal['items'][item_index]['id']}?undo=1", headers=headers
    )
    assert response.status_code == 200
    return response.get_json()["restore_token"]


def restore(client, headers, token):
    return client.post(RESTORE_URL, json={"restore_token": token}, headers=headers)


# SDD: 028 REQ-012 AC-012.1
def test_restore_of_an_own_food_keeps_its_id_and_counts_again_in_the_recents(client, app, headers):
    """Quitar con `undo=1` y restaurar: el alimento vuelve con el mismo
    `custom_food_id` y vuelve a aparecer en los recientes."""
    meal = post(client, headers, [custom_item("Gallo pinto"), custom_item("Avena casera")]).get_json()
    own_id = meal["items"][0]["custom_food_id"]
    token = remove_with_undo(client, headers, meal, 0)

    response = restore(client, headers, token)

    assert response.status_code == 200
    restored = response.get_json()["items"][0]
    assert restored["custom_food_id"] == own_id
    assert restored["name"] == "Gallo pinto"
    recents = client.get(f"{LIBRARY_URL}/recent", headers=headers).get_json()["results"]
    assert recents[0]["name"] == "Gallo pinto"


# SDD: 028 REQ-012 AC-012.2
def test_restore_after_deleting_the_own_food_comes_back_unlinked_with_its_values(
    client, app, headers
):
    """Si el alimento propio se borró antes de restaurar, vuelve con su nombre,
    valores y nutrientes y `custom_food_id: null`."""
    meal = post(
        client, headers, [custom_item("Gallo pinto", grams=250), custom_item("Avena casera")]
    ).get_json()
    own_id = meal["items"][0]["custom_food_id"]
    token = remove_with_undo(client, headers, meal, 0)
    deleted = client.delete(f"{LIBRARY_URL}/custom/{own_id}", headers=headers)
    assert deleted.status_code == 204

    response = restore(client, headers, token)

    assert response.status_code == 200
    restored = response.get_json()["items"][0]
    assert restored["custom_food_id"] is None
    assert restored["name"] == "Gallo pinto"
    assert restored["per_100g"] == GALLO_VALUES
    assert restored["nutrients"]["calories_kcal"] == 450.0


# SDD: 028 REQ-012 AC-012.1
def test_restore_of_the_only_own_food_of_a_meal_recreates_the_meal_with_its_link(
    client, app, headers
):
    """Quitar el único alimento borra la comida; restaurar responde 201 con el mismo vínculo."""
    meal = post(client, headers, [custom_item("Gallo pinto")]).get_json()
    own_id = meal["items"][0]["custom_food_id"]
    token = remove_with_undo(client, headers, meal, 0)

    response = restore(client, headers, token)

    assert response.status_code == 201
    assert response.get_json()["items"][0]["custom_food_id"] == own_id


# SDD: 028 REQ-012 AC-012.1
def test_restore_of_an_unlinked_custom_item_stays_unlinked(client, app, headers):
    """Un personalizado anterior a la 028 (sin vínculo) vuelve sin vínculo."""
    with app.app_context():
        user_id = db.session.scalar(select(User.id).where(User.email == "ana@example.com"))
        meal = Meal(user_id=user_id, meal_date=datetime(2026, 10, 21).date(), meal_type="lunch")
        for position, name in enumerate(["Viejo", "Otro"]):
            meal.items.append(MealItem(
                position=position, source="custom", name=name, grams=100,
                per_100g_calories_kcal=100.0, per_100g_protein_g=1.0, per_100g_carbs_g=1.0,
                per_100g_fat_g=1.0, calories_kcal=100, protein_g=1, carbs_g=1, fat_g=1,
            ))
        db.session.add(meal)
        db.session.commit()
    current = diary(client, headers)["meals"][0]
    token = remove_with_undo(client, headers, current, 0)

    response = restore(client, headers, token)

    assert response.status_code == 200
    assert response.get_json()["items"][0]["custom_food_id"] is None
    assert library(app) == []
