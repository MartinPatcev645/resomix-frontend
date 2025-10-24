# Resomix API Reference - Alwyzon

**Comprehensive API endpoint documentation with input, processing, and output summaries**

**Production Server**: `https://bserver.resomix.com` | **Documentation**: `https://bserver.resomix.com/docs`

---

## 🎧 Audio Similarity Endpoints

### POST `/get_similarity/`
- **Input**: Audio file upload (max 100MB) + optional top_sk parameter (10/20/50/100)
- **Processing**: Extracts metadata → stores track in database → **calls similarity microservice `/similarity/query-by-upload/` endpoint** → deduplicates results → creates playlist
- **Output**: Uploaded track details + array of similar tracks with scores and metadata + optional playlist info

### POST `/get_selection_similarity/`
- **Input**: Track database ID + optional top_sk parameter (10/20/50/100)
- **Processing**: Retrieves track file path → **calls similarity microservice `/similarity/query-by-path/` endpoint** → enriches results with database metadata → deduplicates → creates playlist
- **Output**: Queried track details + array of similar tracks with scores and metadata + optional playlist info

---

## 🔍 Search & Discovery Endpoints

### GET `/search_tracks/`
- **Input**: Text query string (1-200 characters)
- **Processing**: Searches database across titles, artists, albums, labels using fuzzy matching and relevance scoring
- **Output**: Array of matching tracks with metadata, scores, and search relevance ranking

### POST `/metadata/`
- **Input**: Audio file upload (any supported format)
- **Processing**: Extracts metadata using FFmpeg and Mutagen → applies filtering rules → validates and cleans data
- **Output**: Comprehensive metadata object (title, artist, album, genre, label, year, duration, BPM, key)

---

## 🎼 Playlist Management Endpoints

### PUT `/playlists/rename/`
- **Input**: Playlist UUID + new name (1-150 characters)
- **Processing**: Validates playlist exists → updates name in database → commits transaction
- **Output**: Success confirmation with operation status message

### PUT `/playlists/visibility/`
- **Input**: Playlist UUID + is_public boolean flag
- **Processing**: Validates playlist exists → updates visibility status in database → commits transaction
- **Output**: Success confirmation with visibility change status message

### GET `/playlists/similarity/{playlist_id}`
- **Input**: Playlist UUID via URL path parameter
- **Processing**: Validates playlist is public → retrieves playlist with tracks → applies metadata filtering → formats as similarity response
- **Output**: Similarity-formatted response with queried track, similar tracks array, and playlist metadata

---

## 🎵 Preview & Content Endpoints

### GET `/preview/get_preview/`
- **Input**: Track database ID as query parameter
- **Processing**: Validates track exists → generates time-limited signed URL → encrypts with HMAC and Fernet
- **Output**: Secure preview download URL with expiration timestamp and authentication tokens

---

## 🔧 Pipeline Processing Endpoints

### POST `/monthly_pipeline/track/`
- **Input**: Audio file upload + file path string
- **Processing**: Extracts metadata → generates UUID → **calls similarity server `/generate_embedding_preview` endpoint** → stores in database if successful
- **Output**: Success confirmation with track UUID, path, and processing status message

---

## 💬 Feedback & Contact Endpoints

### POST `/feedback/`
- **Input**: Satisfaction rating (1-10) + recommendation rating (1-10) + optional feedback text + category + user_id
- **Processing**: Validates ratings → stores in database → **optionally sends to Google Sheets API** → generates confirmation
- **Output**: Success confirmation with feedback submission ID and timestamp

### GET `/feedback/{feedback_id}`
- **Input**: Feedback ID via URL path parameter
- **Processing**: Validates feedback exists → retrieves from database → formats response
- **Output**: Complete feedback record with ratings, text, category, timestamps, and status

### PATCH `/feedback/{feedback_id}/status`
- **Input**: Feedback ID via URL path + status update (open/resolved)
- **Processing**: Validates feedback exists → updates status in database → commits transaction
- **Output**: Success confirmation with updated status information

