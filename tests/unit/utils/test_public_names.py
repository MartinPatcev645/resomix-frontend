"""
Internal model names never leave Alwyzon (app/utils/public_names.py + PublicNamesMiddleware).

No DB, no network: the scrub on plain values, then the middleware around a tiny ASGI app.
"""

import json

from app.api.middlewares.public_names import PublicNamesMiddleware
from app.utils.public_names import contains_internal_name, scrub, scrub_json_bytes, scrub_text


class TestScrub:
    def test_index_names_get_their_public_spelling(self):
        out = scrub({"maest": {"index_size": 3}, "discogs": {"index_size": 3}})
        assert out == {"index_a": {"index_size": 3}, "index_b": {"index_size": 3}}

    def test_style_key_has_its_own_public_name(self):
        assert scrub({"style_maest_top": []}) == {"style_top": []}

    def test_names_inside_text_are_replaced(self):
        assert scrub_text("faiss_maest_42.index") == "faiss_index_a_42.index"
        assert scrub_text("Discogs-EffNet failed") == "index_b failed"
        assert not contains_internal_name(scrub_text("MAEST, Essentia, Demucs and Jamendo", everything=True))

    def test_ordinary_words_in_track_titles_survive(self):
        title = "Steve Miggedy Maestro - Essential House"
        assert scrub_text(title) == title

    def test_tool_names_in_values_are_left_alone_because_they_can_be_real_data(self):
        """A catalogue link or an artist can contain one of these words. Rewriting it would corrupt
        the data, so only keys and the two index names are touched in values."""
        row = {"source_url": "https://www.jamendo.com/track/1", "artist": "Essentia"}
        assert scrub(row) == row

    def test_tool_names_in_keys_are_renamed(self):
        assert scrub({"essentia": "2.1"}) == {"model": "2.1"}

    def test_numeric_runs_are_returned_as_is(self):
        curve = [0.1, 0.2, 0.3]
        assert scrub({"curve": curve})["curve"] is curve


class TestScrubJsonBytes:
    def test_a_clean_body_is_the_same_object(self):
        body = b'{"title":"Maestro","bpm":124}'
        assert scrub_json_bytes(body) is body

    def test_a_dirty_body_is_rewritten_as_valid_json(self):
        body = json.dumps({"engines": {"maest": "ok", "discogs": "ok"}}).encode()
        assert json.loads(scrub_json_bytes(body)) == {"engines": {"index_a": "ok", "index_b": "ok"}}

    def test_non_json_is_rewritten_as_text(self):
        assert scrub_json_bytes(b"maest broke") == b"index_a broke"

    def test_a_body_with_nothing_to_rename_keeps_its_exact_bytes(self):
        body = b'{"source_url": "https://www.jamendo.com/track/1"}'
        assert scrub_json_bytes(body) is body


def _app(body: bytes, content_type: bytes = b"application/json"):
    async def app(scope, receive, send):
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", content_type), (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})

    return app


async def _run(app, path="/api/v1/x"):
    sent = []

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    await PublicNamesMiddleware(app)({"type": "http", "path": path}, receive, send)
    headers = dict(sent[0]["headers"])
    return headers, b"".join(m.get("body", b"") for m in sent[1:])


class TestMiddleware:
    async def test_json_responses_are_scrubbed_and_resized(self):
        headers, body = await _run(_app(b'{"remove_result":{"removed":{"maest":2}}}'))
        assert b"maest" not in body
        assert int(headers[b"content-length"]) == len(body)

    async def test_clean_json_passes_untouched(self):
        raw = b'{"ok":true}'
        _, body = await _run(_app(raw))
        assert body == raw

    async def test_non_json_is_not_buffered_or_changed(self):
        _, body = await _run(_app(b"#EXTM3U maest", b"application/vnd.apple.mpegurl"))
        assert body == b"#EXTM3U maest"

    async def test_service_to_service_routes_are_never_touched(self):
        """The ingest pipelines relay the media server's raw reply to our own scripts."""
        raw = b'{"data":{"maest":"ok"}}'
        for path in ("/api/v1/monthly_pipeline/update_embeddings/", "/internal/sftp/auth"):
            _, body = await _run(_app(raw), path)
            assert body == raw
