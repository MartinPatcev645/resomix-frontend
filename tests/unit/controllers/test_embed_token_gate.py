"""
Embed access tokens (pricing v2.1, G1)
======================================

Embedding is sold as a Pro feature, but the widget fetched a playlist by UUID from the general
public route with "no auth, no API key, no cookies" — so the gate was on the **button** and the data
was not behind it. Anyone could put someone else's public playlist UUID into an embed URL.

What the token is, and is not, is the whole design:

    is_public → who may SEE it.        token → whether it may be EMBEDDED.

Two independent conditions. The token never widens access beyond what the owner already published,
which is why "valid token + private playlist" must still be a refusal.

The negative cases carry the weight here, so they are the bulk of this file. Fakes throughout — no
DB, no Redis.
"""

import json

import pytest

from app.controllers.playlist_embed_controller import PlaylistEmbedController
from app.services.entitlement_gate import GateResult
from app.services.playlist_embed_service import TOKEN_LENGTH, generate_token


class _Playlist:
    def __init__(self, pid=10, user_id=7, is_public=True):
        self.id = pid
        self.user_id = user_id
        self.is_public = is_public


class _Repo:
    def __init__(self, playlist):
        self.playlist = playlist

    async def async_get_playlist_by_uuid(self, db, uuid):
        return self.playlist


class _PlaylistService:
    def __init__(self, playlist, data_ok=True):
        self.playlist_repository = _Repo(playlist)
        self._data_ok = data_ok

    async def get_playlist_similarity_data(self, db, uuid, user_id=None, partner_id=None):
        if not self._data_ok:
            return {"success": False, "error": "Playlist not found"}
        return {"success": True, "data": {"playlist": {"id": uuid}, "similar_tracks": []}}


class _EmbedService:
    def __init__(self, resolves_to=None, token="abcdefghjkmnpqrs"):
        self.resolves_to = resolves_to
        self.token = token
        self.revoked = False

    async def mint(self, db, playlist_id, user_id):
        class _Row:
            token = self.token

        return _Row()

    async def revoke(self, db, playlist_id):
        self.revoked = True
        return True

    async def resolve_playlist_id(self, db, token):
        return self.resolves_to


class _Gate:
    def __init__(self, allowed=True):
        self.allowed = allowed

    async def check_export(self, db, target, *, user=None, visitor_id=None):
        self.target = target
        return GateResult(True) if self.allowed else GateResult(False, "upgrade_required")


class _User:
    id = 7


class _State:
    partner_id = 1


class _Request:
    state = _State()


def _controller(*, playlist=None, pro=True, resolves_to=None, data_ok=True):
    c = PlaylistEmbedController()
    c.playlist_service = _PlaylistService(playlist if playlist is not None else _Playlist(), data_ok)
    c.embed_service = _EmbedService(resolves_to)
    c.entitlement_gate = _Gate(pro)
    return c


def _body(response):
    return json.loads(response.body)


@pytest.mark.asyncio
class TestMinting:
    async def test_the_owner_on_pro_gets_a_token(self):
        c = _controller()
        r = await c.mint_token(None, "pl-uuid", _User())
        assert r.status_code == 200
        assert _body(r)["data"]["token"]

    async def test_it_is_gated_on_the_embed_export_target(self):
        """Same entitlement the pricing page advertises — not a bespoke flag that could drift."""
        c = _controller()
        await c.mint_token(None, "pl-uuid", _User())
        assert c.entitlement_gate.target == "embed"

    async def test_a_plan_without_embed_is_refused(self):
        c = _controller(pro=False)
        r = await c.mint_token(None, "pl-uuid", _User())
        assert r.status_code == 402
        assert _body(r)["code"] == "plan_required"

    async def test_a_non_owner_cannot_mint(self):
        """Minting for someone else's playlist would recreate the exact hole this closes, only
        with a token attached. 404, not 403 — a stranger learns nothing about what exists."""
        c = _controller(playlist=_Playlist(user_id=999))
        assert (await c.mint_token(None, "pl-uuid", _User())).status_code == 404

    async def test_a_missing_playlist_is_404(self):
        c = _controller(playlist=None)
        c.playlist_service.playlist_repository.playlist = None
        assert (await c.mint_token(None, "pl-uuid", _User())).status_code == 404

    async def test_the_response_reports_whether_it_will_actually_render(self):
        """A private playlist mints fine but shows nothing. Saying so beats letting the owner paste
        a snippet that renders an empty box."""
        c = _controller(playlist=_Playlist(is_public=False))
        assert _body(await c.mint_token(None, "pl-uuid", _User()))["data"]["is_public"] is False


@pytest.mark.asyncio
class TestRevoking:
    async def test_the_owner_can_withdraw_an_embed(self):
        c = _controller()
        r = await c.revoke_token(None, "pl-uuid", _User())
        assert r.status_code == 200
        assert c.embed_service.revoked is True

    async def test_a_non_owner_cannot_revoke(self):
        """Otherwise anyone could switch off anyone else's embeds."""
        c = _controller(playlist=_Playlist(user_id=999))
        assert (await c.revoke_token(None, "pl-uuid", _User())).status_code == 404
        assert c.embed_service.revoked is False


