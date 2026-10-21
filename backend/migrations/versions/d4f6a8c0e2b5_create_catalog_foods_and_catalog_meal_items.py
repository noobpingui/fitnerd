"""create catalog_foods and catalog meal items

Revision ID: d4f6a8c0e2b5
Revises: b3d5f7a9c1e4
Create Date: 2026-10-21 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd4f6a8c0e2b5'
down_revision = 'b3d5f7a9c1e4'
branch_labels = None
depends_on = None

_SOURCE_FIELDS_022 = (
    "(source = 'usda' AND fdc_id IS NOT NULL AND data_type IS NOT NULL) OR "
    "(source = 'custom' AND fdc_id IS NULL AND data_type IS NULL)"
)
_SOURCE_FIELDS_023 = (
    "(source = 'catalog' AND catalog_id IS NOT NULL AND fdc_id IS NULL "
    "AND data_type IS NULL) OR "
    "(source = 'usda' AND catalog_id IS NULL AND fdc_id IS NOT NULL "
    "AND data_type IS NOT NULL) OR "
    "(source = 'custom' AND catalog_id IS NULL AND fdc_id IS NULL "
    "AND data_type IS NULL)"
)


def upgrade() -> None:
    op.create_table(
        'catalog_foods',
        sa.Column('id', sa.String(length=60), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column(
            'synonyms', postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False
        ),
        sa.Column('calories_kcal', sa.Float(), nullable=False),
        sa.Column('protein_g', sa.Float(), nullable=False),
        sa.Column('carbs_g', sa.Float(), nullable=False),
        sa.Column('fat_g', sa.Float(), nullable=False),
        sa.Column('source', sa.String(length=10), nullable=False),
        sa.Column('fdc_id', sa.Integer(), nullable=True),
        sa.Column('reference', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "char_length(id) BETWEEN 2 AND 60 AND id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
            name='ck_catalog_foods_id_format',
        ),
        sa.CheckConstraint(
            'char_length(name) BETWEEN 2 AND 80', name='ck_catalog_foods_name_length'
        ),
        sa.CheckConstraint(
            'calories_kcal >= 0 AND calories_kcal <= 900', name='ck_catalog_foods_calories'
        ),
        sa.CheckConstraint(
            'protein_g >= 0 AND protein_g <= 100 AND carbs_g >= 0 AND carbs_g <= 100 '
            'AND fat_g >= 0 AND fat_g <= 100',
            name='ck_catalog_foods_macros',
        ),
        sa.CheckConstraint("source IN ('usda', 'manual')", name='ck_catalog_foods_source'),
        sa.CheckConstraint(
            "(source = 'usda' AND fdc_id IS NOT NULL) OR "
            "(source = 'manual' AND fdc_id IS NULL AND reference IS NOT NULL)",
            name='ck_catalog_foods_source_fields',
        ),
        sa.PrimaryKeyConstraint('id'),
        schema='public',
    )
    op.add_column(
        'meal_items', sa.Column('catalog_id', sa.String(length=60), nullable=True), schema='public'
    )
    # Alembic no detecta cambios en el texto de una CHECK: se reemplazan a mano.
    op.drop_constraint('ck_meal_items_source', 'meal_items', type_='check', schema='public')
    op.drop_constraint('ck_meal_items_source_fields', 'meal_items', type_='check', schema='public')
    op.create_check_constraint(
        'ck_meal_items_source', 'meal_items', "source IN ('catalog', 'usda', 'custom')",
        schema='public',
    )
    op.create_check_constraint(
        'ck_meal_items_source_fields', 'meal_items', _SOURCE_FIELDS_023, schema='public'
    )


def downgrade() -> None:
    bind = op.get_bind()
    registered = bind.exec_driver_sql(
        "SELECT count(*) FROM public.meal_items WHERE source = 'catalog'"
    ).scalar()
    if registered:
        raise RuntimeError(
            f"Hay {registered} alimentos del catálogo registrados en comidas: "
            "quítalos antes de revertir esta migración."
        )
    op.drop_constraint('ck_meal_items_source_fields', 'meal_items', type_='check', schema='public')
    op.drop_constraint('ck_meal_items_source', 'meal_items', type_='check', schema='public')
    op.create_check_constraint(
        'ck_meal_items_source', 'meal_items', "source IN ('usda', 'custom')", schema='public'
    )
    op.create_check_constraint(
        'ck_meal_items_source_fields', 'meal_items', _SOURCE_FIELDS_022, schema='public'
    )
    op.drop_column('meal_items', 'catalog_id', schema='public')
    # El catálogo se recarga desde el CSV.
    op.drop_table('catalog_foods', schema='public')
