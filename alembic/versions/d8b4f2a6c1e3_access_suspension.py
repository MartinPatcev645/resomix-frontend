"""user_subscriptions.access_suspended_at — reversible revocation we own

WHY THIS CANNOT BE A `status` VALUE

When a bank opens a chargeback the customer must lose access immediately, but the subscription is
not cancelled: if we win the dispute they get everything back. The obvious implementation — write
``status = 'disputed'`` — silently fails, because Stripe keeps the subscription **active** for the
whole dispute and the next ``customer.subscription.updated`` mirrors that status straight back over
ours. Access would return within seconds and stay returned.

``status`` is an honest mirror of Stripe and nothing else writes to it. Suspension is *our*
decision about *our* product, so it gets its own column that no sync path touches. Cleared only by
``charge.dispute.closed`` with status ``won``.

``EntitlementService.get_effective_plan`` adds ``access_suspended_at IS NULL`` to the clause that
already filters on status. NULL means "not suspended", so every existing row keeps its access with
no backfill.

A full refund does NOT use this: there the subscription really is cancelled, in Stripe as well as
here, and `status` alone is the correct and durable answer.

Revision ID: d8b4f2a6c1e3
Revises: a7f3c1e9b2d5
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "d8b4f2a6c1e3"
down_revision = "a7f3c1e9b2d5"
branch_labels = None
depends_on = None

_TABLE = "user_subscriptions"


def _columns(conn, table: str) -> set:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    existing = _columns(conn, _TABLE)

    if "access_suspended_at" not in existing:
        op.add_column(
            _TABLE,
            sa.Column(
                "access_suspended_at",
                sa.DateTime(),
                nullable=True,
                comment="Access revoked by us (chargeback) while the subscription stays live in Stripe",
            ),
        )

    if "access_suspended_reason" not in existing:
        op.add_column(
            _TABLE,
            sa.Column(
                "access_suspended_reason",
                sa.String(length=40),
                nullable=True,
                comment="disputed — why access was revoked; support reads this first",
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    existing = _columns(conn, _TABLE)
    for column in ("access_suspended_reason", "access_suspended_at"):
        if column in existing:
            op.drop_column(_TABLE, column)
