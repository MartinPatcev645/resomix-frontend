# Resomix Project — Complete File Inventory

> Generated: 2026-05-21
> Total files: 492
> Excludes: `.gitignore`-ignored paths (`.venv`, `creds/`, `__pycache__`, `exports/`, `alembic/__pycache__`, etc.) and `.DS_Store` files.

---

## Root

- `.gitignore` — Specifies files and directories that Git should ignore (virtualenvs, caches, secrets, etc.).
- `Makefile` — Developer convenience targets (`make api`, `make test`, etc.) for common workflow commands.
- `QUICK_START.md` — Step-by-step guide for getting the development environment running from scratch.
- `README.md` — Top-level project overview and entry-point documentation for new developers.
- `alembic.ini` — Alembic migration tool configuration: DB URL pointer, logging, and script location.
- `docker-compose.yml` — Defines local dev containers for MariaDB (`resomix-test-db`) and Redis.
- `endpoints.json` — Machine-readable export of all API endpoints, their HTTP methods, and paths.
- `new_database.sql` — The authoritative, canonical SQL DDL for the full production database schema.
- `prelisten.mp3` — Sample MP3 audio file used in similarity and preview endpoint integration tests.
- `pytest.ini` — Pytest configuration: test paths, asyncio mode, markers, and plugin settings.
- `requirements.txt` — Pinned Python package dependencies for the production application.
- `resomix_schema_mariadb.sql` — Legacy backup MariaDB schema from before the normalised schema was adopted.
- `run.py` — CLI entry point that starts the Uvicorn ASGI server for local development.
- `s_fail2ban.txt` — Server Fail2Ban configuration snippet for brute-force login protection on the VPS.
- `s_nginx.txt` — Server Nginx reverse proxy configuration for the production deployment.
- `setup_new_db.txt` — Step-by-step instructions for provisioning a fresh development or CI database.
- `test_antivirus.py` — Standalone manual test script for validating the ClamAV antivirus scanning integration.
- `test_models.py` — Standalone script for verifying all SQLAlchemy model imports and table mappings.
- `test_output.txt` — Saved snapshot of a previous `pytest` run output kept for reference.
- `transition.md` — Migration notes documenting the move from the MongoDB-based architecture to MariaDB.
- `DOCS_GENERATION.md` — Guide explaining how the B2B Partner API documentation is generated, updated, and configured.
- `transition_stripe.md` — Notes documenting the Stripe payment gateway integration and migration plan.

---

## alembic/

- `alembic/env.py` — Configures Alembic to connect to the app's SQLAlchemy models and DB URL for migrations.
- `alembic/versions/b4d71a1d2df0_initial_schema_from_new_database_sql.py` — Initial Alembic migration that executes the canonical SQL file to create all database tables.
- `alembic/versions/ef7999c3c2ca_add_stripe_columns.py` — Database migration adding Stripe customer and subscription ID columns to the partners table.
- `alembic/versions/schema.sql` — Full SQL DDL file executed by the initial Alembic migration to build the entire schema.

---

## api_docs/

- `api_docs/README.md` — Markdown file containing the introductory text and integration guides for B2B Partner API documentation.
- `api_docs/index.html` — The final static API documentation page containing the complete Scalar UI and inlined OpenAPI schema.

---

## app/

- `app/__init__.py` — Package marker for the main application module.
- `app/observability.py` — Configures structured logging, metrics, and tracing instrumentation for the application.
- `app/main.py` — FastAPI application factory: mounts all routers, middleware, CORS config, and lifespan events.

### app/api/

- `app/api/__init__.py` — Package marker for the API layer.

#### app/api/dependencies/

- `app/api/dependencies/__init__.py` — Package marker for FastAPI dependency injection utilities.
- `app/api/dependencies/auth.py` — FastAPI dependency that extracts and validates the current JWT-authenticated user.
- `app/api/dependencies/database.py` — FastAPI dependency providing an async SQLAlchemy database session per request.
- `app/api/dependencies/partner_auth.py` — FastAPI dependency that authenticates inbound requests using a partner API key.

#### app/api/middleware/

- `app/api/middleware/__init__.py` — Package marker for custom Starlette middleware.
- `app/api/middleware/audit_log.py` — Middleware that writes every partner API request to the partner_usage_logs audit table.
- `app/api/middleware/idempotency.py` — Middleware enforcing idempotency keys in Redis to prevent duplicate mutations.
- `app/api/middleware/rate_limit.py` — Middleware enforcing per-partner RPS burst limits and rolling monthly quota caps.
- `app/api/middleware/security.py` — Middleware injecting security headers (HSTS, X-Frame-Options, CSP, etc.) on every response.

#### app/api/routers/

- `app/api/routers/__init__.py` — Package marker for the API router layer.
- `app/api/routers/albums.py` — User-facing endpoints for browsing and retrieving album/release data.
- `app/api/routers/apple_music_transfer.py` — Endpoints for initiating and monitoring Apple Music playlist transfer jobs.
- `app/api/routers/artists.py` — Endpoints for browsing and retrieving artist/contributor catalog data.
- `app/api/routers/auth.py` — Public auth endpoints: register, login, logout, token refresh, and 2FA.
- `app/api/routers/contact.py` — Public endpoint for submitting contact/support inquiries.
- `app/api/routers/dummy.py` — Placeholder router used during development; not production-facing.
- `app/api/routers/feedback.py` — User-facing endpoint for submitting product feedback.
- `app/api/routers/health.py` — Health-check endpoint returning server and dependency (DB, Redis) status.
- `app/api/routers/hls.m3u8` — Sample HLS playlist manifest file used for streaming endpoint tests.
- `app/api/routers/metadata.py` — B2B endpoints for retrieving rich track/release metadata by ISRC or UUID.
- `app/api/routers/monthly_pipeline.py` — B2B endpoints for submitting tracks via the CSV-based monthly ingestion pipeline.
- `app/api/routers/open_tracks_pipeline.py` — Internal endpoint for bulk-importing open/free tracks into the catalog.
- `app/api/routers/partner.py` — Partner self-service endpoint (`GET /partner/me`) for verifying API key context.
- `app/api/routers/playlist_engagement.py` — User endpoints for playlist engagement actions (like, rate, fork).
- `app/api/routers/playlists.py` — User CRUD endpoints for creating, reading, updating, and deleting playlists.
- `app/api/routers/preview.py` — Endpoint serving short HLS audio preview clips for individual tracks.
- `app/api/routers/purchases.py` — Ecommerce endpoints for purchasing tracks or releases.
- `app/api/routers/ratings.py` — Endpoints for submitting and retrieving track and playlist ratings.
- `app/api/routers/search.py` — Public/B2B search endpoint for querying the track catalog by keyword or metadata.
- `app/api/routers/similarity.py` — Endpoints for running audio similarity searches by track ID or uploaded audio file.
- `app/api/routers/spotify_transfer.py` — Endpoints for initiating and monitoring Spotify playlist export jobs.
- `app/api/routers/telemetry.py` — Endpoints for recording user playback events and querying consumption telemetry.
- `app/api/routers/tidal_transfer.py` — Endpoints for initiating and monitoring Tidal playlist export jobs.
- `app/api/routers/tracks.py` — Endpoints for browsing and retrieving individual track catalog records.
- `app/api/routers/users.py` — User self-service endpoints: profile read/update, password change, session management.
- `app/api/routers/waitlist.py` — Public endpoint for joining the product waitlist.
- `app/api/routers/webhooks.py` — Endpoints for managing partner webhook subscriptions and viewing delivery logs.

