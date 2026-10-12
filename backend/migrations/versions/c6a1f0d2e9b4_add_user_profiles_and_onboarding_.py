"""add user_profiles and onboarding

Revision ID: c6a1f0d2e9b4
Revises: b7c1d9e4a2f3
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c6a1f0d2e9b4'
down_revision = 'b7c1d9e4a2f3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('onboarding_completed_at', sa.DateTime(), nullable=True))

    op.create_table('user_profiles',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('gender', sa.String(length=8), nullable=False),
    sa.Column('height_unit', sa.String(length=2), nullable=False),
    sa.Column('height_cm', sa.Float(), nullable=True),
    sa.Column('height_ft', sa.Integer(), nullable=True),
    sa.Column('height_in', sa.Integer(), nullable=True),
    sa.Column('weight_unit', sa.String(length=2), nullable=False),
    sa.Column('weight', sa.Float(), nullable=False),
    sa.Column('activity_level', sa.String(length=16), nullable=False),
    sa.Column('goal', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['public.users.id'], ),
    sa.PrimaryKeyConstraint('user_id'),
    schema='public'
    )


def downgrade():
    op.drop_table('user_profiles', schema='public')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('onboarding_completed_at')
