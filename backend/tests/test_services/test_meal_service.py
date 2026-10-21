"""Tests UNITARIOS de `MealService` (spec 022): no tocan Postgres. El servicio
recibe por constructor un `FakeMealRepository`, un `FakeFoodRepository`, un
`FakeLockingUserRepository`, un `FakeUnitOfWork` y un `FakeClock` fijo en
2026-10-21 03:00 (UTC), así que la ventana de fechas es determinista. Los
mensajes se comparan con el texto literal de la sección 6 de la spec.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models.meal import Meal, MealItem
from services.meal_service import MealService
from tests.fakes import (
    FakeCatalogFoodRepository,
    FakeClock,
    FakeFoodRepository,
    FakeLockingUserRepository,
    FakeMealRepository,
    FakeUnitOfWork,
    make_catalog_food,
    make_food,
)

NOW = datetime(2026, 10, 21, 3, 0)
TODAY = "2026-10-21"
USER = "user-1"
OTHER = "user-2"

INVALID_REQUEST = "La petición no es válida"
DATE_INVALID = "La fecha no es válida."
OUT_OF_WINDOW = "Solo puedes registrar comidas de hoy."
FOOD_NOT_FOUND = "No encontramos ese alimento."
TOO_MANY = "Una comida no puede tener más de 50 alimentos."
GRAMS_RANGE = "Los gramos deben estar entre 1 y 2000."
MEAL_NOT_FOUND = "No encontramos esa comida."
ITEM_NOT_FOUND = "No encontramos ese alimento en la comida."

CHICKEN = make_food(
    171477,
    "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    "sr_legacy",
    calories_kcal=165.0,
    protein_g=31.0,
    carbs_g=0.0,
    fat_g=3.57,
)
RICE = make_food(
    168878,
    "Rice, white, long-grain",
    "foundation",
    calories_kcal=130.0,
    protein_g=2.7,
    carbs_g=28.2,
)
GALLO_PINTO = {
    "name": "Gallo pinto",
    "grams": 250,
    "per_100g": {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2},
}


def make_item(item_id, position=0, meal_id=None, grams="150", **overrides):
    """Alimento de USDA precargado (el pollo de la spec con los gramos dados)."""
    fields = dict(
        id=item_id,
        meal_id=meal_id,
        position=position,
        source="usda",
        fdc_id=171477,
        name=CHICKEN.description,
        data_type="sr_legacy",
        grams=Decimal(grams),
        per_100g_calories_kcal=165.0,
        per_100g_protein_g=31.0,
        per_100g_carbs_g=0.0,
        per_100g_fat_g=3.57,
        calories_kcal=Decimal("247.50"),
        protein_g=Decimal("46.50"),
        carbs_g=Decimal("0.00"),
        fat_g=Decimal("5.36"),
    )
    fields.update(overrides)
    return MealItem(**fields)


def make_meal(meal_id=1, user_id=USER, meal_date=date(2026, 10, 21), meal_type="lunch", items=()):
    meal = Meal(id=meal_id, user_id=user_id, meal_date=meal_date, meal_type=meal_type)
    for item in items:
        meal.items.append(item)
    return meal


class Env:
    """El servicio con todos sus dobles a la vista."""

    def __init__(self, meals=None, foods=None, known_ids=None):
        self.meals = FakeMealRepository(meals)
        self.foods = FakeFoodRepository(foods if foods is not None else [CHICKEN, RICE])
        self.users = FakeLockingUserRepository(known_ids)
        self.uow = FakeUnitOfWork()
        self.service = MealService(self.meals, self.foods, self.users, self.uow, FakeClock(NOW))


def add(env, items, meal_date=TODAY, meal_type="lunch", user_id=USER):
    return env.service.add_items(
        user_id, {"date": meal_date, "meal_type": meal_type, "items": items}
    )


def expect_error(error_type, callable_, *args, **kwargs):
    with pytest.raises(error_type) as exc_info:
        callable_(*args, **kwargs)
    return str(exc_info.value)


# --------------------------------------------------------------------------
# add_items: creación, reutilización y copia de datos
# --------------------------------------------------------------------------


# SDD: 022 REQ-001 AC-001.1
def test_add_items_creates_the_meal_and_computes_the_nutrients():
    """Sin comidas previas crea la del día y tipo (`created=True`) con el pollo
    de 150 g: 247,5 kcal, 46,5 g, 0 g y 5,36 g."""
    env = Env()

    result = add(env, [{"fdc_id": 171477, "grams": 150}])

    assert result.created is True
    meal = result.meal.meal
    assert env.meals.created == [meal]
    assert meal.meal_type == "lunch"
    assert meal.meal_date == date(2026, 10, 21)
    assert str(meal.user_id) == USER
    item = meal.items[0]
    assert (item.source, item.fdc_id, item.grams) == ("usda", 171477, Decimal("150"))
    assert item.calories_kcal == Decimal("247.50")
    assert item.protein_g == Decimal("46.50")
    assert item.carbs_g == Decimal("0.00")
    assert item.fat_g == Decimal("5.36")
    assert env.uow.committed is True


# SDD: 022 REQ-001 AC-001.6
def test_add_items_copies_the_description_data_type_and_values_per_100g():
    """El alimento guarda una copia de la descripción, el conjunto de origen y
    los cuatro valores por 100 g de USDA."""
    env = Env()

    item = add(env, [{"fdc_id": 171477, "grams": 150}]).meal.meal.items[0]

    assert item.name == CHICKEN.description
    assert item.data_type == "sr_legacy"
    assert item.per_100g_calories_kcal == 165.0
    assert item.per_100g_protein_g == 31.0
    assert item.per_100g_carbs_g == 0.0
    assert item.per_100g_fat_g == 3.57


# SDD: 022 REQ-001 AC-001.4
def test_add_items_keeps_none_for_a_nutrient_without_data():
    """Si USDA no tiene dato de carbohidratos, el alimento guarda `None`."""
    without_carbs = make_food(7, "Mystery food", "foundation", calories_kcal=100.0, protein_g=5.0)
    env = Env(foods=[without_carbs])

    item = add(env, [{"fdc_id": 7, "grams": 200}]).meal.meal.items[0]

    assert item.per_100g_carbs_g is None
    assert item.carbs_g is None
    assert item.calories_kcal == Decimal("200.00")
    assert item.protein_g == Decimal("10.00")


# SDD: 022 REQ-002 AC-002.1
def test_add_items_saves_a_custom_item_without_fdc_id():
    """Un alimento personalizado queda con `source=custom`, sin FDC ID ni
    `data_type` y con el nombre sin espacios en los extremos."""
    env = Env()

    item = add(env, [{**GALLO_PINTO, "name": "  Gallo pinto  "}]).meal.meal.items[0]

    assert (item.source, item.fdc_id, item.data_type) == ("custom", None, None)
    assert item.name == "Gallo pinto"
    assert item.calories_kcal == Decimal("400.00")
    assert item.protein_g == Decimal("13.75")


# SDD: 022 REQ-002 AC-002.2
def test_add_items_accepts_a_mix_of_usda_and_custom_items():
    """La comida queda con los dos alimentos, cada uno con su origen."""
    env = Env()

    meal = add(env, [{"fdc_id": 171477, "grams": 150}, GALLO_PINTO]).meal.meal

    assert [item.source for item in meal.items] == ["usda", "custom"]


# SDD: 022 REQ-001 AC-001.2
def test_add_items_reuses_the_existing_meal_and_keeps_the_order():
    """Si ya existe la comida de ese día y tipo, añade a ella (`created=False`)
    sin crear otra y deja los alimentos en el orden en que se añadieron."""
    existing = make_meal(meal_id=5, items=[make_item(31, position=0)])
    env = Env(meals=[existing])

    result = add(env, [GALLO_PINTO])

    assert result.created is False
    assert result.meal.meal is existing
    assert env.meals.created == []
    assert [item.name for item in existing.items] == [CHICKEN.description, "Gallo pinto"]
    assert [item.position for item in existing.items] == [0, 1]


# SDD: 022 REQ-001 AC-001.5
def test_add_items_keeps_the_order_of_three_items():
    """Tres alimentos en una petición quedan en el orden de `items`, con
    posiciones consecutivas."""
    env = Env()

    meal = add(
        env,
        [{"fdc_id": 168878, "grams": 100}, GALLO_PINTO, {"fdc_id": 171477, "grams": 50}],
    ).meal.meal

    assert [item.fdc_id for item in meal.items] == [168878, None, 171477]
    assert [item.position for item in meal.items] == [0, 1, 2]


# SDD: 022 REQ-001 AC-001.3
def test_add_items_to_another_meal_type_creates_a_distinct_meal():
    """Con la comida `lunch` de hoy, añadir a `dinner` crea una comida nueva."""
    lunch = make_meal(meal_id=5, meal_type="lunch", items=[make_item(31)])
    env = Env(meals=[lunch])

    result = add(env, [GALLO_PINTO], meal_type="dinner")

    assert result.created is True
    assert result.meal.meal is not lunch
    assert result.meal.meal.meal_type == "dinner"
    assert len(lunch.items) == 1


# SDD: 022 REQ-001 AC-001.1
def test_add_items_returns_the_totals_of_the_meal():
    """El resumen de la comida suma los nutrientes de sus alimentos."""
    env = Env()

    summary = add(env, [{"fdc_id": 171477, "grams": 150}, GALLO_PINTO]).meal

    assert summary.totals["calories_kcal"] == Decimal("647.50")
    assert summary.incomplete == []


# SDD: 022 REQ-009 AC-009.6
def test_add_items_does_not_touch_the_meal_of_another_user():
    """Otro usuario con la misma fecha y tipo recibe una comida nueva."""
    theirs = make_meal(meal_id=5, user_id=OTHER, items=[make_item(31)])
    env = Env(meals=[theirs])

    result = add(env, [GALLO_PINTO])

    assert result.created is True
    assert result.meal.meal is not theirs
    assert len(theirs.items) == 1


# --------------------------------------------------------------------------
# add_items: atomicidad y errores
# --------------------------------------------------------------------------


# SDD: 022 REQ-003 AC-003.6
def test_add_items_rejects_an_unknown_fdc_id_and_rolls_back():
    """Un FDC ID que no está en la base da 400, no confirma y deshace."""
    env = Env()

    message = expect_error(ValidationError, add, env, [{"fdc_id": 999999, "grams": 100}])

    assert message == FOOD_NOT_FOUND
    assert env.uow.committed is False
    assert env.uow.rolled_back is True
    assert env.meals.created == []


# SDD: 022 REQ-003 AC-003.14
def test_add_items_with_one_unknown_food_among_valid_ones_saves_nothing():
    """Dos alimentos válidos y uno inexistente: no se crea la comida."""
    env = Env()

    expect_error(
        ValidationError,
        add,
        env,
        [{"fdc_id": 171477, "grams": 100}, GALLO_PINTO, {"fdc_id": 999999, "grams": 100}],
    )

    assert env.meals.created == []
    assert env.uow.committed is False


# SDD: 022 REQ-003 AC-003.14
def test_add_items_with_an_invalid_item_does_not_modify_an_existing_meal():
    """Con una comida existente, un alimento no válido deja su lista intacta."""
    existing = make_meal(meal_id=5, items=[make_item(31)])
    env = Env(meals=[existing])

    message = expect_error(
        ValidationError,
        add,
        env,
        [{"fdc_id": 171477, "grams": 100}, {"fdc_id": 171477, "grams": 0}],
    )

    assert message == GRAMS_RANGE
    assert len(existing.items) == 1
    assert env.uow.committed is False


# SDD: 022 REQ-003 AC-003.13
def test_add_items_rejects_three_more_items_when_the_meal_has_48():
    """48 + 3 pasa de 50: 400 y la comida sigue con 48."""
    existing = make_meal(meal_id=5, items=[make_item(100 + n, position=n) for n in range(48)])
    env = Env(meals=[existing])

    message = expect_error(ValidationError, add, env, [GALLO_PINTO] * 3)

    assert message == TOO_MANY
    assert len(existing.items) == 48
    assert env.uow.committed is False


# SDD: 022 REQ-003 AC-003.13
def test_add_items_accepts_two_more_items_when_the_meal_has_48():
    """48 + 2 llega a 50: se acepta."""
    existing = make_meal(meal_id=5, items=[make_item(100 + n, position=n) for n in range(48)])
    env = Env(meals=[existing])

    add(env, [GALLO_PINTO] * 2)

    assert len(existing.items) == 50
    assert env.uow.committed is True


# SDD: 022 REQ-003 AC-003.1
@pytest.mark.parametrize("body", [None, "texto", [1, 2], 5])
def test_add_items_rejects_a_body_that_is_not_an_object(body):
    """Un cuerpo que no es un objeto: «La petición no es válida»."""
    env = Env()

    message = expect_error(ValidationError, env.service.add_items, USER, body)

    assert message == INVALID_REQUEST
    assert env.uow.committed is False


# SDD: 022 REQ-004 AC-004.3
@pytest.mark.parametrize("meal_date", [None, "20-10-2026", "2026-02-30"])
def test_add_items_rejects_a_missing_or_invalid_date(meal_date):
    """Sin fecha, con otro formato o inexistente: «La fecha no es válida.»."""
    env = Env()

    message = expect_error(ValidationError, add, env, [GALLO_PINTO], meal_date=meal_date)

    assert message == DATE_INVALID
    assert env.meals.created == []


# --------------------------------------------------------------------------
# add_items: ventana de fechas
# --------------------------------------------------------------------------


# SDD: 022 REQ-004 AC-004.1
@pytest.mark.parametrize("meal_date", ["2026-10-20", "2026-10-21", "2026-10-22"])
def test_add_items_accepts_yesterday_today_and_tomorrow_of_the_server_clock(meal_date):
    """Con el reloj en 2026-10-21 03:00, se guarda en la comida de esa fecha."""
    env = Env()

    meal = add(env, [GALLO_PINTO], meal_date=meal_date).meal.meal

    assert meal.meal_date == date.fromisoformat(meal_date)
    assert env.uow.committed is True


# SDD: 022 REQ-004 AC-004.2
@pytest.mark.parametrize("meal_date", ["2026-10-19", "2026-10-23"])
def test_add_items_rejects_dates_outside_the_window(meal_date):
    """Con el reloj en 2026-10-21, el 19 y el 23 dan «Solo puedes registrar
    comidas de hoy.» y no se guarda nada."""
    env = Env()

    message = expect_error(ValidationError, add, env, [GALLO_PINTO], meal_date=meal_date)

    assert message == OUT_OF_WINDOW
    assert env.meals.created == []
    assert env.uow.committed is False


# --------------------------------------------------------------------------
# Bloqueo de la fila del usuario
# --------------------------------------------------------------------------


# SDD: 022 REQ-001 AC-001.2
def test_add_items_locks_the_user_row():
    """Cada escritura bloquea la fila del usuario (peticiones simultáneas)."""
    env = Env()

    add(env, [GALLO_PINTO])

    assert env.users.for_update_calls == [USER]


# SDD: 022 REQ-009 AC-009.5
def test_add_items_for_an_unknown_user_is_a_not_found_error():
    """Un usuario que no existe da 404 y no se crea nada."""
    env = Env(known_ids=[OTHER])

    expect_error(ResourceNotFoundError, add, env, [GALLO_PINTO])

    assert env.meals.created == []
    assert env.uow.committed is False


# --------------------------------------------------------------------------
# get_diary
# --------------------------------------------------------------------------


# SDD: 022 REQ-005 AC-005.1
def test_get_diary_orders_the_meals_breakfast_lunch_dinner_snack():
    """Las comidas salen en el orden de los tipos aunque se guardaran al revés."""
    meals = [
        make_meal(meal_id=1, meal_type="snack", items=[make_item(1)]),
        make_meal(meal_id=2, meal_type="dinner", items=[make_item(2)]),
        make_meal(meal_id=3, meal_type="breakfast", items=[make_item(3)]),
        make_meal(meal_id=4, meal_type="lunch", items=[make_item(4)]),
    ]
    env = Env(meals=meals)

    diary = env.service.get_diary(USER, TODAY)

    assert [m.meal.meal_type for m in diary.meals] == ["breakfast", "lunch", "dinner", "snack"]
    assert diary.date == date(2026, 10, 21)


# SDD: 022 REQ-005 AC-005.7
def test_get_diary_accepts_dates_outside_the_add_window():
    """Con el reloj en 2026-10-21, se puede leer el 2026-09-01."""
    old = make_meal(meal_id=1, meal_date=date(2026, 9, 1), items=[make_item(1)])
    env = Env(meals=[old])

    diary = env.service.get_diary(USER, "2026-09-01")

    assert [m.meal for m in diary.meals] == [old]


# SDD: 022 REQ-005 AC-005.5
def test_get_diary_only_returns_the_meals_of_the_requested_date():
    """Las comidas de otra fecha no aparecen."""
    today = make_meal(meal_id=1, items=[make_item(1)])
    tomorrow = make_meal(meal_id=2, meal_date=date(2026, 10, 22), items=[make_item(2)])
    env = Env(meals=[today, tomorrow])

    diary = env.service.get_diary(USER, TODAY)

    assert [m.meal for m in diary.meals] == [today]


# SDD: 022 REQ-009 AC-009.2
def test_get_diary_does_not_return_the_meals_of_another_user():
    """El usuario sin comidas recibe el diario vacío."""
    env = Env(meals=[make_meal(meal_id=1, user_id=OTHER, items=[make_item(1)])])

    diary = env.service.get_diary(USER, TODAY)

    assert diary.meals == []


# SDD: 022 REQ-005 AC-005.2
def test_get_diary_of_an_empty_day_has_zero_totals():
    """Sin comidas: totales a 0 e `incomplete` vacío."""
    env = Env()

    diary = env.service.get_diary(USER, TODAY)

    assert diary.meals == []
    assert all(value == 0 for value in diary.totals.values())
    assert diary.incomplete == []


# SDD: 022 REQ-005 AC-005.3
def test_get_diary_sums_the_meal_subtotal_and_the_day_total():
    """Dos alimentos de 247,5 y 400,0 kcal suman 647,5 en la comida y en el día."""
    gallo = make_item(
        2, position=1, source="custom", fdc_id=None, data_type=None, name="Gallo pinto",
        grams=Decimal("250"), calories_kcal=Decimal("400.00"), protein_g=Decimal("13.75"),
        carbs_g=Decimal("67.50"), fat_g=Decimal("8.00"),
    )
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(1), gallo])])

    diary = env.service.get_diary(USER, TODAY)

    assert diary.meals[0].totals["calories_kcal"] == Decimal("647.50")
    assert diary.totals["calories_kcal"] == Decimal("647.50")


# SDD: 022 REQ-005 AC-005.4
def test_get_diary_reports_incomplete_nutrients_in_the_meal_and_the_day():
    """Un alimento sin carbohidratos hace que la comida y el día lo indiquen, y
    el total suma solo los valores conocidos (67,5)."""
    unknown_carbs = make_item(1, carbs_g=None, per_100g_carbs_g=None)
    gallo = make_item(
        2, position=1, source="custom", fdc_id=None, data_type=None, name="Gallo pinto",
        carbs_g=Decimal("67.50"),
    )
    other_meal = make_meal(meal_id=2, meal_type="dinner", items=[make_item(3)])
    env = Env(meals=[make_meal(meal_id=1, items=[unknown_carbs, gallo]), other_meal])

    diary = env.service.get_diary(USER, TODAY)

    lunch, dinner = diary.meals
    assert lunch.incomplete == ["carbs_g"]
    assert dinner.incomplete == []
    assert diary.incomplete == ["carbs_g"]
    assert diary.totals["carbs_g"] == Decimal("67.50")


# SDD: 022 REQ-005 AC-005.6
@pytest.mark.parametrize("value", [None, "no-es-fecha", "2026-02-30"])
def test_get_diary_rejects_a_missing_or_invalid_date(value):
    """Sin fecha o con una fecha no válida: «La fecha no es válida.»."""
    env = Env()

    assert expect_error(ValidationError, env.service.get_diary, USER, value) == DATE_INVALID


# SDD: 022 REQ-005 AC-005.1
def test_get_diary_does_not_write_anything():
    """Leer el diario no confirma ni bloquea."""
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(1)])])

    env.service.get_diary(USER, TODAY)

    assert env.uow.committed is False
    assert env.users.for_update_calls == []


# --------------------------------------------------------------------------
# update_item_grams
# --------------------------------------------------------------------------


# SDD: 022 REQ-006 AC-006.1
def test_update_item_grams_recalculates_the_nutrients():
    """El pollo de 150 g pasa a 200 g: 330, 62, 0 y 7,14."""
    item = make_item(31)
    env = Env(meals=[make_meal(meal_id=1, items=[item])])

    summary = env.service.update_item_grams(USER, 1, 31, {"grams": 200})

    assert item.grams == Decimal("200")
    assert item.calories_kcal == Decimal("330.00")
    assert item.protein_g == Decimal("62.00")
    assert item.carbs_g == Decimal("0.00")
    assert item.fat_g == Decimal("7.14")
    assert summary.meal.id == 1
    assert env.uow.committed is True


# SDD: 022 REQ-008 AC-008.2
def test_update_item_grams_uses_the_stored_values_per_100g_not_the_food_table():
    """Aunque la tabla de alimentos cambie, el recálculo usa la copia guardada."""
    item = make_item(31)
    changed = make_food(
        171477, "Chicken (reimported)", "sr_legacy",
        calories_kcal=999.0, protein_g=99.0, carbs_g=50.0, fat_g=50.0,
    )
    env = Env(meals=[make_meal(meal_id=1, items=[item])], foods=[changed])

    env.service.update_item_grams(USER, 1, 31, {"grams": 200})

    assert item.calories_kcal == Decimal("330.00")
    assert item.protein_g == Decimal("62.00")
    assert item.name == CHICKEN.description
    assert env.foods.get_calls == []


# SDD: 022 REQ-006 AC-006.5
def test_update_item_grams_works_on_a_meal_outside_the_add_window():
    """Con el reloj en 2026-10-21, se pueden cambiar los gramos de una comida
    del 2026-09-01."""
    item = make_item(31)
    env = Env(meals=[make_meal(meal_id=1, meal_date=date(2026, 9, 1), items=[item])])

    env.service.update_item_grams(USER, 1, 31, {"grams": 100})

    assert item.grams == Decimal("100")
    assert item.calories_kcal == Decimal("165.00")


# SDD: 022 REQ-006 AC-006.3
@pytest.mark.parametrize("grams", [0, 2001, "150", None])
def test_update_item_grams_rejects_invalid_grams_and_keeps_the_item(grams):
    """Gramos no válidos: 400 y el alimento no cambia."""
    item = make_item(31)
    env = Env(meals=[make_meal(meal_id=1, items=[item])])

    message = expect_error(
        ValidationError, env.service.update_item_grams, USER, 1, 31, {"grams": grams}
    )

    assert message == GRAMS_RANGE
    assert item.grams == Decimal("150")
    assert item.calories_kcal == Decimal("247.50")
    assert env.uow.committed is False


# SDD: 022 REQ-006 AC-006.3
def test_update_item_grams_rejects_a_missing_grams_field():
    """Sin `grams` en el cuerpo: 400 de rango."""
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(31)])])

    message = expect_error(ValidationError, env.service.update_item_grams, USER, 1, 31, {})

    assert message == GRAMS_RANGE


# SDD: 022 REQ-006 AC-006.4
@pytest.mark.parametrize("body", [None, "texto", [1], 5])
def test_update_item_grams_rejects_a_body_that_is_not_an_object(body):
    """Un cuerpo que no es un objeto: «La petición no es válida»."""
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(31)])])

    message = expect_error(ValidationError, env.service.update_item_grams, USER, 1, 31, body)

    assert message == INVALID_REQUEST


# SDD: 022 REQ-009 AC-009.3
def test_update_item_grams_of_another_users_meal_is_not_found_and_unchanged():
    """La comida de otro usuario da 404 con el mensaje de comida y no cambia."""
    item = make_item(31)
    env = Env(meals=[make_meal(meal_id=1, user_id=OTHER, items=[item])])

    message = expect_error(
        ResourceNotFoundError, env.service.update_item_grams, USER, 1, 31, {"grams": 200}
    )

    assert message == MEAL_NOT_FOUND
    assert item.grams == Decimal("150")
    assert env.uow.committed is False


# SDD: 022 REQ-009 AC-009.5
def test_update_item_grams_of_a_missing_meal_is_not_found_before_validating_the_body():
    """El 404 de la comida va antes que el 400 del cuerpo."""
    env = Env()

    message = expect_error(
        ResourceNotFoundError, env.service.update_item_grams, USER, 99, 31, {"grams": 0}
    )

    assert message == MEAL_NOT_FOUND


# SDD: 022 REQ-009 AC-009.4
def test_update_item_grams_of_an_item_that_is_not_in_the_meal_is_not_found():
    """Un `item_id` inexistente o de otra comida da 404 con el mensaje de alimento."""
    first = make_meal(meal_id=1, items=[make_item(31)])
    second = make_meal(meal_id=2, meal_type="dinner", items=[make_item(32)])
    env = Env(meals=[first, second])

    missing = expect_error(
        ResourceNotFoundError, env.service.update_item_grams, USER, 1, 999, {"grams": 100}
    )
    foreign = expect_error(
        ResourceNotFoundError, env.service.update_item_grams, USER, 1, 32, {"grams": 100}
    )

    assert missing == ITEM_NOT_FOUND
    assert foreign == ITEM_NOT_FOUND


# SDD: 022 REQ-009 AC-009.5
@pytest.mark.parametrize("meal_id", [0, -1, 2_147_483_648, True])
def test_update_item_grams_with_an_id_outside_the_database_range_is_not_found(meal_id):
    """Un id fuera del rango de INTEGER da 404 sin consultar la base."""
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(31)])])

    message = expect_error(
        ResourceNotFoundError, env.service.update_item_grams, USER, meal_id, 31, {"grams": 100}
    )

    assert message == MEAL_NOT_FOUND


# SDD: 022 REQ-006 AC-006.1
def test_update_item_grams_locks_the_user_row():
    """Cada escritura bloquea la fila del usuario."""
    env = Env(meals=[make_meal(meal_id=1, items=[make_item(31)])])

    env.service.update_item_grams(USER, 1, 31, {"grams": 200})

    assert env.users.for_update_calls == [USER]


# --------------------------------------------------------------------------
# remove_item y delete_meal
# --------------------------------------------------------------------------


# SDD: 022 REQ-007 AC-007.1
def test_remove_item_keeps_the_meal_when_it_still_has_items():
    """Quitar uno de dos alimentos deja la comida con el otro."""
    meal = make_meal(meal_id=1, items=[make_item(31), make_item(32, position=1)])
    env = Env(meals=[meal])

    env.service.remove_item(USER, 1, 31)

    assert [item.id for item in meal.items] == [32]
    assert env.meals.deleted == []
    assert env.uow.committed is True


# SDD: 022 REQ-007 AC-007.2
def test_remove_item_deletes_the_meal_when_it_becomes_empty():
    """Quitar el único alimento borra también la comida."""
    meal = make_meal(meal_id=1, items=[make_item(31)])
    env = Env(meals=[meal])

    env.service.remove_item(USER, 1, 31)

    assert env.meals.deleted == [meal]
    assert env.uow.committed is True


# SDD: 022 REQ-009 AC-009.3
def test_remove_item_of_another_users_meal_is_not_found_and_unchanged():
    """La comida de otro usuario da 404 y conserva sus alimentos."""
    meal = make_meal(meal_id=1, user_id=OTHER, items=[make_item(31)])
    env = Env(meals=[meal])

    message = expect_error(ResourceNotFoundError, env.service.remove_item, USER, 1, 31)

    assert message == MEAL_NOT_FOUND
    assert len(meal.items) == 1
    assert env.meals.deleted == []


# SDD: 022 REQ-009 AC-009.4
def test_remove_item_that_is_not_in_the_meal_is_not_found():
    """Un alimento inexistente o de otra comida da 404 con el mensaje de alimento."""
    first = make_meal(meal_id=1, items=[make_item(31)])
    second = make_meal(meal_id=2, meal_type="dinner", items=[make_item(32)])
    env = Env(meals=[first, second])

    missing = expect_error(ResourceNotFoundError, env.service.remove_item, USER, 1, 999)
    foreign = expect_error(ResourceNotFoundError, env.service.remove_item, USER, 1, 32)

    assert missing == ITEM_NOT_FOUND
    assert foreign == ITEM_NOT_FOUND
    assert len(first.items) == 1 and len(second.items) == 1


# SDD: 022 REQ-009 AC-009.5
def test_remove_item_of_a_missing_meal_is_not_found():
    """Una comida que no existe da 404."""
    env = Env()

    message = expect_error(ResourceNotFoundError, env.service.remove_item, USER, 99, 1)
    assert message == MEAL_NOT_FOUND


# SDD: 022 REQ-007 AC-007.5
def test_remove_item_works_on_a_meal_outside_the_add_window():
    """Con el reloj en 2026-10-21, se puede quitar un alimento del 2026-09-01."""
    meal = make_meal(meal_id=1, meal_date=date(2026, 9, 1), items=[make_item(31), make_item(32)])
    env = Env(meals=[meal])

    env.service.remove_item(USER, 1, 31)

    assert [item.id for item in meal.items] == [32]


# SDD: 022 REQ-007 AC-007.3
def test_delete_meal_removes_the_meal():
    """Borrar la comida la quita del repositorio y confirma."""
    meal = make_meal(meal_id=1, items=[make_item(31), make_item(32), make_item(33)])
    env = Env(meals=[meal])

    env.service.delete_meal(USER, 1)

    assert env.meals.deleted == [meal]
    assert env.meals.meals == []
    assert env.uow.committed is True


# SDD: 022 REQ-007 AC-007.5
def test_delete_meal_works_on_a_meal_outside_the_add_window():
    """Se puede borrar una comida del 2026-09-01 con el reloj en 2026-10-21."""
    meal = make_meal(meal_id=1, meal_date=date(2026, 9, 1), items=[make_item(31)])
    env = Env(meals=[meal])

    env.service.delete_meal(USER, 1)

    assert env.meals.deleted == [meal]


# SDD: 022 REQ-009 AC-009.3
def test_delete_meal_of_another_user_is_not_found_and_not_deleted():
    """La comida de otro usuario da 404 y no se borra."""
    meal = make_meal(meal_id=1, user_id=OTHER, items=[make_item(31)])
    env = Env(meals=[meal])

    message = expect_error(ResourceNotFoundError, env.service.delete_meal, USER, 1)

    assert message == MEAL_NOT_FOUND
    assert env.meals.deleted == []
    assert env.uow.committed is False


# SDD: 022 REQ-009 AC-009.5
def test_delete_meal_that_does_not_exist_is_not_found():
    """Un `meal_id` inexistente da 404."""
    env = Env()

    assert expect_error(ResourceNotFoundError, env.service.delete_meal, USER, 99) == MEAL_NOT_FOUND


# SDD: 022 REQ-007 AC-007.1
def test_remove_item_and_delete_meal_lock_the_user_row():
    """Quitar y borrar bloquean la fila del usuario."""
    meal = make_meal(meal_id=1, items=[make_item(31), make_item(32)])
    env = Env(meals=[meal])

    env.service.remove_item(USER, 1, 31)
    env.service.delete_meal(USER, 1)

    assert env.users.for_update_calls == [USER, USER]


# --------------------------------------------------------------------------
# Spec 023: alimentos del catálogo
# --------------------------------------------------------------------------

CATALOG_CHICKEN = make_catalog_food(
    "pechuga-de-pollo-a-la-plancha",
    "Pechuga de pollo a la plancha",
    calories_kcal=165.0,
    protein_g=31.0,
    carbs_g=0.0,
    fat_g=3.57,
    fdc_id=171477,
)
CATALOG_BANANA = make_catalog_food(
    "banano",
    "Banano",
    synonyms=["guineo"],
    calories_kcal=89.0,
    protein_g=1.09,
    carbs_g=22.84,
    fat_g=0.33,
    fdc_id=173944,
)


class CatalogEnv:
    """El servicio con un `FakeCatalogFoodRepository` inyectado por constructor."""

    def __init__(self, catalog_foods=None, meals=None, with_catalog_repository=True):
        self.meals = FakeMealRepository(meals)
        self.foods = FakeFoodRepository([CHICKEN, RICE])
        self.users = FakeLockingUserRepository()
        self.uow = FakeUnitOfWork()
        self.catalog = FakeCatalogFoodRepository(
            catalog_foods if catalog_foods is not None else [CATALOG_CHICKEN, CATALOG_BANANA]
        )
        kwargs = {"catalog_repository": self.catalog} if with_catalog_repository else {}
        self.service = MealService(
            self.meals, self.foods, self.users, self.uow, FakeClock(NOW), **kwargs
        )


def make_catalog_item(item_id, position=0, meal_id=None, grams="150", **overrides):
    """Alimento del catálogo precargado (la pechuga con los gramos dados)."""
    fields = dict(
        source="catalog",
        catalog_id="pechuga-de-pollo-a-la-plancha",
        fdc_id=None,
        data_type=None,
        name="Pechuga de pollo a la plancha",
    )
    fields.update(overrides)
    return make_item(item_id, position, meal_id, grams, **fields)


# SDD: 023 REQ-006 AC-006.1
def test_add_items_saves_a_catalog_item_with_a_copy_of_its_name_and_values():
    """La pechuga del catálogo con 150 g: `source` catalog, su identificador,
    sin FDC ID ni tipo de dato, nombre del catálogo, valores por 100 g copiados
    y nutrientes 247,5 / 46,5 / 0,0 / 5,36."""
    env = CatalogEnv()

    result = add(env, [{"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150}])

    assert result.created is True
    item = result.meal.meal.items[0]
    assert (item.source, item.catalog_id) == ("catalog", "pechuga-de-pollo-a-la-plancha")
    assert item.fdc_id is None
    assert item.data_type is None
    assert item.name == "Pechuga de pollo a la plancha"
    assert item.grams == Decimal("150")
    assert (
        item.per_100g_calories_kcal,
        item.per_100g_protein_g,
        item.per_100g_carbs_g,
        item.per_100g_fat_g,
    ) == (165.0, 31.0, 0.0, 3.57)
    assert item.calories_kcal == Decimal("247.50")
    assert item.protein_g == Decimal("46.50")
    assert item.carbs_g == Decimal("0.00")
    assert item.fat_g == Decimal("5.36")
    assert env.uow.committed is True


# SDD: 023 REQ-006 AC-006.1
def test_add_items_does_not_copy_the_synonyms_or_other_catalog_fields_into_the_item():
    """El alimento guardado no depende del catálogo: el nombre es el del
    catálogo, no un sinónimo."""
    env = CatalogEnv()

    result = add(env, [{"catalog_id": "banano", "grams": 100}])

    item = result.meal.meal.items[0]
    assert item.name == "Banano"
    assert item.calories_kcal == Decimal("89.00")


# SDD: 023 REQ-006 AC-006.2
def test_add_items_accepts_catalog_usda_and_custom_in_that_order():
    """Un alimento del catálogo, uno de USDA y uno personalizado: los tres, en
    ese orden, cada uno con su `source` y `catalog_id` solo en el primero."""
    env = CatalogEnv()

    result = add(
        env,
        [
            {"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150},
            {"fdc_id": 168878, "grams": 100},
            GALLO_PINTO,
        ],
    )

    items = result.meal.meal.items
    assert [item.source for item in items] == ["catalog", "usda", "custom"]
    assert [item.position for item in items] == [0, 1, 2]
    assert [item.catalog_id for item in items] == ["pechuga-de-pollo-a-la-plancha", None, None]


# SDD: 023 REQ-006 AC-006.2
def test_add_items_to_an_existing_meal_keeps_the_order_with_catalog_items():
    """Con un alimento ya registrado, el del catálogo se añade al final."""
    existing = make_meal(meal_id=5, items=[make_item(31)])
    env = CatalogEnv(meals=[existing])

    result = add(env, [{"catalog_id": "banano", "grams": 120}])

    assert result.created is False
    assert [item.source for item in existing.items] == ["usda", "catalog"]
    assert existing.items[1].position == 1


# SDD: 023 REQ-006 AC-006.2
def test_add_items_asks_the_catalog_once_for_the_distinct_identifiers():
    """Dos veces el mismo alimento: una sola consulta con identificadores sin repetir."""
    env = CatalogEnv()

    result = add(
        env,
        [
            {"catalog_id": "banano", "grams": 100},
            {"catalog_id": "banano", "grams": 50},
            {"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 100},
        ],
    )

    assert len(result.meal.meal.items) == 3
    assert len(env.catalog.get_calls) == 1
    assert sorted(env.catalog.get_calls[0]) == ["banano", "pechuga-de-pollo-a-la-plancha"]


# SDD: 023 REQ-006 AC-006.2
def test_add_items_without_catalog_items_does_not_query_the_catalog():
    """Una petición solo con USDA y personalizados no lee el catálogo."""
    env = CatalogEnv()

    add(env, [{"fdc_id": 171477, "grams": 100}, GALLO_PINTO])

    assert env.catalog.get_calls == []

    add(env, [{"catalog_id": "banano", "grams": 100}], meal_type="dinner")

    assert env.catalog.get_calls == [["banano"]]


# SDD: 023 REQ-008 AC-008.1
def test_usda_and_custom_items_keep_a_null_catalog_id():
    """Los alimentos de USDA y personalizados nuevos guardan `catalog_id` nulo."""
    env = CatalogEnv()

    result = add(
        env, [{"fdc_id": 171477, "grams": 100}, GALLO_PINTO, {"catalog_id": "banano", "grams": 100}]
    )

    assert [item.catalog_id for item in result.meal.meal.items] == [None, None, "banano"]


# SDD: 023 REQ-006 AC-006.3
def test_add_items_rejects_an_unknown_catalog_id_and_rolls_back():
    """Un `catalog_id` inexistente da 400 «No encontramos ese alimento.», no
    confirma, deshace y no guarda nada."""
    env = CatalogEnv()

    message = expect_error(ValidationError, add, env, [{"catalog_id": "no-existe", "grams": 100}])

    assert message == FOOD_NOT_FOUND
    assert env.uow.committed is False
    assert env.uow.rolled_back is True
    assert env.meals.created == []


# SDD: 023 REQ-006 AC-006.3
def test_add_items_with_one_unknown_catalog_food_among_valid_ones_saves_nothing():
    """Un alimento del catálogo válido, uno de USDA y uno inexistente: nada se guarda."""
    existing = make_meal(meal_id=5, items=[make_item(31)])
    env = CatalogEnv(meals=[existing])

    expect_error(
        ValidationError,
        add,
        env,
        [
            {"catalog_id": "banano", "grams": 100},
            {"fdc_id": 171477, "grams": 100},
            {"catalog_id": "no-existe", "grams": 100},
        ],
    )

    assert len(existing.items) == 1
    assert env.uow.committed is False
    assert env.uow.rolled_back is True


# SDD: 023 REQ-006 AC-006.3
def test_add_items_with_catalog_ids_but_no_catalog_repository_is_not_found():
    """Un servicio construido como en la 022 (sin repositorio del catálogo)
    trata el identificador como inexistente en lugar de fallar."""
    env = CatalogEnv(with_catalog_repository=False)

    message = expect_error(ValidationError, add, env, [{"catalog_id": "banano", "grams": 100}])

    assert message == FOOD_NOT_FOUND
    assert env.uow.rolled_back is True


def saved_catalog_item(env, item_id=31):
    """Guarda la pechuga del catálogo de 150 g con `add_items` y devuelve
    (id de la comida, alimento) con el identificador dado al alimento."""
    result = add(env, [{"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150}])
    item = result.meal.meal.items[0]
    item.id = item_id
    return result.meal.meal.id, item


# SDD: 023 REQ-006 AC-006.6
def test_update_item_grams_of_a_catalog_item_recalculates_with_the_stored_values():
    """La pechuga del catálogo de 150 g pasa a 200 g: 330,0 / 62,0 / 0,0 / 7,14."""
    env = CatalogEnv()
    meal_id, item = saved_catalog_item(env)

    env.service.update_item_grams(USER, meal_id, 31, {"grams": 200})

    assert item.grams == Decimal("200")
    assert item.calories_kcal == Decimal("330.00")
    assert item.protein_g == Decimal("62.00")
    assert item.carbs_g == Decimal("0.00")
    assert item.fat_g == Decimal("7.14")
    assert env.uow.committed is True


# SDD: 023 REQ-007 AC-007.2
def test_update_item_grams_ignores_a_catalog_that_changed_after_the_item_was_saved():
    """Aunque el catálogo ahora diga otra cosa (o ya no tenga el alimento), el
    recálculo usa los valores por 100 g guardados y no consulta el catálogo."""
    env = CatalogEnv()
    meal_id, item = saved_catalog_item(env)
    changed = make_catalog_food(
        "pechuga-de-pollo-a-la-plancha",
        "Pechuga renombrada",
        calories_kcal=999.0,
        protein_g=99.0,
        carbs_g=0.0,
        fat_g=0.0,
    )
    env.catalog.foods = [changed]
    env.catalog.get_calls.clear()

    env.service.update_item_grams(USER, meal_id, 31, {"grams": 200})

    assert item.calories_kcal == Decimal("330.00")
    assert item.protein_g == Decimal("62.00")
    assert item.name == "Pechuga de pollo a la plancha"
    assert env.catalog.get_calls == []
    assert env.catalog.list_calls == []


# SDD: 023 REQ-007 AC-007.2
def test_update_item_grams_works_when_the_food_was_removed_from_the_catalog():
    """Con el catálogo vacío, cambiar los gramos de un alimento registrado funciona."""
    env = CatalogEnv()
    meal_id, item = saved_catalog_item(env)
    env.catalog.foods = []

    summary = env.service.update_item_grams(USER, meal_id, 31, {"grams": 100})

    assert item.calories_kcal == Decimal("165.00")
    assert summary.meal.id == meal_id


# SDD: 023 REQ-007 AC-007.2
def test_get_diary_returns_a_catalog_item_with_its_saved_values_even_if_the_catalog_is_empty():
    """El diario no consulta el catálogo: el alimento se devuelve con lo guardado."""
    env = CatalogEnv()
    saved_catalog_item(env)
    env.catalog.foods = []
    env.catalog.get_calls.clear()

    diary = env.service.get_diary(USER, TODAY)

    assert diary.meals[0].meal.items[0].name == "Pechuga de pollo a la plancha"
    assert diary.totals["calories_kcal"] == Decimal("247.50")
    assert env.catalog.get_calls == [] and env.catalog.list_calls == []
