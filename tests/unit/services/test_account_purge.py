"""
Account purge — what survives, what dies, and the order that decides it
=======================================================================

The dangerous property here is not deletion; it is **preservation**. Three tables holding records
we are required to keep — ``billing_invoices``, ``subscription_events``, ``billing_consents`` — are
declared ``CASCADE`` and ``NOT NULL`` against ``users.id``. Deleting the user row destroys every
one of them, silently, as a side effect. Nothing raises. Nothing logs. The invoices are simply
gone, and nobody notices until an accountant asks.

Repointing them at the tombstone user BEFORE the delete is the only thing standing between a purge
and that outcome, which is why the order of operations is asserted here rather than left to a
comment.

The rest of the surface:

* 15 foreign keys are already ``SET NULL`` and anonymise themselves;
* 18 are ``CASCADE`` over data we intend to destroy anyway;
* 4 are ``RESTRICT`` and simply block the delete until handled.

SQL is executed against a recording stub — these assert the statements issued and their order, not
MySQL's behaviour.
"""

from __future__ import annotations

import re
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.account_purge_service import (
    CASCADED,
    DELETE,
    REPOINT,
    SCRUB,
    TOMBSTONE_EMAIL,
    AccountPurgeService,
)

TOMBSTONE_ID = 999


def _user(user_id=42, email="buyer@example.com", uuid="u-42"):
    u = MagicMock()
    u.id = user_id
    u.uuid = uuid
    u.email = email
    u.partner_id = 1
    u.purge_due_at = None
    return u


class RecordingDb:
    """Session stub that records every statement, in order."""

    def __init__(self, counts=1, tombstone=TOMBSTONE_ID, track_uuids=("trk-1", "trk-2")):
        self.statements: list[str] = []
        self._counts = counts
        self._tombstone = tombstone
        self._track_uuids = list(track_uuids)
        self.committed = False

    async def execute(self, stmt, params=None):
        sql = re.sub(r"\s+", " ", str(stmt)).strip()
        self.statements.append(sql)
        result = MagicMock()

        if "FROM users WHERE email" in sql:
            result.first.return_value = (self._tombstone,) if self._tombstone else None
        elif "SELECT uuid FROM tracks" in sql:
            result.fetchall.return_value = [(u,) for u in self._track_uuids]
        elif sql.startswith("SELECT COUNT(*)"):
            result.scalar.return_value = self._counts
        result.rowcount = self._counts
        return result

    async def commit(self):
        self.committed = True

    def sql_matching(self, needle):
        return [s for s in self.statements if needle in s]

    def index_of(self, needle):
        for i, s in enumerate(self.statements):
            if needle in s:
                return i
        return -1


# --------------------------------------------------------------------------- #
# Dry run
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_dry_run_writes_nothing() -> None:
    """Irreversible work must be inspectable first — and the default must be the safe one."""
    db = RecordingDb()
    manifest = await AccountPurgeService().purge(db, _user())  # dry_run defaults True

    assert manifest.dry_run is True
    assert not db.committed
    assert not [s for s in db.statements if s.startswith(("UPDATE", "DELETE"))]


@pytest.mark.asyncio
async def test_dry_run_reports_every_category() -> None:
    manifest = await AccountPurgeService().build_manifest(RecordingDb(), _user())
    payload = manifest.as_dict()

    assert payload["kept"], "financial/audit rows must be reported as kept"
    assert payload["deleted"], "user content must be reported as deleted"
    assert payload["cascaded"] == list(CASCADED)
    assert payload["media_assets_queued"] == 2


@pytest.mark.asyncio
async def test_a_missing_table_is_a_warning_not_a_crash() -> None:
    """A purge that dies halfway leaves an account partly destroyed — the worst outcome."""
    db = RecordingDb()

    async def boom(stmt, params=None):
        raise RuntimeError("Table 'manual_takedowns' doesn't exist")

    db.execute = boom
    manifest = await AccountPurgeService().build_manifest(db, _user())
    assert manifest.warnings


# --------------------------------------------------------------------------- #
# Preservation — the part with no second chance
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_financial_rows_are_repointed_before_the_user_is_deleted() -> None:
    """THE TEST THIS FILE EXISTS FOR.

    `billing_invoices`, `subscription_events` and `billing_consents` are CASCADE + NOT NULL.
    Delete the user first and they are destroyed with it — no error, no log, just missing money.
    """
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    delete_user_at = db.index_of("DELETE FROM users")
    assert delete_user_at > 0

    for table, column, _why in REPOINT:
        repoint_at = db.index_of(f"UPDATE `{table}` SET `{column}`")
        assert repoint_at >= 0, f"{table} was never repointed — it would be destroyed"
        assert repoint_at < delete_user_at, f"{table} repointed AFTER the user delete — too late"


