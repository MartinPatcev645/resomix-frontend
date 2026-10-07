# API Versioning Policy

This document outlines the versioning strategy for the Resomix B2B API, ensuring stability for partners while allowing for architectural evolution.

## 1. Versioning Strategy

Resomix uses **URL-based versioning** for the entire API surface, including B2B, Administrative, and Consumer-facing endpoints.

- **Versioned Root**: `/api/v1/`
- **Example**: `GET /api/v1/search_tracks/`
- **Example**: `POST /api/v1/similarity/upload`

## 2. Breaking Changes & Deprecation

Resomix adheres to a strict deprecation policy for breaking changes:

1. **Major Version Bump**: A new version prefix (e.g., `/api/v2/`) will be introduced when non-backward-compatible changes are required.
2. **Deprecation Period**: Legacy versions will remain active for at least **6 months** after a new version is released.
3. **Sunset Notification**: Partners will be notified via email and API response headers (`X-API-Deprecation-Date`) at least 90 days before a version is retired.

## 3. Legacy Support

To ensure a smooth transition, legacy paths are currently aliased to the new v1 endpoints at the root level. However, **Partners must migrate to the `/api/v1/` paths immediately**, as legacy root-level paths for B2B features are officially deprecated as of May 2026 and will be removed in November 2026.

| Legacy Path | New v1 Path |
| :--- | :--- |
| `POST /get_similarity/` | `POST /api/v1/similarity/upload` |
| `POST /get_selection_similarity/` | `POST /api/v1/similarity/search` |
| `GET /segment_status/{id}` | `GET /api/v1/similarity/segment-status/{id}` |
| `POST /monthly_pipeline/track/` | `POST /api/v1/ingest/monthly/track` |
| `POST /open_tracks_pipeline/track/` | `POST /api/v1/ingest/open/track` |

## 4. Semantic Versioning

The Resomix API follows Semantic Versioning principles:
- **Patch**: Bug fixes, performance improvements (no path change).
- **Minor**: New optional fields or new endpoints (no path change).
- **Major**: Removal of fields, renaming of paths, or mandatory parameter changes (Path change from `/v1` to `/v2`).
