"""
Schemas Package
===============

This package contains all Pydantic schemas for the Resomix Audio Similarity API,
organized by domain for clear separation of concerns. Provides request/response models,
validation schemas, and data transfer objects for all API endpoints.

Includes schemas for similarity calculations, metadata extraction, search operations,
feedback management, and contact form handling with comprehensive validation.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Common schemas used across domains
from .common import (
    APIResponse,
    ErrorResponse,
    ValidationErrorResponse,
    ValidationErrorDetail,
    PaginationRequest,
    PaginationResponse,
    PaginatedResponse,
    HealthCheckResponse,
    StatusEnum,
    FileInfo,
    TopSkRequest,
    ResponseStatus,
    ALLOWED_TOP_SK_VALUES,
    DEFAULT_TOP_SK,
    MAX_FILE_SIZE,
    ALLOWED_AUDIO_TYPES,
)

# Similarity schemas
from .similarity import (
    SimilarityByIdRequest,
    SimilarTrackResult,
    QueriedTrackInfo,
    PlaylistInfo,
    SimilarityUploadResponse,
    SimilarityByIdResponse,
    SimilarityErrorResponse,
    SimilarityUploadSuccessResponse,
    SimilarityByIdSuccessResponse,
    SimilarityServerRequest,
    SimilarityServerResponse,
    SimilarityConfiguration,
)

# Metadata schemas
from .metadata import (
    MetadataInfo,
    MetadataResponse,
    MetadataSuccessResponse,
    MetadataErrorResponse,
    MetadataExtractionError,
    AudioFileInfo,
    MetadataExtractionRequest,
    MetadataValidationResult,
    SupportedAudioFormats,
    MetadataFieldMapping,
)

# Feedback schemas
from .feedback import (
    FeedbackRequest,
    FeedbackResponse,
    FeedbackSuccessResponse,
    FeedbackErrorResponse,
    FeedbackEntity,
    FeedbackUpdateRequest,
)

# Contact schemas
from .contact import (
    ContactRequest,
    ContactResponse,
    ContactSuccessResponse,
    ContactErrorResponse,
    ContactEntity,
    ContactUpdateRequest,
)

# User search schemas
from .user import (
    UserSearchItem,
    UserSearchResultsResponse,
)

# Search schemas
from .search import (
    SearchRequest,
    SearchTrackResult,
    SearchResponse,
    SearchSuccessResponse,
    SearchErrorResponse,
    AdvancedSearchRequest,
    SearchFilters,
    SearchOptions,
    DetailedSearchRequest,
    SearchMetadata,
    DetailedSearchResponse,
    MongoSearchQuery,
    SearchServiceConfig,
)

# Preview schemas
from .preview import (
    PreviewDownloadRequest,
    PreviewDownloadResponse,
    PreviewDownloadSuccessResponse,
    PreviewErrorResponse,
    ResomixServerRequest,
    ResomixServerResponse,
)

# Playlist schemas
from .playlist import (
    PlaylistRenameRequest,
    PlaylistVisibilityRequest,
    PlaylistByIdRequest,
    PlaylistOperationResponse,
    PlaylistErrorResponse,
    PlaylistSimilarityResponse,
)

# Spotify Transfer schemas
from .spotify_transfer import (
    SpotifyTransferRequest,
    SpotifyTransferResponse,
    SpotifyTransferErrorResponse,
)

# Waitlist schemas
from .waitlist import (
    WaitlistRequest,
    WaitlistResponse,
    WaitlistSuccessResponse,
    WaitlistErrorResponse,
)

# Operation limit schemas
from .operation_limit import (
    OperationTypeResponse,
    AdminOperationTypeListResponse,
    UserOperationLimitResponse,
    UserOperationLimitListFilters,
    UserOperationLimitListResponse,
    UserOperationLimitDetailResponse,
    UserOperationLimitUpsertRequest,
    UserOperationLimitDeleteResponse,
)

# Authentication schemas
from .auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    TwoFactorRequiredResponse,
    TwoFactorVerifyRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    EmailVerificationRequest,
    ResendVerificationRequest,
    EmailVerificationResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    PasswordResetConfirmRequest,
    ChangePasswordRequest,
    UserProfileResponse,
    UpdateProfileRequest,
    UserSessionResponse,
    Enable2FARequest,
    Disable2FARequest,
    MessageResponse,
    LogoutRequest,
)

# Make all schemas available at package level
__all__ = [
    # Common
    "APIResponse",
    "ErrorResponse", 
    "ValidationErrorResponse",
    "ValidationErrorDetail",
    "PaginationRequest",
    "PaginationResponse",
    "PaginatedResponse",
    "HealthCheckResponse",
    "StatusEnum",
    "FileInfo",
    "TopSkRequest",
    "ResponseStatus",
    "ALLOWED_TOP_SK_VALUES",
    "DEFAULT_TOP_SK", 
    "MAX_FILE_SIZE",
    "ALLOWED_AUDIO_TYPES",
    
    # Similarity
    "SimilarityByIdRequest",
    "SimilarTrackResult",
    "QueriedTrackInfo",
    "PlaylistInfo",
    "SimilarityUploadResponse",
    "SimilarityByIdResponse",
    "SimilarityErrorResponse",
    "SimilarityUploadSuccessResponse",
    "SimilarityByIdSuccessResponse",
    "SimilarityServerRequest",
    "SimilarityServerResponse",
    "SimilarityConfiguration",
    
    # Metadata
    "MetadataInfo",
    "MetadataResponse",
    "MetadataSuccessResponse",
    "MetadataErrorResponse",
    "MetadataExtractionError",
    "AudioFileInfo",
    "MetadataExtractionRequest",
    "MetadataValidationResult",
    "SupportedAudioFormats",
    "MetadataFieldMapping",
    
    # Feedback
    "FeedbackRequest",
    "FeedbackResponse",
    "FeedbackSuccessResponse",
    "FeedbackErrorResponse",
    "FeedbackEntity",
    "FeedbackUpdateRequest",
    
    # Contact
    "ContactRequest",
    "ContactResponse",
    "ContactSuccessResponse",
    "ContactErrorResponse",
    "ContactEntity",
    "ContactUpdateRequest",

    # User search
    "UserSearchItem",
    "UserSearchResultsResponse",
    
    # Search
    "SearchRequest",
    "SearchTrackResult",
    "SearchResponse",
    "SearchSuccessResponse",
    "SearchErrorResponse",
    "AdvancedSearchRequest",
    "SearchFilters",
    "SearchOptions",
    "DetailedSearchRequest",
    "SearchMetadata",
    "DetailedSearchResponse",
    "MongoSearchQuery",
    "SearchServiceConfig",

    # Preview
    "PreviewDownloadRequest",
    "PreviewDownloadResponse",
    "PreviewDownloadSuccessResponse",
    "PreviewErrorResponse",
    "ResomixServerRequest",
    "ResomixServerResponse",

    # Playlist
    "PlaylistRenameRequest",
    "PlaylistVisibilityRequest",
    "PlaylistByIdRequest",
    "PlaylistOperationResponse",
    "PlaylistErrorResponse",
    "PlaylistSimilarityResponse",
    "SpotifyTransferRequest",
    "SpotifyTransferResponse",
    "SpotifyTransferErrorResponse",

    # Waitlist
    "WaitlistRequest",
    "WaitlistResponse",
    "WaitlistSuccessResponse",
    "WaitlistErrorResponse",

    # Operation limits
    "OperationTypeResponse",
    "AdminOperationTypeListResponse",
    "UserOperationLimitResponse",
    "UserOperationLimitListFilters",
    "UserOperationLimitListResponse",
    "UserOperationLimitDetailResponse",
    "UserOperationLimitUpsertRequest",
    "UserOperationLimitDeleteResponse",
    
    # Authentication
    "RegisterRequest",
    "RegisterResponse",
    "LoginRequest",
    "LoginResponse",
    "TwoFactorRequiredResponse",
    "TwoFactorVerifyRequest",
    "TokenRefreshRequest",
    "TokenRefreshResponse",
    "EmailVerificationRequest",
    "ResendVerificationRequest",
    "EmailVerificationResponse",
    "PasswordResetRequest",
    "PasswordResetResponse",
    "PasswordResetConfirmRequest",
    "ChangePasswordRequest",
    "UserProfileResponse",
    "UpdateProfileRequest",
    "UserSessionResponse",
    "Enable2FARequest",
    "Disable2FARequest",
    "MessageResponse",
    "LogoutRequest",
]
