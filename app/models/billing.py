"""
Consumer Billing Models
=======================

Durable mirror of Stripe consumer-subscription billing (separate from the B2B partner Stripe flow):

  * ``BillingInvoice``      — one row per Stripe invoice → payment history + hosted invoice/PDF links.
  * ``SubscriptionEvent``   — append-only timeline (subscribe / renew / up- / downgrade / cancel / …).
  * ``UsagePeriodHistory``  — per-subject, per-feature, per-billing-period usage snapshot (write-through
                              from the Redis usage counters), so past-period usage survives the TTL.

All subject-keyed where relevant so future partner-managed billing can reuse the same tables.
See docs/CONSUMER_BILLING_PLAN.md.
"""

from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


class BillingInvoice(Base):
    """One row per Stripe invoice for a consumer subscription (populated from ``invoice.*`` webhooks)."""

    __tablename__ = "billing_invoices"
    __table_args__ = (
        Index("ix_billing_invoice_user", "user_id", "created_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stripe_invoice_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    plan_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True
    )

    amount_paid_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    # paid | open | void | uncollectible | draft
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)

    period_start: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    period_end: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)

    hosted_invoice_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    invoice_pdf: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    paid_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<BillingInvoice(user_id={self.user_id}, invoice='{self.stripe_invoice_id}', status='{self.status}')>"


class SubscriptionEvent(Base):
    """Append-only consumer-subscription timeline (populated from subscription/invoice webhooks)."""

    __tablename__ = "subscription_events"
    __table_args__ = (
        Index("ix_sub_event_user", "user_id", "created_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stripe_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    # created | renewed | upgraded | downgraded | canceled | reactivated | payment_failed | past_due
    type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    from_plan_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True
    )
    to_plan_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True
    )
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    effective_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    def __repr__(self) -> str:
        return f"<SubscriptionEvent(user_id={self.user_id}, type='{self.type}')>"


class UsagePeriodHistory(Base):
    """Durable per-subject, per-feature, per-billing-period usage (write-through from the Redis
    counters). ``subject_type`` = 'user' (``users.id`` as string) or 'visitor' (visitor_id hash)."""

    __tablename__ = "usage_period_history"
    __table_args__ = (
        UniqueConstraint(
            "subject_type", "subject_id", "feature_key", "period_start", name="uq_usage_period"
        ),
        Index("ix_usage_period_subject", "subject_type", "subject_id", "period_start"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    subject_type: Mapped[str] = mapped_column(String(10), nullable=False)  # user | visitor
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    plan_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True
    )
    feature_key: Mapped[str] = mapped_column(String(64), nullable=False)

    period_start: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[DateTime] = mapped_column(DateTime, nullable=False)

    used_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    limit_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return (
            f"<UsagePeriodHistory(subject={self.subject_type}:{self.subject_id}, "
            f"feature='{self.feature_key}', used={self.used_count})>"
        )
