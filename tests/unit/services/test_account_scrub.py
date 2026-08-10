"""
Account scrub
=============

Removing the person from an account while keeping what the account did. The properties pinned here
are the ones where being wrong is either a compliance failure or an unrecoverable data loss:

* **`id` and `uuid` must survive.** They are the correlation key the entire design exists to
  preserve. If they ever changed, every playlist, invoice and support message would detach at once
  — and silently, because each row would still be valid, just orphaned.
* **A dry run must write nothing.** It is what an admin reads before confirming an irreversible
  operation.
* **Billing must be untouched.** Three billing tables are `CASCADE` + `NOT NULL` against
  `users.id`. That hazard cannot fire here because the users row is never deleted — and this test
  is what makes it loud if someone later "simplifies" the scrub back into a delete.
* **The original email must be read before the users row is rewritten.** It is the only handle
  into `waitlists`, which has no foreign key at all.
* **Idempotence.** "Did that go through?" is a question an admin answers by trying again.

No database: the session is a stub that records every statement it was handed.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.account_scrub_service import (
    DELETE_TABLES,
    KEPT_TABLES,
    SCRUB_TARGETS,
    AccountScrubService,
    scrubbed_email,
    scrubbed_username,
)


def _user(user_id=42, email="someone@example.com", scrubbed=False):
    """The REAL User model.

    A MagicMock answers to any attribute, which is how a column that does not exist passes in a
    test and raises in production — that exact trap cost us a 500 on the plan-grant endpoint.
    """
    from app.models.user import User

    u = User()
    u.id = user_id
    u.uuid = f"uuid-{user_id}"
    u.email = email
    u.username = "someone"
    u.name = "Some One"
    u.password_hash = "$2b$12$notarealhash"
    u.profile_picture = "/uploads/avatars/42.jpg"
    u.is_active = True
    u.is_email_verified = True
    u.is_two_factor_enabled = True
    u.anonymized_at = datetime(2026, 1, 1) if scrubbed else None
    return u


# The schema the service resolves its statements against. Modelled rather than mocked away,
# because "which columns actually exist" is now the input that decides what each statement says —
# a stub that answered every query identically would test nothing about that.
FULL_SCHEMA = {
    "users": {"id", "uuid", "email", "username", "name", "anonymized_at"},
    "user_service_connections": {"id", "user_id", "access_token_enc"},
    "user_auth_providers": {"user_id", "provider", "provider_uid"},
    "user_tokens": {"id", "user_id", "token"},
    "user_sessions": {"id", "user_id", "ip_address", "user_agent"},
    "contacts": {"id", "user_id", "name", "email", "phone", "client_ip", "user_agent", "message"},
    "feedbacks": {"id", "user_id", "client_ip", "user_agent", "message", "satisfaction"},
    "user_messages": {"id", "user_id", "recipient_email", "body"},
    "consumption_events": {"id", "user_id", "client_ip"},
    "tracks": {"id", "uuid", "user_id", "source_file_path"},
    "audio_files": {"id", "track_id", "original_filename"},
    "playlists": {"id", "user_id", "is_public", "name"},
    "playlist_ratings": {"id", "user_id"},
    "track_ratings": {"id", "user_id"},
    "user_playlist_engagements": {"id", "user_id"},
    "user_track_engagements": {"id", "user_id"},
    "track_analysis_results": {"id", "user_id"},
    "user_subscriptions": {"id", "user_id"},
    "user_plan_grants": {"id", "user_id"},
    "user_operation_limits": {"id", "user_id"},
    "billing_invoices": {"id", "user_id"},
    "orders": {"id", "user_id"},
    "subscription_events": {"id", "user_id"},
    "billing_consents": {"id", "user_id"},
    "purchases": {"id", "user_id"},
    "waitlists": {"id", "email"},
}


class _Session:
    """Records statements, and serves a schema so column resolution is genuinely exercised.

    `drop_tables` / `drop_columns` model a database behind on migrations, which is the situation
    the service is built to survive.
    """

    def __init__(self, rows: int = 3, drop_tables: tuple = (), drop_columns: dict | None = None):
        self.rows = rows
        self.schema = {
            table: set(cols) - set((drop_columns or {}).get(table, ()))
            for table, cols in FULL_SCHEMA.items()
            if table not in drop_tables
        }
        self.statements: list[str] = []
        self.commits = 0

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        self.statements.append(sql)
        result = MagicMock()

        if "information_schema" in sql:
            result.fetchall.return_value = [
                (table, col) for table, cols in self.schema.items() for col in cols
            ]
            return result

        # A statement against something absent is the bug this design exists to prevent, so the
        # stub fails loudly rather than tolerating it.
        for table in FULL_SCHEMA:
            if f"`{table}`" in sql and table not in self.schema:
                raise AssertionError(f"issued a statement against missing table {table}: {sql}")

        result.scalar.return_value = self.rows
        result.rowcount = self.rows
        result.fetchall.return_value = [("track-uuid-1",), ("track-uuid-2",)]
        return result

    async def commit(self):
        self.commits += 1

    def writes(self):
        return [s for s in self.statements if s.lstrip().upper().startswith(("UPDATE", "DELETE"))]


# --------------------------------------------------------------------------- #
# The dry run
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_dry_run_writes_nothing() -> None:
    """The admin reads this manifest before confirming. If building it could mutate, the
    confirmation screen would itself be the destructive act."""
    db = _Session()
    user = _user()

    manifest = await AccountScrubService().scrub(db, user, dry_run=True)

    assert manifest.dry_run is True
    assert db.writes() == []
    assert db.commits == 0
    # And the user object is untouched — no half-scrub left in the session.
    assert user.email == "someone@example.com"
    assert user.anonymized_at is None


@pytest.mark.asyncio
async def test_dry_run_is_the_default() -> None:
    """The irreversible path should be the one you ask for by name."""
    db = _Session()

    manifest = await AccountScrubService().scrub(db, _user())

    assert manifest.dry_run is True
    assert db.writes() == []


@pytest.mark.asyncio
async def test_the_manifest_states_what_survives_not_only_what_goes() -> None:
    """A manifest listing only damage invites the reader to assume the rest is gone."""
    manifest = await AccountScrubService().build_manifest(_Session(), _user())

    assert manifest.kept, "nothing reported as kept"
    assert "billing_invoices" in manifest.kept
    assert "playlists" in manifest.kept
    assert manifest.deleted and manifest.scrubbed


@pytest.mark.asyncio
async def test_media_paths_are_captured_before_anything_is_written() -> None:
    """Once the paths are blanked there is no way to ask what to delete, and the audio sits on
    disk forever."""
    manifest = await AccountScrubService().build_manifest(_Session(), _user())

    assert manifest.track_uuids == ["track-uuid-1", "track-uuid-2"]
    assert manifest.profile_picture == "/uploads/avatars/42.jpg"


# --------------------------------------------------------------------------- #
# The users row
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_the_correlation_key_survives() -> None:
    """THE property. `id` and `uuid` are what keep every retained row joined to this account.

    If this ever fails, the scrub has stopped being a scrub and become a silent orphaning of
    playlists, invoices and support history.
    """
    user = _user(user_id=42)
    before = (user.id, user.uuid)

    await AccountScrubService().scrub(_Session(), user, dry_run=False)

    assert (user.id, user.uuid) == before


@pytest.mark.asyncio
async def test_every_identifying_field_is_cleared() -> None:
    user = _user(user_id=42)

    await AccountScrubService().scrub(_Session(), user, dry_run=False)

    assert user.name is None
    assert user.username == "deleted_user_42"
    assert user.email == "deleted+42@resomix.invalid"
    assert user.password_hash is None
    assert user.profile_picture is None
    assert user.is_active is False
    assert user.is_email_verified is False
    assert user.is_two_factor_enabled is False
    assert user.anonymized_at is not None


def test_the_placeholder_address_can_never_reach_a_real_mailbox() -> None:
    """`.invalid` is RFC 2606-reserved and guaranteed not to resolve, so a stray send cannot
    deliver — including to whoever might one day own a catch-all on our real domain."""
    assert scrubbed_email(7).endswith("@resomix.invalid")


def test_the_placeholders_are_unique_per_account() -> None:
    """Both columns are UNIQUE. A fixed placeholder would make the second scrub fail on a
    duplicate key — the id suffix is what stops that."""
    assert scrubbed_email(1) != scrubbed_email(2)
    assert scrubbed_username(1) != scrubbed_username(2)


# --------------------------------------------------------------------------- #
# What must not be touched
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_no_billing_table_is_written_to() -> None:
    """`billing_invoices`, `subscription_events` and `billing_consents` are CASCADE + NOT NULL
    against users.id. The hazard cannot fire because the users row is never deleted — this is the
    test that makes it loud if someone later turns the scrub back into a delete.
    """
    db = _Session()

    await AccountScrubService().scrub(db, _user(), dry_run=False)

    protected = ("billing_invoices", "subscription_events", "billing_consents", "orders", "purchases")
    offenders = [s for s in db.writes() if any(f"`{t}`" in s for t in protected)]
    assert not offenders, f"a write touched a financial table: {offenders}"


@pytest.mark.asyncio
async def test_the_users_row_is_never_deleted() -> None:
    """Deleting it is what would cascade the invoices away."""
    db = _Session()

    await AccountScrubService().scrub(db, _user(), dry_run=False)

    assert not any("DELETE" in s and "`users`" in s for s in db.statements)


@pytest.mark.asyncio
async def test_message_bodies_and_scores_are_not_in_the_scrub_list() -> None:
    """The support history keeps its value; only the identifiers go. If `message` were ever added
    to these column lists, the retained record would become useless."""
    by_table = {t.table: t.columns for t in SCRUB_TARGETS}

    assert "message" not in by_table["contacts"]
    assert "subject" not in by_table["contacts"]
    assert "message" not in by_table["feedbacks"]
    assert "satisfaction" not in by_table["feedbacks"]
    assert "body" not in by_table["user_messages"]


def test_no_table_is_both_deleted_and_kept() -> None:
    """A contradiction here would mean the manifest promises something it destroys."""
    deleted = {t for t, _, _ in DELETE_TABLES}
    kept = {t for t, _, _ in KEPT_TABLES}
    assert not (deleted & kept), f"listed as both deleted and kept: {deleted & kept}"


# --------------------------------------------------------------------------- #
# Ordering
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_the_waitlist_is_matched_on_the_original_address() -> None:
    """`waitlists` has no user_id — the address is the only handle, which is exactly why it
    survives a scrub that only walks foreign keys.

    It therefore has to be read BEFORE the users row is rewritten. If the order ever flipped, this
    would silently match nothing and leave the address sitting there.
    """
    db = _Session()

    await AccountScrubService().scrub(db, _user(email="real@example.com"), dry_run=False)

    waitlist = [s for s in db.writes() if "`waitlists`" in s]
    assert waitlist, "the waitlist was never touched"


@pytest.mark.asyncio
async def test_the_users_row_is_scrubbed_last() -> None:
    """Everything above it depends on still being able to read the original address."""
    db = _Session()
    user = _user(email="real@example.com")

    # If the row were scrubbed first, the manifest would report the placeholder as the account's
    # address, which is what an admin then sees on the confirmation screen.
    manifest = await AccountScrubService().scrub(db, user, dry_run=False)

    assert manifest.email == "real@example.com"


@pytest.mark.asyncio
async def test_public_playlists_are_made_private() -> None:
    """A public playlist under someone's chosen name outlives the scrub and defeats it."""
    db = _Session()

    manifest = await AccountScrubService().scrub(db, _user(), dry_run=False)

    assert manifest.playlists_made_private == 3
    assert any("`playlists`" in s and "is_public" in s for s in db.writes())


