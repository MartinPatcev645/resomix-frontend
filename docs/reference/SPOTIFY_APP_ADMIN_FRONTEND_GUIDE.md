# Spotify App Management Admin Frontend Guide

## Authentication

All endpoints require API key authentication via query parameter:
```
?api_key=YOUR_API_KEY
```

**Base URL**: Your API base URL (e.g., `https://bserver.resomix.com`)

---

## Spotify App CRUD Endpoints

### 1. List Spotify Apps

**GET** `/admin/spotify-apps/`

#### Query Parameters
- `api_key` (required): API authentication key
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 100, max: 1000): Items per page
- `is_active` (optional): Filter by active status (`true`/`false`)
- `search` (optional): Search by app name (case insensitive)

#### Request Example
```bash
curl -X GET "https://bserver.resomix.com/admin/spotify-apps/?api_key=YOUR_API_KEY&page=1&page_size=50&is_active=true&search=production" \
  -H "Content-Type: application/json"
```

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Resomix Production App",
      "description": "Main production Spotify app",
      "client_id": "abc123def456",
      "is_active": true,
      "user_count": 15,
      "created_at": "2025-11-14T10:00:00",
      "updated_at": "2025-11-14T10:00:00"
    }
  ],
  "pagination": {
    "total": 1,
    "skip": 0,
    "limit": 50,
    "count": 1
  }
}
```

**Note**: `client_secret` is never included in list responses.

---

### 2. Get Spotify App

**GET** `/admin/spotify-apps/{app_id}`

#### Path Parameters
- `app_id` (required): Spotify app ID

#### Query Parameters
- `api_key` (required): API authentication key
- `include_secret` (optional, default: `true`): Include `client_secret` in response

#### Request Example
```bash
curl -X GET "https://bserver.resomix.com/admin/spotify-apps/1?api_key=YOUR_API_KEY&include_secret=true" \
  -H "Content-Type: application/json"
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Resomix Production App",
    "description": "Main production Spotify app",
    "client_id": "abc123def456",
    "client_secret": "secret123",
    "is_active": true,
    "user_count": 15,
    "created_at": "2025-11-14T10:00:00",
    "updated_at": "2025-11-14T10:00:00"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "error": "Spotify app with ID 1 not found"
}
```

---

### 3. Create Spotify App

**POST** `/admin/spotify-apps/`

#### Request Body
```json
{
  "name": "Resomix Production App",
  "description": "Main production Spotify app",
  "client_id": "abc123def456",
  "client_secret": "secret123",
  "is_active": true
}
```

#### Fields
- `name` (required, string, 1-100 chars): App name (must be unique)
- `description` (optional, string, max 255 chars): App description
- `client_id` (required, string): Spotify client ID (must be unique)
- `client_secret` (required, string): Spotify client secret
- `is_active` (optional, boolean, default: `true`): Whether app is active

#### Request Example
```bash
curl -X POST "https://bserver.resomix.com/admin/spotify-apps/?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resomix Production App",
    "description": "Main production Spotify app",
    "client_id": "abc123def456",
    "client_secret": "secret123",
    "is_active": true
  }'
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Resomix Production App",
    "description": "Main production Spotify app",
    "client_id": "abc123def456",
    "client_secret": "secret123",
    "is_active": true,
    "user_count": 0,
    "created_at": "2025-11-14T10:00:00",
    "updated_at": "2025-11-14T10:00:00"
  }
}
```

#### Error Responses

**409 Conflict** - Duplicate name or client_id
```json
{
  "success": false,
  "error": "Spotify app with name 'Resomix Production App' already exists"
}
```

**400 Bad Request** - Validation error
```json
{
  "success": false,
  "error": "name must not be empty"
}
```

---

### 4. Update Spotify App

**PUT** `/admin/spotify-apps/{app_id}`

#### Path Parameters
- `app_id` (required): Spotify app ID

#### Request Body
```json
{
  "name": "Resomix Production App Updated",
  "description": "Updated description",
  "client_id": "new_client_id",
  "client_secret": "new_secret",
  "is_active": false
}
```

#### Fields (all optional)
- `name` (optional, string, 1-100 chars): App name (must be unique if changed)
- `description` (optional, string, max 255 chars): App description
- `client_id` (optional, string): Spotify client ID (must be unique if changed)
- `client_secret` (optional, string): Spotify client secret
- `is_active` (optional, boolean): Whether app is active

#### Request Example
```bash
curl -X PUT "https://bserver.resomix.com/admin/spotify-apps/1?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resomix Production App Updated",
    "is_active": false
  }'
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Resomix Production App Updated",
    "description": "Updated description",
    "client_id": "new_client_id",
    "client_secret": "new_secret",
    "is_active": false,
    "user_count": 15,
    "created_at": "2025-11-14T10:00:00",
    "updated_at": "2025-11-14T11:00:00"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "error": "Spotify app with ID 1 not found"
}
```

**409 Conflict** - Duplicate name or client_id
```json
{
  "success": false,
  "error": "Spotify app with name 'Resomix Production App Updated' already exists"
}
```

---

### 5. Delete Spotify App

**DELETE** `/admin/spotify-apps/{app_id}`

#### Path Parameters
- `app_id` (required): Spotify app ID

#### Query Parameters
- `api_key` (required): API authentication key
- `cascade` (optional, default: `false`): Delete app even if users are associated

#### Request Example
```bash
# Delete without cascade (fails if users exist)
curl -X DELETE "https://bserver.resomix.com/admin/spotify-apps/1?api_key=YOUR_API_KEY"