##### app/api/routers/admin/

- `app/api/routers/admin/__init__.py` — Package marker for admin-only routers.
- `app/api/routers/admin/auth.py` — Admin login endpoint (`POST /admin/auth/login`) that returns a signed JWT.
- `app/api/routers/admin/feedback.py` — Admin endpoints for listing and resolving user feedback submissions.
- `app/api/routers/admin/operation_limits.py` — Admin endpoints for setting and adjusting per-user operation rate limits.
- `app/api/routers/admin/partners.py` — Admin CRUD endpoints for partner tenant management and API key lifecycle.
- `app/api/routers/admin/roles.py` — Admin endpoints for listing roles and managing their permission assignments.
- `app/api/routers/admin/sftp.py` — Admin endpoints for provisioning SFTP user accounts for B2B partners.
- `app/api/routers/admin/spotify_apps.py` — Admin endpoints for managing per-partner Spotify OAuth app credentials.
- `app/api/routers/admin/users.py` — Admin endpoints for listing, creating, updating, and assigning roles to users.
- `app/api/routers/admin/waitlist.py` — Admin endpoints for reviewing, approving, and managing waitlist entries.

##### app/api/routers/internal/

- `app/api/routers/internal/__init__.py` — Package marker for internal (non-public) routers.
- `app/api/routers/internal/sftp.py` — Internal webhook endpoint triggered by SFTP `.done` events to kick off batch ingestion.

### app/controllers/

- `app/controllers/__init__.py` — Package marker for the controllers layer.
- `app/controllers/admin_auth_controller.py` — Handles admin login logic: credential validation and JWT generation.
- `app/controllers/admin_controller.py` — General admin dashboard operations and shared admin utility methods.
- `app/controllers/admin_role_controller.py` — Business logic for listing, creating, and managing RBAC roles and permissions.
- `app/controllers/admin_user_controller.py` — Business logic for admin-initiated user CRUD and role assignments.
- `app/controllers/album_controller.py` — Fetches, filters, and paginates album/release records for API responses.
- `app/controllers/apple_music_transfer_controller.py` — Orchestrates Apple Music OAuth flow and playlist export operations.
- `app/controllers/artist_controller.py` — Fetches and paginates artist/contributor catalog records for API responses.
- `app/controllers/auth_controller.py` — Handles registration, login, logout, token refresh, and 2FA flows.
- `app/controllers/cart_controller.py` — Business logic for adding/removing cart items and managing checkout.
- `app/controllers/contact_controller.py` — Handles contact form submission, storage, and admin notification dispatch.
- `app/controllers/feedback_controller.py` — Handles user feedback submission and the admin resolution workflow.
- `app/controllers/metadata_controller.py` — Resolves and returns rich metadata for tracks and releases via the B2B API.
- `app/controllers/monthly_pipeline_controller.py` — Orchestrates the CSV-based monthly track ingestion from B2B partners.
- `app/controllers/open_tracks_pipeline_controller.py` — Orchestrates bulk open-track imports from JSON manifests into the catalog.
- `app/controllers/operation_limit_controller.py` — Manages per-user operation quotas and enforces limit rules.
- `app/controllers/partner_controller.py` — Handles partner CRUD, API key lifecycle, and partner context resolution.
- `app/controllers/playlist_controller.py` — Handles playlist CRUD, track add/remove, visibility, and fork operations.
- `app/controllers/playlist_engagement_controller.py` — Records and aggregates user playlist engagement events (likes, views, forks).
- `app/controllers/preview_controller.py` — Serves HLS audio preview clips by resolving file paths for each track.
- `app/controllers/purchase_controller.py` — Processes track/release purchases and records order transactions.
- `app/controllers/rating_controller.py` — Handles track and playlist rating submissions and aggregate retrieval.
- `app/controllers/search_controller.py` — Routes search queries to DB or vector engine and formats ranked results.
- `app/controllers/similarity_controller.py` — Dispatches similarity queries to the external microservice and returns ranked results.
- `app/controllers/spotify_app_controller.py` — Manages per-partner Spotify OAuth app credentials for multi-app support.
- `app/controllers/spotify_transfer_controller.py` — Orchestrates the Spotify OAuth flow and playlist export process.
- `app/controllers/telemetry_controller.py` — Records playback events and retrieves consumption telemetry summaries.
- `app/controllers/tidal_transfer_controller.py` — Orchestrates the Tidal OAuth flow and playlist export process.
- `app/controllers/track_controller.py` — Fetches and presents individual track records with enriched metadata.
- `app/controllers/user_controller.py` — Handles user profile reads, updates, password changes, and session operations.
- `app/controllers/waitlist_controller.py` — Handles waitlist signup, duplicate checks, and admin approval logic.
- `app/controllers/webhook_controller.py` — Manages partner webhook subscriptions and delivery log retrieval.

### app/core/

- `app/core/__init__.py` — Package marker for the core application utilities module.
- `app/core/config.py` — Loads and exposes all application settings from environment variables via Pydantic Settings.
- `app/core/context.py` — Stores and retrieves request-scoped context (partner, user) using Python's contextvars.
- `app/core/exceptions.py` — Defines custom application exception classes (NotFound, Forbidden, Conflict, etc.).
- `app/core/rbac.py` — Declares all system permissions, roles, and the canonical role-to-permission mappings.
- `app/core/security.py` — Provides bcrypt password hashing, JWT creation/decoding, and token verification utilities.

### app/db/

- `app/db/redis.py` — Configures and exposes the async Redis connection pool used for caching and queuing.

### app/models/

