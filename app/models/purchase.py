"""
Subscription Models
===================

This module defines the UserSubscription SQLAlchemy model for the Resomix application.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class UserSubscription(Base):
    """
    UserSubscription — a **frontend consumer** subscription (separate from B2B Stripe).

    Extended from a stub into the proper consumer subscription: it carries the ``plan_id``
    the user is subscribed to plus lifecycle/period fields. A row exists only for a PAID
    subscription; free users have no row and resolve to ``users.plan_id`` / the default plan.

    Designed now, populated in the paid-billing phase. The effective plan of a user is:
    active subscription's ``plan_id`` → else ``users.plan_id`` → else the default (free) plan.
    A non-``active``/``trialing`` subscription is treated as free (dunning → free).
    """
    __tablename__ = "user_subscriptions"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key (one consumer subscription per user)
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Which plan this subscription grants
    plan_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    # Lifecycle: active | trialing | past_due | canceled | incomplete
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active", index=True)

    # Stripe (consumer account — NOT the B2B Stripe integration)
    stripe_subscription_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    current_period_start: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")

    # Timestamps
    subscribed_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def __repr__(self):
        return f"<UserSubscription(user_id={self.user_id}, plan_id={self.plan_id}, status='{self.status}')>"
