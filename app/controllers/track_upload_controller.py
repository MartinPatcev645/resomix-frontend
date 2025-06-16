"""
Track Upload Controller
=======================

This controller handles HTTP requests for track upload functionality.
It processes track upload requests, coordinates with the track upload service
for metadata extraction and database insertion, and provides appropriate responses.

Manages track upload validation, file handling, and response formatting
for upload-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import asyncio
from fastapi import UploadFile, status
from fastapi.responses import JSONResponse

from app.services.track_upload_service import TrackUploadService
from app.utils.response_utils import format_response
from app.utils.file_utils import sanitize_filename
from app.utils.logging_utils import log_request


class TrackUploadController:
    def __init__(self):
        self.track_upload_service = TrackUploadService()

    async def upload_track(self, file: UploadFile) -> JSONResponse:
        """
        Upload a track for similarity analysis - extracts metadata and stores in database.
        """
        log_request("track_upload", "POST", {"filename": file.filename, "content_type": file.content_type})

        try:
            # Basic validation - check if file is empty
            content = await file.read()
            if len(content) == 0:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(success=False, error="Empty file provided")
                )
            
            # Reset file pointer
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
            
            # Check file size (100MB limit)
            MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
            if len(content) > MAX_FILE_SIZE:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content=format_response(success=False, error="File size exceeds 100MB limit")
                )
            
            # Reset file pointer again for the service
            await file.seek(0)
            
            # Use asyncio.to_thread for the blocking database operation
            upload_result = await asyncio.to_thread(
                self.track_upload_service.upload_track_to_database, 
                file, 
                content
            )
            
            # Check if upload failed
            if not upload_result.get("success", False):
                error_msg = upload_result.get("error", "Unknown error occurred during upload")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=format_response(success=False, error=f"Upload failed: {error_msg}")
                )
            
            # Format successful response
            response_data = {
                "filename": sanitize_filename(file.filename),
                "track_uuid": upload_result["uuid"],
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
                "file_path": upload_result["uuid"],  # The UUID is used as file identifier
                "preview_path": f"/mnt/data/UPLOADS/{upload_result['uuid']}.mp3"
            }
            
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=format_response(
                    success=True, 
                    data=response_data,
                    message="Track uploaded successfully and added to database"
                )
            )

        except Exception as e:
            print(f"An unexpected error occurred in track upload: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"An internal server error occurred during upload: {e}")
            )
        finally:
            await file.close()  # Ensure the uploaded file is closed