- `app/models/__init__.py` — Imports all ORM models to register them with SQLAlchemy's declarative Base.
- `app/models/admin_operation_log.py` — ORM model for `admin_operation_logs`: structured audit trail of all admin actions.
- `app/models/audio_file.py` — ORM model for `audio_files`: stores paths and metadata of ingested audio assets.
- `app/models/b2b.py` — ORM models for B2B ingestion tables: `IngestLog`, `Message`, `IngestionError`, `ManualTakedown`.
- `app/models/constants.py` — Shared Enum definitions and constant values used across multiple ORM models.
- `app/models/consumption_event.py` — ORM model for `consumption_events`: tracks every user stream/skip/download action.
- `app/models/contact.py` — ORM model for `contacts`: stores submitted contact form inquiries.
- `app/models/contributor.py` — ORM model for `contributors`: represents artists, producers, and other rights holders.
- `app/models/copyright.py` — ORM model for copyright/rights ownership records attached to releases.
- `app/models/document_file.py` — ORM model for `document_files`: stores paths to uploaded legal or metadata documents.
- `app/models/ecommerce.py` — ORM models for `orders`, `cart_items`, `promo_codes`, and related commerce entities.
- `app/models/feedback.py` — ORM model for `feedbacks`: stores user-submitted product feedback entries.
- `app/models/genre.py` — ORM model for `genres` with hierarchical parent/child genre support.
- `app/models/image_file.py` — ORM model for `image_files`: stores paths to cover art and other image assets.
- `app/models/label.py` — ORM model for `labels`: maps record labels to their owning party.
- `app/models/log.py` — ORM model for `system_logs`: captures general application-level log events.
- `app/models/message.py` — ORM model for `messages`: represents parsed DDEX ERN message envelopes from ingestion.
- `app/models/operation_limit.py` — ORM models for `operation_types` and `user_operation_limits` tables.
- `app/models/partner.py` — ORM models for `partners` and `partner_api_keys`: the B2B multi-tenancy core entities.
- `app/models/party.py` — ORM model for `parties`: represents DDEX supply-chain parties (distributors, labels).
- `app/models/playlist.py` — ORM model for `playlists`: supports custom, similarity, and waiting-segments playlist types.
- `app/models/playlist_engagement.py` — ORM model for user playlist engagement events (likes, views, shares).
- `app/models/playlist_transfer_track.py` — ORM model tracking per-track transfer state during playlist export jobs.
- `app/models/purchase.py` — ORM model for `purchases`: individual track/release purchase transaction records.
- `app/models/rating.py` — ORM models for `track_ratings` and `playlist_ratings` tables.
- `app/models/release.py` — ORM model for `releases`: albums, EPs, and singles with full DDEX compliance fields.
- `app/models/release_contributor.py` — ORM association model linking releases to contributors with role metadata.
- `app/models/release_file.py` — ORM model for files (artwork, documents) attached to a release record.
- `app/models/release_track.py` — ORM association model linking releases to tracks with track sequencing data.
- `app/models/report.py` — ORM model for generated analytics/royalty reports stored in the system.
- `app/models/sftp_user.py` — ORM model for `sftp_users`: manages provisioned B2B SFTP account records.
- `app/models/spotify_app.py` — ORM models for `spotify_apps` and `user_spotify_apps`: per-partner OAuth credentials.
- `app/models/track.py` — ORM model for `tracks`: the core catalog entity storing ISRC, duration, BPM, key, genre, etc.
- `app/models/track_contributor.py` — ORM association model linking tracks to contributors with role and royalty type.
- `app/models/user.py` — ORM models for `users`, `roles`, `permissions`, `user_roles`, and `role_permissions`.
- `app/models/user_track_engagement.py` — ORM model for `user_track_engagements`: per-user track play/skip/download events.
- `app/models/waitlist.py` — ORM model for `waitlists`: stores user waitlist signup records.

### app/repositories/

- `app/repositories/__init__.py` — Package marker for the data access (repository) layer.
- `app/repositories/base_repository.py` — Generic base class providing async/sync CRUD operations shared by all repositories.
- `app/repositories/cart_repository.py` — Data access methods for cart and cart_item records.
- `app/repositories/contact_repository.py` — Data access methods for contact form submission records.
- `app/repositories/contributor_repository.py` — Data access methods for contributor and track_contributor join records.
- `app/repositories/feedback_repository.py` — Data access methods for user feedback submission records.
- `app/repositories/genre_repository.py` — Data access methods for genre lookup and idempotent get-or-create operations.
- `app/repositories/label_repository.py` — Data access methods for record label records.
- `app/repositories/log_repository.py` — Data access methods for system_logs and admin_operation_logs tables.
- `app/repositories/operation_limit_repository.py` — Data access methods for operation types and per-user limit configuration records.
- `app/repositories/order_repository.py` — Data access methods for order and purchase records.
- `app/repositories/partner_quota_repository.py` — Data access methods for managing partner monthly quotas, usage logs, and upsert operations.
- `app/repositories/partner_repository.py` — Data access methods for partner tenant and API key records, including bulk key deletion.
- `app/repositories/playlist_engagement_repository.py` — Data access methods for playlist engagement event records.
- `app/repositories/playlist_repository.py` — Data access methods for playlist CRUD, track management, and fork operations.
- `app/repositories/playlist_transfer_track_repository.py` — Data access methods for per-track transfer state records within playlist export jobs.
- `app/repositories/purchase_repository.py` — Data access methods for individual purchase transaction records.
- `app/repositories/rating_repository.py` — Data access methods for track and playlist rating records.
- `app/repositories/rbac_repository.py` — Data access methods for roles, permissions, and role-permission assignment records.
- `app/repositories/release_repository.py` — Data access methods for release/album records and their track/contributor associations.
- `app/repositories/sftp_user_repository.py` — Data access methods for SFTP user account provisioning records.
- `app/repositories/similarity_repository.py` — Data access methods for resolving track UUIDs returned by the similarity microservice.
- `app/repositories/spotify_app_repository.py` — Data access methods for Spotify OAuth app credential records.
- `app/repositories/telemetry_repository.py` — Data access methods for consumption event and playback telemetry records.
- `app/repositories/track_repository.py` — Data access methods for track catalog records with genre and contributor enrichment.
- `app/repositories/user_repository.py` — Data access methods for user, session, token, and auth provider records.
- `app/repositories/waitlist_repository.py` — Data access methods for waitlist signup records.

### app/schemas/

