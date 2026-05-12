"""
Open Tracks Pipeline Controller
===============================

This controller handles HTTP requests for open tracks pipeline functionality.
It processes uploaded audio files for open tracks pipeline processing, validates inputs,
and coordinates with services to generate embedding previews and store tracks.

Manages file upload validation, metadata extraction, embedding preview generation,
and database storage for open tracks.

Version: 1.0.0
Init Date: November 23, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional
from fastapi import UploadFile, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import time
from app.core.config import settings
from app.models.constants import TrackType
from app.services.open_tracks_pipeline_service import OpenTracksPipelineService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.services.logging_service import LoggingService
from app.utils.mix_filter import validate_track_for_mixes


class OpenTracksPipelineController:
    """Controller for handling open tracks pipeline operations."""
    
    def __init__(self):
        self.open_tracks_service = OpenTracksPipelineService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()
        self.logging_service = LoggingService()

    async def update_embeddings(self, db: AsyncSession, request: Request = None, partner_id: Optional[int] = None) -> JSONResponse:
        """Trigger bulk update of embeddings for OPEN tracks."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            service_resp = await self.open_tracks_service.update_embeddings(db, partner_id=partner_id)

            if service_resp.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(True, data=service_resp.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SYSTEM",
                    action="open_pipeline_update_embeddings_success",
                    message="Bulk embeddings update for open tracks completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    operation="open_pipeline_bulk_update",
                    transfer_status="success",
                    metadata={
                        "embeddings_updated": service_resp.get("data", {}).get("updated_count", 0),
                        "response": response_data,
                        "operation": "open_pipeline_bulk_update"
                    }
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(False, error=service_resp.get("error", "Unknown error"))
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="SYSTEM",
                action="open_pipeline_update_embeddings_failed",
                message=f"Bulk embeddings update for open tracks failed: {service_resp.get('error', 'Unknown error')}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                operation="open_pipeline_bulk_update",
                transfer_status="failed",
                metadata={
                    "error": service_resp.get("error", "Unknown error"),
                    "response": response_data,
                    "operation": "open_pipeline_bulk_update"
                }
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(False, error="An internal server error occurred during open tracks embeddings update")
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="open_pipeline_update_embeddings_exception",
                message="Exception occurred during open tracks bulk embeddings update",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="open_pipeline_update_embeddings",
                operation="open_pipeline_bulk_update",
                transfer_status="failed",
                metadata={
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "open_pipeline_bulk_update"
                }
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)

    async def process_track(
        self,
        db: AsyncSession,
        request: Request,
        file: UploadFile,
        path: str,
        partner_id: Optional[int] = None
    ) -> JSONResponse:
        """
        Process an audio file for the open tracks pipeline.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Log start
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="UPLOAD",
            action="open_pipeline_start",
            message="Starting open tracks pipeline processing",
            correlation_id=correlation_id,
            request=request,
            status_code=None,
            duration_ms=duration_ms,
            filename=file.filename,
            file_size=file.size,
            operation="open_pipeline_processing",
            transfer_status="started",
            metadata={
                "path": path,
                "processing_step": "initialization",
                "track_type": "OPEN",
                "operation": "open_pipeline_processing"
            }
        )
        
        # STEP 0: Check if this path already exists in database (duplicate check)
        try:
            from database.connection import engine
            from sqlalchemy import text
            
            with engine.begin() as conn:
                check_result = conn.execute(
                    text("SELECT COUNT(*) FROM tracks WHERE file_path = :path AND partner_id = :partner_id"),
                    {"path": path, "partner_id": partner_id}
                )
                count = check_result.scalar()
                
                if count > 0:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=True,
                        data={
                            "message": "Track already exists in database with this path",
                            "path": path,
                            "skipped_processing": True
                        }
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="INFO",
                        category="UPLOAD",
                        action="open_pipeline_duplicate_detected",
                        message=f"Open pipeline processing skipped: Track already exists with path {path}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=200,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="open_pipeline_processing",
                        transfer_status="skipped",
                        metadata={
                            "path": path,
                            "existing_tracks_count": count,
                            "processing_step": "duplicate_check",
                            "skipped_processing": True,
                            "response": response_data,
                            "operation": "open_pipeline_processing"
                        }
                    )
                    return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)
                    
        except Exception as e:
            # Log warning but continue
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ERROR",
                action="open_pipeline_duplicate_check_exception",
                message="Exception during duplicate check",
                correlation_id=correlation_id,
                request=request,
                error=e,
                operation="open_pipeline_processing"
            )
            pass
        
        # File Size Check
        if file.size > settings.max_file_size:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error=f"File too large. Maximum size is {settings.max_file_size // (1024 * 1024)}MB."
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="UPLOAD",
                action="open_pipeline_file_size_exceeded",
                message=f"File size {file.size} exceeds maximum",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                operation="open_pipeline_processing",
                transfer_status="failed",
                metadata={"error": "File too large"}
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data)

        # Empty File Check
        if file.size == 0:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error="File is empty.")
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="UPLOAD",
                action="open_pipeline_empty_file",
                message="Empty file provided",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                operation="open_pipeline_processing",
                transfer_status="failed",
                metadata={"error": "Empty file"}
            )
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data)

        try:
            # Read audio bytes
            audio_bytes = await file.read()
            original_filename = sanitize_filename(file.filename)

            # Validate audio
            is_ffmpeg_available = self.audio_service.is_ffmpeg_available()
            duration = None
            
            if is_ffmpeg_available:
                is_valid_audio = self.audio_service.validate_audio_format(audio_bytes, original_filename)
                if not is_valid_audio:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error="Invalid audio format.")
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="open_pipeline_invalid_audio",
                        message="Invalid audio format detected by FFmpeg",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=415,
                        duration_ms=duration_ms,
                        operation="open_pipeline_processing",
                        transfer_status="failed",
                        metadata={"error": "Invalid audio format"}
                    )
                    return JSONResponse(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, content=response_data)
                
                duration = self.audio_service.get_audio_duration(audio_bytes, original_filename)
                
                # Mix filter
                mix_filter_result = validate_track_for_mixes(
                    filename=original_filename,
                    file_size=file.size,
                    duration=duration
                )
                
                if not mix_filter_result.is_valid:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error=f"Track rejected by mix filter: {mix_filter_result.reason}")
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="open_pipeline_mix_filter_rejected",
                        message=f"Mix filter rejection: {mix_filter_result.reason}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        operation="open_pipeline_processing",
                        transfer_status="failed",
                        metadata={"mix_filter_reason": mix_filter_result.reason}
                    )
                    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data)
                
            else:
                # Basic check without FFmpeg
                if not file.content_type or not file.content_type.startswith("audio/"):
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error="Content-Type doesn't appear to be audio.")
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="open_pipeline_invalid_content_type",
                        message="Invalid content type",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=415,
                        duration_ms=duration_ms,
                        operation="open_pipeline_processing",
                        transfer_status="failed"
                    )
                    return JSONResponse(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, content=response_data)
                
                mix_filter_result = validate_track_for_mixes(
                    filename=original_filename,
                    file_size=file.size,
                    duration=None
                )
                
                if not mix_filter_result.is_valid:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error=f"Track rejected by mix filter: {mix_filter_result.reason}")
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="open_pipeline_mix_filter_rejected_no_ffmpeg",
                        message=f"Mix filter rejection: {mix_filter_result.reason}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        operation="open_pipeline_processing",
                        transfer_status="failed"
                    )
                    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data)

            # Metadata Extraction
            await file.seek(0)
            try:
                metadata = self.track_upload_service.metadata_service.extract_metadata(
                    file.file, file.filename, mode="limited"
                )
                if "error" in metadata:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error=f"Metadata extraction failed: {metadata['error']}")
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="UPLOAD",
                        action="open_pipeline_metadata_extraction_failed",
                        message=f"Metadata extraction error: {metadata['error']}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        operation="open_pipeline_processing",
                        transfer_status="failed"
                    )
                    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=response_data)
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=False, error=f"Error during metadata extraction: {str(e)}")
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ERROR",
                    action="open_pipeline_metadata_extraction_exception",
                    message="Exception during metadata extraction",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    operation="open_pipeline_processing",
                    transfer_status="failed"
                )
                return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)

            # Generate UUID
            track_uuid = generate_track_uuid()
            
            # Similarity Server Handoff
            embedding_result = await self.open_tracks_service.generate_embedding_preview(
                audio_bytes=audio_bytes,
                original_filename=original_filename,
                track_uuid=track_uuid,
                path=path
            )
            
            if not embedding_result.get("success", False):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=embedding_result.get("error", "Failed to generate embedding preview")
                )
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="UPLOAD",
                    action="open_pipeline_embedding_failed",
                    message=f"Embedding generation error: {embedding_result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=503,
                    duration_ms=duration_ms,
                    operation="open_pipeline_processing",
                    transfer_status="failed",
                    metadata={"embedding_error": embedding_result.get("error")}
                )
                return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=response_data)
            
            # Store in Database
            await file.seek(0)
            duration_sec = duration
            
            upload_result = await self.track_upload_service.upload_track_to_database_with_uuid(
                db,
                file, 
                audio_bytes,
                track_uuid,
                partner_id=partner_id,
                track_type=TrackType.OPEN,  # <--- CRITICAL: Use OPEN type
                duration_sec=duration_sec,
                full_path=path
            )
            
            if not upload_result.get("success", False):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False, 
                    error=f"Failed to store track in database: {upload_result.get('error', 'Unknown error')}"
                )
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="UPLOAD",
                    action="open_pipeline_database_storage_failed",
                    message=f"Database storage error: {upload_result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    operation="open_pipeline_processing",
                    transfer_status="failed"
                )
                return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)
            
            # Success
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=True, 
                data={
                    "message": "Track processed successfully and stored in database",
                    "track_uuid": track_uuid,
                    "path": path
                }
            )
            track_id = upload_result.get("track_id")
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="UPLOAD",
                action="open_pipeline_success",
                message="Open pipeline processing completed successfully",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                track_id=track_id if isinstance(track_id, int) else None,
                operation="open_pipeline_processing",
                transfer_status="success",
                metadata={
                    "path": path,
                    "track_uuid": track_uuid,
                    "track_type": "OPEN"
                }
            )
            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error="An internal server error occurred.")
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="open_pipeline_exception",
                message="Exception occurred during open pipeline processing",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                operation="open_pipeline_processing",
                transfer_status="failed"
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)
