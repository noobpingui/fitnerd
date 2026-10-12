"""Test de la consolidacion de mediciones duplicadas (REQ-006) contra Postgres:
ejecuta el mismo SQL que corre la migracion. Dentro de la transaccion del test
se quita la restriccion unica para poder insertar duplicados y, al final, el
rollback la restaura (el DDL de Postgres es transaccional).
"""

from datetime import date, datetime

from sqlalchemy import select, text

from models.body_metric import BodyMetric
from models.user import User
from utils.body_metric_consolidation import consolidate_duplicate_body_metrics

DAY = date(2026, 10, 10)


def make_user(db_session, email):
    user = User(email=email, date_of_birth=date(2000, 1, 1))
    db_session.add(user)
    db_session.flush()
    return user


def add_metric(db_session, user, created_at, recorded_at=DAY, **values):
    metric = BodyMetric(
        user_id=user.id, recorded_at=recorded_at, created_at=created_at, **values
    )
    db_session.add(metric)
    db_session.flush()
    return metric


def drop_unique_constraint(db_session):
    db_session.execute(
        text(
            "ALTER TABLE public.body_metrics "
            "DROP CONSTRAINT IF EXISTS uq_body_metrics_user_id_recorded_at"
        )
    )


def run_consolidation(db_session):
    consolidate_duplicate_body_metrics(db_session.connection())
    db_session.expire_all()


def rows_of(db_session, user):
    return list(
        db_session.scalars(
            select(BodyMetric)
            .where(BodyMetric.user_id == user.id)
            .order_by(BodyMetric.recorded_at)
        )
    )


# SDD: REQ-006 AC-006.1
def test_consolidation_merges_a_day_taking_each_field_from_the_latest_that_has_it(db_session):
    """Peso de la segunda (79,8), grasa de la primera (20): una sola fila."""
    try:
        drop_unique_constraint(db_session)
        user = make_user(db_session, "dup@example.com")
        add_metric(
            db_session, user, datetime(2026, 10, 10, 9, 0),
            weight=80, body_fat_percentage=20, notes="primera",
        )
        add_metric(db_session, user, datetime(2026, 10, 10, 18, 0), weight=79.8)

        run_consolidation(db_session)

        rows = rows_of(db_session, user)
        assert len(rows) == 1
        assert rows[0].recorded_at == DAY
        assert rows[0].weight == 79.8
        assert rows[0].body_fat_percentage == 20
        assert rows[0].notes == "primera"
    finally:
        db_session.rollback()


# SDD: REQ-006 AC-006.1
def test_consolidation_of_three_rows_prefers_the_latest_value_of_each_field(db_session):
    """Con tres filas, cada campo toma el valor de la mas tardia que lo tiene."""
    try:
        drop_unique_constraint(db_session)
        user = make_user(db_session, "triple@example.com")
        add_metric(
            db_session, user, datetime(2026, 10, 10, 8, 0),
            weight=82, body_fat_percentage=22, muscle_mass_percentage=40,
        )
        add_metric(db_session, user, datetime(2026, 10, 10, 12, 0), weight=81, body_fat_percentage=21)
        add_metric(db_session, user, datetime(2026, 10, 10, 20, 0), weight=80)

        run_consolidation(db_session)

        rows = rows_of(db_session, user)
        assert len(rows) == 1
        assert rows[0].weight == 80
        assert rows[0].body_fat_percentage == 21
        assert rows[0].muscle_mass_percentage == 40
    finally:
        db_session.rollback()


# SDD: REQ-006 AC-006.2
def test_consolidation_leaves_users_with_one_metric_per_day_unchanged(db_session):
    """Sin duplicados, las mediciones no cambian."""
    try:
        drop_unique_constraint(db_session)
        user = make_user(db_session, "single@example.com")
        first = add_metric(
            db_session, user, datetime(2026, 10, 9, 9, 0),
            recorded_at=date(2026, 10, 9), weight=81, body_fat_percentage=21,
        )
        second = add_metric(db_session, user, datetime(2026, 10, 10, 9, 0), weight=80)
        first_id, second_id = first.id, second.id

        run_consolidation(db_session)

        rows = rows_of(db_session, user)
        assert [r.id for r in rows] == [first_id, second_id]
        assert (rows[0].weight, rows[0].body_fat_percentage) == (81, 21)
        assert (rows[1].weight, rows[1].body_fat_percentage) == (80, None)
    finally:
        db_session.rollback()


# SDD: REQ-006 AC-006.3
def test_consolidation_does_not_mix_users(db_session):
    """Dos usuarios con el mismo dia: cada uno conserva su medicion."""
    try:
        drop_unique_constraint(db_session)
        user_a = make_user(db_session, "a@example.com")
        user_b = make_user(db_session, "b@example.com")
        add_metric(db_session, user_a, datetime(2026, 10, 10, 9, 0), weight=80, body_fat_percentage=20)
        add_metric(db_session, user_b, datetime(2026, 10, 10, 10, 0), weight=70)

        run_consolidation(db_session)

        rows_a = rows_of(db_session, user_a)
        rows_b = rows_of(db_session, user_b)
        assert [(r.weight, r.body_fat_percentage) for r in rows_a] == [(80, 20)]
        assert [(r.weight, r.body_fat_percentage) for r in rows_b] == [(70, None)]
    finally:
        db_session.rollback()
