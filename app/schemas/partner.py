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
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from enum import Enum

from app.schemas.common import APIResponse, PaginationResponse, PaginatedResponse


class PartnerTier(str, Enum):
    SANDBOX = "sandbox"
    STARTER = "starter"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"


# --- Partner Schemas ---

class PartnerCreateRequest(BaseModel):
    """Request payload to create a new partner/tenant."""
    legal_name: str = Field(..., min_length=2, max_length=255)
    display_name: str = Field(..., min_length=2, max_length=255)
    contact_email: EmailStr
    tier: PartnerTier = Field(default=PartnerTier.SANDBOX)
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
    is_active: bool
    onboarded_at: datetime
    country_code: Optional[str] = None
    vat_number: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


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
