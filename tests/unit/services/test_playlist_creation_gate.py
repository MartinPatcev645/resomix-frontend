"""
Playlist Creation Gate Tests
=============================

Ensures that the similarity search endpoint only creates a persistent playlist
under the correct conditions:

    ┌─────────────────────────────────┬───────────────────────┐
    │ Caller                          │ Playlist created?     │
    ├─────────────────────────────────┼───────────────────────┤
    │ Frontend — anonymous            │ NO  (partner_id=1,    │
    │ (partner_id=1, user_id=None)    │      user_id=None)    │
    ├─────────────────────────────────┼───────────────────────┤
    │ Frontend — authenticated        │ YES (partner_id=1,    │
    │ (partner_id=1, user_id set)     │      user_id set)     │
    ├─────────────────────────────────┼───────────────────────┤
    │ B2B partner — API key only      │ YES (partner_id!=1,   │
    │ (partner_id=2, user_id=None)    │      any user_id)     │
    └─────────────────────────────────┴───────────────────────┘

Also tests the play-session gating:

    • Anonymous frontend → 401 (Login required)
    • No API key → 401/403
    • Wrong API key → 401/403
    • Valid B2B key → payload processed (no crash)

All tests are unit-level (no live server required). DB calls are mocked.

Seed track used throughout: 6a0b94ab-2eb0-4649-853e-e97de1e46b7c
(the track referenced in the June-2026 bug report).
"""

import pytest
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch, ANY
from app.services.similarity_service import SimilarityService


@contextmanager
def _patch_internal_singletons(playlist_info=None):
    """
    Patch classes that are instantiated *inside* SimilarityService methods so
    that the tests don't produce 'coroutine never awaited' warnings from
    unawaited AsyncMock calls inside those real classes when called with a
    mock db session.
    """
    with patch(
        "app.services.similarity_service.OperationLimitRepository"
    ) as mock_olr_cls, patch(
        "app.services.playlist_engagement_service.PlaylistEngagementService"
    ) as mock_eng_cls:
        olr_instance = AsyncMock()
        mock_olr_cls.return_value = olr_instance

        eng_instance = AsyncMock()
        # Return the provided playlist_info dict unchanged so tests can
        # still assert on the 'playlist' key in the response.
        eng_instance.enrich_playlist_with_engagement.return_value = (
            playlist_info or {}
        )
        mock_eng_cls.return_value = eng_instance

        yield

SEED_UUID = "6a0b94ab-2eb0-4649-853e-e97de1e46b7c"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_similarity_server_response(uuids: list) -> dict:
    """Return a minimal valid response from the Hetzner similarity server."""
    return {
        "status": "success",
        "results": [{"uuid": u, "score": 0.9} for u in uuids],
    }


def _make_track_details(uuid: str) -> dict:
    # Use the UUID prefix to make title/artist unique per track so deduplication
    # does not collapse all 3 results into one.
    tag = uuid[:4]
    return {
        "id": uuid,
        "track_id": abs(hash(uuid)) % 10000 + 1,  # unique int id for each track
        "title": f"Track {tag}",
        "artist": f"Artist {tag}",
        "duration": 300 + hash(uuid) % 60,
        "filename": uuid,  # unique filename prevents filename-based de-dup collapse
        "label": None,
        "year": None,
        "type": "track",
        "partner_id": 1,
    }


def _make_db_track(uuid: str, internal_id: int = 42):
    """Return a mock ORM track object."""
    t = MagicMock()
    t.id = internal_id
    t.uuid = uuid
    return t


def _make_playlist_info(uuid: str = "playlist-uuid-111") -> dict:
    return {
        "id": uuid,
        "pk": 1,
        "name": "Playlist",
        "is_public": False,
        "fork_id": "",
        "is_favorite": False,
        "is_following": False,
    }


# ---------------------------------------------------------------------------
# Similarity gate: get_similarity_by_path
# ---------------------------------------------------------------------------

