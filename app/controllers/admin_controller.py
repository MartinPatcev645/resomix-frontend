"""
Admin Controller
================

This controller handles administrative operations including promo code management.
"""

import stripe
import logging
from typing import Dict, Any
from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.cart_repository import CartRepository
from app.utils.response_utils import format_response
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User
from typing import Optional

logger = logging.getLogger(__name__)

class AdminController:
    def __init__(self):
        self.cart_repo = CartRepository()
        self.admin_log_service = AdminOperationLogService()
        stripe.api_key = settings.stripe_secret_key

    async def create_promo_code(
        self, db: AsyncSession, request: Request, payload: Dict[str, Any], current_admin: Optional[User] = None
    ) -> JSONResponse:
        """
        Phase 6: Promo Code Sync
        Creates a discount code natively in Stripe and saves it to the local DB.
        """
        code = payload.get("code")
        discount_type = payload.get("discount_type") # percentage or fixed_amount
        discount_value = payload.get("discount_value")
        expires_at = payload.get("expires_at")
        max_uses = payload.get("max_uses")

        if not code or not discount_value:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=format_response(success=False, error="Missing required fields: code, discount_value")
            )

        try:
            # 1. Create Coupon in Stripe
            coupon_args = {
                "name": f"Resomix Promo: {code}",
                "duration": "forever"
            }
            if discount_type == "percentage":
                coupon_args["percent_off"] = discount_value
            else:
                coupon_args["amount_off"] = discount_value
                coupon_args["currency"] = "usd"

            stripe_coupon = stripe.Coupon.create(**coupon_args)

            # 2. Create Promotion Code in Stripe
            stripe_promo = stripe.PromotionCode.create(
                coupon=stripe_coupon.id,
                code=code,
                expires_at=int(expires_at.timestamp()) if expires_at else None,
                max_redemptions=max_uses
            )

            # 3. Save to Local DB
            promo_data = {
                "code": code,
                "discount_type": discount_type,
                "discount_value": discount_value,
                "max_uses": max_uses,
                "expires_at": expires_at,
                "stripe_coupon_id": stripe_coupon.id,
                "stripe_promo_code_id": stripe_promo.id,
                "is_active": True
            }
            
            promo = await self.cart_repo.async_create_promo_code(db, promo_data)
            await db.commit()

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="promo.create",
                    target_type="promo",
                    target_id=str(promo.id),
                    before_state=None,
                    after_state=payload,
                    ip_address=request.client.host if request and request.client else None
                )

            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=format_response(
                    success=True,
                    data={
                        "id": promo.id,
                        "code": promo.code,
                        "stripe_coupon_id": promo.stripe_coupon_id,
                        "stripe_promo_code_id": promo.stripe_promo_code_id
                    }
                )
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create promo code: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to create promo code: {str(e)}")
            )
