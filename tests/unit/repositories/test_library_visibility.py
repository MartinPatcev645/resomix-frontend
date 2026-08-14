"""
Library visibility — derived from recency, not stored
=====================================================

WHAT CHANGED, AND WHY THIS FILE WAS REWRITTEN

Visibility used to be decided once at creation and stored in `playlists.is_library_visible`. The
reasoning was that a stored flag records what the user actually saw, which a "first N by created_at"
query cannot reconstruct after the fact.

That reasoning was wrong in the way that matters. Because the flag was never revisited, the first
five playlists a free user created were stamped visible **forever** and the sixth was stamped hidden
**forever**. Creating a sixth could not demote the first. So the Library showed the five *oldest*
playlists — the opposite of what anyone expects — and no amount of activity could correct it.

Visibility is now `async_visible_playlist_ids`: the cap's worth of most-recent playlists, computed
on read. Create a sixth and the first drops out on the next read, with no write anywhere.

WHAT THE CAP GOVERNS

Not existence, and not access-by-link. It governs whether a listed row carries an **identifier**.
Every playlist the user owns comes back in the listing; the ones beyond the cap arrive with no
`id`, `uuid` or `seed_track_uuid`, which is what makes them un-openable — a client cannot construct
a route to something it has no id for. That is enforcement; greying the row is only the explanation.

The properties carried over from the previous design, because they are about the cap and not the
mechanism: unlimited and zero sentinels, and the fail-open default when no cap can be resolved
(hiding someone's playlist by mistake is far worse than listing one too many).

No database: the session is a stub returning a fixed set of ids.
"""

import pytest

from app.repositories.playlist_repository import PlaylistRepository


class _IdSession:
    """Stands in for the DB, honouring the statement's LIMIT.

    Applying the real LIMIT matters: without it the stub would return every id regardless of the
    cap, and `test_a_sixth_playlist_pushes_the_first_out` — the whole reported bug — would pass
    against a repository that had forgotten to limit at all.
    """

    def __init__(self, ids=()):
        self.ids = list(ids)
        self.queried = False
        self.statement = None

    async def execute(self, statement):
        self.queried = True
        self.statement = statement
        limit = getattr(getattr(statement, "_limit_clause", None), "value", None)
        rows = [(i,) for i in (self.ids[:limit] if limit is not None else self.ids)]

        class _Result:
            @staticmethod
            def all():
                return rows

            @staticmethod
            def scalar():
                return len(rows)

        return _Result()


async def _visible(*, cap, owned=()):
    db = _IdSession(owned)
    return await PlaylistRepository().async_visible_playlist_ids(db, 7, cap), db


# --------------------------------------------------------------------------- #
# The rule
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
class TestWhichOnesAreVisible:
    async def test_the_cap_bounds_what_is_asked_for(self):
        """The LIMIT is the cap, so the query cannot return more than the plan allows however many
        playlists the user owns."""
        _, db = await _visible(cap=5, owned=[10, 9, 8, 7, 6])

        assert "LIMIT" in str(db.statement).upper()

    async def test_a_sixth_playlist_pushes_the_first_out(self):
        """THE reported bug, stated directly.

        `owned` is newest-first, matching the query's ordering. A free user with six playlists sees
        the five most recent; the oldest — id 1 — is the one that drops.

        Under the old stored flag this was impossible: the first five were stamped visible at
        creation and never revisited, so the sixth was hidden and the Library showed the five
        OLDEST forever. Creating more could not change it, and neither could deleting.
        """
        visible, _ = await _visible(cap=5, owned=[6, 5, 4, 3, 2, 1])

        assert visible == {6, 5, 4, 3, 2}
        assert 1 not in visible, "the oldest playlist should have been pushed out by the sixth"

    async def test_the_visible_set_is_the_most_recent(self):
        """Ordering is `created_at DESC` — the fix. The old stored flag made it the five OLDEST,
        permanently, because it was written once and never revisited."""
        _, db = await _visible(cap=5, owned=[10, 9, 8, 7, 6])
        sql = str(db.statement).lower()

        assert "created_at desc" in sql

    async def test_ties_are_broken_deterministically(self):
        """`created_at` is a DATETIME with one-second resolution and playlists are created in
        bursts, so ties are ordinary — not a corner case.

        Without a second sort key MySQL may order tied rows differently between two identical
        requests, and the "visible five" would differ per request: a row could flicker between
        locked and unlocked, or appear on two pages at once.
        """
        _, db = await _visible(cap=5, owned=[10, 9])
        sql = str(db.statement).lower()

        assert "id desc" in sql

    async def test_only_the_owners_own_playlists_count(self):
        """The allowance is over what you own. A favourited playlist belonging to someone else is
        not part of it, and must never be locked by it."""
        _, db = await _visible(cap=5, owned=[10])
        sql = str(db.statement).lower()

        assert "user_id" in sql

    async def test_soft_deleted_playlists_do_not_occupy_a_slot(self):
        """Deleting a playlist frees a slot immediately — the same promise the usage chip makes."""
        _, db = await _visible(cap=5, owned=[10])
        sql = str(db.statement).lower()

        assert "deleted_at is null" in sql

    async def test_no_favourite_exemption(self):
        """DECIDED: a favourited playlist outside the recent N is locked like any other.

        Asserted against the query, because the exemption would have to appear there. Favouriting
        is a flag the user controls, so exempting it would let anyone opt out of the cap by hearting
        everything — which is why the recommendation to pin favourites was overruled.
        """
        _, db = await _visible(cap=5, owned=[10])
        sql = str(db.statement).lower()

        assert "favorite" not in sql and "engagement" not in sql


