import shutil
import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends, Query, Body
from fastapi.security.api_key import APIKeyHeader
from fastapi.responses import JSONResponse
from starlette.status import HTTP_403_FORBIDDEN, HTTP_422_UNPROCESSABLE_ENTITY, HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_503_SERVICE_UNAVAILABLE
from starlette.middleware.cors import CORSMiddleware
import uuid
from typing import Dict, Any, Optional

# Import modules
from src.ffmpeg import validate_audio_format, is_ffmpeg_installed
from src.similarity import calculate_similarity
from src.search import search_tracks
from src.feedback import process_feedback, process_contact
from src.utils import format_response, sanitize_filename, log_request

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
TEMP_DIR = "temp_audio"
API_KEY_NAME = "api_key"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"  # In production, this should be stored securely

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

# Create FastAPI app with description and version
app = FastAPI(
    title="Resomix API",
    description="API for audio similarity search and track information",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for simplicity, restrict in production
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create a temporary directory for uploads if it doesn't exist
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

# Check if FFmpeg is installed at startup
FFMPEG_AVAILABLE = is_ffmpeg_installed()
if not FFMPEG_AVAILABLE:
    print("WARNING: FFmpeg is not installed or not found in PATH. Audio file validation will be skipped.")

# Create feedback data directory if it doesn't exist
FEEDBACK_DIR = "feedback_data"
if not os.path.exists(FEEDBACK_DIR):
    os.makedirs(FEEDBACK_DIR)


async def get_api_key(api_key_header: str = Security(api_key_header)):
    """Validate API key for endpoint security"""
    if api_key_header == API_KEY:
        return api_key_header
    else:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )


@app.post("/get_similarity/")
async def get_similarity_endpoint(
    file: UploadFile = File(...), 
    api_key: str = Security(get_api_key)
):
    """
    Process an audio file and return similar tracks.
    
    - **file**: The audio file to analyze (max 50MB)
    """
    log_request("get_similarity", "POST", {"filename": file.filename})
    
    # File Size Check
    if file.size > MAX_FILE_SIZE:
        return format_response(
            success=False,
            error=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )

    # Basic MIME type check
    if not file.content_type.startswith("audio/"):
        return format_response(
            success=False,
            error="Invalid file type based on Content-Type. Only audio files are allowed."
        )

    # Check if the file is empty
    if file.size == 0:
        return format_response(
            success=False,
            error="File is empty. Please upload a valid audio file."
        )

    temp_file_path = ""
    audio_bytes = await file.read()  # Read file into memory once
    await file.seek(0)  # Reset file pointer

    # FFmpeg Validation Step
    if FFMPEG_AVAILABLE:
        is_valid_audio = validate_audio_format(audio_bytes, file.filename)
        if not is_valid_audio:
            return format_response(
                success=False,
                error="File is not a valid audio format or contains no audio streams according to our checks."
            )
    else:
        # Fallback if FFmpeg is not available
        print(f"WARNING: FFmpeg not available. Skipping deep audio validation for: {file.filename}")
        # Re-check content type if FFmpeg is not available
        if not file.content_type.startswith("audio/"):
            return format_response(
                success=False,
                error="Invalid Content-Type. Only audio files are allowed (FFmpeg validation skipped)."
            )

    try:
        # Sanitize filename and create unique name
        safe_filename = sanitize_filename(file.filename)
        unique_filename = f"{str(uuid.uuid4())}_{safe_filename}"
        temp_file_path = os.path.join(TEMP_DIR, unique_filename)

        # Save the uploaded file to the temporary directory
        with open(temp_file_path, "wb") as buffer:
            buffer.write(audio_bytes)

        # Process the file and get similarity results
        similarity_results = await calculate_similarity(temp_file_path)
        
        # Return success response with the similarity data
        return format_response(success=True, data=similarity_results)

    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred in get_similarity: {e}")
        return format_response(success=False, error="An internal server error occurred.")
    
    finally:
        # Ensure the temporary file is deleted after the request
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.get("/search_tracks/")
async def search_tracks_endpoint(
    query: str = Query(..., description="The search term"),
    api_key: str = Security(get_api_key)
):
    """
    Search for tracks based on a query string.
    
    - **query**: Search term to find matching tracks
    """
    log_request("search_tracks", "GET", {"query": query})
    
    try:
        # Call the search function
        search_results = await search_tracks(query)
        
        # Return success response with the search results
        return format_response(success=True, data=search_results)
        
    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred in search_tracks: {e}")
        return format_response(success=False, error="An internal server error occurred.")


@app.post("/feedback")
async def feedback_endpoint(
    data: Dict[str, Any] = Body(...),
    api_key: str = Security(get_api_key)
):
    """
    Submit feedback or contact form data.
    
    For feedback form, include:
    - **satisfaction**: Rating from 1-10
    - **recommendation**: Rating from 1-10
    - **feedback**: Feedback text
    
    For contact form, include:
    - **name**: User's name
    - **email**: User's email
    - **subject**: Subject of the message
    - **message**: Message text
    - **formType**: Set to "contact"
    """
    log_request("feedback", "POST", {"formType": data.get("formType", "feedback")})
    
    try:
        # Determine if this is a contact form or feedback form
        if data.get("formType") == "contact":
            result = await process_contact(data)
        else:
            result = await process_feedback(data)
            
        # Return success response
        return format_response(success=True, data=result)
        
    except ValueError as ve:
        # Validation errors
        return format_response(success=False, error=str(ve))
        
    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred in feedback: {e}")
        return format_response(success=False, error="An internal server error occurred.")


@app.get("/")
async def root():
    """Root endpoint that returns API information"""
    return {
        "name": "Resomix API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8002)
