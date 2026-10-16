"""lowercase user emails

Revision ID: a7d3f9c1e5b2
Revises: f2c4e6a8b0d1
Create Date: 2026-10-16 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a7d3f9c1e5b2'
down_revision = 'f2c4e6a8b0d1'
branch_labels = None
depends_on = None


def upgrade():
    """Pasa los correos guardados a minúsculas (ADR-0025).

    Si hay cuentas cuyos correos solo se diferencian en mayúsculas, falla sin
    escribir nada y lista esos correos para resolverlos a mano.
    """
    bind = op.get_bind()
    conflicts = bind.execute(sa.text(
        "SELECT lower(email) AS canonical, array_agg(email ORDER BY email) AS emails "
        "FROM public.users GROUP BY lower(email) HAVING count(*) > 1 ORDER BY canonical"
    )).all()
    if conflicts:
        groups = "; ".join(", ".join(row.emails) for row in conflicts)
        raise RuntimeError(
            "Hay cuentas cuyos correos solo se diferencian en mayúsculas; "
            "resuélvelas a mano antes de migrar: " + groups
        )

    bind.execute(sa.text(
        "UPDATE public.users SET email = lower(email) WHERE email <> lower(email)"
    ))


def downgrade():
    """No se puede deshacer: las mayúsculas originales solo se recuperan desde el volcado previo."""
