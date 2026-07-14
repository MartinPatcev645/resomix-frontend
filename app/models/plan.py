"""
Plan & Entitlement Models
=========================

The data-driven entitlement backbone for **frontend consumer users + guests** (System
Partner 1). Separates *what you are/sell* (``Plan``) from *what you can do*
(``Feature`` + ``PlanEntitlement``), so adding a capability or tier later is a data
change — not a migration.

  * ``Feature``          — the catalog of switchable/limitable capabilities (keys).
  * ``Plan``             — a tier (guest, free, basic, pro, max). Guest & free are real rows.
  * ``PlanEntitlement``  — plan × feature → typed value (the table admin edits).
  * ``EntitlementOverride`` — per-user / per-guest comp / promo / penalty (highest precedence).

Enforcement is server-authoritative; these tables are the source of truth for limits.
B2B partners are unaffected (they keep their own partner/quota system).

Version: 1.0.0
Init Date: July 4, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional

from sqlalchemy import String, Boolean, ForeignKey, DateTime, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base

# value_type values a Feature may declare (kept app-level, not a SQL enum, so adding a
# new type never needs an enum ALTER).
FEATURE_VALUE_TYPES = ("int", "bool", "enum", "csv")
# window values for counted features (how usage resets). "monthly" = per-subject billing anchor
# (subscriber = Stripe cycle, free = signup anniversary, guest = calendar month).
FEATURE_WINDOWS = ("none", "daily", "monthly", "rolling_24h", "total")


class Feature(Base):
    """A single switchable/limitable capability (the extensibility seam)."""

    __tablename__ = "features"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="int")  # FEATURE_VALUE_TYPES
    window: Mapped[str] = mapped_column(String(20), nullable=False, default="none")     # FEATURE_WINDOWS
    default_value: Mapped[str] = mapped_column(String(255), nullable=False, default="0")
    description: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    entitlements: Mapped[List["PlanEntitlement"]] = relationship("PlanEntitlement", back_populates="feature")

    def __repr__(self) -> str:
        return f"<Feature(key='{self.key}', type='{self.value_type}', window='{self.window}')>"


class Plan(Base):
    """A subscription/access tier. Guest & free are real (price 0) rows."""

    __tablename__ = "plans"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)  # guest|free|basic|pro|max
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    price_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    billing_interval: Mapped[str] = mapped_column(String(10), nullable=False, default="none")  # none|month|year

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)   # exactly one true = free default
    is_assignable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # guest = false
    sort_order: Mapped[int] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=False, default=0)

    # Bumped on any entitlement edit for this plan → busts the Redis entitlement cache.
    entitlements_version: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=1)

    updated_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    entitlements: Mapped[List["PlanEntitlement"]] = relationship(
        "PlanEntitlement", back_populates="plan", cascade="all, delete-orphan"
    )
    prices: Mapped[List["PlanPrice"]] = relationship(
        "PlanPrice", back_populates="plan", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Plan(code='{self.code}', active={self.is_active})>"


class PlanPrice(Base):
    """A Stripe price for a plan, per (interval, currency). Data-driven so activating a plan or
    adding a currency/interval is an admin/data action — not a code change. A plan is *purchasable*
    when the plan is active AND it has an active PlanPrice for the buyer's resolved currency.
    Keeps the Stripe price/product IDs out of code/env (the B2B side hardcodes them; this doesn't)."""

    __tablename__ = "plan_prices"
    __table_args__ = (
        UniqueConstraint("plan_id", "interval", "currency", name="uq_plan_price_cycle_ccy"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    interval: Mapped[str] = mapped_column(String(10), nullable=False, default="month")  # month|year
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    unit_amount_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)

    stripe_price_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    stripe_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    updated_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    plan: Mapped["Plan"] = relationship("Plan", back_populates="prices")

    def __repr__(self) -> str:
        return f"<PlanPrice(plan_id={self.plan_id}, {self.interval}/{self.currency}, price='{self.stripe_price_id}')>"


class PlanEntitlement(Base):
    """plan × feature → typed value. The table the admin edits."""

    __tablename__ = "plan_entitlements"
    __table_args__ = (
        UniqueConstraint("plan_id", "feature_id", name="uq_plan_feature"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("features.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Exactly one is meaningful per row, chosen by the feature's value_type.
    int_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bool_value: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    string_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    updated_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    plan: Mapped["Plan"] = relationship("Plan", back_populates="entitlements")
    feature: Mapped["Feature"] = relationship("Feature", back_populates="entitlements")

    def __repr__(self) -> str:
        return f"<PlanEntitlement(plan_id={self.plan_id}, feature_id={self.feature_id})>"


class EntitlementOverride(Base):
    """Per-user or per-guest override (comp / promo / abuse penalty). Highest precedence.

    Schema is created now for future-safety; resolution wiring lands in Phase 2. ``subject_id``
    is a ``users.id`` (as string) when ``subject_type='user'`` or a ``visitor_id`` hash when
    ``subject_type='visitor'``.
    """

    __tablename__ = "entitlement_overrides"
    __table_args__ = (
        Index("ix_entl_override_subject", "subject_type", "subject_id"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    subject_type: Mapped[str] = mapped_column(String(10), nullable=False)  # user | visitor
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    feature_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("features.id", ondelete="CASCADE"), nullable=False, index=True
    )

    int_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bool_value: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    string_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True, index=True)

    created_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    def __repr__(self) -> str:
        return f"<EntitlementOverride(subject={self.subject_type}:{self.subject_id}, feature_id={self.feature_id})>"