- `app/schemas/__init__.py` — Package marker for Pydantic request/response schema definitions.
- `app/schemas/admin_auth.py` — Pydantic schemas for the admin login request body and JWT token response.
- `app/schemas/admin_role.py` — Pydantic schemas for role and permission list/assign API request and response.
- `app/schemas/admin_user.py` — Pydantic schemas for admin user creation, update, and paginated list responses.
- `app/schemas/album.py` — Pydantic schemas for album/release detail and list response payloads.
- `app/schemas/apple_music_transfer.py` — Pydantic schemas for Apple Music transfer initiation request and status response.
- `app/schemas/artist.py` — Pydantic schemas for artist/contributor detail and list response payloads.
- `app/schemas/auth.py` — Pydantic schemas for registration, login, token refresh, and 2FA request/response.
- `app/schemas/common.py` — Shared Pydantic base schemas: `PaginatedResponse`, `SuccessResponse`, error envelopes.
- `app/schemas/contact.py` — Pydantic schemas for the contact form submission request and confirmation response.
- `app/schemas/feedback.py` — Pydantic schemas for feedback submission request and admin resolution response.
- `app/schemas/log.py` — Pydantic schemas for system log and admin operation log list responses.
- `app/schemas/metadata.py` — Pydantic schemas for B2B metadata query request and the enriched track/release response.
- `app/schemas/monthly_pipeline.py` — Pydantic schemas for the CSV monthly ingestion pipeline request and response.
- `app/schemas/operation_limit.py` — Pydantic schemas for operation limit set/read request and response.
- `app/schemas/partner.py` — Pydantic schemas for partner CRUD, API key issue/rotate/revoke, and list responses.
- `app/schemas/playlist.py` — Pydantic schemas for playlist creation, update, detail, and track-list responses.
- `app/schemas/playlist_engagement.py` — Pydantic schemas for playlist engagement event request and aggregate response.
- `app/schemas/preview.py` — Pydantic schema for the track audio preview URL response payload.
- `app/schemas/purchase.py` — Pydantic schemas for purchase request and order history list response.
- `app/schemas/rating.py` — Pydantic schemas for track/playlist rating submission and retrieval responses.
- `app/schemas/release.py` — Pydantic schemas for release/album detail and list response payloads.
- `app/schemas/search.py` — Pydantic schemas for the search query request and ranked result list response.
- `app/schemas/similarity.py` — Pydantic schemas for similarity search request and ranked track result response.
- `app/schemas/spotify_app.py` — Pydantic schemas for Spotify OAuth app credential management endpoints.
- `app/schemas/spotify_transfer.py` — Pydantic schemas for Spotify playlist transfer initiation and status response.
- `app/schemas/telemetry.py` — Pydantic schemas for playback event recording request and telemetry summary response.
- `app/schemas/tidal_transfer.py` — Pydantic schemas for Tidal playlist transfer initiation and status response.
- `app/schemas/track.py` — Pydantic schemas for track detail and paginated list response payloads.
- `app/schemas/user.py` — Pydantic schemas for user profile read/update, password change, and session management.
- `app/schemas/waitlist.py` — Pydantic schemas for waitlist signup request and confirmation response.

### app/services/

- `app/services/__init__.py` — Package marker for the service/business logic layer.
- `app/services/admin_operation_log_service.py` — Writes structured audit log entries to `admin_operation_logs` for all admin actions.
- `app/services/album_service.py` — Business logic for fetching, filtering, and paginating album/release catalog records.
- `app/services/antivirus_service.py` — Scans uploaded files for malware using ClamAV; skipped automatically in dev mode.
- `app/services/apple_music_transfer_service.py` — Manages Apple Music OAuth token exchange and playlist export to Apple Music.
- `app/services/artist_service.py` — Business logic for fetching and paginating artist/contributor catalog records.
- `app/services/audio_service.py` — Handles audio file I/O, format detection, and stored path resolution for tracks.
- `app/services/auth_service.py` — Core authentication: password hashing, JWT creation, session management, and 2FA.
- `app/services/cart_service.py` — Business logic for cart item management and order preparation before checkout.
- `app/services/cleanup_worker.py` — Background worker that evicts expired user sessions using Redis key-expiry pub/sub.
- `app/services/contact_service.py` — Processes, stores contact form submissions and dispatches admin notification emails.
- `app/services/email_service.py` — Sends transactional emails (verification, password reset, welcome) via SMTP with Jinja2 templates.
- `app/services/feedback_service.py` — Processes and stores user feedback; supports the admin resolution workflow.
- `app/services/file_service.py` — Shared file I/O utilities for saving, moving, validating, and deleting uploaded files.
- `app/services/hetzner_service.py` — Provisions SFTP-capable servers on Hetzner Cloud via their REST API.
- `app/services/idempotency_service.py` — Stores and checks idempotency keys in Redis to prevent duplicate write requests.
- `app/services/ingestion_service.py` — Parses and validates B2B partner CSV batches and inserts validated catalog data.
- `app/services/logging_service.py` — Async wrapper service for writing structured log entries to the database.
- `app/services/metadata_service.py` — Resolves and enriches track/release metadata from the database for B2B responses.
- `app/services/monthly_pipeline_service.py` — Orchestrates the full monthly CSV-based B2B partner track ingestion workflow.
- `app/services/open_tracks_pipeline_service.py` — Bulk-imports open/free tracks from a JSON manifest file into the catalog.
- `app/services/operation_limit_evaluator.py` — Evaluates whether a user has exceeded their configured per-operation quota.
- `app/services/operation_limit_service.py` — CRUD service for per-user operation limit configuration and manual resets.
- `app/services/order_service.py` — Creates and finalises orders, applies promo codes, and generates purchase receipts.
- `app/services/partner_service.py` — Manages partner tenant CRUD, API key lifecycle (issue/rotate/revoke/delete), and quota sync.
- `app/services/playlist_engagement_service.py` — Records and aggregates user playlist engagement events (likes, views, forks).
- `app/services/playlist_service.py` — Business logic for playlist CRUD, track add/remove, visibility, and forking.
- `app/services/preview_service.py` — Resolves HLS preview clip paths and generates access URLs for track previews.
- `app/services/purchase_service.py` — Processes individual track/release purchases and records completed transactions.
- `app/services/quota_worker.py` — Background worker that syncs Redis partner quota counters into the `partner_quotas` DB table.
- `app/services/rate_limit_service.py` — Evaluates and enforces partner API rate limits: RPS token bucket and monthly cap.
- `app/services/rating_service.py` — Creates, updates, and retrieves track and playlist rating records.
- `app/services/role_service.py` — Service for administrative RBAC operations including role listings and permission updates.
- `app/services/search_service.py` — Routes full-text and metadata search queries to MariaDB or Elasticsearch and ranks results.
- `app/services/sftp_service.py` — Manages SFTP user provisioning on Hetzner and Alwyzon hosting via their APIs.
- `app/services/similarity_segment.py` — Splits long tracks into time segments for similarity indexing and granular matching.
- `app/services/similarity_service.py` — Proxies audio similarity search requests to the external similarity microservice.
- `app/services/spotify_app_service.py` — Manages storage and retrieval of per-partner Spotify OAuth app credentials.
- `app/services/spotify_transfer_service.py` — Exports user playlists to Spotify using the Spotify Web API with multi-app support.
- `app/services/stripe_b2b_service.py` — Handles B2B subscription lifecycle, Stripe customer integration, VIES VAT checks, and checkout session generation.
- `app/services/telemetry_service.py` — Queues playback events into Redis for batch flush to the database by the worker.
- `app/services/telemetry_worker.py` — Background worker that flushes batched telemetry events from Redis into MariaDB.
- `app/services/tidal_transfer_service.py` — Exports user playlists to Tidal using the Tidal partner API.
- `app/services/track_service.py` — Business logic for fetching, filtering, and paginating catalog track records.
- `app/services/track_upload_service.py` — Handles uploaded audio files: antivirus scan, FFprobe validation, and DB insertion.
- `app/services/user_service.py` — Business logic for user profile management, password changes, and account deactivation.
- `app/services/vies_service.py` — Validates European Union VAT numbers using the official European Commission VIES REST API.
- `app/services/waitlist_service.py` — Processes waitlist signups, checks for duplicates, and supports admin approval.
- `app/services/webhook_service.py` — Manages external webhooks, signature verification, idempotency logic, and platform events.

### app/tasks/

