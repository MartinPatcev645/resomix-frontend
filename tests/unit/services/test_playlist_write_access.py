"""Playlist mutations must say WHY they refused, and must authorise before anything else.

A user renamed a playlist they could plainly see and play, and got "Playlist not found" — because
every mutation folded "doesn't exist" and "isn't yours" into one boolean. These pin the distinction,
the wording, and the ORDER: ownership is checked before the payload is even looked at.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.repositories.playlist_repository import (
    DENIAL_MESSAGES,
    DENIAL_STATUS,
    PlaylistWriteDenial,
    PlaylistRepository,
)
from app.services.playlist_service import PlaylistService

OWNER_ID = 42
STRANGER_ID = 99
UUID = "7e90d261-ee10-44f4-be09-94d85e71dea3"


def _playlist(user_id):
    p = MagicMock()
    p.id = 289
    p.user_id = user_id
    p.name = "Soukie & Windish - Sun Wanted"
    p.partner_id = 1
    return p


def _repo_returning(playlist):
    """A repository whose uuid lookup returns `playlist` (or None)."""
    repo = PlaylistRepository()
    repo.async_get_playlist_by_uuid = AsyncMock(return_value=playlist)
    return repo


class TestAuthoriser:
    @pytest.mark.asyncio
    async def test_owner_may_write(self):
        repo = _repo_returning(_playlist(OWNER_ID))
        found, denial = await repo.async_get_playlist_for_write(None, UUID, OWNER_ID)
        assert denial is None and found is not None

    @pytest.mark.asyncio
    async def test_non_owner_is_refused_as_not_owner_not_as_missing(self):
        """The bug: this used to be indistinguishable from a genuine 404."""
        repo = _repo_returning(_playlist(OWNER_ID))
        found, denial = await repo.async_get_playlist_for_write(None, UUID, STRANGER_ID)
        assert found is None
        assert denial is PlaylistWriteDenial.NOT_OWNER

    @pytest.mark.asyncio
    async def test_guest_created_playlist_is_not_owner_not_missing(self):
        """user_id NULL — created before sign-in and never claimed. Visible, playable, not yours."""
        repo = _repo_returning(_playlist(None))
        _found, denial = await repo.async_get_playlist_for_write(None, UUID, OWNER_ID)
        assert denial is PlaylistWriteDenial.NOT_OWNER

    @pytest.mark.asyncio
    async def test_genuinely_absent_is_not_found(self):
        repo = _repo_returning(None)
        _found, denial = await repo.async_get_playlist_for_write(None, UUID, OWNER_ID)
        assert denial is PlaylistWriteDenial.NOT_FOUND

    @pytest.mark.asyncio
    async def test_internal_caller_without_user_id_is_not_ownership_checked(self):
        repo = _repo_returning(_playlist(OWNER_ID))
        _found, denial = await repo.async_get_playlist_for_write(None, UUID, None)
        assert denial is None


class TestMessagesAndStatuses:
    def test_ownership_refusal_does_not_claim_the_playlist_is_missing(self):
        message = DENIAL_MESSAGES[PlaylistWriteDenial.NOT_OWNER].lower()
        assert "not found" not in message
        assert "access" in message

    def test_ownership_refusal_is_403_and_absence_is_404(self):
        assert DENIAL_STATUS[PlaylistWriteDenial.NOT_OWNER] == 403
        assert DENIAL_STATUS[PlaylistWriteDenial.NOT_FOUND] == 404


class TestRenameChecksOwnershipBeforeTheName:
    """The ordering requirement, stated as a test."""

    @staticmethod
    def _service(playlist):
        service = PlaylistService()
        service.playlist_repository.async_get_playlist_by_uuid = AsyncMock(return_value=playlist)
        service.playlist_repository.async_rename_playlist = AsyncMock(
            return_value={"success": True, "old_name": "old", "denial": None}
        )
        return service

    @pytest.mark.asyncio
    async def test_non_owner_with_an_INVALID_name_hears_about_ownership(self):
        """
        The whole point. An empty name is invalid AND the caller doesn't own the playlist — the
        answer must be the ownership one, because that is the problem they actually have.
        """
        service = self._service(_playlist(OWNER_ID))
        db = AsyncMock()

        result = await service.rename_playlist(db, UUID, "", user_id=STRANGER_ID)

        assert result["success"] is False
        assert result["denial"] == PlaylistWriteDenial.NOT_OWNER.value
        assert result["error"] == DENIAL_MESSAGES[PlaylistWriteDenial.NOT_OWNER]
        service.playlist_repository.async_rename_playlist.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_owner_with_an_invalid_name_hears_about_the_name(self):
        service = self._service(_playlist(OWNER_ID))
        db = AsyncMock()

        result = await service.rename_playlist(db, UUID, "   ", user_id=OWNER_ID)

        assert result["success"] is False
        assert result["denial"] is None
        assert "Enter a name" in result["error"]

    @pytest.mark.asyncio
    async def test_owner_with_a_valid_name_succeeds_and_the_name_is_normalised(self):
        service = self._service(_playlist(OWNER_ID))
        db = AsyncMock()

        result = await service.rename_playlist(
            db, UUID, "  Soukie & Windish - Sun Wanted 2  ", user_id=OWNER_ID
        )

        assert result["success"] is True
        stored = service.playlist_repository.async_rename_playlist.await_args.args[2]
        assert stored == "Soukie & Windish - Sun Wanted 2"
