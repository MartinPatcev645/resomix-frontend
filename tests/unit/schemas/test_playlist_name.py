"""Playlist name validation.

Playlists are auto-named "Artist - Title" from catalogue metadata, so the product generates names
containing every script and punctuation mark in the catalogue. The old rule was an ASCII allowlist
(`^[a-zA-Z0-9\\s\\-_.'(),]+$`), which meant the product produced names it then refused to let the
owner re-enter. These lock in that a name is validated on its SHAPE, not on a character allowlist.
"""

import pytest

from app.schemas.playlist import (
    PLAYLIST_NAME_MAX_LENGTH,
    PlaylistRenameRequest,
    normalize_playlist_name,
)


class TestAcceptsRealWorldNames:
    """Every one of these was REJECTED by the previous allowlist."""

    @pytest.mark.parametrize(
        "name",
        [
            "Sigur Rós - Hoppípolla",   # accented Latin — and a name the product generates itself
            "Beyoncé",
            "Motörhead",
            "Café del Mar",
            "Techno & House",           # ampersand
            "Best of 2024!",            # exclamation
            "What?",
            "Mix #1",
            "Vol: One",
            "A/B Test",
            '"Quoted"',
            "Sunset — Ibiza",           # em dash
            "DJ’s Set",            # curly apostrophe — what macOS/iOS auto-insert
            "Русский",                  # Cyrillic
            "日本語 ミックス",             # Japanese
            "العربية",                  # Arabic
            "Party \U0001F389",         # emoji
        ],
    )
    def test_accepted_unchanged(self, name):
        assert normalize_playlist_name(name) == name

    def test_keeps_zwj_emoji_families_intact(self):
        """ZWJ (U+200D) joins emoji families; stripping format characters would break them."""
        family = "\U0001F468‍\U0001F469‍\U0001F467 Family"
        assert normalize_playlist_name(family) == family

    def test_keeps_zwnj_needed_by_persian_and_arabic(self):
        """ZWNJ (U+200C) is orthographically required, not decoration."""
        assert "‌" in normalize_playlist_name("می‌خوانم")


class TestNormalisation:
    def test_trims_and_collapses_whitespace(self):
        assert normalize_playlist_name("  spaced   out  ") == "spaced out"

    def test_normalises_to_nfc(self):
        """Decomposed and precomposed forms look identical, so they must store identically."""
        decomposed = "Café"      # e + combining acute
        assert normalize_playlist_name(decomposed) == "Café"

    def test_control_characters_become_a_space(self):
        """A pasted multi-line name should read as words, not run together."""
        assert normalize_playlist_name("Artist\nTitle") == "Artist Title"
        assert normalize_playlist_name("a\tb\x00c") == "a b c"

    def test_strips_bidi_overrides(self):
        """These let a name paint itself right-to-left and impersonate another one."""
        assert normalize_playlist_name("safe‮name") == "safename"


class TestRejects:
    @pytest.mark.parametrize("name", ["", "   ", "\n\t "])
    def test_empty_or_whitespace_only(self, name):
        with pytest.raises(ValueError, match="Enter a name"):
            normalize_playlist_name(name)

    def test_too_long(self):
        with pytest.raises(ValueError, match="too long"):
            normalize_playlist_name("a" * (PLAYLIST_NAME_MAX_LENGTH + 1))

    def test_accepts_exactly_the_limit(self):
        name = "a" * PLAYLIST_NAME_MAX_LENGTH
        assert normalize_playlist_name(name) == name

    def test_message_is_written_for_a_person(self):
        """The UI surfaces this string verbatim, so it must not read like a validator."""
        with pytest.raises(ValueError) as exc:
            normalize_playlist_name("")
        text = str(exc.value)
        assert "Value error" not in text and "new_name" not in text and "pattern" not in text


class TestThroughTheRequestSchema:
    def test_schema_accepts_and_normalises(self):
        req = PlaylistRenameRequest(
            playlist_id="550e8400-e29b-41d4-a716-446655440000",
            new_name="  Sigur Rós  -  Hoppípolla 🎧 ",
        )
        assert req.new_name == "Sigur Rós - Hoppípolla 🎧"

    def test_schema_rejects_over_length(self):
        with pytest.raises(ValueError):
            PlaylistRenameRequest(
                playlist_id="550e8400-e29b-41d4-a716-446655440000",
                new_name="a" * (PLAYLIST_NAME_MAX_LENGTH + 1),
            )

    def test_stored_name_fits_the_column(self):
        """playlists.name is VARCHAR(150); the cap must leave room, not exceed it."""
        assert PLAYLIST_NAME_MAX_LENGTH <= 150
