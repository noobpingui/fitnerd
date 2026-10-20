"""create foods table

Revision ID: c8e2a4f6b9d3
Revises: e5b7d9f1a3c6
Create Date: 2026-10-20 00:00:00.000000

"""
import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c8e2a4f6b9d3'
down_revision = 'e5b7d9f1a3c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'foods',
        sa.Column('fdc_id', sa.Integer(), autoincrement=False, nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('data_type', sa.String(length=20), nullable=False),
        sa.Column('calories_kcal', sa.Float(), nullable=True),
        sa.Column('protein_g', sa.Float(), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=True),
        sa.Column('fat_g', sa.Float(), nullable=True),
        sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
        sa.Column(
            'search_vector',
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('english'::regconfig, description)", persisted=True),
            nullable=True,
        ),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("data_type IN ('foundation', 'sr_legacy')", name='ck_foods_data_type'),
        sa.PrimaryKeyConstraint('fdc_id'),
        schema='public',
    )
    op.create_index(
        'ix_foods_search_vector',
        'foods',
        ['search_vector'],
        unique=False,
        schema='public',
        postgresql_using='gin',
    )


def downgrade() -> None:
    # Los datos se pueden reimportar desde USDA.
    op.drop_index(
        'ix_foods_search_vector', table_name='foods', schema='public', postgresql_using='gin'
    )
    op.drop_table('foods', schema='public')
