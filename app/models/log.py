"""
Log Model
=========

This module defines the SystemLog SQLAlchemy model for the Resomix application.
It handles comprehensive system logging and audit trail storage with support for 
request tracking, error logging, user actions, and system events.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Text, JSON, Enum, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class SystemLog(Base):
    """
    SystemLog model representing the system_logs table
    
    Enhanced logging model for comprehensive request tracking, error logging,
    and system monitoring with support for admin dashboard queries.
    """
    __tablename__ = "system_logs"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key (BIGINT UNSIGNED for high volume)
    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    
    # Request tracking
    correlation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    
    # Request Information
    method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    query_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Response Information
    status_code: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True, index=True)
    response_size: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    duration_ms: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 3), nullable=True)
    
    # Log Details
    level: Mapped[str] = mapped_column(
        Enum('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', name='log_level'),
        nullable=False,
        default='INFO',
        index=True
    )
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    action: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Context Data
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    referer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # System Metrics
    cpu_percent: Mapped[Optional[float]] = mapped_column(DECIMAL(5, 2), nullable=True)
    memory_percent: Mapped[Optional[float]] = mapped_column(DECIMAL(5, 2), nullable=True)
    
    # Related Entities - Foreign keys (INT UNSIGNED)
    track_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    playlist_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True, index=True)
    release_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="SET NULL"), nullable=True, index=True)
    contributor_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("contributors.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Additional Context
    log_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), index=True
    )
    
    # Relationships
    track: Mapped[Optional["Track"]] = relationship("Track")
    playlist: Mapped[Optional["Playlist"]] = relationship("Playlist")
    release: Mapped[Optional["Release"]] = relationship("Release")
    contributor: Mapped[Optional["Contributor"]] = relationship("Contributor")
    
    def __repr__(self):
        return f"<SystemLog(id={self.id}, level={self.level}, action={self.action}, endpoint={self.endpoint})>"

    def to_dict(self):
        """Convert log entry to dictionary for API responses"""
        return {
            'id': self.id,
            'correlation_id': self.correlation_id,
            'method': self.method,
            'endpoint': self.endpoint,
            'path': self.path,
            'query_params': self.query_params,
            'status_code': self.status_code,
            'response_size': self.response_size,
            'duration_ms': float(self.duration_ms) if self.duration_ms else None,
            'level': self.level,
            'category': self.category,
            'action': self.action,
            'message': self.message,
            'client_ip': self.client_ip,
            'user_agent': self.user_agent,
            'referer': self.referer,
            'cpu_percent': float(self.cpu_percent) if self.cpu_percent else None,
            'memory_percent': float(self.memory_percent) if self.memory_percent else None,
            'track_id': self.track_id,
            'playlist_id': self.playlist_id,
            'release_id': self.release_id,
            'contributor_id': self.contributor_id,
            'log_metadata': self.log_metadata,
            'stack_trace': self.stack_trace,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
