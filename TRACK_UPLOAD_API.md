# Track Upload and Similarity API Documentation

## Overview

The ResomiX API provides an integrated approach to upload tracks and get similarity results in a single call.

### POST `/get_similarity/`

**🚀 Upload Track + Similarity Analysis**

Upload an audio track, store it in the database, and get similar tracks in one request.

**Process Flow:**
1. **Upload & Store**: Extracts metadata and stores track with `type="upload"`
2. **Send to Similarity Server**: Sends audio file and track UUID to similarity server
3. **Update Duration**: Gets duration from similarity server and updates database
4. **Return Results**: Returns uploaded track info and similarity results in the same format as similarity by ID

**Authentication**: API key required
**Content-Type**: `multipart/form-data`
**File Size Limit**: 100MB
**Supported Formats**: MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | Audio file to upload and analyze |
| `top_sk` | Integer | No | Number of similar tracks (10, 20, 50, 100) |

#### Success Response (200 OK)

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
    ]
  }
}
```

**Note**: The response format is identical to the similarity by ID endpoint, with:
- `queried_track`: Information about the uploaded track
- `similar_tracks`: Array of similar tracks found

#### Usage Example

```bash
curl -X POST \
  -H "api_key: your-api-key-here" \
  -F "file=@/path/to/your/audio.mp3" \
  -F "top_sk=20" \
  http://localhost:8001/get_similarity/
```

---

## Error Responses

### 413 Request Entity Too Large
```json
{
  "success": false,
  "error": "File size exceeds 100MB limit"
}
```

### 415 Unsupported Media Type
```json
{
  "success": false,
  "error": "Unsupported file format: .txt"
}
```

### 422 Unprocessable Entity
```json
{
  "success": false,
  "error": "Empty file provided"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to upload track to database: Metadata extraction failed"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": "Similarity service unavailable"
}
```

---

## Implementation Details

### Track Upload Process
1. **File Validation**: Checks file size, format, and audio validity
2. **Metadata Extraction**: Uses Mutagen library to extract track information
3. **UUID Generation**: Creates 24-character hexadecimal UUID
4. **Database Storage**: Stores track with `type="upload"` and creates relationships
5. **Similarity Analysis**: Sends audio file + UUID to similarity server
6. **Duration Update**: Updates database with duration from similarity server
7. **Response Formatting**: Returns results in same format as similarity by ID

### Metadata Extraction
- Uses Mutagen library for audio metadata extraction
- Extracts: Title, Artist, Album, Genre, Label, Year
- Handles multiple artists separated by commas, semicolons, or '&'
- Provides fallback values for missing metadata

### UUID Generation
- Generates 24-character hexadecimal UUIDs (similar to MongoDB ObjectIds)
- Uses cryptographically secure random number generation
- Ensures uniqueness across all uploaded tracks

### Database Storage
- Stores tracks with `type="upload"` to distinguish from catalog tracks
- Creates or finds related entities (artists, albums, labels, genres)
- Maintains referential integrity with proper foreign key relationships
- Uses transaction-based operations for data consistency

### Similarity Server Integration
- Sends both audio file and track UUID to similarity server
- Receives duration from similarity server and updates database
- Processes similarity results and enriches with database metadata
- Returns results in consistent format with similarity by ID endpoint

### File Path Handling
- `file_path`: Original filename with extension
- `preview_path`: `/mnt/data/UPLOADS/{uuid}.mp3`
- File size calculated from uploaded content

---

## Database Schema Impact

### New Track Record
- **Type**: Set to "upload" (different from "electrobuzz" catalog tracks)
- **UUID**: 24-character hex string
- **File Path**: Original filename
- **Preview Path**: `/mnt/data/UPLOADS/{uuid}.mp3`
- **Duration**: Updated from similarity server response
- **Metadata**: Title, year, file size
- **Relationships**: Links to artists, albums, labels, genres

### Related Tables
- **artists**: Created if not exists
- **albums**: Created if not exists (linked to primary artist)  
- **labels**: Created if not exists
- **genres**: Created if not exists
- **track_artists**: Junction table for multiple artists per track

---

## Complete Workflow Examples

### Python Example

```python
import requests

# Upload track and get similarity results in one call
url = "http://localhost:8001/get_similarity/"
headers = {"api_key": "your-api-key-here"}

with open("my_track.mp3", "rb") as f:
    files = {"file": f}
    data = {"top_sk": 20}
    response = requests.post(url, headers=headers, files=files, data=data)
    
if response.status_code == 200:
    result = response.json()
    query_track = result['data']['queried_track']
    similar_tracks = result['data']['similar_tracks']
    
    print(f"Uploaded track: {query_track['title']} by {query_track['artist']}")
    print(f"Duration: {query_track['duration']} seconds")
    print(f"Found {len(similar_tracks)} similar tracks")
    for track in similar_tracks[:3]:  # Show top 3
        print(f"  {track['rank']}. {track['artist']} - {track['title']} ({track['score']:.3f})")
else:
    print(f"Upload failed: {response.json()['error']}")
```

### JavaScript Example

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('top_sk', '20');

fetch('/get_similarity/', {
  method: 'POST',
  headers: {
    'api_key': 'your-api-key-here'
  },
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    const queryTrack = data.data.queried_track;
    const similarTracks = data.data.similar_tracks;
    
    console.log(`Uploaded: ${queryTrack.title} by ${queryTrack.artist}`);
    console.log(`Duration: ${queryTrack.duration} seconds`);
    console.log(`Similar tracks found: ${similarTracks.length}`);
    similarTracks.forEach(track => {
      console.log(`${track.rank}. ${track.artist} - ${track.title}`);
    });
  } else {
    console.error('Upload failed:', data.error);
  }
});
```

---

## Consistent API Response Format

Both `/get_similarity/` (upload) and `/get_selection_similarity/` (by ID) endpoints now return the same response format:

```json
{
  "success": true,
  "data": {
    "queried_track": {
      "rank": 0,
      "score": 1.0,
      "id": "track-uuid-or-id",
      "label": "Label Name",
      "duration": 195,
      "artist": "Artist Name",
      "title": "Track Title",
      "year": 2023
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.95,
        "id": "similar-track-id",
        "label": "Label Name",
        "duration": 210,
        "artist": "Similar Artist",
        "title": "Similar Track",
        "year": 2022
      }
    ]
  }
}
```

This consistency makes it easier to handle responses from both endpoints in your application code.

---

## Performance & Security

### Performance Considerations
- **Caching**: In-memory cache for artists/albums/labels/genres lookup
- **Batch Operations**: Efficient database insertions
- **Connection Pooling**: Reuses database connections
- **Async Processing**: Non-blocking metadata extraction and similarity analysis
- **Memory Management**: Handles large files efficiently
- **Duration Updates**: Efficient database updates from similarity server

### Security Features
- **API Key Authentication**: Required for all requests
- **File Type Validation**: Only allows audio file extensions
- **Size Limits**: Prevents oversized uploads
- **Input Sanitization**: Cleans metadata fields
- **SQL Injection Prevention**: Uses parameterized queries
- **UUID Transmission**: Secure UUID sent to similarity server 