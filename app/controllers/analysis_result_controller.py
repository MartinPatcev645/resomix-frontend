"""
Analysis Result Controller (consumer-facing)
============================================

Reads for the single-value analysis summary + minting the tokenized retrieval "boarding pass"
for the full cached JSON on the Hetzner served cache (see
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md`` §4-5).

Authorization: an analysis is owned by the uploading user (``user_id``) and may later be made
public (``is_public``). The token mint is the security boundary — Alwyzon signs a retrieval token
ONLY for the owner or a public analysis; the Hetzner node then enforces that the requested id
equals the id embedded in the token. We apply the same owner-or-public check to the summary read
so a per-id endpoint can't enumerate other users' analyses.

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.track_analysis_result import TrackAnalysisResult
from app.models.user import User
from app.services.track_analysis_result_service import TrackAnalysisResultService
from app.utils.edge_auth import generate_analysis_token
from app.utils.response_utils import format_response


def _client_ip(request: Request) -> str:
    """Resolve the originating client IP, honouring upstream proxy headers (token IP-lock)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class AnalysisResultController:
    def __init__(self) -> None:
        self.service = TrackAnalysisResultService()

    @staticmethod
    def _authorized(row: TrackAnalysisResult, current_user: Optional[User]) -> bool:
        """Owner (logged-in, ids match) or a public analysis may read/retrieve it."""
        if row.is_public:
            return True
        return bool(current_user and row.user_id and row.user_id == current_user.id)

    async def get_summary(
        self,
        db: AsyncSession,
        analysis_uuid: str,
        current_user: Optional[User],
    ) -> JSONResponse:
        """Return the single-value analysis summary (owner-or-public)."""
        row = await self.service.get_by_analysis_uuid(db, analysis_uuid)
        if row is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Analysis not found."),
            )
        if not self._authorized(row, current_user):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content=format_response(
                    success=False,
                    error="You don't have access to this analysis.",
                    reason="forbidden",
                ),
            )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=self.service.to_dict(row)),
        )

    async def mint_retrieval_token(
        self,
        db: AsyncSession,
        request: Request,
        analysis_uuid: str,
        current_user: Optional[User],
    ) -> JSONResponse:
        """Mint a short-lived retrieval token for the full cached JSON (owner-or-public).

        The token embeds this ``analysis_uuid`` + ``scope="analysis"`` + ip + exp; the frontend
        calls ``{hetzner_media_base}/analysis/{analysis_uuid}?token=…`` and Hetzner enforces the
        id match. Refusing to mint (not owner / not public) is what withholds access.
        """
        row = await self.service.get_by_analysis_uuid(db, analysis_uuid)
        if row is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content=format_response(success=False, error="Analysis not found."),
            )
        if not self._authorized(row, current_user):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content=format_response(
                    success=False,
                    error="You don't have access to this analysis.",
                    reason="forbidden",
                ),
            )

        token_data = generate_analysis_token(analysis_uuid, _client_ip(request))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={
                    "token": token_data["token"],
                    "expires_in": token_data["expires_in"],
                    "analysis_uuid": analysis_uuid,
                    "scope": "analysis",
                    # Frontend composes {hetzner_media_base}{retrieval_path}?token=<token>.
                    "retrieval_path": f"/analysis/{analysis_uuid}",
                },
            ),
        )
