# Waitlist Backend API Specification

This document provides the complete backend API specification for Waitlist management in the admin panel.

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Endpoint Specifications](#endpoint-specifications)
4. [Error Handling](#error-handling)
5. [Security & Authentication](#security--authentication)

---

## 🗄️ Database Schema

### Waitlist Table

```sql
CREATE TABLE IF NOT EXISTS waitlist (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email     VARCHAR(255) NOT NULL UNIQUE,
    status    ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_waitlist_email (email),
    KEY idx_waitlist_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Field Descriptions

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `email` | VARCHAR(255) | NO | - | User's email (UNIQUE) |
| `status` | ENUM | NO | 'pending' | Current status (pending/approved/rejected) |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | Last update timestamp (auto-updated) |

### Index Strategy

- **Primary Key:** `id` - For fast lookups by ID
- **Unique Index:** `email` - Ensures no duplicate emails, enables fast email lookups
- **Index:** `status` - For efficient status filtering
- **Composite Index (Optional):** `(status, created_at)` - For common filtered queries

---

## 📡 API Endpoints Overview

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/admin/waitlist/` | List waitlist entries with pagination/filters | ✅ Admin |
| DELETE | `/admin/waitlist/delete/:id` | Delete single waitlist entry | ✅ Admin |
| POST | `/admin/waitlist/batch-delete` | Delete multiple waitlist entries | ✅ Admin |
| POST | `/admin/waitlist/update-status/:id` | Update waitlist entry status | ✅ Admin |
| POST | `/admin/waitlist/export` | Export waitlist to CSV | ✅ Admin |

---

## 🔧 Endpoint Specifications

### 1. List Waitlist Entries

**GET** `/admin/waitlist/`

Retrieves a paginated list of waitlist entries with filtering, searching, and sorting capabilities.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ | `1` | Page number (1-indexed) |
| `page_size` | integer | ❌ | `30` | Items per page (max: 100) |
| `search` | string | ❌ | - | Search term |
| `search_column` | string | ❌ | - | Column to search in: `id`, `email` |
| `status` | string | ❌ | - | Filter by status: `pending`, `approved`, `rejected` (omit for all) |
| `date_from` | string | ❌ | - | Start date filter (YYYY-MM-DD) |
| `date_to` | string | ❌ | - | End date filter (YYYY-MM-DD) |
| `sort_by` | string | ❌ | `id` | Sort column: `id`, `created_at` |
| `sort_order` | string | ❌ | `desc` | Sort order: `asc`, `desc` |

#### Request Example

```http
GET /admin/waitlist/?page=1&page_size=30&status=pending&search=example@email.com&search_column=email&sort_by=created_at&sort_order=desc
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
      "email": "user@example.com",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "email": "another@example.com",
      "status": "approved",
      "created_at": "2024-01-14T15:20:00Z",
      "updated_at": "2024-01-15T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 30,
    "total": 250,
    "total_pages": 9
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
   - Validate `status` is one of: `pending`, `approved`, `rejected`

2. **Search Logic:**
   - If `search` provided without `search_column`, search in `email` by default
   - For `email` search: Use LIKE query with wildcards: `WHERE email LIKE '%search%'`
   - For `id` search: Use exact match if numeric: `WHERE id = search`

3. **Date Filtering:**
   - `date_from`: `WHERE created_at >= date_from 00:00:00`
   - `date_to`: `WHERE created_at <= date_to 23:59:59`

4. **Performance:**
   - Use proper indexes on `status`, `email`, `created_at`
   - Consider adding composite index `(status, created_at)` for common queries
   - Use LIMIT and OFFSET for pagination efficiently

5. **Example SQL:**
   ```sql
   SELECT * FROM waitlist
   WHERE 
     (status = ? OR ? IS NULL) AND
     (email LIKE ? OR ? IS NULL) AND
     (created_at >= ? OR ? IS NULL) AND
     (created_at <= ? OR ? IS NULL)
   ORDER BY ? ?
   LIMIT ? OFFSET ?
   ```

---

### 2. Delete Single Waitlist Entry

**DELETE** `/admin/waitlist/delete/:id`

Deletes a single waitlist entry by ID.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Waitlist entry ID |

#### Request Example

```http
DELETE /admin/waitlist/delete/123
Authorization: Bearer <admin_token>
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Waitlist entry deleted successfully"
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Waitlist entry not found"
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Verify ID exists before deletion
   - Return 404 if not found
   - Validate ID is a positive integer

2. **Hard Delete:**
   - Permanently delete the record from database
   - This is appropriate for waitlist as users can re-signup

3. **Audit Log:**
   - Log admin action with timestamp and admin user ID
   - Store deleted email for audit purposes

4. **Example SQL:**
   ```sql
   -- Check existence
   SELECT id FROM waitlist WHERE id = ?
   
   -- Delete if exists
   DELETE FROM waitlist WHERE id = ?
   ```

---

### 3. Batch Delete Waitlist Entries

**POST** `/admin/waitlist/batch-delete`

Deletes multiple waitlist entries in a single operation.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | array[integer] | ✅ | Array of waitlist entry IDs to delete |

#### Request Example

```http
POST /admin/waitlist/batch-delete
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
  "message": "Successfully deleted 3 waitlist entries"
}
```

**Partial Success (200 OK):**

```json
{
  "success": true,
  "deleted_count": 2,
  "message": "Deleted 2 out of 3 waitlist entries. 1 not found."
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
   - Limit maximum batch size (e.g., 100 items)

2. **Transaction:**
   - Use database transaction for atomic operation
   - Commit if all operations succeed
   - Rollback only if critical error occurs

3. **Performance:**
   - Use `WHERE id IN (...)` for efficient deletion
   - Return count of actually deleted items
   - Don't fail if some IDs don't exist

4. **Audit Log:**
   - Log batch deletion with all IDs and count
   - Store admin user ID and timestamp

5. **Example SQL:**
   ```sql
   DELETE FROM waitlist 
   WHERE id IN (?, ?, ?)
   
   -- Get affected rows count
   SELECT ROW_COUNT() as deleted_count
   ```

---

### 4. Update Waitlist Status

**POST** `/admin/waitlist/update-status/:id`

Updates the status of a waitlist entry (pending/approved/rejected).

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Waitlist entry ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | New status: `pending`, `approved`, or `rejected` |

#### Request Example

```http
POST /admin/waitlist/update-status/123
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved"
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "user@example.com",
    "status": "approved",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T14:20:00Z"
  },
  "message": "Waitlist status updated successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid status. Must be 'pending', 'approved', or 'rejected'."
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Waitlist entry not found"
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Validate ID exists
   - Validate status is one of: `pending`, `approved`, `rejected`
   - Return 404 if waitlist entry not found

2. **Idempotency:**
   - Allow setting same status (don't error)
   - Return success even if status unchanged
   - Always update `updated_at` timestamp

3. **Response:**
   - Return full updated waitlist entry object
   - Include success message
   - Ensure `updated_at` reflects the change

4. **Audit Log:**
   - Log status change with admin user ID and timestamp
   - Store both old and new status values

5. **Business Logic:**
   - Consider sending email notification on status change (optional)
   - `approved` → User gets access/welcome email
   - `rejected` → User gets notification (optional)

6. **Example SQL:**
   ```sql
   UPDATE waitlist 
   SET 
     status = ?,
     updated_at = CURRENT_TIMESTAMP
   WHERE id = ?
   
   -- Return updated record
   SELECT * FROM waitlist WHERE id = ?
   ```

---

### 5. Export Waitlist to CSV

**POST** `/admin/waitlist/export`

Generates a CSV export of waitlist entries with current filters applied.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | ✅ | Export format: `csv` |
| `page` | integer | ❌ | Page number (for partial export) |
| `page_size` | integer | ❌ | Items per page |
| `search` | string | ❌ | Search term |
| `search_column` | string | ❌ | Column to search in |
| `status` | string | ❌ | Filter by status |
| `date_from` | string | ❌ | Start date filter (YYYY-MM-DD) |
| `date_to` | string | ❌ | End date filter (YYYY-MM-DD) |
| `sort_by` | string | ❌ | Sort column |
| `sort_order` | string | ❌ | Sort order |

#### Request Example

```http
POST /admin/waitlist/export
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "format": "csv",
  "status": "pending",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31"
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "download_url": "/exports/waitlist_export_1705320000.csv",
  "filename": "waitlist_export_2024-01-15_10-30-00.csv",
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
ID,Email,Status,Created At,Updated At
1,user@example.com,pending,2024-01-15 10:30:00,2024-01-15 10:30:00
2,another@example.com,approved,2024-01-14 15:20:00,2024-01-15 09:15:00
3,third@example.com,rejected,2024-01-13 08:45:00,2024-01-14 16:30:00
```

#### Backend Implementation Notes

1. **File Generation:**
   - Generate CSV file with current filters applied
   - Use same filtering/searching logic as list endpoint
   - Store in temporary exports directory
   - Use unique filename with timestamp: `waitlist_export_YYYY-MM-DD_HH-MM-SS.csv`

2. **CSV Encoding:**
   - Use UTF-8 with BOM for Excel compatibility
   - Properly escape commas, quotes, and newlines in content
   - Use double quotes for fields containing special characters
   - Format dates consistently (YYYY-MM-DD HH:MM:SS)

3. **Security:**
   - Generate authenticated download URL with token
   - Include expiry time (e.g., 1 hour)
   - Validate token before serving file
   - Clean up expired files periodically (cron job)

4. **Performance:**
   - For large exports (>10,000 rows), consider background job processing
   - Stream CSV generation to avoid memory issues
   - Limit maximum export size or require pagination
   - Cache query results if same filter is used multiple times

5. **Download URL:**
   - Should require authentication token in URL or header
   - Verify expiry time before serving file
   - Delete file after successful download or after expiry
   - Rate limit export requests per admin user

6. **Example Implementation:**
   ```python
   # Pseudo-code
   def export_waitlist(filters):
       # Generate unique filename
       filename = f"waitlist_export_{timestamp}.csv"
       filepath = f"/tmp/exports/{filename}"
       
       # Query with filters
       query = build_query(filters)
       results = execute_query(query)
       
       # Write CSV
       with open(filepath, 'w') as f:
           writer = csv.writer(f)
           writer.writerow(['ID', 'Email', 'Status', 'Created At', 'Updated At'])
           for row in results:
               writer.writerow([row.id, row.email, row.status, row.created_at, row.updated_at])
       
       # Generate download URL with expiry
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
| 409 | Conflict (duplicate email on insert) |
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
  - `"Invalid status. Must be 'pending', 'approved', or 'rejected'"`
  - `"Invalid sort_by column. Allowed: id, created_at"`
  - `"Invalid sort_order. Must be 'asc' or 'desc'"`
  - `"page_size must be between 1 and 100"`

- **Not Found:**
  - `"Waitlist entry not found"`
  - `"No waitlist entries found matching criteria"`

- **Conflict:**
  - `"Email already exists in waitlist"` (for public signup endpoint)

- **Rate Limiting:**
  - `"Too many requests. Please try again later."`
  - `"Export rate limit exceeded. Please wait before requesting another export."`
