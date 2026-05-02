# ruff: noqa: E402
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs

# Create SQLAlchemy Base class
class Base(AsyncAttrs, DeclarativeBase):
    pass

# Import all models to register them with SQLAlchemy
from .party import Party
from .label import Label
from .artist import Artist
from .genre import Genre
from .message import Message
from .release import Release
from .track import Track
from .recording_artist import RecordingArtist
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
    UserToken,
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
from .sftp_user import SftpUser

# Make models available at package level
__all__ = [
    "Base",
    "Party",
    "Label",
    "Artist",
    "Genre",
    "Release",
    "Message",
    "Track",
    "RecordingArtist",
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
    "UserToken",
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
    "SftpUser",
]