@pytest.mark.asyncio
async def test_forcing_playlists_private_can_be_turned_off() -> None:
    """Pending George's sign-off, so it is a parameter rather than a hard-coded decision."""
    db = _Session()

    await AccountScrubService().scrub(db, _user(), dry_run=False, force_playlists_private=False)

    assert not any("is_public" in s for s in db.writes())


# --------------------------------------------------------------------------- #
# Robustness
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_missing_table_is_reported_not_raised() -> None:
    """Environments drift between migrations. Half-scrubbing an account and dying is far worse
    than skipping a table and saying which.
    """
    db = _Session(drop_tables=("user_messages", "user_plan_grants"))

    manifest = await AccountScrubService().scrub(db, _user(), dry_run=False)

    assert manifest.warnings, "a skipped table was not reported"
    # The rest still ran, and the account is genuinely scrubbed.
    assert db.commits == 1


@pytest.mark.asyncio
async def test_a_missing_table_still_scrubs_the_users_row() -> None:
    """The one thing that must happen even when everything else is unavailable."""
    user = _user(user_id=9)
    db = _Session(drop_tables=("contacts", "feedbacks", "waitlists", "audio_files"))

    await AccountScrubService().scrub(db, user, dry_run=False)

    assert user.email == "deleted+9@resomix.invalid"
    assert user.anonymized_at is not None


