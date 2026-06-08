"""
Partner and API Key Schemas
===========================

Pydantic models for partner management and API key issuance.
Provides request and response schemas for partner creation, 
API key generation, rotation, and revocation.

Version: 1.0.0
Date: May 09, 2026
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, EmailStr, model_validator
from enum import Enum

from app.schemas.common import APIResponse, PaginationResponse, PaginatedResponse


class PartnerTier(str, Enum):
    SANDBOX = "sandbox"
    STARTER = "starter"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"


class ServiceMode(str, Enum):
    """
    Storage/service plan, orthogonal to ``tier``.

    - ``similarity_only`` (case 1): store the preview MP3 + embeddings only.
      The preview is kept so peaks/segments can be regenerated if the partner
      later upgrades to playback.
    - ``similarity_playback`` (case 2): store embeddings + peaks + segments for
      full playback.
    """
    SIMILARITY_ONLY = "similarity_only"
    SIMILARITY_PLAYBACK = "similarity_playback"


# --- Partner Schemas ---

class PartnerCreateRequest(BaseModel):
    """Request payload to create a new partner/tenant."""
    legal_name: str = Field(..., min_length=2, max_length=255)
    display_name: str = Field(..., min_length=2, max_length=255)
    contact_email: EmailStr
    tier: PartnerTier = Field(default=PartnerTier.SANDBOX)
    service_mode: ServiceMode = Field(
        default=ServiceMode.SIMILARITY_ONLY,
        description="similarity_only (preview+embedding) | similarity_playback (embeddings+peaks+segments)",
    )
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    vat_number: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None


class PartnerBaseResponse(BaseModel):
    """Base partner fields for response."""
    id: int
    partner_uuid: str
    legal_name: str
    display_name: str
    contact_email: str
    tier: PartnerTier
    service_mode: ServiceMode = ServiceMode.SIMILARITY_ONLY
    is_active: bool
    onboarded_at: datetime
    country_code: Optional[str] = None
    vat_number: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PartnerUpdateRequest(BaseModel):
    """Payload to update an existing partner's details."""
    legal_name: Optional[str] = Field(None, min_length=2, max_length=255)
    display_name: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_email: Optional[EmailStr] = None
    tier: Optional[PartnerTier] = None
    service_mode: Optional[ServiceMode] = None
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    vat_number: Optional[str] = Field(None, max_length=64)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PartnerResponse(APIResponse):
    """Response wrapper for a single partner."""
    data: PartnerBaseResponse


class PartnerListResponse(PaginatedResponse):
    """Paginated list of partners."""
    data: List[PartnerBaseResponse]
    pagination: PaginationResponse


# --- API Key Schemas ---

class ApiKeyIssueRequest(BaseModel):
    """Request to issue a new API key."""
    partner_id: int
    label: str = Field(..., min_length=1, max_length=100, example="Production Key")
    scopes: List[str] = Field(default_factory=lambda: ["search:read"], example=["search:read", "ingest:write"])
    rate_limit_rps: int = Field(default=10, ge=1)
    rate_limit_monthly: int = Field(default=100000, ge=0)
    expires_at: Optional[datetime] = None


class ApiKeyIssueResponse(BaseModel):
    """Response returned ONLY at issuance containing the plaintext key."""
    key_prefix: str
    plaintext_key: str = Field(..., description="The full API key. This is the ONLY time it will be shown.")
    label: str
    scopes: List[str]
    expires_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class ApiKeyIssueSuccessResponse(APIResponse):
    """Response wrapper for API key issuance."""
    data: ApiKeyIssueResponse


class ApiKeyPublicDetail(BaseModel):
    """Publicly safe details of an API key (no hash, no plaintext)."""
    id: int
    partner_id: int
    key_prefix: str
    label: str
    scopes: List[str]
    rate_limit_rps: int
    rate_limit_monthly: int
    usage_count: int = 0  # Total calls in current billing month
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ApiKeyListResponse(APIResponse):
    """List of API keys for a partner."""
    data: List[ApiKeyPublicDetail]


class ApiKeyRevokeRequest(BaseModel):
    """Request to revoke an API key."""
    api_key_id: int
    reason: str = Field(..., min_length=5, max_length=255)


class ApiKeyRotateRequest(BaseModel):
    """Request to rotate an API key (revokes old, issues new)."""
    api_key_id: int
    label: Optional[str] = None


# --- SFTP Provisioning Schemas ---

class SftpProvisionRequest(BaseModel):
    """Request payload to provision SFTP access for a partner."""
    partner_id: int
    # Username is auto-derived from the partner UUID (``partner_<slug>``) by the
    # service layer. Admins no longer type it; if provided it is ignored.
    username: Optional[str] = Field(default=None, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8)
    use_public_key: bool = False
    public_key: Optional[str] = None
    allowed_ip: Optional[str] = None

    @model_validator(mode="after")
    def validate_public_key(self):
        if self.use_public_key and not self.public_key:
            raise ValueError("public_key is required when use_public_key is True")
        return self


class SftpProvisionResponse(BaseModel):
    """Response returned upon successful SFTP provisioning."""
    sftp_user_id: int
    partner_id: int
    username: str
    home_dir: str
    use_public_key: bool
    sftp_host: str
    sftp_port: int
    provisioned_at: datetime


class SftpStatusDetail(BaseModel):
    """SFTP status details matching frontend expectations."""
    provisioned: bool
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    last_provisioned_at: Optional[datetime] = None


class SftpStatusResponse(APIResponse):
    """Response returned for B2B Partner's SFTP status."""
    data: Optional[SftpStatusDetail] = None

