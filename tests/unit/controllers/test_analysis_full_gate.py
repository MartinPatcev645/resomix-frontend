"""
Analysis gating — result projection and the token bypass (pricing v2.1, C3)
===========================================================================

Two paths reach the full canonical analysis, and gating one without the other gates nothing:

  1. ``GET  /analysis/{id}/result``       — proxied through here, so it can be projected.
  2. ``POST /analysis/{uuid}/token``      — mints a token the client redeems **directly against the
     analysis service's cache**. Alwyzon is not in that request, so there is no opportunity to
     project anything: the whole document is handed over. Leaving it open would put the Pro
     dashboard one extra call away for everyone.

The client already copes with a refused mint — ``alwyzonFinalResult`` prefers the cache and falls
back to the proxy on any failure — so a free user lands on the projected result, not an error.

Fakes throughout: no DB, no analysis service, no Redis.
"""

import json

import pytest

from app.controllers.analysis_result_controller import AnalysisResultController
from app.services.analysis_projection import LOCK_FLAG
from app.services.entitlement_gate import GateResult


class _Row:
    analysis_uuid = "an-1"
    track_id = 5
    user_id = 7
    partner_id = 1
    is_public = False
    sibling_playlist_state = "ready"


class _Service:
    def __init__(self, row=None):
        self._row = row

    async def get_by_analysis_uuid(self, db, uuid):
        return self._row


class _AnalysisClient:
    def __init__(self, result=None):
        self.result = result if result is not None else _FULL

    async def get_result(self, analysis_id):
        return dict(self.result)


class _Gate:
    def __init__(self, full=True, raises=False):
        self.full = full
        self.raises = raises
        self.calls = []

    async def check_boolean(self, db, key, *, user=None, visitor_id=None):
        self.calls.append(key)
        if self.raises:
            raise RuntimeError("entitlement lookup exploded")
        return GateResult(True) if self.full else GateResult(False, "upgrade_required")


class _User:
    id = 7


_FULL = {
    "state": "succeeded",
    "rhythm": {"bpm": 124.0, "beat_times_seconds": [0.1, 0.6]},
    "spectral": {"mel_spectrogram": [[1, 2]]},
    "energy": {"energy_curve": [0.1], "onset_times_seconds": [0.2]},
}


def _controller(*, full=True, raises=False, row=_Row(), result=None):
    c = AnalysisResultController()
    c.service = _Service(row)
    c.analysis_client = _AnalysisClient(result)
    c.entitlement_gate = _Gate(full, raises)

    async def _no_refs(db, r, doc):
        return doc

    c._attach_playback_refs = _no_refs
    return c


def _data(response):
    return json.loads(response.body)["data"]


@pytest.mark.asyncio
class TestResultProjection:
    async def test_pro_receives_the_whole_document(self):
        c = _controller(full=True)
        data = _data(await c.get_result(None, "an-1", _User()))
        assert data["spectral"]["mel_spectrogram"] == [[1, 2]]
        assert data["rhythm"]["beat_times_seconds"] == [0.1, 0.6]
        assert LOCK_FLAG not in data

    async def test_free_receives_the_card_only(self):
        c = _controller(full=False)
        data = _data(await c.get_result(None, "an-1", _User()))
        assert "spectral" not in data
        assert "beat_times_seconds" not in data["rhythm"]

    async def test_free_still_gets_the_card_fields(self):
        """The gate is a page boundary, not an on/off switch. A free user who uploaded is entitled
        to BPM and the energy journey — refusing the request outright would take those away."""
        c = _controller(full=False)
        data = _data(await c.get_result(None, "an-1", _User()))
        assert data["rhythm"]["bpm"] == 124.0
        assert data["energy"]["energy_curve"] == [0.1]

    async def test_free_is_told_it_is_locked(self):
        c = _controller(full=False)
        assert _data(await c.get_result(None, "an-1", _User()))[LOCK_FLAG] is True

    async def test_the_request_still_succeeds_for_free(self):
        """200, not 402. The card is legitimate content, not a denial."""
        c = _controller(full=False)
        assert (await c.get_result(None, "an-1", _User())).status_code == 200

    async def test_a_guest_on_a_public_analysis_is_also_projected(self):
        row = _Row()
        row.is_public = True
        c = _controller(full=False, row=row)
        assert "spectral" not in _data(await c.get_result(None, "an-1", None))


