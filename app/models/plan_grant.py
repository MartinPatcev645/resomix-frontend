"""
Complimentary Plan Grants
=========================

A time-boxed plan an **admin** gives a user for nothing — a trial, a goodwill gesture, or
compensation. The user pays no money and no Stripe object exists.

Kept apart from both places it might have gone:

* ``users.plan_id`` records the DEFAULT (free) plan. A paid plan sat there grants access that
  nothing can take away, because cancellation, refunds and chargebacks all act on
  ``user_subscriptions``.
* ``user_subscriptions`` is one row per user with a ``NOT NULL UNIQUE`` Stripe id, so a grant and a
  real subscription could not coexist — and they must be able to.

Modelled against ``plans.id`` rather than a plan code, so granting a future plan needs no schema
change. Expiry is read-time: see ``ends_at``.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from . import Base


class GrantReason:
    """Why an account was comped. A class of constants rather than a DB enum: adding a reason
    should be a code change, not a migration."""

    TRIAL = "trial"
    GOODWILL = "goodwill"
    PARTNER = "partner"
    SUPPORT = "support"
    COMPENSATION = "compensation"

    ALL = (TRIAL, GOODWILL, PARTNER, SUPPORT, COMPENSATION)


class UserPlanGrant(Base):
    """One complimentary plan, for one user, between two dates."""

    __tablename__ = "user_plan_grants"
    __table_args__ = (
        # The hot path: "is there a live grant for this user?", asked on every entitlement check.
        Index("ix_grant_user_active", "user_id", "revoked_at", "ends_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False
    )
    # SET NULL: the grant is a fact about the USER and must survive the admin's account being
    # deleted. Losing who granted it is preferable to losing that it happened.
    granted_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(40), nullable=False, server_default=GrantReason.TRIAL)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # Stored as a boundary, not a duration. This is the value enforcement compares against, so
    # there is nothing to re-derive per request and nothing that can disagree with itself.
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Ended early by an admin. Distinct from simply lapsing, which needs no row change at all.
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    plan: Mapped["Plan"] = relationship("Plan", foreign_keys=[plan_id])  # noqa: F821

    def is_live(self, now: Optional[datetime] = None) -> bool:
        """Whether this grant currently confers its plan."""
        now = now or datetime.utcnow()
        return self.revoked_at is None and self.starts_at <= now < self.ends_at

    def __repr__(self) -> str:
        return (
            f"<UserPlanGrant(user={self.user_id}, plan={self.plan_id}, "
            f"until={self.ends_at}, revoked={self.revoked_at is not None})>"
        )