class TestPlaylistGate_SimilarityByPath:
    """Tests for the playlist-creation gate inside get_similarity_by_path."""

    def _make_service_with_mocks(self):
        service = SimilarityService()
        similar_uuids = ["aaaa-1111", "bbbb-2222", "cccc-3333"]

        # Use AsyncMock() for entire repo objects so that every method is automatically
        # async — including any we don't explicitly set (e.g. async_update_track_duration).
        service.similarity_repository = AsyncMock()
        service.similarity_repository.async_get_reference_track_details_by_path.return_value = (
            _make_track_details(SEED_UUID)
        )
        service.similarity_repository.async_get_track_details_by_uuids.return_value = {
            u: _make_track_details(u) for u in similar_uuids
        }

        service.track_repository = AsyncMock()
        service.track_repository.async_get_by_uuid.return_value = _make_db_track(SEED_UUID)

        service.playlist_repository = AsyncMock()
        service.playlist_repository.async_create_similarity_playlist.return_value = (
            _make_playlist_info()
        )

        return service, similar_uuids

    @pytest.mark.asyncio
    async def test_anonymous_frontend_no_playlist_created(self):
        """
        partner_id=1 + user_id=None → playlist_repository.async_create_similarity_playlist
        must NOT be called, and the returned dict must NOT contain a 'playlist' key.
        """
        service, similar_uuids = self._make_service_with_mocks()
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), _patch_internal_singletons():
            result = await service.get_similarity_by_path(
                db=db,
                server_track_path=f"previews/{SEED_UUID}.mp3",
                queried_track_uuid=SEED_UUID,
                partner_id=1,
                user_id=None,      # <-- anonymous
            )

        # No playlist must be created
        service.playlist_repository.async_create_similarity_playlist.assert_not_called()
        # Response must not include 'playlist' key
        assert "playlist" not in result, (
            "Anonymous frontend users must NOT get a playlist. "
            f"Got keys: {list(result.keys())}"
        )

    @pytest.mark.asyncio
    async def test_authenticated_frontend_playlist_created(self):
        """
        partner_id=1 + user_id=99 (logged-in user) → playlist IS created and returned.
        """
        service, similar_uuids = self._make_service_with_mocks()
        playlist = _make_playlist_info()
        service.playlist_repository.async_create_similarity_playlist.return_value = playlist
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), _patch_internal_singletons(playlist_info=playlist):
            result = await service.get_similarity_by_path(
                db=db,
                server_track_path=f"previews/{SEED_UUID}.mp3",
                queried_track_uuid=SEED_UUID,
                partner_id=1,
                user_id=99,        # <-- authenticated user
            )

        service.playlist_repository.async_create_similarity_playlist.assert_called_once()
        call_kwargs = service.playlist_repository.async_create_similarity_playlist.call_args.kwargs
        assert call_kwargs.get("user_id") == 99
        assert call_kwargs.get("partner_id") == 1

        assert "playlist" in result, (
            "Authenticated frontend user must get a playlist in the response."
        )

    @pytest.mark.asyncio
    async def test_b2b_partner_no_user_playlist_created(self):
        """
        partner_id=2, user_id=None → playlist IS created because it is a B2B partner
        (any partner_id != 1 satisfies the gate, regardless of user_id).
        """
        service, similar_uuids = self._make_service_with_mocks()
        playlist = _make_playlist_info()
        service.playlist_repository.async_create_similarity_playlist.return_value = playlist
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), _patch_internal_singletons(playlist_info=playlist):
            result = await service.get_similarity_by_path(
                db=db,
                server_track_path=f"previews/{SEED_UUID}.mp3",
                queried_track_uuid=SEED_UUID,
                partner_id=2,      # <-- B2B partner
                user_id=None,      # <-- no user, authenticated only via API key
            )

        service.playlist_repository.async_create_similarity_playlist.assert_called_once()
        call_kwargs = service.playlist_repository.async_create_similarity_playlist.call_args.kwargs
        assert call_kwargs.get("partner_id") == 2
        assert call_kwargs.get("user_id") is None

        assert "playlist" in result, (
            "B2B partners must always get a playlist, even without a user_id."
        )

    @pytest.mark.asyncio
    async def test_b2b_partner_with_user_playlist_created(self):
        """
        partner_id=2, user_id=77 → playlist is created (both conditions satisfied).
        """
        service, similar_uuids = self._make_service_with_mocks()
        playlist = _make_playlist_info()
        service.playlist_repository.async_create_similarity_playlist.return_value = playlist
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), _patch_internal_singletons(playlist_info=playlist):
            result = await service.get_similarity_by_path(
                db=db,
                server_track_path=f"previews/{SEED_UUID}.mp3",
                queried_track_uuid=SEED_UUID,
                partner_id=2,
                user_id=77,
            )

        service.playlist_repository.async_create_similarity_playlist.assert_called_once()
        assert "playlist" in result

    @pytest.mark.asyncio
    async def test_gate_logic_is_enforced_even_with_empty_results(self):
        """
        Even when the similarity server returns zero tracks, the gate must not
        create a playlist (there's nothing to put in it).
        """
        service, _ = self._make_service_with_mocks()
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response([]),  # empty
        ), _patch_internal_singletons():
            result = await service.get_similarity_by_path(
                db=db,
                server_track_path=f"previews/{SEED_UUID}.mp3",
                queried_track_uuid=SEED_UUID,
                partner_id=1,
                user_id=99,   # even with a logged-in user
            )

        # No tracks → no playlist regardless of user
        service.playlist_repository.async_create_similarity_playlist.assert_not_called()
        assert "playlist" not in result


