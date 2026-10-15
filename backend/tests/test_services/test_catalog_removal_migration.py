"""Tests de la migracion f2c4e6a8b0d1 (spec 012) contra Postgres real. El DDL
de Postgres es transaccional: todo ocurre en la transaccion de `db_session` y
termina con `rollback()`, que restaura el esquema de la base de tests.

La migracion se carga por ruta y se ejecuta con la API publica de Alembic
(`MigrationContext` y `Operations`), sin mocks.
"""

import importlib.util
import uuid
from datetime import date
from pathlib import Path

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect, text

from extensions import db
from models.body_metric import BodyMetric
from models.user import User
from models.user_profile import UserProfile

MIGRATION_PATH = (
    Path(__file__).parents[2]
    / "migrations"
    / "versions"
    / "f2c4e6a8b0d1_drop_catalog_favorites_and_weekly_plan.py"
)

RETIRED_TABLES = [
    "body_regions",
    "exercise_categories",
    "exercises",
    "exercise_favorites",
    "weekly_plan_entries",
]

# Orden de borrado (dependientes primero) para dejar el esquema "ya migrado".
DROP_ORDER = [
    "weekly_plan_entries",
    "exercise_favorites",
    "exercises",
    "exercise_categories",
    "body_regions",
]

CREATE_DDL = [
    """CREATE TABLE public.body_regions (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now())""",
    """CREATE TABLE public.exercise_categories (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        body_region_id UUID NOT NULL REFERENCES public.body_regions (id))""",
    """CREATE TABLE public.exercises (
        id UUID PRIMARY KEY,
        category_id UUID NOT NULL REFERENCES public.exercise_categories (id),
        name VARCHAR(150) NOT NULL,
        video_url VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT uq_category_exercise_name UNIQUE (category_id, name))""",
    """CREATE TABLE public.exercise_favorites (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users (id),
        exercise_id UUID NOT NULL REFERENCES public.exercises (id),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_exercise_favorite UNIQUE (user_id, exercise_id))""",
    """CREATE TABLE public.weekly_plan_entries (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users (id),
        exercise_id UUID NOT NULL REFERENCES public.exercises (id),
        day_of_week SMALLINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_exercise_day UNIQUE (user_id, exercise_id, day_of_week))""",
]


