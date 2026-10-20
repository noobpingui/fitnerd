"""create meals and meal_items tables

Revision ID: b3d5f7a9c1e4
Revises: c8e2a4f6b9d3
Create Date: 2026-10-20 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b3d5f7a9c1e4'
down_revision = 'c8e2a4f6b9d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'meals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('meal_date', sa.Date(), nullable=False),
        sa.Column('meal_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')", name='ck_meals_meal_type'
        ),
        sa.ForeignKeyConstraint(['user_id'], ['public.users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'meal_date', 'meal_type', name='uq_meals_user_id_meal_date_meal_type'
        ),
        schema='public',
    )
    op.create_table(
        'meal_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('meal_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=10), nullable=False),
        sa.Column('fdc_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('data_type', sa.String(length=20), nullable=True),
        sa.Column('grams', sa.Numeric(precision=5, scale=1), nullable=False),
        sa.Column('per_100g_calories_kcal', sa.Float(), nullable=True),
        sa.Column('per_100g_protein_g', sa.Float(), nullable=True),
        sa.Column('per_100g_carbs_g', sa.Float(), nullable=True),
        sa.Column('per_100g_fat_g', sa.Float(), nullable=True),
        sa.Column('calories_kcal', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('protein_g', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('carbs_g', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('fat_g', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("source IN ('usda', 'custom')", name='ck_meal_items_source'),
        sa.CheckConstraint(
            "data_type IS NULL OR data_type IN ('foundation', 'sr_legacy')",
            name='ck_meal_items_data_type',
        ),
        sa.CheckConstraint('grams >= 1 AND grams <= 2000', name='ck_meal_items_grams'),
        sa.CheckConstraint(
            "(source = 'usda' AND fdc_id IS NOT NULL AND data_type IS NOT NULL) OR "
            "(source = 'custom' AND fdc_id IS NULL AND data_type IS NULL)",
            name='ck_meal_items_source_fields',
        ),
        sa.ForeignKeyConstraint(['meal_id'], ['public.meals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='public',
    )
    op.create_index(
        'ix_meal_items_meal_id', 'meal_items', ['meal_id'], unique=False, schema='public'
    )


def downgrade() -> None:
    # Tabla nueva: la reversión pierde los datos del diario, no datos previos.
    op.drop_index('ix_meal_items_meal_id', table_name='meal_items', schema='public')
    op.drop_table('meal_items', schema='public')
    op.drop_table('meals', schema='public')
