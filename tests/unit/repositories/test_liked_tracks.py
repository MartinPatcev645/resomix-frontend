"""
Liked tracks — the tab's query
==============================

`track_ratings` already held everything needed; what did not exist was a "list mine" endpoint.
Every route was keyed by a specific track or playlist.

THE TRAP THIS FILE EXISTS FOR

`is_active`. It reads as a soft-delete flag — `delete_user_track` does set it — so the obvious
filter is `is_active = 1`. That is wrong, and wrong in the worst way: on the dev database **4,360
of the 4,420 tracks currently sitting in playlists have `is_active = 0`**, and every playlist
screen lists them happily. A blanket filter empties the Liked tab for every user, and it does it
silently — an empty tab looks exactly like a user who has not liked anything.

The first version of this query shipped that filter. It returned zero rows for a user with five
liked tracks, which is how it was caught. `test_only_soft_deleted_uploads_are_excluded` is the
guard.

THE OTHER TWO PROPERTIES

* **One row per track, not per rating.** Ratings are keyed on (user, track, *playlist*), so liking
  the same track in three playlists is three rows. The dev user has 6 like rows across 5 tracks.
* **Un-like clears every like for that track.** The tab shows one row per track; removing a single
  playlist's rating would leave the row on screen backed by the others, and the click would appear
  to do nothing.

No database: the session is a stub that records the SQL it was handed.
"""

from __future__ import annotations

import inspect

import pytest

from app.repositories.rating_repository import TrackRatingRepository


class _SqlSession:
    """Records every statement and returns a fixed count / row set."""

    def __init__(self, total=0, rows=()):
        self.total = total
        self.rows = list(rows)
        self.sql: list[str] = []

    async def scalar(self, statement, params=None):
        self.sql.append(str(statement))
        return self.total

    async def execute(self, statement, params=None):
        self.sql.append(str(statement))
        rows = self.rows

        class _Result:
            @staticmethod
            def mappings():
                class _M:
                    @staticmethod
                    def all():
                        return rows

                return _M()

            rowcount = len(rows)

        return _Result()

    async def commit(self):
        return None


async def _query(total=3, rows=()):
    db = _SqlSession(total, rows)
    out, n = await TrackRatingRepository().async_get_liked_tracks(db, 7, page=1, page_size=20, partner_id=1)
    return out, n, " ".join(db.sql).lower()


# --------------------------------------------------------------------------- #
# What the query selects
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_only_liked_rows_are_listed():
    """A thumbs-DOWN is a rating too. Without `rating = 1` the tab would list tracks the user
    explicitly rejected, alongside the ones they chose."""
    _, _, sql = await _query()

    assert "r.rating = 1" in sql


@pytest.mark.asyncio
async def test_only_soft_deleted_uploads_are_excluded():
    """THE trap. `is_active = 0` is a delete marker on an upload and ordinary on a catalogue track,
    so the blanket filter empties the tab for everyone — silently, because an empty tab is
    indistinguishable from a user who has liked nothing.

    Asserted both ways: the narrow filter must be present, and the blanket one must not.
    """
    _, _, sql = await _query()

    assert "not (t.type = 'upload' and t.is_active = 0)" in sql
    assert "t.is_active = 1" not in sql, "the blanket filter is back — this empties the tab"


@pytest.mark.asyncio
async def test_one_row_per_track_not_per_rating():
    """Ratings are keyed on (user, track, playlist), so the same track liked in three playlists is
    three rows. Grouping is what stops it appearing three times.

    Matched as the WHOLE clause, not as a substring. `GROUP BY t.id, r.playlist_id` — which puts
    the duplicate rows straight back — still contains "group by t.id", and a substring check passed
    against it during a sabotage run.

    The LAST `group by`, not the first: the duration lookup is a derived table with its own
    `GROUP BY track_id`, and matching that one made this test fail against correct code and
    "pass" against broken code for the same wrong reason.
    """
    import re

    _, _, sql = await _query()
    # To end of LINE, not to the next keyword: with DOTALL the non-greedy span still ran from the
    # first GROUP BY past the second, so findall returned one match instead of two.
    clauses = re.findall(r"group by\s+([^\n]+)", sql)

    assert clauses, "no GROUP BY found"
    outer = clauses[-1].strip()
    assert outer == "t.id", f"outer query grouped by {outer!r}, not t.id alone"


