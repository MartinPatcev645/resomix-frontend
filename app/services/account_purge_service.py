"""
Account Purge
=============

Destroys a deleted account's data, once an admin decides to. Never automatic: a deletion request
starts a 30-day clock (``users.purge_due_at``) and this is what an admin runs afterwards.

WHAT SURVIVES, AND WHY (decision Q1)
------------------------------------

Financial and analytics records outlive the person; everything that *is* the person, or their
content, goes. That is not a policy we can express by deleting the ``users`` row and letting the
database sort it out — the foreign keys pull in three different directions:

* **15 keys are ``SET NULL``** — they anonymise themselves. Nothing to do.
* **18 keys are ``CASCADE``** — the row dies with the user. Right for sessions, tokens and carts;
  **wrong** for ``billing_invoices``, ``subscription_events`` and ``billing_consents``, which are
  ``CASCADE`` *and* ``NOT NULL``. Left alone, a purge would silently destroy every invoice.
* **4 keys are ``RESTRICT``** — the delete simply fails until they are dealt with.

So the order below is not stylistic. Rows we are keeping are repointed at the tombstone user
FIRST; only then can the ``users`` row go.

DRY RUN FIRST
-------------

``purge(..., dry_run=True)`` counts everything and writes nothing. An irreversible operation should
be inspectable before it runs, and the manifest is also what the admin UI shows for confirmation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

TOMBSTONE_EMAIL = "deleted@resomix.internal"

# ---------------------------------------------------------------------------
# 1. KEPT — repointed to the tombstone so they survive the delete.
#
#    Every one of these is NOT NULL or RESTRICT, which is precisely why they need a real owner
#    rather than a null. The three CASCADE ones are the reason this step is not optional.
# ---------------------------------------------------------------------------
REPOINT: tuple[tuple[str, str, str], ...] = (
    ("orders", "user_id", "financial record — RESTRICT, NOT NULL"),
    ("billing_invoices", "user_id", "financial record — CASCADE would DELETE it"),
    ("subscription_events", "user_id", "revenue reporting — CASCADE would DELETE it"),
    ("billing_consents", "user_id", "legal evidence of consent — CASCADE would DELETE it"),
    ("admin_operation_logs", "admin_user_id", "audit trail of what an ADMIN did — never deleted"),
    ("manual_takedowns", "admin_user_id", "audit trail — RESTRICT, NOT NULL"),
)

# ---------------------------------------------------------------------------
# 2. ANONYMISED IN PLACE — kept for analytics, stripped of anything identifying.
#
#    `consumption_events.user_id` is already SET NULL, so the link goes on its own. `client_ip` is
#    the personal data the FK cannot reach.
# ---------------------------------------------------------------------------
SCRUB: tuple[tuple[str, str, str, str], ...] = (
    ("consumption_events", "client_ip", "user_id", "playback analytics — IP is the only PII on the row"),
)

# ---------------------------------------------------------------------------
# 3. DELETED — the person and their content.
#
#    Listed explicitly even where a SET NULL foreign key exists, because SET NULL would ORPHAN
#    these rather than remove them: an ownerless playlist is still a playlist.
#
#    Order matters only where one table references another; children first.
# ---------------------------------------------------------------------------
DELETE: tuple[tuple[str, str, str], ...] = (
    ("track_analysis_results", "user_id", "analysis output"),
    ("playlists", "user_id", "the user's playlists"),
    ("contacts", "user_id", "support correspondence"),
    ("feedbacks", "user_id", "submitted feedback"),
    ("tracks", "user_id", "uploaded tracks — RESTRICT, so this also unblocks the delete"),
)

# Handled by the database on DELETE, listed so the manifest is honest about what goes.
CASCADED = (
    "user_sessions", "user_tokens", "user_auth_providers", "user_subscriptions", "carts",
    "track_ratings", "playlist_ratings", "user_track_engagements", "user_playlist_engagements",
    "user_service_connections", "playlist_embed_tokens", "acr_infringement_logs",
    "user_operation_limits", "user_roles", "user_spotify_apps", "billing_notifications",
)


@dataclass
class PurgeManifest:
    """What a purge did, or would do. Returned by both the dry run and the real thing."""

    user_id: int
    user_uuid: str
    email: str
    dry_run: bool
    kept: Dict[str, int] = field(default_factory=dict)
    anonymised: Dict[str, int] = field(default_factory=dict)
    deleted: Dict[str, int] = field(default_factory=dict)
    cascaded: List[str] = field(default_factory=list)
    track_uuids: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "user_uuid": self.user_uuid,
            "email": self.email,
            "dry_run": self.dry_run,
            "kept": self.kept,
            "anonymised": self.anonymised,
            "deleted": self.deleted,
            "cascaded": self.cascaded,
            "media_assets_queued": len(self.track_uuids),
            "warnings": self.warnings,
        }


class AccountPurgeService:
    """Irreversibly destroys a deleted account, keeping what Q1 says to keep."""

    async def tombstone_id(self, db: AsyncSession) -> Optional[int]:
        row = (
            await db.execute(
                text("SELECT id FROM users WHERE email = :email"), {"email": TOMBSTONE_EMAIL}
            )
        ).first()
        return row[0] if row else None

    @staticmethod
    async def _count(db: AsyncSession, table: str, column: str, user_id: int) -> int:
        """Row count for one table. Returns -1 for a table that does not exist.

        A missing table is reported rather than raised: the purge must still be able to run and
        say what it skipped, instead of failing halfway through and leaving an account
        half-destroyed.
        """
        try:
            return (
                await db.execute(
                    text(f"SELECT COUNT(*) FROM `{table}` WHERE `{column}` = :uid"),
                    {"uid": user_id},
                )
            ).scalar() or 0
        except Exception as exc:  # noqa: BLE001
            logger.warning("PURGE: cannot count %s.%s: %s", table, column, exc)
            return -1

    async def _track_uuids(self, db: AsyncSession, user_id: int) -> List[str]:
        """The user's uploaded tracks, read BEFORE deletion so their media can still be wiped.

        The uuid is the media server's handle. Once the rows are gone there is no way to ask what
        to delete, so the assets would be orphaned on disk forever.
        """
        try:
            rows = (
                await db.execute(
                    text("SELECT uuid FROM tracks WHERE user_id = :uid"), {"uid": user_id}
                )
            ).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception as exc:  # noqa: BLE001
            logger.warning("PURGE: could not read track uuids for user %s: %s", user_id, exc)
            return []

    async def build_manifest(self, db: AsyncSession, user: User) -> PurgeManifest:
        """Count everything, change nothing."""
        manifest = PurgeManifest(
            user_id=user.id, user_uuid=user.uuid, email=user.email, dry_run=True,
            cascaded=list(CASCADED),
        )

        for table, column, _why in REPOINT:
            n = await self._count(db, table, column, user.id)
            if n > 0:
                manifest.kept[f"{table}.{column}"] = n
            elif n < 0:
                manifest.warnings.append(f"could not read {table}")

        for table, _col, owner, _why in SCRUB:
            n = await self._count(db, table, owner, user.id)
            if n > 0:
                manifest.anonymised[table] = n

        for table, column, _why in DELETE:
            n = await self._count(db, table, column, user.id)
            if n > 0:
                manifest.deleted[table] = n
            elif n < 0:
                manifest.warnings.append(f"could not read {table}")

        manifest.track_uuids = await self._track_uuids(db, user.id)
        return manifest

    async def purge(
        self, db: AsyncSession, user: User, *, dry_run: bool = True
    ) -> PurgeManifest:
        """Destroy the account. ``dry_run=True`` (the default) only reports.

        Defaulting to a dry run is deliberate: the destructive path should be the one you have to
        ask for by name.
        """
        manifest = await self.build_manifest(db, user)
        manifest.dry_run = dry_run
        if dry_run:
            return manifest

        if user.email == TOMBSTONE_EMAIL:
            raise ValueError("Refusing to purge the tombstone user.")

        tombstone = await self.tombstone_id(db)
        if tombstone is None:
            # Without it the repoint step cannot run, and going ahead would let CASCADE destroy
            # every invoice. Refuse rather than half-purge.
            raise RuntimeError(
                "Tombstone user is missing — run `alembic upgrade head`. Refusing to purge, "
                "because financial records would be destroyed instead of preserved."
            )
        if tombstone == user.id:
            raise ValueError("Refusing to purge the tombstone user.")

        # The uploaded-track wipe needs the partner scope, and the rows are about to disappear.
        partner_id = user.partner_id
        track_uuids = manifest.track_uuids

        # Bypass the multi-tenancy failsafe: a purge legitimately spans partner-scoped rows and
        # runs outside a normal request context.
        from app.core.context import set_admin_context

        set_admin_context(True)

        # 1. KEEP — repoint before anything else. The three CASCADE tables here would otherwise be
        #    deleted by the final DELETE, taking the accounting with them.
        for table, column, why in REPOINT:
            try:
                result = await db.execute(
                    text(f"UPDATE `{table}` SET `{column}` = :tomb WHERE `{column}` = :uid"),
                    {"tomb": tombstone, "uid": user.id},
                )
                if result.rowcount:
                    logger.info("PURGE: kept %s row(s) in %s (%s)", result.rowcount, table, why)
            except Exception as exc:  # noqa: BLE001
                # Cannot continue: deleting the user now would destroy what we failed to save.
                raise RuntimeError(f"PURGE ABORTED — could not preserve {table}: {exc}") from exc

        # 2. ANONYMISE — keep the analytics, drop the PII the foreign key cannot reach.
        for table, column, owner, _why in SCRUB:
            try:
                await db.execute(
                    text(f"UPDATE `{table}` SET `{column}` = NULL WHERE `{owner}` = :uid"),
                    {"uid": user.id},
                )
            except Exception as exc:  # noqa: BLE001
                manifest.warnings.append(f"could not scrub {table}.{column}: {exc}")

        # 3. DELETE the person's content. Explicit even where SET NULL exists — that would orphan
        #    these, and an ownerless playlist is still a playlist.
        for table, column, _why in DELETE:
            try:
                await db.execute(
                    text(f"DELETE FROM `{table}` WHERE `{column}` = :uid"), {"uid": user.id}
                )
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(f"PURGE ABORTED — could not delete {table}: {exc}") from exc

        # 4. Usage history is keyed by a STRING subject, not a foreign key, so nothing removes it
        #    automatically. The aggregate is worth keeping; the identifier is not.
        try:
            await db.execute(
                text(
                    "UPDATE usage_period_history SET subject_id = :anon "
                    "WHERE subject_type = 'user' AND subject_id = :uid"
                ),
                {"anon": f"purged:{user.id}", "uid": str(user.id)},
            )
        except Exception as exc:  # noqa: BLE001
            manifest.warnings.append(f"could not scrub usage_period_history: {exc}")

        # 5. The user row. CASCADE now clears the 16 tables listed in `CASCADED`.
        await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user.id})
        await db.commit()

        logger.warning(
            "PURGE: destroyed user %s (%s) — kept %s, deleted %s",
            user.id, manifest.email, manifest.kept, manifest.deleted,
        )

        # 6. Media assets last, and outside the transaction: the task is idempotent and retries,
        #    and a media-server outage must not roll back a completed database purge.
        self._queue_asset_wipe(partner_id, track_uuids, manifest)
        return manifest

    @staticmethod
    def _queue_asset_wipe(
        partner_id: Optional[int], track_uuids: List[str], manifest: PurgeManifest
    ) -> None:
        """Hand each track's media to the existing purge task (embeddings, segments, peaks, audio).

        Best-effort: the rows are already gone, so a failure here leaves files on disk rather than
        an inconsistent database. Recorded as a warning so it can be cleaned up by hand.
        """
        if not track_uuids:
            return
        try:
            from app.tasks.track_tasks import purge_uploaded_track_assets

            for track_uuid in track_uuids:
                purge_uploaded_track_assets.delay(partner_id, track_uuid)
        except Exception as exc:  # noqa: BLE001
            manifest.warnings.append(
                f"{len(track_uuids)} track asset(s) not queued for deletion: {exc}"
            )
