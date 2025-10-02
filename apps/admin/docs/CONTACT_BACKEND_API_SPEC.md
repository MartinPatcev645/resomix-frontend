# Contact Backend API Specification

This document provides the complete backend API specification for Contact management in the admin panel.

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Endpoint Specifications](#endpoint-specifications)
4. [Error Handling](#error-handling)
5. [Security & Authentication](#security--authentication)

---

## 🗄️ Database Schema

### Contact Table

```sql
CREATE TABLE IF NOT EXISTS contact (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       CHAR(36),
    name          VARCHAR(255),
    email         VARCHAR(255),
    subject       VARCHAR(500),
    phone         VARCHAR(50),
    message       TEXT,
    status        ENUM('open','resolved') DEFAULT 'open',
    submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_contact_user (user_id),
    KEY idx_contact_status (status),
    KEY idx_contact_email (email),
    KEY idx_contact_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Field Descriptions

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
| `user_id` | CHAR(36) | YES | NULL | Optional UUID of registered user |
| `name` | VARCHAR(255) | YES | NULL | Contact's name |
| `email` | VARCHAR(255) | YES | NULL | Contact's email |
| `subject` | VARCHAR(500) | YES | NULL | Message subject |
| `phone` | VARCHAR(50) | YES | NULL | Contact's phone number |
| `message` | TEXT | YES | NULL | Contact message content |
| `status` | ENUM | NO | 'open' | Current status (open/resolved) |
| `submitted_at` | DATETIME | NO | CURRENT_TIMESTAMP | Submission timestamp |

---

## 📡 API Endpoints Overview

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/admin/contact/` | List contacts with pagination/filters | ✅ Admin |
| DELETE | `/admin/contact/delete/:id` | Delete single contact | ✅ Admin |
| POST | `/admin/contact/batch-delete` | Delete multiple contacts | ✅ Admin |
| POST | `/admin/contact/mark-status/:id` | Update contact status | ✅ Admin |
| POST | `/admin/contact/export` | Export contacts to CSV | ✅ Admin |

---

## 🔧 Endpoint Specifications

### 1. List Contact Submissions

**GET** `/admin/contact/`

Retrieves a paginated list of contact submissions with filtering, searching, and sorting capabilities.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ | `1` | Page number (1-indexed) |
| `page_size` | integer | ❌ | `30` | Items per page (max: 100) |
| `search` | string | ❌ | - | Search term |
| `search_column` | string | ❌ | - | Column to search in: `id`, `user_id`, `name`, `email`, `message` |
| `status` | string | ❌ | - | Filter by status: `open`, `resolved` (omit for all) |
| `date_from` | string | ❌ | - | Start date filter (YYYY-MM-DD) |
| `date_to` | string | ❌ | - | End date filter (YYYY-MM-DD) |
| `sort_by` | string | ❌ | `id` | Sort column: `id`, `submitted_at` |
| `sort_order` | string | ❌ | `desc` | Sort order: `asc`, `desc` |

#### Request Example

```http
GET /admin/contact/?page=1&page_size=30&status=open&search=example@email.com&search_column=email&sort_by=submitted_at&sort_order=desc
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
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Product Inquiry",
      "phone": "+1234567890",
      "message": "I would like to know more about your product...",
      "status": "open",
      "submitted_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 30,
    "total": 150,
    "total_pages": 5
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
   - Validate `sort_by` is in allowed columns
   - Validate `sort_order` is 'asc' or 'desc'
   - Validate date format (YYYY-MM-DD)

2. **Search Logic:**
   - If `search` provided without `search_column`, search in `message` by default
   - Use LIKE query with wildcards: `WHERE column LIKE '%search%'`
   - For `id` search, use exact match if numeric

3. **Date Filtering:**
   - `date_from`: `WHERE submitted_at >= date_from 00:00:00`
   - `date_to`: `WHERE submitted_at <= date_to 23:59:59`

4. **Performance:**
   - Use proper indexes on `status`, `email`, `submitted_at`
   - Consider adding composite indexes for common filter combinations

---

### 2. Delete Single Contact

**DELETE** `/admin/contact/delete/:id`

Deletes a single contact submission by ID.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Contact submission ID |

#### Request Example

```http
DELETE /admin/contact/delete/123
Authorization: Bearer <admin_token>
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Contact deleted successfully"
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Contact submission not found"
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Verify ID exists before deletion
   - Return 404 if not found

2. **Soft Delete Option:**
   - Consider implementing soft delete with `deleted_at` column
   - Or keep hard delete for compliance (GDPR)

3. **Audit Log:**
   - Log admin action with timestamp and admin user ID

---

### 3. Batch Delete Contacts

**POST** `/admin/contact/batch-delete`

Deletes multiple contact submissions in a single operation.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | array[integer] | ✅ | Array of contact IDs to delete |

#### Request Example

```http
POST /admin/contact/batch-delete
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
  "message": "Successfully deleted 3 contact submissions"
}
```

**Partial Success (200 OK):**

```json
{
  "success": true,
  "deleted_count": 2,
  "message": "Deleted 2 out of 3 contact submissions. 1 not found."
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
   - Validate all items are integers
   - Limit maximum batch size (e.g., 100 items)

2. **Transaction:**
   - Use database transaction for atomic operation
   - Rollback if critical error occurs

3. **Performance:**
   - Use `WHERE id IN (...)` for efficient deletion
   - Return count of actually deleted items

4. **Audit Log:**
   - Log batch deletion with all IDs

---

### 4. Update Contact Status

**POST** `/admin/contact/mark-status/:id`

Updates the status of a contact submission (open ↔ resolved).

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Contact submission ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | New status: `open` or `resolved` |

#### Request Example

```http
POST /admin/contact/mark-status/123
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "resolved"
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Product Inquiry",
    "phone": "+1234567890",
    "message": "I would like to know more...",
    "status": "resolved",
    "submitted_at": "2024-01-15T10:30:00Z"
  },
  "message": "Contact status updated successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid status. Must be 'open' or 'resolved'."
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "error": "Contact submission not found"
}
```

#### Backend Implementation Notes

1. **Validation:**
   - Validate ID exists
   - Validate status is 'open' or 'resolved'
   - Return 404 if contact not found

2. **Idempotency:**
   - Allow setting same status (don't error)
   - Return success even if status unchanged

3. **Response:**
   - Return full updated contact object
   - Include success message

4. **Audit Log:**
   - Log status change with admin user ID and timestamp

---

### 5. Export Contacts to CSV

**POST** `/admin/contact/export`

Generates a CSV export of contact submissions with current filters applied.

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
POST /admin/contact/export
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "format": "csv",
  "status": "open",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31"
}
```

#### Response Format

**Success (200 OK):**

```json
{
  "success": true,
  "download_url": "/exports/contact_export_1705320000.csv",
  "filename": "contact_export_2024-01-15_10-30-00.csv",
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
ID,User ID,Name,Email,Phone,Subject,Message,Status,Submitted At
1,123e4567-e89b-12d3-a456-426614174000,John Doe,john@example.com,+1234567890,Product Inquiry,"I would like to know more...",open,2024-01-15 10:30:00
```

#### Backend Implementation Notes

1. **File Generation:**
   - Generate CSV file with current filters applied
   - Use same filtering/searching logic as list endpoint
   - Store in temporary exports directory
   - Use unique filename with timestamp

2. **CSV Encoding:**
   - Use UTF-8 with BOM for Excel compatibility
   - Properly escape commas, quotes, and newlines in content
   - Use double quotes for fields containing special characters

3. **Security:**
   - Generate authenticated download URL
   - Include expiry time (e.g., 1 hour)
   - Clean up expired files periodically

4. **Performance:**
   - For large exports, consider background job processing
   - Stream CSV generation to avoid memory issues
   - Limit maximum export size or paginate

5. **Download URL:**
   - Should require authentication token
   - Verify expiry time before serving file
   - Delete file after successful download or expiry

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

- **Not Found:**
  - `"Contact submission not found"`
  - `"No contacts found matching criteria"`

- **Rate Limiting:**
  - `"Too many requests. Please try again later."`
