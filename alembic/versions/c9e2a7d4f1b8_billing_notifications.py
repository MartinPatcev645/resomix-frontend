"""billing_notifications — one row per billing email sent, keyed by state not by event

WHY A TABLE AND NOT A FLAG

``WebhookService`` already drops a repeat *delivery* of the same Stripe event (dedupe by
``stripe_event_id`` against ``system_logs``). What it cannot drop is Stripe emitting **several
distinct events for one real-world change**: setting a subscription to cancel typically produces
two or three ``customer.subscription.updated`` events within seconds, each with its own id, each
passing that dedupe. Without a second guard the customer receives three identical cancellation
emails.

The unique key is therefore on ``dedupe_key``, which describes the *state*
(``cancelled:sub_123:2027-03-14``) rather than the message that reported it. A genuinely new change
produces a new key and sends again, which is what someone who cancels, resumes, then cancels again
should receive.

``user_id`` is ``SET NULL`` rather than ``CASCADE`` on purpose: "did we tell them?" is the first
question in any billing dispute, and the answer must outlive the account. ``recipient_email`` is
denormalised for the same reason.

Additive: one new table, nothing existing is touched. Guarded so a partial re-run cannot fail.

Revision ID: c9e2a7d4f1b8
Revises: f4a1c8e2d9b6
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "c9e2a7d4f1b8"
down_revision = "f4a1c8e2d9b6"
branch_labels = None
depends_on = None

_TABLE = "billing_notifications"


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        return

    op.create_table(
        _TABLE,
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
        sa.Column(
            "user_id",
            mysql.INTEGER(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "dedupe_key",
            sa.String(length=255),
            nullable=False,
            comment="State this email reported, e.g. cancelled:sub_123:2027-03-14",
        ),
        sa.Column(
            "template",
            sa.String(length=60),
            nullable=False,
            index=True,
            comment="Template stem without .html",
        ),
        sa.Column(
            "recipient_email",
            sa.String(length=100),
            nullable=False,
            comment="Denormalised so the audit trail survives account deletion",
        ),
        sa.Column("stripe_event_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="sent"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("dedupe_key", name="uq_billing_notification_dedupe"),
        sa.Index("ix_billing_notification_user", "user_id", "created_at"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        op.drop_table(_TABLE)
