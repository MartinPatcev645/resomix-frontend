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
            # Read file content into a temporary in-memory BytesIO object or save to temp file if too large
            # For Mutagen, passing file.file (SpooledTemporaryFile) directly is often fine.
            # asyncio.to_thread is crucial here as Mutagen's operations can be blocking.
            extracted_meta = await asyncio.to_thread(self.metadata_service.extract_metadata, file.file)
            
            if "error" in extracted_meta:  # If Mutagen reported an error (e.g., unsupported format)
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,  # Or 422 if it's more a processing error
                    content=format_response(success=False, error=extracted_meta["error"])
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
            # Ensure to close the file if it was opened, though UploadFile handles this.
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"An internal server error occurred while extracting metadata: {e}")
            )
        finally:
            await file.close()  # Ensure the uploaded file is closed 