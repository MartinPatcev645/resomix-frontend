import logging
import os
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.repositories.sftp_user_repository import sftp_user_repo
from database.connection import get_async_db
from app.services.ingestion_service import start_ingestion_job
from app.services.sftp_service import SftpService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal SFTP"])
sftp_service = SftpService()

# Deny response SFTPGo interprets as "authentication failed".
_DENY = {"username": "", "status": 0}


def _normalize_public_key(raw: str) -> Optional[tuple]:
    """Reduce an OpenSSH public key line to its identity ``(type, base64-body)``.

    The trailing comment (and any surrounding whitespace) is irrelevant to the
    key's identity, so we compare only the algorithm + key material. Returns
    ``None`` for anything that doesn't look like a key.
    """
    if not raw:
        return None
    parts = raw.strip().split()
    if len(parts) < 2:
        return None
    return (parts[0], parts[1])


def _public_key_authorized(presented: Optional[str], stored: Optional[str]) -> bool:
    """True when ``presented`` matches one of the keys in ``stored``.

    ``stored`` may hold several authorized keys (one per line). Matching ignores
    the comment field so a re-exported key with a different comment still works.
    """
    target = _normalize_public_key(presented)
    if not target or not stored:
        return False
    for line in stored.splitlines():
        if _normalize_public_key(line) == target:
            return True
    return False


@router.post("/internal/sftp/auth")
async def sftp_auth_hook(request: Request, db: AsyncSession = Depends(get_async_db)):
    """
    Webhook used by SFTPGo to authenticate external partners.
    Only accessible by the SX65 server IP.

    With ``external_auth_scope=0`` SFTPGo delegates BOTH password and public-key
    auth here. A public-key attempt arrives with the presented key in the
    ``public_key`` field and an empty ``password``; a password attempt has the
    reverse. We must branch on which credential was actually sent — verifying a
    password unconditionally would reject every key-based login.
    """
    body = await request.json()
    username = body.get("username")
    password = body.get("password")
    presented_public_key = body.get("public_key")
    ip = body.get("ip")

    # In production, we should validate request.client.host against the known SX65 IP.
    # For local development / tests, we allow localhost/docker IPs.
    client_ip = request.client.host if request.client else "unknown"
    # if client_ip not in ["127.0.0.1", "::1", "YOUR_SX65_IP"]:
    #     raise HTTPException(403)

    # Look up sftp_users table
    sftp_user = await sftp_user_repo.get_by_username(db, username)
    if not sftp_user or not sftp_user.is_active:
        return _DENY  # deny

    # Credential check. SFTPGo sends EITHER a public key (key attempt) OR a
    # password (password attempt). Branch on what was presented.
    if presented_public_key:
        # Public-key attempt: only valid for key-enabled accounts whose stored key
        # matches the presented one. Never fall through to password verification.
        if not sftp_user.use_public_key:
            return _DENY
        if not _public_key_authorized(presented_public_key, sftp_user.public_key):
            return _DENY
    else:
        # Password attempt: verify against the stored bcrypt hash.
        if not verify_password(password, sftp_user.password_hash):
            return _DENY

    # IP whitelist enforcement (defense in depth). SFTPGo also enforces the
    # ``allowed_ip`` filter we return below, but rejecting here means a connection
    # from an unlisted IP never authenticates even if the filter were misapplied.
    if sftp_user.allowed_ip and ip:
        allowed_ips = [a.strip() for a in sftp_user.allowed_ip.split(",") if a.strip()]
        # Exact-match check. CIDR ranges are handled by SFTPGo's own allowed_ip
        # filter (returned in the response); this guard covers plain IPs.
        if allowed_ips and ip not in allowed_ips and not any("/" in a for a in allowed_ips):
            logger.warning(
                "SFTP auth denied for '%s': IP %s not in allowed list %s",
                username, ip, allowed_ips,
            )
            return _DENY

    partner_id = sftp_user.partner_id

    # Resolve the per-account SFTP limits (quota + bandwidth/sessions/transfer)
    # chosen at provision time and persisted on the row. Quota falls back to the
    # tier default for legacy rows; other caps are simply absent when unset.
    partner = sftp_user.partner
    limits = sftp_service.effective_limits(sftp_user, partner)

    # The home dir is stamped at provision time from the partner UUID slug
    # (``partners/<slug>``). Always prefer the stored value; only fall back to a
    # slug-derived path if it is somehow missing.
    home_dir = sftp_user.sftp_home_dir
    if not home_dir:
        slug = partner.partner_uuid.split("-")[-1] if partner else str(partner_id)
        home_dir = f"{settings.sftp_base_path}/partners/{slug}"

    # Return SFTPGo virtual user spec.
    #
    # Lockdown policy (kept in sync with docs/reference/PARTNER_ONBOARDING.md §3b):
    #   • Per-directory permissions — root is list-only; only the pre-existing
    #     live/ and test/ folders accept uploads. `create_dirs` is granted
    #     NOWHERE, so partners cannot create their own folders.
    #   • file_patterns restrict uploads to the approved audio/manifest types
    #     (.flac .wav .aiff .mp3 .zip .csv .done) and HIDE (deny_policy=1) any
    #     internal / processing / dotfolder at the root from the partner.
    _ALLOWED_UPLOAD_PATTERNS = ["*.flac", "*.wav", "*.aiff", "*.mp3", "*.zip", "*.csv", "*.done", ".done"]
    response = {
        "status": 1,
        "username": username,
        "home_dir": home_dir,
        "uid": 1000,
        "gid": 1000,
        "permissions": {
            "/": ["list"],
            "/live": ["list", "download", "upload", "delete"],
            "/test": ["list", "download", "upload", "delete"],
        },
        "filters": {
            "file_patterns": [
                {
                    "path": "/",
                    "denied_patterns": ["internal", ".processing", ".*"],
                    "deny_policy": 1,
                },
                {
                    "path": "/live",
                    "allowed_patterns": _ALLOWED_UPLOAD_PATTERNS,
                    "deny_policy": 1,
                },
                {
                    "path": "/test",
                    "allowed_patterns": _ALLOWED_UPLOAD_PATTERNS,
                    "deny_policy": 1,
                },
            ]
        },
    }

    # Apply the resolved limits (quota_size + any bandwidth/sessions/transfer caps).
    # Keys are SFTPGo user fields; unset caps are simply absent (no limit).
    response.update(limits)

    if sftp_user.allowed_ip:
        response["filters"]["allowed_ip"] = [a.strip() for a in sftp_user.allowed_ip.split(",") if a.strip()]

    if sftp_user.use_public_key and sftp_user.public_key:
        # The stored value may hold several authorized keys (one per line).
        response["public_keys"] = [k.strip() for k in sftp_user.public_key.splitlines() if k.strip()]

    return response

