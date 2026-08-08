"""
Admin → user messages
=====================

Every email an admin sends a user: a reply to a contact form, a reply to feedback, or a direct
message. One row per email actually sent, with the body as typed.

WHY IT IS RECORDED

"Did anyone reply to this?" is the first question on any support thread, and until now the answer
lived in somebody's sent folder. Two admins could answer the same contact without either knowing,
and a customer could reasonably claim we never responded.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


class MessageChannel:
    """What is being answered. A constant class, not a DB enum — a new channel should be a code
    change rather than a migration."""

    CONTACT = "contact"
    FEEDBACK = "feedback"
    DIRECT = "direct"

    ALL = (CONTACT, FEEDBACK, DIRECT)


class UserMessage(Base):
    """One email an admin sent a user."""

    __tablename__ = "user_messages"
    __table_args__ = (
        # "Has this contact been answered?" — the lookup every support screen makes.
        Index("ix_user_messages_channel_source", "channel", "source_id"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)

    # SET NULL: the record that we replied must outlive the account. A purged user takes their
    # personal data with them, not the evidence that we answered them.
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    # RESTRICT: who sent it is the point of an audit trail. The account purge repoints these to the
    # tombstone user rather than deleting them — see `AccountPurgeService.REPOINT`.
    admin_user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )

    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    # contacts.id / feedbacks.id being answered. NULL for a direct message, which answers nothing.
    source_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    # Exactly what the admin typed. Stored verbatim so the record is the message, not a summary.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Denormalised so the trail survives the account being deleted.
    recipient_email: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="sent")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return f"<UserMessage(to={self.recipient_email}, channel='{self.channel}', status='{self.status}')>"
