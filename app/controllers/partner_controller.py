"""
Partner Controller
==================

Handles HTTP requests for partner management and API key lifecycle.
Coordinates between the API layer and the PartnerService.

Version: 1.0.0
Date: May 09, 2026
"""

import logging
from typing import Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.exc import IntegrityError

from app.services.partner_service import PartnerService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User
from app.schemas.partner import (
    PartnerCreateRequest,
    PartnerUpdateRequest,
    PartnerBaseResponse,
    ApiKeyIssueRequest,
    ApiKeyIssueResponse,
    ApiKeyPublicDetail,
    ApiKeyRevokeRequest,
    ApiKeyRotateRequest,
    SftpProvisionRequest,
    SftpProvisionResponse,
    SftpStatusResponse,
)
from app.utils.response_utils import format_response
from app.services.sftp_service import SftpService
from app.core.config import settings
from app.repositories.sftp_user_repository import sftp_user_repo

logger = logging.getLogger(__name__)


class PartnerController:
    """Controller for partner-related endpoints."""

    def __init__(self):
        self.partner_service = PartnerService()
        self.admin_log_service = AdminOperationLogService()
        self.sftp_service = SftpService()

    async def create_partner(
        self, db: AsyncSession, request: Request, payload: PartnerCreateRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Create a new partner."""
        try:
            partner = await self.partner_service.create_partner(db, payload)
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.create",
                    target_type="partner",
                    target_id=str(partner.id),
                    before_state=None,
                    after_state=payload.model_dump(),
                    ip_address=request.client.host if request and request.client else None
                )
            await db.commit()
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=PartnerBaseResponse.model_validate(partner).model_dump(),
                )),
            )
        except IntegrityError:
            await db.rollback()
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=jsonable_encoder(format_response(
                    success=False, error="Partner with this email already exists"
                )),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create partner: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to create partner"
                )),
            )

    async def get_partner(self, db: AsyncSession, partner_id: int) -> JSONResponse:
        """Get a single partner by ID."""
        try:
            partner = await self.partner_service.get_partner(db, partner_id)
            if not partner:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=jsonable_encoder(format_response(success=False, error="Partner not found")),
                )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=PartnerBaseResponse.model_validate(partner).model_dump(),
                )),
            )
        except Exception as e:
            logger.error(f"Failed to get partner: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to get partner")),
            )

    async def update_partner(
        self, db: AsyncSession, request: Request, partner_id: int, payload: PartnerUpdateRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Update an existing partner."""
        try:
            partner = await self.partner_service.update_partner(db, partner_id, payload)
            if not partner:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=jsonable_encoder(format_response(success=False, error="Partner not found")),
                )
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.update",
                    target_type="partner",
                    target_id=str(partner_id),
                    before_state=None,
                    after_state=payload.model_dump(exclude_unset=True),
                    ip_address=request.client.host if request and request.client else None
                )
            await db.commit()
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=PartnerBaseResponse.model_validate(partner).model_dump(),
                )),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update partner: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to update partner")),
            )

    async def delete_partner(self, db: AsyncSession, request: Request, partner_id: int, current_admin: Optional[User] = None) -> JSONResponse:
        """Delete a partner."""
        try:
            success = await self.partner_service.delete_partner(db, partner_id)
            if success:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="partner.delete",
                        target_type="partner",
                        target_id=str(partner_id),
                        before_state=None,
                        after_state=None,
                        ip_address=request.client.host if request and request.client else None
                    )
                await db.commit()
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=jsonable_encoder(format_response(
                        success=True, message="Partner successfully deleted"
                    )),
                )
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error="Partner not found")),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete partner: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to delete partner")),
            )

    async def list_partners(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        tier: str = None,
        is_active: bool = None,
        current_admin: Optional[User] = None,
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
                        "total": total,
                        "pages": total_pages,
                        "page": page,
                        "size": page_size,
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
        self, db: AsyncSession, request: Request, payload: ApiKeyIssueRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Issue a new API key."""
        try:
            api_key, plaintext = await self.partner_service.issue_api_key(db, payload)
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.issue_api_key",
                    target_type="api_key",
                    target_id=api_key.key_prefix,
                    before_state=None,
                    after_state={"partner_id": payload.partner_id, "label": payload.label},
                    ip_address=request.client.host if request and request.client else None
                )

            await db.commit()
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
            await db.rollback()
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except Exception as e:
            await db.rollback()
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
        self, db: AsyncSession, request: Request, payload: ApiKeyRevokeRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Revoke an API key."""
        # This one doesn't return data, so it's fine
        try:
            success = await self.partner_service.revoke_api_key(
                db, payload.api_key_id, payload.reason
            )
            if success:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="partner.revoke_api_key",
                        target_type="api_key",
                        target_id=str(payload.api_key_id),
                        before_state=None,
                        after_state={"reason": payload.reason},
                        ip_address=request.client.host if request and request.client else None
                    )
                await db.commit()
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
            await db.rollback()
            logger.error(f"Failed to revoke API key: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to revoke API key"
                )),
            )

    async def rotate_api_key(
        self, db: AsyncSession, request: Request, payload: ApiKeyRotateRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Rotate an API key."""
        try:
            api_key, plaintext = await self.partner_service.rotate_api_key(db, payload)
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.rotate_api_key",
                    target_type="api_key",
                    target_id=api_key.key_prefix,
                    before_state=None,
                    after_state={"api_key_id": payload.api_key_id},
                    ip_address=request.client.host if request and request.client else None
                )

            response_data = ApiKeyIssueResponse(
                key_prefix=api_key.key_prefix,
                plaintext_key=plaintext,
                label=api_key.label,
                scopes=api_key.scopes,
                expires_at=api_key.expires_at
            )

            await db.commit()
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(
                    success=True,
                    data=response_data.model_dump(),
                    message="API key rotated successfully. Old key is now revoked.",
                )),
            )
        except ValueError as e:
            await db.rollback()
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to rotate API key: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(
                    success=False, error="Failed to rotate API key"
                )),
            )

    async def provision_partner_sftp(
        self, db: AsyncSession, request: Request, payload: SftpProvisionRequest, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Provision SFTP access for a partner."""
        try:
            sftp_user = await self.sftp_service.provision_partner_sftp(db, payload)
            
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.sftp_provision",
                    target_type="sftp_user",
                    target_id=str(sftp_user.id),
                    before_state=None,
                    after_state={"partner_id": payload.partner_id, "username": payload.username},
                    ip_address=request.client.host if request and request.client else None
                )
            
            await db.commit()
            
            response_data = SftpProvisionResponse(
                sftp_user_id=sftp_user.id,
                partner_id=sftp_user.partner_id,
                username=sftp_user.username,
                home_dir=sftp_user.sftp_home_dir,
                use_public_key=sftp_user.use_public_key,
                sftp_host=settings.sftp_server_host,
                sftp_port=settings.sftp_server_port,
                provisioned_at=sftp_user.sftp_provisioned_at
            )
            
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=jsonable_encoder(format_response(success=True, data=response_data.model_dump())),
            )
            
        except ValueError as e:
            await db.rollback()
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except RuntimeError as e:
            # Important: We DO NOT rollback here. The MariaDB record is saved intentionally.
            await db.commit()
            return JSONResponse(
                status_code=status.HTTP_502_BAD_GATEWAY,
                content=jsonable_encoder(format_response(
                    success=False, 
                    error="Account saved locally, but SFTP is not yet active on Hetzner. Please retry provisioning later.",
                    details=str(e)
                )),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to provision partner SFTP: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to provision SFTP access")),
            )

    async def get_partner_sftp_status(
        self, db: AsyncSession, partner_id: int
    ) -> JSONResponse:
        """Get SFTP status for a partner."""
        try:
            sftp_user = await sftp_user_repo.get_by_partner_id(db, partner_id)
            if not sftp_user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=jsonable_encoder(format_response(success=False, error="SFTP access not provisioned for this partner")),
                )
                
            response_data = SftpStatusResponse(
                sftp_user_id=sftp_user.id,
                username=sftp_user.username,
                is_active=sftp_user.is_active,
                use_public_key=sftp_user.use_public_key,
                has_allowed_ip=bool(sftp_user.allowed_ip),
                sftp_provisioned_at=sftp_user.sftp_provisioned_at,
                home_dir=sftp_user.sftp_home_dir
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(format_response(success=True, data=response_data.model_dump())),
            )
        except Exception as e:
            logger.error(f"Failed to get partner SFTP status: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to retrieve SFTP status")),
            )

    async def retry_partner_sftp(
        self, db: AsyncSession, request: Request, partner_id: int, current_admin: Optional[User] = None
    ) -> JSONResponse:
        """Retry Hetzner provisioning for a partner."""
        try:
            sftp_user = await self.sftp_service.retry_provisioning(db, partner_id)
            
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.sftp_retry",
                    target_type="sftp_user",
                    target_id=str(sftp_user.id),
                    before_state=None,
                    after_state={"partner_id": partner_id},
                    ip_address=request.client.host if request and request.client else None
                )
                
            await db.commit()
            
            response_data = SftpStatusResponse(
                sftp_user_id=sftp_user.id,
                username=sftp_user.username,
                is_active=sftp_user.is_active,
                use_public_key=sftp_user.use_public_key,
                has_allowed_ip=bool(sftp_user.allowed_ip),
                sftp_provisioned_at=sftp_user.sftp_provisioned_at,
                home_dir=sftp_user.sftp_home_dir
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(format_response(success=True, data=response_data.model_dump())),
            )
            
        except ValueError as e:
            await db.rollback()
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=jsonable_encoder(format_response(success=False, error=str(e))),
            )
        except RuntimeError as e:
            await db.commit() # Keep the DB state
            return JSONResponse(
                status_code=status.HTTP_502_BAD_GATEWAY,
                content=jsonable_encoder(format_response(
                    success=False, 
                    error="SFTP is still not active on Hetzner. Please retry provisioning later.",
                    details=str(e)
                )),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to retry partner SFTP: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder(format_response(success=False, error="Failed to retry SFTP provisioning")),
            )
