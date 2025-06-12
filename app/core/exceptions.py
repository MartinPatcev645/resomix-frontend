"""
Custom Exceptions
================

This module provides custom exception classes for different error types
that replace standard HTTPException usage throughout the application.

Exception Classes:
- AuthenticationError: For API key and credential validation errors (403)
- ValidationError: For input validation and processing errors (422)
- NotFoundError: For resource not found errors (404)
- UnsupportedMediaTypeError: For invalid file types and formats (415)
- ServiceUnavailableError: For external service failures (503)
- InternalServerError: For unexpected server errors (500)

Author: AI Assistant
Date: May 2023
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