@pytest.mark.asyncio
async def test_the_total_counts_tracks_not_ratings():
    """`total` drives the page count and the tab label. Counting rating rows would claim more pages
    than exist and show a number that disagrees with the list under it."""
    _, _, sql = await _query()

    assert "count(distinct r.track_id)" in sql


@pytest.mark.asyncio
async def test_newest_like_first():
    _, _, sql = await _query()

    assert "order by liked_at desc" in sql


@pytest.mark.asyncio
async def test_ties_are_broken_deterministically():
    """Several likes in one session share a `rated_at` second — the dev data has exactly that. With
    no second key the same track can land on two pages while another lands on none."""
    _, _, sql = await _query()

    assert "liked_at desc, t.id desc" in sql


@pytest.mark.asyncio
async def test_the_page_is_bounded():
    _, _, sql = await _query()

    assert "limit :limit offset :offset" in sql


@pytest.mark.asyncio
async def test_tenant_scoped():
    _, _, sql = await _query()

    assert "t.partner_id = :partner_id" in sql


# --------------------------------------------------------------------------- #
# Cheap exits
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_no_user_means_no_query():
    db = _SqlSession()
    out, total = await TrackRatingRepository().async_get_liked_tracks(db, None)

    assert (out, total) == ([], 0)
    assert db.sql == []


@pytest.mark.asyncio
async def test_a_user_with_no_likes_costs_one_query_not_two():
    """The count comes back zero, so the page query is skipped entirely. Most users will be in this
    state for a while, and the tab is loaded on every Library visit to populate its label."""
    db = _SqlSession(total=0)
    out, total = await TrackRatingRepository().async_get_liked_tracks(db, 7)

    assert (out, total) == ([], 0)
    assert len(db.sql) == 1


# --------------------------------------------------------------------------- #
# The row shape
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_the_internal_track_id_is_selected_for_the_apple_join():
    """`enrich_tracks_with_apple` joins on a numeric `track_id` and pops it afterwards, so the
    query has to supply it — but the client is only ever given the uuid as `id`."""
    _, _, sql = await _query()

    assert "t.id                     as track_id" in sql
    assert "t.uuid                   as id" in sql


@pytest.mark.asyncio
async def test_a_deleted_track_does_not_break_the_page():
    """Hard deletes need no filter at all: `track_ratings.track_id` is ON DELETE CASCADE, so the
    rating is gone with the track and there is nothing to render. Asserted against the model rather
    than the query, because it is the schema that makes the query safe."""
    from app.models.rating import TrackRating

    fk = next(iter(TrackRating.__table__.c.track_id.foreign_keys))

    assert fk.ondelete == "CASCADE"


# --------------------------------------------------------------------------- #
# Un-liking
# --------------------------------------------------------------------------- #

def test_unlike_clears_every_playlist_not_just_one():
    """The tab shows one row per track. Clearing a single playlist's rating would leave the row on
    screen backed by the others — the user clicks un-like and watches nothing happen."""
    source = inspect.getsource(TrackRatingRepository.async_unlike_track)

    assert "TrackRating.playlist_id" not in source, "un-like is scoped to one playlist again"
    assert "TrackRating.track_id == track_numeric_id" in source
    assert "TrackRating.user_id == user_id" in source


def test_unlike_leaves_an_explicit_dislike_alone():
    """A thumbs-DOWN in some playlist is a separate judgement about a different question. Clearing
    it here would silently discard feedback the user never revisited."""
    source = inspect.getsource(TrackRatingRepository.async_unlike_track)

    assert "TrackRating.rating == 1" in source


@pytest.mark.asyncio
async def test_unliking_an_unknown_track_is_not_an_error():
    """Idempotent: a double click, or a tab left open after the like was removed elsewhere. Raising
    would show a failure for an action that already reached the state the user wanted."""
    class _NoTrack(_SqlSession):
        async def scalar(self, statement, params=None):
            return None

    assert await TrackRatingRepository().async_unlike_track(_NoTrack(), "nope", 7) == 0
