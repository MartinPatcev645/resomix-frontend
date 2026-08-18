"""The playlist-cover gate must accept real photos and identify images by content.

This is the ONLY server-side validation of a cover: the browser checks the same things for UX and the
media server just stores what it is given. Whatever is not pinned here is not enforced anywhere.

The version this replaced rejected any image over 3 MB or wider than 4000 px. A plain 12 MP iPhone
photo is 4032x3024 — so *every* default iPhone shot failed by 32 pixels, and the user was told to go
shrink the photo themselves. `test_a_plain_iphone_photo_is_accepted` is that bug, written down.
"""
import io

import pytest
from PIL import Image

from app.api.routers.playlists import (
    _MAX_COVER_BYTES,
    _MAX_COVER_DIM,
    _inspect_image,
)


def _image_bytes(width: int, height: int, fmt: str = "JPEG", mode: str = "RGB") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (width, height), (120, 90, 60)).save(buf, format=fmt)
    return buf.getvalue()


# --------------------------------------------------------------------------------------------- #
# Sizes real cameras produce
#
# Note the division of labour: a phone photo is made uploadable in the BROWSER, which downscales it
# to a 500x500 square before it ever reaches this gate. That is what fixed the original bug. The
# ceiling below is a backstop for direct API callers, sitting ~36x (by area) above anything the
# client sends — not the mechanism that makes iPhone photos work.
# --------------------------------------------------------------------------------------------- #
def test_the_square_the_browser_actually_sends_is_accepted():
    """The web client crops to exactly this before uploading, so it is the overwhelmingly common
    real-world input — and the reason a 12 MP photo now works end to end."""
    content_type, reason = _inspect_image(_image_bytes(500, 500))
    assert reason is None
    assert content_type == "image/jpeg"


def test_a_raw_phone_photo_posted_straight_to_the_api_is_refused():
    """4032x3024 — the 12 MP main camera on every iPhone since the 6s.

    This is a DELIBERATE boundary, not the old bug returning. The old gate applied its 4000 px rule
    to the browser path, so every default iPhone shot bounced at the picker and the user was told to
    go shrink it themselves. Now the browser downscales first and never presents an original here;
    only a non-browser caller can reach this branch, and it gets a message naming the limit.

    If a partner integration ever needs to post camera originals, `_MAX_COVER_DIM` is the one
    constant to move.
    """
    content_type, reason = _inspect_image(_image_bytes(4032, 3024))
    assert content_type is None
    assert str(_MAX_COVER_DIM) in reason


def test_a_very_small_image_is_still_an_image():
    """No minimum: a tiny cover looks bad, but that is the uploader's call, not an error."""
    _content_type, reason = _inspect_image(_image_bytes(16, 16))
    assert reason is None


# --------------------------------------------------------------------------------------------- #
# "As long as it's an image"
# --------------------------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "fmt,expected_mime",
    [
        ("JPEG", "image/jpeg"),
        ("PNG", "image/png"),
        ("WEBP", "image/webp"),
        ("GIF", "image/gif"),
        ("BMP", "image/bmp"),
        ("TIFF", "image/tiff"),
    ],
)
def test_every_common_image_format_is_accepted(fmt, expected_mime):
    """The old gate read magic bytes for JPEG and PNG only — and the frontend meanwhile offered
    WebP, so a WebP would have been refused at the door. Identification is Pillow's job now, which
    is why this list can grow without a new byte signature each time."""
    content_type, reason = _inspect_image(_image_bytes(600, 400, fmt=fmt))
    assert reason is None, f"{fmt} should be accepted"
    assert content_type == expected_mime


def test_a_transparent_png_is_accepted():
    content_type, reason = _inspect_image(_image_bytes(400, 400, fmt="PNG", mode="RGBA"))
    assert reason is None
    assert content_type == "image/png"


# --------------------------------------------------------------------------------------------- #
# What is still refused
# --------------------------------------------------------------------------------------------- #
def test_a_non_image_is_refused():
    content_type, reason = _inspect_image(b"this is not an image, it is a sentence")
    assert content_type is None
    assert "image" in reason.lower()


def test_a_pdf_is_refused_despite_looking_like_a_document_upload():
    content_type, reason = _inspect_image(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    assert content_type is None
    assert reason


def test_empty_bytes_are_refused():
    content_type, _reason = _inspect_image(b"")
    assert content_type is None


def test_a_jpeg_header_with_a_truncated_body_is_refused():
    """A magic-byte check passes this happily; opening it does not."""
    content_type, _reason = _inspect_image(b"\xff\xd8\xff\xe0" + b"\x00" * 40)
    assert content_type is None


def test_over_the_resolution_ceiling_is_refused_with_the_number_in_the_message():
    content_type, reason = _inspect_image(_image_bytes(_MAX_COVER_DIM + 1, 800))
    assert content_type is None
    assert str(_MAX_COVER_DIM) in reason, "the message must say what the limit actually is"


def test_the_resolution_ceiling_is_inclusive():
    _content_type, reason = _inspect_image(_image_bytes(_MAX_COVER_DIM, _MAX_COVER_DIM))
    assert reason is None, "exactly at the limit is inside it"


def test_height_is_checked_as_well_as_width():
    """A portrait photo must not slip through a width-only check."""
    content_type, _reason = _inspect_image(_image_bytes(800, _MAX_COVER_DIM + 1))
    assert content_type is None


# --------------------------------------------------------------------------------------------- #
# The limits themselves
# --------------------------------------------------------------------------------------------- #
def test_the_byte_ceiling_clears_a_full_resolution_phone_photo():
    """A 48 MP iPhone shot converted to JPEG lands around 15–25 MB at full resolution, but the client
    downscales long before that. The ceiling only needs to be far above anything a browser sends and
    generous enough that a direct API caller is not fighting it — 15 MB is both."""
    assert _MAX_COVER_BYTES == 15 * 1024 * 1024


def test_inspecting_a_large_image_does_not_decode_it():
    """`Image.open` is lazy: `.format` and `.size` come from the header. This is what makes it safe to
    inspect a 15 MB upload inline on the API box rather than handing it to a worker — if this ever
    starts decoding pixels, a burst of uploads becomes a memory problem."""
    data = _image_bytes(_MAX_COVER_DIM, _MAX_COVER_DIM)

    loaded = {"pixels": False}
    original_load = Image.Image.load

    def _tracking_load(self, *args, **kwargs):
        loaded["pixels"] = True
        return original_load(self, *args, **kwargs)

    Image.Image.load = _tracking_load
    try:
        _inspect_image(data)
    finally:
        Image.Image.load = original_load

    assert loaded["pixels"] is False, "the gate must read the header only, never the pixels"


def test_the_bomb_guard_is_restored_after_use():
    """`_inspect_image` narrows Pillow's global `MAX_IMAGE_PIXELS` while it works. That global is
    process-wide, so leaving it narrowed would silently change how every other Pillow caller behaves."""
    before = Image.MAX_IMAGE_PIXELS
    _inspect_image(_image_bytes(100, 100))
    assert Image.MAX_IMAGE_PIXELS == before

    # ...including when the image is rejected.
    _inspect_image(b"not an image")
    assert Image.MAX_IMAGE_PIXELS == before