# ---------------------------------------------------------------------------
# Similarity gate: calculate_similarity_for_upload
# ---------------------------------------------------------------------------

class TestPlaylistGate_Upload:
    """Tests for the playlist-creation gate inside calculate_similarity_for_upload."""

    def _make_service_with_mocks(self):
        service = SimilarityService()
        similar_uuids = ["dddd-4444", "eeee-5555"]

        service.similarity_repository = AsyncMock()
        service.similarity_repository.async_get_track_details_by_uuids.return_value = {
            u: _make_track_details(u) for u in similar_uuids
        }
        service.similarity_repository.async_get_reference_track_details_by_uuid.return_value = (
            _make_track_details(SEED_UUID)
        )

        service.track_repository = AsyncMock()
        service.track_repository.async_get_by_uuid.return_value = _make_db_track(SEED_UUID)

        service.playlist_repository = AsyncMock()
        service.playlist_repository.async_create_similarity_playlist.return_value = (
            _make_playlist_info()
        )

        return service, similar_uuids

    @pytest.mark.asyncio
    async def test_upload_anonymous_frontend_no_playlist(self):
        service, similar_uuids = self._make_service_with_mocks()
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), patch(
            "app.services.similarity_service.get_duration_from_bytes_sync",
            return_value=120.0,
        ), _patch_internal_singletons():
            result = await service.calculate_similarity_for_upload(
                db=db,
                audio_bytes=b"fake",
                original_filename="test.mp3",
                track_uuid=SEED_UUID,
                partner_id=1,
                user_id=None,
            )

        service.playlist_repository.async_create_similarity_playlist.assert_not_called()
        assert "playlist" not in result

    @pytest.mark.asyncio
    async def test_upload_authenticated_frontend_playlist_created(self):
        service, similar_uuids = self._make_service_with_mocks()
        playlist = _make_playlist_info()
        service.playlist_repository.async_create_similarity_playlist.return_value = playlist
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), patch(
            "app.services.similarity_service.get_duration_from_bytes_sync",
            return_value=120.0,
        ), _patch_internal_singletons(playlist_info=playlist):
            result = await service.calculate_similarity_for_upload(
                db=db,
                audio_bytes=b"fake",
                original_filename="test.mp3",
                track_uuid=SEED_UUID,
                partner_id=1,
                user_id=55,
            )

        service.playlist_repository.async_create_similarity_playlist.assert_called_once()
        assert "playlist" in result

    @pytest.mark.asyncio
    async def test_upload_b2b_partner_no_user_playlist_created(self):
        service, similar_uuids = self._make_service_with_mocks()
        playlist = _make_playlist_info()
        service.playlist_repository.async_create_similarity_playlist.return_value = playlist
        db = AsyncMock()

        with patch.object(
            service,
            "_call_similarity_server",
            new_callable=AsyncMock,
            return_value=_make_similarity_server_response(similar_uuids),
        ), patch(
            "app.services.similarity_service.get_duration_from_bytes_sync",
            return_value=120.0,
        ), _patch_internal_singletons(playlist_info=playlist):
            result = await service.calculate_similarity_for_upload(
                db=db,
                audio_bytes=b"fake",
                original_filename="test.mp3",
                track_uuid=SEED_UUID,
                partner_id=5,
                user_id=None,
            )

        service.playlist_repository.async_create_similarity_playlist.assert_called_once()
        assert "playlist" in result