@pytest.mark.asyncio
async def test_repointing_targets_the_tombstone() -> None:
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)
    assert db.sql_matching("UPDATE `orders` SET `user_id` = :tomb")


@pytest.mark.asyncio
async def test_a_missing_tombstone_aborts_instead_of_purging() -> None:
    """Going ahead without it would let CASCADE destroy the invoices instead of preserving them.

    Refusing loudly is the only safe failure here.
    """
    db = RecordingDb(tombstone=None)
    with pytest.raises(RuntimeError, match="Tombstone"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    assert not db.sql_matching("DELETE FROM users")
    assert not db.committed


@pytest.mark.asyncio
async def test_a_failed_repoint_aborts_before_anything_is_deleted() -> None:
    """If we could not save it, we must not delete the thing that would take it down."""
    db = RecordingDb()
    original = db.execute

    async def fail_on_invoices(stmt, params=None):
        sql = str(stmt)
        if "UPDATE `billing_invoices`" in sql:
            raise RuntimeError("deadlock")
        return await original(stmt, params)

    db.execute = fail_on_invoices
    with pytest.raises(RuntimeError, match="could not preserve billing_invoices"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    assert not db.sql_matching("DELETE FROM users")


# --------------------------------------------------------------------------- #
# Destruction
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_user_content_is_deleted_explicitly() -> None:
    """SET NULL would ORPHAN these, not remove them — an ownerless playlist is still a playlist."""
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    for table, column, _why in DELETE:
        assert db.sql_matching(f"DELETE FROM `{table}` WHERE `{column}`"), f"{table} survived"


@pytest.mark.asyncio
async def test_analytics_are_kept_but_stripped_of_pii() -> None:
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    for table, column, owner, _why in SCRUB:
        assert db.sql_matching(f"UPDATE `{table}` SET `{column}` = NULL")
    # kept, not deleted
    assert not db.sql_matching("DELETE FROM `consumption_events`")


@pytest.mark.asyncio
async def test_usage_history_is_anonymised_not_dropped() -> None:
    """Keyed by a STRING subject, so no foreign key touches it — it needs doing by hand."""
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe"):
        await AccountPurgeService().purge(db, _user(), dry_run=False)
    assert db.sql_matching("UPDATE usage_period_history SET subject_id")


@pytest.mark.asyncio
async def test_track_uuids_are_read_before_the_rows_are_deleted() -> None:
    """Afterwards there is no way to ask what to wipe, and the media is orphaned on disk forever."""
    db = RecordingDb()
    with patch.object(AccountPurgeService, "_queue_asset_wipe") as wipe:
        await AccountPurgeService().purge(db, _user(), dry_run=False)

    read_at = db.index_of("SELECT uuid FROM tracks")
    delete_at = db.index_of("DELETE FROM `tracks`")
    assert 0 <= read_at < delete_at
    assert wipe.call_args.args[1] == ["trk-1", "trk-2"]


@pytest.mark.asyncio
async def test_media_wipe_failure_does_not_undo_the_purge() -> None:
    """The database work is committed; files left behind are a cleanup job, not a rollback."""
    db = RecordingDb()
    manifest = AccountPurgeService()
    with patch("app.tasks.track_tasks.purge_uploaded_track_assets") as task:
        task.delay.side_effect = RuntimeError("broker down")
        result = await manifest.purge(db, _user(), dry_run=False)

    assert db.committed
    assert any("not queued" in w for w in result.warnings)


# --------------------------------------------------------------------------- #
# Guards
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_the_tombstone_cannot_be_purged_by_email() -> None:
    """It owns other people's financial records; deleting it would cascade through all of them."""
    with pytest.raises(ValueError, match="tombstone"):
        await AccountPurgeService().purge(
            RecordingDb(), _user(email=TOMBSTONE_EMAIL), dry_run=False
        )


@pytest.mark.asyncio
async def test_the_tombstone_cannot_be_purged_by_id() -> None:
    """Guards on the id too — a renamed tombstone would slip past the email check."""
    db = RecordingDb(tombstone=42)
    with pytest.raises(ValueError, match="tombstone"):
        await AccountPurgeService().purge(db, _user(user_id=42), dry_run=False)
