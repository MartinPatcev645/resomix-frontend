# Admin Partner Details API Integration Guide
=============================================

This guide documents the newly implemented `GET /api/v1/admin/partners/{partner_id}` administrative endpoint designed to retrieve details of a single B2B partner tenant.

## Endpoint Specification

### `GET /api/v1/admin/partners/{partner_id}`

* **Description**: Retrieves comprehensive legal, operational, and metadata fields for a registered B2B partner tenant.
* **Authentication**: Requires administrative API key passed as query parameter or via `X-API-KEY` header matching the admin context configuration.
* **Response Wrapper**: Matches the standard `PartnerResponse` schema which wraps the `PartnerBaseResponse` payload.

---

### Request Details

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `api_key` | `string` | Optional* | The admin bearer API token (e.g. `bearer-resomix-api-V2BjX...`). *Can also be passed in headers.* |

#### Headers
| Header Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `X-API-KEY` | `string` | Optional* | Administrative authorization credential. |

---

### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "id": 10017,
    "partner_uuid": "49eae530-828d-482c-8bc8-54cda424cac4",
    "legal_name": "usman_partner",
    "display_name": "usman_partner",
    "contact_email": "contact_6f7356@example.com",
    "tier": "enterprise",
    "is_active": true,
    "onboarded_at": "2026-05-21T06:07:07",
    "country_code": "US",
    "vat_number": "EU4983598234"
  }
}
```

#### Fields Description
* **`success`** (`boolean`): Indicates whether the request completed successfully.
* **`data`** (`object`): The partner details container.
  * **`id`** (`integer`): Internal database primary key of the partner.
  * **`partner_uuid`** (`string`): Globally unique RFC4122 identifier assigned to the partner tenant.
  * **`legal_name`** (`string`): The registered business/corporate name of the partner.
  * **`display_name`** (`string`): Friendly presentation name of the partner tenant.
  * **`contact_email`** (`string`): Primary administrative email contact for the partner.
  * **`tier`** (`string`): The service level tier of the partner (`sandbox`, `starter`, `growth`, `enterprise`).
  * **`is_active`** (`boolean`): Active operational flag. If false, B2B requests from this partner are blocked.
  * **`onboarded_at`** (`string`): ISO-8601 timestamp representing the time of registration.
  * **`country_code`** (`string \| null`): Two-character ISO 3166-1 country code.
  * **`vat_number`** (`string \| null`): Registered corporate tax or VAT code.

---

### Error Responses

#### `404 Not Found` (Partner does not exist)
```json
{
  "success": false,
  "error": "Partner not found"
}
```

#### `401/403 Forbidden/Unauthorized` (Invalid or missing administrative key)
```json
{
  "detail": "Not authenticated"
}
```

---

## Frontend Integration Snippet (React / Fetch API)

Below is an implementation example you can drop directly into your admin panel dashboard to fetch partner details:

```typescript
interface PartnerDetails {
  id: number;
  partner_uuid: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  tier: 'sandbox' | 'starter' | 'growth' | 'enterprise';
  is_active: boolean;
  onboarded_at: string;
  country_code: string | null;
  vat_number: string | null;
}

interface PartnerResponseWrapper {
  success: boolean;
  data?: PartnerDetails;
  error?: string;
}

/**
 * Fetch detailed B2B Partner information from Admin API.
 */
async function fetchPartnerDetails(
  partnerId: number,
  adminApiKey: string
): Promise<PartnerDetails> {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8001';
  const url = `${baseUrl}/api/v1/admin/partners/${partnerId}?api_key=${encodeURIComponent(adminApiKey)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (response.status === 404) {
    throw new Error('Partner not found.');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch partner: ${response.statusText}`);
  }

  const result: PartnerResponseWrapper = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Unknown API error');
  }

  return result.data;
}
```
