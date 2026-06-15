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


def _column_exists(table: str, column: str) -> bool:
    """True if ``table.column`` already exists in the current database."""
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() "
                "AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def upgrade() -> None:
    """Upgrade schema.

    Idempotent: the initial-schema migration (``new_database.sql``) already
    creates ``partners.service_mode``, so on a fresh DB this column is present
    and a plain ``add_column`` would fail with
    ``(1060, "Duplicate column name 'service_mode'")``. Skip the add when the
    column is already there.
    """
    if _column_exists('partners', 'service_mode'):
        return
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
    if not _column_exists('partners', 'service_mode'):
        return
    op.drop_column('partners', 'service_mode')