- `app/tasks/__init__.py` — Package marker for async worker Celery tasks.
- `app/tasks/celery_app.py` — Configures the Celery application with Redis broker and result backend.
- `app/tasks/webhooks.py` — Background Celery tasks for delivering HMAC-SHA256 signed partner webhooks with exponential-backoff retries.

### app/templates/

- `app/templates/emails/2fa_code.html` — HTML email template for delivering two-factor authentication OTP codes.
- `app/templates/emails/base.html` — Base HTML layout template inherited by all transactional email templates.
- `app/templates/emails/password_reset.html` — HTML email template for the password reset flow containing a secure reset link.
- `app/templates/emails/verification.html` — HTML email template for account email address verification.
- `app/templates/emails/welcome.html` — HTML email template sent to new users on successful registration.

### app/utils/

- `app/utils/__init__.py` — Package marker for the application utilities module.
- `app/utils/demo_mode_utils.py` — Helpers that swap live responses for mock payloads when the app runs in demo mode.
- `app/utils/edge_auth.py` — Utilities for validating API keys at the edge layer (CDN/proxy pre-auth).
- `app/utils/elasticsearch_utils.py` — Helper functions for constructing and executing Elasticsearch queries.
- `app/utils/file_logger.py` — Writes structured log records to rotating local log files on disk.
- `app/utils/file_utils.py` — General-purpose file system helpers: path building, directory creation, extension checks.
- `app/utils/hls_utils.py` — Utilities for generating and parsing HLS (HTTP Live Streaming) playlist manifests.
- `app/utils/logging_utils.py` — Configures application-wide structured logging format and console/file handlers.
- `app/utils/mix_filter.py` — Filters and ranks similarity results for DJ mix suitability based on BPM, key, and energy.
- `app/utils/playlist_transfer_utils.py` — Shared helpers for mapping internal tracks to external streaming platform formats.
- `app/utils/response.py` — Builds standardised JSON API response envelopes (success, error, paginated).
- `app/utils/response_utils.py` — Additional response helpers: redirect builders, header injection utilities.
- `app/utils/sanitization.py` — Sanitises user-supplied strings to prevent XSS and SQL injection attacks.
- `app/utils/security_utils.py` — Cryptographic helpers: secure token generation, HMAC signing, and API key hashing.
- `app/utils/similarity_filters.py` — Post-processing filters applied to similarity search results (BPM range, key, genre).
- `app/utils/similarity_utils.py` — Helper functions for formatting and normalising similarity microservice query payloads.
- `app/utils/stripe_utils.py` — Helpers for creating Stripe payment intents and verifying Stripe webhook signatures.
- `app/utils/system_metrics.py` — Collects and exposes system-level metrics (CPU usage, memory, disk space).
- `app/utils/validation.py` — Custom validators for ISRCs, UUIDs, email addresses, and other domain-specific types.

---

## backup/ *(legacy pre-migration code, kept for reference)*

- `backup/.env.example` — Legacy env var template from the original MongoDB-based application.
- `backup/.gitignore` — Legacy gitignore from the original application kept for historical reference.
- `backup/README - Copy.md` — Duplicate of the legacy README kept as a historical reference copy.
- `backup/README.md` — Legacy README from the original MongoDB application kept for reference.
- `backup/main.py` — Legacy FastAPI entry point from the original MongoDB-based system.
- `backup/requirements.txt` — Legacy Python dependencies from the original MongoDB-based system.
- `backup/resomix_schema_mariadb.sql` — Legacy MariaDB schema from an early migration attempt (historical reference).
- `backup/scripts/mariadb_.py` — Legacy script for seeding or querying the early MariaDB migration database.
- `backup/scripts/mongo_migration.py` — Script that migrated data from the original MongoDB database to MariaDB.
- `backup/src/complete_meta_backup.py` — Legacy script for extracting and backing up all track metadata from MongoDB.
- `backup/src/feedback.py` — Legacy feedback endpoint implementations from the original MongoDB application.
- `backup/src/ffmpeg.py` — Legacy FFmpeg/FFprobe utility functions from the original application.
- `backup/src/metadata_extraction.py` — Legacy script for extracting audio metadata using Mutagen and FFprobe.
- `backup/src/search.py` — Legacy search implementation from the original MongoDB-based application.
- `backup/src/similarity.py` — Legacy similarity search integration from the original application.
- `backup/src/utils.py` — Legacy general-purpose utility functions from the original application.

---

## database/

- `database/__init__.py` — Package marker for the database connection module.
- `database/connection.py` — Creates and configures the async SQLAlchemy engine, session factory, and `AsyncSessionLocal`.
- `database/manage.py` — CLI commands for database management: create tables, truncate, and run seed scripts.
- `database/migration_manager.py` — Programmatic helper for running Alembic migrations from within application code.
- `database/migrations_backup/001_initial_schema.sql` — Legacy SQL: initial MariaDB schema from the first migration attempt.
- `database/migrations_backup/002_add_engagement_tables.sql` — Legacy SQL: adds user engagement and playlist tables.
- `database/migrations_backup/003_add_spotify_app_tables.sql` — Legacy SQL: adds Spotify OAuth app credential tables.
- `database/migrations_backup/004_add_user_id_to_tracks.sql` — Legacy SQL: adds `user_id` column to the tracks table.
- `database/migrations_backup/__init__.py` — Package marker for the legacy SQL migration backups directory.
- `database/migrations_backup/add_consumption_events.sql` — Legacy SQL: adds the consumption_events telemetry table.
- `database/schema.sql` — Legacy SQL schema dump used before Alembic migration management was adopted.
- `database/seed_reference.txt` — Reference notes for the database seeding process and expected data shape.
- `database/utils.py` — Utility functions for database connection health checks and raw SQL query helpers.

---

## docs/

