"""add_playlist_has_custom_cover

Adds ``playlists.has_custom_cover`` — True once the owner uploads a custom cover (stored on the
media server by playlist uuid). Drives the frontend cover source: custom → seed-track cover →
bundled default. Existing rows default to 0 (no custom cover).

Revision ID: c3e4f5a6b7d8
Revises: b2d3e4f5a6c7
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e4f5a6b7d8'
down_revision: Union[str, Sequence[str], None] = 'b2d3e4f5a6c7'
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
    """Upgrade schema."""
    if _column_exists('playlists', 'has_custom_cover'):
        return
    op.add_column(
        'playlists',
        sa.Column(
            'has_custom_cover',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('0'),
            comment="True once the owner uploads a custom playlist cover (stored on the media server by playlist uuid).",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    if not _column_exists('playlists', 'has_custom_cover'):
        return
    op.drop_column('playlists', 'has_custom_cover')
