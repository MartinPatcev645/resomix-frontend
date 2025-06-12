from sqlalchemy.ext.declarative import declarative_base

# Create SQLAlchemy Base class
Base = declarative_base()

# Import all models to register them with SQLAlchemy
from .artist import Artist
from .label import Label
from .genre import Genre
from .album import Album
from .track import Track, TrackArtist
from .playlist import Playlist, PlaylistTrack
from .rating import TrackRating, PlaylistRating
from .purchase import Purchase, UserSubscription
from .feedback import Feedback, Contact
from .user import Role, Permission, RolePermission, UserRole
from .log import Log

# Make models available at package level
__all__ = [
    "Base", 
    "Artist", "Label", "Genre", "Album", 
    "Track", "TrackArtist",
    "Playlist", "PlaylistTrack",
    "TrackRating", "PlaylistRating",
    "Purchase", "UserSubscription",
    "Feedback", "Contact",
    "Role", "Permission", "RolePermission", "UserRole",
    "Log"
]
