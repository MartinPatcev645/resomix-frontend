"""
Admin Similarity Router
=======================

This module defines the admin-only endpoints for managing the similarity system.
Hardened with RBAC and audit logging.

Version: 1.1.0
Date: May 16, 2026
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from typing import Optional
from app.api.dependencies.auth import require_admin, require_permission
from app.services.similarity_service import SimilarityService
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User

router = APIRouter(prefix="/similarity", tags=["admin-similarity"])
similarity_service = SimilarityService()
admin_log_service = AdminOperationLogService()

@router.post(
    "/rebuild-index",
    summary="Rebuild FAISS Indexes",
    description="Trigger a rebuild of FAISS indexes on the Hetzner similarity server.",
    status_code=status.HTTP_202_ACCEPTED
)
async def rebuild_similarity_index(
    request: Request,
    partner_id: Optional[int] = Query(None, description="Partner ID to rebuild index for."),
    db = Depends(lambda: None), # Dependency placeholder if needed, usually we use get_database_session
    current_admin: User = Depends(require_admin),
    _: User = Depends(require_permission("similarity:manage"))
):
    """Trigger a rebuild of FAISS indexes."""
    # We need a DB session for logging, but similarity_service might not need it for this call.
    # However, require_admin and require_permission already handle session injection if needed.
    # To log, we'll need a session.
    from app.api.dependencies.database import get_database_session
    async for db in get_database_session():
        result = await similarity_service.rebuild_faiss_indexes(partner_id=partner_id)
        
        if result.get("status") == "success" or result.get("success") is True:
            await admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="similarity.rebuild_index",
                target_type="system",
                target_id="faiss_index",
                before_state=None,
                after_state={"partner_id": partner_id},
                ip_address=request.client.host if request and request.client else None
            )
            return result
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("message") or result.get("error") or "Failed to trigger index rebuild"
        )
