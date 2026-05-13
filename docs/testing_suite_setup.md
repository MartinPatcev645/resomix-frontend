# Resomix Master Test Registry (V3)

This document is the authoritative list of all Resomix endpoints and their corresponding test requirements. It covers all 33+ routers registered in the system.

---

## 1. Auth & Identity Management
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/auth/` | `POST` | Login, Register, Refresh, Logout | 1. JWT issued on valid login.<br>2. MFA flow (if enabled). | 1. `401` on invalid credentials.<br>2. Token hijacking prevention. |
| `/users/` | `GET`, `PATCH`, `DELETE` | Profile & Account management | 1. Update user preferences.<br>2. Soft-delete account. | 1. `403` when modifying another user.<br>2. PII protection in logs. |

## 2. B2B & Partner Management (Core Focus)
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/partner/me` | `GET` | Current partner context | 1. Return valid partner metadata. | 1. `401` if API key is missing/invalid. |
| `/admin/partners/` | `GET`, `POST` | Partner onboarding | 1. Create new B2B tenant.<br>2. List all active partners. | 1. `403` for non-admin keys.<br>2. Duplicate UUID prevention. |
| `/admin/partners/{id}/api-keys`| `GET`, `POST`, `PATCH`| Key rotation & revocation| 1. Rotate key atomically.<br>2. List usage stats per key. | 1. Ensure revoked keys immediately stop working. |

## 3. Core Audio, Search & Similarity
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/search/` | `GET` | Cross-partner track search | 1. Paginated results with filters.<br>2. Fuzzy matching on artist/title. | 1. Prevent SQL injection in query params.<br>2. Filter internal metadata. |
| `/similarity/by_id/`| `POST`, `GET` | Sound-alike retrieval | 1. Return top 20 similar tracks. | 1. `404` for tracks in other tenants.<br>2. Handle engine timeouts. |
| `/similarity/upload/`| `POST` | Search by sound (Upload) | 1. MP3/WAV analysis returns results. | 1. `422` for invalid MIME types.<br>2. File size limit (100MB) enforcement. |
| `/preview/{id}` | `GET` | HLS/Segmented streaming | 1. Return `.m3u8` playlist. | 1. Prevent unauthorized hotlinking. |

## 4. Ingestion & Data Pipelines
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/monthly_pipeline/` | `POST` | Ingestion & Sync worker | 1. Batch process new audio files.<br>2. Update track embeddings. | 1. `403` for standard users.<br>2. Handle malformed metadata in batch. |
| `/open_tracks_pipeline/`| `POST` | Open marketplace ingestion | 1. Auto-tagging and peak generation. | 1. Antivirus check on every file. |

## 5. Playlists, Engagement & Ratings
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/playlists/` | `GET`, `PUT` | Playlist Management | 1. Rename/Toggle visibility of owned lists.<br>2. List all user playlists with filters. | 1. `403` if modifying non-owned playlist.<br>2. Prevent forking private lists. |
| `/playlists/fork/{id}` | `POST` | Public Playlist Copy | 1. Create personal copy of public list. | 1. `403` for private playlists. |
| `/playlist/` | `POST` | Engagement (Favs/Follows) | 1. Add/Remove from favorites.<br>2. Follow/Unfollow public playlists. | 1. Prevent duplicate follows.<br>2. `404` for non-existent playlists. |
| `/ratings/tracks/` | `POST`, `GET` | Track Similarity Feedback | 1. Rate track 0 (not similar) or 1 (similar).<br>2. Retrieve aggregate stats for a track. | 1. `422` for invalid values.<br>2. Scoped to playlist context. |
| `/ratings/playlists/`| `POST`, `GET` | Playlist Quality Feedback | 1. Rate playlist 0-3 stars.<br>2. Get average rating and distribution. | 1. Validate star range (0-3). |
| `/admin/playlist/` | `GET`, `DELETE` | Moderator oversight | 1. Batch visibility toggle (hide spam). | 1. Audit trail of moderator actions. |

## 6. E-commerce, Cart & Checkout
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/cart` | `GET` | Hydrate active cart | 1. Return all items in user's cart. | 1. `401` Authentication required. |
| `/cart/add` | `POST` | Add track or playlist | 1. Add individual track to cart.<br>2. Add entire playlist to cart. | 1. Prevent duplicate items.<br>2. `404` for invalid track/playlist. |
| `/cart/remove/{id}` | `DELETE` | Remove individual track | 1. Delete specific track from cart. | 1. Handle non-existent cart item. |
| `/cart/remove-playlist/`| `DELETE` | Bulk remove playlist | 1. Remove all tracks from a specific list. | 1. Scoped to current user's cart. |
| `/cart/clear` | `DELETE` | Reset shopping cart | 1. Remove all items from cart. | 1. Atomic clear operation. |
| `/cart/promo` | `POST` | Apply discount code | 1. Recalculate totals with valid code. | 1. `422` for expired/invalid codes. |
| `/checkout/init` | `POST` | Pre-flight checkout | 1. Create pending order.<br>2. Initialize Stripe session. | 1. Verify price consistency.<br>2. Handle stock/license locks. |

## 7. Feedback, Support & CRM
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/contact/` | `POST`, `GET` | Public inquiry form | 1. Save submission to admin queue. | 1. `422` for invalid fields. |
| `/feedback/` | `POST`, `PATCH` | User UX surveys | 1. Submit NPS or feature request. | 1. Limit submissions per user. |
| `/admin/contact/` | `GET`, `DELETE` | Support ticket management | 1. Resolve/Close tickets. | 1. Only Support-role admins allowed. |

## 8. Waitlist & Promo Campaigns
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/waitlist/` | `POST` | Early access registration | 1. Record email and tier interest. | 1. Prevent duplicate email entries. |
| `/admin/promo/create` | `POST` | Campaign generation | 1. Generate unique 100% off codes. | 1. Limit code usage (count/date). |

## 9. System, Ops & Telemetry
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/health/` | `GET` | Service heartbeat | 1. Check MariaDB, Redis, and S3 status. | 1. Detail error if one component fails. |
| `/telemetry/sync` | `POST` | Stream Telemetry Batch | 1. Ingest playback events (start/skip/end).<br>2. Enqueue to Redis for async logging. | 1. Handle high-volume batch ingestion.<br>2. Validate event schema integrity. |
| `/admin/operation_limits/`| `GET`, `PUT` | System-wide caps | 1. Adjust max concurrent uploads. | 1. High-priority admin override. |

---

## Database Verification & Troubleshooting

To manually verify data in the test database (e.g., check if users were created or tracks exist), use the following command:

```bash
docker exec -i resomix-test-db mariadb -uroot -ptest resomix_db -e "SELECT * FROM users;"
```

You can also check tracks or other tables by replacing `users` with the desired table name.

---

## Testing Environment Summary
*   **Unit Tests**: Mocked dependencies, focused on `app/services/` logic.
*   **Integration Tests**: Real DB/Redis, testing `app/controllers/` and `app/api/routers/`.
*   **Load Tests**: Focus on `/similarity/` and `/search/` under 100+ concurrent B2B requests.
*   **Security Tests**: 100% verification of `partner_id` scoping across all tables.
