import shutil
import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.responses import JSONResponse
from starlette.status import HTTP_403_FORBIDDEN, HTTP_422_UNPROCESSABLE_ENTITY, HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_503_SERVICE_UNAVAILABLE
from starlette.middleware.cors import CORSMiddleware
import uuid
from src.ffmpeg import validate_audio_format, is_ffmpeg_installed

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
TEMP_DIR = "temp_audio"
API_KEY_NAME = "access_token"
API_KEY = "YOUR_SECRET_API_KEY" # Replace with a strong, unique key, possibly from env variables

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

app = FastAPI()

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

# Check if FFmpeg is installed at startup (optional, but good for early warning)
FFMPEG_AVAILABLE = is_ffmpeg_installed()
if not FFMPEG_AVAILABLE:
    print("WARNING: FFmpeg is not installed or not found in PATH. Audio file validation will be skipped.")
    # Depending on policy, you might want to exit or disable the endpoint if FFmpeg is critical.

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == API_KEY:
        return api_key_header
    else:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )

@app.post("/get_similarity/")
async def get_similarity(file: UploadFile = File(...), api_key: str = Security(get_api_key)):
    # File Size Check
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )

    # Basic MIME type check (can be expanded, but ffprobe validation is more robust)
    # if not file.content_type.startswith("audio/"): # This is a good first check
    #     raise HTTPException(
    #         status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    #         detail="Invalid file type based on Content-Type. Only audio files are allowed."
    #     )

    temp_file_path = ""
    audio_bytes = await file.read() # Read file into memory once
    await file.seek(0) # Reset file pointer if we need to read it again (e.g., for saving)

    # --- FFmpeg Validation Step ---
    if FFMPEG_AVAILABLE:
        is_valid_audio = validate_audio_format(audio_bytes, file.filename)
        if not is_valid_audio:
            raise HTTPException(
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File is not a valid audio format or contains no audio streams according to FFmpeg/FFprobe."
            )
    else:
        # Fallback behavior if FFmpeg is not available
        # For security, you might want to reject the file if FFmpeg isn't available for validation.
        # For now, we'll proceed but log a warning. Consider your security policy here.
        print(f"WARNING: FFmpeg not available. Skipping deep audio validation for file: {file.filename}. Proceeding with basic checks only.")
        # Re-check content type if FFmpeg is not available, as a basic safeguard
        if not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Invalid Content-Type. Only audio files are allowed (FFmpeg validation skipped)."
            )
    # --- End FFmpeg Validation Step ---

    try:
        # Generate a unique filename to avoid collisions
        unique_filename = str(uuid.uuid4()) + "_" + file.filename
        temp_file_path = os.path.join(TEMP_DIR, unique_filename)

        # Save the uploaded file (which has been read into audio_bytes) to the temporary directory
        with open(temp_file_path, "wb") as buffer:
            buffer.write(audio_bytes) # Write the bytes read earlier

        # Placeholder for calling the similarity logic from utils.py
        # similarity_score = await calculate_similarity(temp_file_path) # Example call
        similarity_score = {"message": "File processed, similarity calculation pending.", "filename": file.filename}

        return JSONResponse(content={"similarity_score": similarity_score})

    except HTTPException as e:
        raise e # Re-raise HTTPExceptions to return proper FastAPI responses
    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")
    finally:
        # Ensure the temporary file is deleted after the request
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        # await file.close() # file.file is a SpooledTemporaryFile, FastAPI handles its closing.
                           # If we read it into `audio_bytes`, direct closing isn't strictly necessary here,
                           # but UploadFile.close() is good practice if we interacted directly with file.file stream elsewhere.

# Placeholder for actual similarity calculation in src/utils.py
# This would typically involve more complex audio processing
# For now, we'll simulate it here or in utils.py

if __name__ == "__main__":
    import uvicorn
    # It's good practice to make host and port configurable, e.g., via environment variables
    uvicorn.run(app, host="0.0.0.0", port=8001)
