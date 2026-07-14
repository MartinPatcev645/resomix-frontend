"""consumer billing: plan_prices, billing_invoices, subscription_events, usage_period_history
+ user_subscriptions Stripe-mirror columns

All additive/idempotent. Backs the consumer Stripe subscription billing (see
docs/CONSUMER_BILLING_PLAN.md). Nothing existing changes behaviour.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = :t"
            ),
            {"t": table},
        ).first()
    )


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
    # 1) plan_prices — data-driven Stripe price mapping per (plan, interval, currency).
    if not _table_exists("plan_prices"):
        op.create_table(
            "plan_prices",
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("interval", sa.String(length=10), nullable=False, server_default="month"),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
            sa.Column("unit_amount_cents", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("stripe_price_id", sa.String(length=255), nullable=False),
            sa.Column("stripe_product_id", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("updated_by", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("plan_id", "interval", "currency", name="uq_plan_price_cycle_ccy"),
            sa.UniqueConstraint("stripe_price_id", name="uq_plan_price_stripe"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index("ix_plan_prices_plan", "plan_prices", ["plan_id"])
        op.create_index("ix_plan_prices_active", "plan_prices", ["is_active"])

    # 2) billing_invoices — payment history + hosted invoice/PDF links.
    if not _table_exists("billing_invoices"):
        op.create_table(
            "billing_invoices",
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("stripe_invoice_id", sa.String(length=255), nullable=False),
            sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
            sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("amount_paid_cents", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("period_start", sa.DateTime(), nullable=True),
            sa.Column("period_end", sa.DateTime(), nullable=True),
            sa.Column("hosted_invoice_url", sa.String(length=512), nullable=True),
            sa.Column("invoice_pdf", sa.String(length=512), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("paid_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("stripe_invoice_id", name="uq_billing_invoice_stripe"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index("ix_billing_invoice_user", "billing_invoices", ["user_id", "created_at"])
        op.create_index("ix_billing_invoice_sub", "billing_invoices", ["stripe_subscription_id"])
        op.create_index("ix_billing_invoice_status", "billing_invoices", ["status"])

    # 3) subscription_events — append-only timeline.
    if not _table_exists("subscription_events"):
        op.create_table(
            "subscription_events",
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("stripe_event_id", sa.String(length=255), nullable=True),
            sa.Column("type", sa.String(length=30), nullable=False),
            sa.Column("from_plan_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("to_plan_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("currency", sa.String(length=3), nullable=True),
            sa.Column("amount_cents", sa.Integer(), nullable=True),
            sa.Column("effective_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["from_plan_id"], ["plans.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["to_plan_id"], ["plans.id"], ondelete="SET NULL"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index("ix_sub_event_user", "subscription_events", ["user_id", "created_at"])
        op.create_index("ix_sub_event_type", "subscription_events", ["type"])
        op.create_index("ix_sub_event_stripe", "subscription_events", ["stripe_event_id"])

    # 4) usage_period_history — durable per-period usage snapshots.
    if not _table_exists("usage_period_history"):
        op.create_table(
            "usage_period_history",
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("subject_type", sa.String(length=10), nullable=False),
            sa.Column("subject_id", sa.String(length=64), nullable=False),
            sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("feature_key", sa.String(length=64), nullable=False),
            sa.Column("period_start", sa.DateTime(), nullable=False),
            sa.Column("period_end", sa.DateTime(), nullable=False),
            sa.Column("used_count", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("limit_value", sa.Integer(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="SET NULL"),
            sa.UniqueConstraint(
                "subject_type", "subject_id", "feature_key", "period_start", name="uq_usage_period"
            ),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index(
            "ix_usage_period_subject", "usage_period_history",
            ["subject_type", "subject_id", "period_start"],
        )

    # 5) user_subscriptions — add Stripe-mirror columns (idempotent).
    if _table_exists("user_subscriptions"):
        if not _column_exists("user_subscriptions", "stripe_price_id"):
            op.add_column("user_subscriptions", sa.Column("stripe_price_id", sa.String(length=255), nullable=True))
        if not _column_exists("user_subscriptions", "currency"):
            op.add_column("user_subscriptions", sa.Column("currency", sa.String(length=3), nullable=True))
        if not _column_exists("user_subscriptions", "canceled_at"):
            op.add_column("user_subscriptions", sa.Column("canceled_at", sa.DateTime(), nullable=True))
        if not _column_exists("user_subscriptions", "trial_end"):
            op.add_column("user_subscriptions", sa.Column("trial_end", sa.DateTime(), nullable=True))


def downgrade() -> None:
    for col in ("trial_end", "canceled_at", "currency", "stripe_price_id"):
        if _table_exists("user_subscriptions") and _column_exists("user_subscriptions", col):
            op.drop_column("user_subscriptions", col)
    for tbl in ("usage_period_history", "subscription_events", "billing_invoices", "plan_prices"):
        if _table_exists(tbl):
            op.drop_table(tbl)
