"""
Monthly Pipeline Controller
===========================

This controller handles HTTP requests for monthly pipeline track functionality.
It processes uploaded audio files for monthly pipeline processing, validates inputs,
and coordinates with services to generate embedding previews and store tracks.

Manages file upload validation, metadata extraction, embedding preview generation,
and database storage for monthly pipeline tracks.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import asyncio
from typing import Optional
from fastapi import UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.constants import TrackType
from app.services.monthly_pipeline_service import MonthlyPipelineService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.utils.logging_utils import log_request
from app.utils.mix_filter import validate_track_for_mixes


class MonthlyPipelineController:
    """Controller for handling monthly pipeline track operations."""
    
    def __init__(self):
        self.monthly_pipeline_service = MonthlyPipelineService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()

    async def process_monthly_pipeline_track(
        self, 
        db: AsyncSession, 
        file: UploadFile, 
        path: str
    ) -> JSONResponse:
        """
        Process an audio file for the monthly pipeline: extract metadata, generate UUID,
        send to similarity server's generate_embedding_preview endpoint, then store in database.
        
        Args:
            db: Database session
            file: The uploaded audio file
            path: The path field for the track
            
        Returns:
            JSON response with processing status
        """
        log_request("monthly_pipeline_track", "POST", {
            "filename": file.filename,
            "path": path
        })
        
        # STEP 0: Check if this path already exists in database (duplicate check)
        try:
            from database.connection import engine
            from sqlalchemy import text
            
            with engine.begin() as conn:
                # Check if a track with this path already exists
                check_result = conn.execute(
                    text("SELECT uuid FROM tracks WHERE file_path = :path LIMIT 1"),
                    {"path": path}
                )
                existing_track = check_result.first()
                
                if existing_track:
                    print(existing_track)
                    existing_uuid = existing_track
                    print(f"[DUPLICATE CHECK] Track already exists with path: {path}")
                    print(f"  - Existing UUID: {existing_uuid}")
                    
                    return JSONResponse(
                        status_code=status.HTTP_200_OK,
                        content=format_response(
                            success=True,
                            data={
                                "message": "Track already exists in database with this path",
                                "existing_track_uuid": existing_uuid,
                                "path": path,
                                "skipped_processing": True
                            }
                        )
                    )
                    
        except Exception as e:
            print(f"Error during duplicate check: {e}")
            # Continue with processing if duplicate check fails
            pass
        
        # File Size Check using settings
        if file.size > settings.max_file_size:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                content=format_response(
                    success=False,
                    error=f"File too large. Maximum size is {settings.max_file_size // (1024 * 1024)}MB."
                )
            )

        # Check if the file is empty
        if file.size == 0:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(
                    success=False,
                    error="File is empty. Please upload a valid audio file."
                )
            )

        try:
            # Read audio bytes for processing
            audio_bytes = await file.read()
            original_filename = sanitize_filename(file.filename)

            # Use audio service to validate file
            is_ffmpeg_available = self.audio_service.is_ffmpeg_available()
            duration = None  # Initialize duration variable
            
            if is_ffmpeg_available:
                # STEP 1: Validate audio format using FFmpeg
                is_valid_audio = self.audio_service.validate_audio_format(audio_bytes, original_filename)
                if not is_valid_audio:
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=format_response(
                            success=False,
                            error="The uploaded file does not contain valid audio streams according to our analysis."
                        )
                    )
                
                # STEP 2: Extract duration using FFmpeg
                duration = self.audio_service.get_audio_duration(audio_bytes, original_filename)
                
                # STEP 3: Apply mix filter validation
                mix_filter_result = validate_track_for_mixes(
                    filename=original_filename,
                    file_size=file.size,
                    duration=duration
                )
                
                if not mix_filter_result.is_valid:
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=format_response(
                            success=False,
                            error=f"Track rejected by mix filter: {mix_filter_result.reason}"
                        )
                    )
                
            else:
                # Basic content type check if FFmpeg not available
                if not file.content_type or not file.content_type.startswith("audio/"):
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=format_response(
                            success=False,
                            error="Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis."
                        )
                    )
                
                # If FFmpeg is not available, we can still do basic mix filtering based on file size and extension
                # but without duration check
                mix_filter_result = validate_track_for_mixes(
                    filename=original_filename,
                    file_size=file.size,
                    duration=None  # No duration available without FFmpeg
                )
                
                if not mix_filter_result.is_valid:
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=format_response(
                            success=False,
                            error=f"Track rejected by mix filter: {mix_filter_result.reason}"
                        )
                    )

            # STEP 4: Extract metadata and generate UUID (but don't store in database yet)
            await file.seek(0)  # Reset file pointer
            
            # Extract metadata using metadata service
            try:
                metadata = self.track_upload_service.metadata_service.extract_metadata(
                    file.file, file.filename, mode="limited"
                )
                if "error" in metadata:
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=format_response(
                            success=False,
                            error=f"Metadata extraction failed: {metadata['error']}"
                        )
                    )
            except Exception as e:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(
                        success=False,
                        error=f"Error during metadata extraction: {str(e)}"
                    )
                )

            # Generate UUID for the track
            track_uuid = generate_track_uuid()
            
            # STEP 5: Send to similarity server's generate_embedding_preview endpoint
            embedding_result = await self.monthly_pipeline_service.generate_embedding_preview(
                audio_bytes=audio_bytes,
                original_filename=original_filename,
                track_uuid=track_uuid,
                path=path
            )
            
            if not embedding_result.get("success", False):
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=format_response(
                        success=False,
                        error=embedding_result.get("error", "Failed to generate embedding preview")
                    )
                )
            
            # STEP 6: If similarity server was successful, now store in database
            await file.seek(0)  # Reset file pointer for database upload
            
            # Convert duration to integer seconds for database (if available)
            duration_sec = int(round(duration)) if duration is not None else None
            
            # PRODUCTION MODE: Actually save to database
            upload_result = await asyncio.to_thread(
                self.track_upload_service.upload_track_to_database_with_uuid,
                file, 
                audio_bytes,
                track_uuid,  # Use the same UUID we sent to similarity server
                track_type=TrackType.ELECTROBUZZ,  # Mark as electrobuzz track
                duration_sec=duration_sec  # Pass the probed duration
            )
            
            if not upload_result.get("success", False):
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(
                        success=False, 
                        error=f"Failed to store track in database: {upload_result.get('error', 'Unknown error')}"
                    )
                )
            
            # Return success response
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True, 
                    data={
                        "message": "Track processed successfully and stored in database",
                        "track_uuid": track_uuid,
                        "path": path
                    }
                )
            )
            
        except Exception as e:
            print(f"An error occurred in monthly_pipeline_track: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            )
