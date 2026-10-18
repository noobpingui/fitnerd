"""canonical email check constraints

Revision ID: e5b7d9f1a3c6
Revises: a7d3f9c1e5b2
Create Date: 2026-10-18 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'e5b7d9f1a3c6'
down_revision = 'a7d3f9c1e5b2'
branch_labels = None
depends_on = None

CANONICAL_EMAIL_SQL: str = (
    "email = lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))"
)
# Expresión canónica (lado derecho de la condición).
CANONICAL_EMAIL_EXPR: str = "lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))"
USERS_CHECK: str = "ck_users_email_canonical"
RESET_REQUESTS_CHECK: str = "ck_password_reset_requests_email_canonical"
CONFLICT_MESSAGE_PREFIX: str = (
    "Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; "
    "resuélvelas a mano antes de migrar: "
)


def upgrade() -> None:
    # exec_driver_sql evita que text() lea ":space" de "[[:space:]]" como parámetro.
    # El SQL solo usa constantes de este archivo (sin datos de usuario).
    bind = op.get_bind()

    conflicts = bind.exec_driver_sql(
        f"SELECT {CANONICAL_EMAIL_EXPR} AS canonical, "
        'array_agg(email ORDER BY email COLLATE "C") AS emails '
        "FROM public.users "
        f"GROUP BY {CANONICAL_EMAIL_EXPR} HAVING count(*) > 1 "
        f'ORDER BY {CANONICAL_EMAIL_EXPR} COLLATE "C"'
    ).fetchall()
    if conflicts:
        raise RuntimeError(
            CONFLICT_MESSAGE_PREFIX
            + "; ".join(", ".join(f'"{e}"' for e in row.emails) for row in conflicts)
        )

    for table in ("users", "password_reset_requests"):
        bind.exec_driver_sql(
            f"UPDATE public.{table} SET email = {CANONICAL_EMAIL_EXPR} "
            f"WHERE email <> {CANONICAL_EMAIL_EXPR}"
        )

    op.create_check_constraint(USERS_CHECK, "users", CANONICAL_EMAIL_SQL, schema="public")
    op.create_check_constraint(
        RESET_REQUESTS_CHECK, "password_reset_requests", CANONICAL_EMAIL_SQL, schema="public"
    )


def downgrade() -> None:
    """Solo quita las restricciones; los correos originales solo se recuperan del volcado previo."""
    op.drop_constraint(
        RESET_REQUESTS_CHECK, "password_reset_requests", type_="check", schema="public"
    )
    op.drop_constraint(USERS_CHECK, "users", type_="check", schema="public")
