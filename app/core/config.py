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

from typing import List, Optional
from pydantic import BaseModel, Field
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings(BaseModel):
    """Application configuration settings"""

    # API Configuration
    api_key: str = Field(
        default="bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ",
        description="API key for authentication (should be set via environment variable in production)",
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
    preview_hmac_secret: str = Field(
        default="default-hmac-secret-for-preview-urls",
        description="HMAC secret for preview URL signing",
    )
    preview_audio_url_expires_seconds: int = Field(
        default=300,
        description="Preview URL expiration time in seconds (default: 5 minutes)",
    )

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
    resomix_server_url: str = Field(
        default="http://localhost:8000", description="URL of the Resomix server"
    )

    # Google Sheets Configuration
    service_account_file: Optional[str] = Field(
        default=None, description="Path to Google service account JSON file"
    )
    google_sheet_id: Optional[str] = Field(
        default=None, description="Google Sheet ID for feedback/contact forms"
    )
    feedback_worksheet_name: str = Field(
        default="Feedback", description="Name of the feedback worksheet"
    )
    contact_worksheet_name: str = Field(
        default="ContactSubmissions",
        description="Name of the contact submissions worksheet",
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

    # CORS Configuration
    # Production: Explicit allowed origins (no wildcards when credentials=True)
    allowed_origins_production: List[str] = Field(
        default=[
            "https://resomix.com",
            "https://beta.resomix.com",
            "https://stack.resomix.com",
            "https://demo-stack.resomix.com",
            "https://bserver.resomix.com",
            "https://r-admin.resomix.com",
            "https://landing.resomix.com",
            # Have these here temporarily for development
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5175",
        ],
        description="Explicit allowed origins for production",
    )
    # Development: Allow localhost and common dev ports
    allowed_origins_development: List[str] = Field(
        default=[
            "http://localhost:5172",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
        ],
        description="Allowed origins for development",
    )

    # CORS Methods and Headers
    cors_allow_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        description="Allowed HTTP methods for CORS",
    )
    cors_allow_headers: List[str] = Field(
        default=["Authorization", "Content-Type", "X-Requested-With", "X-Api-Key"],
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
        description="Frontend URL for email verification/reset links",
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

    def __init__(self, **data):
        # Override with environment variables if they exist
        env_overrides = {}

        # Direct environment variable mappings (no prefix)
        direct_env_vars = {
            "MONGODB_URI": "mongodb_uri",
            "SIMILARITY_SERVER_URL": "similarity_server_url",
            "HETZNER_INTERNAL_API_KEY": "hetzner_internal_api_key",
            "REDIS_URL": "redis_url",
            "RESOMIX_SERVER_URL": "resomix_server_url",
            "DEMO_MODE": "demo_mode",
            "SERVICE_ACCOUNT_FILE": "service_account_file",
            "GOOGLE_SHEET_ID": "google_sheet_id",
            "FEEDBACK_WORKSHEET_NAME": "feedback_worksheet_name",
            "CONTACT_WORKSHEET_NAME": "contact_worksheet_name",
            "PREVIEW_FERNET_SECRET": "preview_fernet_secret",
            "PREVIEW_HMAC_SECRET": "preview_hmac_secret",
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
            "ES_URL": "es_url",
            "ES_USERNAME": "es_username",
            "ES_PASSWORD": "es_password",
            "ES_VERIFY_CERTS": "es_verify_certs",
            "ES_CA_CERTS": "es_ca_certs",
            "ES_REQUEST_TIMEOUT": "es_request_timeout",
            "ES_SEARCH_LIMIT": "es_search_limit",
            # JWT & Auth
            "JWT_SECRET_KEY": "jwt_secret_key",
            "JWT_ALGORITHM": "jwt_algorithm",
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "jwt_access_token_expire_minutes",
            "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "jwt_refresh_token_expire_days",
            "COOKIE_DOMAIN": "cookie_domain",
            "COOKIE_SECURE": "cookie_secure",
            "COOKIE_SAMESITE": "cookie_samesite",
            "SMTP_HOST": "smtp_host",
            "SMTP_PORT": "smtp_port",
            "SMTP_USER": "smtp_user",
            "SMTP_PASSWORD": "smtp_password",
            "SMTP_FROM_EMAIL": "smtp_from_email",
            "FRONTEND_URL": "frontend_url",
            # SCP Configuration
            "SCP_PRIVATE_KEY_PATH": "scp_private_key_path",
            "SCP_REMOTE_USER": "scp_remote_user",
            "SCP_REMOTE_HOST": "scp_remote_host",
            "SCP_REMOTE_PORT": "scp_remote_port",
            "SCP_REMOTE_DIR": "scp_remote_dir",
        }

        for env_key, config_key in direct_env_vars.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle integer conversion
                if config_key in [
                    "preview_audio_url_expires_seconds",
                    "hls_url_expires_seconds",
                    "es_request_timeout",
                    "es_search_limit",
                    "jwt_access_token_expire_minutes",
                    "jwt_refresh_token_expire_days",
                    "smtp_port",
                    "apple_token_ttl",
                ]:
                    try:
                        env_overrides[config_key] = int(env_value)
                    except ValueError:
                        pass
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