# --------------------------------------------------------------------------- #
# Sentinels
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
class TestSentinels:
    async def test_unlimited_returns_none_rather_than_every_id(self):
        """`None` means "no restriction". Returning a set of every id would be equivalent only
        until someone treated an empty-ish result as "nothing is visible" — and it would cost a
        query per page for a plan that has no cap to enforce."""
        visible, db = await _visible(cap=-1, owned=[1, 2, 3])

        assert visible is None
        assert db.queried is False, "an unlimited plan must not pay for this query"

    async def test_a_zero_cap_locks_everything_without_querying(self):
        visible, db = await _visible(cap=0, owned=[1, 2, 3])

        assert visible == set()
        assert db.queried is False


# --------------------------------------------------------------------------- #
# Fail open
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
class TestSafeDefaults:
    async def test_an_unresolved_cap_locks_nothing(self):
        """A guest, a partner, or a path that predates the cap. Failing open is deliberate: hiding
        someone's playlist by mistake is far worse than listing one too many."""
        visible, db = await _visible(cap=None, owned=[1, 2, 3])

        assert visible is None
        assert db.queried is False


# --------------------------------------------------------------------------- #
# The listing, and the count that has to agree with it
# --------------------------------------------------------------------------- #

def _repo_source() -> str:
    import inspect

    return inspect.getsource(PlaylistRepository)


def test_the_listing_no_longer_filters_by_the_stored_flag() -> None:
    """The single most important line of this change.

    While the listing filtered, `total`, the page count and every filter operated over a smaller
    set for a free user than for a Pro one — so a free user's search searched five playlists and
    their pagination paginated five. Returning everything and withholding identifiers is what makes
    those behave identically on every plan.
    """
    source = _repo_source()

    assert "Playlist.is_library_visible.is_(True)" not in source, (
        "the listing is filtering on the stored flag again"
    )


def test_nothing_writes_the_stored_flag_any_more() -> None:
    """`is_library_visible` is left in the schema (defaulting to 1) so this change needs no
    migration and can be rolled back. It must be inert: a stale write would be a record of what the
    cap used to be, silently contradicting the derived answer."""
    source = _repo_source()

    assert "is_library_visible=" not in source
    assert "_resolve_library_visibility" not in source


def test_a_locked_row_carries_no_identifier() -> None:
    """The gate itself. Greying a row in the UI is decoration; withholding the uuid is what stops
    the client reaching the playlist at all.

    `fork_id` is included because it is a playlist uuid by another name — leaving it would hand
    back the identifier the other three lines just removed.
    """
    source = _repo_source()
    branch = source.split("if not is_visible:")[1].split("playlist_list.append")[0]

    for field in ('playlist_dict["id"]', 'playlist_dict["uuid"]', 'playlist_dict["seed_track_uuid"]'):
        assert field in branch, f"{field} is still exposed on a locked row"
    assert 'playlist_dict["fork_id"]' in branch, "fork_id leaks the uuid a locked row must not have"


def test_pagination_is_deterministic() -> None:
    """Now that a page number is a shareable URL (`?page=2`), an unstable sort means two people
    following the same link see different rows — and one row can appear on two pages while another
    appears on none.

    Anchored to `base_query` rather than searched for anywhere in the file. The visible-set query
    carries the identical `order_by`, so an unanchored substring check passed even with the
    listing's tie-break deleted — the assertion was matching the wrong query entirely.
    """
    source = _repo_source()

    assert (
        "base_query.order_by(Playlist.created_at.desc(), Playlist.id.desc())" in source
    ), "the LISTING query's tie-break is missing (the visible-set query's does not cover it)"


