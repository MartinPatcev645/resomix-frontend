"""users.anonymized_at — the dividing line between restorable and gone

WHY

Account deletion is two steps: a user's request deactivates the account, and an admin later runs
the scrub. Between those two points the account is fully restorable; after the scrub there is
nothing left to restore. Every screen and every guard needs to know which side of that line an
account is on, and until now nothing recorded it.

WHY NOT INFER IT

The scrub rewrites the email to `deleted+<id>@resomix.invalid`, so it is tempting to detect the
state by matching that pattern. Two reasons not to:

* inferring identity state from a string pattern breaks the moment someone legitimately registers
  a lookalike address, and it fails silently rather than loudly;
* it answers *whether* but never *when*, and "when" is what an admin needs in order to answer a
  data subject asking on what date their request was completed — which Art. 12(3) obliges us to be
  able to do.

Nullable, and NULL for every existing row. That is correct: nothing has been scrubbed yet. Indexed
because the admin queue filters on it (pending requests are exactly `deletion_requested_at IS NOT
NULL AND anonymized_at IS NULL`).

Idempotent, like the migrations either side of it — re-running on a database that already has the
column is a no-op rather than an error.

Revision ID: d3f7a1c5e982
Revises: a5c8e1d3f7b2
Create Date: 2026-08-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "d3f7a1c5e982"
down_revision = "a5c8e1d3f7b2"
branch_labels = None
depends_on = None

TABLE = "users"
COLUMN = "anonymized_at"
INDEX = "ix_users_anonymized_at"


def _columns(conn) -> set:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{TABLE}`")).fetchall()}


def _indexes(conn) -> set:
    return {r[2] for r in conn.execute(text(f"SHOW INDEX FROM `{TABLE}`")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()

    if COLUMN not in _columns(conn):
        op.add_column(
            TABLE,
            sa.Column(
                COLUMN,
                sa.DateTime(),
                nullable=True,
                comment="When the account scrub ran. NULL = never scrubbed, still restorable.",
            ),
        )
        print(f"Added {TABLE}.{COLUMN}.")

    if INDEX not in _indexes(conn):
        op.create_index(INDEX, TABLE, [COLUMN])
        print(f"Added index {INDEX}.")


def downgrade() -> None:
    conn = op.get_bind()

    if INDEX in _indexes(conn):
        op.drop_index(INDEX, table_name=TABLE)
    if COLUMN in _columns(conn):
        op.drop_column(TABLE, COLUMN)
