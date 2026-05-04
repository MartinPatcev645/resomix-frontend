"""
Verification test for Phase 2 repository/schema changes.
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
    TrackRating, PlaylistRating
)
print(f"✅ All models imported ({len(Base.metadata.tables)} tables)")

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
    "label_repository": "LabelRepository",
}

loaded = {}
for filename, classname in repos.items():
    mod = load_module(f"app.repositories.{filename}", os.path.join(base, f"{filename}.py"))
    cls = getattr(mod, classname)
    loaded[classname] = cls()
    print(f"✅ {classname} imported")

print("\n--- Testing schema imports (direct load) ---")
schema_base = os.path.join(os.getcwd(), "app", "schemas")
track_schema_mod = load_module("app.schemas.track", os.path.join(schema_base, "track.py"))
print("✅ Track schemas imported")
release_schema_mod = load_module("app.schemas.release", os.path.join(schema_base, "release.py"))
print("✅ Release schemas imported")

# Verify schema classes exist
for cls_name in ["TrackBase", "TrackCreate", "TrackResponse", "AudioFileResponse", "TrackContributorResponse"]:
    assert hasattr(track_schema_mod, cls_name), f"MISSING in track schemas: {cls_name}"
for cls_name in ["ReleaseBase", "ReleaseCreate", "ReleaseResponse", "ReleaseTrackResponse", "ReleaseContributorResponse"]:
    assert hasattr(release_schema_mod, cls_name), f"MISSING in release schemas: {cls_name}"
print("✅ All schema classes verified")

print("\n--- Verifying TrackRepository methods ---")
tr = loaded["TrackRepository"]
tr_methods = [
    'add_contributor_to_track', 'add_artist_to_track',
    'remove_contributor_from_track', 'remove_artist_from_track',
    'get_contributors_for_track', 'get_artists_for_track',
    'async_get_track_contributors', 'async_get_track_artists',
    'get_tracks_for_contributor', 'get_tracks_for_artist',
    'get_track_path_by_uuid', 'async_get_track_path_by_uuid',
    'get_with_relationships', 'async_get_with_relationships',
    'search_tracks', 'async_search_tracks',
    'search_by_artist', 'search_by_genre', 'get_by_bpm_range', 'get_by_key',
    'bulk_create_tracks', 'get_tracks_by_uuids', 'async_get_tracks_by_uuids',
    'async_get_tracks_by_file_paths',
]
for m in tr_methods:
    assert hasattr(tr, m), f"MISSING: {m}"
print(f"✅ All {len(tr_methods)} TrackRepository methods present")

print("\n--- Verifying ReleaseRepository methods ---")
rr = loaded["ReleaseRepository"]
rr_methods = [
    'get_by_title_and_party', 'async_get_by_title_and_party',
    'get_by_party_id', 'async_get_by_party_id',
    'get_or_create_by_title_and_party', 'async_get_or_create_by_title_and_party',
    'get_by_title_and_artist', 'async_get_by_title_and_artist',
    'get_by_artist_id', 'async_get_by_artist_id',
    'get_releases_with_tracks_count', 'async_get_releases_with_tracks_count',
    'search_by_title', 'async_search_by_title',
]
for m in rr_methods:
    assert hasattr(rr, m), f"MISSING: {m}"
print(f"✅ All {len(rr_methods)} ReleaseRepository methods present")

print("\n--- Verifying ContributorRepository methods ---")
cr = loaded["ContributorRepository"]
cr_methods = [
    'get_by_full_name', 'async_get_by_full_name',
    'search_by_name', 'async_search_by_name',
    'get_by_party_id', 'async_get_by_party_id',
    'get_by_artist_name', 'async_get_by_artist_name',
    'search_artists', 'async_search_artists',
]
for m in cr_methods:
    assert hasattr(cr, m), f"MISSING: {m}"
print(f"✅ All {len(cr_methods)} ContributorRepository methods present")

print("\n✅✅✅ ALL VERIFICATION PASSED ✅✅✅")
