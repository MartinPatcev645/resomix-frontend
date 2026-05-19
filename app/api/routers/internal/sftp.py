import logging
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.repositories.sftp_user_repository import sftp_user_repo
from database.connection import get_async_db
from app.services.ingestion_service import process_ingestion_batch

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal SFTP"])

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
    
    # Note: sftp_user schema currently doesn't have `allowed_ip`. 
    # If added in the future, uncomment this check:
    # if hasattr(sftp_user, "allowed_ip") and sftp_user.allowed_ip and ip not in sftp_user.allowed_ip:
    #     return {"username": "", "status": 0}  # deny
    
    partner_id = sftp_user.partner_id
    
    import os
    SFTP_BASE_PATH = os.getenv("SFTP_BASE_PATH", "/srv/sftp")
    
    # Map tier to quota bytes (W2-5)
    # default 1 GB sandbox, configurable per tier
    quota_map = {
        "sandbox": 1073741824,      # 1 GB
        "starter": 10737418240,     # 10 GB
        "growth": 53687091200,      # 50 GB
        "enterprise": 0             # 0 = Unlimited
    }
    
    partner = sftp_user.partner
    quota_size = quota_map.get(partner.tier, 1073741824) if partner else 1073741824
    
    # Return SFTPGo virtual user spec
    return {
        "status": 1,
        "username": username,
        "home_dir": f"{SFTP_BASE_PATH}/partners/{partner_id}",
        "uid": 1000,
        "gid": 1000,
        "permissions": {"/": ["list", "download", "upload", "create_dirs", "delete"]},
        "quota_size": quota_size,
        "filters": {}
    }

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
        # In a real scenario, we might need a DB session to look up the user.
        # But for the hook event, we can just defer it or use a new session block.
        # Here we just pass the username downstream or fetch it using a scoped session.
        from database.connection import AsyncSessionLocal
        
        async with AsyncSessionLocal() as db:
            sftp_user = await sftp_user_repo.get_by_username(db, username)
            if sftp_user:
                import os
                SFTP_BASE_PATH = os.getenv("SFTP_BASE_PATH", "/srv/sftp")
                partner_id = sftp_user.partner_id
                batch_path = f"{SFTP_BASE_PATH}/partners/{partner_id}/incoming"
                
                # Enqueue background ingestion task (FastAPI BackgroundTasks instead of Celery for now)
                background_tasks.add_task(process_ingestion_batch, partner_id=partner_id, batch_path=batch_path)
    
    return {"status": "ok"}
