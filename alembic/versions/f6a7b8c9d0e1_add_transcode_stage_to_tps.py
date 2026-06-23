"""add_transcode_stage_to_track_processing_status

Pipeline redesign: transcoding becomes a first-class, tracked background job (raw ->
128k mp3) that the embedding/peaks/segments jobs consume. ``track_processing_status``
already tracks embedding/peaks/segments per track; this adds the missing **transcode**
stage columns so the same per-track state machine + per-job rollups cover it.

  • ``transcode_status``        VARCHAR(20) NOT NULL DEFAULT 'pending' (indexed for rollups)
  • ``transcode_error``         TEXT NULL
  • ``transcode_completed_at``  DATETIME NULL

Backfill: any row that already has an embedding outcome (completed|failed) was, by
definition, transcoded first — so mark those rows transcode='completed' (this covers the
~48k open tracks already loaded, which would otherwise show as transcode-pending forever).

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "track_processing_status"

# (column name, SQLAlchemy type, nullable, server_default, comment)
_COLUMNS = [
    ("transcode_status", sa.String(length=20), False, "pending", "raw->mp3 transcode stage state"),
    ("transcode_error", mysql.TEXT(), True, None, "transcode failure message"),
    ("transcode_completed_at", sa.DateTime(), True, None, "transcode completion timestamp"),
]


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
    """Idempotent: add each column / index / backfill only if needed."""
    for name, coltype, nullable, default, comment in _COLUMNS:
        if not _column_exists(_TABLE, name):
            op.add_column(
                _TABLE,
                sa.Column(name, coltype, nullable=nullable,
                          server_default=(sa.text(f"'{default}'") if default is not None else None),
                          comment=comment),
            )
    if not _index_exists(_TABLE, "ix_tps_transcode_status"):
        op.create_index("ix_tps_transcode_status", _TABLE, ["transcode_status"])

    # Backfill: embedding outcome implies the mp3 existed → transcode was completed.
    op.execute(
        f"UPDATE {_TABLE} "
        "SET transcode_status='completed', "
        "    transcode_completed_at=COALESCE(transcode_completed_at, embedding_completed_at, NOW()) "
        "WHERE transcode_status='pending' AND embedding_status IN ('completed','failed')"
    )


def downgrade() -> None:
    if _index_exists(_TABLE, "ix_tps_transcode_status"):
        op.drop_index("ix_tps_transcode_status", table_name=_TABLE)
    for name, _coltype, _nullable, _default, _comment in reversed(_COLUMNS):
        if _column_exists(_TABLE, name):
            op.drop_column(_TABLE, name)
