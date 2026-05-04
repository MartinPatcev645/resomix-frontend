"""
Verification test for Phase 3 repository/schema changes.
Uses direct spec loading to bypass __init__.py files that depend on uninstalled packages.
"""
import sys
import os
import importlib.util

sys.path.append(os.getcwd())

def load_module(name, path):
    """Load a Python module directly by file path, bypassing package __init__."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

print("--- Testing model imports ---")
from app.models import (
    Base, Party, Label, Genre, Contributor, Message, Release, Track,
    TrackContributor, ReleaseTrack, ReleaseContributor, ReleaseFile,
    AudioFile, ImageFile, DocumentFile, UserTrackEngagement,
    Playlist, PlaylistTrack, UserPlaylistEngagement, PlaylistTransferTrack,
    TrackRating, PlaylistRating, PromoCode, Cart, CartItem, Order, Purchase,
    UserSubscription, SystemLog, ConsumptionEvent, IngestLog, Deal, ReleaseDeal,
    RoyaltyRate
)
print(f"✅ All {len(Base.metadata.tables)} models/tables verified")

print("\n--- Testing repository imports ---")
base = os.path.join(os.getcwd(), "app", "repositories")

# Must load base_repository first since others inherit from it
load_module("app.repositories.base_repository", os.path.join(base, "base_repository.py"))

repos = {
    "track_repository": "TrackRepository",
    "similarity_repository": "SimilarityRepository",
    "release_repository": "ReleaseRepository",
    "genre_repository": "GenreRepository",
    "contributor_repository": "ContributorRepository",
    "playlist_repository": "PlaylistRepository",
}

loaded = {}
for filename, classname in repos.items():
    mod = load_module(f"app.repositories.{filename}", os.path.join(base, f"{filename}.py"))
    cls = getattr(mod, classname)
    loaded[classname] = cls()
    print(f"✅ {classname} imported")

print("\n--- Verifying PlaylistRepository methods ---")
pr = loaded["PlaylistRepository"]
pr_methods = [
    'async_create_similarity_playlist', 'async_fork_playlist',
    'async_get_playlist_by_uuid', 'async_rename_playlist',
    'async_make_playlist_public', 'async_get_playlist_similarity_data',
    'async_get_playlist_hls_data', 'async_get_playlist_list_admin',
    'async_delete_playlist_admin', 'async_batch_delete_playlists_admin',
    'async_change_playlist_visibility_by_id', 'async_batch_change_playlist_visibility',
    'async_get_all_playlists_for_export', 'async_get_playlist_detail_by_uuid_admin',
    'async_get_all_user_playlists'
]
for m in pr_methods:
    assert hasattr(pr, m), f"MISSING: {m}"
print(f"✅ All {len(pr_methods)} PlaylistRepository methods present")

print("\n--- Verifying TrackRepository methods ---")
tr = loaded["TrackRepository"]
tr_methods = [
    'add_contributor_to_track', 'add_artist_to_track',
    'get_contributors_for_track', 'get_artists_for_track',
    'get_track_path_by_uuid', 'async_get_track_path_by_uuid',
    'get_with_relationships', 'async_get_with_relationships',
]
for m in tr_methods:
    assert hasattr(tr, m), f"MISSING: {m}"
print(f"✅ All TrackRepository methods present")

print("\n✅✅✅ ALL VERIFICATION PASSED ✅✅✅")