- `docs/ANTIVIRUS_INTEGRATION.md` — Documents the ClamAV antivirus integration for scanning uploaded audio files.
- `docs/APPLE_MUSIC_FRONTEND_GUIDE.md` — Frontend integration guide for the Apple Music playlist transfer feature.
- `docs/APPLE_MUSIC_IMPLEMENTATION_GUIDE.md` — Backend implementation guide for the Apple Music playlist transfer API.
- `docs/APPLICATION_OVERVIEW.md` — High-level architecture overview of the Resomix application and its components.
- `docs/AUTH_IMPLEMENTATION_GUIDE.md` — Guide covering JWT auth, refresh tokens, 2FA, and session management implementation.
- `docs/CORS_CONFIG.md` — Documents the CORS policy: allowed origins, headers, and environment-specific rules.
- `docs/EXPORT_SETUP_GUIDE.md` — Guide for setting up the audio export and download feature on the server.
- `docs/GET_ALL_USER_PLAYLISTS_FRONTEND_GUIDE.md` — Frontend guide for fetching and displaying all playlists for the authenticated user.
- `docs/MODEL_ALIGNMENT_PLAN.md` — Plan for aligning all SQLAlchemy ORM models with the canonical database schema.
- `docs/OPEN_TRACKS_PIPELINE_SETUP.md` — Guide for setting up and running the open/free tracks bulk import pipeline.
- `docs/PARTNER_DETAILS_API.md` — Integration guide for the GET single partner administrative API endpoint.
- `docs/PLAYLIST_ENGAGEMENT_IMPLEMENTATION.md` — Implementation notes for the playlist engagement tracking feature.
- `docs/PLAYLIST_FORK_FRONTEND_GUIDE.md` — Frontend integration guide for the playlist forking (copy) feature.
- `docs/PLAYLIST_FORK_IMPLEMENTATION_GUIDE.md` — Backend implementation guide for the playlist fork endpoint and service layer.
- `docs/PRODUCTION_DATA_EXTRACTION.md` — Guide for safely extracting a sanitised subset of production data for local dev.
- `docs/SECURITY_AUDIT_REPORT.md` — Security audit report with all findings, risk ratings, and remediation recommendations.
- `docs/SIMILARITY_API_UPDATE.md` — Documents the changes made to the similarity search API interface and payload format.
- `docs/SPOTIFY_APP_ADMIN_FRONTEND_GUIDE.md` — Frontend guide for the admin Spotify app credential management UI.
- `docs/SPOTIFY_APP_MANAGEMENT_IMPLEMENTATION.md` — Backend implementation guide for multi-app Spotify OAuth credential support.
- `docs/SPOTIFY_TRANSFER_README.md` — README and quick-start for the Spotify playlist transfer integration.
- `docs/TIDAL_OAUTH_INTEGRATION.md` — Documents the Tidal OAuth 2.0 device-code flow integration for playlist transfers.
- `docs/TIDAL_TRANSFER_README.md` — README and quick-start for the Tidal playlist transfer integration.
- `docs/admin_operation_limit_implementation.md` — Implementation notes for the per-user operation limit and quota enforcement feature.
- `docs/complete_flow/complete_flow.md` — Narrative documentation of the full end-to-end data flow from ingestion to playback.
- `docs/complete_flow/mermaid 1.png` — Architecture diagram: high-level system component overview.
- `docs/complete_flow/mermaid 2.png` — Architecture diagram: DDEX ERN ingestion pipeline flow.
- `docs/complete_flow/mermaid 3.png` — Architecture diagram: user authentication and session lifecycle.
- `docs/complete_flow/mermaid 4.png` — Architecture diagram: similarity search request and response flow.
- `docs/complete_flow/mermaid 5.png` — Architecture diagram: playlist transfer flow (Spotify/Tidal/Apple Music).
- `docs/complete_flow/mermaid 6.png` — Architecture diagram: B2B partner authentication and quota enforcement flow.
- `docs/complete_flow/mermaid 7.png` — Architecture diagram: ecommerce purchase and order fulfilment flow.
- `docs/database.md` — Full documentation of the database schema, table relationships, and key design decisions.
- `docs/frontend_api_integration_guide.md` — Comprehensive REST API integration guide for frontend developers.
- `docs/integration_summary.md` — Summary of all third-party service integrations and their configuration requirements.
- `docs/may_2026/ADR-001-canonical-sandbox-tenant.md` — Architecture Decision Record establishing the canonical sandbox partner tenant (ID=2).
- `docs/may_2026/W1-1_4_audit_remediation.md` — Remediation notes for security audit findings actioned in Week 1.
- `docs/may_2026/W1-task.md` — Week 1 task tracker for the May 2026 engineering sprint.
- `docs/may_2026/api_versioning_policy.md` — Policy document defining the API versioning strategy (v1 prefix, deprecation timeline).
- `docs/may_2026/partner_admin_portal_spec.md` — Specification for the B2B partner admin portal features, endpoints, and UX.
- `docs/may_2026/partners_endpoints.md` — Reference documentation listing all partner-facing B2B API endpoints.
- `docs/may_2026/rbac_gap_analysis.md` — Analysis of gaps between the legacy and modern RBAC permission systems.
- `docs/may_2026/rbac_implementation_plan_part1.md` — Implementation plan for RBAC Phase 1: roles, permissions, and DB schema.
- `docs/may_2026/rbac_implementation_plan_part2.md` — Implementation plan for RBAC Phase 2: enforcement middleware, seeding, and testing.
- `docs/may_2026/resomix_30day_roadmap_v2.md` — 30-day engineering roadmap for the May–June 2026 sprint planning.
- `docs/may_2026/w1_phase2_implementation_guide.md` — Implementation guide for Week 1 Phase 2 deliverables.
- `docs/may_2026/w2_implementation_plan.md` — Implementation plan for Week 2 features and deliverables.
- `docs/may_2026/w2_phase_2_implementation.md` — Detailed implementation guide for Week 2 Phase 2 features.
- `docs/may_2026/temp_status.md` — Temporary status assessment tracking completed and pending features.
- `docs/may_2026/temp_status_actual.md` — Comprehensive actual status report verifying code coverage, DB configurations, and server/infrastructure checklist details.
- `docs/may_2026/w2_sftp_provisioning_plan.md` — Detailed 4-phase plan for implementing automated SFTP provisioning for B2B partners.
- `docs/may_2026/workflow.md` — Sprint workflow and team collaboration process documentation.
- `docs/may_2026/workflow_resomix.png` — Visual diagram of the end-to-end Resomix workflow for the May 2026 sprint.
- `docs/resomix_alwyzon.md` — Documentation for the Alwyzon SFTP hosting service integration.
- `docs/restore_runbook.md` — Disaster Recovery and database restoration runbook outlining backups, RPO/RTO parameters, and restoration drills.
- `docs/stress.md` — Notes and results from load and stress testing the API under concurrent traffic.
- `docs/technical/1.Digital_suuply_chain.md` — Technical notes on the digital music supply chain: DDEX, distributors, and rights flow.
- `docs/technical/2.Copyright_Liability.md` — Technical notes on copyright liability management and rights clearance.
- `docs/technical/3.Media_delivery.md` — Technical notes on media delivery infrastructure: CDN, HLS streaming, and audio serving.
- `docs/technical/4.Resiliance_availability.md` — Technical notes on system resilience, failover, and high availability design.
- `docs/technical/5.Data_backup.md` — Technical notes on database backup strategy, retention, and disaster recovery.
- `docs/technical/6.Example_questions.md` — Example technical interview or client Q&A questions about the Resomix system.
- `docs/technical/SECURITY_AUDIT_REPORT_2026.md` — Comprehensive 2026 security audit with all findings and current remediation status.
- `docs/technical/alwyzon_server.md` — Configuration reference for the Alwyzon-hosted SFTP server infrastructure.
- `docs/technical/hetzner_server.md` — Configuration reference for the Hetzner Cloud server and network setup.
- `docs/technical/nginx.txt` — Nginx reverse proxy configuration snippet for the production server deployment.
- `docs/technical/prompt.md` — AI assistant prompt used to generate or refine technical architecture documentation.
- `docs/technical/prompt_response.md` — AI-generated response to the technical architecture documentation prompt.
- `docs/testing_suite_setup.md` — Guide for setting up the test database and running the full integration test suite.
- `docs/PROJECT_FILES.md` — This file: complete annotated inventory of every source file in the project.

