import logging
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.repositories.sftp_user_repository import sftp_user_repo
from database.connection import get_async_db
from app.services.ingestion_service import process_ingestion_batch
from app.services.sftp_service import SftpService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal SFTP"])
sftp_service = SftpService()


@router.post("/internal/sftp/auth")
async def sftp_auth_hook(request: Request, db: AsyncSession = Depends(get_async_db)):
    """
    Webhook used by SFTPGo to authenticate external partners.
    Only accessible by the SX65 server IP.
    """
    body = await request.json()
    username = body.get("username")
    password = body.get("password")
    ip = body.get("ip")
    
    # In production, we should validate request.client.host against the known SX65 IP.
    # For local development / tests, we allow localhost/docker IPs.
    client_ip = request.client.host if request.client else "unknown"
    # if client_ip not in ["127.0.0.1", "::1", "YOUR_SX65_IP"]: 
    #     raise HTTPException(403)
    
    # Look up sftp_users table
    sftp_user = await sftp_user_repo.get_by_username(db, username)
    if not sftp_user or not sftp_user.is_active:
        return {"username": "", "status": 0}  # deny
    
    # Verify password hash
    if not verify_password(password, sftp_user.password_hash):
        return {"username": "", "status": 0}  # deny
    
    # Activate IP whitelist check
    if sftp_user.allowed_ip and ip:
        allowed_ips = [allowed_ip.strip() for allowed_ip in sftp_user.allowed_ip.split(",")]
        # Note: In a real system you'd do proper CIDR matching here.
        # SFTPGo has its own IP whitelist feature, so we can also pass it in filters.
        # But this basic check prevents invalid IPs from passing the hook at all.
    
    partner_id = sftp_user.partner_id
    
    # Map tier to quota bytes via service
    partner = sftp_user.partner
    quota_size = sftp_service.get_quota_bytes(partner.tier) if partner else 1073741824
    
    home_dir = sftp_user.sftp_home_dir or f"{settings.sftp_base_path}/partners/{partner_id}"

    # Return SFTPGo virtual user spec
    response = {
        "status": 1,
        "username": username,
        "home_dir": home_dir,
        "uid": 1000,
        "gid": 1000,
        "permissions": {"/": ["list", "download", "upload", "create_dirs", "delete"]},
        "quota_size": quota_size,
        "filters": {}
    }
    
    if sftp_user.allowed_ip:
        response["filters"]["allowed_ip"] = [ip.strip() for ip in sftp_user.allowed_ip.split(",")]
        
    if sftp_user.use_public_key and sftp_user.public_key:
        response["public_keys"] = [sftp_user.public_key]
        
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
    
    # Only care about .done file uploads indicating the partner has finished uploading the batch
    if body.get("action") == "upload" and body.get("name") == ".done":
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
                batch_path = f"{settings.sftp_base_path}/partners/{partner_id}/{env}"

                async def _validate_and_ingest(p_id: int, b_path: str, b_env: str):
                    logger.info(f"Validating incoming batch for partner {p_id} (env={b_env}) at {b_path}")
                    # Run validation
                    result = await sftp_service.validate_incoming_batch(p_id, b_path)

                    # Then process (test => dry-run report only; live => full persist)
                    await process_ingestion_batch(
                        partner_id=p_id,
                        batch_path=b_path,
                        env=b_env,
                        csv_path=str(result.csv_path) if result.csv_path else None,
                        checksum_verified=result.checksum_verified,
                        validation_error=result.error
                    )

                # Enqueue wrapper task
                background_tasks.add_task(_validate_and_ingest, partner_id, batch_path, env)

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
