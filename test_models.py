import sys
import os

sys.path.append(os.getcwd())

# Import entire package — forces all models to register
from app.models import (
    Base, Party, Label, Genre, Contributor, Message, Release, Track,
    TrackContributor, ReleaseTrack, ReleaseContributor,
    AudioFile, ImageFile, DocumentFile, ReleaseFile, UserTrackEngagement,
    Playlist, PlaylistTrack, UserPlaylistEngagement, PlaylistTransferTrack,
    TrackRating, PlaylistRating
)

print("All models imported successfully!")
print(f"Registered tables: {list(Base.metadata.tables.keys())}")
