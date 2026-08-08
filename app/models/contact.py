"""
Contact Model
=============

SQLAlchemy model for contact form submissions.
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, TEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base
from .partner import Partner

if TYPE_CHECKING:
    from .user import User


class Contact(Base):
    """
    Contact model representing the contacts table
    """
    __tablename__ = "contacts"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Optional link to user if logged in
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(TEXT, nullable=True)

    # Which form the submission came from — drives the admin consumer/partner categorization.
    contact_type: Mapped[str] = mapped_column(
        Enum('consumer', 'partner', name='contact_type'),
        nullable=False,
        default='consumer',
        server_default='consumer',
        index=True,
    )
    # B2B partner-request fields. NULL for consumer contacts (/contact), which never set them.
    #
    # Two landing forms write partner rows and they ask different questions, so a given partner
    # submission fills only the subset its form collects — every one of these stays nullable:
    #   • /partners       → role, partner_type, preferred_path, catalog_context
    #   • /partners-pilot → role, partner_type, catalog_size
    # `estimated_calls` is retained for historical rows; no current form collects it.
    company_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)             # job title / role
    partner_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)      # label, distributor, store…
    preferred_path: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)    # pilot, API+ingestion, …
    catalog_context: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # catalogue / product context
    catalog_size: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)      # est. catalog tracks (free text)
    estimated_calls: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)  # est. monthly API calls / tier

    # Where the submission came from. Nullable: everything submitted before these columns
    # existed genuinely has no answer, and NULL says so honestly.
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    status: Mapped[str] = mapped_column(
        Enum('open', 'resolved', name='contact_status'), 
        nullable=False, 
        default='open'
    )
    
    # Timestamps
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationship
    user: Mapped[Optional["User"]] = relationship("User")
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return f"<Contact(id={self.id}, email='{self.email}', status='{self.status}')>"
