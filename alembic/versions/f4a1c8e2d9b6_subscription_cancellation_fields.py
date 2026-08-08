"""cancellation state on user_subscriptions — cancel_at, ended_at, cancellation_reason

WHY THESE THREE

``cancel_at_period_end`` alone cannot describe a cancellation, and relying on it produced a profile
screen that told paying customers their subscription would **renew** after they had cancelled it.

Two mechanisms make the boolean insufficient:

1. Stripe sets ``canceled_at`` the moment a cancel-at-period-end is *requested* — not when the
   subscription finally ends. A row can therefore be mid-cancellation with the boolean still false
   for a beat, and any screen branching on the boolean alone falls through to "renews".

2. Every founding subscriber has an active **subscription schedule** attached (22 monthly phases or
   2 yearly — see ``BillingService.apply_founding_lock``). Cancellation of a schedule-managed
   subscription is expressed as a ``cancel_at`` timestamp and/or an amendment to the schedule's
   ``end_behavior``, not as a flip of ``cancel_at_period_end``. We had nowhere to put that
   timestamp, so it was discarded on arrival.

``cancel_at``          — Stripe's own boundary: when access is scheduled to stop. Distinct from
                         ``current_period_end``, which for a schedule-managed subscription can be
                         the end of a *phase* rather than the end of the subscription.
``ended_at``           — when access actually stopped. Distinguishes "cancelled, still running"
                         from "over", which ``status`` alone blurs during the gap.
``cancellation_reason``— Stripe's ``cancellation_details.reason``, plus our own values for the
                         cases Stripe has no vocabulary for (``refunded``, ``disputed``). This is
                         what selects the notification template and what support reads first.

All three are nullable and additive: no backfill, no downtime, nothing existing changes meaning.
An unmigrated row simply has NULLs, which every reader treats as "no cancellation recorded" — the
same answer it gives today.

Guarded and reversible: each step checks for its own presence, so a partial re-run cannot fail on a
column that is already there.

Revision ID: f4a1c8e2d9b6
Revises: a9d0e1f2b3c4
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "f4a1c8e2d9b6"
down_revision = "a9d0e1f2b3c4"
branch_labels = None
depends_on = None

_TABLE = "user_subscriptions"


def _columns(conn, table: str) -> set:
    rows = conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()
    return {r[0] for r in rows}


def upgrade() -> None:
    conn = op.get_bind()
    existing = _columns(conn, _TABLE)

    if "cancel_at" not in existing:
        op.add_column(
            _TABLE,
            sa.Column(
                "cancel_at",
                sa.DateTime(),
                nullable=True,
                comment="Stripe's cancellation boundary — when access is scheduled to stop",
            ),
        )

    if "ended_at" not in existing:
        op.add_column(
            _TABLE,
            sa.Column(
                "ended_at",
                sa.DateTime(),
                nullable=True,
                comment="When access actually stopped (subscription fully ended)",
            ),
        )

    if "cancellation_reason" not in existing:
        op.add_column(
            _TABLE,
            sa.Column(
                "cancellation_reason",
                sa.String(length=40),
                nullable=True,
                comment="cancellation_requested | payment_failed | payment_disputed | refunded | disputed | admin",
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    existing = _columns(conn, _TABLE)

    for column in ("cancellation_reason", "ended_at", "cancel_at"):
        if column in existing:
            op.drop_column(_TABLE, column)
