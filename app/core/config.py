from typing import List, Optional
from pydantic import BaseModel, Field
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings(BaseModel):
    """Application configuration settings"""
    
    # API Configuration
    api_key_name: str = Field(default="api_key", description="API key parameter name")
    api_key: str = Field(
        default="bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ",
        description="API key for authentication (should be set via environment variable in production)"
    )
    
    # File handling configuration
    max_file_size: int = Field(default=100 * 1024 * 1024, description="Maximum file size in bytes (100MB)")
    temp_dir: str = Field(default="temp_audio", description="Temporary directory for uploaded files")
    
    # Similarity search configuration
    allowed_top_sk_values: List[int] = Field(
        default=[10, 20, 50, 100], 
        description="Allowed values for top_sk parameter"
    )
    allowed_duplication_thresholds: List[int] = Field(
        default=[2, 2, 4, 5], 
        description="Duplication thresholds corresponding to top_sk values"
    )
    default_top_sk: int = Field(default=20, description="Default top_sk value")
    
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
    
    # Environment-specific settings
    environment: str = Field(default="development", description="Current environment (development/production)")
    debug: bool = Field(default=True, description="Enable debug mode")

    def __init__(self, **data):
        # Override with environment variables if they exist
        env_overrides = {}
        
        # Check for environment variables with RESOMIX_ prefix
        for key in [
            "api_key", "temp_dir", "default_top_sk", "use_development_cors",
            "app_title", "app_description", "app_version", "environment", "debug"
        ]:
            env_key = f"RESOMIX_{key.upper()}"
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle boolean conversion
                if key in ["use_development_cors", "debug"]:
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
