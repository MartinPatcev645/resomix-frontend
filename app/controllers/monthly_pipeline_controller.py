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

from fastapi import UploadFile, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import time
from app.core.config import settings
from app.models.constants import TrackType
from app.services.monthly_pipeline_service import MonthlyPipelineService
from app.services.audio_service import AudioService
from app.services.track_upload_service import TrackUploadService, generate_track_uuid
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.services.logging_service import LoggingService
from app.utils.mix_filter import validate_track_for_mixes
from app.core.context import get_current_partner_id
from app.repositories.track_repository import TrackRepository


class MonthlyPipelineController:
    """Controller for handling monthly pipeline track operations."""
    
    def __init__(self):
        self.monthly_pipeline_service = MonthlyPipelineService()
        self.audio_service = AudioService()
        self.track_upload_service = TrackUploadService()
        self.logging_service = LoggingService()

    async def update_embeddings(self, db: AsyncSession, request: Request = None) -> JSONResponse:
        """Trigger bulk update of embeddings by sending UUID→path map to similarity server."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            service_resp = await self.monthly_pipeline_service.update_embeddings(db)

            if service_resp.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(True, data=service_resp.get("data"))
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="SYSTEM",
                    action="update_embeddings_success",
                    message="Bulk embeddings update completed successfully",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    operation="bulk_embedding_update",
                    transfer_status="success",
                    metadata={
                        "embeddings_updated": service_resp.get("data", {}).get("updated_count", 0),
                        "response": response_data,
                        "operation": "bulk_embedding_update"
                    }
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(False, error=service_resp.get("error", "Unknown error"))
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="SYSTEM",
                action="update_embeddings_failed",
                message=f"Bulk embeddings update failed: {service_resp.get('error', 'Unknown error')}",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                operation="bulk_embedding_update",
                transfer_status="failed",
                metadata={
                    "error": service_resp.get("error", "Unknown error"),
                    "response": response_data,
                    "operation": "bulk_embedding_update"
                }
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(False, error="An internal server error occurred during embeddings update")
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="update_embeddings_exception",
                message="Exception occurred during bulk embeddings update",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="update_embeddings",
                operation="bulk_embedding_update",
                transfer_status="failed",
                metadata={
                    "error_type": type(e).__name__,
                    "response": response_data,
                    "operation": "bulk_embedding_update"
                }
            )
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response_data)

    async def process_monthly_pipeline_track(
        self,
        db: AsyncSession,
        request: Request,
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
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        # Log start of monthly pipeline processing
        duration_ms = (time.time() - start_time) * 1000
        self.logging_service.log(
            async_db=db,
            level="INFO",
            category="UPLOAD",
            action="monthly_pipeline_start",
            message="Starting monthly pipeline track processing",
            correlation_id=correlation_id,
            request=request,
            status_code=None,
            duration_ms=duration_ms,
            filename=file.filename,
            file_size=file.size,
            operation="monthly_pipeline_processing",
            transfer_status="started",
            metadata={
                "path": path,
                "processing_step": "initialization",
                "track_type": "ELECTROBUZZ",
                "operation": "monthly_pipeline_processing"
            }
        )
        
        # STEP 0: Check if this path already exists in database (duplicate check)
        try:
            partner_id = get_current_partner_id()
            track_repo = TrackRepository()
            count = await track_repo.async_get_audio_file_count_by_path(db, path=path, partner_id=partner_id)
            
            if count and count > 0:
                # Log duplicate track detection
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
                    action="monthly_pipeline_duplicate_detected",
                    message=f"Monthly pipeline processing skipped: Track already exists with path {path}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=200,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=file.size,
                    operation="monthly_pipeline_processing",
                    transfer_status="skipped",
                    metadata={
                        "path": path,
                        "existing_tracks_count": count,
                        "processing_step": "duplicate_check",
                        "skipped_processing": True,
                        "response": response_data,
                        "operation": "monthly_pipeline_processing"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_data
                )
                    
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="ERROR",
                action="monthly_pipeline_duplicate_check_exception",
                message="Exception occurred during duplicate check, continuing processing",
                correlation_id=correlation_id,
                request=request,
                status_code=None,
                duration_ms=duration_ms,
                error=e,
                context="monthly_pipeline_duplicate_check",
                filename=file.filename,
                file_size=file.size,
                operation="monthly_pipeline_processing",
                transfer_status="warning",
                metadata={
                    "path": path,
                    "processing_step": "duplicate_check",
                    "error_type": type(e).__name__,
                    "continue_processing": True,
                    "operation": "monthly_pipeline_processing"
                }
            )
            # request not critical here
            pass
        
        # File Size Check using settings
        if file.size > settings.max_file_size:
            # Log file size validation failure
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error=f"File too large. Maximum size is {settings.max_file_size // (1024 * 1024)}MB."
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="UPLOAD",
                action="monthly_pipeline_file_size_exceeded",
                message=f"Monthly pipeline processing failed: File size {file.size} exceeds maximum {settings.max_file_size}",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                filename=file.filename,
                file_size=file.size,
                operation="monthly_pipeline_processing",
                transfer_status="failed",
                metadata={
                    "path": path,
                    "processing_step": "file_size_validation",
                    "max_file_size": settings.max_file_size,
                    "max_file_size_mb": settings.max_file_size // (1024 * 1024),
                    "file_size_mb": file.size // (1024 * 1024),
                    "error": "File too large",
                    "response": response_data,
                    "operation": "monthly_pipeline_processing"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                content=response_data
            )

        # Check if the file is empty
        if file.size == 0:
            # Log empty file failure
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(
                success=False,
                error="File is empty. Please upload a valid audio file."
            )
            self.logging_service.log(
                async_db=db,
                level="WARNING",
                category="UPLOAD",
                action="monthly_pipeline_empty_file",
                message="Monthly pipeline processing failed: Empty file provided",
                correlation_id=correlation_id,
                request=request,
                status_code=422,
                duration_ms=duration_ms,
                filename=file.filename,
                file_size=0,
                operation="monthly_pipeline_processing",
                transfer_status="failed",
                metadata={
                    "path": path,
                    "processing_step": "file_size_validation",
                    "error": "Empty file provided",
                    "response": response_data,
                    "operation": "monthly_pipeline_processing"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=response_data
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
                    # Log invalid audio
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=False,
                        error="The uploaded file does not contain valid audio streams according to our analysis."
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="monthly_pipeline_invalid_audio",
                        message="Monthly pipeline processing failed: Invalid audio format detected by FFmpeg",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=415,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="monthly_pipeline_processing",
                        transfer_status="failed",
                        metadata={
                            "path": path,
                            "processing_step": "audio_format_validation",
                            "ffmpeg_available": True,
                            "content_type": file.content_type,
                            "error": "Invalid audio format",
                            "response": response_data,
                            "operation": "monthly_pipeline_processing"
                        }
                    )
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=response_data
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
                    # Log mix filter rejection
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=False,
                        error=f"Track rejected by mix filter: {mix_filter_result.reason}"
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="monthly_pipeline_mix_filter_rejected",
                        message=f"Monthly pipeline processing failed: Mix filter rejection - {mix_filter_result.reason}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="monthly_pipeline_processing",
                        transfer_status="failed",
                        metadata={
                            "path": path,
                            "processing_step": "mix_filter_validation",
                            "ffmpeg_available": True,
                            "duration": duration,
                            "mix_filter_reason": mix_filter_result.reason,
                            "content_type": file.content_type,
                            "error": f"Mix filter rejection: {mix_filter_result.reason}",
                            "response": response_data,
                            "operation": "monthly_pipeline_processing"
                        }
                    )
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=response_data
                    )
                
            else:
                # Basic content type check if FFmpeg not available
                if not file.content_type or not file.content_type.startswith("audio/"):
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=False,
                        error="Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis."
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="monthly_pipeline_invalid_content_type",
                        message="Monthly pipeline processing failed: Invalid content type without FFmpeg validation",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=415,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="monthly_pipeline_processing",
                        transfer_status="failed",
                        metadata={
                            "path": path,
                            "processing_step": "content_type_validation",
                            "ffmpeg_available": False,
                            "content_type": file.content_type,
                            "error": "Content-Type doesn't appear to be audio",
                            "response": response_data,
                            "operation": "monthly_pipeline_processing"
                        }
                    )
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=response_data
                    )
                
                # If FFmpeg is not available, we can still do basic mix filtering based on file size and extension
                # but without duration check
                mix_filter_result = validate_track_for_mixes(
                    filename=original_filename,
                    file_size=file.size,
                    duration=None  # No duration available without FFmpeg
                )
                
                if not mix_filter_result.is_valid:
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=False,
                        error=f"Track rejected by mix filter: {mix_filter_result.reason}"
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="monthly_pipeline_mix_filter_rejected_no_ffmpeg",
                        message=f"Monthly pipeline processing failed: Mix filter rejection without FFmpeg - {mix_filter_result.reason}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="monthly_pipeline_processing",
                        transfer_status="failed",
                        metadata={
                            "path": path,
                            "processing_step": "mix_filter_validation",
                            "ffmpeg_available": False,
                            "duration": None,
                            "mix_filter_reason": mix_filter_result.reason,
                            "content_type": file.content_type,
                            "error": f"Mix filter rejection: {mix_filter_result.reason}",
                            "response": response_data,
                            "operation": "monthly_pipeline_processing"
                        }
                    )
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=response_data
                    )

            # STEP 4: Extract metadata and generate UUID (but don't store in database yet)
            await file.seek(0)  # Reset file pointer
            
            # Extract metadata using metadata service
            try:
                metadata = self.track_upload_service.metadata_service.extract_metadata(
                    file.file, file.filename, mode="limited"
                )
                if "error" in metadata:
                    # Log metadata extraction failure
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(
                        success=False,
                        error=f"Metadata extraction failed: {metadata['error']}"
                    )
                    self.logging_service.log(
                        async_db=db,
                        level="ERROR",
                        category="UPLOAD",
                        action="monthly_pipeline_metadata_extraction_failed",
                        message=f"Monthly pipeline processing failed: Metadata extraction error - {metadata['error']}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=422,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=file.size,
                        operation="monthly_pipeline_processing",
                        transfer_status="failed",
                        metadata={
                            "path": path,
                            "processing_step": "metadata_extraction",
                            "metadata_error": metadata['error'],
                            "extracted_metadata": metadata,
                            "content_type": file.content_type,
                            "error": f"Metadata extraction failed: {metadata['error']}",
                            "response": response_data,
                            "operation": "monthly_pipeline_processing"
                        }
                    )
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content=response_data
                    )
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=f"Error during metadata extraction: {str(e)}"
                )
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="ERROR",
                    action="monthly_pipeline_metadata_extraction_exception",
                    message="Exception occurred during metadata extraction in monthly pipeline",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    error=e,
                    context="monthly_pipeline_metadata_extract",
                    filename=file.filename,
                    file_size=file.size,
                    operation="monthly_pipeline_processing",
                    transfer_status="failed",
                    metadata={
                        "path": path,
                        "processing_step": "metadata_extraction",
                        "error_type": type(e).__name__,
                        "content_type": file.content_type,
                        "response": response_data,
                        "operation": "monthly_pipeline_processing"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
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
                # Log embedding failure
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False,
                    error=embedding_result.get("error", "Failed to generate embedding preview")
                )
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="UPLOAD",
                    action="monthly_pipeline_embedding_failed",
                    message=f"Monthly pipeline processing failed: Embedding generation error - {embedding_result.get('error', 'embedding preview failed')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=503,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=file.size,
                    operation="monthly_pipeline_processing",
                    transfer_status="failed",
                    metadata={
                        "path": path,
                        "processing_step": "embedding_generation",
                        "track_uuid": track_uuid,
                        "embedding_error": embedding_result.get("error", "embedding preview failed"),
                        "embedding_result": embedding_result,
                        "content_type": file.content_type,
                        "duration": duration,
                        "response": response_data,
                        "operation": "monthly_pipeline_processing"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=response_data
                )
            
            # STEP 6: If similarity server was successful, now store in database
            await file.seek(0)  # Reset file pointer for database upload
            
            # Keep duration as float for database precision (now supports DECIMAL(8,3))
            duration_sec = duration
            
            # PRODUCTION MODE: Actually save to database
            upload_result = await self.track_upload_service.upload_track_to_database_with_uuid(
                db,
                file, 
                audio_bytes,
                track_uuid,  # Use the same UUID we sent to similarity server
                partner_id=settings.system_partner_id,  # Admin/System partner
                track_type=TrackType.ELECTROBUZZ,  # Mark as electrobuzz track
                duration_sec=duration_sec,  # Pass the probed duration
                full_path=path  # Pass the full path for proper duplicate detection
            )
            
            if not upload_result.get("success", False):
                # Log DB storage failure
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(
                    success=False, 
                    error=f"Failed to store track in database: {upload_result.get('error', 'Unknown error')}"
                )
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="UPLOAD",
                    action="monthly_pipeline_database_storage_failed",
                    message=f"Monthly pipeline processing failed: Database storage error - {upload_result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=500,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=file.size,
                    operation="monthly_pipeline_processing",
                    transfer_status="failed",
                    metadata={
                        "path": path,
                        "processing_step": "database_storage",
                        "track_uuid": track_uuid,
                        "track_type": "ELECTROBUZZ",
                        "duration": duration_sec,
                        "upload_error": upload_result.get('error'),
                        "upload_result": upload_result,
                        "content_type": file.content_type,
                        "embedding_completed": True,
                        "response": response_data,
                        "operation": "monthly_pipeline_processing"
                    }
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=response_data
                )
            
            # Log successful completion
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
                action="monthly_pipeline_success",
                message="Monthly pipeline processing completed successfully",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                filename=file.filename,
                file_size=file.size,
                track_id=track_id if isinstance(track_id, int) else None,
                operation="monthly_pipeline_processing",
                transfer_status="success",
                metadata={
                    "path": path,
                    "track_uuid": track_uuid,
                    "track_id": track_id,
                    "track_type": "ELECTROBUZZ",
                    "processing_step": "completed",
                    "duration": duration_sec,
                    "content_type": file.content_type,
                    "ffmpeg_available": is_ffmpeg_available,
                    "embedding_completed": True,
                    "database_stored": True,
                    "processing_steps": ["validation", "metadata_extraction", "embedding_generation", "database_storage"],
                    "response": response_data,
                    "operation": "monthly_pipeline_processing"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=response_data
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error="An internal server error occurred.")
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="monthly_pipeline_exception",
                message="Exception occurred during monthly pipeline processing",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="monthly_pipeline_track",
                filename=file.filename,
                file_size=file.size,
                operation="monthly_pipeline_processing",
                transfer_status="failed",
                metadata={
                    "path": path,
                    "processing_step": "unknown",
                    "error_type": type(e).__name__,
                    "content_type": file.content_type,
                    "response": response_data,
                    "operation": "monthly_pipeline_processing"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
