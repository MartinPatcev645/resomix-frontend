# ResomiX API Documentation
**Complete guide for calling ResomiX audio similarity and search endpoints**

**Base URL**: `https://bserver.resomix.com`  
**Documentation**: `https://bserver.resomix.com/docs`

---

## 🔐 Authentication

All endpoints require API key authentication via query parameter:
```
?api_key=YOUR_API_KEY
```

---

## 🎧 1. `/get_similarity/` [UPLOAD] - File Upload Operations

### Description
Upload an audio file and get similar tracks. Performs a two-step process:
1. **Upload to Database**: Extracts metadata and stores the track with type="upload"  
2. **Similarity Analysis**: Finds similar tracks and returns results

### Request Format

**Method**: `POST`  
**URL**: `https://bserver.resomix.com/get_similarity/`  
**Content-Type**: `multipart/form-data`

#### Parameters
| Parameter | Type | Required | Location | Constraints | Description |
|-----------|------|----------|----------|-------------|-------------|
| `api_key` | string | ✅ Yes | Query | - | API authentication key |
| `file` | file | ✅ Yes | Form Data | Max 100MB | Audio file to analyze |
| `top_sk` | integer | ❌ No | Query | 10, 20, 50, or 100 | Number of similar tracks to return |

#### Request Example
```bash
curl -X POST "https://bserver.resomix.com/get_similarity/?api_key=YOUR_API_KEY&top_sk=20" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@audio_track.mp3"
```

#### Supported Audio Formats
- **Primary**: MP3, WAV, FLAC, M4A, AAC
- **Additional**: OGG, WMA, AIFF (with FFmpeg validation)
- **Max Size**: 100MB per file
- **Validation**: FFmpeg-based audio stream validation when available

### Response Format

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "queried_track": {
      "rank": 0,
      "score": 1.0,
      "id": "67ad9cec799206f8d64acd08",
      "label": "User Upload",
      "duration": 195,
      "artist": "Amazing Artist", 
      "title": "Uploaded Track",
      "year": 2023
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.9899008274078369,
        "id": "67addcb39387d00fbdc3acdf",
        "label": "Global Underground",
        "duration": 491,
        "artist": "Oxia",
        "title": "Whole Life (Original Mix)",
        "year": 2010
      }
    ],
    "playlist": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Amazing Artist - Uploaded Track"
    }
  }
}
```

#### Error Responses

**422 - File Too Large**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 100MB."
}
```

**422 - Empty File**
```json
{
  "success": false,
  "error": "File is empty. Please upload a valid audio file."
}
```

**415 - Invalid Audio Format**
```json
{
  "success": false,
  "error": "The uploaded file does not contain valid audio streams according to our analysis."
}
```

**500 - Database Error**
```json
{
  "success": false,
  "error": "Failed to upload track to database: [specific error]"
}
```

**503 - Similarity Service Unavailable**
```json
{
  "success": false,
  "error": "Similarity processing failed."
}
```

### Processing Flow
1. **File Validation**: Size, format, and audio stream validation
2. **Metadata Extraction**: Uses FFmpeg and Mutagen for comprehensive metadata
3. **Database Storage**: Stores track with UUID, metadata, and type="upload"
4. **Similarity Server Call**: `POST /similarity/query-by-upload/` with audio bytes
5. **Result Processing**: Deduplication, enrichment with database metadata
6. **Playlist Creation**: Auto-generates similarity playlist
7. **Response Formatting**: Standard ResomiX response format

---

## 🔍 2. `/search_tracks/` [SEARCH] - Search Operations

### Description
Search for tracks across titles, artists, albums, and metadata using text-based queries with fuzzy matching and relevance scoring.

### Request Format

**Method**: `GET`  
**URL**: `https://bserver.resomix.com/search_tracks/`  
**Content-Type**: `application/json`

#### Parameters
| Parameter | Type | Required | Location | Constraints | Description |
|-----------|------|----------|----------|-------------|-------------|
| `api_key` | string | ✅ Yes | Query | - | API authentication key |
| `query` | string | ✅ Yes | Query | 1-200 chars | Search term to find matching tracks |

#### Request Example
```bash
curl -X GET "https://bserver.resomix.com/search_tracks/?query=electronic%20music&api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Response Format

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "507f1f77bcf86cd799439011",
        "artist": "Electronic Artist",
        "duration": 245,
        "title": "Electronic Track"
      },
      {
        "id": "507f1f77bcf86cd799439012", 
        "artist": "Techno Producer",
        "duration": 180,
        "title": "Techno Beat"
      }
    ]
  }
}
```

#### Error Responses

**500 - Internal Server Error**
```json
{
  "success": false,
  "error": "An internal server error occurred."
}
```

### Search Features
- **Multi-field Search**: Searches across track titles, artist names, and file paths
- **Case-insensitive**: All searches are case-insensitive
- **Fuzzy Matching**: Uses SQL `ILIKE` with wildcards for partial matches
- **Result Limit**: Returns up to 20 results by default
- **Database Integration**: Searches MariaDB with proper relationship loading

### Processing Flow
1. **Query Validation**: Ensures query is 1-200 characters
2. **Database Search**: Multi-table search across tracks, artists, and metadata
3. **Result Formatting**: Standardizes track information format
4. **Response Assembly**: Wraps results in standard ResomiX response format

---

## ⚡ 3. `/get_selection_similarity/` [SIMILARITY] - Similarity Analysis

