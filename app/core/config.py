"""
Application Configuration
=========================

This module defines the application configuration settings for the ResomiX API.
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
        description="API key for authentication (should be set via environment variable in production)"
    )
    
    # Security Configuration (URL Signing)
    preview_fernet_secret: str = Field(
        default="default-fernet-secret-32bytes-long",
        description="Fernet encryption secret for preview URL signing (must be 32 bytes)"
    )
    preview_hmac_secret: str = Field(
        default="default-hmac-secret-for-preview-urls",
        description="HMAC secret for preview URL signing"
    )
    preview_audio_url_expires_seconds: int = Field(
        default=300,
        description="Preview URL expiration time in seconds (default: 5 minutes)"
    )
    
    # Database Configuration
    mongodb_uri: Optional[str] = Field(
        default=None,
        description="MongoDB connection URI"
    )
    
    # External Services
    similarity_server_url: Optional[str] = Field(
        default=None,
        description="URL of the similarity microservice"
    )
    resomix_server_url: str = Field(
        default="http://localhost:8000",
        description="URL of the ResomiX server"
    )
    
    # Google Sheets Configuration
    service_account_file: Optional[str] = Field(
        default=None,
        description="Path to Google service account JSON file"
    )
    google_sheet_id: Optional[str] = Field(
        default=None,
        description="Google Sheet ID for feedback/contact forms"
    )
    feedback_worksheet_name: str = Field(
        default="Feedback",
        description="Name of the feedback worksheet"
    )
    contact_worksheet_name: str = Field(
        default="ContactSubmissions",
        description="Name of the contact submissions worksheet"
    )
    
    # Spotify Configuration
    spotify_client_id: Optional[str] = Field(
        default=None,
        description="Spotify client ID for API access"
    )
    spotify_client_secret: Optional[str] = Field(
        default=None,
        description="Spotify client secret for API access"
    )
    
    # Tidal Configuration
    tidal_client_id: Optional[str] = Field(
        default=None,
        description="Tidal client ID for API access"
    )
    tidal_client_secret: Optional[str] = Field(
        default=None,
        description="Tidal client secret for API access"
    )
    
    # Preview Service Configuration
    # Note: Only URL generation is handled, no actual downloading
    
    # File handling configuration
    max_file_size: int = Field(default=100 * 1024 * 1024, description="Maximum file size in bytes (100MB)")
    temp_dir: str = Field(default="temp_audio", description="Temporary directory for uploaded files")
    
    # Similarity search configuration
    allowed_top_sk_values: List[int] = Field(
        default=[10, 20, 50, 100], 
        description="Allowed values for top_sk parameter"
    )
    allowed_duplication_thresholds: List[int] = Field(
        default=[15, 30, 75, 150], 
        description="Duplication thresholds corresponding to top_sk values"
    )
    default_top_sk: int = Field(default=20, description="Default top_sk value")
    default_similarity_playlist_max_artists: int = Field(default=3, description="Default maximum number of artists to consider for playlist names")
    
    # Title filtering configuration
    title_removal_strings: List[str] = Field(
        default=["(Original Mix)"],
        description="Strings to remove from track titles (case-insensitive)"
    )
    title_stopper_strings: List[str] = Field(
        default=["https:", "www.", "_www.", "VINYL ONLY"],
        description="Strings that stop title processing - keep only the part before these"
    )
    
    # Meta filtering configuration
    meta_stopper_strings: List[str] = Field(
        default=["https:", "www.", "_www."],
        description="Strings that stop meta field processing - keep only the part before these (case-insensitive)"
    )
    meta_stopper_regex: str = Field(
        default=r"^(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:/[^\s]*)?)$",
        description="Regex pattern to match URLs and domains in meta fields - if matched, the entire meta field is removed"
    )
    
    # CORS Configuration
    allowed_origin_regex_production: str = Field(
        default=r"^https://([\w\-]+\.)*resomix\.com(:[0-9]+)?$",
        description="CORS regex for production (HTTPS resomix.com domains only)"
    )
    allowed_origin_regex_development: str = Field(
        default=r"^https?://.*",
        description="CORS regex for development (allows any origin)"
    )
    use_development_cors: bool = Field(
        default=True, 
        description="Whether to use development CORS settings"
    )
    
    # App metadata
    app_title: str = Field(default="Resomix API", description="FastAPI application title")
    app_description: str = Field(
        default="API for audio similarity search, track information, and metadata extraction",
        description="FastAPI application description"
    )
    app_version: str = Field(default="1.0.1", description="FastAPI application version")

    def __init__(self, **data):
        # Override with environment variables if they exist
        env_overrides = {}
        
        # Direct environment variable mappings (no prefix)
        direct_env_vars = {
            "MONGODB_URI": "mongodb_uri",
            "SIMILARITY_SERVER_URL": "similarity_server_url",
            "RESOMIX_SERVER_URL": "resomix_server_url",
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
        }
        
        for env_key, config_key in direct_env_vars.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle integer conversion
                if config_key in ["preview_audio_url_expires_seconds"]:
                    try:
                        env_overrides[config_key] = int(env_value)
                    except ValueError:
                        pass
                else:
                    env_overrides[config_key] = env_value
        
        # Check for environment variables with RESOMIX_ prefix (legacy support)
        for key in [
            "api_key", "temp_dir", "default_top_sk", "use_development_cors",
            "app_title", "app_description", "app_version"
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
    def current_origin_regex(self) -> str:
        """Get the current CORS origin regex based on environment settings"""
        return (
            self.allowed_origin_regex_development 
            if self.use_development_cors 
            else self.allowed_origin_regex_production
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
