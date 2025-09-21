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
                self.logging_service.log_upload_operation(
                    db=db,
                    operation="validation_failed",
                    filename=file.filename,
                    duration_ms=duration_ms,
                    status="error",
                    error_message="Empty file provided",
                    correlation_id=correlation_id
                )
                
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(success=False, error="Empty file provided")
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
                    self.logging_service.log_upload_operation(
                        db=db,
                        operation="validation_failed",
                        duration_ms=duration_ms,
                        filename=file.filename,
                        status="error",
                        error_message=f"Unsupported file format: .{file_ext}",
                        correlation_id=correlation_id
                    )
                    
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=format_response(success=False, error=f"Unsupported file format: .{file_ext}")
                    )
            
            # Use asyncio.to_thread for the blocking Mutagen operation
            extracted_meta = await asyncio.to_thread(self.metadata_service.extract_metadata, file.file)
            
            # Check if metadata extraction failed or found no valid audio
            if "error" in extracted_meta:
                # Log metadata extraction error
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_upload_operation(
                    db=db,
                    operation="metadata_extract_failed",
                    filename=file.filename,
                    duration_ms=duration_ms,
                    status="error",
                    error_message=extracted_meta["error"],
                    correlation_id=correlation_id
                )
                
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(success=False, error=extracted_meta["error"])
                )
            
            # Check if the file was processed but no valid audio metadata was found
            if "info" in extracted_meta and extracted_meta.get("info") == "No tags found or unsupported format.":
                # Log invalid audio file error
                duration_ms = (time.time() - start_time) * 1000
                self.logging_service.log_upload_operation(
                    db=db,
                    operation="invalid_audio_file",
                    filename=file.filename,
                    duration_ms=duration_ms,
                    status="error",
                    error_message="File does not appear to be a valid audio file",
                    correlation_id=correlation_id
                )
                
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(success=False, error="File does not appear to be a valid audio file")
                )
            
            # Log successful metadata extraction (ONLY the result)
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_upload_operation(
                db=db,
                operation="metadata_extract_success",
                duration_ms=duration_ms,
                filename=file.filename,
                file_size=len(content),
                status="success",
                correlation_id=correlation_id
            )
            
            response_data = {
                "filename": sanitize_filename(file.filename),
                "metadata": extracted_meta
            }
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=response_data)
            )

        except Exception as e:
            # Log the error with full context
            duration_ms = (time.time() - start_time) * 1000
            self.logging_service.log_error(
                db=db,
                error=e,
                context="metadata extraction",
                correlation_id=correlation_id,
                duration_ms=duration_ms,
                request=request,
                metadata={
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "file_size": file.size
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"An internal server error occurred while extracting metadata: {e}")
            )
        finally:
            await file.close()  # Ensure the uploaded file is closed
