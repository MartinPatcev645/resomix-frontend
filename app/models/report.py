"""
Reporting & Payout Models
=========================

SQLAlchemy models for monthly usage reports and label payouts.
"""

from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base

if TYPE_CHECKING:
    from .label import Label


class GeneratedReport(Base):
    """Metadata for monthly label royalty and usage reports."""
    __tablename__ = "generated_reports"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    label_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("labels.id", ondelete="RESTRICT"), nullable=False)
    reporting_period: Mapped[str] = mapped_column(String(7), nullable=False) # YYYY-MM
    total_valid_streams: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), default=0)
    report_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum('draft', 'generated', 'sent_to_label'),
        default='draft',
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    label: Mapped["Label"] = relationship("Label")
    payouts: Mapped[List["LabelPayout"]] = relationship("LabelPayout", back_populates="report", cascade="all, delete-orphan")


class LabelPayout(Base):
    """Tracking disbursement status for label revenue."""
    __tablename__ = "label_payouts"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    label_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("labels.id", ondelete="RESTRICT"), nullable=False)
    report_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("generated_reports.id", ondelete="CASCADE"), nullable=False)
    amount_due: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default='EUR')
    payout_status: Mapped[str] = mapped_column(
        Enum('calculated', 'processing', 'paid', 'failed'),
        default='calculated',
        nullable=False,
        index=True
    )
    transaction_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    label: Mapped["Label"] = relationship("Label")
    report: Mapped["GeneratedReport"] = relationship("GeneratedReport", back_populates="payouts")
