"""
Admin Similarity Router
=======================

This module defines the admin-only endpoints for managing the similarity system.
Hardened with RBAC and audit logging.

Version: 1.2.0
Date: June 8, 2026
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from app.api.dependencies.auth import require_admin, require_permission
from app.services.hetzner_service import HetznerService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User

router = APIRouter(prefix="/admin/similarity", tags=["admin-similarity"])
hetzner_service = HetznerService()
admin_log_service = AdminOperationLogService()


@router.post(
    "/rebuild-index",
    summary="Rebuild FAISS Indexes",
    description=(
        "Trigger a rebuild of both FAISS similarity indexes on the Hetzner similarity server "
        "for the specified partner. Both engines are rebuilt in sequence."
    ),
    status_code=status.HTTP_202_ACCEPTED,
)
async def rebuild_similarity_index(
    request: Request,
    partner_id: int = Query(..., description="Partner ID whose FAISS indexes should be rebuilt (required)."),
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("similarity:manage")),
):
    """Trigger a rebuild of both FAISS similarity indexes for a specific partner."""
    from app.api.dependencies.database import get_database_session

    result = await hetzner_service.rebuild_index(partner_id=partner_id)

    async for db in get_database_session():
        if result.get("success") is True:
            await admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="similarity.rebuild_index",
                target_type="partner",
                target_id=str(partner_id),
                before_state=None,
                after_state={"partner_id": partner_id, "engines": list(result.get("engines", {}).keys())},
                ip_address=request.client.host if request and request.client else None,
            )
            await db.commit()
            return result

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error") or "Failed to trigger index rebuild",
        )
