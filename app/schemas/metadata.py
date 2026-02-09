"""
Metadata Schemas
================

This module contains Pydantic schemas for audio metadata extraction functionality.
It defines request and response models for metadata retrieval, file validation,
and audio information processing with comprehensive validation and error handling.

Provides schemas for metadata extraction requests, audio file information,
format validation, and detailed metadata field mapping and enrichment.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Dict
from pydantic import BaseModel, Field


class MetadataInfo(BaseModel):
    """Schema for extracted audio metadata."""
    Title: Optional[str] = Field(None, description="Track title")
    Album: Optional[str] = Field(None, description="Album name")
    Artist: Optional[str] = Field(None, description="Artist name")
    Genre: Optional[str] = Field(None, description="Genre")
    Year: Optional[str] = Field(None, description="Release year")
    Label: Optional[str] = Field(None, description="Record label")

    class Config:
        json_schema_extra = {
            "example": {
                "Title": "Amazing Song",
                "Album": "Great Album",
                "Artist": "Fantastic Artist",
                "Genre": "Electronic",
                "Year": "2023",
                "Label": "Cool Records"
            }
        }


class MetadataResponse(BaseModel):
    """Response schema for metadata extraction."""
    filename: str = Field(..., description="Sanitized filename of the uploaded file")
    metadata: MetadataInfo = Field(..., description="Extracted metadata information")

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "amazing_song.mp3",
                "metadata": {
                    "Title": "Amazing Song",
                    "Album": "Great Album",
                    "Artist": "Fantastic Artist",
                    "Genre": "Electronic",
                    "Year": "2023",
                    "Label": "Cool Records"
                }
            }
        }


class MetadataSuccessResponse(BaseModel):
    """Success response wrapper for metadata extraction."""
    success: bool = Field(True, description="Always true for successful responses")
    data: MetadataResponse = Field(..., description="Metadata extraction results")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "filename": "amazing_song.mp3",
                    "metadata": {
                        "Title": "Amazing Song",
                        "Album": "Great Album", 
                        "Artist": "Fantastic Artist",
                        "Genre": "Electronic",
                        "Year": "2023",
                        "Label": "Cool Records"
                    }
                }
            }
        }


class MetadataErrorResponse(BaseModel):
    """Error response schema for metadata extraction."""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message describing what went wrong")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Unsupported audio format or corrupted file"
            }
        }


class MetadataExtractionError(BaseModel):
    """Schema for metadata extraction errors from Mutagen."""
    error: str = Field(..., description="Error message from metadata extraction library")

    class Config:
        json_schema_extra = {
            "example": {
                "error": "FileTypeError: file type could not be determined"
            }
        }


# Internal schemas for service layer
class AudioFileInfo(BaseModel):
    """Schema for audio file information."""
    filename: str = Field(..., description="Original filename")
    content_type: Optional[str] = Field(None, description="MIME content type")
    size: Optional[int] = Field(None, description="File size in bytes")
    is_valid: bool = Field(..., description="Whether the file passed validation")


class MetadataExtractionRequest(BaseModel):
    """Internal schema for metadata extraction requests."""
    file_data: bytes = Field(..., description="Audio file binary data")
    filename: str = Field(..., description="Original filename")
    content_type: Optional[str] = Field(None, description="MIME content type")


class MetadataValidationResult(BaseModel):
    """Schema for file validation results."""
    is_valid: bool = Field(..., description="Whether the file is valid")
    error_message: Optional[str] = Field(None, description="Error message if invalid")
    detected_format: Optional[str] = Field(None, description="Detected audio format")


class SupportedAudioFormats(BaseModel):
    """Schema for supported audio formats configuration."""
    formats: list[str] = Field(
        default=[
            "mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus", "aiff"
        ],
        description="List of supported audio file extensions"
    )
    mime_types: list[str] = Field(
        default=[
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", 
            "audio/ogg", "audio/aac", "audio/m4a", "audio/x-ms-wma",
            "audio/opus", "audio/aiff"
        ],
        description="List of supported MIME types"
    )


class MetadataFieldMapping(BaseModel):
    """Schema for metadata field mappings between different formats."""
    id3_map: Dict[str, str] = Field(
        default={
            "TIT2": "Title",
            "TALB": "Album", 
            "TPE1": "Artist",
            "TCON": "Genre",
            "TDRC": "Year",
            "TYER": "Year",
            "TPUB": "Label"
        },
        description="ID3 tag to field mapping"
    )
    vorbis_map: Dict[str, str] = Field(
        default={
            "TITLE": "Title",
            "ALBUM": "Album",
            "ARTIST": "Artist", 
            "GENRE": "Genre",
            "YEAR": "Year",
            "DATE": "Year",
            "LABEL": "Label",
            "PUBLISHER": "Label"
        },
        description="Vorbis comment to field mapping"
    ) 