### POST `/feedback/contact/`
- **Input**: Name + email + message + optional subject + phone + user_id
- **Processing**: Validates email format → stores in database → **optionally sends to Google Sheets API** → generates confirmation
- **Output**: Success confirmation with contact submission ID and timestamp

### GET `/contact/{contact_id}`
- **Input**: Contact ID via URL path parameter
- **Processing**: Validates contact exists → retrieves from database → formats response
- **Output**: Complete contact record with personal details, message, timestamps, and status

### PATCH `/contact/{contact_id}/status`
- **Input**: Contact ID via URL path + status update (open/resolved)
- **Processing**: Validates contact exists → updates status in database → commits transaction
- **Output**: Success confirmation with updated status information

---

## 🏥 Health & Status Endpoints

### GET `/`
- **Input**: None (public endpoint)
- **Processing**: Returns static API information and service status
- **Output**: API name, version, status, and documentation URL

### GET `/health`
- **Input**: None (public endpoint)
- **Processing**: Performs basic health check of service availability
- **Output**: Service health status and API identification

---

## 🔐 Authentication

**All endpoints require API key authentication via query parameter:**
```
?api_key=YOUR_API_KEY
```

**Example requests:**
```bash
# Development
curl -X GET "http://localhost:8005/api/health/?api_key=YOUR_API_KEY"

# Production
curl -X GET "https://bserver.resomix.com/api/health/?api_key=YOUR_API_KEY"
```

**Exception**: Health endpoints (`/` and `/health`) are public and don't require authentication.

---

## 📊 Response Format

**All API responses follow this standardized format:**

```json
{
  "success": true,
  "data": {
    // Endpoint-specific response data
  }
}
```

**Error responses include:**
```json
{
  "success": false,
  "error": "Error description",
  "details": {
    // Additional error context when available
  }
}
```

---

## 🔗 External Service Integration

### Similarity Microservice
The Resomix API integrates with an external similarity microservice for audio similarity calculations:

- **Service URL**: Configurable via `SIMILARITY_SERVER_URL` environment variable
- **Endpoints Used**:
  - `/similarity/query-by-upload/` - For similarity calculation of uploaded files
  - `/similarity/query-by-path/` - For similarity calculation by file path
  - `/generate_embedding_preview` - For monthly pipeline embedding generation
- **Communication**: HTTP POST requests with 60-second timeout using httpx client
- **Response Handling**: Automatic retry and error management with structured error responses

### Google Sheets Integration
Feedback and contact endpoints can optionally integrate with Google Sheets for data storage:

- **Authentication**: Service account authentication using Google OAuth2
- **Worksheets**: Separate sheets for feedback and contact submissions
- **Data Flow**: Parallel storage in database and Google Sheets with fallback handling
- **Configuration**: Optional integration controlled by environment variables

---

## 🎯 Key Processing Features

### Metadata Filtering
- **URL/Domain Detection**: Automatically removes URLs and domain names from metadata fields
- **Title Cleaning**: Removes unwanted strings like "(Original Mix)" and stops at markers
- **Field Validation**: Ensures data quality and consistency across all metadata

### Similarity Pipeline
- **Multi-format Support**: Handles MP3, FLAC, WAV, OGG, M4A, AAC, OPUS, WMA formats
- **Deduplication**: Advanced algorithms prevent duplicate results based on filename and artist/title combinations
- **Score Ranking**: Similarity scores from 0.0 to 1.0 with higher scores indicating better matches

### Security & Performance
- **API Key Validation**: Secure access control on all protected endpoints
- **File Size Limits**: 100MB maximum file upload size with validation
- **Async Processing**: Full async/await implementation for high-performance operations
- **Database Optimization**: Connection pooling and optimized queries for 2.2M+ track database

---

**Resomix API v3.0.1** - Advanced audio similarity and music discovery platform
