# ruff: noqa: E402
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs

# Create SQLAlchemy Base class
class Base(AsyncAttrs, DeclarativeBase):
    pass

# Import all models to register them with SQLAlchemy
from .party import Party
from .label import Label
from .genre import Genre
from .contributor import Contributor
from .message import Message
from .release import Release
from .track import Track
from .track_contributor import TrackContributor
from .release_track import ReleaseTrack
from .release_contributor import ReleaseContributor
from .audio_file import AudioFile
from .image_file import ImageFile
from .document_file import DocumentFile
from .release_file import ReleaseFile
from .user_track_engagement import UserTrackEngagement
from .playlist import Playlist, PlaylistTrack
from .playlist_engagement import UserPlaylistEngagement
from .playlist_transfer_track import PlaylistTransferTrack
from .rating import TrackRating, PlaylistRating
from .purchase import UserSubscription
from .ecommerce import PromoCode, Cart, CartItem, Order, Purchase
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
from .b2b import IngestLog, IngestionError, Deal, ReleaseDeal, DealTerritory, DealUseType, RoyaltyRate
from .copyright import ManualTakedown, ACRInfringementLog
from .report import GeneratedReport, LabelPayout

# Make models available at package level
__all__ = [
    "Base",
    "Party",
    "Label",
    "Genre",
    "Contributor",
    "Release",
    "Message",
    "Track",
    "TrackContributor",
    "ReleaseTrack",
    "ReleaseContributor",
    "AudioFile",
    "ImageFile",
    "DocumentFile",
    "ReleaseFile",
    "UserTrackEngagement",
    "Playlist",
    "PlaylistTrack",
    "UserPlaylistEngagement",
    "PlaylistTransferTrack",
    "TrackRating",
    "PlaylistRating",
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
    "IngestLog",
    "IngestionError",
    "Deal",
    "ReleaseDeal",
    "DealTerritory",
    "DealUseType",
    "RoyaltyRate",
    "ManualTakedown",
    "ACRInfringementLog",
    "GeneratedReport",
    "LabelPayout",
]
