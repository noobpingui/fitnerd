"""drop catalog, favorites and weekly plan

Revision ID: f2c4e6a8b0d1
Revises: d8e4b2a7c1f5
Create Date: 2026-10-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f2c4e6a8b0d1'
down_revision = 'd8e4b2a7c1f5'
branch_labels = None
depends_on = None


def upgrade():
    # Orden inverso de dependencias. Los índices y las FK caen con cada tabla.
    # Sin IF EXISTS: si falta una tabla, es mejor que falle y avise.
    op.drop_table('weekly_plan_entries', schema='public')
    op.drop_table('exercise_favorites', schema='public')
    op.drop_table('exercises', schema='public')
    op.drop_table('exercise_categories', schema='public')
    op.drop_table('body_regions', schema='public')


def downgrade():
    """Recrea las cinco tablas VACÍAS con la estructura de d8e4b2a7c1f5.

    Los datos no vuelven: solo se recuperan desde la copia de seguridad.
    """
    op.create_table(
        'body_regions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        schema='public',
    )
    op.create_table(
        'exercise_categories',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('body_region_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['body_region_id'], ['public.body_regions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        schema='public',
    )
    op.create_index(
        'ix_public_exercise_categories_body_region_id',
        'exercise_categories',
        ['body_region_id'],
        unique=False,
        schema='public',
    )
    op.create_table(
        'exercises',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('category_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('video_url', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['public.exercise_categories.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category_id', 'name', name='uq_category_exercise_name'),
        schema='public',
    )
    op.create_index(
        'ix_public_exercises_category_id',
        'exercises',
        ['category_id'],
        unique=False,
        schema='public',
    )
    op.create_table(
        'exercise_favorites',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('exercise_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['exercise_id'], ['public.exercises.id']),
        sa.ForeignKeyConstraint(['user_id'], ['public.users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'exercise_id', name='uq_user_exercise_favorite'),
        schema='public',
    )
    op.create_index(
        'ix_public_exercise_favorites_user_id',
        'exercise_favorites',
        ['user_id'],
        unique=False,
        schema='public',
    )
    op.create_index(
        'ix_public_exercise_favorites_exercise_id',
        'exercise_favorites',
        ['exercise_id'],
        unique=False,
        schema='public',
    )
    op.create_table(
        'weekly_plan_entries',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('exercise_id', sa.Uuid(), nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['exercise_id'], ['public.exercises.id']),
        sa.ForeignKeyConstraint(['user_id'], ['public.users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'exercise_id', 'day_of_week', name='uq_user_exercise_day'),
        schema='public',
    )
    op.create_index(
        'ix_public_weekly_plan_entries_user_id',
        'weekly_plan_entries',
        ['user_id'],
        unique=False,
        schema='public',
    )
    op.create_index(
        'ix_public_weekly_plan_entries_exercise_id',
        'weekly_plan_entries',
        ['exercise_id'],
        unique=False,
        schema='public',
    )
