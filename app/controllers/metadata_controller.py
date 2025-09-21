"""
Metadata Controller
===================

This controller handles HTTP requests for metadata extraction functionality.
It processes uploaded audio files to extract metadata using various libraries
and provides proper validation, error handling, and response formatting.

Manages metadata-related API endpoints and coordinates with metadata service
for business logic execution.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import asyncio
from fastapi import status, Request
from fastapi.responses import JSONResponse
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
import time
from app.services.metadata_service import MetadataService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename


class MetadataController:
    def __init__(self):
        self.metadata_service = MetadataService()
        self.logging_service = LoggingService()

    async def get_metadata(self, db: AsyncSession, request: Request, file: UploadFile) -> JSONResponse:
        """
        Extracts and returns metadata from an uploaded audio file using Mutagen.
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Basic validation - check if file is empty
            content = await file.read()
            if len(content) == 0:
                # Log validation error
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=False, error="Empty file provided")
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="UPLOAD",
                    action="metadata_extraction_validation_failed",
                    message="Metadata extraction failed: Empty file provided",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=422,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=0,
                    operation="metadata_extraction",
                    transfer_status="failed",
                    metadata={
                        "error": "Empty file provided",
                        "validation_step": "file_size_check",
                        "content_type": file.content_type,
                        "response": response_data,
                        "operation": "metadata_extraction"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_data
                )
            
            # Reset file pointer for metadata extraction
            await file.seek(0)
            
            # Check if file has a reasonable audio extension
            if file.filename:
                valid_extensions = {'.mp3', '.flac', '.ogg', '.m4a', '.wav', '.wma', '.aac', '.opus'}
                file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
                if file_ext and f'.{file_ext}' not in valid_extensions:
                    # Log unsupported format error
                    duration_ms = (time.time() - start_time) * 1000
                    response_data = format_response(success=False, error=f"Unsupported file format: .{file_ext}")
                    self.logging_service.log(
                        async_db=db,
                        level="WARNING",
                        category="UPLOAD",
                        action="metadata_extraction_unsupported_format",
                        message=f"Metadata extraction failed: Unsupported file format .{file_ext}",
                        correlation_id=correlation_id,
                        request=request,
                        status_code=415,
                        duration_ms=duration_ms,
                        filename=file.filename,
                        file_size=len(content),
                        operation="metadata_extraction",
                        transfer_status="failed",
                        metadata={
                            "error": f"Unsupported file format: .{file_ext}",
                            "validation_step": "file_extension_check",
                            "file_extension": file_ext,
                            "valid_extensions": list(valid_extensions),
                            "content_type": file.content_type,
                            "response": response_data,
                            "operation": "metadata_extraction"
                        }
                    )
                    
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=response_data
                    )
            
            # Use asyncio.to_thread for the blocking Mutagen operation
            extracted_meta = await asyncio.to_thread(self.metadata_service.extract_metadata, file.file)
            
            # Check if metadata extraction failed or found no valid audio
            if "error" in extracted_meta:
                # Log metadata extraction error
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=False, error=extracted_meta["error"])
                self.logging_service.log(
                    async_db=db,
                    level="ERROR",
                    category="UPLOAD",
                    action="metadata_extraction_failed",
                    message=f"Metadata extraction failed: {extracted_meta['error']}",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=415,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=len(content),
                    operation="metadata_extraction",
                    transfer_status="failed",
                    metadata={
                        "error": extracted_meta["error"],
                        "extraction_step": "mutagen_processing",
                        "content_type": file.content_type,
                        "extracted_metadata": extracted_meta,
                        "response": response_data,
                        "operation": "metadata_extraction"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=response_data
                )
            
            # Check if the file was processed but no valid audio metadata was found
            if "info" in extracted_meta and extracted_meta.get("info") == "No tags found or unsupported format.":
                # Log invalid audio file error
                duration_ms = (time.time() - start_time) * 1000
                response_data = format_response(success=False, error="File does not appear to be a valid audio file")
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="UPLOAD",
                    action="metadata_extraction_invalid_audio",
                    message="Metadata extraction failed: File does not appear to be a valid audio file",
                    correlation_id=correlation_id,
                    request=request,
                    status_code=415,
                    duration_ms=duration_ms,
                    filename=file.filename,
                    file_size=len(content),
                    operation="metadata_extraction",
                    transfer_status="failed",
                    metadata={
                        "error": "File does not appear to be a valid audio file",
                        "extraction_step": "audio_validation",
                        "info_message": extracted_meta.get("info"),
                        "content_type": file.content_type,
                        "extracted_metadata": extracted_meta,
                        "response": response_data,
                        "operation": "metadata_extraction"
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=response_data
                )
            
            # Log successful metadata extraction (ONLY the result)
            duration_ms = (time.time() - start_time) * 1000
            response_data = {
                "filename": sanitize_filename(file.filename),
                "metadata": extracted_meta
            }
            formatted_response = format_response(success=True, data=response_data)
            
            self.logging_service.log(
                async_db=db,
                level="INFO",
                category="UPLOAD",
                action="metadata_extraction_success",
                message="Metadata extraction completed successfully",
                correlation_id=correlation_id,
                request=request,
                status_code=200,
                duration_ms=duration_ms,
                filename=file.filename,
                file_size=len(content),
                operation="metadata_extraction",
                transfer_status="success",
                metadata={
                    "extraction_step": "completed",
                    "content_type": file.content_type,
                    "sanitized_filename": sanitize_filename(file.filename),
                    "extracted_metadata": extracted_meta,
                    "metadata_fields_found": len(extracted_meta) if isinstance(extracted_meta, dict) else 0,
                    "has_title": "title" in str(extracted_meta).lower(),
                    "has_artist": "artist" in str(extracted_meta).lower(),
                    "has_album": "album" in str(extracted_meta).lower(),
                    "response": formatted_response,
                    "operation": "metadata_extraction"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=formatted_response
            )

        except Exception as e:
            # Log the error with full context
            duration_ms = (time.time() - start_time) * 1000
            response_data = format_response(success=False, error=f"An internal server error occurred while extracting metadata: {e}")
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ERROR",
                action="metadata_extraction_exception",
                message="Exception occurred during metadata extraction",
                correlation_id=correlation_id,
                request=request,
                status_code=500,
                duration_ms=duration_ms,
                error=e,
                context="metadata extraction",
                filename=file.filename,
                file_size=getattr(file, 'size', 0),
                operation="metadata_extraction",
                transfer_status="failed",
                metadata={
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "file_size": getattr(file, 'size', 0),
                    "error_type": type(e).__name__,
                    "extraction_step": "exception_occurred",
                    "response": response_data,
                    "operation": "metadata_extraction"
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_data
            )
        finally:
            await file.close()  # Ensure the uploaded file is closed
