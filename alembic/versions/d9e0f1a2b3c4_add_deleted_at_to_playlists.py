"""add deleted_at soft-delete column to playlists

Playlists gain a nullable ``deleted_at`` marker so a user can delete a playlist without
destroying the row (needed for history + quota reconciliation, and so a track deletion can
soft-delete the similarity playlist it seeded). User-facing reads filter ``deleted_at IS NULL``;
an index keeps that filter cheap.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-07-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9e0f1a2b3c4'
down_revision: Union[str, Sequence[str], None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "playlists"
_COLUMN = "deleted_at"
_INDEX = "ix_playlists_deleted_at"


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def _index_exists(table: str, index: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i"
            ),
            {"t": table, "i": index},
        ).first()
    )


def upgrade() -> None:
    if not _column_exists(_TABLE, _COLUMN):
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.DateTime(), nullable=True))
    if not _index_exists(_TABLE, _INDEX):
        op.create_index(_INDEX, _TABLE, [_COLUMN])


def downgrade() -> None:
    if _index_exists(_TABLE, _INDEX):
        op.drop_index(_INDEX, table_name=_TABLE)
    if _column_exists(_TABLE, _COLUMN):
        op.drop_column(_TABLE, _COLUMN)
