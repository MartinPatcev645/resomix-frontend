"""
Metadata Controller
===================

This controller handles HTTP requests for track metadata retrieval functionality.
It processes requests for detailed track information including artist, album, label,
genre, and technical details, coordinating with metadata service for data enrichment.

Manages track ID validation, metadata formatting, and error handling
for metadata-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Metadata controller 
import asyncio
from fastapi import UploadFile, status
from fastapi.responses import JSONResponse

from app.services.metadata_service import MetadataService
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.utils.logging_utils import log_request


class MetadataController:
    def __init__(self):
        self.metadata_service = MetadataService()

    async def get_metadata(self, file: UploadFile) -> JSONResponse:
        """
        Extracts and returns metadata from an uploaded audio file using Mutagen.
        """
        log_request("metadata", "POST", {"filename": file.filename, "content_type": file.content_type})

        try:
            # Basic validation - check if file is empty
            content = await file.read()
            if len(content) == 0:
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
                    return JSONResponse(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        content=format_response(success=False, error=f"Unsupported file format: .{file_ext}")
                    )
            
            # Use asyncio.to_thread for the blocking Mutagen operation
            extracted_meta = await asyncio.to_thread(self.metadata_service.extract_metadata, file.file)
            
            # Check if metadata extraction failed or found no valid audio
            if "error" in extracted_meta:
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(success=False, error=extracted_meta["error"])
                )
            
            # Check if the file was processed but no valid audio metadata was found
            if "info" in extracted_meta and extracted_meta.get("info") == "No tags found or unsupported format.":
                # This usually means the file is not a valid audio file
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content=format_response(success=False, error="File does not appear to be a valid audio file")
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
            print(f"An unexpected error occurred in metadata extraction: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"An internal server error occurred while extracting metadata: {e}")
            )
        finally:
            await file.close()  # Ensure the uploaded file is closed 