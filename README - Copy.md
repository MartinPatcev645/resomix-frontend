# Audio Similarity API

A FastAPI server for calculating the similarity between audio tracks. The server accepts audio file uploads, validates them for security, and processes them to return similarity metrics.

## Features

- Audio file validation using FFmpeg/FFprobe for deep content analysis
- Secure file handling with temporary storage
- API key authentication via query parameter
- Search functionality for tracks
- Feedback and contact form submission
- Configurable file size limits (currently set to 50MB)
- Concurrent request handling
- Frontend-compatible response format

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

By default, the server will run on `http://0.0.0.0:8002`. You can modify the host and port in the `main.py` file.

## Frontend Integration

This API is designed to work with a React frontend that uses the provided `api.js` service. The API accepts and returns data in a format that matches frontend expectations:

- API key is passed as a query parameter: `?api_key=YOUR_API_KEY`
- All responses follow a consistent format:
  ```json
  { "success": true, "data": {...} }
  ```
  or
  ```json
  { "success": false, "error": "Error message" }
  ```
- Error responses include appropriate HTTP status codes (422, 415, 500, etc.)
- File validation is performed using FFmpeg rather than relying on MIME types

## API Documentation

Once the server is running, you can access the auto-generated API documentation at:

- Swagger UI: `http://localhost:8002/docs`
- ReDoc: `http://localhost:8002/redoc`

### Endpoints

#### 1. POST /get_similarity/

Upload an audio file to calculate its similarity metrics and receive similar tracks.

**Authorization:** Requires an API key provided via the `api_key` query parameter.

**Request:**
- Content-Type: multipart/form-data
- Body: audio file (max 50MB)

**Responses:**
- Success:
  ```json
  {
    "success": true,
    "data": {
      "duration": 123,
      "similar_tracks": [
        {
          "id": 1,
          "title": "Track Title",
          "artist": "Artist Name",
          "duration": 180,
          "genre": "Genre Name",
          "bpm": 120,
          "key": "C Major",
          "imageUrl": "https://example.com/image.jpg",
          "previewUrl": "https://example.com/preview.mp3"
        },
        // More similar tracks...
      ]
    }
  }
  ```
- Error:
  ```json
  {
    "success": false,
    "error": "Error message"
  }
  ```

#### 2. GET /search_tracks/

Search for tracks based on a query string.

**Authorization:** Requires an API key provided via the `api_key` query parameter.

**Request Parameters:**
- `query`: The search term

**Responses:**
- Success:
  ```json
  {
    "success": true,
    "data": {
      "tracks": [
        {
          "id": 1,
          "title": "Track Title",
          "artist": "Artist Name",
          "duration": 180,
          "genre": "Genre Name",
          "bpm": 120,
          "imageUrl": "https://example.com/image.jpg"
        },
        // More tracks...
      ]
    }
  }
  ```
- Error:
  ```json
  {
    "success": false,
    "error": "Error message"
  }
  ```

#### 3. POST /feedback

Submit feedback or contact form data.

**Authorization:** Requires an API key provided via the `api_key` query parameter.

**Request for Feedback Form:**
```json
{
  "satisfaction": 8,
  "recommendation": 9,
  "feedback": "This is user feedback text"
}
```

**Request for Contact Form:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about Resomix",
  "message": "I have a question about...",
  "formType": "contact"
}
```

**Responses:**
- Success:
  ```json
  {
    "success": true,
    "data": {
      "message": "Feedback received successfully"
    }
  }
  ```
- Error:
  ```json
  {
    "success": false,
    "error": "Error message"
  }
  ```

## Security Considerations

1. **File Validation:** All uploaded files are verified using FFmpeg to ensure they contain valid audio streams, helping prevent malicious file uploads. The API doesn't rely on MIME type declarations, which can be spoofed.

2. **Temporary Storage:** Files are only stored temporarily during processing and are automatically deleted afterward.

3. **API Key Authentication:** All requests require a valid API key.

4. **CORS Configuration:** By default, all origins are allowed. For production, you should modify the CORS settings in `main.py` to only allow trusted origins.

## Project Structure

```
├── main.py                  # FastAPI application and endpoint definitions
├── requirements.txt         # Python dependencies
├── README.md                # Project documentation
├── temp_audio/              # Temporary storage for audio files (created at runtime)
├── feedback_data/           # Storage for feedback submissions (created at runtime)
└── src/
    ├── ffmpeg.py            # FFmpeg integration for audio validation
    ├── utils.py             # Utility functions used across the application
    ├── similarity.py        # Audio similarity calculation logic
    ├── search.py            # Track search functionality
    └── feedback.py          # Feedback and contact form processing
```

## Development

### Extending the API

#### Adding New Endpoints

To add new endpoints, you should:

1. Create a new module in the `src/` directory if your endpoint has distinct functionality
2. Update `main.py` to import your module and create the endpoint
3. Use the `format_response` utility for consistent response formatting

#### Implementing Actual Audio Similarity

The current implementation uses mock data for similarity calculation. To implement real audio similarity:

1. Modify `src/similarity.py` with your audio analysis algorithm
2. Consider using libraries like librosa for audio feature extraction
3. Implement a database connection to store and query track features

## License

[Specify your license here]