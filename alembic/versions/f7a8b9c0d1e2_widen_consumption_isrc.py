"""widen consumption_events.isrc to VARCHAR(30)

The column was created VARCHAR(15) (fits real 12-char ISRCs) but upload tracks use a synthetic
`USER-<18 hex>` ISRC = 23 chars. Inserting stream telemetry for an upload therefore raised
`(1406) Data too long for column 'isrc'`, which rolled back the WHOLE consumption_events batch —
so no play events for any track in that batch were recorded. The ORM model already declares
String(30); this brings the DB column in line. Index membership (idx_agg_isrc, idx_dsrf_report)
and the column comment are preserved by the explicit MODIFY.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COMMENT = "Denormalized heavily for rapid DSRF generation indexing"


def _isrc_length() -> int:
    """Current character_maximum_length of consumption_events.isrc (0 if the table is absent)."""
    bind = op.get_bind()
    row = bind.execute(
        sa.text(
            "SELECT character_maximum_length FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'consumption_events' "
            "AND column_name = 'isrc'"
        )
    ).first()
    return int(row[0]) if row and row[0] is not None else 0


def upgrade() -> None:
    if 0 < _isrc_length() < 30:
        op.execute(
            f"ALTER TABLE consumption_events MODIFY isrc VARCHAR(30) COMMENT '{_COMMENT}'"
        )


def downgrade() -> None:
    # Narrowing back can truncate existing USER-… ISRCs; left as a plain revert on purpose.
    if _isrc_length() > 15:
        op.execute(
            f"ALTER TABLE consumption_events MODIFY isrc VARCHAR(15) COMMENT '{_COMMENT}'"
        )
