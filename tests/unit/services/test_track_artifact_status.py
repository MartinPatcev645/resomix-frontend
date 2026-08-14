"""
Sibling-artifact status — saying what is actually happening
===========================================================

THE BUG THIS FIXES

The Library decided what to show for a track's Sonic Discovery / Analysis capsules from the row's
**age**: younger than 15 minutes and missing → "generating"; older and missing → *"Analysis coming
soon"*. So an analysis still running at minute 16 was reported to the user as an unbuilt feature,
and one that had failed looked identical to one that was fine.

The guess existed because there was nothing to read. A missing `analysis_uuid` collapses four
different situations into one absence — queued, running, ran-and-produced-nothing, failed — and the
API had no way to say which. `track_artifact_status` is that missing fact.

WHAT IS PINNED HERE, AND WHY EACH ONE

* **`unknown` is not `pending`.** Pending is an instruction to keep polling. Rows with no status
  record (uploads predating the table) must not put the client into a poll for an artifact nothing
  is building — that is the forever-spinner this work exists to remove, reintroduced from the other
  end.
* **The uuid outranks the bookkeeping, in both directions.** A status write can be lost; an
  artifact that exists is openable regardless. And a state claiming `ready` with no uuid must not
  be reported as ready, or the client offers a link that 404s.
* **Every exit from the analysis task writes a terminal state.** This is the actual regression
  risk: the task has six early returns, and *every one of them* previously left the row untouched.
  One un-updated return path is a capsule that spins forever.
* **One query per page, not one per row.** The Library polls this every 5 seconds.
* **The frontend's in-flight set matches the backend's.** They are two literals in two languages
  describing one contract; if they drift, the poll either never starts or never stops.

No database and no network: the session is a stub that counts what it was asked.
"""

from __future__ import annotations

import pathlib
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.track_artifact_status import (
    ARTIFACT_FAILED,
    ARTIFACT_IN_FLIGHT,
    ARTIFACT_PENDING,
    ARTIFACT_PROCESSING,
    ARTIFACT_READY,
    ARTIFACT_STATES,
    ARTIFACT_UNAVAILABLE,
)
from app.services.track_service import ARTIFACT_UNKNOWN, TrackService

REPO = pathlib.Path(__file__).resolve().parents[3]
WEB = REPO.parent / "resomix-web"


