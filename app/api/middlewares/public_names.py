"""
PublicNamesMiddleware: the last check on every JSON response
============================================================

Buffers each ``application/json`` response, runs it through
:func:`app.utils.public_names.scrub_json_bytes` and sends it on. A body with no internal name in
it (nearly all of them) goes out byte for byte with its original headers. One that names a model
is rewritten, and its ``Content-Length`` is corrected.

Pure ASGI rather than ``BaseHTTPMiddleware``, so streamed and non-JSON responses (HLS, files,
event streams) pass straight through without being buffered. Registered last in ``main.py``, which
makes it the outermost layer, so it also sees the error bodies written by the exception handlers
and by the other middleware.

Service-to-service routes are exempt. Their callers are our own systems (SFTPGo, the backup
wrapper, the ingest pipelines, Stripe), never a browser or a partner, and some of them relay the
media server's raw reply to a script that may read it. Renaming anything there could break that
caller and protects nobody.

See ``app/utils/public_names.py`` for why this exists.
"""

from __future__ import annotations

from app.utils.public_names import scrub_json_bytes

# Path fragments of routes that only our own services call (see the module docstring).
_SERVICE_ROUTES = ("/internal/", "/monthly_pipeline/", "/open_tracks_pipeline/", "/webhooks/")


def _is_service_route(path: str) -> bool:
    return any(fragment in path for fragment in _SERVICE_ROUTES)


def _is_plain_json(headers: list) -> bool:
    content_type = b""
    encoded = False
    for key, value in headers:
        k = key.lower()
        if k == b"content-type":
            content_type = value.lower()
        elif k == b"content-encoding":
            encoded = True
    # A compressed body cannot be searched as text. Nothing in Alwyzon compresses today; if that
    # changes, this middleware has to sit inside the compression layer, not outside it.
    if encoded:
        return False
    return content_type.startswith(b"application/json") or b"+json" in content_type


class PublicNamesMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or _is_service_route(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        start_message = None
        chunks: list[bytes] = []

        async def send_wrapper(message):
            nonlocal start_message
            if message["type"] == "http.response.start":
                if _is_plain_json(message.get("headers", [])):
                    start_message = message
                    return
                await send(message)
                return

            if message["type"] == "http.response.body" and start_message is not None:
                chunks.append(message.get("body", b""))
                if message.get("more_body", False):
                    return
                body = b"".join(chunks)
                public = scrub_json_bytes(body)
                if public is not body:
                    headers = [(k, v) for k, v in start_message["headers"] if k.lower() != b"content-length"]
                    headers.append((b"content-length", str(len(public)).encode()))
                    start_message = {**start_message, "headers": headers}
                await send(start_message)
                await send({"type": "http.response.body", "body": public, "more_body": False})
                return

            await send(message)

        await self.app(scope, receive, send_wrapper)
