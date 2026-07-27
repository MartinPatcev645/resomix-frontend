"""
SFTP Service
============

Business logic for automated SFTP provisioning. Handles SFTP virtual user
creation in the database, communication with the Hetzner provisioning endpoint,
quota management, and status reporting.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel


from app.repositories.sftp_user_repository import sftp_user_repo
from app.repositories.partner_repository import PartnerRepository
from app.models.sftp_user import SftpUser
from app.models.user import User
from app.services.admin_operation_log_service import AdminOperationLogService
from app.schemas.partner import SftpProvisionRequest, SftpLimitsUpdateRequest
from app.core.config import settings
from app.core.security import hash_password

logger = logging.getLogger(__name__)


class SftpService:
    """Service for handling SFTP provisioning and lifecycle."""

    # Storage quota tier mapping (in bytes). 0 = unlimited.
    QUOTA_MAP: Dict[str, int] = {
        "sandbox": 1073741824,      # 1 GB
        "starter": 10737418240,     # 10 GB
        "growth": 53687091200,      # 50 GB
        "enterprise": 0             # 0 = Unlimited
    }

    # Per-tier defaults for the remaining SFTP limits. These are *defaults* — an
    # admin can override any of them per-account at provision time. 0 = unlimited
    # (SFTPGo convention). Bandwidth is KB/s; data-transfer is MB; sessions is a
    # concurrency count.
    PLAN_LIMITS: Dict[str, Dict[str, int]] = {
        "sandbox":    {"quota_files": 0, "upload_bandwidth": 2048, "download_bandwidth": 4096, "max_sessions": 2,  "upload_data_transfer": 0, "download_data_transfer": 0, "total_data_transfer": 0},
        "starter":    {"quota_files": 0, "upload_bandwidth": 0,    "download_bandwidth": 0,    "max_sessions": 5,  "upload_data_transfer": 0, "download_data_transfer": 0, "total_data_transfer": 0},
        "growth":     {"quota_files": 0, "upload_bandwidth": 0,    "download_bandwidth": 0,    "max_sessions": 10, "upload_data_transfer": 0, "download_data_transfer": 0, "total_data_transfer": 0},
        "enterprise": {"quota_files": 0, "upload_bandwidth": 0,    "download_bandwidth": 0,    "max_sessions": 0,  "upload_data_transfer": 0, "download_data_transfer": 0, "total_data_transfer": 0},
    }

    # The non-quota limit columns, in the order they map to SFTPGo user fields.
    LIMIT_FIELDS = (
        "quota_files", "upload_bandwidth", "download_bandwidth", "max_sessions",
        "upload_data_transfer", "download_data_transfer", "total_data_transfer",
    )

    def __init__(self):
        self.partner_repo = PartnerRepository()
        self.admin_log_service = AdminOperationLogService()

    def get_quota_bytes(self, tier: str) -> int:
        """Get the storage quota limit in bytes for a given tier."""
        return self.QUOTA_MAP.get(tier, self.QUOTA_MAP["sandbox"])

    def plan_defaults(self, tier: str) -> Dict[str, int]:
        """Full set of default limits for a tier (quota + bandwidth/sessions/transfer)."""
        base = dict(self.PLAN_LIMITS.get(tier, self.PLAN_LIMITS["sandbox"]))
        base["quota_bytes"] = self.get_quota_bytes(tier)
        return base

    def resolve_sftp_limits(self, tier: str, request: "SftpProvisionRequest") -> Dict[str, int]:
        """Merge a tier's plan defaults with the admin's per-account overrides.

        An override wins only when explicitly provided (not None); otherwise the
        tier default applies. Returns the resolved values to persist + send to SFTPGo.
        """
        defaults = self.plan_defaults(tier)
        resolved: Dict[str, int] = {
            "quota_bytes": request.quota_bytes if request.quota_bytes is not None else defaults["quota_bytes"],
        }
        for field in self.LIMIT_FIELDS:
            override = getattr(request, field, None)
            resolved[field] = override if override is not None else defaults[field]
        return resolved

    def effective_limits(self, sftp_user: "SftpUser", partner) -> Dict[str, int]:
        """Limits to hand SFTPGo for an existing account (used by the auth hook).

        Reads the persisted per-account columns; for quota it falls back to the
        tier default if the column is NULL (legacy rows), and other limits are
        simply omitted when NULL so SFTPGo applies no cap.
        """
        tier = partner.tier if partner else "sandbox"
        quota = sftp_user.quota_bytes if sftp_user.quota_bytes is not None else self.get_quota_bytes(tier)
        out: Dict[str, int] = {"quota_size": quota}
        for field in self.LIMIT_FIELDS:
            val = getattr(sftp_user, field, None)
            if val is not None:
                out[field] = val
        return out

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

            # 4b. Resolve the effective SFTP limits = tier plan defaults overlaid
            #     with any admin overrides on the request. Persisted on the row so
            #     the auth hook and any retry use exactly these values.
            limits = self.resolve_sftp_limits(partner.tier, request)

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
                "label_id": None,
                **limits,  # quota_bytes + quota_files/bandwidth/sessions/transfer
            }

            sftp_user = await sftp_user_repo.async_create(db, commit=False, **sftp_user_data)
            
            # 6. Flush to get DB-assigned ID
            await db.flush()

            # 7. Call Hetzner provisioning (REQUIRED — failure aborts the transaction)
            result = await self._call_hetzner_provisioning(
                partner.id,
                username,
                pwd_hash,
                home_dir,
                limits,
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
        limits: Dict[str, int], use_public_key: bool, public_key: Optional[str],
        password: Optional[str] = None,
    ) -> dict:
        """Call the internal Hetzner provisioning endpoint.

        ``password`` is the PLAINTEXT password — SFTPGo hashes it itself, so this
        is what the partner actually logs in with. ``password_hash`` (bcrypt) is
        sent only for records/back-compat; SFTPGo cannot use it as a login secret.
        ``limits`` carries the resolved per-account caps (quota + bandwidth/sessions/
        transfer); SFTPGo applies them to the created user.
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
            "quota_bytes": limits.get("quota_bytes", 0),
            "quota_files": limits.get("quota_files"),
            "upload_bandwidth": limits.get("upload_bandwidth"),
            "download_bandwidth": limits.get("download_bandwidth"),
            "max_sessions": limits.get("max_sessions"),
            "upload_data_transfer": limits.get("upload_data_transfer"),
            "download_data_transfer": limits.get("download_data_transfer"),
            "total_data_transfer": limits.get("total_data_transfer"),
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
        password: Optional[str] = None,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> SftpUser:
        """Retry the Hetzner provisioning call for an unprovisioned SFTP user.

        The partner's plaintext password is intentionally never stored (only its
        bcrypt hash), so it can't be reconstructed on retry. The admin therefore
        re-supplies it: it is sent to SFTPGo as the real login password, and the
        stored bcrypt hash is updated to match so the auth hook keeps verifying the
        partner's logins. ``password`` may be omitted only for public-key accounts.
        """
        try:
            sftp_user = await sftp_user_repo.get_by_partner_id(db, partner_id)
            if not sftp_user:
                raise ValueError(f"SFTP user for partner {partner_id} not found")

            if sftp_user.sftp_provisioned_at is not None:
                raise ValueError("SFTP account is already fully provisioned")

            # Password is required to (re)create a password-authenticated SFTPGo user.
            if not password and not sftp_user.use_public_key:
                raise ValueError("Password is required to retry provisioning for this account")

            partner = await self.partner_repo.async_get_by_id(db, partner_id)
            # Reuse the limits chosen at provision time (persisted on the row), with
            # a tier fallback for legacy rows that predate the limit columns.
            limits = self.effective_limits(sftp_user, partner)
            limits["quota_bytes"] = limits.pop("quota_size")

            # Hash the re-supplied password now (so the auth hook verifies against it),
            # but only commit the new hash once provisioning actually succeeds.
            new_password_hash = hash_password(password) if password else None

            try:
                await self._call_hetzner_provisioning(
                    partner.id,
                    sftp_user.username,
                    new_password_hash or sftp_user.password_hash,
                    sftp_user.sftp_home_dir or sftp_user.home_directory,
                    limits,
                    sftp_user.use_public_key,
                    sftp_user.public_key,
                    password=password,  # PLAINTEXT — what SFTPGo actually stores/hashes
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

            # Provisioning succeeded → persist the new password hash so the partner's
            # login (verified by the auth hook) matches what we just sent to SFTPGo.
            if new_password_hash:
                sftp_user.password_hash = new_password_hash
                db.add(sftp_user)

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

    async def update_sftp_limits(
        self,
        db: AsyncSession,
        partner_id: int,
        request: "SftpLimitsUpdateRequest",
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None,
    ) -> SftpUser:
        """Change the SFTP caps of an already-provisioned partner.

        Only the fields present on ``request`` are changed; the rest keep their
        current values. The new values are persisted (so the auth hook serves them
        on the next connection) and pushed to SFTPGo immediately on a best-effort
        basis (so quota tracking / active limits update without waiting for reconnect).
        """
        try:
            sftp_user = await sftp_user_repo.get_by_partner_id(db, partner_id)
            if not sftp_user:
                raise ValueError(f"SFTP user for partner {partner_id} not found")

            fields = ("quota_bytes",) + self.LIMIT_FIELDS
            before = {f: getattr(sftp_user, f) for f in fields}

            # Overlay only the provided fields onto the current values.
            changed: Dict[str, int] = {}
            for f in fields:
                new_val = getattr(request, f, None)
                if new_val is not None and new_val != getattr(sftp_user, f):
                    setattr(sftp_user, f, new_val)
                    changed[f] = new_val

            if not changed:
                return sftp_user  # nothing actually changed

            db.add(sftp_user)
            await db.flush()

            # Best-effort: push the changed caps straight to SFTPGo so they apply
            # now (not just on the partner's next login). DB is the source of truth;
            # if SFTPGo is unreachable the auth hook still serves the new caps next
            # connect, so we log and continue rather than failing the update.
            try:
                await self._call_hetzner_update_limits(sftp_user.username, changed)
            except Exception as push_err:
                logger.warning(
                    "SFTP limits saved but live SFTPGo push failed for partner %s (will apply on next connect): %s",
                    partner_id, push_err,
                )

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="partner.sftp_update_limits",
                    target_type="sftp_user",
                    target_id=str(sftp_user.id),
                    before_state={k: before[k] for k in changed},
                    after_state=changed,
                    ip_address=ip_address,
                )

            await db.commit()
            await db.refresh(sftp_user)
            return sftp_user

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating SFTP limits for partner {partner_id}: {e}")
            raise

    async def _call_hetzner_update_limits(self, username: str, limits: Dict[str, int]) -> dict:
        """Push changed SFTP caps to the media/SFTPGo update endpoint (best-effort)."""
        base_url = settings.hetzner_sftp_provision_url
        if not base_url:
            logger.warning("hetzner_sftp_provision_url not set — skipping live SFTPGo limits push for %s", username)
            return {"skipped": True}

        # Derive the sibling endpoint: .../provision-sftp-user -> .../update-sftp-user-limits
        update_url = base_url.rstrip("/").rsplit("/provision-sftp-user", 1)[0] + "/update-sftp-user-limits"

        import httpx

        payload = {"username": username, **limits}
        headers = {"Authorization": f"Bearer {settings.hetzner_internal_api_key}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(update_url, json=payload, headers=headers)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"SFTPGo limits update returned {resp.status_code}: {resp.text}")
            return resp.json()
