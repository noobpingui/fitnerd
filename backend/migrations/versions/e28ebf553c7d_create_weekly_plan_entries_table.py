"""create weekly plan entries table

Revision ID: e28ebf553c7d
Revises: 98514a83802d
Create Date: 2026-08-30 23:15:24.605800

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e28ebf553c7d'
down_revision = '98514a83802d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('weekly_plan_entries',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('exercise_id', sa.Uuid(), nullable=False),
    sa.Column('day_of_week', sa.SmallInteger(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['exercise_id'], ['public.exercises.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['public.users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'exercise_id', 'day_of_week', name='uq_user_exercise_day'),
    schema='public'
    )
    with op.batch_alter_table('weekly_plan_entries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_public_weekly_plan_entries_exercise_id'), ['exercise_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_public_weekly_plan_entries_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('weekly_plan_entries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_public_weekly_plan_entries_user_id'))
        batch_op.drop_index(batch_op.f('ix_public_weekly_plan_entries_exercise_id'))

    op.drop_table('weekly_plan_entries', schema='public')
