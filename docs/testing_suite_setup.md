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

## 5. Playlists & Engagement
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/playlists/` | `GET`, `POST`, `PUT` | Playlist CRUD | 1. Create private/public playlists.<br>2. Reorder tracks in list. | 1. `403` if modifying a locked playlist.<br>2. Prevent circular forks. |
| `/playlist_engagement/`| `POST` | Tracking plays/saves | 1. Increment play counts.<br>2. Record "Added to Library". | 1. Prevent bot-spamming play counts. |
| `/admin/playlist/` | `GET`, `DELETE` | Moderator oversight | 1. Batch visibility toggle (hide spam). | 1. Audit trail of moderator actions. |

## 6. External Streaming Transfers
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/spotify_transfer/` | `GET`, `POST` | Sync with Spotify | 1. Map Spotify tracks to Resomix IDs. | 1. Expired OAuth token handling.<br>2. Rate limit from Spotify API. |
| `/tidal_transfer/` | `POST` | Sync with Tidal | 1. Import Tidal playlists. | 1. Missing metadata mapping. |
| `/apple_music_transfer/`| `GET`, `POST` | Sync with Apple Music | 1. Verify library access. | 1. `401` on Apple Dev Token failure. |

## 7. E-commerce, Cart & Promo
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/purchases/cart` | `GET`, `POST`, `DELETE` | Shopping cart logic | 1. Persistent cart across sessions.<br>2. Apply promo code (Growth/Enterprise). | 1. Prevent adding out-of-stock licenses.<br>2. Double-discount prevention. |
| `/purchases/checkout/`| `POST` | Stripe session creation | 1. Redirect to secure payment. | 1. Verify webhook signatures.<br>2. Handle abandoned checkouts. |

## 8. Feedback, Support & CRM
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/contact/` | `POST`, `GET` | Public inquiry form | 1. Save submission to admin queue. | 1. `422` for invalid fields.<br>2. CAPTCHA verification check. |
| `/feedback/` | `POST`, `PATCH` | User UX surveys | 1. Submit NPS or feature request. | 1. Limit submissions per user. |
| `/admin/contact/` | `GET`, `DELETE` | Support ticket management | 1. Resolve/Close tickets. | 1. Only Support-role admins allowed. |

## 9. Waitlist & Promo Campaigns
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/waitlist/` | `POST` | Early access registration | 1. Record email and tier interest. | 1. Prevent duplicate email entries. |
| `/admin/promo/create` | `POST` | Campaign generation | 1. Generate unique 100% off codes. | 1. Limit code usage (count/date). |

## 10. System, Ops & Telemetry
| Endpoint | Methods | Purpose | Success Scenarios | Security/Error Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `/health/` | `GET` | Service heartbeat | 1. Check MariaDB, Redis, and S3 status. | 1. Detail error if one component fails. |
| `/telemetry/` | `POST` | Performance tracking | 1. Log frontend latency metrics. | 1. Anonymize user IDs for GDPR. |
| `/admin/operation_limits/`| `GET`, `PUT` | System-wide caps | 1. Adjust max concurrent uploads. | 1. High-priority admin override. |

---

## Testing Environment Summary
*   **Unit Tests**: Mocked dependencies, focused on `app/services/` logic.
*   **Integration Tests**: Real DB/Redis, testing `app/controllers/` and `app/api/routers/`.
*   **Load Tests**: Focus on `/similarity/` and `/search/` under 100+ concurrent B2B requests.
*   **Security Tests**: 100% verification of `partner_id` scoping across all tables.
