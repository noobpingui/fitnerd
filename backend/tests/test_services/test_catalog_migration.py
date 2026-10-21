"""Tests de la migración d4f6a8c0e2b5 (spec 023) contra Postgres real: el
`downgrade` se niega, sin modificar nada, si hay alimentos del catálogo
registrados en comidas y, si no, quita `meal_items.catalog_id`, las `CHECK`
de la 022 vuelven y `catalog_foods` desaparece.

Cada test ejecuta la migración con la API pública de Alembic sobre la
conexión de la sesión y termina con `rollback()`, que lo deshace todo (el DDL
de Postgres es transaccional).
"""

from datetime import date

import pytest
from sqlalchemy import text

from models.meal import Meal, MealItem
from models.user import User
from tests.migration_helpers import run_downgrade, run_upgrade

CATALOG_MIGRATION = "d4f6a8c0e2b5_create_catalog_foods_and_catalog_meal_items.py"
CATALOG_FOODS_CHECKS = {
    "ck_catalog_foods_id_format",
    "ck_catalog_foods_name_length",
    "ck_catalog_foods_calories",
    "ck_catalog_foods_macros",
    "ck_catalog_foods_source",
    "ck_catalog_foods_source_fields",
}
DOWNGRADE_MESSAGE = (
    "Hay 1 alimentos del catálogo registrados en comidas: quítalos antes de revertir "
    "esta migración."
)


def sql(db_session, statement, **params):
    return db_session.connection().execute(text(statement), params)


def table_exists(db_session, name):
    return sql(db_session, "SELECT to_regclass(:name)", name=f"public.{name}").scalar() is not None


def meal_items_has_catalog_id(db_session):
    return (
        sql(
            db_session,
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'meal_items' "
            "AND column_name = 'catalog_id'",
        ).scalar()
        == 1
    )


def constraint_definition(db_session, name):
    return sql(
        db_session, "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = :name",
        name=name,
    ).scalar()


def add_meal_with_item(db_session, **item_fields):
    user = User(email="ana@example.com")
    db_session.add(user)
    db_session.flush()
    meal = Meal(user_id=user.id, meal_date=date(2026, 10, 21), meal_type="lunch")
    fields = dict(
        position=0, grams=150, per_100g_calories_kcal=165.0, per_100g_protein_g=31.0,
        per_100g_carbs_g=0.0, per_100g_fat_g=3.57, calories_kcal=247.5, protein_g=46.5,
        carbs_g=0.0, fat_g=5.36,
    )
    fields.update(item_fields)
    meal.items.append(MealItem(**fields))
    db_session.add(meal)
    db_session.flush()


def prepare(db_session):
    db_session.connection().exec_driver_sql("SET LOCAL lock_timeout = '5s'")


# SDD: 023 REQ-008 AC-008.1
def test_downgrade_refuses_when_catalog_items_are_registered_and_changes_nothing(db_session):
    """Con un alimento `catalog` en una comida, el `downgrade` lanza el error y
    deja la columna, la tabla del catálogo y el alimento donde estaban."""
    try:
        prepare(db_session)
        add_meal_with_item(
            db_session, source="catalog", catalog_id="banano", name="Banano", fdc_id=None,
            data_type=None,
        )

        with pytest.raises(RuntimeError) as exc_info:
            run_downgrade(db_session.connection(), CATALOG_MIGRATION)

        assert str(exc_info.value) == DOWNGRADE_MESSAGE
        assert meal_items_has_catalog_id(db_session)
        assert table_exists(db_session, "catalog_foods")
        assert sql(db_session, "SELECT count(*) FROM public.meal_items").scalar() == 1
        assert "catalog" in constraint_definition(db_session, "ck_meal_items_source")
    finally:
        db_session.rollback()


# SDD: 023 REQ-008 AC-008.1
def test_downgrade_without_catalog_items_removes_the_column_and_the_table(db_session):
    """Solo con alimentos de USDA y personalizados, el `downgrade` quita
    `meal_items.catalog_id`, borra `catalog_foods` y no pierde los alimentos."""
    try:
        prepare(db_session)
        add_meal_with_item(
            db_session, source="usda", fdc_id=171477, data_type="sr_legacy", name="Chicken"
        )

        run_downgrade(db_session.connection(), CATALOG_MIGRATION)

        assert not meal_items_has_catalog_id(db_session)
        assert not table_exists(db_session, "catalog_foods")
        assert sql(db_session, "SELECT count(*) FROM public.meal_items").scalar() == 1
    finally:
        db_session.rollback()


# SDD: 023 REQ-008 AC-008.1
def test_downgrade_restores_the_two_checks_of_spec_022(db_session):
    """Las `CHECK` de `meal_items` vuelven a la forma de la 022: sin `catalog`."""
    try:
        prepare(db_session)

        run_downgrade(db_session.connection(), CATALOG_MIGRATION)

        source = constraint_definition(db_session, "ck_meal_items_source")
        fields = constraint_definition(db_session, "ck_meal_items_source_fields")
        assert "usda" in source and "custom" in source
        assert "catalog" not in source
        assert "usda" in fields and "custom" in fields
        assert "catalog" not in fields
    finally:
        db_session.rollback()


# SDD: 023 REQ-008 AC-008.1
def test_upgrade_after_the_downgrade_recreates_the_catalog_structures(db_session):
    """Bajar y volver a subir deja la tabla con sus seis `CHECK`, la columna
    `catalog_id` y las dos `CHECK` de `meal_items` aceptando `catalog`."""
    try:
        prepare(db_session)
        run_downgrade(db_session.connection(), CATALOG_MIGRATION)

        run_upgrade(db_session.connection(), CATALOG_MIGRATION)

        assert table_exists(db_session, "catalog_foods")
        assert meal_items_has_catalog_id(db_session)
        names = {
            row[0]
            for row in sql(
                db_session,
                "SELECT conname FROM pg_constraint "
                "WHERE conrelid = 'public.catalog_foods'::regclass AND contype = 'c'",
            ).all()
        }
        assert names == CATALOG_FOODS_CHECKS
        assert "catalog" in constraint_definition(db_session, "ck_meal_items_source")
        assert "catalog" in constraint_definition(db_session, "ck_meal_items_source_fields")
    finally:
        db_session.rollback()


# SDD: 023 REQ-008 AC-008.1
def test_the_upgraded_checks_accept_a_catalog_item_and_reject_a_mixed_one(db_session):
    """Tras subir la migración, un alimento `catalog` con `catalog_id` es válido y
    uno `usda` con `catalog_id` no."""
    from sqlalchemy.exc import IntegrityError

    try:
        prepare(db_session)
        run_downgrade(db_session.connection(), CATALOG_MIGRATION)
        run_upgrade(db_session.connection(), CATALOG_MIGRATION)

        add_meal_with_item(
            db_session, source="catalog", catalog_id="banano", name="Banano", fdc_id=None,
            data_type=None,
        )
        assert sql(db_session, "SELECT count(*) FROM public.meal_items").scalar() == 1

        with pytest.raises(IntegrityError):
            sql(
                db_session,
                "UPDATE public.meal_items SET source = 'usda', fdc_id = 1, "
                "data_type = 'sr_legacy'",
            )
    finally:
        db_session.rollback()
