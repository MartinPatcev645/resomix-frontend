# Resomix B2B Partner API Reference

Welcome to the **Resomix B2B Partner API** documentation!

This API allows partners to seamlessly integrate audio similarity and metadata extraction capabilities directly into their supply-chain pipelines, digital asset managers, and distribution workflows.

---

## 1. Getting Started — First Similarity Search in 5 Minutes

Integrating with the Resomix B2B Partner API is designed to be simple and rapid. Follow these three steps to perform your first audio similarity search in under 5 minutes.

### Step 1: Obtain an API Key
For immediate sandboxed testing, you can use our pre-configured sandbox credentials. This key operates against our public CC-licensed demo music catalog:
*   **Sandbox API Key**: `rmx_sandbox_demo_1234567890`

For staging and production keys with dedicated namespace isolation, please refer to the [Pricing & Onboarding Page](https://resomix.com/partners) or contact your partner manager.

### Step 2: Set the Base URL
Depending on your environment, point your HTTP client to one of the following base URLs:
*   **Local Development**: `http://localhost:8001`
*   **Staging Environment**: `https://staging.resomix.com`
*   **Production API**: `https://api.resomix.com`

### Step 3: Execute Your First Search
Run the following standard `curl` command in your terminal to find similar tracks to a known demo track ID:

```bash
curl -X POST "http://localhost:8001/api/v1/similarity/search" \
  -H "Authorization: Bearer rmx_sandbox_demo_1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "67ad9cec799206f8d64acd08",
    "top_sk": 10
  }'
```

#### Expected JSON Success Response:
```json
{
  "success": true,
  "data": {
    "queried_track": {
      "id": "67ad9cec799206f8d64acd08",
      "title": "Whole Life (Original Mix)",
      "artist": "Oxia",
      "duration": 491,
      "label": "Global Underground",
      "year": 2010
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.9899,
        "id": "67addcb39387d00fbdc3acdf",
        "title": "Whole Life (Club Edit)",
        "artist": "Oxia",
        "duration": 420,
        "label": "Global Underground",
        "year": 2010
      }
    ]
  }
}
```

---

## 2. Authentication

All B2B Partner endpoints (with the exception of `/api/v1/health`) require authentication and authorization.

### The Bearer API Key
Every request must transmit your **B2B Bearer API Key** in the standard HTTP `Authorization` header. API keys are formatted according to their environment and subscription tier:
```
rmx_<tier>_<random_entropy_string>
```

**Example Tiers**:
*   `rmx_sandbox_...` — Free rate-limited testing environment
*   `rmx_starter_...` — Starter plan production key
*   `rmx_growth_...` — Growth plan production key
*   `rmx_enterprise_...` — Enterprise plan high-throughput key

#### Passing the API Key in the Header:
```http
Authorization: Bearer rmx_starter_5ab73c8ef21d904a
```

#### Alternative Query Parameter Method:
For testing pipelines, scripts, or legacy clients that cannot set request headers, you can transmit the key via the `api_key` query parameter:
```http
GET http://localhost:8001/api/v1/partner/me?api_key=rmx_starter_5ab73c8ef21d904a
```
> [!WARNING]
> While supported, query parameter authentication is highly discouraged in production because URLs are commonly stored in plain text inside browser histories, proxy logs, and diagnostic servers.

### Scopes & Permissions
B2B API keys are assigned granular permission scopes at the time of issuance. If your key lacks a required scope, the server returns a `401 Unauthorized` response with detail indicating the missing permission.

*   `similarity:read` — Required to execute catalog or upload similarity searches.
*   `metadata:read` — Required to parse, validate, and extract audio metadata.
*   `partner:read` — Required to monitor your usage statistics, quotas, and health.

### Rate Limiting & Quotas
Resomix enforces a two-layer rate limiting system to protect database health and ensure high-availability guarantees:

#### Layer 1: Burst Protection (Requests Per Second)
Limits rapid bursts of requests from a single client.
*   **Default Starter Limit**: 10 requests per second (RPS).
*   **Behavior**: When exceeded, the server returns an `HTTP 429 Too Many Requests` status code with a standard `Retry-After: <seconds>` response header indicating how long to wait before trying again.
*   **Response Body**:
    ```json
    {
      "success": false,
      "error": "Rate limit exceeded"
    }
    ```

#### Layer 2: Monthly Quotas (Volume Limits)
Limits monthly overall consumption based on your tier (e.g. 100,000 requests/month).
*   **Behavior**: When exceeded, subsequent requests are blocked.
*   **Response Body**:
    ```json
    {
      "success": false,
      "error": "Monthly quota exceeded"
    }
    ```

---

## 3. Endpoint Reference

Below is a detailed guide to our B2B endpoints. Each endpoint contains code examples in **curl**, **Python**, and **JavaScript**.

### A. Real-Time Similarity Ingestion (File Upload)
`POST /api/v1/similarity/upload`

Upload an audio file (up to 100MB) to temporarily store it in the database and run a real-time similarity search against the sandboxed FAISS index.

*   **Content-Type**: `multipart/form-data`
*   **Query Parameters**:
    *   `top_sk` (*optional*, integer): Number of similar tracks to return (`10`, `20`, `50`, or `100`). Defaults to `20`.
    *   `engine` (*optional*, string): Similarity engine identifier (`E1` to `E6`).

#### Code Examples:

##### curl
```bash
curl -X POST "http://localhost:8001/api/v1/similarity/upload?top_sk=10" \
  -H "Authorization: Bearer rmx_starter_yourkeyhere" \
  -F "file=@/path/to/audio.mp3"
```

##### Python (requests)
```python
import requests

url = "http://localhost:8001/api/v1/similarity/upload"
params = {"top_sk": 10}
headers = {"Authorization": "Bearer rmx_starter_yourkeyhere"}
files = {"file": ("audio.mp3", open("/path/to/audio.mp3", "rb"), "audio/mpeg")}

response = requests.post(url, headers=headers, params=params, files=files)
print(response.json())
```

##### JavaScript (Fetch)
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('http://localhost:8001/api/v1/similarity/upload?top_sk=10', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer rmx_starter_yourkeyhere'
  },
  body: formData
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

### B. Catalog Similarity Search (by Track ID)
`POST /api/v1/similarity/search`

Request similar items for a track already indexed and verified in the database.

*   **Content-Type**: `application/json`
*   **Request Body JSON**:
    *   `track_id` (*required*, string): UUID of the source track.
    *   `top_sk` (*optional*, integer): Number of matches (`10`, `20`, `50`, or `100`). Defaults to `20`.
    *   `engine` (*optional*, string): Similarity engine version.

#### Code Examples:

##### curl
```bash
curl -X POST "http://localhost:8001/api/v1/similarity/search" \
  -H "Authorization: Bearer rmx_starter_yourkeyhere" \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "67ad9cec799206f8d64acd08",
    "top_sk": 20
  }'
```

##### Python (requests)
```python
import requests

url = "http://localhost:8001/api/v1/similarity/search"
headers = {
    "Authorization": "Bearer rmx_starter_yourkeyhere",
    "Content-Type": "application/json"
}
payload = {
    "track_id": "67ad9cec799206f8d64acd08",
    "top_sk": 20
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

##### JavaScript (Fetch)
```javascript
fetch('http://localhost:8001/api/v1/similarity/search', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer rmx_starter_yourkeyhere',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    track_id: '67ad9cec799206f8d64acd08',
    top_sk: 20
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

### C. Deep Audio Metadata Extraction
`POST /api/v1/metadata/track`

Extract tag and technical audio metadata from an uploaded audio file. Mutagen runs deep inspections to compile tags, album information, bitrates, and sample rates.

*   **Content-Type**: `multipart/form-data`
*   **Body Parameters**:
    *   `file` (*required*, binary): The audio file to analyze.

#### Code Examples:

##### curl
```bash
curl -X POST "http://localhost:8001/api/v1/metadata/track" \
  -H "Authorization: Bearer rmx_starter_yourkeyhere" \
  -F "file=@/path/to/audio.wav"
```

##### Python (requests)
```python
import requests

url = "http://localhost:8001/api/v1/metadata/track"
headers = {"Authorization": "Bearer rmx_starter_yourkeyhere"}
files = {"file": ("audio.wav", open("/path/to/audio.wav", "rb"), "audio/wav")}

response = requests.post(url, headers=headers, files=files)
print(response.json())
```

##### JavaScript (Fetch)
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('http://localhost:8001/api/v1/metadata/track', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer rmx_starter_yourkeyhere'
  },
  body: formData
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

## 4. Error Code Reference

The B2B Partner API utilizes standard HTTP status codes combined with specific diagnostic error details to make handling exceptions simple and structured.

| HTTP Status | Error Detail String | Description / Cause | Action / Resolution |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | `INVALID_INPUT` | The JSON request body is malformed or invalid. | Check request JSON brackets, properties, and types. |
| **`401 Unauthorized`** | `Invalid API key` | The API Key sent in `Authorization` header is unrecognized. | Verify that the key is typed correctly and has a valid prefix. |
| **`401 Unauthorized`** | `API key has been revoked` | The API Key was disabled or rotated by an administrator. | Replace with an active API Key. |
| **`401 Unauthorized`** | `API key has expired` | The API Key has reached its designated expiration date. | Request a new key from your partner dashboard. |
| **`401 Unauthorized`** | `API key missing required scope: <scope>` | The API key works but does not possess required scopes. | Re-issue a key containing the required scopes (e.g. `similarity:read`). |
| **`401 Unauthorized`** | `Partner account is inactive or disabled`| Your organization's tenant subscription is suspended. | Check billing details or contact partner support. |
| **`403 Forbidden`** | `Authentication required...` | Request lacked an `Authorization` header. | Set the `Authorization: Bearer <key>` header on requests. |
| **`404 Not Found`** | `Track not found` | The catalog UUID does not refer to any active indexed track. | Verify UUID validity or perform an upload similarity search. |
| **`415 Unsupported Media Type`** | `Malicious content detected` | The antivirus scanner detected a potential virus or threat. | The file has been quarantined. Clean file and retry. |
| **`415 Unsupported Media Type`** | `Invalid audio format` | Uploaded file contains no valid audio streams. | Re-encode file using standard code (MP3, WAV, FLAC, M4A). |
| **`422 Unprocessable Entity`** | `File too large` | Uploaded audio file exceeds the 100MB system ceiling. | Compress or compress audio segment and re-upload. |
| **`422 Unprocessable Entity`** | `File is empty` | Uploaded audio file is 0 bytes. | Verify file path integrity. |
| **`429 Too Many Requests`** | `Rate limit exceeded` | Client exceeded local burst rate per second (Layer 1 limits). | Throttle client calls; respect the `Retry-After` header. |
| **`429 Too Many Requests`** | `Monthly quota exceeded` | Client reached organizational volume limits (Layer 2 limits). | Upgrade tier or contact partner representative to buy overages. |
| **`503 Service Unavailable`** | `Similarity service is currently unavailable` | Internal FAISS index engine or indexing worker is offline. | Wait 30 seconds and retry. If persistent, check `status.resomix.com`. |