def _track(**kw):
    """A Track stand-in carrying only what the summary serializer touches.

    A real object rather than a MagicMock on purpose: a mock answers to every attribute, so a
    serializer that started reading a field that does not exist would still pass.
    """
    base = dict(
        uuid="trk-1", title="A Song", version_title=None, display_artist="Someone",
        mix_name=None, isrc="X", duration_ms=1000, genre_name="House", track_type="upload",
        created_at=None, updated_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _serialize(**kw):
    """Serialize one track. `playlist_meta` is the `{uuid, locked}` block the repository returns."""
    return TrackService._serialize_track_summary(_track(), **kw)


def _artifacts(**kw):
    """Just the `artifacts` block."""
    return _serialize(**kw)["artifacts"]


# --------------------------------------------------------------------------- #
# The state the client is told
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("recorded", list(ARTIFACT_STATES))
def test_every_recorded_state_is_reported_verbatim_when_the_artifact_is_absent(recorded) -> None:
    """…except `ready`, which cannot be true without an artifact — asserted separately below."""
    blocks = _artifacts(artifact_status={"analysis_state": recorded, "playlist_state": recorded})

    expected = ARTIFACT_UNAVAILABLE if recorded == ARTIFACT_READY else recorded
    assert blocks["analysis"]["state"] == expected
    assert blocks["playlist"]["state"] == expected


def test_no_status_row_reads_as_unknown_not_pending() -> None:
    """The distinction the whole fix rests on.

    `pending` tells the client to poll. Uploads that predate this table have nothing building for
    them, so reporting them as pending would start a poll that can never terminate — the same
    forever-spinner, arriving from the opposite direction.
    """
    blocks = _artifacts(artifact_status=None)

    assert blocks["analysis"]["state"] == ARTIFACT_UNKNOWN
    assert blocks["playlist"]["state"] == ARTIFACT_UNKNOWN
    assert ARTIFACT_UNKNOWN not in ARTIFACT_IN_FLIGHT


def test_an_unrecognised_state_degrades_to_unknown() -> None:
    """A value from an older row or a future deploy must not become a spinner or an error."""
    blocks = _artifacts(artifact_status={"analysis_state": "half-done", "playlist_state": ""})

    assert blocks["analysis"]["state"] == ARTIFACT_UNKNOWN
    assert blocks["playlist"]["state"] == ARTIFACT_UNKNOWN


def test_an_existing_artifact_outranks_a_stale_state() -> None:
    """A worker killed between building the artifact and recording it leaves a stale row. The
    artifact is openable either way, and hiding it because bookkeeping was lost is the worse
    error."""
    blocks = _artifacts(
        playlist_meta={"uuid": "pl-1", "locked": False},
        analysis_meta={"analysis_uuid": "an-1"},
        artifact_status={"analysis_state": ARTIFACT_FAILED, "playlist_state": ARTIFACT_PENDING},
    )

    assert blocks["playlist"]["state"] == ARTIFACT_READY
    assert blocks["analysis"]["state"] == ARTIFACT_READY


def test_ready_without_an_artifact_is_downgraded_rather_than_promised() -> None:
    """The artifact was deleted after the state was written. Reporting `ready` here hands the
    client a link that 404s, which is worse than saying it is gone."""
    blocks = _artifacts(artifact_status={"analysis_state": ARTIFACT_READY, "playlist_state": ARTIFACT_READY})

    assert blocks["analysis"]["state"] == ARTIFACT_UNAVAILABLE
    assert blocks["playlist"]["state"] == ARTIFACT_UNAVAILABLE


def test_the_error_text_is_dropped_once_the_artifact_is_ready() -> None:
    """A retry that succeeds must not leave the previous failure's text attached to a working
    capsule."""
    blocks = _artifacts(
        analysis_meta={"analysis_uuid": "an-1"},
        artifact_status={"analysis_state": ARTIFACT_FAILED, "analysis_error": "boom"},
    )

    assert blocks["analysis"]["state"] == ARTIFACT_READY
    assert blocks["analysis"]["error"] is None


def test_the_error_text_survives_on_a_terminal_failure() -> None:
    """It is the only thing that tells the user *why*, and it is what the capsule shows on click."""
    blocks = _artifacts(
        artifact_status={"analysis_state": ARTIFACT_FAILED, "analysis_error": "We could not analyse this track."}
    )

    assert blocks["analysis"]["error"] == "We could not analyse this track."


def test_the_two_siblings_are_reported_independently() -> None:
    """The common real case: the playlist landed, the analysis is still running. Collapsing them
    into one status is what the old `isTrackRecent` did to both at once."""
    blocks = _artifacts(
        playlist_meta={"uuid": "pl-1", "locked": False},
        artifact_status={"playlist_state": ARTIFACT_READY, "analysis_state": ARTIFACT_PROCESSING},
    )

    assert blocks["playlist"]["state"] == ARTIFACT_READY
    assert blocks["analysis"]["state"] == ARTIFACT_PROCESSING


def test_unavailable_is_distinct_from_failed() -> None:
    """"No close enough matches in the catalogue" is a normal outcome; "we could not analyse this"
    is an error. One state for both would show an error message for a healthy upload."""
    assert ARTIFACT_UNAVAILABLE in ARTIFACT_STATES
    assert ARTIFACT_FAILED in ARTIFACT_STATES
    assert ARTIFACT_UNAVAILABLE != ARTIFACT_FAILED
    # Both terminal — neither may restart the poll.
    assert ARTIFACT_UNAVAILABLE not in ARTIFACT_IN_FLIGHT
    assert ARTIFACT_FAILED not in ARTIFACT_IN_FLIGHT


def test_only_pending_and_processing_keep_the_client_polling() -> None:
    """The poll's terminating condition, asserted at its source. Every other state must stop it —
    a poll that re-arms on a terminal state is exactly the forever-spinner being removed."""
    assert set(ARTIFACT_IN_FLIGHT) == {ARTIFACT_PENDING, ARTIFACT_PROCESSING}


# --------------------------------------------------------------------------- #
# Cost — this is polled every 5 seconds
# --------------------------------------------------------------------------- #

class _CountingSession:
    """Counts `execute` calls and returns an empty result for each."""

    def __init__(self):
        self.executed = 0

    async def execute(self, *a, **kw):
        self.executed += 1
        return SimpleNamespace(all=lambda: [], first=lambda: None)


@pytest.mark.asyncio
async def test_a_full_page_costs_one_query_not_one_per_row() -> None:
    """Twenty rows, one query. A per-row lookup here would put twenty queries on a 5-second poll,
    for every user with the Library open."""
    from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository

    db = _CountingSession()
    await TrackArtifactStatusRepository().async_get_artifact_status_map(db, list(range(1, 21)))

    assert db.executed == 1


@pytest.mark.asyncio
async def test_an_empty_page_costs_no_query_at_all() -> None:
    """A filtered page with no results must not hit the database to learn nothing."""
    from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository

    db = _CountingSession()
    result = await TrackArtifactStatusRepository().async_get_artifact_status_map(db, [])

    assert result == {} and db.executed == 0


# --------------------------------------------------------------------------- #
# The writes
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_write_with_no_track_id_is_a_no_op() -> None:
    """Both upload paths can reach the workers with `track_id=None` (anonymous / B2B). That must
    not raise, and must not attempt an UPDATE with a null key."""
    from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository

    with patch("database.connection.AsyncSessionLocal") as session:
        await TrackArtifactStatusRepository.set_analysis_state(None, ARTIFACT_READY)

    session.assert_not_called()


@pytest.mark.asyncio
async def test_an_unknown_state_is_refused_rather_than_written() -> None:
    """A typo would be written straight through and then read back as `unknown` by every client,
    silently. Refusing it here keeps the column's domain closed."""
    from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository

    with patch("database.connection.AsyncSessionLocal") as session:
        await TrackArtifactStatusRepository.set_playlist_state(1, "nearly-done")

    session.assert_not_called()


@pytest.mark.asyncio
async def test_a_failing_write_never_propagates() -> None:
    """By the time these run the artifact is already built. A bookkeeping failure must not turn a
    delivered analysis into a failed Celery task."""
    from app.repositories import track_artifact_status_repository as mod

    with patch.object(mod, "TrackArtifactStatus"), \
         patch("database.connection.AsyncSessionLocal", side_effect=RuntimeError("db gone")):
        await mod.TrackArtifactStatusRepository.set_analysis_state(1, ARTIFACT_READY)  # must not raise


# --------------------------------------------------------------------------- #
# Every exit from the analysis task closes the state out
# --------------------------------------------------------------------------- #

def _analysis_task_source() -> str:
    return (REPO / "app" / "tasks" / "analysis_tasks.py").read_text()


def test_the_analysis_task_records_a_terminal_state_on_every_path() -> None:
    """The regression this file exists for.

    `_async_generate_track_analysis` has six early returns — unconfigured service, unreadable
    spool, empty spool, create failure, non-success outcome, and the success path. Every one of
    them used to leave the row untouched, which is what produced "coming soon" for a running
    analysis. The write now lives in a `finally` seeded with a pessimistic default, so a new
    early return added later is covered by construction rather than by remembering.
    """
    source = _analysis_task_source()
    body = source.split("async def _async_generate_track_analysis", 1)[1].split("\nasync def ", 1)[0]

    assert "state, state_error = ARTIFACT_FAILED" in body, "the pessimistic default is gone"
    assert "finally:" in body
    assert "set_analysis_state(track_id, state, error=state_error)" in body, (
        "the terminal write must be in the finally, not on individual return paths"
    )
    # `ready` may only be assigned after the summary row is persisted — a state written earlier is
    # a promise the Library would 404 on.
    assert body.index("_persist_summary(") < body.index("ARTIFACT_READY")


def test_an_unconfigured_analysis_service_reports_unavailable_not_failed() -> None:
    """Nothing broke — the feature simply is not deployed here. Showing an error for a service that
    was never asked to do anything is both wrong and alarming."""
    body = _analysis_task_source().split("async def _async_generate_track_analysis", 1)[1]
    unconfigured = body.split("if not client.is_configured:", 1)[1].split("return", 1)[0]

    assert "ARTIFACT_UNAVAILABLE" in unconfigured


def test_a_failed_upload_closes_out_the_analysis_it_will_never_start() -> None:
    """The analysis is enqueued only on the similarity job's success path. Without this write a
    failed upload leaves the analysis capsule on `pending` — spinning for a task nobody will ever
    send."""
    source = (REPO / "app" / "tasks" / "similarity_tasks.py").read_text()
    failure_branch = source.split("if not succeeded:", 1)[1].split("try:", 1)[0]

    assert "set_playlist_state" in failure_branch
    assert "set_analysis_state" in failure_branch
    assert "ARTIFACT_UNAVAILABLE" in failure_branch


def test_nothing_enqueued_means_the_analysis_state_is_closed_out() -> None:
    """`_maybe_enqueue_analysis_sibling` returns False when it is inert (unconfigured service, B2B
    partner, spool failure). Every False is a task that will never run."""
    source = (REPO / "app" / "tasks" / "similarity_tasks.py").read_text()

    assert "if not _enqueue_analysis_sibling(" in source
    branch = source.split("if not _enqueue_analysis_sibling(", 1)[1]
    assert "set_analysis_state" in branch.split("except Exception", 1)[0]


def test_the_enqueue_helper_reports_whether_it_actually_enqueued() -> None:
    """It is synchronous and both callers are async, so it cannot do the write itself — it has to
    report. A helper that returns None on some paths would read as "not enqueued" and close out a
    task that is in fact running."""
    from app.controllers.similarity_controller import SimilarityController

    source = pathlib.Path(SimilarityController.__module__.replace(".", "/") + ".py")
    body = (REPO / source).read_text().split("def _maybe_enqueue_analysis_sibling", 1)[1]
    body = body.split("\n    # ---", 1)[0]

    assert "-> bool:" in body
    # Every exit must be an explicit boolean; a bare `return` would be None → falsy → a running
    # analysis reported as unavailable.
    assert not re.search(r"\n\s+return\s*$", body), "a bare `return` reads as False"
    assert "return True" in body and body.count("return False") >= 3


# --------------------------------------------------------------------------- #
# Backend and frontend describe the same contract
# --------------------------------------------------------------------------- #

def test_the_frontend_in_flight_set_matches_the_backend() -> None:
    """Two literals, two languages, one contract. If they drift the poll either never starts (the
    original bug) or never stops (the one the ceiling exists to catch)."""
    chips = (WEB / "apps/webapp/src/components/TrackArtifactChips.tsx").read_text()
    declared = re.search(r"IN_FLIGHT:\s*ArtifactState\[\]\s*=\s*\[([^\]]*)\]", chips)

    assert declared, "could not find IN_FLIGHT in TrackArtifactChips.tsx"
    assert set(re.findall(r"[\w-]+", declared.group(1))) == set(ARTIFACT_IN_FLIGHT)


def test_the_frontend_knows_every_state_the_backend_can_send() -> None:
    """An unhandled state falls through to whichever branch is last — which is how the original
    "coming soon" message ended up on a running analysis."""
    store = (WEB / "packages/stores/src/useLibrary.ts").read_text()
    union = re.search(r"export type ArtifactState =([^;]+);", store)

    assert union, "could not find the ArtifactState union"
    named = set(re.findall(r"'([\w-]+)'", union.group(1)))
    assert set(ARTIFACT_STATES) | {ARTIFACT_UNKNOWN} == named


def test_the_client_no_longer_guesses_from_the_upload_timestamp() -> None:
    """The 15-minute window is the bug. If it comes back, so does the message it produced."""
    chips = (WEB / "apps/webapp/src/components/TrackArtifactChips.tsx").read_text()

    assert "RECENT_WINDOW_MS" not in chips
    assert "isTrackRecent" not in chips
    # The coming-soon affordance survives, but only for tracks with no pipeline at all.
    assert "COMING_SOON_TITLE" in chips


# --------------------------------------------------------------------------- #
# The migration
# --------------------------------------------------------------------------- #

def _migration() -> str:
    return (REPO / "alembic/versions/e4a9b2c7d135_track_artifact_status.py").read_text()


def test_the_backfill_uses_the_real_column_name() -> None:
    """`tracks.track_type` does not exist — the model maps that attribute onto a column called
    `type`. Raw SQL naming the attribute fails the whole statement, and a migration is not a place
    that gets a second try.
    """
    statement = _migration().split("INSERT INTO track_artifact_status", 1)[1]
    # `-- …` lines are stripped first: the comment above the WHERE clause explains this very trap
    # by naming both spellings, and matching on it would fail the test for documenting itself.
    executed = "\n".join(
        line for line in statement.splitlines() if not line.strip().startswith("--")
    )

    assert "t.type = 'upload'" in executed
    assert "track_type" not in executed, "attribute name leaked into the SQL"


def test_the_backfill_never_seeds_pending() -> None:
    """These pipelines finished (or died) long ago. A pending backfill would put every historic
    upload into a poll that can never terminate."""
    sql = _migration().split("INSERT INTO track_artifact_status", 1)[1]

    assert "'pending'" not in sql
    assert "'ready'" in sql and "'unavailable'" in sql


def test_the_backfill_filters_playlists_exactly_as_the_library_does() -> None:
    """If the backfill counts playlists the Library does not, day one shows `ready` capsules with
    no uuid behind them."""
    sql = _migration()

    assert "type IN ('similarity', 'waiting_segments')" in sql
    assert "deleted_at IS NULL" in sql


# --------------------------------------------------------------------------- #
# Interaction with the Library cap (Phase 5)
# --------------------------------------------------------------------------- #

def test_a_locked_playlist_still_reports_as_ready() -> None:
    """The interaction that is easy to get backwards.

    A playlist beyond the Library cap has its uuid withheld. If the artifact state were resolved
    from the uuid, that withholding would report a perfectly good playlist as `unavailable` — so
    the capsule would say "no matches" about a playlist that was built and is sitting there.

    Existence and reachability are different questions, and only the second one the cap answers.
    """
    blocks = _artifacts(
        playlist_meta={"uuid": None, "locked": True},
        artifact_status={"playlist_state": ARTIFACT_READY},
    )

    assert blocks["playlist"]["state"] == ARTIFACT_READY


def test_a_locked_playlist_is_flagged_and_its_uuid_withheld() -> None:
    """Both halves of the gate, on the row the Uploads tab renders."""
    row = _serialize(playlist_meta={"uuid": None, "locked": True})

    assert row["playlist_uuid"] is None
    assert row["playlist_locked"] is True


def test_no_playlist_at_all_is_not_reported_as_locked() -> None:
    """The distinction `playlist_locked` exists for. Both cases have no uuid; one is "still
    generating / never built", the other is "upgrade to open this". Same absence, different copy."""
    row = _serialize(playlist_meta=None)

    assert row["playlist_uuid"] is None
    assert row["playlist_locked"] is False
    assert row["artifacts"]["playlist"]["state"] != ARTIFACT_READY