@pytest.mark.asyncio
class TestProjectionRunsBeforePlaybackRefsAreAttached:
    async def test_playback_ids_survive_the_projection(self):
        """Order matters: the allow-list would drop `playlist_uuid` if the refs were attached
        first, and the "Find similar tracks" link is on the FREE card."""
        c = _controller(full=False)

        async def _attach(db, row, doc):
            doc["playlist_uuid"] = "p-1"
            doc["track_uuid"] = "t-1"
            return doc

        c._attach_playback_refs = _attach
        data = _data(await c.get_result(None, "an-1", _User()))
        assert data["playlist_uuid"] == "p-1"
        assert data["track_uuid"] == "t-1"


@pytest.mark.asyncio
class TestUpstreamFailuresAreUnchanged:
    async def test_an_expired_analysis_is_still_404(self):
        c = _controller(full=False, result={"status": "error", "status_code": 404})
        assert (await c.get_result(None, "an-1", _User())).status_code == 404

    async def test_an_upstream_fault_is_still_502(self):
        c = _controller(full=False, result={"status": "error", "status_code": 500})
        assert (await c.get_result(None, "an-1", _User())).status_code == 502

    async def test_a_missing_analysis_is_still_404(self):
        c = _controller(full=False, row=None)
        assert (await c.get_result(None, "an-1", _User())).status_code == 404

    async def test_a_foreign_private_analysis_is_still_403(self):
        """The entitlement gate must not have displaced the ownership check — they answer
        different questions and both have to run."""
        row = _Row()
        row.user_id = 999
        c = _controller(full=True, row=row)
        assert (await c.get_result(None, "an-1", _User())).status_code == 403


@pytest.mark.asyncio
class TestEntitlementLookupFailsOpen:
    async def test_a_broken_lookup_serves_the_full_result(self):
        """This is an upsell boundary, not a security one. Failing closed would silently hand a
        paying subscriber a stripped dashboard with nothing anywhere to explain it."""
        c = _controller(raises=True)
        data = _data(await c.get_result(None, "an-1", _User()))
        assert "spectral" in data

    async def test_a_broken_lookup_does_not_500(self):
        c = _controller(raises=True)
        assert (await c.get_result(None, "an-1", _User())).status_code == 200


@pytest.mark.asyncio
class TestTokenMintIsTheOtherDoor:
    async def _mint(self, controller, user=_User()):
        class _Req:
            headers = {}
            client = None

        return await controller.mint_retrieval_token(None, _Req(), "an-1", user)

    async def test_pro_can_mint(self):
        c = _controller(full=True)
        assert (await self._mint(c)).status_code == 200

    async def test_free_cannot_mint(self):
        """The token buys the RAW cached JSON straight from the analysis service — no projection is
        possible, because we are not in that request."""
        c = _controller(full=False)
        assert (await self._mint(c)).status_code == 402

    async def test_the_refusal_says_plan_required(self):
        c = _controller(full=False)
        body = json.loads((await self._mint(c)).body)
        assert body["code"] == "plan_required"

    async def test_the_refusal_reassures_about_the_summary(self):
        """The copy has to say the card stays free, or the message reads as "your analysis is
        gone" rather than "the dashboard is Pro"."""
        c = _controller(full=False)
        body = json.loads((await self._mint(c)).body)
        assert "summary" in body["error"].lower()

    async def test_no_token_is_present_in_a_refusal(self):
        c = _controller(full=False)
        assert "token" not in (await self._mint(c)).body.decode()

    async def test_ownership_is_still_checked_first(self):
        """A stranger must be told 403, not offered an upgrade — buying Pro would not give them
        access to someone else's analysis."""
        row = _Row()
        row.user_id = 999
        c = _controller(full=True, row=row)
        assert (await self._mint(c)).status_code == 403
