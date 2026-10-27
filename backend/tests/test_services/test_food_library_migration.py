"""Tests de la migración e6a8c0d2f4b7 (spec 028) contra Postgres real: crea las
tablas `custom_foods` y `food_favorites` y la columna `meal_items.custom_food_id`,
y rellena la biblioteca desde los personalizados ya registrados (REQ-005).

Cada test baja la migración con la API pública de Alembic (la base de pruebas se
crea con `create_all()`, es decir, ya con la estructura nueva), inserta con SQL
los datos de "antes de la migración", la sube y comprueba el resultado. Todo
ocurre en la transacción de la sesión y termina con `rollback()`, que lo deshace
(el DDL de Postgres es transaccional).
"""

from datetime import date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from models.meal import Meal
from models.user import User
from tests.migration_helpers import run_downgrade, run_upgrade

MIGRATION = "e6a8c0d2f4b7_create_food_library.py"

CUSTOM_FOODS_CHECKS = {
    "ck_custom_foods_name_length",
    "ck_custom_foods_calories",
    "ck_custom_foods_macros",
}
GALLO_OCT_1 = (180.0, 6.0, 30.0, 4.0)
GALLO_OCT_5 = (170.0, 7.0, 28.0, 3.0)


def sql(db_session, statement, **params):
    return db_session.connection().execute(text(statement), params)


def prepare(db_session):
    db_session.connection().exec_driver_sql("SET LOCAL lock_timeout = '5s'")


def table_exists(db_session, name):
    return sql(db_session, "SELECT to_regclass(:name)", name=f"public.{name}").scalar() is not None


def meal_items_has_custom_food_id(db_session):
    return (
        sql(
            db_session,
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'meal_items' "
            "AND column_name = 'custom_food_id'",
        ).scalar()
        == 1
    )


def constraint_names(db_session, table):
    rows = sql(
        db_session,
        "SELECT conname FROM pg_constraint WHERE conrelid = CAST(:table AS regclass)",
        table=f"public.{table}",
    ).all()
    return {row[0] for row in rows}


def add_user(db_session, email):
    user = User(email=email)
    db_session.add(user)
    db_session.flush()
    return user.id


def add_meal(db_session, user_id, meal_date, meal_type="lunch"):
    meal = Meal(user_id=user_id, meal_date=meal_date, meal_type=meal_type)
    db_session.add(meal)
    db_session.flush()
    return meal.id


def add_item(
    db_session,
    meal_id,
    name,
    values=GALLO_OCT_1,
    created_at=datetime(2026, 10, 1, 12, 0),
    source="custom",
    position=0,
    catalog_id=None,
    fdc_id=None,
    data_type=None,
):
    """Inserta un alimento con SQL (sin el modelo, que ya conoce la columna nueva)."""
    calories, protein, carbs, fat = values
    return sql(
        db_session,
        "INSERT INTO public.meal_items (meal_id, position, source, catalog_id, fdc_id, name, "
        "data_type, grams, per_100g_calories_kcal, per_100g_protein_g, per_100g_carbs_g, "
        "per_100g_fat_g, calories_kcal, protein_g, carbs_g, fat_g, created_at) VALUES "
        "(:meal_id, :position, :source, :catalog_id, :fdc_id, :name, :data_type, 100, "
        ":calories, :protein, :carbs, :fat, :calories, :protein, :carbs, :fat, :created_at) "
        "RETURNING id",
        meal_id=meal_id, position=position, source=source, catalog_id=catalog_id,
        fdc_id=fdc_id, name=name, data_type=data_type, calories=calories, protein=protein,
        carbs=carbs, fat=fat, created_at=created_at,
    ).scalar()


def downgraded(db_session):
    """Deja la base como estaba antes de la migración."""
    prepare(db_session)
    run_downgrade(db_session.connection(), MIGRATION)


