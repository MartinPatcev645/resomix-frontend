"""
Application Configuration
=========================

This module defines the application configuration settings for the Resomix API.
It handles environment variable loading, API configuration, file handling settings,
CORS configuration, and similarity search parameters.

Provides centralized configuration management with environment-specific overrides
and validation for all application settings and parameters.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings(BaseModel):
    """Application configuration settings"""

    resomix_env: str = Field(
        default="production",
        description="Current environment (development or production)",
    )

    # API Configuration
    api_key: str = Field(
        default="",
        description=(
            "RETIRED. This was the static frontend/admin super-key (env RESOMIX_API_KEY). It is no "
            "longer accepted anywhere: the frontend is anonymous or JWT-authenticated (→ System "
            "Partner 1) and admins use an admin-role JWT via /admin/auth/login. The field is kept "
            "only so legacy test references resolve; it grants no access. Do not reintroduce it."
        ),
    )
    demo_mode: bool = Field(
        default=False,
        description="When enabled, limits write operations for demo/testing environments",
    )

    # Security Configuration (URL Signing)
    preview_fernet_secret: str = Field(
        default="default-fernet-secret-32bytes-long",
        description="Fernet encryption secret for preview URL signing (must be 32 bytes)",
    )
    token_encryption_key: Optional[str] = Field(
        default=None,
        description="Secret for encrypting stored 3rd-party tokens at rest (e.g. Apple Music user "
                    "token). Falls back to preview_fernet_secret if unset. Set TOKEN_ENCRYPTION_KEY.",
    )
    preview_hmac_secret: str = Field(
        default="default-hmac-secret-for-preview-urls",
        description="HMAC secret for preview URL signing",
    )
    preview_audio_url_expires_seconds: int = Field(
        default=300,
        description="Preview URL expiration time in seconds (default: 5 minutes)",
    )

    # Guest identity (frontend anonymous users)
    guest_cookie_secret: str = Field(
        default="default-guest-cookie-hmac-secret-change-me",
        description="HMAC secret for signing the anonymous guest cookie (set via env in prod).",
    )
    guest_cookie_name: str = Field(default="rmx_guest", description="Name of the signed guest cookie.")
    guest_cookie_max_age_days: int = Field(default=30, description="Guest cookie lifetime in days.")
    # How long `system_logs` rows are kept, enforced by scripts/prune_system_logs.py.
    #
    # 90 days is the common figure for security logs held on legitimate-interest grounds; 12 months
    # is the ceiling most supervisory authorities accept without a specific argument. Storage
    # limitation (Art. 5(1)(e)) means "forever" is not an option — see
    # docs/ACCOUNT_DELETION_GDPR_OPTIONS.md §4.5.
    system_log_retention_days: int = Field(
        default=90, description="Days of system_logs history to keep. 0 disables pruning."
    )
    # Security-log retention for session IPs and user agents. Same reasoning and same ceiling.
    session_ip_retention_days: int = Field(
        default=90, description="Days to keep ip_address/user_agent on expired sessions. 0 disables."
    )
    # How long financial records are kept. NOT our choice — set by tax and accounting law, which
    # varies by member state (roughly 5-10 years; confirm locally). Config rather than a constant
    # so the accountant's answer lands without a migration or a code change.
    invoice_retention_years: int = Field(
        default=7, description="Years to retain invoices and financial records (legal obligation)."
    )
    # Days after a deletion request by which an admin should have run the scrub. Art. 12(3) allows
    # one month; this drives the ageing on the admin queue and is NOT an execution trigger.
    deletion_request_sla_days: int = Field(
        default=30, description="Days within which a deletion request must be actioned."
    )
    # Where the admin panel lives. NOT derivable from `app_url`: the admin surface is
    # `r-admin.resomix.com`, so the obvious string surgery (`https://x` -> `https://admin.x`)
    # produces a dead link in an email nobody would think to check.
    admin_url: str = Field(
        default="https://r-admin.resomix.com",
        description="Base URL of the admin panel, used in admin-facing emails.",
    )
    # Cache TTL for the per-plan entitlement map (Phase 2).
    entitlement_cache_ttl_seconds: int = Field(default=300, description="Redis TTL for cached plan entitlements.")

    # Database Configuration
    mongodb_uri: Optional[str] = Field(
        default=None, description="MongoDB connection URI"
    )

    # External Services
    similarity_server_url: Optional[str] = Field(
        default=None, description="URL of the similarity microservice"
    )
    hetzner_internal_api_key: Optional[str] = Field(
        default=None,
        description="Internal API key for securely deleting tracks on the Hetzner Audio Processing Server",
    )
    # Backup control plane. The admin panel reads and writes the backup_runs tables regardless of
    # these; they only decide whether pressing "Run now" can actually reach a server. Leave the
    # agent URLs unset until the agent endpoints are deployed — the service then records the run as
    # dispatch-unavailable rather than pretending it started something.
    backup_agent_token: Optional[str] = Field(
        default=None,
        description="Shared bearer token the backup agents present when posting run metrics, and "
                    "that Alwyzon presents when asking an agent to start a run",
    )
    backup_agent_alwyzon_url: Optional[str] = Field(
        default=None, description="Base URL of the backup agent on the Alwyzon box (unset = manual trigger disabled)"
    )
    backup_agent_media_url: Optional[str] = Field(
        default=None, description="Base URL of the backup agent on the media box (unset = manual trigger disabled)"
    )
    backup_stale_after_hours: int = Field(
        default=26,
        description="A component with no success within this many hours is reported stale. 26, not "
                    "24: the nightly timer has a randomised delay, so a strict 24 would alarm on a "
                    "healthy run that simply started later than yesterday's",
    )
    backup_history_retention_days: int = Field(
        default=730, description="How long backup run history is kept before purging"
    )
    # Optional ClamAV virus scanning for user uploads (e.g. playlist covers). Leave the host unset to
    # disable — the scan step then no-ops. When set, a reachable clamd is scanned via INSTREAM.
    clamav_host: Optional[str] = Field(default=None, description="clamd host (unset = scanning disabled)")
    clamav_port: int = Field(default=3310, description="clamd TCP port")
    # Analysis microservice (runs on the Hetzner box; Alwyzon is its only caller). Leave unset
    # until the service is deployed — the upload orchestration treats an unset URL as "analysis
    # not available yet" and skips it (similarity still works). Mirrors the similarity wiring.
    analysis_server_url: Optional[str] = Field(
        default=None, description="Public base URL of the analysis microservice (e.g. https://<hetzner-ip>:8010)"
    )
    analysis_internal_api_key: Optional[str] = Field(
        default=None,
        description="Shared secret sent as X-Internal-Key so only Alwyzon can trigger analyses",
    )
    hetzner_sftp_provision_url: Optional[str] = Field(
        default=None,
        description="URL of the internal provisioning script on Hetzner",
    )
    sftp_server_host: str = Field(
        default="sftp.resomix.com",
        description="Public-facing SFTP hostname for partners",
    )
    sftp_server_port: int = Field(
        default=2222,
        description="SFTPGo listening port",
    )
    sftp_base_path: str = Field(
        default="/srv/sftp",
        description="Base path for SFTP partner directories",
    )
    resomix_server_url: str = Field(
        default="http://localhost:8001", description="URL of the Resomix server"
    )

    # Spotify Configuration
    spotify_client_id: Optional[str] = Field(
        default=None, description="Spotify client ID for API access"
    )
    spotify_client_secret: Optional[str] = Field(
        default=None, description="Spotify client secret for API access"
    )

    # Tidal Configuration
    tidal_client_id: Optional[str] = Field(
        default=None, description="Tidal client ID for API access"
    )
    tidal_client_secret: Optional[str] = Field(
        default=None, description="Tidal client secret for API access"
    )

    # Stripe Configuration
    stripe_secret_key: str = Field(
        default="sk_test_mock", description="Stripe secret key"
    )
    stripe_publishable_key: str = Field(
        default="pk_test_mock", description="Stripe publishable key"
    )
    stripe_webhook_secret: str = Field(
        default="whsec_mock", description="Stripe webhook signing secret"
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0", description="Redis connection URL"
    )
    stripe_price_starter_monthly: str = Field(
        default="price_mock_starter_m", description="Stripe Price ID for Starter Monthly"
    )
    stripe_price_starter_annual: str = Field(
        default="price_mock_starter_y", description="Stripe Price ID for Starter Annual"
    )
    stripe_price_growth_monthly: str = Field(
        default="price_mock_growth_m", description="Stripe Price ID for Growth Monthly"
    )
    stripe_price_growth_annual: str = Field(
        default="price_mock_growth_y", description="Stripe Price ID for Growth Annual"
    )
    stripe_price_enterprise_monthly: str = Field(
        default="price_mock_enterprise_m", description="Stripe Price ID for Enterprise Monthly"
    )
    stripe_price_enterprise_annual: str = Field(
        default="price_mock_enterprise_y", description="Stripe Price ID for Enterprise Annual"
    )

    # Consumer subscription billing (separate from the B2B tier price IDs above). Consumer prices
    # are data in the plan_prices table; these fields only bootstrap the seed / hosted flow.
    stripe_price_pro_monthly_eur: str = Field(
        default="", description="Bootstrap: Stripe Price ID for consumer Pro monthly (EUR)"
    )
    stripe_billing_portal_config_id: str = Field(
        default="", description="Stripe Customer Portal configuration ID (bpc_...); Stripe default used if empty"
    )
    stripe_automatic_tax_enabled: bool = Field(
        default=False, description="Enable Stripe Tax (automatic_tax) on consumer checkout/subscriptions"
    )

    # Apple Music Configuration
    apple_team_id: str = Field(
        default="", description="Apple Developer Team ID for MusicKit"
    )
    apple_key_id: str = Field(default="", description="Apple MusicKit Key ID")
    apple_private_key_path: str = Field(
        default="creds/AuthKey_G8UJ487ML5.p8",
        description="Path to Apple MusicKit private key file (AuthKey_*.p8)",
    )
    apple_private_key_pem: Optional[str] = Field(
        default=None,
        description="Raw PEM content of Apple private key (alternative to path)",
    )
    apple_token_ttl: int = Field(
        default=15552000,
        description="Apple Music developer token TTL in seconds (default: 180 days)",
    )
    apple_storefront: str = Field(
        default="us",
        description="Apple Music catalog storefront (e.g., 'us', 'gb', 'jp')",
    )

    # HLS Configuration
    hls_media_base_url: str = Field(
        default="https://media.resomix.com/signed-audio/",
        description="Base URL for HLS media segments",
    )
    hls_signing_secret: str = Field(
        default="dev-secret-hls-signing",
        description="Secret key for signing HLS media URLs",
    )
    hls_url_expires_seconds: int = Field(
        default=3600,
        description="HLS media URL expiration time in seconds (default: 1 hour)",
    )

    # Preview Service Configuration
    # Note: Only URL generation is handled, no actual downloading

    # File handling configuration
    max_file_size: int = Field(
        default=100 * 1024 * 1024, description="Maximum file size in bytes (100MB)"
    )
    temp_dir: str = Field(
        default="temp_audio", description="Temporary directory for uploaded files"
    )
    # How long a poll-based similarity upload job record survives in Redis. The clock is reset
    # when the job finishes, so this is really "how long the client has to collect its result",
    # not a processing budget. One hour is generous against a pipeline measured in seconds and
    # keeps a browser that was backgrounded mid-upload able to recover.
    similarity_job_ttl_seconds: int = Field(
        default=3600, description="TTL for similarity upload job records (seconds)"
    )

    # Similarity search configuration
    allowed_top_sk_values: List[int] = Field(
        default=[10, 20, 50, 100], description="Allowed values for top_sk parameter"
    )
    allowed_duplication_thresholds: List[int] = Field(
        default=[15, 30, 75, 150],
        description="Duplication thresholds corresponding to top_sk values",
    )
    default_top_sk: int = Field(default=20, description="Default top_sk value")
    default_similarity_playlist_max_artists: int = Field(
        default=3,
        description="Default maximum number of artists to consider for playlist names",
    )

    # Title filtering configuration
    title_removal_strings: List[str] = Field(
        default=["(Original Mix)"],
        description="Strings to remove from track titles (case-insensitive)",
    )
    title_stopper_strings: List[str] = Field(
        default=["https:", "www.", "_www.", "VINYL ONLY"],
        description="Strings that stop title processing - keep only the part before these",
    )

    # Meta filtering configuration
    meta_stopper_strings: List[str] = Field(
        default=["https:", "www.", "_www."],
        description="Strings that stop meta field processing - keep only the part before these (case-insensitive)",
    )
    meta_stopper_regex: str = Field(
        default=r"^(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:/[^\s]*)?)$",
        description="Regex pattern to match URLs and domains in meta fields - if matched, the entire meta field is removed",
    )

    # Segment requests configuration
    segment_requests_log_dir: str = Field(
        default="logs/segment_requests",
        description="Directory to store segment request logs",
    )
    segment_requests_timeout: int = Field(
        default=300, description="Timeout for segment requests in seconds (5 minutes)"
    )
    segment_requests_enabled: bool = Field(
        default=True, description="Enable segment preview requests (temporary feature)"
    )

    # ElasticSearch Configuration
    elasticsearch_host: str = Field(
        default="http://localhost:9200", description="Elasticsearch host URL"
    )
    elasticsearch_enabled: bool = Field(
        default=False, description="Whether to use Elasticsearch for search"
    )

    # CORS Configuration — fully env-driven, NO hardcoded defaults.
    # Set via RESOMIX_ALLOWED_ORIGINS_PRODUCTION / RESOMIX_ALLOWED_ORIGINS_DEVELOPMENT
    # in the .env (JSON array preferred, comma-separated also accepted). An empty
    # list means NO browser origin is allowed — set the env var or CORS will block
    # every cross-origin request (fail-closed).
    allowed_origins_production: List[str] = Field(
        default_factory=list,
        description="Allowed CORS origins for production — set RESOMIX_ALLOWED_ORIGINS_PRODUCTION",
    )
    allowed_origins_development: List[str] = Field(
        default_factory=list,
        description="Allowed CORS origins for development — set RESOMIX_ALLOWED_ORIGINS_DEVELOPMENT",
    )

    # CORS Methods and Headers
    cors_allow_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        description="Allowed HTTP methods for CORS",
    )
    cors_allow_headers: List[str] = Field(
        default=["Authorization", "Content-Type", "X-Requested-With", "X-Api-Key", "X-Device-Hash"],
        description="Allowed headers for CORS requests",
    )
    cors_expose_headers: List[str] = Field(
        default=[
            "Content-Length",
            "Content-Range",
            "Accept-Ranges",
            "Content-Disposition",
        ],
        description="Headers exposed to browser for HLS/media/range requests",
    )
    cors_max_age: int = Field(
        default=21600,
        description="Cache duration for CORS preflight requests in seconds (6 hours)",
    )
    cors_allow_credentials: bool = Field(
        default=True,
        description="Allow credentials (cookies/auth headers) in CORS requests",
    )

    # Legacy regex support (optional fallback)
    use_cors_regex: bool = Field(
        default=False,
        description="Use regex-based CORS instead of explicit origins (not recommended with credentials)",
    )
    allowed_origin_regex: str = Field(
        default=r"^https://([a-z0-9-]+\.)*resomix\.com$",
        description="CORS regex for wildcard subdomain matching (only if use_cors_regex=True)",
    )

    use_development_cors: bool = Field(
        default=True, description="Whether to use development CORS settings"
    )

    # App metadata
    app_title: str = Field(
        default="Resomix API", description="FastAPI application title"
    )
    app_description: str = Field(
        default="API for audio similarity search, track information, and metadata extraction",
        description="FastAPI application description",
    )
    app_version: str = Field(default="1.0.1", description="FastAPI application version")

    # Elasticsearch Configuration
    es_url: str = Field(
        default="http://localhost:9200", description="Elasticsearch base URL"
    )
    es_username: Optional[str] = Field(
        default=None, description="Elasticsearch username"
    )
    es_password: Optional[str] = Field(
        default=None, description="Elasticsearch password"
    )
    es_verify_certs: bool = Field(
        default=False, description="Verify TLS certificates for ES"
    )
    es_ca_certs: Optional[str] = Field(
        default=None, description="Path to CA certificates for ES TLS"
    )
    es_request_timeout: int = Field(
        default=20, description="Timeout in seconds for ES requests"
    )
    es_search_limit: int = Field(default=20, description="Default limit for ES search")
    # What /search returns when the caller sends no bearer token — guests and free users, i.e.
    # almost every search. A plain setting rather than an entitlement ON PURPOSE: resolving the
    # guest plan's entitlement would mean a database round trip on the hot path to learn a number
    # that is the same for everyone who takes it. The paid value IS an entitlement
    # (`search_results_max`); this is only the no-lookup default, and a test pins the two together.
    search_results_default: int = Field(default=30, description="Rows /search returns for an unauthenticated caller")
    es_index_alias: str = Field(
        default="tracks_search",
        description="Stable alias the app searches; concrete indices are tracks_search_v<stamp>",
    )

    # === NEW: JWT & Auth Configuration ===
    # JWT Settings
    jwt_secret_key: str = Field(
        default="your-secret-key-change-in-production-min-32-chars",
        description="Secret key for JWT token signing (must be 32+ chars)",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_access_token_expire_minutes: int = Field(
        default=30, description="Access token expiration in minutes"
    )
    jwt_refresh_token_expire_days: int = Field(
        default=30, description="Refresh token expiration in days"
    )

    # Social login — Google (Google Identity Services / ID-token flow)
    google_client_id: str = Field(
        default="",
        description="Google OAuth Web Client ID; used as the expected audience when verifying "
        "Google ID tokens. Same value as the frontend VITE_GOOGLE_CLIENT_ID (not secret).",
    )
    google_client_secret: str = Field(
        default="",
        description="Google OAuth client secret; only needed for the server-side code flow, "
        "not for ID-token verification.",
    )

    # Cloudflare Access (Zero Trust) — edge identity gate in front of the admin surface.
    # When enabled, admin routes additionally require a valid `Cf-Access-Jwt-Assertion` header
    # (injected by Cloudflare after the user passes Access), verified against the team JWKS.
    # DISABLED by default: only turn on once the admin API is reached THROUGH the Access-protected
    # origin (same-origin as the admin SPA), otherwise every admin call will 403.
    cf_access_enabled: bool = Field(
        default=False,
        description="Require a verified Cloudflare Access JWT on admin routes.",
    )
    cf_access_team_domain: str = Field(
        default="",
        description="Cloudflare Access team domain, e.g. 'veggera.cloudflareaccess.com'. "
        "Used to derive the JWKS certs URL and the expected token issuer.",
    )
    cf_access_aud: str = Field(
        default="",
        description="Cloudflare Access Application Audience (AUD) tag for the admin app; the "
        "expected 'aud' claim on the Access JWT.",
    )

    # Cookie Configuration
    cookie_domain: str = Field(
        default=".resomix.com",
        description="Cookie domain for refresh token (allows all subdomains)",
    )
    cookie_secure: bool = Field(
        default=True, description="Secure flag for cookies (HTTPS only)"
    )
    cookie_samesite: str = Field(
        default="lax",
        description="SameSite attribute for cookies (strict, lax, or none)",
    )

    # Password Policy
    password_min_length: int = Field(default=8, description="Minimum password length")
    password_require_uppercase: bool = Field(
        default=False, description="Require uppercase letter"
    )
    password_require_lowercase: bool = Field(
        default=False, description="Require lowercase letter"
    )
    password_require_digit: bool = Field(default=True, description="Require digit")
    password_require_special: bool = Field(
        default=False, description="Require special character"
    )

    # Email Verification
    email_verification_token_expire_hours: int = Field(
        default=24, description="Email verification token expiration in hours"
    )
    password_reset_token_expire_hours: int = Field(
        default=1, description="Password reset token expiration in hours"
    )

    # 2FA Settings
    two_factor_code_expire_minutes: int = Field(
        default=10, description="2FA code expiration in minutes"
    )
    two_factor_code_length: int = Field(
        default=6, description="2FA code length (digits)"
    )

    # Account Lockout (brute-force protection, per-account, complements the IP rate limiter)
    login_max_failed_attempts: int = Field(
        default=10,
        description="Consecutive failed password attempts before the account is temporarily locked",
    )
    login_lockout_minutes: int = Field(
        default=15, description="How long an account stays locked after too many failed logins"
    )

    # Watchdog — threshold alerting on failure spikes (app/services/watchdog_service.py).
    # Defaults are deliberately loose: an alert that fires on ordinary traffic gets muted, and a
    # muted alert is worse than none. Tighten once real baselines are known.
    watchdog_enabled: bool = Field(default=True, description="Enable the failure-spike watchdog")
    watchdog_interval_seconds: int = Field(
        default=300, description="How often the watchdog evaluates its counters"
    )
    watchdog_window_minutes: int = Field(
        default=5, description="Rolling window the watchdog sums over"
    )
    watchdog_5xx_threshold: int = Field(
        default=25, description="5xx responses in the window before an incident is raised"
    )
    watchdog_4xx_threshold: int = Field(
        default=200, description="4xx responses in the window before an incident is raised"
    )
    watchdog_job_failure_threshold: int = Field(
        default=5, description="Background-job failures in the window before an incident"
    )
    watchdog_cooldown_minutes: int = Field(
        default=30, description="Silence for an ONGOING incident; cleared as soon as it recovers"
    )

    # Rate Limiting
    rate_limit_enabled: bool = Field(
        default=True, description="Enable rate limiting for auth endpoints"
    )
    login_rate_limit: str = Field(
        default="5/minute", description="Rate limit for login attempts"
    )
    register_rate_limit: str = Field(
        default="5/hour", description="Rate limit for registration"
    )
    password_reset_rate_limit: str = Field(
        default="4/hour", description="Rate limit for password reset requests"
    )
    frontend_similarity_burst_per_min: int = Field(
        default=30,
        description="Per-IP burst limit (requests/minute) on similarity create for the FRONTEND "
                    "surface only (System Partner 1: guests + logged-in). B2B partners are NEVER "
                    "affected — they have their own DB-backed per-second/monthly quotas. Catches "
                    "one-IP hammering with rotating visitor_ids (the monthly cap can't). 0 disables.",
    )

    # Email Service (SMTP)
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: Optional[str] = Field(default=None, description="SMTP username")
    smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    smtp_from_email: str = Field(
        default="noreply@resomix.com", description="From email address"
    )
    smtp_from_name: str = Field(default="Resomix", description="From name")

    # Frontend URLs (for email links)
    frontend_url: str = Field(
        default="https://resomix.com",
        description="Marketing site URL (resomix.com) — email links to public pages",
    )

    # The web app host, for emailed links whose destination is an APP screen. /auth/verify-email and
    # /auth/reset-password are routes in apps/webapp only; the marketing host has no such pages, just
    # a wildcard `/auth/*` forwarder. Building those links off `frontend_url` made the recipient load
    # the marketing site, fail to match a page, and only then get bounced to the app. Set via
    # FRONTEND_BETA_URL (prod: https://beta.resomix.com; dev: the webapp dev server).
    frontend_beta_url: str = Field(
        default="https://beta.resomix.com",
        description="Web app URL for emailed auth links (verify email, reset password)",
    )

    # Canonical APP url — the actual web app (playlist/analysis/profile live here). Distinct from
    # `frontend_url` (marketing/email host). Used for Stripe billing redirects so a user who
    # subscribes always lands back on the app, not the marketing site. Set via APP_URL in prod.
    app_url: str = Field(
        default="https://beta.resomix.com",
        description="Canonical web-app URL (billing return/success/cancel redirects land here)",
    )

    # Founding-offer window (pricing v2.1). Checkout offers founding prices only while
    # `now < beta_end_date`; after it, list prices. Existing subscription schedules are never
    # touched — that is the "keep the founding rate you signed up at" guarantee.
    #
    # UTC, deliberately. George's v2 doc writes `2027-02-01T00:00:00+02:00` (Athens); this is the
    # same calendar date resolved in UTC, two hours earlier, matching the TZ_RESET=UTC decision so
    # every deadline in the system is expressed on one clock. Env-overridable, so moving the date
    # is a config change rather than a deploy.
    beta_end_date: str = Field(
        default="2027-02-01T00:00:00Z",
        description="ISO-8601 instant after which founding checkout closes (UTC)",
    )

    # Which legal documents a billing consent is recorded against. Stored on every consent row so
    # "which terms did they actually agree to?" stays answerable after the documents are revised —
    # which is the whole reason the consent is a row rather than a boolean. Bump this whenever the
    # ToS or privacy policy changes.
    legal_doc_versions: str = Field(
        default="tos:2026-07-01,privacy:2026-07-01",
        description="Document versions recorded against a billing consent",
    )

    # Where operational notifications (ingestion/embedding/etc. outcomes) are CC'd
    # for the company. Falls back to smtp_from_email if unset so we never silently
    # drop the admin copy.
    admin_notification_email: Optional[str] = Field(
        default=None,
        description="Admin/ops inbox that receives partner operation notifications AND a heads-up on every contact/partner form submission",
    )

    # SCP Configuration (for Open Tracks Pipeline)
    scp_private_key_path: str = Field(
        default="creds/resomix22tbserver-key.pem",
        description="Path to SSH private key for SCP transfer",
    )
    scp_remote_user: str = Field(
        default="ubuntu", description="Remote user for SCP transfer"
    )
    scp_remote_host: str = Field(
        default="65.21.116.184", description="Remote host IP for SCP transfer"
    )
    scp_remote_port: int = Field(
        default=8522, description="Remote SSH port for SCP transfer"
    )
    scp_remote_dir: str = Field(
        default="/home/ubuntu/usman/resomix-similarity/data/open_tracks/",
        description="Remote target directory for SCP transfer",
    )

    similarity_auth_required: bool = Field(
        default=True,
        description="Whether authentication is mandatory for similarity endpoints",
    )
    anonymous_track_ttl: int = Field(
        default=3600,
        description="TTL in seconds for anonymous track storage on Hetzner (default: 1 hour)",
    )
    system_partner_id: int = Field(
        default=1,
        description="The platform's own 'frontend' partner id (the System Partner). Used to gate "
                    "frontend-only behaviour (e.g. login-required similarity/playback) and as the "
                    "default partner scope for frontend/system requests. Default 1.",
    )

    # Telemetry Configuration
    telemetry_flush_interval_seconds: int = Field(
        default=120,
        description="Interval in seconds for the background worker to flush the Redis telemetry queue to DB",
    )
    telemetry_max_batch_size: int = Field(
        default=500,
        description="Maximum number of telemetry events allowed per single sync request",
    )
    telemetry_redis_key: str = Field(
        default="telemetry:stream_events_queue",
        description="Redis list key for the telemetry event queue",
    )
    telemetry_worker_pop_size: int = Field(
        default=1000,
        description="Maximum number of batches to pop from Redis per flush cycle",
    )

    # Edge Authorization (Phase 3.5)
    edge_jwt_secret: str = Field(
        default="YOUR_SUPER_SECURE_SHARED_SECRET",
        description="JWT Secret for signing Edge Auth tokens. Must match Hetzner OpenResty configuration.",
    )
    edge_token_ttl_seconds: int = Field(
        default=14400,
        description="TTL in seconds for playlist session tokens (default 4 hours)",
    )
    public_alwyzon_url: str = Field(
        default="http://localhost:8001",
        description="The public URL of this Alwyzon server (used for playback manifest generation)",
    )

    # === NEW: Partner API Configuration ===
    partner_api_key_signing_secret: str = Field(
        default="default-partner-api-key-signing-secret-change-me",
        description="Secret key for signing partner-related sensitive operations",
    )
    partner_api_key_hash_algorithm: str = Field(
        default="sha256",
        description="Algorithm used for hashing partner API keys (default: sha256)",
    )

    def __init__(self, **data):
        # Override with environment variables if they exist
        env_overrides: Dict[str, Any] = {}

        # Direct environment variable mappings (no prefix)
        direct_env_vars = {
            "MONGODB_URI": "mongodb_uri",
            "SIMILARITY_SERVER_URL": "similarity_server_url",
            "HETZNER_INTERNAL_API_KEY": "hetzner_internal_api_key",
            "ANALYSIS_SERVER_URL": "analysis_server_url",
            "ANALYSIS_INTERNAL_API_KEY": "analysis_internal_api_key",
            "BACKUP_AGENT_TOKEN": "backup_agent_token",
            "BACKUP_AGENT_ALWYZON_URL": "backup_agent_alwyzon_url",
            "BACKUP_AGENT_MEDIA_URL": "backup_agent_media_url",
            "BACKUP_STALE_AFTER_HOURS": "backup_stale_after_hours",
            "BACKUP_HISTORY_RETENTION_DAYS": "backup_history_retention_days",
            "HETZNER_SFTP_PROVISION_URL": "hetzner_sftp_provision_url",
            "SFTP_SERVER_HOST": "sftp_server_host",
            "SFTP_SERVER_PORT": "sftp_server_port",
            "SFTP_BASE_PATH": "sftp_base_path",
            "REDIS_URL": "redis_url",
            "RESOMIX_SERVER_URL": "resomix_server_url",
            "PUBLIC_ALWYZON_URL": "public_alwyzon_url",
            "DEMO_MODE": "demo_mode",
            "SIMILARITY_AUTH_REQUIRED": "similarity_auth_required",
            "SIMILARITY_JOB_TTL_SECONDS": "similarity_job_ttl_seconds",
            "SYSTEM_PARTNER_ID": "system_partner_id",
            "PREVIEW_FERNET_SECRET": "preview_fernet_secret",
            "TOKEN_ENCRYPTION_KEY": "token_encryption_key",
            "PREVIEW_HMAC_SECRET": "preview_hmac_secret",
            "GUEST_COOKIE_SECRET": "guest_cookie_secret",
            "PREVIEW_AUDIO_URL_EXPIRES_SECONDS": "preview_audio_url_expires_seconds",
            "SPOTIFY_CLIENT_ID": "spotify_client_id",
            "SPOTIFY_CLIENT_SECRET": "spotify_client_secret",
            "TIDAL_CLIENT_ID": "tidal_client_id",
            "TIDAL_CLIENT_SECRET": "tidal_client_secret",
            # Apple Music
            "APPLE_TEAM_ID": "apple_team_id",
            "APPLE_KEY_ID": "apple_key_id",
            "APPLE_PRIVATE_KEY_PATH": "apple_private_key_path",
            "APPLE_PRIVATE_KEY_PEM": "apple_private_key_pem",
            "APPLE_TOKEN_TTL": "apple_token_ttl",
            "APPLE_STOREFRONT": "apple_storefront",
            # HLS
            "HLS_MEDIA_BASE_URL": "hls_media_base_url",
            "HLS_SIGNING_SECRET": "hls_signing_secret",
            "HLS_URL_EXPIRES_SECONDS": "hls_url_expires_seconds",
            # Elasticsearch
            "ELASTICSEARCH_ENABLED": "elasticsearch_enabled",
            "ES_URL": "es_url",
            "ES_USERNAME": "es_username",
            "ES_PASSWORD": "es_password",
            "ES_VERIFY_CERTS": "es_verify_certs",
            "ES_CA_CERTS": "es_ca_certs",
            "ES_REQUEST_TIMEOUT": "es_request_timeout",
            "ES_SEARCH_LIMIT": "es_search_limit",
            "SEARCH_RESULTS_DEFAULT": "search_results_default",
            "ES_INDEX_ALIAS": "es_index_alias",
            # JWT & Auth
            "JWT_SECRET_KEY": "jwt_secret_key",
            "JWT_ALGORITHM": "jwt_algorithm",
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "jwt_access_token_expire_minutes",
            "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "jwt_refresh_token_expire_days",
            "COOKIE_DOMAIN": "cookie_domain",
            "COOKIE_SECURE": "cookie_secure",
            "COOKIE_SAMESITE": "cookie_samesite",
            "GOOGLE_CLIENT_ID": "google_client_id",
            "GOOGLE_CLIENT_SECRET": "google_client_secret",
            # Cloudflare Access (Zero Trust)
            "CF_ACCESS_ENABLED": "cf_access_enabled",
            "CF_ACCESS_TEAM_DOMAIN": "cf_access_team_domain",
            "CF_ACCESS_AUD": "cf_access_aud",
            "SMTP_HOST": "smtp_host",
            "SMTP_PORT": "smtp_port",
            "SMTP_USER": "smtp_user",
            "SMTP_PASSWORD": "smtp_password",
            "SMTP_FROM_EMAIL": "smtp_from_email",
            "FRONTEND_URL": "frontend_url",
            "FRONTEND_BETA_URL": "frontend_beta_url",
            "APP_URL": "app_url",
            "ADMIN_NOTIFICATION_EMAIL": "admin_notification_email",
            # SCP Configuration
            "SCP_PRIVATE_KEY_PATH": "scp_private_key_path",
            "SCP_REMOTE_USER": "scp_remote_user",
            "SCP_REMOTE_HOST": "scp_remote_host",
            "SCP_REMOTE_PORT": "scp_remote_port",
            "SCP_REMOTE_DIR": "scp_remote_dir",
            "ANONYMOUS_TRACK_TTL": "anonymous_track_ttl",
            # Telemetry
            "TELEMETRY_FLUSH_INTERVAL_SECONDS": "telemetry_flush_interval_seconds",
            "TELEMETRY_MAX_BATCH_SIZE": "telemetry_max_batch_size",
            "TELEMETRY_REDIS_KEY": "telemetry_redis_key",
            "TELEMETRY_WORKER_POP_SIZE": "telemetry_worker_pop_size",
            # Edge Authorization
            "EDGE_JWT_SECRET": "edge_jwt_secret",
            "EDGE_TOKEN_TTL_SECONDS": "edge_token_ttl_seconds",
            # Stripe
            "STRIPE_SECRET_KEY": "stripe_secret_key",
            "STRIPE_PUBLISHABLE_KEY": "stripe_publishable_key",
            "STRIPE_WEBHOOK_SECRET": "stripe_webhook_secret",
            "STRIPE_PRICE_STARTER_MONTHLY": "stripe_price_starter_monthly",
            "STRIPE_PRICE_STARTER_ANNUAL": "stripe_price_starter_annual",
            "STRIPE_PRICE_GROWTH_MONTHLY": "stripe_price_growth_monthly",
            "STRIPE_PRICE_GROWTH_ANNUAL": "stripe_price_growth_annual",
            "STRIPE_PRICE_ENTERPRISE_MONTHLY": "stripe_price_enterprise_monthly",
            "STRIPE_PRICE_ENTERPRISE_ANNUAL": "stripe_price_enterprise_annual",
            "STRIPE_PRICE_PRO_MONTHLY_EUR": "stripe_price_pro_monthly_eur",
            "STRIPE_BILLING_PORTAL_CONFIG_ID": "stripe_billing_portal_config_id",
            "STRIPE_AUTOMATIC_TAX_ENABLED": "stripe_automatic_tax_enabled",
            # Partner API
            "PARTNER_API_KEY_SIGNING_SECRET": "partner_api_key_signing_secret",
            "PARTNER_API_KEY_HASH_ALGORITHM": "partner_api_key_hash_algorithm",
            # Rate Limiting
            "RATE_LIMIT_ENABLED": "rate_limit_enabled",
            "LOGIN_RATE_LIMIT": "login_rate_limit",
            "REGISTER_RATE_LIMIT": "register_rate_limit",
            "PASSWORD_RESET_RATE_LIMIT": "password_reset_rate_limit",
            "LOGIN_MAX_FAILED_ATTEMPTS": "login_max_failed_attempts",
            "LOGIN_LOCKOUT_MINUTES": "login_lockout_minutes",
            "WATCHDOG_ENABLED": "watchdog_enabled",
            "WATCHDOG_INTERVAL_SECONDS": "watchdog_interval_seconds",
            "WATCHDOG_WINDOW_MINUTES": "watchdog_window_minutes",
            "WATCHDOG_5XX_THRESHOLD": "watchdog_5xx_threshold",
            "WATCHDOG_4XX_THRESHOLD": "watchdog_4xx_threshold",
            "WATCHDOG_JOB_FAILURE_THRESHOLD": "watchdog_job_failure_threshold",
            "WATCHDOG_COOLDOWN_MINUTES": "watchdog_cooldown_minutes",
            # CORS allowed origins (value may be a JSON array or comma-separated)
            "RESOMIX_ALLOWED_ORIGINS_PRODUCTION": "allowed_origins_production",
            "RESOMIX_ALLOWED_ORIGINS_DEVELOPMENT": "allowed_origins_development",
            # Data retention. `Settings` is a plain BaseModel, not BaseSettings, so a field with a
            # default is a CONSTANT until it is listed here — the whole point of these being config
            # is that the accountant's and the DPO's answers land without a code change.
            "SYSTEM_LOG_RETENTION_DAYS": "system_log_retention_days",
            "SESSION_IP_RETENTION_DAYS": "session_ip_retention_days",
            "INVOICE_RETENTION_YEARS": "invoice_retention_years",
            "DELETION_REQUEST_SLA_DAYS": "deletion_request_sla_days",
            "ADMIN_URL": "admin_url",
        }

        for env_key, config_key in direct_env_vars.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle boolean conversion
                if config_key in ["demo_mode", "similarity_auth_required", "rate_limit_enabled", "stripe_automatic_tax_enabled", "elasticsearch_enabled", "es_verify_certs", "cf_access_enabled", "watchdog_enabled"]:
                    env_overrides[config_key] = env_value.lower() in (
                        "true",
                        "1",
                        "yes",
                        "on",
                    )
                # Handle integer conversion
                elif config_key in [
                    "preview_audio_url_expires_seconds",
                    "hls_url_expires_seconds",
                    "es_request_timeout",
                    "es_search_limit",
                    "search_results_default",
                    "jwt_access_token_expire_minutes",
                    "jwt_refresh_token_expire_days",
                    "smtp_port",
                    "apple_token_ttl",
                    "anonymous_track_ttl",
                    "telemetry_flush_interval_seconds",
                    "telemetry_max_batch_size",
                    "telemetry_worker_pop_size",
                    "edge_token_ttl_seconds",
                    "system_partner_id",
                    "login_max_failed_attempts",
                    "login_lockout_minutes",
                    "watchdog_interval_seconds",
                    "watchdog_window_minutes",
                    "watchdog_5xx_threshold",
                    "watchdog_4xx_threshold",
                    "watchdog_job_failure_threshold",
                    "watchdog_cooldown_minutes",
                    "system_log_retention_days",
                    "session_ip_retention_days",
                    "invoice_retention_years",
                    "deletion_request_sla_days",
                    "similarity_job_ttl_seconds",
                    "backup_stale_after_hours",
                    "backup_history_retention_days",
                ]:
                    try:
                        env_overrides[config_key] = int(env_value)
                    except ValueError:
                        pass
                # Handle list conversion (JSON array preferred; comma-separated fallback)
                elif config_key in ["allowed_origins_production", "allowed_origins_development"]:
                    try:
                        parsed = json.loads(env_value)
                    except (ValueError, TypeError):
                        parsed = None
                    if isinstance(parsed, list):
                        env_overrides[config_key] = parsed
                    else:
                        env_overrides[config_key] = [
                            o.strip() for o in env_value.split(",") if o.strip()
                        ]
                else:
                    env_overrides[config_key] = env_value

        # Check for environment variables with RESOMIX_ prefix (legacy support)
        for key in [
            "api_key",
            "temp_dir",
            "default_top_sk",
            "use_development_cors",
            "app_title",
            "app_description",
            "app_version",
        ]:
            env_key = f"RESOMIX_{key.upper()}"
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle boolean conversion
                if key in ["use_development_cors"]:
                    env_overrides[key] = env_value.lower() in ("true", "1", "yes", "on")
                # Handle int conversion
                elif key in ["default_top_sk"]:
                    try:
                        env_overrides[key] = int(env_value)
                    except ValueError:
                        pass
                else:
                    env_overrides[key] = env_value

        # Merge environment overrides with provided data
        data.update(env_overrides)
        super().__init__(**data)

    @property
    def current_allowed_origins(self) -> List[str]:
        """Get the current CORS allowed origins based on environment settings"""
        return (
            self.allowed_origins_development
            if self.use_development_cors
            else self.allowed_origins_production
        )

    @property
    def safe_cookie_domain(self) -> Optional[str]:
        """Get safe cookie domain for set_cookie/delete_cookie.
        Returns None for localhost/127.0.0.1 to allow browser default behavior (no Domain attribute).
        This is necessary because Domain=localhost is often rejected by clients.
        """
        domain = self.cookie_domain.strip().lower()
        if domain in ["localhost", "127.0.0.1", ""]:
            return None
        return self.cookie_domain

    @property
    def hmac_secret(self) -> str:
        """Get HMAC secret for URL signing"""
        return self.preview_hmac_secret

    @property
    def fernet_secret(self) -> str:
        """Get Fernet secret for URL encryption"""
        return self.preview_fernet_secret

    def validate_and_get_top_sk(self, top_sk_value: Optional[int]) -> int:
        """
        Validates the TOP_SK value and returns a valid value.
        If invalid or None, returns default_top_sk.
        """
        if top_sk_value is None or top_sk_value not in self.allowed_top_sk_values:
            return self.default_top_sk
        return top_sk_value

    def get_duplication_threshold_for_top_sk(self, top_sk: int) -> int:
        """
        Returns the appropriate duplication threshold for a given TOP_SK value.
        """
        try:
            index = self.allowed_top_sk_values.index(top_sk)
            return self.allowed_duplication_thresholds[index]
        except ValueError:
            # If top_sk is not in allowed values, return threshold for default
            default_index = self.allowed_top_sk_values.index(self.default_top_sk)
            return self.allowed_duplication_thresholds[default_index]

    def calculate_actual_top_k(self, top_sk: int) -> int:
        """
        Calculates the actual top_k to send to similarity server.
        This adds the duplication threshold to the requested TOP_SK.
        """
        threshold = self.get_duplication_threshold_for_top_sk(top_sk)
        return top_sk + threshold


# Create a global settings instance
settings = Settings()


# ---------------------------------------------------------------------------
# Fail-fast guard for signing secrets
# ---------------------------------------------------------------------------
# These fields ship with obvious placeholder defaults so local dev works out of the box.
# In production, running with a placeholder (or too-short) signing secret would leave every
# JWT forgeable by anyone who knows the well-known default — full account/admin takeover.
_PLACEHOLDER_SIGNING_SECRETS = {
    "jwt_secret_key": "your-secret-key-change-in-production-min-32-chars",
    "edge_jwt_secret": "YOUR_SUPER_SECURE_SHARED_SECRET",
}


def validate_critical_secrets(settings_obj: Optional[Settings] = None) -> None:
    """
    Refuse to start in production if a signing secret is still the placeholder default or is
    shorter than 32 bytes. In non-production environments this only logs a warning so local/dev
    and CI keep booting. Call this once at application startup (see the FastAPI lifespan).
    """
    import logging

    logger = logging.getLogger(__name__)
    s = settings_obj or settings
    is_production = str(getattr(s, "environment", "production")).strip().lower() == "production"

    problems = []
    for field, placeholder in _PLACEHOLDER_SIGNING_SECRETS.items():
        value = getattr(s, field, None) or ""
        if value == placeholder:
            problems.append(f"{field.upper()} is still the placeholder default")
        elif len(value.encode("utf-8")) < 32:
            problems.append(f"{field.upper()} is too short (must be at least 32 bytes)")

    if not problems:
        return

    detail = "; ".join(problems)
    if is_production:
        raise RuntimeError(
            "Refusing to start: insecure signing secret(s) in production — "
            f"{detail}. Set a strong, random value (>= 32 bytes) for each via environment "
            "variables (JWT_SECRET_KEY, EDGE_JWT_SECRET) before deploying."
        )
    logger.warning(
        "Insecure signing secret(s) detected (%s). Allowed because environment=%r, "
        "but these MUST be set to strong random values before production.",
        detail,
        getattr(s, "environment", "unknown"),
    )