---

## scratch/ *(one-off debug and investigation scripts)*

- `scratch/check_db.py` — One-off script for checking database connectivity and basic query execution.
- `scratch/check_partners.py` — One-off script to query and display partner records and their API key associations in the database.
- `scratch/debug_login.py` — Debug script for tracing authentication failures during the login flow.
- `scratch/debug_types.py` — Debug script for inspecting SQLAlchemy column type mappings and model definitions.
- `scratch/debug_uuid.py` — Debug script for troubleshooting UUID generation and binary/string storage issues.
- `scratch/import_check_w1_2.py` — Verifies that all Week 1–2 module imports load without errors.
- `scratch/issue_test_key.py` — One-off script for generating and inserting a test partner API key into the database.
- `scratch/mock_partner_ingest.csv` — Valid sample CSV used to manually test the partner batch ingestion pipeline.
- `scratch/mock_partner_ingest_corrupted_header.csv` — Malformed CSV with a bad header used to test ingestion error handling.
- `scratch/mock_partner_ingest_validation_errors.csv` — CSV with invalid row data used to test ingestion field-level validation errors.
- `scratch/sanity_check.py` — Quick sanity-check script verifying the app starts and core routes respond correctly.
- `scratch/simulate_load.py` — Script that sends concurrent requests to simulate API load and measure throughput.
- `scratch/test_imports_phase1.py` — Verifies all Phase 1 module imports (models, services, repos) load cleanly.
- `scratch/test_partner.py` — Sandbox script to quickly test partner model initialization and database save operations.
- `scratch/test_sftp_status.py` — One-off script testing SFTP service status queries and API response validation.
- `scratch/update_db_constraints.py` — One-off script for applying FK constraint updates directly to an existing database.
- `scratch/verify_ingestion_db.py` — Verifies that ingested tracks, releases, and contributors were written correctly to the DB.

---

## scripts/

- `scripts/__init__.py` — Package marker for the scripts directory.
- `scripts/apple_music_backend (1).py` — Draft/prototype script for the Apple Music backend integration (pre-production).
- `scripts/backup_restore.sh` — Shell script executing database and media asset backups and mounting offsite Storage Boxes.
- `scripts/cleanup_exports.py` — Deletes stale audio export files older than the configured retention period.
- `scripts/duration/error.txt` — Error log from a previous run of the track duration backfill script.
- `scripts/duration/update_all_durations.py` — Backfills missing track duration values in the DB using FFprobe analysis.
- `scripts/extract_production_data.py` — Extracts a sanitised subset of production data for safe local development use.
- `scripts/extracted_track_info.json` — JSON file of extracted track metadata used as the primary catalog seed data source.
- `scripts/generate_openapi_of_endpoints.py` — Generates a self-contained B2B OpenAPI reference static HTML file from the running FastAPI application.
- `scripts/hls/hls_segment.txt` — Sample HLS segment text used for HLS streaming integration tests.
- `scripts/hls/response_updated.json` — Recorded API response JSON from an HLS-related endpoint test run.
- `scripts/hls/update_duration.py` — Script for updating HLS segment duration values stored in the database.
- `scripts/migrate_data.py` — Migrates data from legacy structures to the current normalised relational schema.
- `scripts/open_tracks/README.md` — Instructions for running the open-license tracks import pipeline scripts.
- `scripts/open_tracks/extract_tracks_info.py` — Extracts metadata from a directory of open-license audio files into a JSON manifest.
- `scripts/open_tracks/insert_tracks_from_json.py` — Inserts open-license track metadata from a JSON file into the database.
- `scripts/open_tracks/open_tracks.json` — JSON manifest of ~1k open-license tracks used for catalog seeding.
- `scripts/open_tracks/open_tracks_39k.json` — Extended JSON manifest of ~39k open-license tracks for large-scale catalog seeding.
- `scripts/open_tracks/populate_removal_uuids.py` — Populates a list of UUIDs for tracks that have been flagged for catalog removal.
- `scripts/open_tracks/removal_tracks.json` — JSON list of track UUIDs flagged for removal from the open-license catalog.
- `scripts/open_tracks/remove_tracks_from_json.py` — Removes specified tracks by UUID from the open_tracks JSON manifest file.
- `scripts/open_tracks/requirements.txt` — Python dependencies required specifically by the open tracks import scripts.
- `scripts/playlist/count_and_play_time.py` — Calculates total track count and cumulative play time for each playlist.
- `scripts/seed_data.py` — Main database seeder: clears all tables and re-populates with consistent development data.
- `scripts/seed_rbac.py` — Idempotent script to seed RBAC roles and permissions from `app.core.rbac` definitions.
- `scripts/seed_sandbox_catalog.py` — Main sandbox database seeder: inserts 700 CC BY 4.0 tracks and registers the public sandbox key `rmx_sandbox_demo_1234567890`.
- `scripts/setup_stripe.py` — Automates the registration of Resomix B2B pricing products and subscription rates inside the Stripe dashboard.
- `scripts/tracks_seed.json` — Current JSON seed file of sample tracks used for local dev database seeding.
- `scripts/tracks_seed_backup.json` — Backup of the tracks seed JSON file before its last update.

---

## tests/

- `tests/__init__.py` — Package marker for the root tests directory.
- `tests/conftest.py` — Shared pytest fixtures: async DB sessions, test client, seeded users, and auth headers.
- `tests/test_weekly_gate.py` — Clean weekly integration regression suite checking all Week 1-5 deliverables.

### tests/api/

- `tests/api/__init__.py` — Package marker for the API integration tests.
- `tests/api/test_admin_auth.py` — Tests for admin login endpoint: credential validation and JWT token generation.
- `tests/api/test_admin_security_hardened.py` — Tests for admin endpoint security: authentication required and RBAC permission enforcement.
- `tests/api/test_admin_workflows.py` — Tests for core admin workflows: user ops, partner ops, and system log retrieval.
- `tests/api/test_global_sanity.py` — Sanity tests verifying the app starts, DB connects, and basic routes respond.
- `tests/api/test_granular_security.py` — Fine-grained security tests checking permission enforcement on individual endpoints.
- `tests/api/test_rate_limiting.py` — Tests for partner API rate limiting: RPS cap enforcement and monthly quota tracking.

#### tests/api/admin/

- `tests/api/admin/__init__.py` — Package marker for admin endpoint integration tests.
- `tests/api/admin/test_admin_secondary_workflows.py` — Tests for secondary admin workflows: SFTP provisioning, waitlist, and feedback management.
- `tests/api/admin/test_partner_admin.py` — Tests for partner admin endpoints (additional coverage outside the core 215-test suite).
- `tests/api/admin/test_playlist_admin.py` — Tests for admin-level playlist management endpoints.
- `tests/api/admin/test_sftp_provisioning.py` — Tests for SFTP user provisioning via the admin API endpoints.
- `tests/api/admin/test_user_role_management.py` — Tests for admin user CRUD and role assignment endpoints.