def load_migration():
    spec = importlib.util.spec_from_file_location("catalog_removal_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(db_session, direction):
    """Ejecuta upgrade() o downgrade() sobre la conexion de la transaccion."""
    module = load_migration()
    context = MigrationContext.configure(db_session.connection())
    with Operations.context(context):
        getattr(module, direction)()


def drop_retired_tables(db_session):
    for table in DROP_ORDER:
        db_session.execute(text(f"DROP TABLE IF EXISTS public.{table}"))


def table_names(db_session):
    return set(inspect(db_session.connection()).get_table_names(schema="public"))


# SDD: 012 REQ-003 AC-003.1
def test_upgrade_drops_the_five_tables_and_keeps_users_profiles_and_metrics(db_session):
    """Con filas en las cinco tablas y un usuario con perfil y medicion,
    upgrade() borra las cinco tablas y deja intacto el resto."""
    try:
        drop_retired_tables(db_session)
        for ddl in CREATE_DDL:
            db_session.execute(text(ddl))

        user = User(email="migracion@example.com", date_of_birth=date(1990, 6, 15))
        db_session.add(user)
        db_session.flush()
        db_session.add(
            UserProfile(
                user_id=user.id,
                gender="male",
                height_unit="cm",
                height_cm=175.5,
                weight_unit="kg",
                weight=72.5,
                activity_level="moderate",
                goal="maintain",
            )
        )
        db_session.add(BodyMetric(user_id=user.id, recorded_at=date(2026, 10, 10), weight=72.5))
        db_session.flush()

        region_id, category_id, exercise_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        db_session.execute(
            text("INSERT INTO public.body_regions (id, name) VALUES (:id, 'Tren superior')"),
            {"id": region_id},
        )
        db_session.execute(
            text(
                "INSERT INTO public.exercise_categories (id, name, body_region_id) "
                "VALUES (:id, 'Pecho', :region)"
            ),
            {"id": category_id, "region": region_id},
        )
        db_session.execute(
            text(
                "INSERT INTO public.exercises (id, category_id, name, video_url) "
                "VALUES (:id, :category, 'Press', 'https://youtu.be/x')"
            ),
            {"id": exercise_id, "category": category_id},
        )
        db_session.execute(
            text(
                "INSERT INTO public.exercise_favorites (id, user_id, exercise_id) "
                "VALUES (:id, :user, :exercise)"
            ),
            {"id": uuid.uuid4(), "user": user.id, "exercise": exercise_id},
        )
        db_session.execute(
            text(
                "INSERT INTO public.weekly_plan_entries "
                "(id, user_id, exercise_id, day_of_week) "
                "VALUES (:id, :user, :exercise, 1)"
            ),
            {"id": uuid.uuid4(), "user": user.id, "exercise": exercise_id},
        )
        assert set(RETIRED_TABLES) <= table_names(db_session)

        run(db_session, "upgrade")

        names = table_names(db_session)
        for table in RETIRED_TABLES:
            assert table not in names
        db_session.expire_all()
        kept_user = db_session.get(User, user.id)
        assert kept_user is not None
        assert kept_user.email == "migracion@example.com"
        assert kept_user.date_of_birth == date(1990, 6, 15)
        kept_profile = db_session.get(UserProfile, user.id)
        assert kept_profile.weight == 72.5
        assert kept_profile.goal == "maintain"
        metrics = db_session.query(BodyMetric).filter_by(user_id=user.id).all()
        assert len(metrics) == 1
        assert metrics[0].weight == 72.5
        assert metrics[0].recorded_at == date(2026, 10, 10)
    finally:
        db_session.rollback()


# SDD: 012 REQ-003 AC-003.2
def test_downgrade_recreates_the_five_tables_empty_with_their_structure(db_session):
    """Desde una base ya migrada, downgrade() vuelve a crear las cinco tablas
    vacias con columnas, restricciones unicas, FK e indices anteriores."""
    try:
        drop_retired_tables(db_session)

        run(db_session, "downgrade")

        inspector = inspect(db_session.connection())
        names = set(inspector.get_table_names(schema="public"))
        for table in RETIRED_TABLES:
            assert table in names
            count = db_session.execute(text(f"SELECT count(*) FROM public.{table}")).scalar()
            assert count == 0

        def columns(table):
            return {
                column["name"]: (str(column["type"]).upper(), column["nullable"])
                for column in inspector.get_columns(table, schema="public")
            }

        def uniques(table):
            return {
                unique["name"]: tuple(unique["column_names"])
                for unique in inspector.get_unique_constraints(table, schema="public")
            }

        def fks(table):
            return {
                (
                    tuple(fk["constrained_columns"]),
                    fk["referred_table"],
                    tuple(fk["referred_columns"]),
                )
                for fk in inspector.get_foreign_keys(table, schema="public")
            }

        def indexes(table):
            return {
                index["name"]: tuple(index["column_names"])
                for index in inspector.get_indexes(table, schema="public")
            }

        regions = columns("body_regions")
        assert set(regions) == {"id", "name", "is_active", "created_at"}
        assert regions["id"] == ("UUID", False)
        assert regions["name"] == ("VARCHAR(100)", False)
        assert regions["is_active"] == ("BOOLEAN", False)
        assert regions["created_at"][0].startswith("TIMESTAMP")
        assert regions["created_at"][1] is False
        assert tuple(uniques("body_regions").values()) == (("name",),)

        categories = columns("exercise_categories")
        assert set(categories) == {"id", "name", "created_at", "is_active", "body_region_id"}
        assert categories["name"] == ("VARCHAR(100)", False)
        assert categories["body_region_id"] == ("UUID", False)
        assert tuple(uniques("exercise_categories").values()) == (("name",),)
        assert fks("exercise_categories") == {
            (("body_region_id",), "body_regions", ("id",))
        }
        assert indexes("exercise_categories").get(
            "ix_public_exercise_categories_body_region_id"
        ) == ("body_region_id",)

        exercises = columns("exercises")
        assert set(exercises) == {
            "id", "category_id", "name", "video_url", "created_at", "is_active"
        }
        assert exercises["name"] == ("VARCHAR(150)", False)
        assert exercises["video_url"] == ("VARCHAR(500)", False)
        assert exercises["category_id"] == ("UUID", False)
        assert uniques("exercises") == {
            "uq_category_exercise_name": ("category_id", "name")
        }
        assert fks("exercises") == {(("category_id",), "exercise_categories", ("id",))}
        assert indexes("exercises").get("ix_public_exercises_category_id") == ("category_id",)

        favorites = columns("exercise_favorites")
        assert set(favorites) == {"id", "user_id", "exercise_id", "created_at"}
        assert favorites["user_id"] == ("UUID", False)
        assert favorites["exercise_id"] == ("UUID", False)
        assert uniques("exercise_favorites") == {
            "uq_user_exercise_favorite": ("user_id", "exercise_id")
        }
        assert fks("exercise_favorites") == {
            (("user_id",), "users", ("id",)),
            (("exercise_id",), "exercises", ("id",)),
        }
        favorite_indexes = indexes("exercise_favorites")
        assert favorite_indexes.get("ix_public_exercise_favorites_user_id") == ("user_id",)
        assert favorite_indexes.get("ix_public_exercise_favorites_exercise_id") == (
            "exercise_id",
        )

        plan = columns("weekly_plan_entries")
        assert set(plan) == {"id", "user_id", "exercise_id", "day_of_week", "created_at"}
        assert plan["day_of_week"] == ("SMALLINT", False)
        assert uniques("weekly_plan_entries") == {
            "uq_user_exercise_day": ("user_id", "exercise_id", "day_of_week")
        }
        assert fks("weekly_plan_entries") == {
            (("user_id",), "users", ("id",)),
            (("exercise_id",), "exercises", ("id",)),
        }
        plan_indexes = indexes("weekly_plan_entries")
        assert plan_indexes.get("ix_public_weekly_plan_entries_user_id") == ("user_id",)
        assert plan_indexes.get("ix_public_weekly_plan_entries_exercise_id") == (
            "exercise_id",
        )
    finally:
        db_session.rollback()


# SDD: 012 REQ-003 AC-003.3
def test_test_database_has_none_of_the_retired_tables(db_session):
    """La base que crean los tests a partir del modelo no contiene ninguna de
    las cinco tablas retiradas, ni en la metadata ni en Postgres."""
    metadata_names = set(db.metadata.tables)
    for table in RETIRED_TABLES:
        assert f"public.{table}" not in metadata_names
        assert table not in metadata_names

    existing = table_names(db_session)
    for table in RETIRED_TABLES:
        assert table not in existing
