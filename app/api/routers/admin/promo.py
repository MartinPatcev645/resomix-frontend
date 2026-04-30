"""
Admin Promo Router
==================

Administrative endpoints for managing promo codes.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user
from app.controllers.admin_controller import AdminController
from app.models.user import User

router = APIRouter(prefix="/admin/promo", tags=["admin-promo"])
admin_controller = AdminController()

class PromoCreateRequest(BaseModel):
    code: str
    discount_type: str # percentage or fixed_amount
    discount_value: int
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None

@router.post("/create")
async def create_promo(
    payload: PromoCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new promo code synced with Stripe.
    Only accessible by administrators (RBAC check should be here).
    """
    # TODO: Add explicit admin RBAC check
    return await admin_controller.create_promo_code(db, payload.dict())
