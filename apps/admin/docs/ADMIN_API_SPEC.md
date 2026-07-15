# Admin API Specification

> API endpoints specification for the Admin Dashboard backend

---

## 📋 Overview

This document specifies the backend API endpoints required for the Admin Dashboard. All endpoints require authentication via an **admin-role JWT** (the static `api_key` super-key has been retired).

**Base URL**: Configured via `VITE_SERVER_BACKEND` environment variable.

---

## 🔐 Authentication

Admins sign in via `POST /admin/auth/login` (email + password), which returns an access token whose
payload carries a `role: admin` claim. The admin client stores it and sends it as a Bearer header on
every request:
```
Authorization: Bearer <admin_access_token>
```

The backend enforces `require_admin`: the JWT must carry the `role: admin` claim **and** the user must
hold the `admin` role in the database (RBAC). The old `?api_key=` query-param / static super-key is no
longer accepted.

---

## 📊 Feedback Management

### 1. Get Feedback List

**Endpoint**: `GET /admin/feedback/`

**Description**: Retrieve paginated list of feedback with filtering, searching, and sorting capabilities.

**Query Parameters**:
```typescript
{
  page?: number;              // Default: 1
  page_size?: number;         // Default: 30
  search?: string;            // Search term
  search_column?: 'user_id' | 'category' | 'message' | 'status';  // Column to search in
  status?: 'open' | 'resolved' | 'all';  // Filter by status
  date_from?: string;         // Format: YYYY-MM-DD
  date_to?: string;           // Format: YYYY-MM-DD
  sort_by?: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation';
  sort_order?: 'asc' | 'desc';
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid-here",
      "category": "general",
      "message": "Great product!",
      "satisfaction": 5,
      "recommendation": 5,
      "status": "open",
      "submitted_at": "2025-10-01T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 30,
    "total": 100,
    "total_pages": 4
  }
}
```

**Database Query Example**:
```sql
SELECT * FROM feedback
WHERE 
  (status = ? OR ? = 'all')
  AND (message LIKE ? OR category LIKE ? OR user_id LIKE ?)
  AND submitted_at BETWEEN ? AND ?
ORDER BY submitted_at DESC
LIMIT ? OFFSET ?;
```

---

### 2. Get Single Feedback

**Endpoint**: `GET /admin/feedback/{id}/`

**Description**: Retrieve details of a single feedback entry.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "uuid-here",
    "category": "general",
    "message": "Great product!",
    "satisfaction": 5,
    "recommendation": 5,
    "status": "open",
    "submitted_at": "2025-10-01T10:30:00Z"
  }
}
```

**Database Query**:
```sql
SELECT * FROM feedback WHERE id = ?;
```

---

### 3. Delete Single Feedback

**Endpoint**: `DELETE /admin/feedback/delete/{id}/`

**Description**: Delete a single feedback entry by ID.

**Response**:
```json
{
  "success": true,
  "message": "Feedback deleted successfully"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Feedback not found"
}
```

**Database Query**:
```sql
DELETE FROM feedback WHERE id = ?;
```

---

### 4. Batch Delete Feedback

**Endpoint**: `POST /admin/feedback/batch-delete/`

**Description**: Delete multiple feedback entries at once.

**Request Body**:
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**Response**:
```json
{
  "success": true,
  "deleted_count": 5,
  "message": "5 feedback entries deleted successfully"
}
```

**Error Response**:
```json
{
  "success": false,
  "deleted_count": 0,
  "error": "No feedback entries found"
}
```

**Database Query**:
```sql
DELETE FROM feedback WHERE id IN (?, ?, ?, ?, ?);
-- Then: SELECT ROW_COUNT() to get deleted_count
```

---

### 5. Update Feedback

**Endpoint**: `PATCH /admin/feedback/update/{id}/`

**Description**: Update a feedback entry (e.g., change status from 'open' to 'resolved').

**Request Body**:
```json
{
  "status": "resolved",
  "category": "bug"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "uuid-here",
    "category": "bug",
    "message": "Great product!",
    "satisfaction": 5,
    "recommendation": 5,
    "status": "resolved",
    "submitted_at": "2025-10-01T10:30:00Z"
  },
  "message": "Feedback updated successfully"
}
```

**Database Query**:
```sql
UPDATE feedback 
SET status = ?, category = ?
WHERE id = ?;