def library_of(db_session, user_id):
    return sql(
        db_session,
        "SELECT id, name, name_key, calories_kcal, protein_g, carbs_g, fat_g "
        "FROM public.custom_foods WHERE user_id = :user_id ORDER BY id",
        user_id=user_id,
    ).all()


def link_of(db_session, item_id):
    return sql(
        db_session, "SELECT custom_food_id FROM public.meal_items WHERE id = :id", id=item_id
    ).scalar()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_creates_one_own_food_per_name_with_the_values_of_the_latest_record(db_session):
    """«Gallo pinto» del 1 de octubre (180 kcal) y «gallo pinto» del 5 (170 kcal):
    una sola entrada, «gallo pinto» con los valores del día 5; los dos registros
    quedan vinculados y conservan su nombre, valores y nutrientes."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        first_meal = add_meal(db_session, user_id, date(2026, 10, 1))
        second_meal = add_meal(db_session, user_id, date(2026, 10, 5))
        first = add_item(db_session, first_meal, "Gallo pinto", GALLO_OCT_1, datetime(2026, 10, 1, 12, 0))
        second = add_item(db_session, second_meal, "gallo pinto", GALLO_OCT_5, datetime(2026, 10, 5, 12, 0))

        run_upgrade(db_session.connection(), MIGRATION)

        ((food_id, name, _key, calories, protein, carbs, fat),) = library_of(db_session, user_id)
        assert name == "gallo pinto"
        assert (calories, protein, carbs, fat) == GALLO_OCT_5
        assert link_of(db_session, first) == food_id
        assert link_of(db_session, second) == food_id
        saved = sql(
            db_session,
            "SELECT name, per_100g_calories_kcal, calories_kcal FROM public.meal_items "
            "WHERE id IN (:a, :b) ORDER BY id",
            a=first, b=second,
        ).all()
        assert saved == [("Gallo pinto", 180.0, 180.0), ("gallo pinto", 170.0, 170.0)]
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_uses_the_creation_time_to_pick_the_latest_record_not_the_meal_date(db_session):
    """El registro más reciente es el añadido más tarde, aunque su comida sea de
    una fecha anterior."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        early_day = add_meal(db_session, user_id, date(2026, 10, 1))
        late_day = add_meal(db_session, user_id, date(2026, 10, 9))
        add_item(db_session, early_day, "Gallo pinto", GALLO_OCT_5, datetime(2026, 10, 20, 8, 0))
        add_item(db_session, late_day, "Gallo pinto", GALLO_OCT_1, datetime(2026, 10, 10, 8, 0))

        run_upgrade(db_session.connection(), MIGRATION)

        ((_id, _name, _key, calories, *_rest),) = library_of(db_session, user_id)
        assert calories == 170.0
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_groups_names_ignoring_case_accents_and_repeated_spaces(db_session):
    """«Piña colada», «Pina  COLADA» y « pina colada » son un solo alimento propio."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        ids = []
        for day, name in enumerate(["Piña colada", "Pina  COLADA", " pina colada "], start=1):
            meal_id = add_meal(db_session, user_id, date(2026, 10, day))
            ids.append(add_item(db_session, meal_id, name, created_at=datetime(2026, 10, day, 9, 0)))

        run_upgrade(db_session.connection(), MIGRATION)

        ((food_id, _name, name_key, *_rest),) = library_of(db_session, user_id)
        assert name_key == "pina colada"
        assert [link_of(db_session, item_id) for item_id in ids] == [food_id] * 3
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_creates_a_separate_own_food_for_each_distinct_name(db_session):
    """Dos nombres distintos del mismo usuario: dos alimentos propios."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        meal_id = add_meal(db_session, user_id, date(2026, 10, 1))
        add_item(db_session, meal_id, "Gallo pinto", position=0)
        add_item(db_session, meal_id, "Avena casera", position=1)

        run_upgrade(db_session.connection(), MIGRATION)

        assert [row[1] for row in library_of(db_session, user_id)] == ["Gallo pinto", "Avena casera"]
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.2
def test_upgrade_gives_each_user_their_own_food_with_the_same_name(db_session):
    """Dos usuarios con «Gallo pinto»: cada uno tiene el suyo, con sus valores y
    sus registros vinculados."""
    try:
        downgraded(db_session)
        ana = add_user(db_session, "ana@example.com")
        luis = add_user(db_session, "luis@example.com")
        ana_item = add_item(db_session, add_meal(db_session, ana, date(2026, 10, 1)), "Gallo pinto", GALLO_OCT_1)
        luis_item = add_item(db_session, add_meal(db_session, luis, date(2026, 10, 1)), "Gallo pinto", GALLO_OCT_5)

        run_upgrade(db_session.connection(), MIGRATION)

        ((ana_food, _n, _k, ana_calories, *_a),) = library_of(db_session, ana)
        ((luis_food, _n2, _k2, luis_calories, *_b),) = library_of(db_session, luis)
        assert ana_food != luis_food
        assert (ana_calories, luis_calories) == (180.0, 170.0)
        assert link_of(db_session, ana_item) == ana_food
        assert link_of(db_session, luis_item) == luis_food
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_leaves_usda_and_catalog_items_untouched(db_session):
    """Los alimentos de USDA y del catálogo no se vinculan ni crean alimentos propios."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        meal_id = add_meal(db_session, user_id, date(2026, 10, 1))
        usda = add_item(
            db_session, meal_id, "Chicken", source="usda", fdc_id=171477,
            data_type="sr_legacy", position=0,
        )
        catalog = add_item(
            db_session, meal_id, "Banano", source="catalog", catalog_id="banano", position=1
        )

        run_upgrade(db_session.connection(), MIGRATION)

        assert library_of(db_session, user_id) == []
        assert link_of(db_session, usda) is None
        assert link_of(db_session, catalog) is None
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.3
def test_upgrade_on_a_database_without_custom_items_creates_no_own_foods(db_session):
    """Sin personalizados registrados, ninguna biblioteca tiene alimentos."""
    try:
        downgraded(db_session)
        add_user(db_session, "ana@example.com")

        run_upgrade(db_session.connection(), MIGRATION)

        assert sql(db_session, "SELECT count(*) FROM public.custom_foods").scalar() == 0
        assert sql(db_session, "SELECT count(*) FROM public.food_favorites").scalar() == 0
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.3
def test_upgrade_does_not_apply_the_limit_of_500_own_foods(db_session):
    """La creación inicial no aplica el límite de REQ-002: 501 nombres distintos."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        meal_id = add_meal(db_session, user_id, date(2026, 10, 1))
        for number in range(501):
            add_item(db_session, meal_id, f"Alimento {number}", position=number)

        run_upgrade(db_session.connection(), MIGRATION)

        assert len(library_of(db_session, user_id)) == 501
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_downgrade_removes_the_column_and_both_tables_without_losing_the_items(db_session):
    """Bajar quita `meal_items.custom_food_id`, `custom_foods` y `food_favorites`
    y conserva los alimentos registrados."""
    try:
        prepare(db_session)
        user_id = add_user(db_session, "ana@example.com")
        meal_id = add_meal(db_session, user_id, date(2026, 10, 1))
        run_downgrade(db_session.connection(), MIGRATION)
        add_item(db_session, meal_id, "Gallo pinto")

        assert not meal_items_has_custom_food_id(db_session)
        assert not table_exists(db_session, "custom_foods")
        assert not table_exists(db_session, "food_favorites")
        assert sql(db_session, "SELECT count(*) FROM public.meal_items").scalar() == 1
    finally:
        db_session.rollback()


