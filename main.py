import shutil
import os
import asyncio # Added for asyncio.to_thread
from contextlib import asynccontextmanager # For lifespan manager
from fastapi import FastAPI, File, UploadFile, HTTPException, Security, Depends, Query, Body, status
from fastapi.security.api_key import APIKeyHeader, APIKeyQuery
from fastapi.responses import JSONResponse
from starlette.status import HTTP_403_FORBIDDEN, HTTP_422_UNPROCESSABLE_ENTITY, HTTP_404_NOT_FOUND, HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_503_SERVICE_UNAVAILABLE
from starlette.middleware.cors import CORSMiddleware
import uuid
from typing import Dict, Any, Optional, AsyncGenerator # For lifespan type hint
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# Import modules
from src.ffmpeg import validate_audio_format, is_ffmpeg_installed
from src.similarity import calculate_similarity_for_upload, get_similarity_by_path
from src.search import search_tracks, initialize_mongodb_client, close_mongodb_client, get_track_path_by_id
from src.feedback import process_feedback, process_contact, initialize_gspread_client_on_startup
from src.utils import format_response, sanitize_filename, log_request
from src.metadata_extraction import extract_metadata # New import

# Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
TEMP_DIR = "temp_audio"
API_KEY_NAME = "api_key"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"  # In production, this should be stored securely

# Always set top_k with +1 additional, so we have an additional track in case of duplicates
SIMILARITY_DEFAULT_TOP_K = 21 # Global default for top_k

# Removed ALLOWED_AUDIO_TYPES as requested - using FFmpeg for validation instead

# Set up API key security - using query parameter as specified in frontend
api_key_query = APIKeyQuery(name=API_KEY_NAME, auto_error=False)

# Lifespan context manager
@asynccontextmanager
async def lifespan(app_instance: FastAPI) -> AsyncGenerator[None, None]:
    print("Application startup: Initializing external services via lifespan...")
    await initialize_gspread_client_on_startup()
    await initialize_mongodb_client()
    print("Application startup: External services initialization complete (lifespan).")
    yield
    print("Application shutdown: Cleaning up resources (lifespan)...")
    await close_mongodb_client()
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR) # Clean up temp directory on shutdown
        print(f"Cleaned up temporary directory: {TEMP_DIR}")
    print("Application shutdown: Resource cleanup complete (lifespan).")

# Create FastAPI app with description and version
app = FastAPI(
    title="Resomix API",
    description="API for audio similarity search, track information, and metadata extraction",
    version="1.0.1", # Incremented version
    lifespan=lifespan # Use the lifespan manager
)

# Startup event to initialize Google Sheets Client

# CORS (Cross-Origin Resource Sharing) Middleware

# Production Regex: Enforces HTTPS for resomix.com and its subdomains.
# Allows: https://resomix.com, https://sub.resomix.com, https://sub.resomix.com:port
ALLOWED_ORIGIN_REGEX = r"^https://([\w\-]+\.)*resomix\.com(:[0-9]+)?$"

# Development Regex: Allows any http or https origin. Similar to allow_origins=["*"].
# Use this for local development if you need to access the API from various local servers/ports.
DEV_ALLOWED_ORIGIN_REGEX = r"^https?://.*"

# Set the desired configuration here:
# CURRENT_ORIGIN_REGEX = ALLOWED_ORIGIN_REGEX # Default to production
CURRENT_ORIGIN_REGEX = DEV_ALLOWED_ORIGIN_REGEX # Uncomment for development

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CURRENT_ORIGIN_REGEX, 
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
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
# FEEDBACK_DIR = "feedback_data"
# if not os.path.exists(FEEDBACK_DIR):
#     os.makedirs(FEEDBACK_DIR)

# Pydantic model for the /get_selection_similarity/ request body
class SimilarityByIdRequest(BaseModel):
    track_id: str

async def get_api_key(
    api_key_query: str = Security(api_key_query),
):
    """Validate API key for endpoint security (from query parameter)"""
    if api_key_query == API_KEY:
        return api_key_query
    else:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )

@app.post("/metadata/")
async def get_metadata_endpoint(
    file: UploadFile = File(...),
    # api_key: str = Security(get_api_key) # Removed API key security
):
    """
    Extracts and returns metadata from an uploaded audio file using Mutagen.
    """
    log_request("metadata", "POST", {"filename": file.filename, "content_type": file.content_type})

    try:
        # Read file content into a temporary in-memory BytesIO object or save to temp file if too large
        # For Mutagen, passing file.file (SpooledTemporaryFile) directly is often fine.
        # asyncio.to_thread is crucial here as Mutagen's operations can be blocking.
        extracted_meta = await asyncio.to_thread(extract_metadata, file.file)
        
        if "error" in extracted_meta: # If Mutagen reported an error (e.g., unsupported format)
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, # Or 422 if it's more a processing error
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
        print(f"An unexpected error occurred in /metadata endpoint: {e}")
        # Ensure to close the file if it was opened, though UploadFile handles this.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error=f"An internal server error occurred while extracting metadata: {e}")
        )
    finally:
        await file.close() # Ensure the uploaded file is closed

