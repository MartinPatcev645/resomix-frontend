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
from fastapi import UploadFile, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.playlist_service import PlaylistService
from app.core.config import settings
from app.services.similarity_service import SimilarityService
from app.services.search_service import SearchService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.services.logging_service import LoggingService
import time


class SimilarityController:
    def __init__(self):
        self.similarity_service = SimilarityService()
        self.playlist_service = PlaylistService()
        self.search_service = SearchService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()
        self.logging_service = LoggingService()

    async def get_similarity_upload(self, db: AsyncSession, request: Request, file: UploadFile, top_sk: Optional[int] = None) -> JSONResponse:
        """
        Process an audio file: first upload to database, then return similar tracks.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        # Validate and get the TOP_SK value using global settings
        validated_top_sk = settings.validate_and_get_top_sk(top_sk)
        actual_top_k = settings.calculate_actual_top_k(validated_top_sk)
        duplication_threshold = settings.get_duplication_threshold_for_top_sk(validated_top_sk)
        
        # Log operation start (complex upload)
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="SIMILARITY",
            action="upload_start",
            message="Starting similarity upload processing",
            correlation_id=correlation_id,
            request=request,
            method=request.method,
            endpoint=str(request.url.path),
            path=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
            duration_ms=duration_ms,
            context="Similarity upload processing pipeline",
            metadata={
                "requested_top_sk": top_sk,
                "validated_top_sk": validated_top_sk,
                "file_size": file.size
            },
            filename=file.filename,
            file_size=file.size,
            operation="similarity_upload"
        )
        
        # File Size Check using settings
        if file.size > settings.max_file_size:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="file_size_validation_failed",
                message="File too large for similarity processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="File validation during similarity upload",
                metadata={
                    "error": "File too large",
                    "file_size": file.size,
                    "max_allowed_size": settings.max_file_size,
                    "validation_step": "file_size_check"
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload"
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                content=format_response(
                    success=False,
                    error=f"File too large. Maximum size is {settings.max_file_size // (1024 * 1024)}MB."
                )
            )

        # Check if the file is empty
        if file.size == 0:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="file_empty_validation_failed",
                message="Empty file uploaded for similarity processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="File validation during similarity upload",
                metadata={
                    "error": "File is empty",
                    "file_size": file.size,
                    "validation_step": "empty_file_check"
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload"
            )
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
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="audio_format_validation_failed",
                    message="Invalid audio format detected during similarity upload",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=415,
                    duration_ms=duration_ms,
                    context="Audio format validation during similarity upload",
                    metadata={
                        "error": "File is not valid audio",
                        "ffmpeg_available": is_ffmpeg_available,
                        "validation_step": "audio_format_check",
                        "file_content_type": file.content_type
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
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
                upload_result = await self.track_upload_service.upload_track_to_database(
                    db,
                    file, 
                    audio_bytes
                )
                
                if not upload_result.get("success", False):
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="track_upload_failed",
                        message="Failed to upload track to database during similarity processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=500,
                        duration_ms=duration_ms,
                        context="Track upload phase of similarity processing",
                        metadata={
                            "error": "Failed to upload track to database",
                            "upload_result": upload_result,
                            "processing_step": "track_upload",
                            "ffmpeg_available": True
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload"
                    )
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
                    track_uuid=upload_result["uuid"],
                    top_k=actual_top_k,
                    similarity_duplication_threshold=duplication_threshold
                )
                
                if similarity_results.get("success") is False:
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="similarity_processing_failed",
                        message="Similarity analysis failed during upload processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=503,
                        duration_ms=duration_ms,
                        track_id=int(upload_result.get("track_id")) if upload_result.get("track_id") else None,
                        context="Similarity analysis phase of upload processing",
                        metadata={
                            "error": "Similarity processing failed",
                            "similarity_error": similarity_results.get("error"),
                            "processing_step": "similarity_analysis",
                            "track_uuid": upload_result.get("uuid"),
                            "ffmpeg_available": True
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False, 
                            error=similarity_results.get("error", "Similarity processing failed.")
                        )
                    )

                generated_playlist_uuid = similarity_results.get("data")["playlist"]["id"]
                print(generated_playlist_uuid)
                
                playlist = await self.playlist_service.playlist_repository.async_get_playlist_by_uuid(db, generated_playlist_uuid)
                playlist_int_id = playlist.id if playlist else None

                print(playlist_int_id)
                
                # STEP 3: Return response in same format as similarity by ID
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(success=True, data=similarity_results)
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SIMILARITY",
                    action="upload_success",
                    message="Similarity upload processing completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    playlist_id=playlist_int_id,
                    track_id=int(upload_result.get("track_id")) if upload_result.get("track_id") else None,
                    context="Successful completion of similarity upload processing",
                    metadata={
                        "similarity_results": similarity_results,
                        "track_uuid": upload_result.get("uuid"),
                        "processing_steps": ["file_validation", "track_upload", "similarity_analysis"],
                        "ffmpeg_available": True,
                        "response": response_content
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_content
                )
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                import traceback
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="upload_exception",
                    message="Unexpected error during similarity upload processing",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    stack_trace=traceback.format_exc(),
                    context="Similarity upload with database processing",
                    metadata={
                        "error": "An internal server error occurred.",
                        "exception_type": type(e).__name__,
                        "ffmpeg_available": is_ffmpeg_available
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error="An internal server error occurred.")
                )

        else:  # FFmpeg not available, fall back to saving file and basic content type check
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SYSTEM",
                action="ffmpeg_unavailable",
                message="FFmpeg not available during similarity upload, falling back to basic validation",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                context="Similarity upload fallback processing",
                metadata={
                    "ffmpeg_available": False,
                    "validation_method": "content_type_only"
                },
                filename=file.filename,
                file_size=file.size,
                operation="similarity_upload"
            )
            if not file.content_type or not file.content_type.startswith("audio/"):
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="content_type_validation_failed",
                    message="Content-Type validation failed during fallback similarity upload",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=415,
                    duration_ms=duration_ms,
                    context="Content-Type validation during fallback similarity upload",
                    metadata={
                        "error": "Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis.",
                        "file_content_type": file.content_type,
                        "ffmpeg_available": False,
                        "validation_method": "content_type_only"
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
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
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="track_upload_failed",
                        message="Failed to upload track to database during fallback similarity processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=500,
                        duration_ms=duration_ms,
                        context="Track upload phase of fallback similarity processing",
                        metadata={
                            "error": "Failed to upload track to database",
                            "upload_result": upload_result,
                            "processing_step": "track_upload",
                            "ffmpeg_available": False
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content=format_response(
                            success=False, 
                            error=f"Failed to upload track to database: {upload_result.get('error', 'Unknown error')}"
                        )
                    )

                # STEP 2: Perform similarity analysis
                # Log fallback warning
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="fallback_processing",
                    message="Processing similarity upload using fallback method without FFmpeg",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    context="Fallback similarity processing without FFmpeg",
                    metadata={
                        "ffmpeg_available": False,
                        "processing_method": "fallback",
                        "track_uuid": upload_result.get("uuid")
                    },
                    filename=original_filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
                similarity_results = await self.similarity_service.calculate_similarity_for_upload(
                    db=db,
                    audio_bytes=audio_bytes, 
                    original_filename=original_filename,
                    track_uuid=upload_result["uuid"],
                    top_k=actual_top_k,
                    similarity_duplication_threshold=duplication_threshold
                )
                
                if similarity_results.get("success") is False:
                    duration_ms = (time.time() - start_time) * 1000
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="SIMILARITY",
                        action="similarity_processing_failed",
                        message="Similarity analysis failed during fallback upload processing",
                        correlation_id=correlation_id,
                        request=request,
                        method=request.method,
                        endpoint=str(request.url.path),
                        path=str(request.url),
                        query_params=dict(request.query_params),
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        referer=request.headers.get("referer"),
                        status_code=503,
                        duration_ms=duration_ms,
                        track_id=int(upload_result.get("track_id")) if upload_result.get("track_id") else None,
                        context="Similarity analysis phase of fallback upload processing",
                        metadata={
                            "error": "Similarity processing failed",
                            "similarity_error": similarity_results.get("error"),
                            "processing_step": "similarity_analysis",
                            "track_uuid": upload_result.get("uuid"),
                            "ffmpeg_available": False
                        },
                        filename=file.filename,
                        file_size=file.size,
                        operation="similarity_upload"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=format_response(
                            success=False, 
                            error=similarity_results.get("error", "Similarity processing failed.")
                        )
                    )
                
                # STEP 3: Return response in same format as similarity by ID
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(success=True, data=similarity_results)
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SIMILARITY",
                    action="upload_success",
                    message="Similarity fallback upload processing completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    track_id=int(upload_result.get("track_id")) if upload_result.get("track_id") else None,
                    context="Successful completion of fallback similarity upload processing",
                    metadata={
                        "similarity_results": similarity_results,
                        "track_uuid": upload_result.get("uuid"),
                        "processing_steps": ["file_validation", "track_upload", "similarity_analysis"],
                        "ffmpeg_available": False,
                        "response": response_content
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_content
                )

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                import traceback
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="upload_exception",
                    message="Unexpected error during fallback similarity upload processing",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    stack_trace=traceback.format_exc(),
                    context="Fallback similarity upload processing",
                    metadata={
                        "error": "An internal server error occurred.",
                        "exception_type": type(e).__name__,
                        "ffmpeg_available": False,
                        "temp_file_path": temp_file_path
                    },
                    filename=file.filename,
                    file_size=file.size,
                    operation="similarity_upload"
                )
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
        request: Request,
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Validate track_id
        if not track_id or not track_id.strip():
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="SIMILARITY",
                action="track_id_validation_failed",
                message="Empty track_id provided for similarity by ID",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=422,
                duration_ms=duration_ms,
                context="Track ID validation for similarity by ID",
                metadata={
                    "error": "track_id cannot be empty",
                    "provided_track_id": track_id,
                    "validation_step": "track_id_check"
                },
                operation="similarity_by_id"
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=format_response(success=False, error="track_id cannot be empty"))
        try:
            # Get file path from MariaDB using track UUID
            server_track_path = await self.similarity_service.get_track_path_by_uuid(db, track_id)
            duration_ms = (time.time() - start_time) * 1000
            if server_track_path is None:
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="SIMILARITY",
                    action="track_not_found",
                    message=f"Track not found or path missing for similarity by ID: {track_id}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    duration_ms=duration_ms,
                    context="Track lookup for similarity by ID",
                    metadata={
                        "error": "track_not_found",
                        "requested_track_id": track_id,
                        "lookup_step": "track_path_retrieval"
                    },
                    operation="similarity_by_id"
                )
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=format_response(success=False, error=f"Track with ID '{track_id}' not found or path is missing"))
            
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
            duration_ms = (time.time() - start_time) * 1000
            # Check if similarity processing failed
            if similarity_results.get("success") is False:
                # Extract track_id from database lookup if available
                try:
                    track_id_int = int(track_id) if track_id.isdigit() else None
                except:
                    track_id_int = None
                    
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="SIMILARITY",
                    action="similarity_processing_failed",
                    message="Similarity processing failed for track by ID",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=503,
                    duration_ms=duration_ms,
                    track_id=track_id_int,
                    context="Similarity processing by track ID",
                    metadata={
                        "error": similarity_results.get("error"),
                        "requested_track_id": track_id,
                        "server_track_path": server_track_path,
                        "processing_step": "similarity_analysis"
                    },
                    operation="similarity_by_id"
                )
                return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=format_response(success=False, error=similarity_results.get("error", "Similarity processing failed")))
            
            # Log success once result is ready
            # Extract track_id from database lookup if available
            try:
                track_id_int = int(track_id) if track_id.isdigit() else None
            except:
                track_id_int = None
                
            response_content = format_response(success=True, data=similarity_results)
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="SIMILARITY",
                action="by_id_success",
                message=f"Similarity by ID processing completed successfully for track {track_id}",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=200,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                track_id=track_id_int,
                context="Successful similarity processing by track ID",
                metadata={
                    "similarity_results": similarity_results,
                    "requested_track_id": track_id,
                    "server_track_path": server_track_path,
                    "processing_steps": ["track_lookup", "similarity_analysis"],
                    "response": response_content
                },
                operation="similarity_by_id"
            )
            return JSONResponse(status_code=status.HTTP_200_OK, content=response_content)
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            # Extract track_id from database lookup if available
            try:
                track_id_int = int(track_id) if track_id.isdigit() else None
            except:
                track_id_int = None
                
            import traceback
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="SIMILARITY",
                action="by_id_exception",
                message="Unexpected error during similarity by ID processing",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                duration_ms=duration_ms,
                track_id=track_id_int,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Similarity by ID processing",
                metadata={
                    "error": "An internal server error occurred while processing similarity by ID",
                    "exception_type": type(e).__name__,
                    "requested_track_id": track_id
                },
                operation="similarity_by_id"
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=format_response(success=False, error="An internal server error occurred while processing similarity by ID"))
