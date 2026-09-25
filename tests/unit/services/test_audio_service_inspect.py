"""
What an upload has to be for us to accept it.

The rule is the file's CONTENT, never its name. Uploads arrive named anything at all: WhatsApp
sends Opus as `.mpeg`, an iPhone sends AAC as `.m4a`, a browser may send no extension. The probe
answers three questions in one pass. Is there audio in it, is it a video file, and is it short
enough to be worth the pipeline. It also names the file for the services downstream so none of
them has to guess.

Pure: `probe_upload` is stubbed, so ffprobe never runs here.
"""

import pytest

from app.services.audio_service import AudioService

TWENTY_MINUTES = 20 * 60


def _probe(**overrides):
    """An ffprobe result shaped like the real one."""
    info = {
        "container": "mp3",
        "codec": "mp3",
        "extension": ".mp3",
        "bitrate_bps": 320000,
        "sample_rate": 44100,
        "channels": 2,
        "duration_s": 210.0,
        "lossless": False,
        "has_video": False,
    }
    info.update(overrides)
    return info


@pytest.fixture
def stub_probe(monkeypatch):
    def _install(result):
        monkeypatch.setattr(AudioService, "probe_upload", staticmethod(lambda _bytes: result))
    return _install


class TestWhatIsAccepted:
    def test_a_phone_recording_is_audio_whatever_it_is_named(self, stub_probe):
        stub_probe(_probe(container="mov,mp4,m4a", codec="aac", extension=".m4a", bitrate_bps=96000, channels=1))
        info, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert error is None
        assert info["codec"] == "aac"
        assert info["extension"] == ".m4a"

    def test_a_whatsapp_note_named_mpeg_is_accepted_as_what_it_is(self, stub_probe):
        # The point of probing: the name says MPEG audio, the content is Opus in Ogg.
        stub_probe(_probe(container="ogg", codec="opus", extension=".ogg", bitrate_bps=32000))
        info, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert error is None
        assert info["extension"] == ".ogg"

    def test_a_lossless_upload_is_marked_as_such(self, stub_probe):
        stub_probe(_probe(container="flac", codec="flac", extension=".flac", lossless=True))
        info, _ = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert info["lossless"] is True


class TestWhatIsRefused:
    def test_a_file_with_no_audio_is_refused(self, stub_probe):
        stub_probe(None)
        info, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert info is None
        assert "audio" in error.lower()

    def test_a_video_file_is_refused(self, stub_probe):
        stub_probe(_probe(container="mov,mp4", codec="aac", has_video=True))
        info, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert info is None
        assert "video" in error.lower()

    def test_embedded_cover_art_is_not_video(self, stub_probe):
        # Artwork is a video stream with `attached_pic` set. `probe_upload` filters it out, so a
        # tagged MP3 must arrive here with has_video False and be accepted.
        stub_probe(_probe(has_video=False))
        _, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert error is None

    def test_audio_longer_than_the_cap_is_refused(self, stub_probe):
        stub_probe(_probe(duration_s=TWENTY_MINUTES + 1))
        info, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert info is None
        assert "20 minutes" in error

    def test_a_track_at_the_cap_is_still_accepted(self, stub_probe):
        stub_probe(_probe(duration_s=float(TWENTY_MINUTES)))
        _, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert error is None

    def test_an_unknown_duration_does_not_refuse_the_upload(self, stub_probe):
        # Some containers report no duration. Guessing "too long" would reject a fine file.
        stub_probe(_probe(duration_s=None))
        _, error = AudioService.inspect_upload(b"x", TWENTY_MINUTES)
        assert error is None