@pytest.mark.asyncio
async def test_running_it_twice_is_safe_and_reaches_the_same_state() -> None:
    """"Did that go through?" is a question an admin answers by clicking again."""
    user = _user(user_id=5)
    svc = AccountScrubService()

    await svc.scrub(_Session(), user, dry_run=False)
    first = (user.email, user.username, user.anonymized_at)
    await svc.scrub(_Session(), user, dry_run=False)

    assert (user.email, user.username, user.anonymized_at) == first


@pytest.mark.asyncio
async def test_the_scrub_timestamp_is_not_moved_by_a_second_run() -> None:
    """It is the answer to "on what date was my request completed", which Art. 12(3) obliges us to
    be able to give. A re-run must not rewrite history."""
    user = _user(scrubbed=True)
    original = user.anonymized_at

    await AccountScrubService().scrub(_Session(), user, dry_run=False)

    assert user.anonymized_at == original


@pytest.mark.asyncio
async def test_an_account_with_nothing_on_it_scrubs_cleanly() -> None:
    """A registered account that never did anything is the likeliest first real deletion."""
    db = _Session(rows=0)
    user = _user(user_id=101)

    manifest = await AccountScrubService().scrub(db, user, dry_run=False)

    assert user.email == "deleted+101@resomix.invalid"
    assert manifest.deleted == {} and manifest.scrubbed == {}
    assert db.commits == 1


