# Partner Admin Portal API Specification

This document outlines the API endpoints required for the **Resomix Admin App** to manage B2B Partners (Tenants) and their respective API Keys.

## 1. Authentication
All admin endpoints require an Admin API Key passed in the `X-API-KEY` or `api_key` query parameter.

- **Auth Header**: `X-API-KEY: bearer-resomix-api-XXXXX`

---

## 2. Partner Management

### 2.1 List Partners
Retrieve a paginated list of all registered partners.

- **Method**: `GET`
- **Endpoint**: `/`
- **Query Params**:
  - `page`: (int) Default: 1
  - `page_size`: (int) Default: 50
  - `tier`: (string) Filter by: `sandbox`, `starter`, `growth`, `enterprise`
  - `is_active`: (boolean) Filter by active status

**Response Body**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "partner_uuid": "00000000-0000-0000-0000-000000000000",
      "legal_name": "Resomix Sandbox",
      "display_name": "Sandbox",
      "contact_email": "sandbox@resomix.com",
      "tier": "sandbox",
      "is_active": true,
      "onboarded_at": "2026-05-09T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "size": 50,
    "pages": 1
  }
}
```

### 2.2 Create Partner
Register a new B2B tenant.

- **Method**: `POST`
- **Endpoint**: `/`
- **Request Body**:
```json
{
  "legal_name": "Harmonic Streaming Ltd",
  "display_name": "Harmonic",
  "contact_email": "admin@harmonic.com",
  "tier": "starter",
  "country_code": "UK",
  "vat_number": "GB123456789",
  "notes": "Premium starter client"
}
```

---

## 3. API Key Management

### 3.1 Issue New API Key
Generate a new high-entropy API key for a partner.

> [!IMPORTANT]
> The `plaintext_key` is returned **ONLY ONCE** in this response. It is SHA-256 hashed on the server; if lost, it must be rotated.

- **Method**: `POST`
- **Endpoint**: `/api-keys/issue`
- **Request Body**:
```json
{
  "partner_id": 2,
  "label": "Production Mobile App",
  "scopes": ["search:read", "track:read"],
  "rate_limit_rps": 20,
  "rate_limit_monthly": 500000,
  "expires_at": "2027-05-09T00:00:00Z"
}
```

**Response Body**:
```json
{
  "success": true,
  "data": {
    "key_prefix": "rmx_starter_...",
    "plaintext_key": "rmx_starter_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ",
    "label": "Production Mobile App",
    "scopes": ["search:read", "track:read"],
    "expires_at": "2027-05-09T00:00:00Z"
  }
}
```

### 3.2 List Partner Keys
Retrieve all keys (active and revoked) for a specific partner.

- **Method**: `GET`
- **Endpoint**: `/api-keys/{partner_id}`

### 3.3 Rotate API Key
Atomically revokes an existing key and issues a new one with the same configuration (scopes/limits).

- **Method**: `POST`
- **Endpoint**: `/api-keys/rotate`
- **Request Body**:
```json
{
  "api_key_id": 45,
  "label": "Rotated Production Key"
}
```

### 3.4 Revoke API Key
Permanently deactivates an API key.

- **Method**: `POST`
- **Endpoint**: `/api-keys/revoke`
- **Request Body**:
```json
{
  "api_key_id": 45,
  "reason": "Contract terminated or security breach suspected"
}
```

---

## 4. Error Handling
All endpoints return standard status codes and a JSON error body:

- `400 Bad Request`: Validation failure.
- `401 Unauthorized`: Missing or invalid admin API key.
- `403 Forbidden`: Admin key lacks permissions for this action.
- `404 Not Found`: Partner or Key ID does not exist.
- `500 Internal Server Error`: Server-side failure.

**Example Error**:
```json
{
  "success": false,
  "error": "Partner with ID 999 not found",
  "data": null
}
```
