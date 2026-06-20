# Admin Backend API - Quick Setup Guide

**Base URL**: Driven by `VITE_SERVER_BACKEND` environment variable.  
**Auth**: All requests include `?api_key=xxx` (handled automatically)

---

## Feedback Endpoints

### 1. GET `/admin/feedback/`
**Get paginated feedback list with filters**

**Query Parameters**:
```js
page=1                          // Default: 1
page_size=30                    // Default: 30, Max: 100
search=text                     // Optional: search term
search_column=message           // Optional: message|category|user_id
status=open                     // Optional: open|resolved|all
date_from=2025-10-01           // Optional: YYYY-MM-DD
date_to=2025-10-31             // Optional: YYYY-MM-DD
sort_by=submitted_at           // Optional: id|submitted_at|satisfaction|recommendation
sort_order=desc                // Optional: asc|desc
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid-or-null",
      "category": "general",
      "message": "Feedback text",
      "satisfaction": 5,
      "recommendation": 4,
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

**SQL Example**:
```sql
SELECT * FROM feedback
WHERE (status = ? OR ? = 'all')
  AND (message LIKE ? OR category LIKE ? OR user_id LIKE ?)
  AND submitted_at BETWEEN ? AND ?
ORDER BY submitted_at DESC
LIMIT 30 OFFSET 0;
```

---

### 2. DELETE `/admin/feedback/delete/{id}`
**Delete single feedback**

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Feedback deleted successfully"
  }
}
```

**SQL**: `DELETE FROM feedback WHERE id = ?;`

---

### 3. POST `/admin/feedback/batch-delete`
**Delete multiple feedback entries**

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
  "message": "5 feedback entries deleted"
}
```

**SQL**: `DELETE FROM feedback WHERE id IN (?, ?, ?);`

---

### 4. POST `/admin/feedback/mark-status/{id}`
**Mark feedback as open or resolved**

**Request Body**:
```json
{
  "status": "resolved"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "uuid",
    "category": "general",
    "message": "Feedback text",
    "satisfaction": 5,
    "recommendation": 4,
    "status": "resolved",
    "submitted_at": "2025-10-01T10:30:00Z"
  },
  "message": "Status updated successfully"
}
```

**SQL**:
```sql
UPDATE feedback SET status = ? WHERE id = ?;
SELECT * FROM feedback WHERE id = ?;
```

---

### 5. PATCH `/admin/feedback/update/{id}`
**Update feedback (status, category, etc.)**

**Request Body**:
```json
{
  "status": "resolved",
  "category": "bug"
}
```

**Response**: Same as mark-status above

**SQL**: `UPDATE feedback SET status = ?, category = ? WHERE id = ?;`

---

### 6. GET `/admin/feedback/stats`
**Get feedback statistics**

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
      "bug": 200
    }
  }
}
```

**SQL**:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
  SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
  AVG(satisfaction) as avg_satisfaction,
  AVG(recommendation) as avg_recommendation
FROM feedback;
```

---

### 7. GET `/admin/feedback/export`
**Export feedback data** *(Not yet implemented - optional)*

**Query Parameters**: Same as list endpoint + `format=csv|excel|json`

**Response**: File download or JSON array

---

## Database Schema

```sql
CREATE TABLE feedback (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          CHAR(36),
    category         VARCHAR(50),
    message          TEXT,
    satisfaction     INT UNSIGNED,
    recommendation   INT UNSIGNED,
    status           ENUM('open','resolved') DEFAULT 'open',
    submitted_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_status (status),
    KEY idx_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**HTTP Status Codes**: 200 (OK), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)

---

## Implementation Priority

1. ✅ **GET /admin/feedback/** - List (CRITICAL)
2. ✅ **POST /admin/feedback/mark-status/{id}/** - Mark status (CRITICAL)
3. ✅ **DELETE /admin/feedback/delete/{id}/** - Single delete
4. ✅ **POST /admin/feedback/batch-delete/** - Batch delete
5. ⭐ **GET /admin/feedback/stats/** - Statistics (optional)
6. ⭐ **GET /admin/feedback/export/** - Export (optional)

---

## Quick Test Examples

```bash
# Get all feedback
GET /admin/feedback/?api_key=xxx&page=1&page_size=30

# Search in messages
GET /admin/feedback/?api_key=xxx&search=bug&search_column=message

# Filter by status and date
GET /admin/feedback/?api_key=xxx&status=open&date_from=2025-09-01

# Delete single feedback
DELETE /admin/feedback/delete/123?api_key=xxx

# Mark as resolved
POST /admin/feedback/mark-status/123?api_key=xxx
Content-Type: application/json
{"status": "resolved"}

# Delete multiple
POST /admin/feedback/batch-delete?api_key=xxx
Content-Type: application/json
{"ids": [1, 2, 3]}

# Get statistics
GET /admin/feedback/stats?api_key=xxx
```

---

**Last Updated**: October 01, 2025 