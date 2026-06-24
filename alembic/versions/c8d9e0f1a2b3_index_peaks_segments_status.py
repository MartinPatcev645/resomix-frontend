"""index peaks_status / segments_status on track_processing_status

The peaks + segments jobs collect their work list by filtering ``peaks_status`` /
``segments_status`` != 'completed' (``_collect_targets``). transcode_status and
embedding_status are already indexed for this; add the matching indexes for the two
playback stages so the per-job rollup/collector stays fast for large playback partners.

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-06-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, Sequence[str], None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "track_processing_status"
_INDEXES = [
    ("ix_tps_peaks_status", "peaks_status"),
    ("ix_tps_segments_status", "segments_status"),
]


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
    for name, col in _INDEXES:
        if not _index_exists(_TABLE, name):
            op.create_index(name, _TABLE, [col])


def downgrade() -> None:
    for name, _col in reversed(_INDEXES):
        if _index_exists(_TABLE, name):
            op.drop_index(name, table_name=_TABLE)