@app.post("/get_similarity/")
async def get_similarity_upload_endpoint(
    file: UploadFile = File(...), 
    api_key: str = Security(get_api_key)
):
    """
    Process an audio file and return similar tracks.
    
    - **file**: The audio file to analyze (max 50MB)
    """
    log_request("get_similarity (upload)", "POST", {"filename": file.filename})
    
    # File Size Check
    if file.size > MAX_FILE_SIZE:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            content=format_response(
                success=False,
                error=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB."
            )
        )

    # Check if the file is empty
    if file.size == 0:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=format_response(
                success=False,
                error="File is empty. Please upload a valid audio file."
            )
        )

    audio_bytes = await file.read()
    # No need to seek(0) on UploadFile if only reading once.
    # If you were to read it again for some other purpose, then seek(0) would be needed.

    original_filename = sanitize_filename(file.filename) # Sanitize once

    if FFMPEG_AVAILABLE:
        is_valid_audio = validate_audio_format(audio_bytes, original_filename) # Pass sanitized name
        if not is_valid_audio:
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content=format_response(
                    success=False,
                    error="The uploaded file does not contain valid audio streams according to our analysis."
                )
            )
        
        # FFmpeg validation passed, directly use audio_bytes
        try:
            similarity_results = await calculate_similarity_for_upload(audio_bytes=audio_bytes, original_filename=original_filename, top_k=SIMILARITY_DEFAULT_TOP_K)
            if similarity_results.get("success") is False:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=format_response(success=False, error=similarity_results.get("error", "Similarity processing failed."))
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=similarity_results)
            )
        except Exception as e:
            print(f"An error occurred in get_similarity (upload with bytes): {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            )

    else: # FFmpeg not available, fall back to saving file and basic content type check
        print(f"WARNING: FFmpeg not available. Performing basic content type check for: {original_filename} and saving to temp file.")
        if not file.content_type or not file.content_type.startswith("audio/"):
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content=format_response(
                    success=False,
                    error="Content-Type doesn't appear to be audio. FFmpeg validation is not available for deep analysis."
                )
            )
        
        temp_file_path = ""
        try:
            # Need to re-read or use the stored audio_bytes if UploadFile stream was consumed.
            # Since we read audio_bytes above, we can use that directly for writing.
            unique_filename = f"{str(uuid.uuid4())}_{original_filename}"
            temp_file_path = os.path.join(TEMP_DIR, unique_filename)
            with open(temp_file_path, "wb") as buffer:
                buffer.write(audio_bytes) # Write the already read bytes

            print("FFmpeg not available. Cannot guarantee audio validity before sending to similarity server. Proceeding with byte upload with caution.")
            similarity_results = await calculate_similarity_for_upload(audio_bytes=audio_bytes, original_filename=original_filename)
            if similarity_results.get("success") is False:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=format_response(success=False, error=similarity_results.get("error", "Similarity processing failed."))
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=similarity_results)
            )

        except Exception as e:
            print(f"An error occurred in get_similarity (upload, no FFmpeg, fallback with bytes): {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            )
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path) # Clean up temp file if it was created


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
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=search_results)
        )
        
    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred in search_tracks: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="An internal server error occurred.")
        )


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
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=result)
        )
        
    except ValueError as ve:
        # Validation errors
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=format_response(success=False, error=str(ve))
        )
        
    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred in feedback: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="An internal server error occurred.")
        )


@app.get("/")
async def root():
    """Root endpoint that returns API information"""
    return {
        "name": "Resomix API",
        "version": "1.0.1",
        "status": "running",
        "docs_url": "/docs"
    }


@app.post("/get_selection_similarity/")
async def get_similarity_by_id_endpoint(
    request_data: SimilarityByIdRequest,
    api_key: str = Security(get_api_key)
):
    """
    Get similar tracks for a track identified by its MongoDB ID.
    Uses a global default for top_k.
    
    - **track_id**: The MongoDB ID of the track to find similar tracks for.
    """
    log_request("get_selection_similarity (by ID)", "POST", {"track_id": request_data.track_id})

    if not request_data.track_id or not request_data.track_id.strip():
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=format_response(success=False, error="track_id cannot be empty.")
        )

    try:
        # Step 1: Get the server_track_path from MongoDB using the track_id
        server_track_path = await get_track_path_by_id(request_data.track_id)

        if server_track_path is None:
            # This means the track_id was not found, or path was missing in DB
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND, # Use 404 for resource not found
                content=format_response(success=False, error=f"Track with ID '{request_data.track_id}' not found or path is missing.")
            )

        # Step 2: Call the similarity function with the fetched path and global top_k
        similarity_results = await get_similarity_by_path(
            server_track_path=server_track_path,
            top_k=SIMILARITY_DEFAULT_TOP_K # Use the global default
        )

        if similarity_results.get("success") is False:
            # Error from similarity service or internal processing in get_similarity_by_path
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, # Or determine based on similarity_results if more specific
                content=format_response(success=False, error=similarity_results.get("error", "Similarity processing failed for path."))
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=similarity_results)
        )

    except Exception as e:
        print(f"An error occurred in get_selection_similarity (by ID): {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="An internal server error occurred while processing similarity by ID.")
        )


if __name__ == "__main__":
    import uvicorn
    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8001)
