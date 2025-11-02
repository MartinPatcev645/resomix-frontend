# Playlist Backend API Specification

This document provides the complete backend API specification for Playlist management in the admin panel.

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Endpoint Specifications](#endpoint-specifications)
4. [Error Handling](#error-handling)

---

## 🗄️ Database Schema

### Playlists Table

```sql
CREATE TABLE IF NOT EXISTS playlists (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid        VARCHAR(36) NOT NULL UNIQUE,
    user_id     CHAR(36),                         -- nullable (anon)
    name        VARCHAR(150) NOT NULL,
    is_public   TINYINT(1) DEFAULT 0,
    type        ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    KEY idx_playlist_user (user_id),
    KEY idx_playlist_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Field Descriptions

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `uuid` | VARCHAR(36) | NO | - | Unique identifier (UUID v4) |
| `user_id` | CHAR(36) | YES | NULL | User's UUID (nullable for anonymous) |
| `name` | VARCHAR(150) | NO | - | Playlist name |
| `is_public` | TINYINT(1) | NO | 0 | Visibility flag (0=private, 1=public) |
| `type` | ENUM | NO | 'custom' | Playlist type (custom/similarity/waiting_segments) |
| `seed_track_id` | BIGINT UNSIGNED | YES | NULL | Reference to seed track (for similarity playlists) |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation timestamp |

### Index Strategy

- **Primary Key:** `id` - For fast lookups by ID
- **Unique Index:** `uuid` - Ensures uniqueness, enables fast UUID lookups
- **Index:** `user_id` - For efficient user-based queries
- **Index:** `uuid` - For fast UUID lookups (already unique)
- **Composite Index (Optional):** `(type, is_public)` - For common filtered queries
- **Composite Index (Optional):** `(user_id, created_at)` - For user playlist history queries
- **Foreign Key:** `seed_track_id` references `tracks(id)` with SET NULL on delete

---

## 📡 API Endpoints Overview

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/admin/playlist/` | List playlists with pagination/filters | ✅ Admin |
| DELETE | `/admin/playlist/delete/:id` | Delete single playlist | ✅ Admin |
| POST | `/admin/playlist/batch-delete` | Delete multiple playlists | ✅ Admin |
| POST | `/admin/playlist/export` | Export playlists to CSV | ✅ Admin |
| POST | `/admin/playlist/visibility/:id` | Change visibility of single playlist | ✅ Admin |
| POST | `/admin/playlist/batch-visibility` | Change visibility of multiple playlists | ✅ Admin |

---

## 🔧 Endpoint Specifications

### 1. List Playlists

**GET** `/admin/playlist/`

Retrieves a paginated list of playlists with filtering, searching, and sorting capabilities.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ | `1` | Page number (1-indexed) |
| `page_size` | integer | ❌ | `30` | Items per page (max: 100) |
| `search` | string | ❌ | - | Search term |
| `search_column` | string | ❌ | - | Column to search in: `id`, `uuid`, `name` |
| `is_public` | string | ❌ | - | Filter by visibility: `0` (private), `1` (public) |
| `type` | string | ❌ | - | Filter by type: `custom`, `similarity`, `waiting_segments` |
| `date_from` | string | ❌ | - | Start date filter (YYYY-MM-DD) |
| `date_to` | string | ❌ | - | End date filter (YYYY-MM-DD) |
| `sort_by` | string | ❌ | `id` | Sort column: `id`, `created_at` |
| `sort_order` | string | ❌ | `desc` | Sort order: `asc`, `desc` |

#### Request Example

```http
GET /admin/playlist/?page=1&page_size=30&type=similarity&is_public=1&search=mix&search_column=name&sort_by=created_at&sort_order=desc
Authorization: Bearer <admin_token>
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "My Awesome Mix",
      "is_public": true,
      "type": "similarity",
      "seed_track_id": 42,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "uuid": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": null,
      "name": "Anonymous Playlist",
      "is_public": false,
      "type": "custom",
      "seed_track_id": null,
      "created_at": "2024-01-14T15:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 30,
    "total": 1250,
    "total_pages": 42
  }
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid page_size. Maximum allowed is 100."
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Validate `page` > 0
   - Validate `page_size` between 1-100
   - Validate `sort_by` is in allowed columns: `id`, `created_at`
   - Validate `sort_order` is 'asc' or 'desc'
   - Validate date format (YYYY-MM-DD)
   - Validate `type` is one of: `custom`, `similarity`, `waiting_segments`
   - Validate `is_public` is '0' or '1'

2. **Search Logic:**
   - If `search` provided without `search_column`, search in `name` by default
   - For `name` search: Use LIKE query with wildcards: `WHERE name LIKE '%search%'`
   - For `uuid` search: Use exact match: `WHERE uuid = search`
   - For `id` search: Use exact match if numeric: `WHERE id = search`

3. **Visibility Filtering:**
   - `is_public=1`: `WHERE is_public = 1` (public playlists only)
   - `is_public=0`: `WHERE is_public = 0` (private playlists only)
   - Omit parameter for all playlists

4. **Type Filtering:**
   - `type=custom`: `WHERE type = 'custom'`
   - `type=similarity`: `WHERE type = 'similarity'`
   - `type=waiting_segments`: `WHERE type = 'waiting_segments'`
   - Omit parameter for all types

5. **Date Filtering:**
   - `date_from`: `WHERE created_at >= date_from 00:00:00`
   - `date_to`: `WHERE created_at <= date_to 23:59:59`

6. **Performance:**
   - Use proper indexes on `type`, `is_public`, `created_at`, `uuid`
   - Consider adding composite index `(type, is_public, created_at)` for common queries
   - Use LIMIT and OFFSET for pagination efficiently
   - Avoid SELECT * if not all fields needed

7. **Example SQL:**
   ```sql
   SELECT 
     id, uuid, user_id, name, is_public, type, seed_track_id, created_at
   FROM playlists
   WHERE 
     (type = ? OR ? IS NULL) AND
     (is_public = ? OR ? IS NULL) AND
     (name LIKE ? OR uuid = ? OR id = ? OR ? IS NULL) AND
     (created_at >= ? OR ? IS NULL) AND
     (created_at <= ? OR ? IS NULL)
   ORDER BY ? ?
   LIMIT ? OFFSET ?
   ```

---

### 2. Delete Single Playlist

**DELETE** `/admin/playlist/delete/:id`

Deletes a single playlist by ID.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Playlist ID |

#### Request Example

```http
DELETE /admin/playlist/delete/123
Authorization: Bearer <admin_token>
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Playlist deleted successfully"
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Playlist not found"
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Verify ID exists before deletion
   - Return 404 if not found
   - Validate ID is a positive integer

2. **Cascade Deletion:**
   - **Important:** Delete associated playlist tracks from junction table
   - Consider deleting: `playlist_tracks`, `playlist_ratings`, etc.
   - Use database foreign keys with CASCADE for automatic cleanup
   - Or manually delete related records in transaction

3. **Hard Delete:**
   - Permanently delete the record from database
   - This is appropriate for admin cleanup operations

4. **Audit Log:**
   - Log admin action with timestamp and admin user ID
   - Store deleted playlist metadata (id, uuid, name, user_id) for audit purposes
   - Track reason for deletion if applicable

5. **Example SQL:**
   ```sql
   -- Check existence and get metadata for logging
   SELECT id, uuid, name, user_id FROM playlists WHERE id = ?
   
   -- Delete related records (if not using CASCADE)
   DELETE FROM playlist_tracks WHERE playlist_id = ?
   DELETE FROM playlist_ratings WHERE playlist_id = ?
   
   -- Delete playlist
   DELETE FROM playlists WHERE id = ?
   ```

---

### 3. Batch Delete Playlists

**POST** `/admin/playlist/batch-delete`

Deletes multiple playlists in a single operation.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | array[integer] | ✅ | Array of playlist IDs to delete |

#### Request Example

```http
POST /admin/playlist/batch-delete
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "ids": [123, 456, 789]
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "deleted_count": 3,
  "message": "Successfully deleted 3 playlists"
}
```

**Partial Success (200 OK):**

```json
{
  "success": true,
  "deleted_count": 2,
  "message": "Deleted 2 out of 3 playlists. 1 not found."
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid request. 'ids' must be a non-empty array of integers."
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Validate `ids` is an array
   - Validate array is not empty
   - Validate all items are positive integers
   - Limit maximum batch size (e.g., 100 items) to prevent abuse

2. **Transaction:**
   - Use database transaction for atomic operation
   - Ensure all cascading deletes complete successfully
   - Commit if all operations succeed
   - Rollback only if critical error occurs

3. **Cascade Deletion:**
   - Delete all related records for each playlist:
     - `playlist_tracks` (junction table)
     - `playlist_ratings`
     - Any other dependent records
   - Use foreign keys with CASCADE or manual deletion

4. **Performance:**
   - Use `WHERE id IN (...)` for efficient deletion
   - Return count of actually deleted items
   - Don't fail if some IDs don't exist
   - Consider background job for very large batches (>100)

5. **Audit Log:**
   - Log batch deletion with all IDs and count
   - Store admin user ID and timestamp
   - Track which playlists were actually deleted vs. not found

6. **Example SQL:**
   ```sql
   -- Start transaction
   START TRANSACTION;
   
   -- Get existing IDs for logging
   SELECT id, uuid, name, user_id 
   FROM playlists 
   WHERE id IN (?, ?, ?)
   
   -- Delete related records (if not using CASCADE)
   DELETE FROM playlist_tracks WHERE playlist_id IN (?, ?, ?)
   DELETE FROM playlist_ratings WHERE playlist_id IN (?, ?, ?)
   
   -- Delete playlists
   DELETE FROM playlists 
   WHERE id IN (?, ?, ?)
   
   -- Get affected rows count
   SELECT ROW_COUNT() as deleted_count
   
   COMMIT;
   ```

---

### 4. Export Playlists to CSV

**POST** `/admin/playlist/export`

Generates a CSV export of playlists with current filters applied.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | ✅ | Export format: `csv` |
| `page` | integer | ❌ | Page number (for partial export) |
| `page_size` | integer | ❌ | Items per page |
| `search` | string | ❌ | Search term |
| `search_column` | string | ❌ | Column to search in |
| `is_public` | string | ❌ | Filter by visibility |
| `type` | string | ❌ | Filter by type |
| `date_from` | string | ❌ | Start date filter (YYYY-MM-DD) |
| `date_to` | string | ❌ | End date filter (YYYY-MM-DD) |
| `sort_by` | string | ❌ | Sort column |
| `sort_order` | string | ❌ | Sort order |

#### Request Example

```http
POST /admin/playlist/export
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "format": "csv",
  "type": "similarity",
  "is_public": "1",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31"
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "download_url": "/exports/playlist_export_1705320000.csv",
  "filename": "playlist_export_2024-01-15_10-30-00.csv",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid format. Only 'csv' is supported."
}
```

#### CSV Format

The CSV file should include the following columns with headers:

```csv
ID,UUID,User ID,Name,Visibility,Type,Seed Track ID,Created At
1,550e8400-e29b-41d4-a716-446655440000,123e4567-e89b-12d3-a456-426614174000,My Awesome Mix,Public,similarity,42,2024-01-15 10:30:00
2,660e8400-e29b-41d4-a716-446655440001,,Anonymous Playlist,Private,custom,,2024-01-14 15:20:00
3,770e8400-e29b-41d4-a716-446655440002,123e4567-e89b-12d3-a456-426614174000,Waiting Mix,Public,waiting_segments,128,2024-01-13 08:45:00
```

#### Backend Implementation Notes

1. **File Generation:**
   - Generate CSV file with current filters applied
   - Use same filtering/searching logic as list endpoint
   - Store in temporary exports directory
   - Use unique filename with timestamp: `playlist_export_YYYY-MM-DD_HH-MM-SS.csv`

2. **CSV Encoding:**
   - Use UTF-8 with BOM for Excel compatibility
   - Properly escape commas, quotes, and newlines in content
   - Use double quotes for fields containing special characters
   - Format dates consistently (YYYY-MM-DD HH:MM:SS)
   - Handle NULL values appropriately (empty string for CSV)

3. **Data Formatting:**
   - **Visibility:** Convert `is_public` boolean to human-readable: `1` → "Public", `0` → "Private"
   - **Type:** Convert enum to readable format: "custom" → "Custom", "similarity" → "Similarity", "waiting_segments" → "Waiting Segments"
   - **User ID:** Display as-is (UUID) or empty for anonymous
   - **Seed Track ID:** Display numeric ID or empty if null

4. **Security:**
   - Generate authenticated download URL with token
   - Include expiry time (e.g., 1 hour)
   - Validate token before serving file
   - Clean up expired files periodically (cron job)
   - Prevent path traversal attacks in filename

5. **Performance:**
   - For large exports (>10,000 rows), consider background job processing
   - Stream CSV generation to avoid memory issues
   - Limit maximum export size or require pagination parameters
   - Cache query results if same filter is used multiple times
   - Add rate limiting per admin user

6. **Download URL:**
   - Should require authentication token in URL or header
   - Verify expiry time before serving file
   - Delete file after successful download or after expiry
   - Rate limit export requests per admin user (e.g., 5 per hour)
   - Log all export requests with admin user ID

7. **Example Implementation:**
   ```python
   # Pseudo-code
   def export_playlists(filters):
       # Generate unique filename
       timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
       filename = f"playlist_export_{timestamp}.csv"
       filepath = f"/tmp/exports/{filename}"
       
       # Query with filters
       query = build_query(filters)
       results = execute_query(query)
       
       # Write CSV with UTF-8 BOM
       with open(filepath, 'w', encoding='utf-8-sig') as f:
           writer = csv.writer(f)
           writer.writerow([
               'ID', 'UUID', 'User ID', 'Name', 
               'Visibility', 'Type', 'Seed Track ID', 'Created At'
           ])
           
           for row in results:
               visibility = "Public" if row.is_public else "Private"
               type_label = format_type(row.type)
               user_id = row.user_id or ""
               seed_track = row.seed_track_id or ""
               
               writer.writerow([
                   row.id, row.uuid, user_id, row.name,
                   visibility, type_label, seed_track, row.created_at
               ])
       
       # Generate signed download URL with expiry
       download_url = generate_signed_url(filename, expires_in=3600)
       expires_at = datetime.now() + timedelta(hours=1)
       
       return {
           "download_url": download_url,
           "filename": filename,
           "expires_at": expires_at
       }
   ```

---

## ⚠️ Error Handling

### Standard Error Response Format

All endpoints should return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not admin) |
| 404 | Not Found (resource doesn't exist) |
| 409 | Conflict (duplicate UUID on insert) |
| 429 | Too Many Requests (rate limiting) |
| 500 | Internal Server Error |

### Common Error Messages

- **Authentication:**
  - `"Authentication required"`
  - `"Invalid or expired token"`
  - `"Admin privileges required"`

- **Validation:**
  - `"Invalid parameter: {param_name}"`
  - `"Missing required field: {field_name}"`
  - `"Invalid date format. Use YYYY-MM-DD"`
  - `"Invalid type. Must be 'custom', 'similarity', or 'waiting_segments'"`
  - `"Invalid is_public value. Must be '0' or '1'"`
  - `"Invalid sort_by column. Allowed: id, created_at"`
  - `"Invalid sort_order. Must be 'asc' or 'desc'"`
  - `"page_size must be between 1 and 100"`
  - `"Invalid UUID format"`

- **Not Found:**
  - `"Playlist not found"`
  - `"No playlists found matching criteria"`

- **Conflict:**
  - `"Playlist UUID already exists"` (if manually creating playlists)

- **Rate Limiting:**
  - `"Too many requests. Please try again later."`
  - `"Export rate limit exceeded. Please wait before requesting another export."`
  - `"Batch delete rate limit exceeded. Maximum 5 batch operations per minute."`

- **Business Logic:**
  - `"Cannot delete playlist: contains user-generated content"`
  - `"Playlist is currently being processed. Try again later."`

---

### 5. Change Single Playlist Visibility

**POST** `/admin/playlist/visibility/:id`

Changes the visibility (public/private) of a single playlist by ID.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Playlist ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_public` | boolean | ✅ | `true` for public, `false` for private |

#### Request Example

```http
POST /admin/playlist/visibility/123?api_key=your-api-key
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "is_public": true
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "message": "Playlist made public successfully"
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Playlist not found"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid is_public value. Must be a boolean."
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Verify ID exists before update
   - Return 404 if not found
   - Validate ID is a positive integer
   - Validate `is_public` is a boolean (not string "0"/"1")
   - Require `api_key` as query parameter

2. **Update Logic:**
   - Update `is_public` field directly
   - No cascade operations needed (visibility doesn't affect related records)
   - Use database transaction for consistency

3. **Audit Log:**
   - Log admin action with timestamp and admin user ID
   - Store playlist metadata (id, uuid, name) and old/new visibility state
   - Track reason for visibility change if applicable

4. **Example SQL:**
   ```sql
   -- Check existence
   SELECT id, uuid, name, is_public FROM playlists WHERE id = ?
   
   -- Update visibility
   UPDATE playlists 
   SET is_public = ? 
   WHERE id = ?
   ```

---

### 6. Batch Change Playlist Visibility

**POST** `/admin/playlist/batch-visibility`

Changes the visibility (public/private) of multiple playlists in a single operation.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | array[integer] | ✅ | Array of playlist IDs to update |
| `is_public` | boolean | ✅ | `true` for public, `false` for private |

#### Request Example

```http
POST /admin/playlist/batch-visibility?api_key=your-api-key
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "ids": [123, 456, 789],
  "is_public": false
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "updated_count": 3,
  "message": "Successfully updated 3 playlists"
}
```

**Partial Success (200 OK):**

```json
{
  "success": true,
  "updated_count": 2,
  "message": "Updated 2 out of 3 playlists. 1 not found."
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid request. 'ids' must be a non-empty array of integers."
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Validate `ids` is an array
   - Validate array is not empty
   - Validate all items are positive integers
   - Validate `is_public` is a boolean
   - Limit maximum batch size (e.g., 100 items) to prevent abuse

2. **Transaction:**
   - Use database transaction for atomic operation
   - Ensure all updates complete successfully
   - Commit if all operations succeed
   - Rollback only if critical error occurs

3. **Performance:**
   - Use `WHERE id IN (...)` for efficient update
   - Return count of actually updated items
   - Don't fail if some IDs don't exist
   - Consider background job for very large batches (>100)

4. **Audit Log:**
   - Log batch update with all IDs and count
   - Store admin user ID and timestamp
   - Track which playlists were actually updated vs. not found
   - Store old and new visibility state for each playlist

5. **Example SQL:**
   ```sql
   -- Start transaction
   START TRANSACTION;
   
   -- Get existing IDs and their current visibility for logging
   SELECT id, uuid, name, is_public 
   FROM playlists 
   WHERE id IN (?, ?, ?)
   
   -- Update visibility
   UPDATE playlists 
   SET is_public = ? 
   WHERE id IN (?, ?, ?)
   
   -- Get affected rows count
   SELECT ROW_COUNT() as updated_count
   
   COMMIT;
   ```

---

## ⚠️ Error Handling

### Standard Error Response Format

All endpoints should return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not admin) |
| 404 | Not Found (resource doesn't exist) |
| 409 | Conflict (duplicate UUID on insert) |
| 429 | Too Many Requests (rate limiting) |
| 500 | Internal Server Error |

### Common Error Messages

- **Authentication:**
  - `"Authentication required"`
  - `"Invalid or expired token"`
  - `"Admin privileges required"`

- **Validation:**
  - `"Invalid parameter: {param_name}"`
  - `"Missing required field: {field_name}"`
  - `"Invalid date format. Use YYYY-MM-DD"`
  - `"Invalid type. Must be 'custom', 'similarity', or 'waiting_segments'"`
  - `"Invalid is_public value. Must be boolean (true or false)"`
  - `"Invalid sort_by column. Allowed: id, created_at"`
  - `"Invalid sort_order. Must be 'asc' or 'desc'"`
  - `"page_size must be between 1 and 100"`
  - `"Invalid UUID format"`
  - `"Invalid playlist ID. Must be a positive integer"`
  - `"Batch size exceeds maximum of 100 items"`

- **Not Found:**
  - `"Playlist not found"`
  - `"No playlists found matching criteria"`

- **Conflict:**
  - `"Playlist UUID already exists"` (if manually creating playlists)

- **Rate Limiting:**
  - `"Too many requests. Please try again later."`
  - `"Export rate limit exceeded. Please wait before requesting another export."`
  - `"Batch delete rate limit exceeded. Maximum 5 batch operations per minute."`
  - `"Batch visibility update rate limit exceeded. Maximum 5 batch operations per minute."`

- **Business Logic:**
  - `"Cannot delete playlist: contains user-generated content"`
  - `"Playlist is currently being processed. Try again later."`