@pytest.mark.asyncio
class TestServingTheWidget:
    async def test_a_valid_pair_is_served(self):
        c = _controller(resolves_to=10)
        r = await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")
        assert r.status_code == 200
        assert _body(r)["data"]["similar_tracks"] == []

    async def test_no_token_is_refused(self):
        """The whole point: a bare UUID no longer renders."""
        c = _controller(resolves_to=None)
        assert (await c.get_embedded_playlist(None, _Request(), "pl-uuid", None)).status_code == 404

    async def test_an_unknown_or_revoked_token_is_refused(self):
        c = _controller(resolves_to=None)
        assert (await c.get_embedded_playlist(None, _Request(), "pl-uuid", "zzzz")).status_code == 404

    async def test_a_token_for_a_DIFFERENT_playlist_is_refused(self):
        """Without this any valid token would unlock any uuid — the same bug, one indirection
        later. This is the single most important assertion in the file."""
        c = _controller(playlist=_Playlist(pid=10), resolves_to=999)
        assert (await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")).status_code == 404

    async def test_a_private_playlist_is_refused_even_with_a_valid_token(self):
        """The token authorises embedding; it does not publish anything. Turning a playlist private
        must kill its embeds — that is what the owner just asked for."""
        c = _controller(playlist=_Playlist(is_public=False), resolves_to=10)
        assert (await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")).status_code == 404

    async def test_a_deleted_playlist_is_refused(self):
        c = _controller(resolves_to=10)
        c.playlist_service.playlist_repository.playlist = None
        assert (await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")).status_code == 404

    async def test_the_partner_is_passed_through(self):
        """Same trap as the export endpoint: the tracks query filters on partner_id, and passing
        None yields an empty playlist with no error anywhere."""
        seen = {}

        c = _controller(resolves_to=10)

        async def _capture(db, uuid, user_id=None, partner_id=None):
            seen["partner_id"] = partner_id
            return {"success": True, "data": {}}

        c.playlist_service.get_playlist_similarity_data = _capture
        await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")
        assert seen["partner_id"] == 1


@pytest.mark.asyncio
class TestFailuresAreIndistinguishable:
    """Different 404 bodies would confirm which UUIDs exist and which tokens are merely stale —
    a free enumeration oracle on an endpoint with no auth."""

    async def test_every_refusal_uses_the_same_body(self):
        cases = [
            _controller(resolves_to=None),                                    # bad token
            _controller(playlist=_Playlist(is_public=False), resolves_to=10),  # private
            _controller(playlist=_Playlist(pid=10), resolves_to=999),          # wrong playlist
            _controller(resolves_to=10, data_ok=False),                        # data gone
        ]
        bodies = set()
        for c in cases:
            r = await c.get_embedded_playlist(None, _Request(), "pl-uuid", "abcdefghjkmnpqrs")
            assert r.status_code == 404
            bodies.add(_body(r)["error"])
        assert len(bodies) == 1


class TestTokenGeneration:
    def test_it_is_the_declared_length(self):
        assert len(generate_token()) == TOKEN_LENGTH

    def test_it_uses_a_cryptographic_source(self):
        """`random` is seeded predictably enough to enumerate, and these are guessed at from the
        open internet."""
        import inspect

        import app.services.playlist_embed_service as module

        src = inspect.getsource(module)
        assert "secrets.choice" in src
        assert "import random" not in src

    def test_tokens_do_not_repeat(self):
        assert len({generate_token() for _ in range(500)}) == 500

    def test_the_alphabet_excludes_look_alikes(self):
        """These end up in HTML snippets people copy, paste and occasionally retype. An ambiguous
        character turns a working embed into a 404 nobody can debug."""
        alphabet = {c for _ in range(200) for c in generate_token()}
        assert not (alphabet & set("01lIO"))

    def test_a_wrong_length_token_is_rejected_without_a_query(self):
        """Cheap shape check first — public endpoints collect noise, and none of it deserves a
        database round-trip."""
        import inspect

        from app.services.playlist_embed_service import PlaylistEmbedService

        src = inspect.getsource(PlaylistEmbedService.resolve_playlist_id)
        assert "len(token) != TOKEN_LENGTH" in src


class TestMintingIsIdempotent:
    def test_it_reuses_an_active_token(self):
        """Re-opening the Embed modal must not invalidate a snippet already pasted into a live
        page. Withdrawing is an explicit revoke, never a side effect of looking."""
        import inspect

        from app.services.playlist_embed_service import PlaylistEmbedService

        src = inspect.getsource(PlaylistEmbedService.mint)
        assert "get_active_token" in src
        assert "return existing" in src

    def test_revocation_is_soft(self):
        """The row survives, so a withdrawn embed stays distinguishable from one never minted."""
        import inspect

        from app.services.playlist_embed_service import PlaylistEmbedService

        src = inspect.getsource(PlaylistEmbedService.revoke)
        assert "revoked_at" in src
        assert "delete" not in src.lower()