# --------------------------------------------------------------------------- #
# The restore guard
# --------------------------------------------------------------------------- #

def test_a_scrubbed_account_cannot_be_restored() -> None:
    """Restoration flips `is_active` back. On a scrubbed row that produces a working account with
    no email, no name and no password — so it has to fail loudly rather than no-op into what looks
    like success on the admin screen.
    """
    with pytest.raises(ValueError, match="already been scrubbed"):
        AccountScrubService.assert_restorable(_user(scrubbed=True))


def test_an_unscrubbed_account_can_be_restored() -> None:
    AccountScrubService.assert_restorable(_user())  # does not raise
    assert AccountScrubService.is_scrubbed(_user()) is False


@pytest.mark.asyncio
async def test_the_manifest_says_when_an_account_was_already_scrubbed() -> None:
    """So the admin UI can say "already done" instead of offering the button again."""
    manifest = await AccountScrubService().build_manifest(_Session(), _user(scrubbed=True))

    assert manifest.already_scrubbed is True


# --------------------------------------------------------------------------- #
# Partial schemas — the case that forced the design
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_table_missing_only_some_columns_still_scrubs_the_rest() -> None:
    """The bug this design exists to prevent.

    On a database without the `client_ip` migration, naming all five contact columns in one
    UPDATE makes MySQL reject the **whole statement** — leaving the name, email and phone number
    sitting there while the run reports success. A silent under-scrub looks compliant and is not.

    Only the columns that exist may be named.
    """
    db = _Session(drop_columns={"contacts": ("client_ip", "user_agent")})

    manifest = await AccountScrubService().scrub(db, _user(), dry_run=False)

    contacts = [s for s in db.writes() if "`contacts`" in s]
    assert len(contacts) == 1
    stmt = contacts[0]
    # The identifiers that DO exist are still cleared...
    assert "`name` = NULL" in stmt
    assert "`email` = NULL" in stmt
    assert "`phone` = NULL" in stmt
    # ...and the ones that don't are never named, so the statement is valid.
    assert "client_ip" not in stmt
    assert "user_agent" not in stmt
    # And it is reported, because those rows still hold personal data afterwards.
    assert any("contacts" in w and "client_ip" in w for w in manifest.warnings)


@pytest.mark.asyncio
async def test_a_table_missing_every_scrub_column_is_skipped_entirely() -> None:
    """`UPDATE contacts SET WHERE ...` is a syntax error. Nothing must be issued at all."""
    db = _Session(drop_columns={"feedbacks": ("client_ip", "user_agent")})

    await AccountScrubService().scrub(db, _user(), dry_run=False)

    assert not [s for s in db.writes() if "`feedbacks`" in s]


@pytest.mark.asyncio
async def test_no_statement_is_ever_issued_against_a_missing_table() -> None:
    """The stub raises AssertionError if one is, so reaching the end is the assertion.

    Checking the schema first rather than catching failures is what makes this true — and it is
    also what keeps the single transaction clean, since nothing has to survive a failed statement.
    """
    db = _Session(drop_tables=("user_messages", "audio_files", "waitlists", "purchases"))

    manifest = await AccountScrubService().scrub(db, _user(), dry_run=False)

    assert db.commits == 1
    assert manifest.warnings


@pytest.mark.asyncio
async def test_an_unreadable_schema_scrubs_the_users_row_and_nothing_else() -> None:
    """If even information_schema fails we assume nothing exists.

    Doing less than intended is recoverable — an admin re-runs it. Reporting success while leaving
    personal data behind is not, so "assume nothing is there" is the safe direction to fail in.
    """
    db = _Session()

    async def _no_schema(stmt, params=None):
        if "information_schema" in str(stmt):
            raise RuntimeError("information_schema unavailable")
        return await _Session.execute(db, stmt, params)

    db.execute = _no_schema
    user = _user(user_id=3)

    manifest = await AccountScrubService().scrub(db, user, dry_run=False)

    assert user.email == "deleted+3@resomix.invalid"
    assert user.anonymized_at is not None
    assert db.writes() == []
    assert manifest.warnings
