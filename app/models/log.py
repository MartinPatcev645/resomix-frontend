"""
Log Model
=========

This module defines the SystemLog SQLAlchemy model for the ResomiX application.
It handles comprehensive system logging and audit trail storage with support for 
request tracking, error logging, user actions, and system events.

Provides detailed logging data modeling for monitoring, debugging, and admin 
dashboard operations in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime, Text, JSON, Enum, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class SystemLog(Base):
    """
    SystemLog model representing the system_logs table
    
    Enhanced logging model for comprehensive request tracking, error logging,
    and system monitoring with support for admin dashboard queries.
    """
    __tablename__ = "system_logs"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Request tracking
    correlation_id = Column(String(36), nullable=True, index=True)
    
    # Request Information
    method = Column(String(10), nullable=True)  # HTTP method (GET, POST, etc.)
    endpoint = Column(String(500), nullable=True, index=True)  # API endpoint path
    path = Column(String(500), nullable=True)  # Full request path with params
    query_params = Column(JSON, nullable=True)  # Query parameters as JSON
    
    # Response Information
    status_code = Column(Integer, nullable=True, index=True)  # HTTP status code
    response_size = Column(Integer, nullable=True)  # Response size in bytes
    duration_ms = Column(DECIMAL(10, 3), nullable=True)  # Request duration in milliseconds
    
    # Log Details
    level = Column(
        Enum('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', name='log_level'),
        nullable=False,
        default='INFO',
        index=True
    )
    category = Column(String(50), nullable=True, index=True)  # REQUEST, ERROR, USER_ACTION, SYSTEM, etc.
    action = Column(String(100), nullable=True, index=True)  # Specific action taken
    message = Column(Text, nullable=True)  # Detailed log message
    
    # Context Data
    client_ip = Column(String(45), nullable=True, index=True)  # IPv4/IPv6 address
    user_agent = Column(String(500), nullable=True)  # Browser/client info
    referer = Column(String(500), nullable=True)  # Request referer
    
    # System Metrics
    cpu_percent = Column(DECIMAL(5, 2), nullable=True)  # CPU usage at request time
    memory_percent = Column(DECIMAL(5, 2), nullable=True)  # Memory usage percentage
    
    # Related Entities - Foreign keys
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True, index=True)
    album_id = Column(Integer, ForeignKey("albums.id", ondelete="SET NULL"), nullable=True, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Additional Context
    log_metadata = Column(JSON, nullable=True)  # Additional structured data
    stack_trace = Column(Text, nullable=True)  # For error logs
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), index=True)
    
    # Relationships
    track = relationship("Track", back_populates=None)
    playlist = relationship("Playlist", back_populates=None)
    album = relationship("Album", back_populates=None)
    artist = relationship("Artist", back_populates=None)
    
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
            'album_id': self.album_id,
            'artist_id': self.artist_id,
            'log_metadata': self.log_metadata,
            'stack_trace': self.stack_trace,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