# --------------------------------------------------------------------------- #
# The usage chip
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
class TestTheCountAgreesWithTheListing:
    """`count_library_visible` feeds the workspace chip and the billing screen. If it disagreed
    with the listing, the chip would say "4/5" while the sixth playlist came back locked, and
    nobody could tell which was lying."""

    async def test_it_is_capped(self):
        db = _IdSession([1, 2, 3, 4, 5, 6, 7])

        assert await PlaylistRepository().count_library_visible(db, 7, 5) == 5

    async def test_it_reports_the_real_number_below_the_cap(self):
        db = _IdSession([1, 2, 3])

        assert await PlaylistRepository().count_library_visible(db, 7, 5) == 3

    async def test_an_unlimited_plan_counts_everything(self):
        """An unlimited plan is not an unmeasured one — "how many playlists do our paying users
        actually keep" is exactly the number the fair-use position rests on."""
        db = _IdSession([1, 2, 3, 4, 5, 6, 7])

        assert await PlaylistRepository().count_library_visible(db, 7, -1) == 7

    async def test_an_unresolved_cap_counts_everything(self):
        db = _IdSession([1, 2, 3])

        assert await PlaylistRepository().count_library_visible(db, 7, None) == 3

    async def test_it_never_reports_a_negative(self):
        db = _IdSession([])

        assert await PlaylistRepository().count_library_visible(db, 7, 5) == 0


# --------------------------------------------------------------------------- #
# Plan changes take effect with no write anywhere
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
class TestPrivilegesFollowThePlanBothWays:
    """The behaviour the stored flag could not provide, and the reason it was removed.

    Real incident: the Stripe sandbox → live switch broke the Pro plans, every affected account was
    forced back to free, and their Libraries went on listing every playlist — because
    `is_library_visible` had been stamped `1` while they were Pro and nothing ever revisited it.
    Downgrading a plan did not downgrade the privileges.

    Derived visibility has no such gap: the cap is resolved per request, so the same playlists give
    a different answer the moment the plan changes, in either direction, with no sweep and no write.
    """

    OWNED = [8, 7, 6, 5, 4, 3, 2, 1]  # newest first, matching the query's ordering

    async def test_pro_sees_everything(self):
        visible, _ = await _visible(cap=-1, owned=self.OWNED)

        assert visible is None, "unlimited means no restriction at all"

    async def test_dropping_to_free_restores_the_cap_immediately(self):
        """No migration, no job, no UPDATE. The next read is simply a different answer."""
        visible, _ = await _visible(cap=5, owned=self.OWNED)

        assert visible == {8, 7, 6, 5, 4}

    async def test_an_expired_comp_reverts_with_no_merits_kept(self):
        """An admin grant is time-boxed and `active_grant` compares `ends_at` on every call, so the
        moment it lapses the user resolves to free. Nothing about the Pro period lingers."""
        comped, _ = await _visible(cap=-1, owned=self.OWNED)
        lapsed, _ = await _visible(cap=5, owned=self.OWNED)

        assert comped is None
        assert lapsed == {8, 7, 6, 5, 4}

    async def test_re_upgrading_gives_everything_back(self):
        """Nothing was destroyed on the way down — the playlists were only unreachable."""
        assert (await _visible(cap=5, owned=self.OWNED))[0] == {8, 7, 6, 5, 4}
        assert (await _visible(cap=-1, owned=self.OWNED))[0] is None

    async def test_the_same_five_survive_a_round_trip(self):
        """Free → Pro → free must not shuffle which five are open. It is a fact about `created_at`,
        not a decision recorded anywhere, so it cannot drift."""
        first, _ = await _visible(cap=5, owned=self.OWNED)
        _, _ = await _visible(cap=-1, owned=self.OWNED)
        again, _ = await _visible(cap=5, owned=self.OWNED)

        assert first == again


def test_expiry_is_read_time_for_both_subscription_and_grant() -> None:
    """Asserted against the source because it is the property that removes the need for a sweep.

    A grant is bounded by `ends_at > now` evaluated per call, and a subscription must currently
    hold an active status. Neither is a stored "is_pro" flag that something has to remember to
    clear — which is exactly what went wrong with `is_library_visible`.
    """
    import inspect

    from app.services.entitlement_service import EntitlementService
    from app.services.plan_grant_service import PlanGrantService

    grant = inspect.getsource(PlanGrantService.active_grant)
    resolve = inspect.getsource(EntitlementService)

    assert "UserPlanGrant.ends_at > now" in grant
    assert "UserPlanGrant.revoked_at.is_(None)" in grant
    assert "ACTIVE_SUBSCRIPTION_STATUSES" in resolve
    assert "access_suspended_at.is_(None)" in resolve
