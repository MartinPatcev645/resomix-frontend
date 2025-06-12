from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from . import Base


class Genre(Base):
    """
    Genre model representing the genres table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS genres (
        id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        UNIQUE KEY uk_genre_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "genres"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    name = Column(String(80), nullable=False, unique=True, index=True)
    
    # Relationships
    tracks = relationship("Track", back_populates="genre")
    
    def __repr__(self):
        return f"<Genre(id={self.id}, name='{self.name}')>" 