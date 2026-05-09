"""
Partner Models (W1-1)
=====================

SQLAlchemy models for the B2B multi-tenancy layer.
These tables form the foundation of the partner / API-key plane:

  - Partner          → top-level tenant identity
  - PartnerApiKey    → hashed API keys per partner (never plaintext)
  - PartnerQuota     → rolling-30-day request counters per partner
  - PartnerUsageLog  → per-request audit trail for every authenticated call
  - PartnerWebhook   → webhook subscription configuration per partner
  - WebhookDeliveryLog → individual delivery attempts with retry state

All tables are additive; no existing tables are modified here.

Roadmap reference: W1-1 (35-Day Partner-Readiness Roadmap v3.0)
Version: 3.0.1
Init Date: May 2026
"""

from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
    Enum,
    Numeric,
    SmallInteger,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Partner(Base):
    """
    Top-level tenant identity table.

    Each row represents one B2B partner (label, sync library, etc.).
    The ``tier`` column drives quota limits and feature flags resolved
    later by the quota-enforcement middleware (W1-8).

    ``partner_id = 1`` is reserved for the public sandbox tenant so that
    existing demo/cc_by tracks can be tagged without a real partner.
    """

    __tablename__ = "partners"
    __table_args__ = (
        Index("idx_partner_uuid", "partner_uuid"),
        Index("idx_partner_tier", "tier", "is_active"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True
    )
    partner_uuid: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, comment="Public UUID exposed in API responses"
    )
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    vat_number: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="EU VAT number; validated via VIES at customer creation (W4-4)"
    )
    country_code: Mapped[Optional[str]] = mapped_column(
        String(2), nullable=True, comment="ISO 3166-1 alpha-2"
    )
    tier: Mapped[str] = mapped_column(
        Enum("sandbox", "starter", "growth", "enterprise"),
        nullable=False,
        default="sandbox",
        comment="Drives quota limits and feature flags",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    onboarded_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    api_keys: Mapped[List["PartnerApiKey"]] = relationship(
        "PartnerApiKey", back_populates="partner", cascade="all, delete-orphan"
    )
    quotas: Mapped[List["PartnerQuota"]] = relationship(
        "PartnerQuota", back_populates="partner", cascade="all, delete-orphan"
    )
    usage_logs: Mapped[List["PartnerUsageLog"]] = relationship(
        "PartnerUsageLog", back_populates="partner", cascade="all, delete-orphan"
    )
    webhooks: Mapped[List["PartnerWebhook"]] = relationship(
        "PartnerWebhook", back_populates="partner", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Partner(id={self.id}, display_name='{self.display_name}', tier='{self.tier}')>"


class PartnerApiKey(Base):
    """
    Hashed API keys issued to partners.

    - Only the SHA-256 hash of the full key is stored (never plaintext).
    - ``key_prefix`` (e.g. ``rmx_live_abc1``) is safe to display in the
      admin UI for identification.
    - ``scopes`` is a JSON array (e.g. ``["search:read", "ingest:write"]``)
      used by the ``get_current_partner()`` dependency (W1-3) to enforce
      fine-grained access control.
    - Key formats: ``rmx_live_<urlsafe_32>`` / ``rmx_sandbox_<urlsafe_32>``.
    """

    __tablename__ = "partner_api_keys"
    __table_args__ = (
        Index("idx_apikey_hash", "key_hash"),
        Index("idx_apikey_active", "is_active", "partner_id"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    key_prefix: Mapped[str] = mapped_column(
        String(16), nullable=False, comment="Short prefix safe to display (e.g. rmx_live_abc1)"
    )
    key_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, comment="SHA-256 hex digest of the full API key"
    )
    label: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Human label: Production / Sandbox / Dev"
    )
    scopes: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment='e.g. ["search:read", "ingest:write"]'
    )
    rate_limit_rps: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=10,
        comment="Token-bucket burst limit in requests-per-second (W1-7)",
    )
    rate_limit_monthly: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=100_000,
        comment="Rolling-30-day request cap (W1-8)",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )
    last_used_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    last_used_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    revoked_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", back_populates="api_keys")
    usage_logs: Mapped[List["PartnerUsageLog"]] = relationship(
        "PartnerUsageLog", back_populates="api_key", cascade="all, delete-orphan"
    )
    quotas: Mapped[List["PartnerQuota"]] = relationship(
        "PartnerQuota", back_populates="api_key", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PartnerApiKey(id={self.id}, prefix='{self.key_prefix}', active={self.is_active})>"


class PartnerQuota(Base):
    """
    Rolling-30-day quota tracking per partner / API key.

    ``requests_made`` is the authoritative count; it is incremented atomically
    via Redis ``INCR`` (W1-8) and flushed to this table every 5 minutes.
    ``is_overage`` is set to True when the count exceeds ``quota_limit``,
    which triggers the ``quota.exceeded`` webhook event (W4-2).
    """

    __tablename__ = "partner_quotas"
    __table_args__ = (
        UniqueConstraint("partner_id", "api_key_id", "period_start", name="uk_quota_period"),
        Index("idx_quota_period", "period_start", "period_end"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    api_key_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partner_api_keys.id", ondelete="CASCADE"),
        nullable=True,
        comment="NULL = aggregate across all keys for the partner",
    )
    period_start: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="ISO date YYYY-MM-DD"
    )
    period_end: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="ISO date YYYY-MM-DD (period_start + 30d)"
    )
    requests_made: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True), nullable=False, default=0
    )
    quota_limit: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True), nullable=False, comment="Copied from api_key at period creation"
    )
    is_overage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_synced_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, comment="Timestamp of last Redis → MariaDB flush"
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", back_populates="quotas")
    api_key: Mapped[Optional["PartnerApiKey"]] = relationship(
        "PartnerApiKey", back_populates="quotas"
    )

    def __repr__(self) -> str:
        return (
            f"<PartnerQuota(partner_id={self.partner_id}, "
            f"period={self.period_start}→{self.period_end}, "
            f"used={self.requests_made}/{self.quota_limit})>"
        )


