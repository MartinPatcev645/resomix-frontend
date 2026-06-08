"""
Partner Processing Job Model
============================

One row per admin-triggered batch processing job (embeddings / peaks / segments /
faiss_index). Jobs are fire-and-forget: the API inserts a ``pending`` row, returns
immediately, and a background worker updates ``status`` + progress counters as it runs.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


JOB_TYPES = ("embeddings", "peaks", "segments", "faiss_index")
JOB_STATES = ("pending", "running", "completed", "failed", "partial")


class PartnerProcessingJob(Base):
    """partner_processing_jobs — admin-triggered batch job record."""

    __tablename__ = "partner_processing_jobs"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    ingest_log_id: Mapped[Optional[int]] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("ingest_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    job_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)

    total_tracks: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    processed_tracks: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    failed_tracks: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)

    # JSON list of per-track errors for the failed ones.
    error_details: Mapped[Optional[dict]] = mapped_column(mysql.JSON, nullable=True)

    triggered_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return (
            f"<PartnerProcessingJob(id={self.id}, type={self.job_type}, "
            f"status={self.status}, {self.processed_tracks}/{self.total_tracks})>"
        )