# ---------------------------------------------------------------------------
# Play-session gate: controller unit tests
# ---------------------------------------------------------------------------

class TestPlaySessionGate:
    """
    Unit tests for PlaylistController.get_playlist_playback_session.

    These test the three gate outcomes without needing a running server:
      • Anonymous frontend (partner_id=1, no user) → 401
      • Authenticated user with existing playlist → 200 (JWT minted)
      • Any caller with non-existent playlist UUID → 404
    """

    @pytest.fixture
    def controller(self):
        from app.controllers.playlist_controller import PlaylistController
        ctrl = PlaylistController()
        # Mock the playlist service and its repository
        ctrl.playlist_service = MagicMock()
        ctrl.playlist_service.playlist_repository = MagicMock()
        ctrl.playlist_service.get_playlist_playback_session = AsyncMock(
            return_value={"success": True, "playback_url": "https://media.resomix.com/playlists/similarity-hls/X.m3u8?token=JWT"}
        )
        return ctrl

    def _make_request(self, host: str = "127.0.0.1"):
        req = MagicMock()
        req.client = MagicMock()
        req.client.host = host
        return req

    def _make_playlist(self, uuid: str = "real-playlist-uuid"):
        p = MagicMock()
        p.uuid = uuid
        p.id = 1
        return p

    @pytest.mark.asyncio
    async def test_anonymous_frontend_returns_401(self, controller):
        """
        partner_id=1, current_user=None → 401 without touching the DB.
        """
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid = AsyncMock()
        db = AsyncMock()

        response = await controller.get_playlist_playback_session(
            request=self._make_request(),
            db=db,
            playlist_id=SEED_UUID,
            partner_id=1,
            current_user=None,  # anonymous
        )

        assert response.status_code == 401
        # DB must NOT be queried for anonymous callers
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid.assert_not_called()

    @pytest.mark.asyncio
    async def test_authenticated_frontend_missing_playlist_returns_404(self, controller):
        """
        partner_id=1, user authenticated, but playlist UUID doesn't exist → 404.
        """
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid = AsyncMock(
            return_value=None  # not found
        )
        db = AsyncMock()
        user = MagicMock()
        user.id = 99

        response = await controller.get_playlist_playback_session(
            request=self._make_request(),
            db=db,
            playlist_id="non-existent-playlist-uuid",
            partner_id=1,
            current_user=user,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_authenticated_frontend_valid_playlist_returns_200(self, controller):
        """
        partner_id=1, user authenticated, valid playlist → 200 with playback_url.
        """
        playlist_uuid = "real-playlist-uuid-abc123"
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid = AsyncMock(
            return_value=self._make_playlist(playlist_uuid)
        )
        db = AsyncMock()
        user = MagicMock()
        user.id = 99

        response = await controller.get_playlist_playback_session(
            request=self._make_request(),
            db=db,
            playlist_id=playlist_uuid,
            partner_id=1,
            current_user=user,
        )

        assert response.status_code == 200
        import json
        body = json.loads(response.body)
        assert "playback_url" in body

    @pytest.mark.asyncio
    async def test_b2b_partner_no_user_missing_playlist_returns_404(self, controller):
        """
        B2B partner (partner_id=2), no user, playlist not found → 404 (not 401).
        B2B partners authenticate via API key only; user is never required.
        """
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid = AsyncMock(
            return_value=None
        )
        db = AsyncMock()

        response = await controller.get_playlist_playback_session(
            request=self._make_request(),
            db=db,
            playlist_id="some-playlist-uuid",
            partner_id=2,
            current_user=None,  # B2B — no user, auth via API key
        )

        assert response.status_code == 404  # Not 401 — B2B doesn't need a user

    @pytest.mark.asyncio
    async def test_b2b_partner_valid_playlist_returns_200(self, controller):
        """
        B2B partner with valid playlist and no user → 200.
        """
        playlist_uuid = "b2b-playlist-uuid-xyz"
        controller.playlist_service.playlist_repository.async_get_playlist_by_uuid = AsyncMock(
            return_value=self._make_playlist(playlist_uuid)
        )
        db = AsyncMock()

        response = await controller.get_playlist_playback_session(
            request=self._make_request(),
            db=db,
            playlist_id=playlist_uuid,
            partner_id=2,
            current_user=None,
        )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# API-level auth gate (live-server integration)
# ---------------------------------------------------------------------------

class TestAuthGate_LiveServer:
    """
    Integration tests that hit the running Alwyzon server on localhost:8001.

    These verify that API key validation (no key / wrong key / right key) is
    enforced BEFORE any similarity or playlist logic runs.

    Requires: server running with `make api`.
    """

    BASE_URL = "http://localhost:8001/api/v1"
    VALID_API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
    WRONG_API_KEY = "bearer-resomix-api-INVALID-KEY-000000000000000000"
    SEED_TRACK_UUID = SEED_UUID

    @pytest.fixture(autouse=True)
    def check_server(self):
        """Skip these tests silently if the server isn't up."""
        import requests as req
        try:
            req.get(f"{self.BASE_URL.rsplit('/api', 1)[0]}/health/", timeout=2)
        except Exception:
            pytest.skip("Alwyzon server not running — skipping live auth-gate tests")

    # --- play-session endpoint ---

    def test_play_session_no_api_key_rejected(self):
        """
        POST /playlists/{uuid}/play-session with NO api_key header → 401/403.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/playlists/{self.SEED_TRACK_UUID}/play-session",
            # No api_key query param, no X-API-KEY header
        )
        assert r.status_code in (401, 403), (
            f"Expected 401/403 for no API key, got {r.status_code}: {r.text}"
        )

    def test_play_session_wrong_api_key_rejected(self):
        """
        POST /playlists/{uuid}/play-session with WRONG api_key → 401/403.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/playlists/{self.SEED_TRACK_UUID}/play-session",
            params={"api_key": self.WRONG_API_KEY},
        )
        assert r.status_code in (401, 403), (
            f"Expected 401/403 for wrong API key, got {r.status_code}: {r.text}"
        )

    def test_play_session_valid_key_anonymous_frontend_401(self):
        """
        POST /playlists/{uuid}/play-session with valid API key but NO JWT user token
        → 401 "Login required" (not 404, not 403, not 200).

        This covers the exact failure path from the June-2026 bug report where
        the frontend called play-session with the seed track UUID and no user.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/playlists/{self.SEED_TRACK_UUID}/play-session",
            params={"api_key": self.VALID_API_KEY},
            # No Authorization header → anonymous user
        )
        assert r.status_code == 401, (
            f"Expected 401 for anonymous frontend + valid API key, got {r.status_code}: {r.text}"
        )
        body = r.json()
        detail = body.get("detail", "")
        assert "login" in detail.lower() or "sign in" in detail.lower(), (
            f"Expected 'login' in detail message, got: {detail}"
        )

    # --- similarity search endpoint ---

    def test_similarity_search_no_api_key_rejected(self):
        """
        POST /similarity/search with no API key → 401/403.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/similarity/search",
            json={"track_id": self.SEED_TRACK_UUID},
        )
        assert r.status_code in (401, 403), (
            f"Expected 401/403 for no API key on similarity search, got {r.status_code}"
        )

    def test_similarity_search_wrong_api_key_rejected(self):
        """
        POST /similarity/search with wrong API key → 401/403.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/similarity/search",
            json={"track_id": self.SEED_TRACK_UUID},
            params={"api_key": self.WRONG_API_KEY},
        )
        assert r.status_code in (401, 403), (
            f"Expected 401/403 for wrong API key on similarity search, got {r.status_code}"
        )

    def test_similarity_search_valid_key_anonymous_succeeds_no_playlist(self):
        """
        POST /similarity/search with valid API key, no user JWT → 200 response.
        The response must NOT contain a 'playlist' key because the caller is anonymous.

        This is the direct reproduction of the June-2026 bug: the similarity search
        was succeeding and appearing to create a playlist even for anonymous users.
        """
        import requests as req
        r = req.post(
            f"{self.BASE_URL}/similarity/search",
            json={"track_id": self.SEED_TRACK_UUID},
            params={"api_key": self.VALID_API_KEY},
            # No Authorization header → anonymous user
        )
        assert r.status_code == 200, (
            f"Similarity search with valid API key should return 200, got {r.status_code}: {r.text}"
        )
        body = r.json()
        data = body.get("data", body)
        assert "playlist" not in data, (
            "Anonymous frontend user must NOT receive a playlist in the similarity response. "
            f"Got keys: {list(data.keys())}"
        )
