# Track Upload and Similarity API Documentation

## Overview

The ResomiX API provides two ways to upload tracks for similarity analysis:

1. **Integrated Similarity Endpoint** (`/get_similarity/`) - **RECOMMENDED**: Upload track, store in database, and get similarity results in one call
2. **Standalone Upload Endpoint** (`/upload-track/`) - Upload track to database only (for cases where you just want to store the track)

## Recommended Flow: Integrated Upload + Similarity

### POST `/get_similarity/`

**🚀 This is the main endpoint you should use for similarity analysis.**

Upload an audio track, store it in the database, and get similar tracks in one request.

**Process Flow:**
1. **Upload & Store**: Extracts metadata and stores track with `type="upload"`
2. **Similarity Analysis**: Finds similar tracks from the database
3. **Combined Response**: Returns both uploaded track info and similarity results

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
    "original_filename": "my_track.mp3",
    "duration": 195,
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
    "uploaded_track": {
      "uuid": "67ad9cec799206f8d64acd08",
      "track_id": 12345,
      "file_size": 5242880,
      "metadata": {
        "title": "My Amazing Track",
        "artist": "My Artist Name",
        "album": "My Album",
        "genre": "Electronic",
        "label": "My Label",
        "year": "2023"
      },
      "preview_path": "/mnt/data/UPLOADS/67ad9cec799206f8d64acd08.mp3"
    }
  }
}
```

#### Usage Example

```bash
curl -X POST \
  -H "api_key: your-api-key-here" \
  -F "file=@/path/to/your/audio.mp3" \
  -F "top_sk=20" \
  http://localhost:8001/get_similarity/
```

---

## Alternative: Standalone Upload

### POST `/upload-track/`

Upload a track to the database without similarity analysis.

**Use this when:**
- You only want to store the track in the database
- You'll run similarity analysis later using the track UUID

**Response includes only upload information (no similarity results)**

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Track uploaded successfully and added to database",
  "data": {
    "filename": "amazing_song.mp3",
    "track_uuid": "67ad9cec799206f8d64acd08",
    "track_id": 12345,
    "file_size": 5242880,
    "metadata": {
      "title": "Amazing Song",
      "artist": "Fantastic Artist",
      "album": "Great Album",
      "genre": "Electronic",
      "label": "Cool Records",
      "year": "2023"
    },
    "file_path": "67ad9cec799206f8d64acd08",
    "preview_path": "/mnt/data/UPLOADS/67ad9cec799206f8d64acd08.mp3"
  }
}
```

---

## Error Responses (Both Endpoints)

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

### 503 Service Unavailable (Similarity Only)
```json
{
  "success": false,
  "error": "Similarity service unavailable"
}
```

---

## Implementation Details

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

### Python Example (Recommended Flow)

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
    uploaded_track = result['data']['uploaded_track']
    similar_tracks = result['data']['similar_tracks']
    
    print(f"Track uploaded: {uploaded_track['uuid']}")
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
    console.log('Track uploaded:', data.data.uploaded_track.uuid);
    console.log('Similar tracks found:', data.data.similar_tracks.length);
    data.data.similar_tracks.forEach(track => {
      console.log(`${track.rank}. ${track.artist} - ${track.title}`);
    });
  } else {
    console.error('Upload failed:', data.error);
  }
});
```

---

## Performance & Security

### Performance Considerations
- **Caching**: In-memory cache for artists/albums/labels/genres lookup
- **Batch Operations**: Efficient database insertions
- **Connection Pooling**: Reuses database connections
- **Async Processing**: Non-blocking metadata extraction and similarity analysis
- **Memory Management**: Handles large files efficiently

### Security Features
- **API Key Authentication**: Required for all requests
- **File Type Validation**: Only allows audio file extensions
- **Size Limits**: Prevents oversized uploads
- **Input Sanitization**: Cleans metadata fields
- **SQL Injection Prevention**: Uses parameterized queries

---

## Migration Notes

If you're currently using a separate upload process, you can migrate to the integrated flow:

**Before:**
1. Upload track separately
2. Call similarity endpoint with track ID

**After (Recommended):**
1. Use `/get_similarity/` endpoint directly
2. Get both upload confirmation and similarity results in one call

This reduces API calls and ensures your uploaded tracks are immediately available for similarity analysis. 