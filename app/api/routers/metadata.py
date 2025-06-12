# Metadata endpoints 
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.controllers.metadata_controller import MetadataController

router = APIRouter(tags=["metadata"])

# Initialize controller
metadata_controller = MetadataController()


@router.post("/metadata/")
async def get_metadata_endpoint(
    file: UploadFile = File(...)
) -> JSONResponse:
    """
    Extracts and returns metadata from an uploaded audio file using Mutagen.
    """
    return await metadata_controller.get_metadata(file) 