"""
Backup Agent Client
===================

The seam between the control plane and the two machines that actually hold the
data. Alwyzon never runs restic itself: it asks a small agent on the target box
to start ``bin/run_nightly.sh``, and the agent posts back what happened.

WHY THIS IS A SEPARATE FILE

The agent endpoints are not deployed yet. Everything else in the backup feature
(schema, history, status, admin UI) is finished and useful without them, so the
one part that depends on them is isolated here behind a configuration check.
Until ``BACKUP_AGENT_*_URL`` is set, every dispatch call returns
``{"success": False, "reason": "not_configured"}`` and the caller records that
honestly rather than showing a run that was never started.

Wiring it up later is setting three environment variables. No code changes.

WHY NOT SSH FROM THE API PROCESS

Because that means the web application holds a key that can execute as root on
both servers, and a bug in an HTTP handler becomes remote code execution on the
box that stores the backups. The agent exposes exactly two verbs and nothing
else can be asked of it.

Version: 1.0.0
Init Date: August 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Server roles the control plane knows about, and the setting that points at each.
ROLE_URL_SETTINGS = {
    "alwyzon": "backup_agent_alwyzon_url",
    "media": "backup_agent_media_url",
}

# Generous. Starting a backup returns as soon as the agent has forked the run,
# but the agent is on a box that may be mid-backup and busy.
DISPATCH_TIMEOUT_S = 20.0
QUERY_TIMEOUT_S = 30.0


class BackupAgentClient:
    """Talks to the backup agent on a given server role."""

    def base_url(self, role: str) -> Optional[str]:
        setting = ROLE_URL_SETTINGS.get(role)
        if not setting:
            return None
        url = getattr(settings, setting, None)
        return url.rstrip("/") if url else None

    def token(self) -> Optional[str]:
        return getattr(settings, "backup_agent_token", None)

    def is_configured(self, role: str) -> bool:
        return bool(self.base_url(role) and self.token())

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.token()}"}

    async def _post(self, role: str, path: str, payload: Dict[str, Any], timeout: float) -> Dict[str, Any]:
        base = self.base_url(role)
        if not base or not self.token():
            return {"success": False, "reason": "not_configured",
                    "error": f"No backup agent configured for '{role}'"}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{base}{path}", json=payload, headers=self._headers())
            if response.status_code == 200:
                try:
                    return {"success": True, "data": response.json()}
                except Exception:
                    return {"success": True, "data": {}}
            return {
                "success": False,
                "reason": "agent_error",
                "status": response.status_code,
                "error": _message_of(response),
            }
        except Exception as exc:
            logger.error("backup agent %s %s failed: %s", role, path, exc)
            return {"success": False, "reason": "unreachable",
                    "error": f"Could not reach the backup agent on '{role}'"}

    async def _get(self, role: str, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        base = self.base_url(role)
        if not base or not self.token():
            return {"success": False, "reason": "not_configured",
                    "error": f"No backup agent configured for '{role}'"}
        try:
            async with httpx.AsyncClient(timeout=QUERY_TIMEOUT_S) as client:
                response = await client.get(f"{base}{path}", params=params or {}, headers=self._headers())
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            return {
                "success": False,
                "reason": "agent_error",
                "status": response.status_code,
                "error": _message_of(response),
            }
        except Exception as exc:
            logger.error("backup agent %s %s failed: %s", role, path, exc)
            return {"success": False, "reason": "unreachable",
                    "error": f"Could not reach the backup agent on '{role}'"}

    # ------------------------------------------------------------------ #
    # Verbs
    # ------------------------------------------------------------------ #

    async def start_backup(self, role: str, run_uid: str, components: Optional[list] = None) -> Dict[str, Any]:
        """Ask the agent to start a run and return immediately.

        The run_uid is chosen HERE and passed down, not generated by the agent
        and returned. That way the row exists before anything can go wrong, and
        a dispatch whose response is lost still has a record an operator can
        find, rather than a backup running on a server with nothing pointing at
        it.
        """
        payload: Dict[str, Any] = {"run_uid": run_uid}
        if components:
            payload["components"] = components
        return await self._post(role, "/internal/backup/start", payload, DISPATCH_TIMEOUT_S)

    async def start_verify(self, role: str, run_uid: str, full: bool = False) -> Dict[str, Any]:
        """Ask the agent to run repository verification.

        ``full`` re-reads every pack rather than a subset. It is expensive and
        deliberately not the default.
        """
        return await self._post(
            role, "/internal/backup/verify", {"run_uid": run_uid, "full": full}, DISPATCH_TIMEOUT_S
        )

    async def get_status(self, role: str) -> Dict[str, Any]:
        """Live state from the agent: is a run in progress right now."""
        return await self._get(role, "/internal/backup/status")

    async def list_snapshots(self, role: str, tag: Optional[str] = None) -> Dict[str, Any]:
        """The repository's own snapshot inventory.

        Deliberately read from restic and never from our tables. Our history
        says what we believe happened; the repository says what is actually
        recoverable, and the whole point of an inventory view is to catch the
        case where those two disagree.
        """
        return await self._get(role, "/internal/backup/snapshots", {"tag": tag} if tag else None)


def _message_of(response: httpx.Response) -> str:
    try:
        body = response.json()
        return body.get("message") or body.get("error") or f"Agent returned {response.status_code}"
    except Exception:
        return f"Agent returned {response.status_code}"


backup_agent_client = BackupAgentClient()
