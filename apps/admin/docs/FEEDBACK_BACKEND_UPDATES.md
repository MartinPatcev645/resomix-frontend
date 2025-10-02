# Feedback Backend Updates Guide

This document outlines the backend changes needed to support the updated feedback system in the admin panel.

## 1. Search Functionality Updates

### Current Behavior
The frontend now supports searching by only two columns:
- `message` - Search within feedback messages
- `id` - Search by feedback ID

### Required Backend Changes

**Endpoint**: `GET /api/admin/feedback/list`

**Update the `search_column` parameter** to accept only these values:
- `message`
- `id`

**Implementation Notes**:
```python
# Example validation (adjust based on your framework)
ALLOWED_SEARCH_COLUMNS = ['message', 'id']

def get_feedback_list(request):
    search_column = request.GET.get('search_column', 'message')
    
    # Validate search column
    if search_column not in ALLOWED_SEARCH_COLUMNS:
        return JsonResponse({
            'success': False,
            'error': f'Invalid search_column. Allowed values: {ALLOWED_SEARCH_COLUMNS}'
        }, status=400)
    
    # ... rest of your implementation
```

**Search Implementation**:
- For `id`: Exact match or partial match on the ID field
- For `message`: Case-insensitive partial match (LIKE/ILIKE query)

**Example SQL queries**:
```sql
-- For ID search
SELECT * FROM feedback WHERE CAST(id AS TEXT) LIKE '%search_term%';

-- For message search  
SELECT * FROM feedback WHERE LOWER(message) LIKE LOWER('%search_term%');
```

---

## 2. CSV Export with Download Link

### Current Behavior
The frontend now has a single "Export CSV" button that needs to:
1. Trigger the backend to generate a CSV file
2. Receive a download URL/link to the generated file
3. Initiate the download in the browser

### Required Backend Implementation

**Endpoint**: `POST /api/admin/feedback/export`

**Request Body**:
```json
{
  "page": 1,
  "page_size": 30,
  "search": "optional search term",
  "search_column": "message",
  "status": "open",
  "date_from": "2025-01-01",
  "date_to": "2025-12-31",
  "sort_by": "submitted_at",
  "sort_order": "desc"
}
```

**Response Format**:
```json
{
  "success": true,
  "download_url": "https://yourdomain.com/exports/feedback_20250102_123456.csv",
  "filename": "feedback_20250102_123456.csv",
  "expires_at": "2025-01-02T14:34:56Z"
}
```

### Implementation Steps

#### Option 1: Direct File Generation
1. Generate the CSV file with all feedback matching the filters
2. Store it temporarily in a public/exports directory
3. Return the public URL to access the file
4. Set up a cleanup cron job to delete files older than 24 hours

**Example Implementation**:
```python
import csv
from datetime import datetime, timedelta
import os
import uuid

def export_feedback_csv(request):
    # Parse filters from request
    filters = parse_export_filters(request.data)
    
    # Query feedback data with filters (without pagination limits for export)
    feedback_data = query_feedback_with_filters(filters)
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"feedback_export_{timestamp}_{uuid.uuid4().hex[:8]}.csv"
    
    # Create exports directory if it doesn't exist
    export_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
    os.makedirs(export_dir, exist_ok=True)
    
    # Generate CSV file
    file_path = os.path.join(export_dir, filename)
    
    with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Write header
        writer.writerow([
            'ID', 'User ID', 'Category', 'Satisfaction', 
            'Recommendation', 'Message', 'Status', 'Submitted At'
        ])
        
        # Write data rows
        for feedback in feedback_data:
            writer.writerow([
                feedback.id,
                feedback.user_id or '',
                feedback.category or '',
                feedback.satisfaction if feedback.satisfaction is not None else '',
                feedback.recommendation if feedback.recommendation is not None else '',
                feedback.message or '',
                feedback.status,
                feedback.submitted_at.isoformat()
            ])
    
    # Generate public URL
    download_url = f"{settings.BASE_URL}/media/exports/{filename}"
    
    # Calculate expiration time (24 hours from now)
    expires_at = datetime.now() + timedelta(hours=24)
    
    return JsonResponse({
        'success': True,
        'download_url': download_url,
        'filename': filename,
        'expires_at': expires_at.isoformat()
    })
```

#### Option 2: Signed URL (More Secure)
If using cloud storage (AWS S3, Google Cloud Storage, etc.):
1. Generate CSV file in memory or temporary storage
2. Upload to cloud storage
3. Generate a signed/presigned URL with expiration
4. Return the signed URL

**Example with AWS S3**:
```python
import boto3
from botocore.config import Config

def export_feedback_csv_s3(request):
    # Parse filters and generate CSV in memory
    filters = parse_export_filters(request.data)
    feedback_data = query_feedback_with_filters(filters)
    
    # Generate CSV in memory
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    # ... write CSV data ...
    
    # Upload to S3
    s3_client = boto3.client('s3')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"feedback_export_{timestamp}.csv"
    s3_key = f"exports/{filename}"
    
    s3_client.put_object(
        Bucket='your-bucket-name',
        Key=s3_key,
        Body=csv_buffer.getvalue().encode('utf-8'),
        ContentType='text/csv'
    )
    
    # Generate presigned URL (expires in 24 hours)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'your-bucket-name', 'Key': s3_key},
        ExpiresIn=86400  # 24 hours
    )
    
    return JsonResponse({
        'success': True,
        'download_url': download_url,
        'filename': filename,
        'expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
    })
```

### Cleanup Task (Option 1 Only)
Create a scheduled task to clean up old export files:

```python
# Cron job or scheduled task
def cleanup_old_exports():
    export_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
    now = datetime.now()
    
    for filename in os.listdir(export_dir):
        file_path = os.path.join(export_dir, filename)
        
        # Check file age
        file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
        if now - file_time > timedelta(hours=24):
            os.remove(file_path)
```

---

## Frontend Export Implementation

The frontend is already set up to handle the export. It will:

```typescript
const handleExport = async (format: 'csv') => {
  try {
    // Call the API with current filters
    const result = await exportFeedback('csv', {
      page: pagination.current,
      page_size: pagination.pageSize,
      search: searchText,
      search_column: searchColumn,
      status: statusFilter,
      date_from: dateRange?.[0],
      date_to: dateRange?.[1],
      sort_by: sortBy,
      sort_order: sortOrder,
    })
    
    if (result.success && result.download_url) {
      // Initiate download
      window.open(result.download_url, '_blank')
      message.success('Export started. Download will begin shortly.')
    }
  } catch (error) {
    message.error('Failed to export feedback')
  }
}
```
