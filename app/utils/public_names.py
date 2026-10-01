"""
Internal model names, kept out of every response
================================================

The media server and the analysis service name things after the models behind them, and those
names reach Alwyzon in field names, index names, file paths and error text. None of it is for
anyone outside the core team, which includes partners and our own frontend, so nothing leaves
Alwyzon with one of them in it.

Two layers do this. ``analysis_projection.public_analysis`` reshapes the analysis result on
purpose, dropping the fields that only describe how a result was produced. This module is the
net under everything else. ``PublicNamesMiddleware`` passes every JSON response through
:func:`scrub_json_bytes`, which renames any internal name it finds.

Names are matched rather than handled at each call site, because most of them arrive inside
upstream responses that we relay and do not control.

What gets renamed
-----------------
* **Keys** are renamed for every name below. A key is never user content.
* **Text values** are rewritten only for the two similarity-index names, which appear in relayed
  index names, file paths and document types. The other names are also ordinary words that can
  turn up in real catalogue data (a link, an artist, a user's own file name), and rewriting those
  would corrupt the data. Where they can occur in our own payloads, the field is dropped on
  purpose instead (see ``public_analysis``), and upstream error text is passed through
  :func:`scrub_text` with ``everything=True``.

The two similarity indexes are called ``index_a`` and ``index_b`` in public. Anything else that
names a model becomes ``model``.
"""

from __future__ import annotations

import json
import re
from typing import Any

# "maestro" and "essential" are ordinary words that turn up in track titles and must survive.
_INDEX_PATTERN = r"discogs[-_ ]?effnet|maest(?!ro)|discogs|effnet"
_ALL_PATTERN = _INDEX_PATTERN + r"|essentia(?!l)|jamendo|demucs|musicnn"

_INDEX_NAMES = re.compile(_INDEX_PATTERN, re.IGNORECASE)
_ALL_NAMES = re.compile(_ALL_PATTERN, re.IGNORECASE)
_ALL_NAMES_BYTES = re.compile(_ALL_PATTERN.encode(), re.IGNORECASE)
_INDEX_NAMES_BYTES = re.compile(_INDEX_PATTERN.encode(), re.IGNORECASE)

# Whole keys with a public name of their own, applied before the token rename.
_KEY_RENAMES = {"style_maest_top": "style_top"}


def _public_token(token: str) -> str:
    t = token.lower()
    if t.startswith("maest"):
        return "index_a"
    if t.startswith("discogs") or t == "effnet":
        return "index_b"
    return "model"


def _sub(match: re.Match) -> str:
    return _public_token(match.group(0))


def _sub_bytes(match: re.Match) -> bytes:
    return _public_token(match.group(0).decode()).encode()


def scrub_text(value: str, *, everything: bool = False) -> str:
    """Replace internal names in a string.

    By default only the two index names, which is safe on any value. ``everything=True`` also
    replaces the tool names, for text we know is ours, such as an upstream error message.
    """
    return (_ALL_NAMES if everything else _INDEX_NAMES).sub(_sub, value)


def contains_internal_name(value: str) -> bool:
    return bool(_ALL_NAMES.search(value))


def _public_key(key: str) -> str:
    return _KEY_RENAMES.get(key) or scrub_text(key, everything=True)


def scrub(obj: Any) -> Any:
    """Rename internal names in keys (all of them) and string values (index names), recursively."""
    if isinstance(obj, dict):
        return {(_public_key(k) if isinstance(k, str) else k): scrub(v) for k, v in obj.items()}
    if isinstance(obj, list):
        # Spectrograms and curves are long runs of numbers with nothing to rename. Skipping them
        # keeps a full analysis result to a few milliseconds instead of walking every value.
        if obj and isinstance(obj[0], (int, float)) and not isinstance(obj[0], bool):
            return obj
        return [scrub(v) for v in obj]
    if isinstance(obj, str):
        return scrub_text(obj)
    return obj


def scrub_json_bytes(body: bytes) -> bytes:
    """Return ``body`` unchanged unless it names a model, else the same JSON with names replaced.

    The byte search runs first and almost every response stops there, so the parse and re-encode
    cost is paid only by a response that actually needs it. If nothing ends up renamed (a tool
    name that only appears in a value, say), the original bytes go out untouched.
    """
    if not body or not _ALL_NAMES_BYTES.search(body):
        return body
    try:
        data = json.loads(body)
    except ValueError:
        return _INDEX_NAMES_BYTES.sub(_sub_bytes, body)
    public = scrub(data)
    if public == data:
        return body
    # Same encoding Starlette's JSONResponse uses.
    return json.dumps(public, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
