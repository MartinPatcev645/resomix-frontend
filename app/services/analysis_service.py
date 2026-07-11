"""
Analysis Service (client)
=========================

Thin async client Alwyzon uses to talk to the analysis microservice, which runs on the
Hetzner box. Alwyzon is the ONLY caller: it presents a shared ``X-Internal-Key`` so the
service rejects direct browser uploads. This mirrors ``SimilarityService``'s HTTP-call
pattern (base URL from settings, structured error envelope, best-effort).

Alwyzon OWNS the analysis id — it mints the UUID and passes it on create, so the result
caches under an id Alwyzon already stored against the track (later used to authorize
tokenized retrieval from the Hetzner served cache). See
``docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md``.

Leave ``settings.analysis_server_url`` UNSET until the service is deployed: ``is_configured``
is then False and every call short-circuits with a structured "not configured" error, so the
upload flow simply skips analysis (similarity still works) until the public IP is plugged in.

Version: 1.0.0
Init Date: July 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Job states from the analysis service's polling contract (schemas.enums.JobState).
_STATE_SUCCEEDED = "succeeded"
_STATE_FAILED = "failed"


class AnalysisService:
    """Async HTTP client for the external analysis microservice."""

    def __init__(self) -> None:
        # Read from centralized settings (env already loaded & normalized there).
        self.base_url: Optional[str] = settings.analysis_server_url
        self.internal_api_key: Optional[str] = settings.analysis_internal_api_key

    @property
    def is_configured(self) -> bool:
        """True once the analysis server URL is set (i.e. the service is deployed/plugged in)."""
        return bool(self.base_url)

    @staticmethod
    def new_analysis_id() -> str:
        """Mint an Alwyzon-owned analysis id (uuid4 hex — matches the service's id validator)."""
        return uuid.uuid4().hex

    def _headers(self) -> Dict[str, str]:
        headers = {"Origin": settings.resomix_server_url}
        if self.internal_api_key:
            headers["X-Internal-Key"] = self.internal_api_key
        return headers

    # ------------------------------------------------------------------ #
    # API surface (mirrors the analysis service's /v1/analyses contract)
    # ------------------------------------------------------------------ #
    async def create_analysis(
        self,
        *,
        audio_bytes: bytes,
        original_filename: str,
        analysis_id: str,
    ) -> Dict[str, Any]:
        """Enqueue an analysis for ``audio_bytes`` under the caller-owned ``analysis_id``.

        Returns the service's create response (``{analysis_id, status_url, ...}``) or a
        structured ``{"status": "error", "message": ...}``.
        """
        if not audio_bytes:
            return {"status": "error", "message": "Audio data is empty for analysis."}
        _, ext = os.path.splitext(original_filename or "")
        if not ext:
            ext = ".mp3"
        files = {"file": (f"upload_{analysis_id}{ext}", audio_bytes, "application/octet-stream")}
        data = {"analysis_id": analysis_id}
        return await self._request("POST", "/v1/analyses", data=data, files=files)

    async def get_status(self, analysis_id: str) -> Dict[str, Any]:
        """Poll the job status document (``state``, ``part1_ready``, ``result_available``, ...)."""
        return await self._request("GET", f"/v1/analyses/{analysis_id}")

    async def get_result(self, analysis_id: str) -> Dict[str, Any]:
        """Fetch the canonical analysis (partial once part 1 is ready, full once succeeded)."""
        return await self._request("GET", f"/v1/analyses/{analysis_id}/result")

    async def wait_for_result(
        self,
        analysis_id: str,
        *,
        timeout: float = 180.0,
        poll_interval: float = 2.0,
        require_full: bool = True,
    ) -> Dict[str, Any]:
        """Block until the analysis finishes (or part 1 is ready when ``require_full`` is False),
        or until ``timeout``. Returns ``{"status": "success"|"partial", "result": {...}}`` on
        success, or ``{"status": "error"|"timeout", "message": ...}``.
        """
        if not self.is_configured:
            return {"status": "error", "message": "Analysis server URL not configured."}
        deadline = time.monotonic() + timeout
        while True:
            status = await self.get_status(analysis_id)
            if status.get("status") == "error":
                return status  # transport/HTTP error already structured
            state = status.get("state")
            if state == _STATE_SUCCEEDED:
                return self._wrap_result(await self.get_result(analysis_id), "success")
            if state == _STATE_FAILED:
                return {"status": "error", "message": status.get("error") or "Analysis failed."}
            if not require_full and status.get("part1_ready"):
                return self._wrap_result(await self.get_result(analysis_id), "partial")
            if time.monotonic() >= deadline:
                return {
                    "status": "timeout",
                    "message": f"Analysis '{analysis_id}' not ready within {timeout:.0f}s.",
                }
            await asyncio.sleep(poll_interval)

    @staticmethod
    def _wrap_result(result: Dict[str, Any], ok_status: str) -> Dict[str, Any]:
        """Wrap a fetched canonical result, passing through a structured fetch error."""
        if isinstance(result, dict) and result.get("status") == "error":
            return result
        return {"status": ok_status, "result": result}

    # ------------------------------------------------------------------ #
    # Transport (structured errors, never raises into callers)
    # ------------------------------------------------------------------ #
    async def _request(
        self,
        method: str,
        endpoint: str,
        *,
        data: Optional[Dict] = None,
        files: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured:
            logger.warning("ANALYSIS: analysis_server_url is not configured — skipping %s %s", method, endpoint)
            return {"status": "error", "message": "Analysis server URL not configured."}

        target_url = f"{self.base_url.rstrip('/')}{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=300.0, headers=self._headers()) as client:
                if method == "POST":
                    response = await client.post(target_url, data=data, files=files)
                else:
                    response = await client.get(target_url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(
                "ANALYSIS: HTTP %s from %s: %s",
                e.response.status_code, target_url, e.response.text[:200],
            )
            message = f"Analysis service HTTP error: {e.response.status_code}"
            try:
                body = e.response.json()
                # The analysis service wraps errors as {"error": {"code", "message"}}.
                err = body.get("error") if isinstance(body, dict) else None
                if isinstance(err, dict) and err.get("message"):
                    message = str(err["message"])
            except ValueError:
                pass
            return {"status": "error", "message": message, "status_code": e.response.status_code}
        except httpx.RequestError as e:
            logger.error("ANALYSIS: could not connect to %s: %s", target_url, e)
            return {"status": "error", "message": f"Could not connect to analysis service: {e}"}
        except Exception as e:  # noqa: BLE001 — metering/analysis must never break the caller
            logger.error("ANALYSIS: unexpected error calling %s: %s", target_url, e)
            return {"status": "error", "message": f"An unexpected error occurred: {e}"}