@router.post("/internal/sftp/event")
async def sftp_event_hook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook used by SFTPGo to notify about file uploads.
    """
    # In production, we should validate request.client.host against the known SX65 IP.
    # if request.client.host not in ["127.0.0.1", "::1", "YOUR_SX65_IP"]:
    #     raise HTTPException(403)
    
    body = await request.json()

    # SFTPGo's upload notification carries the object path under `virtual_path`
    # (and/or `path`/`fs_path`) — there is NO top-level `name` field. We derive the
    # uploaded filename from the path basename, but still honour an explicit `name`
    # (e.g. when called by tests) as a fallback.
    _name_source = (
        body.get("name")
        or body.get("virtual_path")
        or body.get("path")
        or body.get("fs_path")
        or ""
    )
    uploaded_name = os.path.basename(str(_name_source).replace("\\", "/").rstrip("/"))

    # Only care about .done file uploads indicating the partner has finished uploading the batch
    if body.get("action") == "upload" and uploaded_name == ".done":
        username = body.get("username")
        # Derive which SFTP env the batch was uploaded to (test = dry-run, live = persist).
        # The .done marker lives inside the env folder, so its path carries the env segment.
        env = _derive_env_from_event(body)
        # In a real scenario, we might need a DB session to look up the user.
        # But for the hook event, we can just defer it or use a new session block.
        # Here we just pass the username downstream or fetch it using a scoped session.
        from database.connection import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            sftp_user = await sftp_user_repo.get_by_username(db, username)
            if sftp_user:
                partner_id = sftp_user.partner_id
                # The uploaded files live on the Hetzner media server, not here, so
                # Alwyzon cannot validate them directly. Instead we hand the job off
                # to Hetzner (fire-and-forget): it validates + writes a result JSON,
                # and the admin status poll later persists the tracks. We only pass
                # the provisioned home dir (``partners/<slug>``); Hetzner translates
                # it to its own host path.
                home_dir = sftp_user.sftp_home_dir or f"{settings.sftp_base_path}/partners/{partner_id}"

                async def _handoff_ingestion(p_id: int, h_dir: str, b_env: str):
                    logger.info(
                        f"Handing off incoming batch for partner {p_id} (env={b_env}) to media server"
                    )
                    async with AsyncSessionLocal() as task_db:
                        await start_ingestion_job(
                            task_db,
                            partner_id=p_id,
                            home_dir=h_dir,
                            env=b_env,
                        )

                background_tasks.add_task(_handoff_ingestion, partner_id, home_dir, env)

    return {"status": "ok"}


def _derive_env_from_event(body: dict) -> str:
    """
    Determine the SFTP env ("test" | "live") a batch was uploaded to from an SFTPGo event.

    SFTPGo events carry the uploaded object path under a few possible keys depending on version
    (``virtual_path``, ``virtual_target_path``, ``path``, ``fs_path``). We look for a ``/test/``
    or ``/live/`` segment. Defaults to ``live`` when the path is ambiguous so a misconfigured
    client never silently skips real ingestion.
    """
    candidate = (
        body.get("virtual_path")
        or body.get("virtual_target_path")
        or body.get("path")
        or body.get("fs_path")
        or ""
    )
    norm = str(candidate).replace("\\", "/").lower()
    if "/test/" in norm or norm.endswith("/test") or norm.startswith("test/") or norm == "test":
        return "test"
    return "live"
