"""
SFTP User Model
===============

SQLAlchemy model for managing SFTP users associated with B2B partners.
Maps to the `sftp_users` table.

Extended in W2-4 to support automated provisioning:
  - label_id made nullable (legacy field, B2B partners don't require a label)
  - public_key / use_public_key for SSH key-based authentication
  - allowed_ip for per-user IP whitelisting passed to SFTPGo
  - sftp_provisioned_at as the idempotency flag for Hetzner provisioning state
  - sftp_home_dir as the chroot path stored in DB (read by the auth hook)

Version: 3.0.2
Init Date: May 02, 2026
Updated: May 2026 (W2-4 provisioning fields)
"""

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Boolean,
    Text,
    Index,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import Optional

from . import Base
from .partner import Partner


class SftpUser(Base):
    """SFTP virtual user for B2B partner content ingestion via SFTP."""

    __tablename__ = "sftp_users"
    __table_args__ = (
        # Compound index used by the auth hook (query by username) and the
        # provisioning service (query by partner_id + active status).
        Index("idx_sftp_partner_active", "partner_id", "is_active"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # Legacy FK — nullable so that direct B2B partner accounts (which operate
    # at the partner level, not the label level) do not need a label row.
    label_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("labels.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Legacy label FK; NULL for direct B2B partner SFTP accounts (W2-4)",
    )

    username: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    # bcrypt hash of the SFTP password. Nullable to support public-key-only
    # accounts where no password is set.
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="bcrypt hash; NULL when use_public_key=True and no password is set",
    )

    home_directory: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Legacy home dir column; prefer sftp_home_dir for provisioned accounts",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── SFTP Provisioning Fields (W2-4) ──────────────────────────────────────

    # Full OpenSSH public key string (e.g. "ssh-ed25519 AAAA... comment").
    # Returned in the SFTPGo auth hook response as public_keys:[...] when
    # use_public_key is True.
    public_key: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="OpenSSH public key for key-based SFTP auth (W2-4)",
    )

    # When True: auth hook returns public_keys[] to SFTPGo.
    # When False: password-only auth.
    use_public_key: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="If True, SFTPGo receives public key list from auth hook (W2-4)",
    )

    # Comma-separated IP addresses or CIDRs the partner is allowed to connect
    # from. Example: '203.0.113.10,198.51.100.0/24'. Passed as
    # filters.allowed_ip in the SFTPGo auth hook response.
    allowed_ip: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Comma-separated IP/CIDR whitelist for SFTPGo filters (W2-4)",
    )

    # The chroot home directory path returned to SFTPGo via the auth hook.
    # Set during provisioning to e.g. /srv/sftp/partners/42.
    # Storing it here makes the auth hook a pure DB reader with no path logic.
    sftp_home_dir: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="SFTPGo chroot path, e.g. /srv/sftp/partners/42 (W2-4)",
    )

    # Idempotency flag. Set by sftp_service.mark_provisioned() once Hetzner
    # confirms the virtual user directory and SFTPGo record exist.
    #   NULL     → in MariaDB but NOT yet live in SFTPGo (retry eligible)
    #   Non-NULL → fully provisioned and live
    sftp_provisioned_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="When Hetzner SFTPGo provisioning succeeded; NULL = pending (W2-4)",
    )

    # ── End Provisioning Fields ───────────────────────────────────────────────

    # User ID: Link to platform user (RBAC Part 1)
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    label: Mapped[Optional["Label"]] = relationship("Label", back_populates="sftp_users")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="sftp_user")

    def __repr__(self) -> str:
        provisioned = "provisioned" if self.sftp_provisioned_at else "pending"
        return (
            f"<SftpUser(id={self.id}, username='{self.username}', "
            f"partner_id={self.partner_id}, status={provisioned})>"
        )
