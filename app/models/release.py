"""
Release Model
=============

This module defines the Release SQLAlchemy model for the Resomix application.
It maps to the releases table which replaces the old albums table for DDEX compliance.
"""

from sqlalchemy import Column, Integer, BigInteger, String, Date, ForeignKey, DateTime, Enum, Numeric, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Release(Base):
    """
    Release model representing the releases table.
    Stores metadata for albums, singles, EPs, or bundles.
    """

    __tablename__ = "releases"

    # Primary key
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    # External References
    artist_id = Column(BigInteger, ForeignKey("artists.id", ondelete="CASCADE"), nullable=True, index=True)
    label_id = Column(BigInteger, ForeignKey("labels.id", ondelete="SET NULL"), nullable=True, index=True)
    party_id = Column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    message_id = Column(String(255), ForeignKey("messages.message_id"), nullable=False, index=True)
    
    # DDEX specific
    release_ref = Column(String(100), nullable=True)
    ern_version = Column(String(10), nullable=True)
    raw_xml_path = Column(String(500), nullable=True)
    
    # Identifiers
    icpn = Column(String(30), nullable=True, index=True)
    upc_ean = Column(String(20), nullable=True)
    grid = Column(String(30), nullable=True)
    catalog_number = Column(String(100), nullable=True, index=True)
    
    # Metadata
    title = Column(String(1024), nullable=False)
    subtitle = Column(String(1024), nullable=True)
    description = Column(String, nullable=True)
    display_artist = Column(String(512), nullable=True)
    
    release_type = Column(
        Enum("Album", "EP", "Single", name="release_type_enum"),
        default="Album"
    )
    
    release_date = Column(Date, nullable=True)
    original_release_date = Column(Date, nullable=True)
    ingested_at = Column(DateTime, server_default=func.current_timestamp())
    
    # Rights & Pricing
    p_line_year = Column(Integer, nullable=True)
    p_line_text = Column(String(512), nullable=True)
    c_line_year = Column(Integer, nullable=True)
    c_line_text = Column(String(512), nullable=True)
    
    genre = Column(String(255), nullable=True)
    sub_genre = Column(String(255), nullable=True)
    
    p_line = Column(String(255), nullable=True)
    c_line = Column(String(255), nullable=True)
    
    parental_warning = Column(
        Enum('NoAdviceAvailable','NotExplicit','Explicit','ExplicitContentEdited', name="parental_warning_enum"),
        default='NotExplicit'
    )
    
    is_compilation = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)
    price_cents = Column(Integer, nullable=True)
    artwork_path = Column(String(1024), nullable=True)
    cover_image = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )
    
    # Relationships
    tracks = relationship("Track", back_populates="release", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Release(id={self.id}, title='{self.title}', icpn='{self.icpn}')>"
