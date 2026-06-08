"""
SFTP Service
============

Business logic for automated SFTP provisioning. Handles SFTP virtual user
creation in the database, communication with the Hetzner provisioning endpoint,
quota management, and status reporting.
"""

import logging
from typing import Optional, Dict, NamedTuple, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import asyncio
from pathlib import Path
import hashlib

class BatchValidationResult(NamedTuple):
    valid: bool
    error: Optional[str]
    csv_path: Optional[Path]
    checksum_verified: bool

from app.repositories.sftp_user_repository import sftp_user_repo
from app.repositories.partner_repository import PartnerRepository
from app.models.sftp_user import SftpUser
from app.models.user import User
from app.services.admin_operation_log_service import AdminOperationLogService
from app.schemas.partner import SftpProvisionRequest
from app.core.config import settings
from app.core.security import hash_password

logger = logging.getLogger(__name__)


class SftpService:
    """Service for handling SFTP provisioning and lifecycle."""

    # Storage quota tier mapping (in bytes)
    QUOTA_MAP: Dict[str, int] = {
        "sandbox": 1073741824,      # 1 GB
        "starter": 10737418240,     # 10 GB
        "growth": 53687091200,      # 50 GB
        "enterprise": 0             # 0 = Unlimited
    }

    def __init__(self):
        self.partner_repo = PartnerRepository()
        self.admin_log_service = AdminOperationLogService()

    def get_quota_bytes(self, tier: str) -> int:
        """Get the storage quota limit in bytes for a given tier."""
        return self.QUOTA_MAP.get(tier, self.QUOTA_MAP["sandbox"])

    async def provision_partner_sftp(
        self,
        db: AsyncSession,
        request: SftpProvisionRequest,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> SftpUser:
        """
        Main provisioning method for a partner's SFTP account.
        """
        try:
            # 1. Verify partner exists
            partner = await self.partner_repo.async_get_by_id(db, request.partner_id)
            if not partner:
                raise ValueError(f"Partner with ID {request.partner_id} not found")

            # 2. Check for existing SFTP user
            existing_sftp_user = await sftp_user_repo.get_by_partner_id(db, request.partner_id)
            if existing_sftp_user:
                raise ValueError("SFTP account already provisioned for this partner")

            # 3. Hash password
            pwd_hash = hash_password(request.password) if request.password else None
            if not pwd_hash and not request.use_public_key:
                 raise ValueError("Password is required if public key auth is disabled")

            # 4. Derive slug, username and home dir from the partner UUID.
            #    slug = last segment of the UUID (e.g. ec15...-65c20f1c06df -> 65c20f1c06df).
            #    This keeps the SFTP username/folder stable and opaque (not the integer PK).
            slug = partner.partner_uuid.split("-")[-1]
            username = f"partner_{slug}"
            home_dir = f"{settings.sftp_base_path}/partners/{slug}"

            # Uniqueness guard — username collisions must never silently overwrite.
            clashing = await sftp_user_repo.get_by_username(db, username)
            if clashing:
                raise ValueError(f"SFTP username '{username}' is already in use")

            # 5. Create SftpUser row (sftp_provisioned_at=None)
            sftp_user_data = {
                "partner_id": partner.id,
                "username": username,
                "password_hash": pwd_hash,
                "home_directory": home_dir,
                "sftp_home_dir": home_dir,
                "use_public_key": request.use_public_key,
                "public_key": request.public_key if request.use_public_key else None,
                "allowed_ip": request.allowed_ip,
                "is_active": True,
                "label_id": None
            }

            sftp_user = await sftp_user_repo.async_create(db, commit=False, **sftp_user_data)
            
            # 6. Flush to get DB-assigned ID
            await db.flush()

            # 7. Call Hetzner provisioning (REQUIRED — failure aborts the transaction)
            quota_bytes = self.get_quota_bytes(partner.tier)
            result = await self._call_hetzner_provisioning(
                partner.id,
                username,
                pwd_hash,
                home_dir,
                quota_bytes,
                request.use_public_key,
                request.public_key if request.use_public_key else None,
                password=request.password,  # PLAINTEXT — what SFTPGo actually hashes/stores
            )
            if result.get("skipped") is not True and result.get("status") != "ok":
                raise RuntimeError(f"Hetzner SFTP provisioning returned unexpected body: {result}")

            # 8. Mark provisioned
            sftp_user = await sftp_user_repo.mark_provisioned(db, sftp_user)

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.sftp_provision",
                    target_type="sftp_user",
                    target_id=str(sftp_user.id),
                    before_state=None,
                    after_state={"partner_id": request.partner_id, "username": username},
                    ip_address=ip_address
                )

            await db.commit()
            return sftp_user

        except Exception as e:
            await db.rollback()
            logger.error(f"Error provisioning SFTP: {e}")
            raise

    async def _call_hetzner_provisioning(
        self, partner_id: int, username: str, password_hash: Optional[str], home_dir: str,
        quota_bytes: int, use_public_key: bool, public_key: Optional[str],
        password: Optional[str] = None,
    ) -> dict:
        """Call the internal Hetzner provisioning endpoint.

        ``password`` is the PLAINTEXT password — SFTPGo hashes it itself, so this
        is what the partner actually logs in with. ``password_hash`` (bcrypt) is
        sent only for records/back-compat; SFTPGo cannot use it as a login secret.
        """
        if not settings.hetzner_sftp_provision_url:
            logger.warning("hetzner_sftp_provision_url is not set. Skipping Hetzner provisioning.")
            return {"skipped": True}

        import httpx

        payload = {
            "partner_id": partner_id,
            "username": username,
            "password": password,
            "password_hash": password_hash,
            "home_dir": home_dir,
            "quota_bytes": quota_bytes,
            "use_public_key": use_public_key,
            "public_key": public_key
        }
        
        headers = {
            "Authorization": f"Bearer {settings.hetzner_internal_api_key}"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    settings.hetzner_sftp_provision_url,
                    json=payload,
                    headers=headers
                )
                if response.status_code not in (200, 201):
                    raise RuntimeError(f"Hetzner returned {response.status_code}: {response.text}")
                return response.json()
            except httpx.RequestError as exc:
                logger.error(f"An error occurred while requesting {exc.request.url!r}.")
                raise RuntimeError(f"Hetzner request error: {exc}")

    async def deactivate_partner_sftp(self, db: AsyncSession, partner_id: int) -> bool:
        """Deactivate a partner's SFTP account."""
        sftp_user = await sftp_user_repo.get_by_partner_id(db, partner_id)
        if not sftp_user:
            return False

        sftp_user.is_active = False
        db.add(sftp_user)
        return True

    async def _call_hetzner_decommission(self, username: str) -> None:
        """Best-effort: remove an SFTPGo account via the Hetzner internal endpoint.

        The provision endpoint is ``.../internal/provision-sftp-user``; the matching
        delete is ``DELETE .../internal/provision-sftp-user/{username}``. Failures are
        logged and swallowed — they must never block a partner deletion.
        """
        base_url = settings.hetzner_sftp_provision_url
        if not base_url:
            logger.warning("hetzner_sftp_provision_url not set — skipping SFTPGo decommission for %s", username)
            return

        import httpx

        url = f"{base_url.rstrip('/')}/{username}"
        headers = {"Authorization": f"Bearer {settings.hetzner_internal_api_key}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(url, headers=headers)
                if resp.status_code not in (200, 404):
                    logger.warning(
                        "SFTPGo decommission for '%s' returned %s: %s",
                        username, resp.status_code, resp.text,
                    )
        except Exception as exc:
            logger.warning("SFTPGo decommission request failed for '%s' (non-fatal): %s", username, exc)

    async def decommission_partner_sftp(self, db: AsyncSession, partner_id: int) -> int:
        """Tear down a partner's SFTP footprint ahead of partner deletion.

        1. Best-effort delete each SFTPGo account (so no orphaned live SFTP login
           survives a deleted partner).
        2. Hard-delete the ``sftp_users`` rows (required: the FK to partners is
           ON DELETE RESTRICT, so these must go before the parent row).

        Returns the number of ``sftp_users`` rows deleted. Does NOT commit — the
        caller deletes the partner in the same transaction and commits once.
        """
        usernames = await sftp_user_repo.list_usernames_for_partner(db, partner_id)
        for username in usernames:
            await self._call_hetzner_decommission(username)
        return await sftp_user_repo.async_delete_for_partner(db, partner_id, commit=False)

    async def retry_provisioning(
        self,
        db: AsyncSession,
        partner_id: int,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> SftpUser:
        """Retry the Hetzner provisioning call for an unprovisioned SFTP user."""
        try:
            sftp_user = await sftp_user_repo.get_by_partner_id(db, partner_id)
            if not sftp_user:
                raise ValueError(f"SFTP user for partner {partner_id} not found")
                
            if sftp_user.sftp_provisioned_at is not None:
                raise ValueError("SFTP account is already fully provisioned")
                
            partner = await self.partner_repo.async_get_by_id(db, partner_id)
            quota_bytes = self.get_quota_bytes(partner.tier)
            
            try:
                await self._call_hetzner_provisioning(
                    partner.id, 
                    sftp_user.username, 
                    sftp_user.password_hash, 
                    sftp_user.sftp_home_dir or sftp_user.home_directory, 
                    quota_bytes,
                    sftp_user.use_public_key,
                    sftp_user.public_key
                )
            except Exception as e:
                logger.error(f"Failed to retry SFTP provisioning on Hetzner: {e}")
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="partner.sftp_retry",
                        target_type="sftp_user",
                        target_id=str(sftp_user.id),
                        before_state=None,
                        after_state={"partner_id": partner_id},
                        ip_address=ip_address
                    )
                await db.commit() # Keep the DB state
                raise RuntimeError(f"Hetzner provisioning retry failed: {e}")
                
            sftp_user = await sftp_user_repo.mark_provisioned(db, sftp_user)

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.sftp_retry",
                    target_type="sftp_user",
                    target_id=str(sftp_user.id),
                    before_state=None,
                    after_state={"partner_id": partner_id},
                    ip_address=ip_address
                )

            await db.commit()
            return sftp_user

        except Exception as e:
            if not isinstance(e, RuntimeError) or "Hetzner provisioning retry failed" not in str(e):
                await db.rollback()
            logger.error(f"Error retrying SFTP provisioning: {e}")
            raise

    async def validate_incoming_batch(self, partner_id: int, batch_path: str) -> BatchValidationResult:
        """
        Validates an incoming batch folder before ingestion begins.
        """
        # Step 1 — Directory sanity check
        folder = Path(batch_path)
        if not folder.exists() or not folder.is_dir():
            return BatchValidationResult(valid=False, error="incoming directory not found", csv_path=None, checksum_verified=False)
            
        # Step 2 — Find the CSV
        csv_files = list(folder.glob("*.csv"))
        if not csv_files:
            return BatchValidationResult(valid=False, error="no CSV manifest found", csv_path=None, checksum_verified=False)
        if len(csv_files) > 1:
            return BatchValidationResult(valid=False, error="ambiguous batch: multiple CSV files", csv_path=None, checksum_verified=False)
            
        manifest_path = csv_files[0]
        
        # Step 3 — Find the checksum file
        checksum_file = folder / f"{manifest_path.stem}.sha256"
        checksum_verified = False
        
        if checksum_file.exists():
            # Step 4 — Checksum verification (when present)
            try:
                expected_hash_line = checksum_file.read_text().strip()
                # Format is typically "hash  filename"
                expected_hash = expected_hash_line.split()[0]
                
                # Compute hashlib.sha256 in chunks
                sha256_hash = hashlib.sha256()
                with open(manifest_path, "rb") as f:
                    for byte_block in iter(lambda: f.read(65536), b""):
                        sha256_hash.update(byte_block)
                actual_hash = sha256_hash.hexdigest()
                
                if actual_hash != expected_hash:
                    return BatchValidationResult(valid=False, error="checksum mismatch — file may be corrupted or truncated", csv_path=None, checksum_verified=False)
                
                checksum_verified = True
            except Exception as e:
                logger.error(f"Error reading checksum file: {e}")
                return BatchValidationResult(valid=False, error="error reading checksum file", csv_path=None, checksum_verified=False)
        else:
            logger.warning(f"No checksum file found for {manifest_path.name}. Proceeding without verification.")
            
            # Step 5 — Partial upload detection
            try:
                initial_size = manifest_path.stat().st_size
                await asyncio.sleep(0.5)
                final_size = manifest_path.stat().st_size
                if initial_size != final_size:
                    return BatchValidationResult(valid=False, error="file still uploading — retry in 30 seconds", csv_path=None, checksum_verified=False)
            except Exception as e:
                return BatchValidationResult(valid=False, error="error checking file size", csv_path=None, checksum_verified=False)

        # Step 6 — CSV header validation
        try:
            with open(manifest_path, "r", encoding='utf-8-sig') as f:
                first_line = f.readline().strip()
                if not first_line:
                    return BatchValidationResult(valid=False, error="empty CSV file", csv_path=None, checksum_verified=False)
                    
                headers = [h.strip().lower() for h in first_line.split(",")]
                if "isrc" not in headers or "title" not in headers:
                    return BatchValidationResult(valid=False, error="invalid CSV headers — expected at least: isrc, title", csv_path=None, checksum_verified=False)
        except Exception as e:
            return BatchValidationResult(valid=False, error=f"error reading CSV headers: {e}", csv_path=None, checksum_verified=False)
            
        return BatchValidationResult(valid=True, error=None, csv_path=manifest_path, checksum_verified=checksum_verified)
