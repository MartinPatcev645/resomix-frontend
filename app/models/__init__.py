# ruff: noqa: E402
from sqlalchemy.ext.declarative import declarative_base

# Create SQLAlchemy Base class
Base = declarative_base()

# Import all models to register them with SQLAlchemy
from .artist import Artist
from .party import Party
from .label import Label
from .genre import Genre
from .release import Release
from .message import Message
from .track import Track, TrackArtist
from .playlist import Playlist, PlaylistTrack
from .playlist_engagement import UserPlaylistEngagement
from .playlist_transfer_track import PlaylistTransferTrack
from .rating import TrackRating, PlaylistRating
from .purchase import UserSubscription
from .ecommerce import TrackFormat, PromoCode, Cart, CartItem, Order, Purchase
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
    UserRole,
)
from .log import SystemLog
from .waitlist import Waitlist
from .operation_limit import OperationType, UserOperationLimit
from .spotify_app import SpotifyApp, UserSpotifyApp
from .consumption_event import ConsumptionEvent

# Make models available at package level
__all__ = [
    "Base",
    "Artist",
    "Party",
    "Label",
    "Genre",
    "Release",
    "Message",
    "Track",
    "TrackArtist",
    "Playlist",
    "PlaylistTrack",
    "UserPlaylistEngagement",
    "PlaylistTransferTrack",
    "TrackRating",
    "PlaylistRating",
    "TrackFormat",
    "PromoCode",
    "Cart",
    "CartItem",
    "Order",
    "Purchase",
    "UserSubscription",
    "Feedback",
    "Contact",
    "User",
    "EmailVerificationToken",
    "PasswordResetToken",
    "TwoFactorEmailCode",
    "UserSession",
    "UserAuthProvider",
    "Role",
    "Permission",
    "RolePermission",
    "UserRole",
    "SystemLog",
    "Waitlist",
    "OperationType",
    "UserOperationLimit",
    "SpotifyApp",
    "UserSpotifyApp",
    "ConsumptionEvent",
]
