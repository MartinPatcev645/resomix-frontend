"""
B2B & Ingestion Models
======================

This module defines the SQLAlchemy models for B2B operations, DDEX licensing,
and ingestion logging.
"""

from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, Boolean, DECIMAL, JSON, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base
from .partner import Partner


class IngestLog(Base):
    """
    IngestLog model representing the ingest_log table.
    Tracks the lifecycle of an ingestion package (DDEX/CSV/etc).
    """
    __tablename__ = "ingest_logs"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("partners.id", ondelete="RESTRICT"), 
        nullable=False, 
        default=1, 
        index=True
    )
    package_folder: Mapped[str] = mapped_column(String(512), nullable=False)
    message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ddex_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'), 
        default='PENDING', 
        nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    file_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), default=0)
    batch_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    track_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), default=0)

    # ── Ingestion pipeline v2 (fine-grained lifecycle) ──────────────────────
    # ``status`` (above) stays the coarse PENDING/PROCESSING/COMPLETED/FAILED used
    # by existing code. ``stage`` is the fine-grained pipeline stage (see
    # app.services.ingestion_stages.Stage); kept as a plain string so adding stages
    # needs no migration. ``processing_dir`` is the UTC-named processing/<dt> folder
    # (the link the later embedding job uses). ``stage_timeline`` is a
    # {stage: utc_iso} map mirrored verbatim into the partner-visible logs.json.
    stage: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    processing_dir: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stage_timeline: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    
    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])


class Deal(Base):
    """
    Deal model representing the deals table.
    Commercial terms and licensing logic from DDEX DealList.
    """
    __tablename__ = "deals"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    message_id: Mapped[str] = mapped_column(String(255), ForeignKey("messages.message_id"), nullable=False, index=True)
    
    deal_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    licensee_dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    deal_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deal_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_perpetual: Mapped[bool] = mapped_column(Boolean, default=True)
    
    commercial_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    distribution_channel: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preorder_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    release_deals: Mapped[List["ReleaseDeal"]] = relationship("ReleaseDeal", back_populates="deal")
    territories: Mapped[List["DealTerritory"]] = relationship("DealTerritory", back_populates="deal")
    use_types: Mapped[List["DealUseType"]] = relationship("DealUseType", back_populates="deal")
    royalty_rates: Mapped[List["RoyaltyRate"]] = relationship("RoyaltyRate", back_populates="deal")


class ReleaseDeal(Base):
    """
    ReleaseDeal model representing the release_deals table.
    Mapping specific deals to releases.
    """
    __tablename__ = "release_deals"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    release_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False)
    deal_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    deal: Mapped["Deal"] = relationship("Deal", back_populates="release_deals")
    release: Mapped["Release"] = relationship("Release")


class DealTerritory(Base):
    """
    DealTerritory model representing the deal_territories table.
    Geographic restrictions or permissions for a specific deal.
    """
    __tablename__ = "deal_territories"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    deal_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    territory: Mapped[str] = mapped_column(String(10), nullable=False)
    is_excluded: Mapped[bool] = mapped_column(Boolean, default=False)

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    deal: Mapped["Deal"] = relationship("Deal", back_populates="territories")


class DealUseType(Base):
    """
    DealUseType model representing the deal_use_types table.
    Permitted usage models (Stream, Download, etc.) for a deal.
    """
    __tablename__ = "deal_use_types"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    deal_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    use_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    deal: Mapped["Deal"] = relationship("Deal", back_populates="use_types")


class RoyaltyRate(Base):
    """
    RoyaltyRate model representing the royalty_rates table.
    Detailed financial terms for deals.
    """
    __tablename__ = "royalty_rates"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    deal_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    
    rate_type: Mapped[str] = mapped_column(
        Enum('FixedRate', 'RevenueShare', 'PerStream', 'PerDownload', 'MinGuarantee', 'Other'),
        default='RevenueShare',
        nullable=False
    )
    rate_value: Mapped[float] = mapped_column(mysql.DECIMAL(12, 6), nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(3), default='USD')
    tier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    deal: Mapped["Deal"] = relationship("Deal", back_populates="royalty_rates")


class IngestionError(Base):
    """Specific validation or delivery errors during ingestion."""
    __tablename__ = "ingestion_errors"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    ingest_log_id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), ForeignKey("ingest_logs.id", ondelete="CASCADE"), nullable=False)
    
    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    error_code: Mapped[str] = mapped_column(String(50), nullable=False)
    error_message: Mapped[str] = mapped_column(mysql.TEXT, nullable=False)
    error_severity: Mapped[str] = mapped_column(Enum('warning', 'critical'), default='critical', nullable=False, index=True)
    reference_node: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment='E.g., <ReleaseId> or specific ISRC string')
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    log: Mapped["IngestLog"] = relationship("IngestLog")
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

