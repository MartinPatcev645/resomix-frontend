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
from .playlist_engagement import UserPlaylistEngagement
from .playlist_transfer_track import PlaylistTransferTrack
from .rating import TrackRating, PlaylistRating
from .purchase import Purchase, UserSubscription
from .feedback import Feedback
from .contact import Contact
from .user import (
    User, 
    EmailVerificationToken, 
    PasswordResetToken, 
    TwoFactorEmailCode,
    UserSession,
    UserAuthProvider,
    Role, 
    Permission, 
    RolePermission, 
    UserRole
)
from .log import SystemLog
from .waitlist import Waitlist
from .operation_limit import OperationType, UserOperationLimit

# Make models available at package level
__all__ = [
    "Base", 
    "Artist", "Label", "Genre", "Album", 
    "Track", "TrackArtist",
    "Playlist", "PlaylistTrack",
    "UserPlaylistEngagement",
    "PlaylistTransferTrack",
    "TrackRating", "PlaylistRating",
    "Purchase", "UserSubscription",
    "Feedback", "Contact",
    "User",
    "EmailVerificationToken",
    "PasswordResetToken", 
    "TwoFactorEmailCode",
    "UserSession",
    "UserAuthProvider",
    "Role", "Permission", "RolePermission", "UserRole",
    "SystemLog", "Waitlist",
    "OperationType", "UserOperationLimit"
]
