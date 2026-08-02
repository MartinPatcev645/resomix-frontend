"""record the similarity sibling's outcome on the analysis row

The analysis screen's "Find similar tracks" CTA opens the upload's sibling similarity playlist. That
playlist is produced by a best-effort Celery task (`generate_similarity_sibling`) that runs
independently of the analysis job, so when the analysis reports "succeeded" the playlist may not
exist yet.

Until now the only signal the client had was whether `playlist_uuid` appeared on the status doc, and
its absence is ambiguous across three states that need different UI:

  * the task is still queued or running          -> keep waiting, show progress
  * the task ran but produced no playlist        -> nothing to wait for (no resolvable similar
                                                    catalogue tracks, or the seed didn't resolve)
  * the task failed                              -> nothing to wait for

Because the client could not tell them apart it either polled forever or gave up on a playlist that
was about to arrive. This column records the outcome so the status endpoint can state it plainly.

Values: pending | ready | unavailable | failed. Nullable — rows written before this migration have
no recorded outcome, and the status endpoint falls back to inferring from `playlist_uuid` for them.

Idempotent: the column is only added if missing, so re-running is safe.

Revision ID: b4e5a6c7d8f9
Revises: a2d3f4b5c6e7
Create Date: 2026-08-01
"""
from alembic import op
import sqlalchemy as sa


revision = "b4e5a6c7d8f9"
down_revision = "a2d3f4b5c6e7"
branch_labels = None
depends_on = None


TABLE = "track_analysis_results"
COLUMN = "sibling_playlist_state"


def _has_column(bind, table: str, column: str) -> bool:
    row = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).scalar()
    return bool(row)


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, TABLE, COLUMN):
        op.add_column(TABLE, sa.Column(COLUMN, sa.String(length=16), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, TABLE, COLUMN):
        op.drop_column(TABLE, COLUMN)