class PartnerUsageLog(Base):
    """
    Per-request audit log for every authenticated partner API call.

    Written by the audit-log middleware (W2-1) for every request that
    passes ``get_current_partner()`` authentication. The table is
    partitioned by ``created_at`` to keep hot-partition sizes manageable.

    This is the source-of-truth for partner-facing usage dashboards and
    billing reconciliation (W4-4).
    """

    __tablename__ = "partner_usage_log"
    __table_args__ = (
        Index("idx_usage_partner_time", "partner_id", "created_at"),
        Index("idx_usage_endpoint", "endpoint", "created_at"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True
    )
    correlation_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, comment="Links to system_logs.correlation_id"
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    api_key_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partner_api_keys.id", ondelete="CASCADE"),
        nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(
        mysql.SMALLINT(unsigned=True), nullable=True
    )
    latency_ms: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 3), nullable=True
    )
    request_bytes: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), nullable=True
    )
    response_bytes: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), nullable=True
    )
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="e.g. QUOTA_EXCEEDED, INVALID_AUDIO_FORMAT"
    )
    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", back_populates="usage_logs")
    api_key: Mapped["PartnerApiKey"] = relationship(
        "PartnerApiKey", back_populates="usage_logs"
    )

    def __repr__(self) -> str:
        return (
            f"<PartnerUsageLog(id={self.id}, partner_id={self.partner_id}, "
            f"endpoint='{self.endpoint}', status={self.status_code})>"
        )


class PartnerWebhook(Base):
    """
    Webhook subscription configuration per partner.

    Each partner can subscribe to one or more ``events`` (JSON array).
    The ``secret_hash`` (SHA-256) is used to compute the
    ``X-Resomix-Signature`` HMAC header on outgoing deliveries (W4-1).

    ``consecutive_failures`` is incremented on each failed delivery
    attempt and reset to 0 on success. The Celery dispatcher (W4-1)
    will auto-disable a webhook after a configurable failure threshold.
    """

    __tablename__ = "partner_webhooks"
    __table_args__ = (
        Index("idx_webhook_partner_active", "partner_id", "is_active"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="HTTPS endpoint that receives webhook POSTs"
    )
    secret_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA-256 of the signing secret; used for HMAC in W4-1"
    )
    events: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment=(
            "Array of subscribed event types: "
            "ingestion.started | ingestion.completed | ingestion.failed | "
            "track.indexed | quota.warning | quota.exceeded | embedding.deleted"
        ),
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_delivery_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    last_delivery_status_code: Mapped[Optional[int]] = mapped_column(
        mysql.SMALLINT(), nullable=True
    )
    consecutive_failures: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), nullable=False, default=0
    )
    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", back_populates="webhooks")
    delivery_logs: Mapped[List["WebhookDeliveryLog"]] = relationship(
        "WebhookDeliveryLog", back_populates="webhook", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<PartnerWebhook(id={self.id}, partner_id={self.partner_id}, "
            f"url='{self.url[:40]}...', active={self.is_active})>"
        )


class WebhookDeliveryLog(Base):
    """
    Individual webhook delivery attempt log.

    Written by the Celery dispatcher (W4-1) after each HTTP POST attempt.
    ``attempt_number`` tracks which retry in the exponential-backoff chain
    (1 = initial, 2 = 1m, 3 = 5m, 4 = 30m, 5 = 2h, 6 = 8h).
    ``response_status`` is NULL when the request timed out or the
    connection was refused.
    """

    __tablename__ = "webhook_delivery_log"
    __table_args__ = (
        Index("idx_delivery_partner_event", "partner_id", "event_type", "created_at"),
        Index("idx_delivery_status", "response_status", "created_at"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True
    )
    correlation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    webhook_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partner_webhooks.id", ondelete="CASCADE"),
        nullable=False,
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="e.g. ingestion.completed",
    )
    payload: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="Full JSON body sent to the partner endpoint"
    )
    attempt_number: Mapped[int] = mapped_column(
        mysql.TINYINT(unsigned=True), nullable=False, default=1
    )
    response_status: Mapped[Optional[int]] = mapped_column(
        mysql.SMALLINT(), nullable=True, comment="HTTP response code; NULL on connection failure"
    )
    response_latency_ms: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delivered_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, comment="Set when response_status is 2xx"
    )
    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )

    # Relationships
    webhook: Mapped["PartnerWebhook"] = relationship(
        "PartnerWebhook", back_populates="delivery_logs"
    )

    def __repr__(self) -> str:
        return (
            f"<WebhookDeliveryLog(id={self.id}, webhook_id={self.webhook_id}, "
            f"event='{self.event_type}', attempt={self.attempt_number}, "
            f"status={self.response_status})>"
        )
