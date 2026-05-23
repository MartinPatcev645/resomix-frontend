"""add_stripe_columns

Revision ID: ef7999c3c2ca
Revises: b4d71a1d2df0
Create Date: 2026-05-23 06:28:26.645333

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef7999c3c2ca'
down_revision: Union[str, Sequence[str], None] = 'b4d71a1d2df0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('partners', sa.Column('stripe_customer_id', sa.String(length=255), nullable=True))
    op.add_column('partners', sa.Column('stripe_subscription_id', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_partner_stripe_customer', 'partners', ['stripe_customer_id'])
    op.create_unique_constraint('uq_partner_stripe_subscription', 'partners', ['stripe_subscription_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_partner_stripe_subscription', 'partners', type_='unique')
    op.drop_constraint('uq_partner_stripe_customer', 'partners', type_='unique')
    op.drop_column('partners', 'stripe_subscription_id')
    op.drop_column('partners', 'stripe_customer_id')