-- Then fetch updated record:
SELECT * FROM feedback WHERE id = ?;
```

---

### 6. Export Feedback

**Endpoint**: `GET /admin/feedback/export/`

**Description**: Export feedback data in various formats.

**Query Parameters**:
```typescript
{
  format: 'csv' | 'excel' | 'json';
  // ... same filtering params as list endpoint
}
```

**Response (CSV/Excel)**:
- Returns file download with appropriate headers
- Content-Type: `text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="feedback_export_2025-10-01.csv"`

**Response (JSON)**:
```json
{
  "success": true,
  "data": [/* array of feedback items */],
  "exported_at": "2025-10-01T10:30:00Z",
  "total": 100
}
```

---

### 7. Get Feedback Statistics

**Endpoint**: `GET /admin/feedback/stats/`

**Description**: Get aggregated statistics about feedback.

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": 1000,
    "open": 750,
    "resolved": 250,
    "avg_satisfaction": 4.2,
    "avg_recommendation": 4.5,
    "by_category": {
      "general": 500,
      "bug": 200,
      "feature_request": 300
    }
  }
}
```

**Database Query**:
```sql
-- Total counts
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
  SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
  AVG(satisfaction) as avg_satisfaction,
  AVG(recommendation) as avg_recommendation
FROM feedback;

-- By category
SELECT category, COUNT(*) as count
FROM feedback
GROUP BY category;
```

---

## 🗄️ Database Schema Reference

```sql
CREATE TABLE IF NOT EXISTS feedback (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    category  VARCHAR(50),
    message   TEXT,
    satisfaction INT UNSIGNED,
    recommendation INT UNSIGNED,
    status    ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fb_user (user_id),
    KEY idx_fb_status (status),
    KEY idx_fb_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Recommended Indexes**:
- `idx_fb_user` on `user_id` (already exists)
- `idx_fb_status` on `status` - for filtering
- `idx_fb_submitted` on `submitted_at` - for date range queries
- `idx_fb_category` on `category` - for category filtering

---

## 📝 Implementation Notes

### Error Handling

All endpoints should return consistent error format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [] // Optional array of validation errors
}
```

### HTTP Status Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Invalid/missing API key
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Pagination

- Default page size: 30
- Maximum page size: 100
- Page numbers start at 1

### Search Implementation

When `search` parameter is provided:
```sql
WHERE (
  message LIKE CONCAT('%', ?, '%') OR
  category LIKE CONCAT('%', ?, '%') OR
  user_id LIKE CONCAT('%', ?, '%')
)
```

When `search_column` is specified, only search in that column:
```sql
WHERE {search_column} LIKE CONCAT('%', ?, '%')
```

### Date Filtering

- Dates are in `YYYY-MM-DD` format
- `date_from` is inclusive (>=)
- `date_to` is inclusive (<=)
- If only `date_from` is provided, return all records from that date onwards
- If only `date_to` is provided, return all records up to that date

### Sorting

Default sort: `submitted_at DESC` (newest first)

---

## 🧪 Testing Endpoints

### Example Requests

**1. Get all feedback (first page)**:
```bash
GET /admin/feedback/?page=1&page_size=30
```

**2. Search for "bug" in messages**:
```bash
GET /admin/feedback/?search=bug&search_column=message
```

**3. Get open feedback from last 7 days**:
```bash
GET /admin/feedback/?status=open&date_from=2025-09-24&date_to=2025-10-01
```

**4. Delete multiple items**:
```bash
POST /admin/feedback/batch-delete/
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

**5. Mark as resolved**:
```bash
PATCH /admin/feedback/update/1/
Content-Type: application/json

{
  "status": "resolved"
}
```

---

## 🔄 Client Usage

The API client is already implemented. Usage example:

```typescript
import { 
  getFeedbackList, 
  deleteFeedback, 
  batchDeleteFeedback,
  updateFeedback,
  exportFeedback,
  getFeedbackStats
} from '@resomix/api-client'

// Get feedback list with filters
const result = await getFeedbackList({
  page: 1,
  page_size: 30,
  search: 'bug',
  status: 'open',
  date_from: '2025-09-01',
  date_to: '2025-10-01',
  sort_by: 'submitted_at',
  sort_order: 'desc'
})

// Delete single item
await deleteFeedback(123)

// Batch delete
await batchDeleteFeedback([1, 2, 3, 4, 5])

// Update status
await updateFeedback(123, { status: 'resolved' })

// Export data
await exportFeedback('csv', { status: 'open' })

// Get statistics
const stats = await getFeedbackStats()
```

---

## 🚀 Priority Implementation Order

1. **GET /admin/feedback/** - List endpoint (CRITICAL)
2. **DELETE /admin/feedback/delete/{id}/** - Single delete
3. **POST /admin/feedback/batch-delete/** - Batch delete
4. **GET /admin/feedback/{id}/** - View details
5. **PATCH /admin/feedback/update/{id}/** - Update status
6. **GET /admin/feedback/stats/** - Statistics
7. **GET /admin/feedback/export/** - Export (nice-to-have)

---

**Last Updated**: October 01, 2025 