"""
Genre Model
===========

This module defines the Genre SQLAlchemy model for the Resomix application.
It handles music genre classification.
"""

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from typing import List, Optional
from . import Base


class Genre(Base):
    """
    Genre model representing the genres table
    """
    __tablename__ = "genres"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Fields
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("genres.id"), nullable=True)
    
    # Relationships
    subgenres: Mapped[List["Genre"]] = relationship("Genre", backref="parent", remote_side=[id])
    
    def __repr__(self):
        return f"<Genre(id={self.id}, name='{self.name}')>"
