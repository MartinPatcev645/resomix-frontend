"""add_ingest_log_stage_timeline

Ingestion pipeline v2: adds the fine-grained lifecycle columns to ``ingest_logs``.

  • ``stage``          — fine-grained pipeline stage (see app.services.ingestion_stages).
                          Plain string so new stages need no migration. Indexed
                          because the per-partner concurrency guard filters on it.
  • ``processing_dir`` — the UTC-named ``processing/<dt>`` folder for this batch
                          (the link the later embedding job uses).
  • ``stage_timeline`` — JSON ``{stage: utc_iso}`` map mirrored into logs.json.

All nullable; the coarse ``status`` column is unchanged.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (column name, SQLAlchemy type, comment)
_COLUMNS = [
    ("stage", sa.String(length=40), "Fine-grained ingestion pipeline stage; NULL for legacy rows"),
    ("processing_dir", sa.String(length=255), "UTC-named processing/<dt> folder for this batch"),
    ("stage_timeline", mysql.JSON(), "{stage: utc_iso} timeline, mirrored to logs.json"),
]


def _column_exists(table: str, column: str) -> bool:
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


def _index_exists(table: str, index: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() "
                "AND table_name = :t AND index_name = :i"
            ),
            {"t": table, "i": index},
        ).first()
    )


def upgrade() -> None:
    """Idempotent: add each column / index only if not already present."""
    for name, coltype, comment in _COLUMNS:
        if not _column_exists("ingest_logs", name):
            op.add_column("ingest_logs", sa.Column(name, coltype, nullable=True, comment=comment))
    if not _index_exists("ingest_logs", "ix_ingest_logs_stage"):
        op.create_index("ix_ingest_logs_stage", "ingest_logs", ["stage"])


def downgrade() -> None:
    if _index_exists("ingest_logs", "ix_ingest_logs_stage"):
        op.drop_index("ix_ingest_logs_stage", table_name="ingest_logs")
    for name, _coltype, _comment in reversed(_COLUMNS):
        if _column_exists("ingest_logs", name):
            op.drop_column("ingest_logs", name)