# Delete with cascade (deletes associations too)
curl -X DELETE "https://bserver.resomix.com/admin/spotify-apps/1?api_key=YOUR_API_KEY&cascade=true"
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Spotify app deleted successfully"
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "error": "Spotify app with ID 1 not found"
}
```

**422 Unprocessable Entity** - App has users (when cascade=false)
```json
{
  "success": false,
  "error": "Cannot delete Spotify app with 15 associated user(s). Use cascade=true to delete with associations."
}
```

---

## User Association Endpoints

### 6. List User Associations

**GET** `/admin/spotify-apps/users`

#### Query Parameters
- `api_key` (required): API authentication key
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 30, max: 100): Items per page
- `search` (optional): Search by email, username, or UUID (case insensitive)
- `spotify_app_id` (optional): Filter by Spotify app ID

#### Request Example
```bash
curl -X GET "https://bserver.resomix.com/admin/spotify-apps/users?api_key=YOUR_API_KEY&page=1&page_size=30&spotify_app_id=1&search=user@example.com" \
  -H "Content-Type: application/json"
```

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "user_id": 42,
      "user_email": "user@example.com",
      "user_username": "dj42",
      "user_uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
      "spotify_app_id": 1,
      "spotify_app_name": "Resomix Production App",
      "created_at": "2025-11-14T10:00:00",
      "updated_at": "2025-11-14T10:00:00"
    }
  ],
  "pagination": {
    "total": 1,
    "skip": 0,
    "limit": 30,
    "count": 1
  }
}
```

---

### 7. Get User Association

**GET** `/admin/spotify-apps/users/{user_identifier}`

#### Path Parameters
- `user_identifier` (required): User email, UUID, username, or numeric ID

#### Query Parameters
- `api_key` (required): API authentication key

#### Request Example
```bash
# By email
curl -X GET "https://bserver.resomix.com/admin/spotify-apps/users/user@example.com?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json"

# By UUID
curl -X GET "https://bserver.resomix.com/admin/spotify-apps/users/8f94a086-1a24-4f9d-9c0c-2f7fed746c5b?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "user_email": "user@example.com",
    "user_username": "dj42",
    "user_uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
    "spotify_app_id": 1,
    "spotify_app_name": "Resomix Production App",
    "created_at": "2025-11-14T10:00:00",
    "updated_at": "2025-11-14T10:00:00"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "error": "User not found for identifier 'user@example.com'"
}
```

**404 Not Found** - No association
```json
{
  "success": false,
  "error": "User is not associated with any Spotify app"
}
```

---

### 8. Create/Update User Association

**PUT** `/admin/spotify-apps/users`

#### Request Body
```json
{
  "user_identifier": "user@example.com",
  "spotify_app_id": 1
}
```

#### Fields
- `user_identifier` (required, string): User email, UUID, username, or numeric ID
- `spotify_app_id` (required, integer): Spotify app ID to associate with user

#### Request Example
```bash
curl -X PUT "https://bserver.resomix.com/admin/spotify-apps/users?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_identifier": "user@example.com",
    "spotify_app_id": 1
  }'
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "user_email": "user@example.com",
    "user_username": "dj42",
    "user_uuid": "8f94a086-1a24-4f9d-9c0c-2f7fed746c5b",
    "spotify_app_id": 1,
    "spotify_app_name": "Resomix Production App",
    "created_at": "2025-11-14T10:00:00",
    "updated_at": "2025-11-14T11:00:00"
  }
}
```

**Note**: If user already has an association, it will be updated (one-to-one constraint).

#### Error Responses

**404 Not Found** - User not found
```json
{
  "success": false,
  "error": "User not found for identifier 'user@example.com'"
}
```

**404 Not Found** - App not found
```json
{
  "success": false,
  "error": "Spotify app with ID 1 not found"
}
```

**422 Unprocessable Entity** - Inactive app
```json
{
  "success": false,
  "error": "Cannot associate user with inactive Spotify app 'Resomix Production App'"
}
```

**400 Bad Request** - Validation error
```json
{
  "success": false,
  "error": "user_identifier must not be empty"
}
```

---

### 9. Delete User Association

**DELETE** `/admin/spotify-apps/users/{user_identifier}`

#### Path Parameters
- `user_identifier` (required): User email, UUID, username, or numeric ID

#### Query Parameters
- `api_key` (required): API authentication key

#### Request Example
```bash
curl -X DELETE "https://bserver.resomix.com/admin/spotify-apps/users/user@example.com?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "User association deleted successfully"
}
```

#### Error Responses

**404 Not Found** - User not found
```json
{
  "success": false,
  "error": "User not found for identifier 'user@example.com'"
}
```

**404 Not Found** - No association
```json
{
  "success": false,
  "error": "User is not associated with any Spotify app"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Could not validate credentials"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "An internal server error occurred while [operation]"
}
```

---

## Frontend Implementation Notes

### App Management UI
- Display apps in a table with columns: ID, Name, Description, Client ID, Active Status, User Count, Actions
- Show user_count to visualize distribution across apps
- Filter by `is_active` to show only active apps
- Search by name for quick lookup
- Warn admin before deleting apps with users (show user_count)

### User Association UI
- Display associations in a table with: User Email, Username, UUID, App Name, Created At
- Search by email/username/UUID to find users
- Filter by `spotify_app_id` to see all users for a specific app
- When creating association, show dropdown of active apps only
- If user already has association, show current app and allow update
- Show user_count updates after association changes

### Workflow
1. Admin creates Spotify app in system
2. Admin adds user email to Spotify Developer Dashboard for that app
3. Admin creates association in system via API
4. System increments user_count automatically
5. User can now use Spotify transfer with that app's client_id

