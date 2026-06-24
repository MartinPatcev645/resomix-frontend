"""add_finalizing_at_to_partner_processing_jobs

The terminal result-apply of a transcode/embeddings job (set per-track status, deactivate
failed tracks, finalize the job) is now done in a background Celery task instead of inline
in the admin poll — a 1M-track apply can't run in an HTTP request. The poll CLAIMS the job
by setting ``status='finalizing'`` + ``finalizing_at`` and enqueues the task; this column is
the claim timestamp the poll uses to detect a dead worker (stale 'finalizing') and re-enqueue
the idempotent task.

  • ``finalizing_at``  DATETIME NULL — when the background finalize was claimed.

Revision ID: b7c8d9e0f1a2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "partner_processing_jobs"
_COLUMN = "finalizing_at"


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


def upgrade() -> None:
    if not _column_exists(_TABLE, _COLUMN):
        op.add_column(
            _TABLE,
            sa.Column(_COLUMN, sa.DateTime(), nullable=True,
                      comment="when the background finalize task was claimed (for stale re-enqueue)"),
        )


def downgrade() -> None:
    if _column_exists(_TABLE, _COLUMN):
        op.drop_column(_TABLE, _COLUMN)
