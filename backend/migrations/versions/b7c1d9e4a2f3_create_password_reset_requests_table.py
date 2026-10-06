"""create password_reset_requests table

Revision ID: b7c1d9e4a2f3
Revises: e28ebf553c7d
Create Date: 2026-10-05 22:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c1d9e4a2f3'
down_revision = 'e28ebf553c7d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('password_reset_requests',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('client_ip', sa.String(length=45), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('token_hash', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('invalidated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['public.users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash'),
    schema='public'
    )
    with op.batch_alter_table('password_reset_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_public_password_reset_requests_client_ip_created_at'), ['client_ip', 'created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_public_password_reset_requests_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_public_password_reset_requests_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('password_reset_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_public_password_reset_requests_user_id'))
        batch_op.drop_index(batch_op.f('ix_public_password_reset_requests_email'))
        batch_op.drop_index(batch_op.f('ix_public_password_reset_requests_client_ip_created_at'))

    op.drop_table('password_reset_requests', schema='public')
