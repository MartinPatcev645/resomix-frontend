"""
Schemas Package
===============

This package contains all Pydantic schemas for the Resomix API,
organized by domain for clear separation of concerns.

Author: AI Assistant
Date: December 2024
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
] 