# Album model 
from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class Album(Base):
    """
    Album model representing the albums table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS albums (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        artist_id   INT UNSIGNED NOT NULL,
        title       VARCHAR(200) NOT NULL,
        release_date DATE,
        cover_image VARCHAR(255),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        KEY idx_album_artist (artist_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "albums"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Foreign keys
    artist_id = Column(Integer, ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Fields
    title = Column(String(200), nullable=False)
    release_date = Column(Date, nullable=True)
    cover_image = Column(String(255), nullable=True)
    
    # Relationships
    artist = relationship("Artist", back_populates="albums")
    tracks = relationship("Track", back_populates="album")
    
    def __repr__(self):
        return f"<Album(id={self.id}, title='{self.title}', artist_id={self.artist_id})>" 