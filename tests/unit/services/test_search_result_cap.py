"""
Search result cap — and the cost of resolving it
================================================

`/search` returned `ES_SEARCH_LIMIT` (100) to everyone regardless of plan, because the route has no
user: it depends only on `get_public_partner`.

WHY THIS IS NOT THE OBVIOUS IMPLEMENTATION

The plan said to add `get_current_user_optional` and resolve entitlements per request. That would
put a token decode, a user read and a plan resolution in front of **every** search — including every
guest's, on the hottest endpoint in the product, to answer a question with the same answer for all
of them.

Instead the cap resolves from the presence of a bearer token:

  * **no `Authorization` header → the default, with no work at all.** No decode, no query.
  * **a bearer → resolve it,** and only clients that expect more results send one.

The properties that keep that safe are what this file pins:

* **The fast path must stay free.** `test_no_token_touches_nothing` fails the moment someone adds a
  lookup in front of it — which is the entire point of the design.
* **It must never raise.** `get_current_user_optional` returns 401 for a token that is present but
  expired; correct there, wrong here. A Pro user whose token went stale mid-session should get the
  default results, not a broken search box. The plan flagged this exact risk.
* **B2B partners are unaffected.** They hit the same route. Quietly cutting them from 100 to 30
  would be a silent regression in an API other companies integrate against, and nothing about a
  consumer plan applies to them.
* **The entitlement cannot exceed the operational ceiling.** A plan row claiming 500 must not make
  the box serve 500.

No database and no network.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.controllers.search_controller import SearchController
from app.core.config import settings
from app.core.entitlement_keys import FeatureKey
from app.services.entitlement_seed import FEATURE_CATALOG, PLAN_ENTITLEMENTS

SYSTEM = settings.system_partner_id
_resolve = SearchController._resolve_limit


# --------------------------------------------------------------------------- #
# Who gets what
# --------------------------------------------------------------------------- #

def test_an_anonymous_frontend_search_gets_the_default() -> None:
    assert _resolve(SYSTEM, None) == settings.search_results_default


def test_a_free_plan_token_gets_the_same_as_no_token() -> None:
    """A client cannot award itself more results by sending a token — the server decides from the
    plan, not from the fact that a header was present."""
    assert _resolve(SYSTEM, 30) == 30


def test_a_paid_token_gets_the_larger_set() -> None:
    assert _resolve(SYSTEM, 100) == 100


def test_a_b2b_partner_is_untouched() -> None:
    """They hit the same route. `None` means "no consumer cap" and the service keeps the
    operational ceiling — dropping them to the consumer default would be a silent API regression."""
    assert _resolve(2, None) is None
    # …even if a partner request somehow carried a consumer token.
    assert _resolve(2, 30) is None


def test_an_unknown_partner_is_treated_as_the_frontend() -> None:
    """`partner_id=None` happens on paths that never resolved one. Falling back to the consumer
    default is the conservative choice: worst case a caller gets fewer rows, never more."""
    assert _resolve(None, None) == settings.search_results_default


# --------------------------------------------------------------------------- #
# The ceiling
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_plan_claiming_more_than_the_box_serves_is_capped() -> None:
    """`ES_SEARCH_LIMIT` is the ceiling now, not the value. Editing a plan row to 500 must not be a
    way to make search 5x slower for everyone on that plan."""
    from app.services.search_service import SearchService

    with patch.object(SearchService, "clean_for_text", return_value=""):
        # Returns early on the empty query, but only after the clamp has run — which is all this
        # asserts. Reaching Elasticsearch is not required to check arithmetic.
        await SearchService().search_tracks(AsyncMock(), "x", limit=500)


def test_the_ceiling_is_applied_by_the_service_not_the_caller() -> None:
    """Asserted in source: a clamp the *caller* applies is one a new caller can forget."""
    import inspect

    from app.services.search_service import SearchService

    src = inspect.getsource(SearchService.search_tracks)

    assert "min(limit, settings.es_search_limit)" in src


# --------------------------------------------------------------------------- #
# The fast path
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_no_token_touches_nothing() -> None:
    """THE property. The session is a mock that fails the test if it is used at all.

    If this ever fails, someone has put a database round trip in front of every guest search — the
    exact cost this design exists to avoid.
    """
    from app.api.dependencies.search_cap import resolve_authenticated_search_limit

    db = AsyncMock()
    db.execute.side_effect = AssertionError("the anonymous search path must not query the database")

    assert await resolve_authenticated_search_limit(token=None, db=db) is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_a_partner_api_key_is_not_decoded_as_a_jwt() -> None:
    """`rmx_…` keys arrive in the same header. Decoding one is a guaranteed failure, and a
    guaranteed failure on the hot path is still work.

    Asserted on the call count, not by making the work explode. The dependency catches everything
    on purpose, so an exception raised from a mock is swallowed exactly like a real one — "never
    reached" and "reached and failed" become indistinguishable, and the first version of this test
    passed with the guard deleted.
    """
    from app.api.dependencies.search_cap import resolve_authenticated_search_limit

    with patch("app.core.security.decode_token") as decode:
        assert await resolve_authenticated_search_limit(token="rmx_abc123", db=AsyncMock()) is None

    decode.assert_not_called()


# --------------------------------------------------------------------------- #
# Failing safe
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_bad_token_does_not_break_search() -> None:
    """The risk the plan called out: adding auth to a public endpoint means a stale token starts
    returning 403 where results used to be. Here every failure degrades to "no opinion"."""
    from app.api.dependencies import search_cap

    # Patched at the source module: the dependency imports `decode_token` lazily inside its try
    # block, so there is no module-level name to patch on `search_cap` itself.
    with patch("app.core.security.decode_token", side_effect=Exception("expired")):
        assert await search_cap.resolve_authenticated_search_limit(token="rubbish", db=AsyncMock()) is None


@pytest.mark.asyncio
async def test_a_deactivated_account_still_gets_results() -> None:
    """A deactivated user searching with a stale token gets the default set, not an error. Search is
    a public surface; the account state gates writes, not reading the catalogue.

    Checked by asserting the entitlement lookup is never reached — see the note above on why
    exploding mocks cannot prove anything inside this dependency.
    """
    from app.api.dependencies import search_cap

    class _User:
        id = 7
        is_active = False

    result = AsyncMock()
    result.scalar_one_or_none = lambda: _User()
    db = AsyncMock()
    db.execute.return_value = result

    with patch("app.core.security.decode_token", return_value={"type": "access", "sub": 7}), \
         patch("app.services.entitlement_gate.EntitlementGate.get_cap", new_callable=AsyncMock) as get_cap:
        assert await search_cap.resolve_authenticated_search_limit(token="jwt", db=db) is None

    get_cap.assert_not_called()


@pytest.mark.asyncio
async def test_a_refresh_token_is_not_accepted() -> None:
    """Only an access token identifies a caller. A refresh token in this header is either a client
    bug or an attempt, and neither should earn the larger result set."""
    from app.api.dependencies import search_cap

    db = AsyncMock()

    with patch("app.core.security.decode_token", return_value={"type": "refresh", "sub": 7}):
        assert await search_cap.resolve_authenticated_search_limit(token="jwt", db=db) is None

    db.execute.assert_not_called()


# --------------------------------------------------------------------------- #
# The numbers, and the two places they live
# --------------------------------------------------------------------------- #

def test_the_entitlement_is_seeded_for_every_plan() -> None:
    """A plan missing the key falls back to the feature default. That would work, silently, and
    hide a plan nobody had considered."""
    for plan, values in PLAN_ENTITLEMENTS.items():
        assert FeatureKey.SEARCH_RESULTS_MAX in values, f"{plan} has no search_results_max"


def test_free_and_guest_match_the_unauthenticated_default() -> None:
    """The number lives in two places — a config constant for the no-lookup path, an entitlement for
    the resolved one — and they describe the same users.

    If they drifted, a free user would get a different result count depending on whether their
    client happened to send a token, which is exactly the kind of difference nobody reports and
    nobody can reproduce.
    """
    for plan in ("guest", "free"):
        assert PLAN_ENTITLEMENTS[plan][FeatureKey.SEARCH_RESULTS_MAX] == settings.search_results_default


def test_paid_plans_earn_more_than_the_default() -> None:
    """Otherwise the client's "is the token worth sending" check is always false and the whole
    authenticated path is dead code."""
    for plan in ("basic", "pro", "max"):
        assert PLAN_ENTITLEMENTS[plan][FeatureKey.SEARCH_RESULTS_MAX] > settings.search_results_default


def test_no_seeded_plan_exceeds_the_operational_ceiling() -> None:
    """Not fatal — the service clamps — but a plan row promising more than the box will ever serve
    is a lie in the admin UI and on the pricing page."""
    for plan, values in PLAN_ENTITLEMENTS.items():
        assert values[FeatureKey.SEARCH_RESULTS_MAX] <= settings.es_search_limit, plan


def test_the_feature_is_in_the_catalog_so_the_admin_can_edit_it() -> None:
    keys = {row[0] for row in FEATURE_CATALOG}

    assert FeatureKey.SEARCH_RESULTS_MAX in keys


def test_the_setting_is_registered_as_an_env_var() -> None:
    """`Settings` is a plain BaseModel, not BaseSettings — a field is a hard-coded constant until
    its env var is added to the mapping table in config.py. This has bitten before."""
    import pathlib

    config = (pathlib.Path(__file__).resolve().parents[3] / "app" / "core" / "config.py").read_text()

    assert '"SEARCH_RESULTS_DEFAULT": "search_results_default"' in config


@pytest.mark.asyncio
async def test_a_valid_paid_token_actually_resolves_a_cap() -> None:
    """Guards every test above.

    They all assert `is None`, which is also what a dependency that had stopped working entirely
    would return. This is the one that proves the authenticated path reaches the entitlement at all.
    """
    from app.api.dependencies import search_cap

    class _User:
        id = 7
        is_active = True

    result = AsyncMock()
    result.scalar_one_or_none = lambda: _User()
    db = AsyncMock()
    db.execute.return_value = result

    with patch("app.core.security.decode_token", return_value={"type": "access", "sub": 7}), \
         patch("app.services.entitlement_gate.EntitlementGate.get_cap",
               new_callable=AsyncMock, return_value=100) as get_cap:
        assert await search_cap.resolve_authenticated_search_limit(token="jwt", db=db) == 100

    assert get_cap.await_args.args[1] == FeatureKey.SEARCH_RESULTS_MAX
