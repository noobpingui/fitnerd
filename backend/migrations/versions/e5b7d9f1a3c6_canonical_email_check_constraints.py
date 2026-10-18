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
USERS_CHECK: str = "ck_users_email_canonical"
RESET_REQUESTS_CHECK: str = "ck_password_reset_requests_email_canonical"
CONFLICT_MESSAGE_PREFIX: str = (
    "Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; "
    "resuélvelas a mano antes de migrar: "
)


def upgrade() -> None:
    raise NotImplementedError("not implemented")


def downgrade() -> None:
    raise NotImplementedError("not implemented")
