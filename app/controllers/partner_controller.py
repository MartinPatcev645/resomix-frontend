"""
Partner Controller
==================

Handles HTTP requests for partner management and API key lifecycle.
Coordinates between the API layer and the PartnerService.

Version: 1.0.0
Date: May 09, 2026
"""

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.exc import IntegrityError

from app.services.partner_service import PartnerService
from app.schemas.partner import (
    PartnerCreateRequest,
    PartnerBaseResponse,
    ApiKeyIssueRequest,
    ApiKeyIssueResponse,
    ApiKeyPublicDetail,
    ApiKeyRevokeRequest,
    ApiKeyRotateRequest,
)
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)


class PartnerController:
    """Controller for partner-related endpoints."""

    def __init__(self):
        self.partner_service = PartnerService()

    async def create_partner(
        self, db: AsyncSession, request: Request, payload: PartnerCreateRequest
    ) -> JSONResponse:
        """Create a new partner."""
        try:
            partner = await self.partner_service.create_partner(db, payload)
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=PartnerBaseResponse.model_validate(partner).model_dump(),
                )),
            )
        except IntegrityError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=jsonable_encoder(format_response(
                    success=False, error="Partner with this email already exists"
                )),
            )
        except Exception as e:
            logger.error(f"Failed to create partner: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to create partner"
                )),
            )

    async def list_partners(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        tier: str = None,
        is_active: bool = None,
    ) -> JSONResponse:
        """List partners."""
        try:
            partners, total = await self.partner_service.list_partners(
                db, page, page_size, tier, is_active
            )
            total_pages = (total + page_size - 1) // page_size

            # Serialize partners list
            serialized_partners = [
                PartnerBaseResponse.model_validate(p).model_dump() for p in partners
            ]

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder({
                    "success": True,
                    "data": serialized_partners,
                    "pagination": {
                        "total_count": total,
                        "total_pages": total_pages,
                        "current_page": page,
                        "page_size": page_size,
                        "has_next": page < total_pages,
                        "has_prev": page > 1,
                    },
                }),
            )
        except Exception as e:
            logger.error(f"Failed to list partners: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to list partners")),
            )

    async def issue_api_key(
        self, db: AsyncSession, payload: ApiKeyIssueRequest
    ) -> JSONResponse:
        """Issue a new API key."""
        try:
            api_key, plaintext = await self.partner_service.issue_api_key(db, payload)

            # Use specific response schema that includes plaintext
            response_data = ApiKeyIssueResponse(
                key_prefix=api_key.key_prefix,
                plaintext_key=plaintext,
                label=api_key.label,
                scopes=api_key.scopes,
                expires_at=api_key.expires_at
            )

            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(success=True, data=response_data.model_dump())),
            )
        except ValueError as e:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except Exception as e:
            logger.error(f"Failed to issue API key: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to issue API key")),
            )

    async def list_api_keys(self, db: AsyncSession, partner_id: int) -> JSONResponse:
        """List API keys for a partner."""
        try:
            keys = await self.partner_service.list_api_keys(db, partner_id)
            serialized_keys = [
                ApiKeyPublicDetail.model_validate(k).model_dump() for k in keys
            ]

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(format_response(success=True, data=serialized_keys)),
            )
        except Exception as e:
            logger.error(f"Failed to list API keys: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to list API keys")),
            )

    async def revoke_api_key(
        self, db: AsyncSession, payload: ApiKeyRevokeRequest
    ) -> JSONResponse:
        """Revoke an API key."""
        # This one doesn't return data, so it's fine
        try:
            success = await self.partner_service.revoke_api_key(
                db, payload.api_key_id, payload.reason
            )
            if success:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=jsonable_encoder(format_response(
                        success=True, message="API key successfully revoked"
                    )),
                )
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error="API key not found")),
            )
        except Exception as e:
            logger.error(f"Failed to revoke API key: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to revoke API key"
                )),
            )

    async def rotate_api_key(
        self, db: AsyncSession, payload: ApiKeyRotateRequest
    ) -> JSONResponse:
        """Rotate an API key."""
        try:
            api_key, plaintext = await self.partner_service.rotate_api_key(db, payload)

            response_data = ApiKeyIssueResponse(
                key_prefix=api_key.key_prefix,
                plaintext_key=plaintext,
                label=api_key.label,
                scopes=api_key.scopes,
                expires_at=api_key.expires_at
            )

            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=response_data.model_dump(),
                    message="API key rotated successfully. Old key is now revoked.",
                )),
            )
        except ValueError as e:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except Exception as e:
            logger.error(f"Failed to rotate API key: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to rotate API key"
                )),
            )
