"""
Similarity Controller
====================

This controller handles HTTP requests for audio similarity functionality.
It processes uploaded audio files and track ID requests, validates inputs,
and coordinates with similarity and audio services to return similar tracks.

Manages file upload validation, audio format checking, and response formatting
for both upload-based and ID-based similarity queries.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Similarity controller 
import os
import uuid
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.similarity_service import SimilarityService
from app.services.search_service import SearchService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.utils.logging_utils import log_request


class SimilarityController:
    def __init__(self):
        self.similarity_service = SimilarityService()
        self.search_service = SearchService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()

    async def get_similarity_upload(self, db: AsyncSession, file: UploadFile, top_sk: Optional[int] = None) -> JSONResponse:
        """
        Process an audio file: first upload to database, then return similar tracks.
        """
        # Validate and get the TOP_SK value using global settings
        validated_top_sk = settings.validate_and_get_top_sk(top_sk)
        actual_top_k = settings.calculate_actual_top_k(validated_top_sk)
        duplication_threshold = settings.get_duplication_threshold_for_top_sk(validated_top_sk)
        
        log_request("get_similarity (upload)", "POST", {
            "filename": file.filename, 
            "requested_top_sk": top_sk, 
            "validated_top_sk": validated_top_sk
        })
        
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

        # Read audio bytes for processing
        audio_bytes = await file.read()
        original_filename = sanitize_filename(file.filename)

        # Use audio service to validate file
        is_ffmpeg_available = self.audio_service.is_ffmpeg_available()
        
        if is_ffmpeg_available:
            is_valid_audio = self.audio_service.validate_audio_format(audio_bytes, original_filename)
            if not is_valid_audio:
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(
                        success=False,
                        error="The uploaded file does not contain valid audio streams according to our analysis."
                    )
                )
            
            # Audio validation passed, now upload to database first
            try:
                # Reset file pointer for track upload service
                await file.seek(0)
                
                # STEP 1: Upload track to database with metadata extraction
                import asyncio
                upload_result = await asyncio.to_thread(
                    self.track_upload_service.upload_track_to_database, 
                    file, 
                    audio_bytes
                )
                
                if not upload_result.get("success", False):
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=format_response(
                            success=False, 
                            error=f"Failed to upload track to database: {upload_result.get('error', 'Unknown error')}"
                        )
                    )
                
                # STEP 2: Now perform similarity analysis
                similarity_results = await self.similarity_service.calculate_similarity_for_upload(
                    db=db,
                    audio_bytes=audio_bytes, 
                    original_filename=original_filename, 
                    top_k=actual_top_k,
                    similarity_duplication_threshold=duplication_threshold
                )
                
                if similarity_results.get("success") is False:
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False, 
                            error=similarity_results.get("error", "Similarity processing failed.")
                        )
                    )
                
                # STEP 3: Combine results - include both upload info and similarity results
                combined_results = {
                    # Original similarity results
                    "original_filename": similarity_results.get("original_filename"),
                    "duration": similarity_results.get("duration"),
                    "similar_tracks": similarity_results.get("similar_tracks", []),
                    
                    # NEW: Track upload information
                    "uploaded_track": {
                        "uuid": upload_result["uuid"],
                        "track_id": upload_result["track_id"],
                        "file_size": upload_result["file_size"],
                        "metadata": {
                            "title": upload_result["metadata"].get("Title", ""),
                            "artist": ", ".join(upload_result["artist_names"]),
                            "album": upload_result["album_title"] or "",
                            "genre": upload_result["genre_name"],
                            "label": upload_result["label_name"] or "",
                            "year": upload_result["metadata"].get("Year", "")
                        },
                        "preview_path": f"/mnt/data/UPLOADS/{upload_result['uuid']}.mp3"
                    }
                }
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data=combined_results)
                )
                
            except Exception as e:
                print(f"An error occurred in get_similarity (upload with database): {e}")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error="An internal server error occurred.")
                )

        else:  # FFmpeg not available, fall back to saving file and basic content type check
            print(f"WARNING: FFmpeg not available. Performing basic content type check for: {original_filename} and saving to temp file.")
            if not file.content_type or not file.content_type.startswith("audio/"):
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(
                        success=False,
                        error="Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis."
                    )
                )
            
            temp_file_path = ""
            try:
                unique_filename = f"{str(uuid.uuid4())}_{original_filename}"
                temp_file_path = os.path.join(settings.temp_dir, unique_filename)
                with open(temp_file_path, "wb") as buffer:
                    buffer.write(audio_bytes)

                # STEP 1: Upload track to database first (even without FFmpeg)
                await file.seek(0)
                
                import asyncio
                upload_result = await asyncio.to_thread(
                    self.track_upload_service.upload_track_to_database, 
                    file, 
                    audio_bytes
                )
                
                if not upload_result.get("success", False):
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=format_response(
                            success=False, 
                            error=f"Failed to upload track to database: {upload_result.get('error', 'Unknown error')}"
                        )
                    )

                # STEP 2: Perform similarity analysis
                print("FFmpeg not available. Cannot guarantee audio validity before sending to similarity server. Proceeding with byte upload with caution.")
                similarity_results = await self.similarity_service.calculate_similarity_for_upload(
                    db=db,
                    audio_bytes=audio_bytes, 
                    original_filename=original_filename,
                    top_k=actual_top_k,
                    similarity_duplication_threshold=duplication_threshold
                )
                
                if similarity_results.get("success") is False:
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False, 
                            error=similarity_results.get("error", "Similarity processing failed.")
                        )
                    )
                
                # STEP 3: Combine results
                combined_results = {
                    # Original similarity results
                    "original_filename": similarity_results.get("original_filename"),
                    "duration": similarity_results.get("duration"),
                    "similar_tracks": similarity_results.get("similar_tracks", []),
                    
                    # NEW: Track upload information
                    "uploaded_track": {
                        "uuid": upload_result["uuid"],
                        "track_id": upload_result["track_id"],
                        "file_size": upload_result["file_size"],
                        "metadata": {
                            "title": upload_result["metadata"].get("Title", ""),
                            "artist": ", ".join(upload_result["artist_names"]),
                            "album": upload_result["album_title"] or "",
                            "genre": upload_result["genre_name"],
                            "label": upload_result["label_name"] or "",
                            "year": upload_result["metadata"].get("Year", "")
                        },
                        "preview_path": f"/mnt/data/UPLOADS/{upload_result['uuid']}.mp3"
                    }
                }
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data=combined_results)
                )

            except Exception as e:
                print(f"An error occurred in get_similarity (upload, no FFmpeg, fallback with bytes): {e}")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error="An internal server error occurred.")
                )
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.remove(temp_file_path)

    async def get_similarity_by_id(
        self,
        db: AsyncSession,
        track_id: str,
        top_sk: Optional[int] = None
    ) -> JSONResponse:
        """
        Get similar tracks for a track identified by its UUID.
        
        Args:
            db: Database session
            track_id: The track UUID to find similar tracks for
            top_sk: Number of similar tracks to return
            
        Returns:
            JSON response with similar tracks
        """
        try:
            # Validate track_id
            if not track_id or not track_id.strip():
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error="track_id cannot be empty"
                    )
                )
            
            # Get file path from MariaDB using track UUID
            server_track_path = await self.similarity_service.get_track_path_by_uuid(db, track_id)
            
            if server_track_path is None:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=f"Track with ID '{track_id}' not found or path is missing"
                    )
                )
            
            # Validate and get the TOP_SK value using settings
            validated_top_sk = settings.validate_and_get_top_sk(top_sk)
            actual_top_k = settings.calculate_actual_top_k(validated_top_sk)
            duplication_threshold = settings.get_duplication_threshold_for_top_sk(validated_top_sk)
            
            # Call similarity service with the file path
            similarity_results = await self.similarity_service.get_similarity_by_path(
                db=db,
                server_track_path=server_track_path,
                top_k=actual_top_k,
                similarity_duplication_threshold=duplication_threshold
            )
            
            # Check if similarity processing failed
            if similarity_results.get("success") is False:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=format_response(
                        success=False,
                        error=similarity_results.get("error", "Similarity processing failed")
                    )
                )
            
            # Return successful response
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=similarity_results)
            )
            
        except Exception as e:
            print(f"Error in get_similarity_by_id: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing similarity by ID"
                )
            )
