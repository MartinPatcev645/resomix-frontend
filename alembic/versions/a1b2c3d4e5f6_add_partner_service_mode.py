"""add_partner_service_mode

Adds ``partners.service_mode`` — the storage/service plan, orthogonal to ``tier``:

  - similarity_only      (case 1): preview MP3 + embeddings only
  - similarity_playback  (case 2): embeddings + peaks + segments

Existing rows default to 'similarity_only'.

Revision ID: a1b2c3d4e5f6
Revises: 7f2c9a1e4b30
Create Date: 2026-06-08 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7f2c9a1e4b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'partners',
        sa.Column(
            'service_mode',
            sa.Enum('similarity_only', 'similarity_playback', name='partner_service_mode'),
            nullable=False,
            server_default='similarity_only',
            comment=(
                "Storage/service plan. similarity_only (case 1): preview MP3 + "
                "embeddings only. similarity_playback (case 2): embeddings + peaks "
                "+ segments for full playback."
            ),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('partners', 'service_mode')
