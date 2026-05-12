"""
Admin Similarity Router
=======================

This module defines the admin-only endpoints for managing the similarity system,
such as triggering FAISS index rebuilds on the external similarity server.

Version: 1.0.0
Date: May 12, 2026
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from app.api.dependencies.auth import get_api_key
from app.services.similarity_service import SimilarityService

router = APIRouter(prefix="/similarity", tags=["admin-similarity"])
similarity_service = SimilarityService()

@router.post(
    "/rebuild-index",
    summary="Rebuild FAISS Indexes",
    description="Trigger a rebuild of FAISS indexes on the Hetzner similarity server. Can be scoped to a single partner.",
    status_code=status.HTTP_202_ACCEPTED
)
async def rebuild_similarity_index(
    partner_id: Optional[int] = Query(None, description="Partner ID to rebuild index for. If omitted, rebuilds all."),
    api_key: str = Depends(get_api_key)
):
    """
    Trigger a rebuild of FAISS indexes on the Hetzner similarity server.
    
    This call is delegated to the external similarity microservice.
    """
    result = await similarity_service.rebuild_faiss_indexes(partner_id=partner_id)
    
    # Check for success in the delegated response
    if result.get("status") == "success" or result.get("success") is True:
        return result
        
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=result.get("message") or result.get("error") or "Failed to trigger index rebuild"
    )
