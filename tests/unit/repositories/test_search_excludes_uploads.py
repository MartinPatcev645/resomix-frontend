"""
Unit tests for Gap 4 — uploaded tracks must be excluded from similarity-search
results while still being stored/playable under the partner's own folder.

The exclusion is enforced at the DB layer: the similarity result-enrichment path
(`SimilarityRepository.async_get_track_details_by_uuids`) defaults to
`exclude_uploads=True`, which threads through to
`TrackRepository.async_get_tracks_by_uuids(..., exclude_uploads=True)` so uploaded
rows (`track_type == UPLOAD`) are filtered out of the SQL query.
"""

import inspect

import pytest
from unittest.mock import AsyncMock, patch

from app.repositories.similarity_repository import SimilarityRepository


@pytest.mark.asyncio
async def test_details_by_uuids_excludes_uploads_by_default():
    """Default call must request exclude_uploads=True from the track repo."""
    repo = SimilarityRepository()
    db = AsyncMock()

    with patch(
        "app.repositories.track_repository.TrackRepository.async_get_tracks_by_uuids",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = []
        await repo.async_get_track_details_by_uuids(db, ["uuid-a", "uuid-b"], partner_id=5)

        mock_get.assert_awaited_once()
        _, kwargs = mock_get.call_args
        assert kwargs.get("exclude_uploads") is True
        assert kwargs.get("partner_id") == 5


@pytest.mark.asyncio
async def test_details_by_uuids_can_opt_in_to_uploads():
    """Callers may explicitly include uploads (e.g. internal admin tooling)."""
    repo = SimilarityRepository()
    db = AsyncMock()

    with patch(
        "app.repositories.track_repository.TrackRepository.async_get_tracks_by_uuids",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = []
        await repo.async_get_track_details_by_uuids(
            db, ["uuid-a"], partner_id=1, exclude_uploads=False
        )
        _, kwargs = mock_get.call_args
        assert kwargs.get("exclude_uploads") is False


def test_track_repo_signature_supports_exclude_uploads():
    """Defense-in-depth: the repo method exposes the exclude_uploads switch."""
    from app.repositories.track_repository import TrackRepository

    sig = inspect.signature(TrackRepository.async_get_tracks_by_uuids)
    assert "exclude_uploads" in sig.parameters
    # Default is False so general lookups are unaffected; the search path opts in.
    assert sig.parameters["exclude_uploads"].default is False


def test_similarity_default_exclude_uploads_is_true():
    """The search-enrichment method defaults to excluding uploads."""
    sig = inspect.signature(SimilarityRepository.async_get_track_details_by_uuids)
    assert sig.parameters["exclude_uploads"].default is True
