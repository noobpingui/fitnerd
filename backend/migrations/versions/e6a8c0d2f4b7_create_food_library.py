"""create food library: custom_foods, food_favorites and meal_items.custom_food_id

Revision ID: e6a8c0d2f4b7
Revises: d4f6a8c0e2b5
Create Date: 2026-10-27 00:00:00.000000

"""
import unicodedata

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e6a8c0d2f4b7'
down_revision = 'd4f6a8c0e2b5'
branch_labels = None
depends_on = None


def _name_key(name: str) -> str:
    # Copia local de la regla de la app (custom_food_name_key): la migración no
    # importa código de la app, que puede cambiar con el tiempo.
    decomposed = unicodedata.normalize("NFKD", name.casefold())
    folded = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(folded.split())


def upgrade() -> None:
    op.create_table(
        'custom_foods',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('name_key', sa.Text(), nullable=False),
        sa.Column('calories_kcal', sa.Float(), nullable=False),
        sa.Column('protein_g', sa.Float(), nullable=False),
        sa.Column('carbs_g', sa.Float(), nullable=False),
        sa.Column('fat_g', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            'char_length(name) BETWEEN 1 AND 100', name='ck_custom_foods_name_length'
        ),
        sa.CheckConstraint(
            'calories_kcal >= 0 AND calories_kcal <= 900', name='ck_custom_foods_calories'
        ),
        sa.CheckConstraint(
            'protein_g >= 0 AND protein_g <= 100 AND carbs_g >= 0 AND carbs_g <= 100 '
            'AND fat_g >= 0 AND fat_g <= 100',
            name='ck_custom_foods_macros',
        ),
        sa.ForeignKeyConstraint(['user_id'], ['public.users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name_key', name='uq_custom_foods_user_id_name_key'),
        schema='public',
    )
    op.create_table(
        'food_favorites',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('catalog_id', sa.String(length=60), nullable=True),
        sa.Column('custom_food_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            '(catalog_id IS NULL) <> (custom_food_id IS NULL)', name='ck_food_favorites_one_food'
        ),
        sa.ForeignKeyConstraint(['user_id'], ['public.users.id']),
        sa.ForeignKeyConstraint(
            ['custom_food_id'],
            ['public.custom_foods.id'],
            name='fk_food_favorites_custom_food_id',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'catalog_id', name='uq_food_favorites_user_id_catalog_id'),
        sa.UniqueConstraint(
            'user_id', 'custom_food_id', name='uq_food_favorites_user_id_custom_food_id'
        ),
        schema='public',
    )
    op.add_column(
        'meal_items', sa.Column('custom_food_id', sa.Integer(), nullable=True), schema='public'
    )
    op.create_foreign_key(
        'fk_meal_items_custom_food_id',
        'meal_items',
        'custom_foods',
        ['custom_food_id'],
        ['id'],
        source_schema='public',
        referent_schema='public',
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_meal_items_custom_food_id', 'meal_items', ['custom_food_id'], schema='public'
    )
    op.create_check_constraint(
        'ck_meal_items_custom_food_source',
        'meal_items',
        "custom_food_id IS NULL OR source = 'custom'",
        schema='public',
    )
    _backfill_library()


def _backfill_library() -> None:
    # REQ-005: una entrada por usuario y nombre (clave), con los valores del último
    # registro, y todos sus registros vinculados. No aplica el límite de 500.
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT mi.id, m.user_id, mi.name, mi.per_100g_calories_kcal, "
            "mi.per_100g_protein_g, mi.per_100g_carbs_g, mi.per_100g_fat_g "
            "FROM public.meal_items mi JOIN public.meals m ON m.id = mi.meal_id "
            "WHERE mi.source = 'custom' ORDER BY mi.created_at, mi.id"
        )
    ).all()
    groups: dict[tuple, list] = {}
    for row in rows:
        key = _name_key(row.name)
        if key:
            groups.setdefault((row.user_id, key), []).append(row)

    insert = sa.text(
        "INSERT INTO public.custom_foods "
        "(user_id, name, name_key, calories_kcal, protein_g, carbs_g, fat_g) "
        "VALUES (:user_id, :name, :name_key, :calories, :protein, :carbs, :fat) RETURNING id"
    )
    link = sa.text(
        "UPDATE public.meal_items SET custom_food_id = :food_id WHERE id IN :ids"
    ).bindparams(sa.bindparam("ids", expanding=True))
    for (user_id, key), items in groups.items():
        latest = items[-1]
        food_id = bind.execute(
            insert,
            {
                "user_id": user_id,
                "name": latest.name.strip(),
                "name_key": key,
                "calories": latest.per_100g_calories_kcal,
                "protein": latest.per_100g_protein_g,
                "carbs": latest.per_100g_carbs_g,
                "fat": latest.per_100g_fat_g,
            },
        ).scalar()
        bind.execute(link, {"food_id": food_id, "ids": [item.id for item in items]})


def downgrade() -> None:
    op.drop_constraint(
        'ck_meal_items_custom_food_source', 'meal_items', type_='check', schema='public'
    )
    op.drop_index('ix_meal_items_custom_food_id', table_name='meal_items', schema='public')
    op.drop_constraint(
        'fk_meal_items_custom_food_id', 'meal_items', type_='foreignkey', schema='public'
    )
    op.drop_column('meal_items', 'custom_food_id', schema='public')
    # Se pierden los favoritos; los alimentos propios se regeneran con otro upgrade.
    op.drop_table('food_favorites', schema='public')
    op.drop_table('custom_foods', schema='public')