# SDD: 028 REQ-005 AC-005.1
def test_upgrade_after_the_downgrade_recreates_the_structures_with_their_constraints(db_session):
    """Subir deja las tablas, la columna, el índice y las restricciones del plan."""
    try:
        downgraded(db_session)

        run_upgrade(db_session.connection(), MIGRATION)

        assert table_exists(db_session, "custom_foods")
        assert table_exists(db_session, "food_favorites")
        assert meal_items_has_custom_food_id(db_session)
        assert CUSTOM_FOODS_CHECKS | {"uq_custom_foods_user_id_name_key"} <= constraint_names(
            db_session, "custom_foods"
        )
        assert {
            "ck_food_favorites_one_food",
            "uq_food_favorites_user_id_catalog_id",
            "uq_food_favorites_user_id_custom_food_id",
            "fk_food_favorites_custom_food_id",
        } <= constraint_names(db_session, "food_favorites")
        assert {"ck_meal_items_custom_food_source", "fk_meal_items_custom_food_id"} <= (
            constraint_names(db_session, "meal_items")
        )
        index = sql(
            db_session, "SELECT to_regclass('public.ix_meal_items_custom_food_id')"
        ).scalar()
        assert index is not None
    finally:
        db_session.rollback()


# SDD: 028 REQ-004 AC-004.1
def test_deleting_an_own_food_nulls_the_link_and_removes_its_favorite(db_session):
    """`ON DELETE SET NULL` en `meal_items.custom_food_id` y `ON DELETE CASCADE`
    en `food_favorites.custom_food_id`."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        item = add_item(db_session, add_meal(db_session, user_id, date(2026, 10, 1)), "Gallo pinto")
        run_upgrade(db_session.connection(), MIGRATION)
        food_id = library_of(db_session, user_id)[0][0]
        sql(
            db_session,
            "INSERT INTO public.food_favorites (user_id, custom_food_id) VALUES (:u, :f)",
            u=user_id, f=food_id,
        )

        sql(db_session, "DELETE FROM public.custom_foods WHERE id = :id", id=food_id)

        assert link_of(db_session, item) is None
        assert sql(db_session, "SELECT count(*) FROM public.food_favorites").scalar() == 0
        assert sql(db_session, "SELECT count(*) FROM public.meal_items").scalar() == 1
    finally:
        db_session.rollback()


# SDD: 028 REQ-001 AC-001.1
def test_the_upgraded_checks_reject_a_link_on_a_usda_item_and_a_favorite_with_two_foods(db_session):
    """`ck_meal_items_custom_food_source` y `ck_food_favorites_one_food` se cumplen."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        meal_id = add_meal(db_session, user_id, date(2026, 10, 1))
        gallo = add_item(db_session, meal_id, "Gallo pinto", position=0)
        usda = add_item(
            db_session, meal_id, "Chicken", source="usda", fdc_id=171477,
            data_type="sr_legacy", position=1,
        )
        run_upgrade(db_session.connection(), MIGRATION)
        food_id = link_of(db_session, gallo)

        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                sql(
                    db_session,
                    "UPDATE public.meal_items SET custom_food_id = :f WHERE id = :id",
                    f=food_id, id=usda,
                )
        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                sql(
                    db_session,
                    "INSERT INTO public.food_favorites (user_id, catalog_id, custom_food_id) "
                    "VALUES (:u, 'banano', :f)",
                    u=user_id, f=food_id,
                )
    finally:
        db_session.rollback()


# SDD: 028 REQ-001 AC-001.4
def test_the_library_does_not_allow_two_foods_with_the_same_name_key_per_user(db_session):
    """`UNIQUE (user_id, name_key)`: el mismo nombre dos veces para un usuario falla."""
    try:
        downgraded(db_session)
        user_id = add_user(db_session, "ana@example.com")
        run_upgrade(db_session.connection(), MIGRATION)
        insert = (
            "INSERT INTO public.custom_foods (user_id, name, name_key, calories_kcal, protein_g, "
            "carbs_g, fat_g) VALUES (:u, 'Gallo pinto', 'gallo pinto', 1, 1, 1, 1)"
        )
        sql(db_session, insert, u=user_id)

        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                sql(db_session, insert, u=user_id)
    finally:
        db_session.rollback()
