"""
Backup Run Models
=================

One ``backup_runs`` row per nightly (or manual) backup, with one
``backup_components`` row per component inside it: database, media files,
analysis results, encrypted secrets.

WHY TWO TABLES. A run is not pass/fail, it is five independent pieces that can
each succeed or fail on their own. A single status column would flatten
"everything worked except the analysis results" into "failed" and hide which
part needs attention. It also makes the admin page answer the only question
that matters in an incident: not "did last night work" but "what exactly do we
have, and how old is it".

WHY DURATIONS AND BYTES ARE STORED. The first full media backup took 9h25m; the
second took 4 minutes, because restic re-reads nothing that has not changed.
Without a history, a night that suddenly takes hours again looks normal.

The backup scripts write a JSON metrics file per component on every exit path,
success or failure. These tables are where those files land.
"""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func

from . import Base


# The servers a run can originate from. Mirrors BACKUP_ROLE in the backup repo.
BACKUP_ROLES = ("alwyzon", "media")

# Components, in the order they are captured. The database is deliberately
# first: a file captured before the database leaves a row pointing at something
# that was never stored, which is a visibly broken track after a restore. The
# other order leaves orphan files, which are harmless.
BACKUP_COMPONENTS = (
    "db",
    "secrets",
    "media-embeddings",
    "media-uploads",
    "analysis-results",
    "verify",
    "retention",
)

# `partial` exists because a run where four of five components worked is
# genuinely different from one where nothing did, and treating them the same
# would either cause alarm fatigue or hide a real gap.
RUN_STATES = ("pending", "running", "succeeded", "partial", "failed")
COMPONENT_STATES = ("pending", "running", "succeeded", "failed", "skipped")

TRIGGERS = ("scheduled", "manual")


class BackupRun(Base):
    """backup_runs — one nightly or manual backup run on one server."""

    __tablename__ = "backup_runs"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    # The run id the backup scripts generate (UTC, e.g. 20260829T022000Z). It is
    # how a row is matched to the metrics files on disk, so it is unique.
    run_uid: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)

    server_role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    hostname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled", index=True)
    # Null for scheduled runs. Set when an admin pressed the button, so the
    # audit trail answers "who started this" without a separate log.
    triggered_by_user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_s: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)

    # Rolled up from the components so the list view needs no joins.
    bytes_stored: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)
    files_processed: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)

    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    components: Mapped[List["BackupComponent"]] = relationship(
        "BackupComponent",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="BackupComponent.id",
    )

    def __repr__(self) -> str:
        return (
            f"<BackupRun(id={self.id}, uid={self.run_uid}, "
            f"role={self.server_role}, status={self.status})>"
        )


class BackupComponent(Base):
    """backup_components — one component within a run.

    Mirrors the JSON metrics file each backup script writes. `bytes_added` is
    restic's LOGICAL size before compression; `bytes_stored` is what actually
    reached the Storage Box. Both are kept because the difference is large and
    reporting the wrong one overstates storage growth several times over.
    """

    __tablename__ = "backup_components"
    __table_args__ = (
        # One row per component per run. This is what makes the metrics POST an
        # upsert: a script that retries after a lost response updates its row
        # rather than adding a second, contradictory record of the same night.
        # Declared here as well as in the migration so a metadata-created
        # database (tests, a fresh dev box) enforces it too.
        UniqueConstraint("run_id", "component", name="uq_backup_components_run_component"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    run_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("backup_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    component: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_s: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)

    # restic's short id. Comma separated when one component writes more than one
    # snapshot (the media component writes embeddings and uploads separately).
    snapshot_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    files_new: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)
    files_changed: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)
    files_processed: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)

    bytes_processed: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)
    bytes_added: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)
    bytes_stored: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), nullable=False, default=0)

    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    run: Mapped["BackupRun"] = relationship("BackupRun", back_populates="components")

    def __repr__(self) -> str:
        return (
            f"<BackupComponent(run_id={self.run_id}, {self.component}, "
            f"status={self.status})>"
        )
