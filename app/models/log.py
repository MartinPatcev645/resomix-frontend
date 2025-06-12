# Log model 
from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Log(Base):
    """
    Log model representing the logs table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS logs (
        id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id   CHAR(36),
        track_id  BIGINT UNSIGNED,
        action    VARCHAR(50) NOT NULL,
        message   VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
        KEY idx_log_user (user_id),
        KEY idx_log_track (track_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "logs"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True, index=True)  # Supabase UUID, nullable
    action = Column(String(50), nullable=False)
    message = Column(String(255), nullable=True)
    
    # Foreign keys
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    track = relationship("Track")
    
    def __repr__(self):
        return f"<Log(id={self.id}, user_id='{self.user_id}', action='{self.action}', track_id={self.track_id})>" 