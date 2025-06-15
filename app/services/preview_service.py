"""
Preview Service
===============

This service provides preview file validation, processing functionality, and download URL generation.
It handles audio format validation using FFmpeg, file type checking, audio stream analysis,
and communication with the ResomiX server for secure preview file access.

Manages FFmpeg availability detection, provides fallback validation methods,
and handles track validation and UUID resolution for preview downloads.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import subprocess
import tempfile
import json
import httpx
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.track_repository import TrackRepository
from app.utils.security_utils import sign_secure_url
from app.core.config import settings


class PreviewService:
    """
    Service for preview file validation, processing, and download URL generation.
    """
    
    def __init__(self):
        self.track_repository = TrackRepository()
        self.resomix_server_url = settings.resomix_server_url
        self.download_timeout = settings.preview_download_timeout
        self.max_retries = settings.preview_max_retries
    
    @staticmethod
    def is_ffmpeg_installed() -> bool:
        """
        Check if FFmpeg is installed and available in the system path.
        
        Returns:
            bool: True if FFmpeg is installed, False otherwise
        """
        try:
            # Try to run ffmpeg -version to check if it's installed
            result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
            return result.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError):
            print("[FFmpeg Validation] ERROR: FFmpeg (ffprobe) not found on system path!")
            return False

    @staticmethod
    def is_ffmpeg_available() -> bool:
        """
        Check if FFmpeg is available (alias for is_ffmpeg_installed for compatibility).
        
        Returns:
            bool: True if FFmpeg is available, False otherwise
        """
        return PreviewService.is_ffmpeg_installed()

    @staticmethod
    def validate_audio_format(audio_bytes: bytes, filename: str) -> bool:
        """
        Validate if the provided bytes represent a valid audio file by checking for an audio stream using ffprobe.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename (used for logging and potentially for hints if ffprobe needed it).
            
        Returns:
            bool: True if a valid audio stream is detected, False otherwise.
        """
        temp_path = None
        
        try:
            # Create a temporary file to pass to ffprobe
            # ffprobe can also take input from stdin, but writing to a temp file is straightforward
            # and aligns with how the function was structured.
            # Adding a suffix might help ffprobe in some edge cases, though often not strictly necessary.
            file_suffix = os.path.splitext(filename)[1] if filename else ".tmp"
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_bytes)
                # print(f"[FFmpeg Validation] Created temp file for validation: {temp_path}") # Optional: verbose logging

            # Use FFprobe to analyze the file
            cmd = [
                'ffprobe',
                '-v', 'error',             # Suppress verbose output, only errors
                '-show_format',            # Get format information
                '-show_streams',           # Get stream information
                '-print_format', 'json',   # Output as JSON
                temp_path
            ]
            
            # print(f"[FFmpeg Validation] Running FFprobe command: {' '.join(cmd)}") # Optional: verbose logging
            
            # Execute FFprobe command
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout:
                try:
                    ffprobe_output = json.loads(result.stdout)
                    if "streams" in ffprobe_output and isinstance(ffprobe_output["streams"], list):
                        for stream in ffprobe_output["streams"]:
                            if isinstance(stream, dict) and stream.get("codec_type") == "audio":
                                print(f"[FFmpeg Validation] Valid audio stream found for {filename} using ffprobe.")
                                return True  # Audio stream found
                        print(f"[FFmpeg Validation] No audio stream found in {filename} according to ffprobe.")
                        return False  # No audio stream found
                    else:
                        print(f"[FFmpeg Validation] 'streams' array not found or invalid in ffprobe output for {filename}.")
                        return False  # Streams array missing or not a list
                except json.JSONDecodeError as e:
                    print(f"[FFmpeg Validation] Failed to parse ffprobe JSON output for {filename}: {e}")
                    return False  # JSON parsing error
            else:
                # print(f"[FFmpeg Validation] FFprobe command failed or produced no output for {filename}. stderr: {result.stderr.strip()}") # Optional: verbose logging
                if "Permission denied" in result.stderr:
                     print(f"[FFmpeg Validation] FFprobe execution failed due to permission issues for {filename}.")
                elif not result.stdout:
                     print(f"[FFmpeg Validation] FFprobe produced no output for {filename}. It might not be a valid media file or is corrupted.")
                else:
                     print(f"[FFmpeg Validation] FFprobe command failed for {filename}. Return code: {result.returncode}. stderr: {result.stderr.strip()}")
                return False  # ffprobe command failed or no stdout
        
        except FileNotFoundError:
            print("[FFmpeg Validation] ERROR: ffprobe command not found. Please ensure FFmpeg (which includes ffprobe) is installed and in the system PATH.")
            return False # ffprobe not found
        except subprocess.SubprocessError as e:
            print(f"[FFmpeg Validation] Subprocess error during ffprobe execution for {filename}: {e}")
            return False
        except Exception as e:
            print(f"[FFmpeg Validation] Exception during ffprobe validation of {filename}: {str(e)}")
            return False
        
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    # print(f"[FFmpeg Validation] Removed validation temp file: {temp_path}") # Optional: verbose logging
                except Exception as e:
                    print(f"[FFmpeg Validation] Error cleaning up validation temp file {temp_path}: {str(e)}")

    async def generate_download_url(
        self, 
        db: AsyncSession,
        track_id: str
    ) -> Dict[str, Any]:
        """
        Generate signed download URL for a track by its UUID.
        
        Args:
            db: Database session
            track_id: Track UUID to generate download URL for
            
        Returns:
            Dictionary containing signed download URL or error information
        """
        if not track_id or not track_id.strip():
            return {"success": False, "error": "Track ID cannot be empty"}
        
        try:
            # Validate track exists in database
            track_exists = await self._validate_track_exists(db, track_id.strip())
            
            if not track_exists:
                return {"success": False, "error": "Track not found"}
            
            # Generate signed URL using the track UUID
            signed_url = sign_secure_url(track_id.strip())
            
            return {
                "download_url": signed_url
            }
            
        except Exception as e:
            print(f"Error in generate_download_url: {e}")
            return {"success": False, "error": "Internal server error"}

    async def _validate_track_exists(self, db: AsyncSession, track_id: str) -> bool:
        """
        Validate that a track exists in the database.
        
        Args:
            db: Database session
            track_id: Track UUID to validate
            
        Returns:
            bool: True if track exists, False otherwise
        """
        try:
            track = await self.track_repository.async_get_by_uuid(db, track_id)
            return track is not None
        except Exception as e:
            print(f"Error validating track existence: {e}")
            return False

    # Future audio processing methods can be added below
    
    @staticmethod
    def get_audio_metadata(audio_bytes: bytes, filename: str) -> Optional[dict]:
        """
        Extract audio metadata using FFprobe.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename.
            
        Returns:
            dict: Audio metadata if successful, None otherwise.
        """
        # TODO: Implement audio metadata extraction
        pass
    
    @staticmethod
    def convert_audio_format(audio_bytes: bytes, source_format: str, target_format: str) -> Optional[bytes]:
        """
        Convert audio from one format to another using FFmpeg.
        
        Args:
            audio_bytes: The raw bytes of the source audio file.
            source_format: Source audio format.
            target_format: Target audio format.
            
        Returns:
            bytes: Converted audio bytes if successful, None otherwise.
        """
        # TODO: Implement audio format conversion
        pass
    
    @staticmethod
    def extract_audio_features(audio_bytes: bytes, filename: str) -> Optional[dict]:
        """
        Extract audio features for analysis and processing.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename.
            
        Returns:
            dict: Audio features if successful, None otherwise.
        """
        # TODO: Implement audio feature extraction
        pass 