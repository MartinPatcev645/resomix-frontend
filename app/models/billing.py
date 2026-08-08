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


class BillingConsent(Base):
    """One row per consent given before a Checkout session (pricing v2.1 §5.5).

    EU consumers have a 14-day withdrawal right on digital services. Access starts immediately, so
    the buyer must actively agree to begin before that period ends — and we must be able to show,
    later, *what* they agreed to and *when*.

    Deliberately an append-only audit row, never a boolean on ``users``. A flag answers "did they
    consent?" and nothing else; it cannot answer "to which version of the terms?", which is the only
    question that matters once the documents have been revised. Rows are never updated or deleted:
    a second purchase writes a second row.
    """

    __tablename__ = "billing_consents"
    __table_args__ = (
        Index("idx_user_type", "user_id", "consent_type"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 'withdrawal_waiver' today. A string rather than an enum so a new consent type is a data
    # change, not a migration.
    consent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    # Which documents were agreed to, e.g. "tos:2026-07-01,privacy:2026-07-01".
    doc_versions: Mapped[str] = mapped_column(String(60), nullable=False)
    ip: Mapped[str] = mapped_column(String(45), nullable=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return f"<BillingConsent(user={self.user_id}, type='{self.consent_type}', at={self.created_at})>"


class BillingNotification(Base):
    """One row per billing email we have sent — and the thing that stops us sending it twice.

    WHY THIS EXISTS

    ``WebhookService`` already drops a *repeat delivery* of the same Stripe event (dedupe by
    ``stripe_event_id`` against ``system_logs``), so retries are covered. This table solves the
    other half: Stripe emits **several distinct events for one real-world change**. Setting a
    subscription to cancel typically produces two or three ``customer.subscription.updated`` events
    within seconds, each with its own id, each passing the event-level dedupe. Without a second
    guard the customer receives three identical "your subscription is cancelled" emails.

    So the key is the **state**, not the event: ``dedupe_key`` describes what happened
    (``cancelled:sub_123:2027-03-14``), not which message told us about it. A genuinely new
    change produces a new key and sends again — someone who cancels, resumes, and cancels a month
    later gets two emails, which is correct.

    Also the audit trail: "did we tell them?" is the first question in any billing dispute, and
    ``recipient_email`` is denormalised so the answer survives the account being deleted.
    """

    __tablename__ = "billing_notifications"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_billing_notification_dedupe"),
        Index("ix_billing_notification_user", "user_id", "created_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    # SET NULL, not CASCADE: the record that we notified someone must outlive their account, or a
    # purged user takes the evidence with them.
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # e.g. "cancelled:sub_123:2027-03-14T00:00:00" — see the class docstring.
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    # Template stem, without the .html: subscription_cancelled | subscription_refunded | …
    template: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    recipient_email: Mapped[str] = mapped_column(String(100), nullable=False)
    stripe_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # sent | failed. A failed row is kept: it holds the dedupe key, and a bounce that retried
    # forever would be worse than one that did not arrive.
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="sent")

    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return f"<BillingNotification(user={self.user_id}, template='{self.template}', status='{self.status}')>"