### Description
Get similar tracks for a track identified by its database UUID. Uses existing track data to find similar tracks without uploading files.

### Request Format

**Method**: `POST`  
**URL**: `https://bserver.resomix.com/get_selection_similarity/`  
**Content-Type**: `application/json`

#### Parameters
| Parameter | Type | Required | Location | Constraints | Description |
|-----------|------|----------|----------|-------------|-------------|
| `api_key` | string | ✅ Yes | Query | - | API authentication key |

#### Request Body
```json
{
  "track_id": "67addcb39387d00fbdc3acdf",
  "top_sk": 20
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `track_id` | string | ✅ Yes | 24-char UUID | Database UUID of track to find similar tracks for |
| `top_sk` | integer | ❌ No | 10, 20, 50, or 100 | Number of similar tracks to return (default: 20) |

#### Request Example
```bash
curl -X POST "https://bserver.resomix.com/get_selection_similarity/?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "67addcb39387d00fbdc3acdf",
    "top_sk": 20
  }'
```

### Response Format

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "queried_track": {
      "rank": 0,
      "score": 1.0,
      "id": "67addcb39387d00fbdc3acdf",
      "label": "Global Underground",
      "duration": 491,
      "artist": "Oxia",
      "title": "Whole Life (Original Mix)",
      "year": 2010
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.8956789,
        "id": "67addcb39387d00fbdc3ace0",
        "label": "Anjunabeats",
        "duration": 456,
        "artist": "Above & Beyond",
        "title": "Sun & Moon",
        "year": 2011
      }
    ],
    "playlist": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Oxia - Whole Life (Original Mix)"
    }
  }
}
```

#### Error Responses

**404 - Track Not Found**
```json
{
  "success": false,
  "error": "Track with ID '67addcb39387d00fbdc3acdf' not found or path is missing"
}
```

**422 - Invalid Track ID**
```json
{
  "success": false,
  "error": "track_id cannot be empty"
}
```

**422 - Validation Error**
```json
{
  "success": false,
  "error": "top_sk must be one of [10, 20, 50, 100]"
}
```

**503 - Similarity Service Unavailable**
```json
{
  "success": false,
  "error": "Similarity processing failed"
}
```

### Processing Flow
1. **Track ID Validation**: Ensures track_id is provided and not empty
2. **Database Lookup**: Gets file path from MariaDB using track UUID  
3. **Path Validation**: Ensures track file path exists
4. **Similarity Server Call**: `POST /similarity/query-by-path/` with file path
5. **Result Processing**: Deduplication, enrichment with database metadata
6. **Playlist Creation**: Auto-generates similarity playlist
7. **Response Formatting**: Standard ResomiX response format

---

## 🔧 Implementation Details

### Response Schema Standards

All endpoints follow the ResomiX standard response format:

**Success Response**:
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Top_SK Parameter Logic

The `top_sk` parameter controls result quantity with built-in deduplication:

| top_sk | Actual Request | Deduplication Threshold | Final Results |
|--------|----------------|-------------------------|---------------|
| 10 | 12 | 2 | ~10 |
| 20 | 22 | 2 | ~20 |
| 50 | 54 | 4 | ~50 |
| 100 | 105 | 5 | ~100 |

### Authentication Requirements

- **API Key**: Required for all endpoints
- **Location**: Query parameter `?api_key=YOUR_API_KEY`
- **Format**: String, provided by ResomiX team
- **Error**: Returns 403 if missing or invalid

### Rate Limiting & Constraints

- **File Size**: Maximum 100MB for uploads
- **Search Query**: 1-200 characters
- **Timeout**: 300 seconds (5 minutes) for similarity processing
- **Concurrency**: Designed for multiple concurrent requests

### Error Handling

All endpoints return appropriate HTTP status codes:
- **200**: Success
- **400**: Bad Request (malformed request)
- **403**: Forbidden (invalid API key)
- **404**: Not Found (track not found)
- **415**: Unsupported Media Type (invalid audio file)
- **422**: Unprocessable Entity (validation errors)
- **500**: Internal Server Error
- **503**: Service Unavailable (similarity server down)

### Network Configuration

- **Base URL**: `https://bserver.resomix.com`
- **SSL**: Required (HTTPS only)
- **Timeout**: Configure 300+ second timeouts for similarity operations
- **Retry Logic**: Implement exponential backoff for 503 errors

---

## 🚨 Important Notes

### File Upload Considerations
- Always validate file size before upload
- Support multipart/form-data encoding
- Handle FFmpeg validation errors gracefully
- Sanitize filenames for security

### Similarity Processing
- Operations can take 30-60 seconds for large files
- Results include similarity scores (0.0 to 1.0, higher = more similar)
- Automatic playlist creation on successful similarity analysis
- Fire-and-forget playlist peaks request sent to similarity server

### Database Integration
- Track IDs are 24-character hexadecimal UUIDs
- All metadata is filtered and sanitized
- Artist information supports multiple artists per track
- Duration fields are in seconds (integer)

### Performance Optimization
- Use async/await for all API calls
- Implement proper timeout handling
- Cache authentication tokens where possible
- Batch operations when available

---

## 📞 Support

For API access, rate limits, or technical support:
- **Documentation**: `https://bserver.resomix.com/docs`
- **Contact**: Technical team via official channels
- **Status**: Monitor service health via endpoint availability 