"""
Admin Promo Router
==================

Administrative endpoints for managing promo codes.
Hardened with RBAC and audit logging.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import require_admin, require_permission
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
    request: Request,
    payload: PromoCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("promo:manage"))
):
    """
    Create a new promo code synced with Stripe.
    Only accessible by administrators with manage permission.
    """
    return await admin_controller.create_promo_code(db, request, payload.dict(), current_admin=current_admin)
