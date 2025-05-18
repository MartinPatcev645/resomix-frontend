# Audio Similarity API

A FastAPI server for calculating the similarity between audio tracks. The server accepts audio file uploads, validates them for security, and processes them to return similarity metrics.

## Features

- Audio file validation using FFmpeg/FFprobe
- Secure file handling with temporary storage
- API key authentication
- Configurable file size limits (currently set to 50MB)
- Concurrent request handling

## Requirements

### FFmpeg

This application requires FFmpeg to be installed on the system for audio file validation. FFmpeg is used to verify that uploaded files are genuine audio files with valid audio streams.

#### Installing FFmpeg

- **Windows:** Download from [FFmpeg.org](https://ffmpeg.org/download.html) or install via Chocolatey:
  ```
  choco install ffmpeg
  ```

- **macOS:** Install using Homebrew:
  ```
  brew install ffmpeg
  ```

- **Linux (Debian/Ubuntu):**
  ```
  sudo apt update
  sudo apt install ffmpeg
  ```

### Python Dependencies

- Python 3.8 or higher
- FastAPI
- Uvicorn
- Other dependencies listed in `requirements.txt`

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Create and activate a virtual environment (optional but recommended):
   ```
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. Install the required Python packages:
   ```
   pip install -r requirements.txt
   ```

## Configuration

- **API Key:** Change the default API key in `main.py` before deploying to production. Ideally, set it via environment variables.
- **Maximum File Size:** You can adjust the `MAX_FILE_SIZE` constant in `main.py` (default: 50MB).
- **Temporary Directory:** Audio files are temporarily stored in the `temp_audio` directory. This can be configured via the `TEMP_DIR` constant.

## Running the Server

Start the server with:

```
python main.py
```

By default, the server will run on `http://0.0.0.0:8001`. You can modify the host and port in the `main.py` file.

## API Documentation

Once the server is running, you can access the auto-generated API documentation at:

- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

### Endpoints

#### POST /get_similarity/

Upload an audio file to calculate its similarity metrics.

**Authorization:** Requires an API key provided via the `access_token` header.

**Request:**
- Content-Type: multipart/form-data
- Body: audio file (max 50MB)

**Responses:**
- 200: Successful operation with similarity results
- 403: Invalid or missing API key
- 415: Invalid file format (not a valid audio file)
- 422: File too large or invalid
- 500: Server error

## Security Considerations

1. **File Validation:** All uploaded files are verified using FFmpeg to ensure they contain valid audio streams, helping prevent malicious file uploads.

2. **Temporary Storage:** Files are only stored temporarily during processing and are automatically deleted afterward.

3. **API Key Authentication:** All requests require a valid API key.

4. **CORS Configuration:** By default, all origins are allowed. For production, you should modify the CORS settings in `main.py` to only allow trusted origins.

## Development

### Project Structure

- `main.py` - FastAPI application and endpoint definitions
- `src/ffmpeg.py` - FFmpeg integration for audio validation
- `src/utils.py` - Utility functions including similarity calculation

### Extending the Similarity Calculation

The current implementation has a placeholder for similarity calculation. To implement your own similarity logic, modify the `calculate_similarity` function in `src/utils.py`.

## License

[Specify your license here]