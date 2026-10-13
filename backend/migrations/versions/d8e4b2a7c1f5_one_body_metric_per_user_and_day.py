"""one body metric per user and day

Revision ID: d8e4b2a7c1f5
Revises: c6a1f0d2e9b4
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op

from utils.body_metric_consolidation import consolidate_duplicate_body_metrics


# revision identifiers, used by Alembic.
revision = 'd8e4b2a7c1f5'
down_revision = 'c6a1f0d2e9b4'
branch_labels = None
depends_on = None


def upgrade():
    # Primero se consolidan los duplicados existentes; si no, la restricción fallaría.
    consolidate_duplicate_body_metrics(op.get_bind())
    op.create_unique_constraint(
        'uq_body_metrics_user_id_recorded_at',
        'body_metrics',
        ['user_id', 'recorded_at'],
        schema='public',
    )


def downgrade():
    """Solo quita la restricción: la consolidación de duplicados no se deshace."""
    op.drop_constraint(
        'uq_body_metrics_user_id_recorded_at',
        'body_metrics',
        type_='unique',
        schema='public',
    )