#### tests/api/auth/

- `tests/api/auth/__init__.py` — Package marker for authentication integration tests.
- `tests/api/auth/test_auth_flow.py` — Tests for the full auth lifecycle: register, login, token refresh, and logout.
- `tests/api/auth/test_security_management.py` — Tests for 2FA enable/disable flows and user session revocation.

#### tests/api/b2b/

- `tests/api/b2b/__init__.py` — Package marker for B2B/partner API integration tests.
- `tests/api/b2b/test_b2b_security_hardening.py` — Tests for B2B API security: invalid keys, expired tokens, and scope enforcement.
- `tests/api/b2b/test_metadata_routes.py` — Tests for B2B metadata retrieval endpoints by ISRC and track UUID.
- `tests/api/b2b/test_monthly_pipeline_routes.py` — Tests for the CSV-based monthly ingestion pipeline API endpoints.
- `tests/api/b2b/test_partner_api.py` — Tests for partner context resolution (`GET /partner/me`) and API key validation.
- `tests/api/b2b/test_partner_isolation.py` — Tests verifying multi-tenant data isolation between different partner tenants.
- `tests/api/b2b/test_partner_management_flow.py` — End-to-end lifecycle test: partner create → key issue → rotate → update → delete.
- `tests/api/b2b/test_sftp_ingestion_flow.py` — Tests for the SFTP webhook-triggered batch ingestion pipeline.
- `tests/api/b2b/test_similarity_routes.py` — Tests for B2B similarity search endpoints (by track ID and by uploaded audio).

#### tests/api/commerce/

- `tests/api/commerce/__init__.py` — Package marker for commerce integration tests.
- `tests/api/commerce/test_cart_flow.py` — Tests for the cart add/remove/checkout flow (supplementary coverage).

#### tests/api/core_audio/

- `tests/api/core_audio/test_audio_search_similarity.py` — Tests for public audio search and similarity search endpoints.

#### tests/api/ecommerce/

- `tests/api/ecommerce/__init__.py` — Package marker for ecommerce integration tests.
- `tests/api/ecommerce/test_cart_checkout.py` — Tests for the full cart management and purchase checkout flow.

#### tests/api/middlewares/

- `tests/api/middlewares/test_idempotency.py` — Tests for the idempotency middleware: duplicate request detection and rejection.
- `tests/api/middlewares/test_partner_audit.py` — Tests that partner API requests are correctly written to the audit log table.
- `tests/api/middlewares/test_security_edge_cases.py` — Tests for security header injection, CORS rules, and request edge cases.

#### tests/api/pipelines/

- `tests/api/pipelines/test_ingestion_pipelines.py` — Tests for the full batch track ingestion pipeline service.

#### tests/api/public/

- `tests/api/public/__init__.py` — Package marker for public endpoint integration tests.
- `tests/api/public/test_contact_routes.py` — Tests for the public contact form submission endpoint.
- `tests/api/public/test_health_routes.py` — Tests for the `/health` endpoint returning system and dependency status.
- `tests/api/public/test_search_routes.py` — Tests for the public track search endpoint with various query types and filters.
- `tests/api/public/test_waitlist_promo.py` — Tests for waitlist signup and promo code validation endpoints.

#### tests/api/system/

- `tests/api/system/__init__.py` — Package marker for system/telemetry integration tests.
- `tests/api/system/test_ops_telemetry.py` — Tests for playback event recording and consumption telemetry retrieval endpoints.

#### tests/api/user/

- `tests/api/user/__init__.py` — Package marker for user-facing endpoint integration tests.
- `tests/api/user/test_feedback_routes.py` — Tests for user feedback submission and admin feedback retrieval endpoints.
- `tests/api/user/test_playlist_engagement.py` — Tests for playlist engagement actions: like, rate, and fork.
- `tests/api/user/test_user_profile.py` — Tests for user profile read, update, password change, and session management.

### tests/unit/

- `tests/unit/__init__.py` — Package marker for the unit tests directory.
- `tests/unit/test_rbac_foundation.py` — Unit tests for RBAC role/permission structure and the role-permission assignment logic.
- `tests/unit/test_tenant_isolation.py` — Unit tests verifying multi-tenant data isolation at the service layer.

#### tests/unit/repositories/

- `tests/unit/repositories/__init__.py` — Package marker for repository-level unit tests.

#### tests/unit/services/

- `tests/unit/services/__init__.py` — Package marker for service-level unit tests.
- `tests/unit/services/test_ingestion_validation.py` — Unit tests for CSV ingestion validation: missing fields, duplicate ISRCs, bad data.
- `tests/unit/services/test_partner_service.py` — Unit tests for partner service logic: create, update, and API key operations.
- `tests/unit/services/test_rate_limit_service.py` — Unit tests for rate limit evaluation: RPS cap logic and monthly quota enforcement.
- `tests/unit/services/test_sftp_service.py` — Unit tests for SFTP provisioning service: user creation and API interaction logic.
- `tests/unit/services/test_similarity_service_partner.py` — Unit tests for similarity service partner context handling and tenant scoping.

#### tests/unit/utils/

- `tests/unit/utils/__init__.py` — Package marker for utility-level unit tests.

---

## zz_new_db_migration/ *(historical migration planning documents)*

- `zz_new_db_migration/01_legacy_api_data_flow.md` — Documents the legacy MongoDB API data flow before the relational migration.
- `zz_new_db_migration/02_database_schema_mapping.md` — Maps legacy MongoDB collections to the new normalised relational schema tables.
- `zz_new_db_migration/03. Phase2. part2.plan.md` — Phase 2 Part 2 migration planning document.
- `zz_new_db_migration/03_functional_implementation_guide_part1.md` — Functional migration implementation guide — Part 1: core models and auth.
- `zz_new_db_migration/03_functional_implementation_guide_part2.md` — Functional migration implementation guide — Part 2: catalog and ingestion.
- `zz_new_db_migration/03_functional_implementation_guide_part3.md` — Functional migration implementation guide — Part 3: B2B, commerce, and engagement.
- `zz_new_db_migration/04_database_and_alembic_guide.md` — Guide for setting up Alembic and running the full database migration sequence.
- `zz_new_db_migration/models_inventory.md` — Inventory of all SQLAlchemy models with their table names and key column mappings.
- `zz_new_db_migration/new.md` — Scratch notes from the new database migration planning phase.
- `zz_new_db_migration/refactor_schema.py` — Script used to programmatically refactor and normalise the legacy schema during migration.
- `zz_new_db_migration/seed/01_model_column_inventory.md` — Inventory of all model columns with their data types and constraints for seeding.
- `zz_new_db_migration/seed/02_data_relationship_mapping.md` — Documents inter-entity relationships and the correct seeding insertion order.
- `zz_new_db_migration/seed/03_seed_data_blueprint.md` — Blueprint defining the required seed data shape and values for each table.
- `zz_new_db_migration/temp.txt` — Temporary scratch notes from the database migration work.
