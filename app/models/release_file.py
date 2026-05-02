"""
Release File Model
==================

This module defines the ReleaseFile SQLAlchemy model.
Junction table mapping image assets (covers, booklets) to specific releases.
"""

from typing import Optional
from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from . import Base


class ReleaseFile(Base):
    """
    ReleaseFile model representing the release_files table.
    Maps image_files (cover art, booklets, etc.) to releases.
    """
    __tablename__ = "release_files"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # Foreign keys
    release_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False, index=True)
    image_file_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("image_files.id", ondelete="CASCADE"), nullable=False, index=True)

    # Fields
    file_role: Mapped[str] = mapped_column(
        Enum(
            'FrontCoverImage', 'BackCoverImage', 'BookletFront',
            'BookletBack', 'Poster', 'ArtistPhoto', 'Tray', 'Liner', 'Other'
        ),
        nullable=False, default='FrontCoverImage'
    )
    sequence_num: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), default=1)

    # Relationships
    release: Mapped["Release"] = relationship("Release", backref="release_files")
    image_file: Mapped["ImageFile"] = relationship("ImageFile", backref="release_file_assocs")

    def __repr__(self):
        return f"<ReleaseFile(id={self.id}, release_id={self.release_id}, image_file_id={self.image_file_id}, role='{self.file_role}')>"
