"""
Custom Exceptions
=================

This module defines custom exception classes for the Resomix application.
It provides specialized exceptions for different error scenarios including
authentication, validation, file handling, and external service failures.

Centralizes error handling with consistent status codes and error messages
across all application components and API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Any


class ResomixBaseException(Exception):
    """Base exception class for all Resomix application exceptions."""
    
    def __init__(self, message: str, status_code: int, details: Optional[Any] = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class AuthenticationError(ResomixBaseException):
    """Exception raised for authentication and authorization errors."""
    
    def __init__(self, message: str = "Could not validate credentials", details: Optional[Any] = None):
        super().__init__(message, 403, details)


class ValidationError(ResomixBaseException):
    """Exception raised for input validation and processing errors."""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, 422, details)


class NotFoundError(ResomixBaseException):
    """Exception raised when a requested resource is not found."""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, 404, details)


class UnsupportedMediaTypeError(ResomixBaseException):
    """Exception raised for invalid file types and formats."""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, 415, details)


class ServiceUnavailableError(ResomixBaseException):
    """Exception raised when external services are unavailable or fail."""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, 503, details)


class InternalServerError(ResomixBaseException):
    """Exception raised for unexpected internal server errors."""
    
    def __init__(self, message: str = "An internal server error occurred", details: Optional[Any] = None):
        super().__init__(message, 500, details)


class FileSizeError(ValidationError):
    """Exception raised when uploaded files exceed size limits."""
    
    def __init__(self, max_size_mb: int, details: Optional[Any] = None):
        message = f"File too large. Maximum size is {max_size_mb}MB."
        super().__init__(message, details)


class EmptyFileError(ValidationError):
    """Exception raised when uploaded files are empty."""
    
    def __init__(self, details: Optional[Any] = None):
        message = "File is empty. Please upload a valid audio file."
        super().__init__(message, details)


class EmptyTrackIdError(ValidationError):
    """Exception raised when track_id is empty or invalid."""
    
    def __init__(self, details: Optional[Any] = None):
        message = "track_id cannot be empty."
        super().__init__(message, details)


class TrackNotFoundError(NotFoundError):
    """Exception raised when a track is not found by ID."""
    
    def __init__(self, track_id: str, details: Optional[Any] = None):
        message = f"Track with ID '{track_id}' not found or path is missing."
        super().__init__(message, details)


class AudioValidationError(UnsupportedMediaTypeError):
    """Exception raised when audio files fail validation."""
    
    def __init__(self, message: str = "The uploaded file does not contain valid audio streams according to our analysis.", details: Optional[Any] = None):
        super().__init__(message, details)


class ContentTypeError(UnsupportedMediaTypeError):
    """Exception raised for invalid content types."""
    
    def __init__(self, message: str = "Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis.", details: Optional[Any] = None):
        super().__init__(message, details)


class MetadataExtractionError(UnsupportedMediaTypeError):
    """Exception raised when metadata extraction fails."""
    
    def __init__(self, error_message: str, details: Optional[Any] = None):
        super().__init__(error_message, details)


class SimilarityProcessingError(ServiceUnavailableError):
    """Exception raised when similarity processing fails."""
    
    def __init__(self, message: str = "Similarity processing failed.", details: Optional[Any] = None):
        super().__init__(message, details)


class PublicHttpError(ResomixBaseException):
    """Public-facing HTTP error for API responses.

    This exception is intended to be raised deep within the service or
    repository layers when we want to bubble up an error to the API layer
    with a *safe* error message and optional structured details. It carries a
    short machine-readable `code`, the HTTP status code (also exposed via the
    `status` alias for backwards-compatibility) and arbitrary JSON-serialisable
    `details`.
    """

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN",
        status: int = 500,
        details: Optional[Any] = None,
    ) -> None:
        # Keep the base status_code attribute for consistency with other
        # Resomix exceptions while also exposing `status` to match existing
        # usages inside services and routers.
        self.code: str = code
        self.status: int = status
        super().__init__(message, status, details)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PublicHttpError {self.status} {self.code}: {self.message}>"
