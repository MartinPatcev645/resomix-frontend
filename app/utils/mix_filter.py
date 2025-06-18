"""
Mix Filter Utility
==================

This utility provides functionality to filter out DJ mixes and long-form content
from track uploads. It validates audio files based on duration, file size, and
file extension to identify and reject tracks that are likely to be mixes.

Implements filtering rules to maintain track quality and prevent mix uploads
in the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
from typing import Optional, Dict, Any


class MixFilterConfig:
    """Configuration constants for mix filtering."""
    
    # File size limits (in bytes)
    MAX_MP3_SIZE = 50 * 1024 * 1024  # 50MB for MP3 files
    
    # Duration limits (in seconds)
    MAX_TRACK_DURATION = 30 * 60  # 30 minutes (1800 seconds)
    
    # Supported audio extensions for size-based filtering
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}


class MixFilterResult:
    """Result object for mix filter validation."""
    
    def __init__(self, is_valid: bool, reason: str = "", details: Dict[str, Any] = None):
        self.is_valid = is_valid
        self.reason = reason
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary format."""
        return {
            "is_valid": self.is_valid,
            "reason": self.reason,
            "details": self.details
        }


class MixFilter:
    """
    Filter to detect and reject DJ mixes and long-form audio content.
    
    Filtering Rules:
    1. Large MP3 files: Any MP3 file larger than 50MB
    2. Long tracks: Any audio file longer than 30 minutes (1800 seconds)
    """
    
    @staticmethod
    def validate_track(
        filename: str,
        file_size: int,
        duration: Optional[float] = None
    ) -> MixFilterResult:
        """
        Validate if a track passes the mix filter rules.
        
        Args:
            filename: The original filename of the audio file
            file_size: File size in bytes
            duration: Track duration in seconds (optional)
            
        Returns:
            MixFilterResult: Validation result with details
        """
        # Extract file extension
        file_extension = os.path.splitext(filename.lower())[1]
        
        # Rule 1: Check for large MP3 files
        if file_extension == '.mp3' and file_size > MixFilterConfig.MAX_MP3_SIZE:
            return MixFilterResult(
                is_valid=False,
                reason=f"MP3 file size ({file_size / (1024 * 1024):.1f}MB) exceeds the maximum allowed size of {MixFilterConfig.MAX_MP3_SIZE / (1024 * 1024):.0f}MB. Large MP3 files are typically DJ mixes or long-form content.",
                details={
                    "file_size_mb": round(file_size / (1024 * 1024), 1),
                    "max_size_mb": MixFilterConfig.MAX_MP3_SIZE / (1024 * 1024),
                    "file_extension": file_extension,
                    "rule_violated": "large_mp3_file"
                }
            )
        
        # Rule 2: Check for long duration tracks
        if duration is not None and duration > MixFilterConfig.MAX_TRACK_DURATION:
            minutes = duration / 60
            max_minutes = MixFilterConfig.MAX_TRACK_DURATION / 60
            return MixFilterResult(
                is_valid=False,
                reason=f"Track duration ({minutes:.1f} minutes) exceeds the maximum allowed duration of {max_minutes:.0f} minutes. Long tracks are typically DJ mixes or extended versions.",
                details={
                    "duration_minutes": round(minutes, 1),
                    "max_duration_minutes": max_minutes,
                    "duration_seconds": duration,
                    "max_duration_seconds": MixFilterConfig.MAX_TRACK_DURATION,
                    "file_extension": file_extension,
                    "rule_violated": "long_duration"
                }
            )
        
        # If all checks pass
        return MixFilterResult(
            is_valid=True,
            reason="Track passes all mix filter validation rules",
            details={
                "file_size_mb": round(file_size / (1024 * 1024), 1),
                "duration_minutes": round(duration / 60, 1) if duration else None,
                "file_extension": file_extension
            }
        )
    
    @staticmethod
    def get_filter_info() -> Dict[str, Any]:
        """
        Get information about the current filter configuration.
        
        Returns:
            dict: Filter configuration details
        """
        return {
            "rules": [
                {
                    "name": "Large MP3 Files",
                    "description": f"MP3 files larger than {MixFilterConfig.MAX_MP3_SIZE / (1024 * 1024):.0f}MB are rejected",
                    "max_size_mb": MixFilterConfig.MAX_MP3_SIZE / (1024 * 1024),
                    "applies_to": "MP3 files only"
                },
                {
                    "name": "Long Duration Tracks",
                    "description": f"Audio files longer than {MixFilterConfig.MAX_TRACK_DURATION / 60:.0f} minutes are rejected",
                    "max_duration_minutes": MixFilterConfig.MAX_TRACK_DURATION / 60,
                    "applies_to": "All audio formats"
                }
            ],
            "supported_extensions": list(MixFilterConfig.AUDIO_EXTENSIONS),
            "rationale": "These rules help filter out DJ mixes, live sets, and other long-form content to maintain track quality"
        }
    
    @staticmethod
    def is_audio_file(filename: str) -> bool:
        """
        Check if a file is a recognized audio file based on extension.
        
        Args:
            filename: The filename to check
            
        Returns:
            bool: True if it's a recognized audio file extension
        """
        file_extension = os.path.splitext(filename.lower())[1]
        return file_extension in MixFilterConfig.AUDIO_EXTENSIONS


# Convenience function for easy import and usage
def validate_track_for_mixes(filename: str, file_size: int, duration: Optional[float] = None) -> MixFilterResult:
    """
    Convenience function to validate a track against mix filter rules.
    
    Args:
        filename: The original filename of the audio file
        file_size: File size in bytes
        duration: Track duration in seconds (optional)
        
    Returns:
        MixFilterResult: Validation result
    """
    return MixFilter.validate_track(filename, file_size, duration)
