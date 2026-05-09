"""
Partner Service
===============

Business logic for partner management and API key lifecycle.
Handles partner creation, API key generation (hashing), rotation, and revocation.

Version: 1.0.0
Date: May 09, 2026
"""

import secrets
import hashlib
import uuid
import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.partner_repository import PartnerRepository, PartnerApiKeyRepository
from app.models.partner import Partner, PartnerApiKey
from app.schemas.partner import (
    PartnerCreateRequest, 
    ApiKeyIssueRequest, 
    ApiKeyRotateRequest
)
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)


class PartnerService:
    """Service for handling partner and API key business logic."""

    def __init__(self):
        self.partner_repo = PartnerRepository()
        self.api_key_repo = PartnerApiKeyRepository()
        self.logging_service = LoggingService()

    def generate_api_key(self, tier: str = "sandbox") -> Tuple[str, str, str]:
        """
        Generate a new high-entropy API key.
        
        Returns:
            Tuple of (plaintext_key, key_hash, key_prefix)
        """
        # Format: rmx_<tier>_<32chars>
        raw_token = secrets.token_urlsafe(32)
        plaintext_key = f"rmx_{tier}_{raw_token}"
        
        # SHA-256 for secure storage
        key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()
        
        # Prefix for identification (first 16 chars of full key)
        # e.g. rmx_live_abcdef12
        key_prefix = plaintext_key[:16]
        
        return plaintext_key, key_hash, key_prefix

    async def create_partner(self, db: AsyncSession, request: PartnerCreateRequest) -> Partner:
        """Create a new partner tenant."""
        partner_data = request.model_dump()
        partner_data["partner_uuid"] = str(uuid.uuid4())
        
        partner = await self.partner_repo.async_create(db, **partner_data)
        
        self.logging_service.log(
            async_db=db,
            category="PARTNER",
            action="CREATE",
            message=f"Partner created: {partner.display_name} ({partner.partner_uuid})",
            metadata={"partner_id": partner.id, "tier": partner.tier}
        )
        
        return partner

    async def list_partners(
        self, 
        db: AsyncSession, 
        page: int = 1, 
        page_size: int = 50,
        tier: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Tuple[List[Partner], int]:
        """List partners with pagination."""
        skip = (page - 1) * page_size
        return await self.partner_repo.async_list_partners(db, skip, page_size, tier, is_active)

    async def issue_api_key(self, db: AsyncSession, request: ApiKeyIssueRequest) -> Tuple[PartnerApiKey, str]:
        """Issue a new API key for a partner."""
        partner = await self.partner_repo.async_get_by_id(db, request.partner_id)
        if not partner:
            raise ValueError(f"Partner with ID {request.partner_id} not found")

        plaintext, key_hash, prefix = self.generate_api_key(partner.tier)
        
        key_data = {
            "partner_id": partner.id,
            "key_prefix": prefix,
            "key_hash": key_hash,
            "label": request.label,
            "scopes": request.scopes,
            "rate_limit_rps": request.rate_limit_rps,
            "rate_limit_monthly": request.rate_limit_monthly,
            "expires_at": request.expires_at,
            "is_active": True
        }
        
        api_key = await self.api_key_repo.async_create(db, **key_data)
        
        self.logging_service.log(
            async_db=db,
            category="PARTNER",
            action="API_KEY_ISSUE",
            message=f"API key issued for partner {partner.id}: {prefix}...",
            metadata={"partner_id": partner.id, "api_key_id": api_key.id, "label": request.label}
        )
        
        return api_key, plaintext

    async def list_api_keys(self, db: AsyncSession, partner_id: int) -> List[PartnerApiKey]:
        """List all keys for a partner."""
        return await self.api_key_repo.async_list_keys_for_partner(db, partner_id)

    async def revoke_api_key(self, db: AsyncSession, api_key_id: int, reason: str) -> bool:
        """Revoke an API key."""
        api_key = await self.api_key_repo.async_revoke_key(db, api_key_id, reason)
        if api_key:
            self.logging_service.log(
                async_db=db,
                category="PARTNER",
                action="API_KEY_REVOKE",
                message=f"API key revoked: {api_key.key_prefix}...",
                metadata={"partner_id": api_key.partner_id, "api_key_id": api_key.id, "reason": reason}
            )
            return True
        return False

    async def rotate_api_key(self, db: AsyncSession, request: ApiKeyRotateRequest) -> Tuple[PartnerApiKey, str]:
        """
        Rotate an API key: Revoke old one and issue a new one with same config.
        Executed in a single transaction.
        """
        old_key = await self.api_key_repo.async_get_by_id(db, request.api_key_id)
        if not old_key:
            raise ValueError(f"API key with ID {request.api_key_id} not found")
        
        if not old_key.is_active:
            raise ValueError(f"Cannot rotate an inactive or already revoked API key (ID: {old_key.id})")
        
        # 1. Revoke old key
        await self.api_key_repo.async_revoke_key(db, old_key.id, "Rotated by admin")
        
        # 2. Issue new key with same parameters
        issue_request = ApiKeyIssueRequest(
            partner_id=old_key.partner_id,
            label=request.label or old_key.label,
            scopes=old_key.scopes,
            rate_limit_rps=old_key.rate_limit_rps,
            rate_limit_monthly=old_key.rate_limit_monthly,
            expires_at=old_key.expires_at
        )
        
        return await self.issue_api_key(db, issue_request)
