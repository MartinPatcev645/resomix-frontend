"""
Account Scrub
=============

Removes the *person* from an account while keeping everything the account *did*.

WHY IT IS CALLED `scrub` AND NOT `anonymise`
--------------------------------------------

Because it does not anonymise anything, and a method name is read as a promise.

The account keeps its ``id`` and ``uuid`` — that is the entire point, it is what leaves playlists,
uploads, support history and invoices joined and analysable. Invoices also keep the customer's
name, because tax law requires it. Both of those mean the retained data can still be attributed to
a person: under the GDPR that is **pseudonymisation**, not anonymisation, and the data stays
personal data with every data-subject right attached.

Calling this ``anonymise()`` would tell the next person to touch it something untrue, and would
invite a privacy policy that repeats the claim. See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §3.

HOW IT RELATES TO `AccountPurgeService`
---------------------------------------

``AccountPurgeService`` destroys rows. This one keeps them. Both remain: purge is the hard-delete
path if it is ever needed; scrub is what a deletion request now runs.

Scrub is also the **safer** of the two by construction. It never deletes the ``users`` row, so the
cascade hazard that makes purge dangerous — three billing tables are ``CASCADE`` *and* ``NOT NULL``
against ``users.id``, so deleting the user would silently destroy every invoice — cannot fire here
at all.

TWO STEPS, AND THIS IS THE SECOND
---------------------------------

A user's deletion request only deactivates the account. This runs later, when an admin says so.
There is no timer: the operation is irreversible, and an irreversible operation firing unattended
on a clock is one bad ``purge_due_at`` away from destroying an account nobody meant to touch.

DRY RUN FIRST
-------------

``scrub(..., dry_run=True)`` — the default — counts everything and writes nothing. The manifest it
returns is what the admin UI shows for confirmation, so the admin approves what the operation will
actually do rather than a description of it that may have drifted.

TOLERATES SCHEMA DRIFT — BY LOOKING FIRST, NOT BY CATCHING
-----------------------------------------------------------

Environments are not always on the same migration, so the real schema is read once up front and
every statement is built from what is actually there.

This is not a stylistic preference over try/except. Consider ``contacts`` on a database that has
not yet had the ``client_ip`` migration:

    UPDATE contacts SET name=NULL, email=NULL, phone=NULL, client_ip=NULL, user_agent=NULL ...

MySQL rejects the **whole statement** for the two unknown columns — so catching the error and
moving on would leave the name, the email and the phone number sitting there while the run reported
success. A silent under-scrub is the worst outcome available: it looks compliant and is not.

Resolving the columns first means such a database still scrubs everything it can, and the manifest
names what it could not.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

# RFC 2606 reserves `.invalid`, which is guaranteed never to resolve. So even if some future code
# path tries to mail a scrubbed account, it cannot reach a real person — including whoever might
# one day own `resomix.com`'s catch-all.
SCRUBBED_EMAIL_DOMAIN = "resomix.invalid"


def scrubbed_email(user_id: int) -> str:
    return f"deleted+{user_id}@{SCRUBBED_EMAIL_DOMAIN}"


def scrubbed_username(user_id: int) -> str:
    return f"deleted_user_{user_id}"


# ---------------------------------------------------------------------------
# 1. DELETED OUTRIGHT — credentials and third-party links.
#
#    Tokens held at Apple, Google and Spotify are identifiers *at the provider*, so they have to be
#    destroyed rather than merely unlinked. Sessions go so the account cannot be signed back into.
# ---------------------------------------------------------------------------
DELETE_TABLES: Tuple[Tuple[str, str, str], ...] = (
    ("user_service_connections", "user_id", "Apple/Spotify OAuth tokens + external_account_id"),
    ("user_auth_providers", "user_id", "the Google subject id"),
    ("user_tokens", "user_id", "password-reset and verification tokens"),
    ("user_sessions", "user_id", "live sessions, plus their ip_address and user_agent"),
)


@dataclass(frozen=True)
class ScrubTarget:
    """One table's worth of columns to blank, and how to find that user's rows in it.

    ``where`` is a fragment taking a single ``:uid`` parameter. Most tables are simply
    ``user_id = :uid``; the two that are not are the reason this is a field rather than a constant.
    """

    table: str
    columns: Tuple[str, ...]
    where: str = "`user_id` = :uid"
    why: str = ""


# ---------------------------------------------------------------------------
# 2. SCRUBBED IN PLACE — the rows stay, joined to the user, minus the identifiers.
#
#    This is the bulk of what is kept. Note what is NOT listed: `contacts.message`,
#    `feedbacks.message`, every score, every timestamp and every `user_id`. The support history
#    keeps all of its value; what it loses is an address nothing ever queried on.
# ---------------------------------------------------------------------------
SCRUB_TARGETS: Tuple[ScrubTarget, ...] = (
    ScrubTarget(
        "contacts",
        ("name", "email", "phone", "client_ip", "user_agent"),
        why="keep the message, the subject and the B2B answers",
    ),
    ScrubTarget(
        "feedbacks",
        ("client_ip", "user_agent"),
        why="keep the message, the category and both scores",
    ),
    ScrubTarget(
        "user_messages",
        ("recipient_email",),
        why="keep what we sent and who sent it",
    ),
    ScrubTarget(
        "consumption_events",
        ("client_ip",),
        why="keep playback analytics; the IP is the only personal data on the row",
    ),
    ScrubTarget(
        "tracks",
        ("source_file_path",),
        why="uploaded filenames routinely contain names; the derived analysis is unaffected",
    ),
    # `audio_files` has no `user_id` — it hangs off a track. Reached through a subquery rather than
    # left alone, because `original_filename` is exactly the free-text personal data that makes a
    # half-done scrub worse than none.
    ScrubTarget(
        "audio_files",
        ("original_filename",),
        where="`track_id` IN (SELECT `id` FROM `tracks` WHERE `user_id` = :uid)",
        why="the uploaded filename, reached via the track",
    ),
)

# ---------------------------------------------------------------------------
# 3. KEPT — stated explicitly so the manifest says what survives rather than staying silent.
#
#    A manifest that only lists damage invites the reader to assume the rest is gone.
# ---------------------------------------------------------------------------
KEPT_TABLES: Tuple[Tuple[str, str, str], ...] = (
    ("billing_invoices", "user_id", "legal obligation — tax and accounting law"),
    ("orders", "user_id", "legal obligation"),
    ("subscription_events", "user_id", "legal obligation / revenue reporting"),
    ("billing_consents", "user_id", "evidence of consent"),
    ("purchases", "user_id", "legal obligation"),
    ("playlists", "user_id", "kept against the anonymous user id"),
    ("playlist_ratings", "user_id", "kept"),
    ("track_ratings", "user_id", "kept"),
    ("user_playlist_engagements", "user_id", "kept"),
    ("user_track_engagements", "user_id", "kept"),
    ("track_analysis_results", "user_id", "kept"),
    ("user_subscriptions", "user_id", "kept"),
    ("user_plan_grants", "user_id", "kept"),
    ("user_operation_limits", "user_id", "kept"),
    ("contacts", "user_id", "kept, identifiers scrubbed"),
    ("feedbacks", "user_id", "kept, identifiers scrubbed"),
    ("consumption_events", "user_id", "kept, IP scrubbed"),
    ("tracks", "user_id", "kept, source path scrubbed"),
)


@dataclass
class ScrubManifest:
    """What a scrub did, or would do. Returned by both the dry run and the real thing."""

    user_id: int
    user_uuid: str
    email: str
    dry_run: bool
    already_scrubbed: bool = False
    deleted: Dict[str, int] = field(default_factory=dict)
    scrubbed: Dict[str, int] = field(default_factory=dict)
    kept: Dict[str, int] = field(default_factory=dict)
    playlists_made_private: int = 0
    waitlist_entries: int = 0
    # Media the caller should remove from disk. Read BEFORE anything is written, because the path
    # is gone afterwards and the assets would be orphaned forever.
    track_uuids: List[str] = field(default_factory=list)
    profile_picture: Optional[str] = None
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "user_uuid": self.user_uuid,
            "email": self.email,
            "dry_run": self.dry_run,
            "already_scrubbed": self.already_scrubbed,
            "deleted": self.deleted,
            "scrubbed": self.scrubbed,
            "kept": self.kept,
            "playlists_made_private": self.playlists_made_private,
            "waitlist_entries": self.waitlist_entries,
            "media_assets_queued": len(self.track_uuids),
            "profile_picture": self.profile_picture,
            "warnings": self.warnings,
        }


class AccountScrubService:
    """Removes the person from an account, keeps what the account did."""

    # ------------------------------------------------------------------ #
    # Schema
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _schema(db: AsyncSession) -> Dict[str, set]:
        """``{table: {column, ...}}`` for the current database, in one query.

        Read once so that nothing below has to discover a missing table by failing against it.
        Returns ``{}`` if even this cannot be read, which the callers treat as "assume nothing is
        there" — a scrub that does less than it should is recoverable; one that reports success
        while leaving personal data behind is not.
        """
        try:
            rows = (
                await db.execute(
                    text(
                        "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS "
                        "WHERE TABLE_SCHEMA = DATABASE()"
                    )
                )
            ).fetchall()
        except Exception as exc:  # noqa: BLE001
            logger.error("SCRUB: could not read the schema: %s", exc)
            return {}

        out: Dict[str, set] = {}
        for table, column in rows:
            out.setdefault(table, set()).add(column)
        return out

    @staticmethod
    def _resolve(schema: Dict[str, set], target: "ScrubTarget") -> Tuple[List[str], List[str]]:
        """Split a target's columns into (present, missing) against the real schema."""
        available = schema.get(target.table, set())
        present = [c for c in target.columns if c in available]
        missing = [c for c in target.columns if c not in available]
        return present, missing

    # ------------------------------------------------------------------ #
    # Reading
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _count(db: AsyncSession, table: str, where: str, user_id: int) -> int:
        """Row count for one table. Returns -1 when the table or column is not there.

        Reported rather than raised: environments drift between migrations, and a scrub that dies
        partway leaves an account half-done — much worse than one that skips a table and says so.
        """
        try:
            return (
                await db.execute(
                    text(f"SELECT COUNT(*) FROM `{table}` WHERE {where}"), {"uid": user_id}
                )
            ).scalar() or 0
        except Exception as exc:  # noqa: BLE001
            logger.warning("SCRUB: cannot count %s: %s", table, exc)
            return -1

    @staticmethod
    async def _track_uuids(db: AsyncSession, user_id: int) -> List[str]:
        """The user's uploaded tracks, read before anything is written.

        The uuid is the media server's handle. Once the paths are blanked there is no way to ask
        what to delete, and the assets sit on disk forever.
        """
        try:
            rows = (
                await db.execute(
                    text("SELECT `uuid` FROM `tracks` WHERE `user_id` = :uid"), {"uid": user_id}
                )
            ).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception as exc:  # noqa: BLE001
            logger.warning("SCRUB: could not read track uuids for user %s: %s", user_id, exc)
            return []

    async def build_manifest(self, db: AsyncSession, user: User) -> ScrubManifest:
        """Count everything, change nothing."""
        schema = await self._schema(db)
        manifest = ScrubManifest(
            user_id=user.id,
            user_uuid=user.uuid,
            email=user.email,
            dry_run=True,
            already_scrubbed=getattr(user, "anonymized_at", None) is not None,
            profile_picture=user.profile_picture,
        )

        for table, column, _why in DELETE_TABLES:
            if column not in schema.get(table, set()):
                manifest.warnings.append(f"{table} is not in this database — skipped")
                continue
            n = await self._count(db, table, f"`{column}` = :uid", user.id)
            if n > 0:
                manifest.deleted[table] = n

        for target in SCRUB_TARGETS:
            present, missing = self._resolve(schema, target)
            if missing:
                # Named individually. "contacts partially scrubbed" is a thing an admin must be
                # able to see, because the row will still hold personal data afterwards.
                manifest.warnings.append(
                    f"{target.table}: no column(s) {', '.join(missing)} — not scrubbed"
                )
            if not present:
                continue
            n = await self._count(db, target.table, target.where, user.id)
            if n > 0:
                manifest.scrubbed[target.table] = n

        for table, column, _why in KEPT_TABLES:
            if column not in schema.get(table, set()):
                continue
            n = await self._count(db, table, f"`{column}` = :uid", user.id)
            if n > 0:
                manifest.kept[table] = n

        if "is_public" in schema.get("playlists", set()):
            manifest.playlists_made_private = max(
                0,
                await self._count(
                    db, "playlists", "`user_id` = :uid AND `is_public` = 1", user.id
                ),
            )

        manifest.track_uuids = (
            await self._track_uuids(db, user.id) if "tracks" in schema else []
        )

        if user.email and "waitlists" in schema:
            manifest.waitlist_entries = (
                await db.execute(
                    text("SELECT COUNT(*) FROM `waitlists` WHERE `email` = :email"),
                    {"email": user.email},
                )
            ).scalar() or 0

        return manifest

    # ------------------------------------------------------------------ #
    # Writing
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _execute(db: AsyncSession, sql: str, params: dict, label: str) -> int:
        """Run one statement.

        Deliberately does NOT swallow errors. Every caller has already checked the schema, so a
        failure here is a real fault — and the whole run is one transaction, so raising leaves the
        account untouched rather than half-scrubbed.
        """
        result = await db.execute(text(sql), params)
        return result.rowcount or 0

    async def scrub(
        self,
        db: AsyncSession,
        user: User,
        *,
        dry_run: bool = True,
        force_playlists_private: bool = True,
    ) -> ScrubManifest:
        """Remove the person from this account.

        ``dry_run=True`` is the default on purpose: the irreversible path should be the one a
        caller has to ask for by name.

        Everything runs in a single transaction and commits once at the end, so a failure partway
        leaves the account exactly as it was rather than half-scrubbed.

        Idempotent. Running it twice reaches the same state and does not raise — which matters,
        because "did that actually go through?" is a question an admin will answer by trying again.
        """
        schema = await self._schema(db)
        manifest = await self.build_manifest(db, user)
        manifest.dry_run = dry_run
        if dry_run:
            return manifest

        # Read before write. After the users row is scrubbed the original address is gone, and it
        # is the only key into `waitlists`, which has no user_id.
        original_email = user.email
        user_id = user.id

        for table, column, _why in DELETE_TABLES:
            if column not in schema.get(table, set()):
                continue
            n = await self._execute(
                db, f"DELETE FROM `{table}` WHERE `{column}` = :uid", {"uid": user_id}, table
            )
            if n:
                manifest.deleted[table] = n

        for target in SCRUB_TARGETS:
            present, _missing = self._resolve(schema, target)
            if not present:
                continue
            # Only the columns that exist. Naming a missing one would make MySQL reject the whole
            # statement and silently leave the others unscrubbed — see the module docstring.
            assignments = ", ".join(f"`{c}` = NULL" for c in present)
            n = await self._execute(
                db,
                f"UPDATE `{target.table}` SET {assignments} WHERE {target.where}",
                {"uid": user_id},
                target.table,
            )
            if n:
                manifest.scrubbed[target.table] = n

        if force_playlists_private and "is_public" in schema.get("playlists", set()):
            # A public playlist under someone's chosen name outlives the scrub and defeats it.
            manifest.playlists_made_private = await self._execute(
                db,
                "UPDATE `playlists` SET `is_public` = 0 WHERE `user_id` = :uid AND `is_public` = 1",
                {"uid": user_id},
                "playlists",
            )

        # `waitlists` has no foreign key to reach it — the address is the only handle, which is
        # exactly why it survives a scrub that only walks user_id.
        if original_email and "waitlists" in schema:
            manifest.waitlist_entries = await self._execute(
                db,
                "UPDATE `waitlists` SET `email` = :new WHERE `email` = :old",
                {"new": scrubbed_email(user_id), "old": original_email},
                "waitlists",
            )

        self._scrub_user_row(user)
        await db.commit()

        logger.info(
            "SCRUB: user %s (%s) scrubbed — %s deleted, %s scrubbed, %s kept",
            user_id, manifest.user_uuid,
            sum(manifest.deleted.values()), sum(manifest.scrubbed.values()),
            sum(manifest.kept.values()),
        )
        return manifest

    @staticmethod
    def _scrub_user_row(user: User) -> None:
        """The account row itself. Last, so the original email is available to everything above.

        ``id`` and ``uuid`` are untouched — that is the whole design, and the reason every kept row
        still joins.
        """
        user.name = None
        user.username = scrubbed_username(user.id)
        user.email = scrubbed_email(user.id)
        user.password_hash = None
        user.profile_picture = None
        user.is_active = False
        user.is_email_verified = False
        user.is_two_factor_enabled = False
        # Recorded rather than inferred from the email format: a real account that happened to
        # register a lookalike address must never read as scrubbed.
        if getattr(user, "anonymized_at", None) is None:
            user.anonymized_at = datetime.utcnow()

    # ------------------------------------------------------------------ #
    # Guards
    # ------------------------------------------------------------------ #

    @staticmethod
    def is_scrubbed(user: User) -> bool:
        return getattr(user, "anonymized_at", None) is not None

    @staticmethod
    def assert_restorable(user: User) -> None:
        """Raise if this account is past the point of return.

        Restoration flips `is_active` back — which on a scrubbed account would produce a working
        login for a row with no email, no name and no password. Failing loudly is the only correct
        answer; a silent no-op would look like success on the admin screen.
        """
        if AccountScrubService.is_scrubbed(user):
            raise ValueError(
                "This account has already been scrubbed. Its personal details were removed and "
                "cannot be restored."
            )
