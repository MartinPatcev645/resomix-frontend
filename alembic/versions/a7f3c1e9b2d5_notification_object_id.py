"""billing_notifications.stripe_object_id — which Stripe object a message was about

The id is already inside ``dedupe_key`` (``cancelled:sub_123:2027-03-14``), but only as a substring,
so finding "everything we have told this customer about THIS subscription" meant a ``LIKE`` prefix
scan. This makes it an indexed equality lookup.

What needs it: a customer who reverses a cancellation should be told their subscription is back —
but "not cancelling" is equally true of every ordinary renewal, so that state alone cannot be the
trigger. The real question is whether we previously sent them a cancellation notice for this
subscription, which is a lookup on (stripe_object_id, template).

Additive and nullable; rows written before this migration keep their id inside ``dedupe_key`` and
simply do not match the new lookup. The only consequence is that a cancellation notified before
this deploy will not produce a resume confirmation — correct behaviour degrades to silence rather
than to a wrong message.

Revision ID: a7f3c1e9b2d5
Revises: c9e2a7d4f1b8
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "a7f3c1e9b2d5"
down_revision = "c9e2a7d4f1b8"
branch_labels = None
depends_on = None

_TABLE = "billing_notifications"
_INDEX = "ix_billing_notification_object"


def _columns(conn, table: str) -> set:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()}


def _indexes(conn, table: str) -> set:
    return {r[2] for r in conn.execute(text(f"SHOW INDEX FROM `{table}`")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if "stripe_object_id" not in _columns(conn, _TABLE):
        op.add_column(
            _TABLE,
            sa.Column(
                "stripe_object_id",
                sa.String(length=255),
                nullable=True,
                comment="Stripe object this message was about: sub_… / ch_… / dp_…",
            ),
        )
    if _INDEX not in _indexes(conn, _TABLE):
        op.create_index(_INDEX, _TABLE, ["stripe_object_id"])


def downgrade() -> None:
    conn = op.get_bind()
    if _INDEX in _indexes(conn, _TABLE):
        op.drop_index(_INDEX, table_name=_TABLE)
    if "stripe_object_id" in _columns(conn, _TABLE):
        op.drop_column(_TABLE, "stripe_object_id")
