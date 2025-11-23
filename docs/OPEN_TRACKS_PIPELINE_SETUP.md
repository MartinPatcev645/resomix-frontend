# Open Tracks Pipeline Setup Guide

This guide outlines the steps to implement the **Open Tracks Pipeline**, a parallel ingestion flow for "Open" type tracks. This pipeline mimics the existing Monthly Pipeline but targets a different track type and supports a "Demo Mode" where search is restricted to these tracks.

---

## 1. Overview

*   **Goal**: Create a separate pipeline for `OPEN` tracks (distinct from `ELECTROBUZZ`).
*   **Endpoints**:
    *   `POST /open_tracks_pipeline/track/`: Upload and process a single track.
    *   `POST /open_tracks_pipeline/update_embeddings/`: Bulk update embeddings for `OPEN` tracks.
*   **Demo Mode**: When `DEMO_MODE=True`, the search functionality must **only** return `OPEN` tracks from the database (bypassing Elasticsearch).

---

## 2. Configuration Changes

### A. Update `app/core/config.py`
Add configuration fields for the SCP transfer to make it environment-dependent (do not hardcode paths).

**Add these fields to `Settings` class:**
*   `scp_private_key_path`: Path to the SSH private key (default: `creds/resomix22tbserver-key.pem`).
*   `scp_remote_user`: Remote user for SCP (default: `ubuntu`).
*   `scp_remote_host`: Remote host IP (default: `65.21.116.184`).
*   `scp_remote_port`: Remote SSH port (default: `8522`).
*   `scp_remote_dir`: Target directory on the similarity server (default: `/home/ubuntu/usman/resomix-similarity/data/open_tracks/`).

### B. Update `.env`
Ensure these new variables are added to your `.env` file (and `.env.example`).

```bash
SCP_PRIVATE_KEY_PATH=/etc/pem/resomix22tbserver-key.pem
SCP_REMOTE_USER=ubuntu
SCP_REMOTE_HOST=65.21.116.184
SCP_REMOTE_PORT=8522
SCP_REMOTE_DIR=/home/ubuntu/usman/resomix-similarity/data/open_tracks/
```

---

## 3. Implementation Steps

### Step 1: Update Constants
**File**: `app/models/constants.py`

*   Update `TrackType` enum to include `OPEN`.

```python
class TrackType:
    ELECTROBUZZ = "electrobuzz"
    UPLOAD = "upload"
    OPEN = "open"  # <--- Add this
    
    ALL_TYPES = [ELECTROBUZZ, UPLOAD, OPEN]
```

### Step 2: Create Service
**File**: `app/services/open_tracks_pipeline_service.py`

*   **Base it on**: `app/services/monthly_pipeline_service.py`.
*   **Modifications**:
    1.  **`generate_embedding_preview`**:
        *   Call the **new** similarity server endpoint: `/open_tracks_pipeline/generate_embedding_preview` (ensure this exists on similarity server).
    2.  **`update_embeddings`**:
        *   **Query**: Change the SQL query to select **only** `OPEN` tracks.
            ```sql
            SELECT uuid, file_path FROM tracks WHERE track_type = 'open'
            ```
        *   **SCP**: Use the new `settings.scp_*` configuration values instead of hardcoded paths.
        *   **Trigger**: Call the **new** similarity server endpoint: `/open-tracks-pipeline/update_embeddings`.

### Step 3: Create Controller
**File**: `app/controllers/open_tracks_pipeline_controller.py`

*   **Base it on**: `app/controllers/monthly_pipeline_controller.py`.
*   **Modifications**:
    1.  **Service**: Initialize `OpenTracksPipelineService` instead of `MonthlyPipelineService`.
    2.  **`process_track`**:
        *   When calling `track_upload_service.upload_track_to_database_with_uuid`, pass `track_type=TrackType.OPEN`.
    3.  **Logging**: Update all log categories and actions to reflect `OPEN_PIPELINE` (e.g., `action="open_pipeline_start"`).

### Step 4: Create Router
**File**: `app/api/routers/open_tracks_pipeline.py`

*   **Base it on**: `app/api/routers/monthly_pipeline.py`.
*   **Modifications**:
    *   Prefix: `/open_tracks_pipeline`.
    *   Tags: `["open_tracks_pipeline"]`.
    *   Controller: Use `OpenTracksPipelineController`.

### Step 5: Register Router
**File**: `app/main.py`

*   Import and include the new router.

```python
from app.api.routers import open_tracks_pipeline
# ...
app.include_router(open_tracks_pipeline.router)
```

---

## 4. Demo Mode Logic (Search)

**File**: `app/services/search_service.py` (or `app/controllers/search_controller.py`)

Modify the search logic to handle `settings.demo_mode`.

**Logic:**
1.  Check `if settings.demo_mode:`
2.  **If True**:
    *   **Do NOT** call Elasticsearch.
    *   Perform a direct SQL `LIKE` query on the MariaDB `tracks` table.
    *   **Filter**: `WHERE track_type = 'open'`.
    *   **Search**: Match `title` or `artist` against the query string.
    *   Return results formatted similarly to the ES response.
3.  **If False**:
    *   Proceed with existing Elasticsearch logic (searching all indices/types as currently implemented).

---

## 5. Dos and Don'ts

*   **DO** use `TrackType.OPEN` explicitly for all tracks in this pipeline.
*   **DO** use the `settings` object for all SCP paths and credentials.
*   **DO** ensure the Similarity Server has the corresponding endpoints (`/open_tracks_pipeline/...`) set up before testing.
*   **DON'T** hardcode `/home/usman/data/` or key paths in the new service; use the config.
*   **DON'T** mix `ELECTROBUZZ` tracks into this pipeline; the query in `update_embeddings` must be strict.

---d

## 6. Checklist

- [ ] **Config**: Added SCP settings to `app/core/config.py`.
- [ ] **Constants**: Added `TrackType.OPEN` to `app/models/constants.py`.
- [ ] **Service**: Created `open_tracks_pipeline_service.py` with SCP config usage and `OPEN` type filtering.
- [ ] **Controller**: Created `open_tracks_pipeline_controller.py` using the new service and logging.
- [ ] **Router**: Created `open_tracks_pipeline.py` and registered it in `main.py`.
- [ ] **Search**: Implemented `DEMO_MODE` logic to restrict search to `OPEN` tracks via DB query.
- [ ] **Env**: Updated `.env` with real SCP paths and credentials.
