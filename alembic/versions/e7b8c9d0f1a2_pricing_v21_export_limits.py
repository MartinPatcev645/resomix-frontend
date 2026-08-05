"""pricing v2.1 — export scope, track limit and targets

Data only, no schema. Brings the three export entitlements to the values in §1.1 of the spec now
that the server actually builds the file (phase C2) and can enforce them.

WHAT MOVES
----------
``export_scope``       free: ``first_n`` -> ``full``. "Full" means *export what the user can see*:
                       a free user's 50-track playlist has 20 unlocked, so the file holds 20. The
                       old ``first_n`` capped the file at 10 while the user could see 20 — the
                       export was stricter than the product.

``export_track_limit`` free: 10 -> 20 (matches what free actually unlocks).
                       pro:   0 -> 100. Not a reduction: 0 meant "no export-specific cap" and Pro
                       playlists top out at 100 tracks anyway. It is now stated rather than implied,
                       which is what lets the pricing page render a number.

``export_targets``     free: "" -> "txt,apple" — free gains TXT and Apple Music export.
                       pro:  "spotify,apple" -> "txt,apple,embed".

WHY SPOTIFY IS DROPPED
----------------------
Spotify transfer is **not live and not in use**. The spec's target list (txt / apple_music / embed)
never mentions it. Leaving a dead target in a plan's entitlements advertises a capability that does
not work, so it comes out. Turning it back on is an admin edit, not a deploy — nothing in the code
was removed.

WHY basic AND max ARE TOUCHED
-----------------------------
They are inactive (``is_active = 0``) and out of scope for pricing, but they are *above* free. If
only free gained "txt", activating basic later would silently take TXT export away from a paying
tier. Adding it is strictly additive and prevents a lower tier out-featuring a higher one.

"apple" vs "apple_music": the stored token stays ``apple``, which is what production holds and what
``useAccess.ts`` compares against. ``EntitlementGate.check_export`` canonicalises both spellings, so
the spec's ``apple_music`` resolves to the same target without a frontend change.

``entitlements_version`` is bumped so the Redis entitlement cache drops the old values immediately
instead of serving them until the TTL expires.

Guarded (a re-run re-applies the same values) and reversible — ``_OLD`` was read from the database
on 2026-08-05, not reconstructed. ``key`` is backticked (reserved word); every value is bound.

Revision ID: e7b8c9d0f1a2
Revises: d6a7b8c9e0f1
Create Date: 2026-08-05
"""

from alembic import op
from sqlalchemy import text

revision = "e7b8c9d0f1a2"
down_revision = "d6a7b8c9e0f1"
branch_labels = None
depends_on = None

SCOPE = "export_scope"
TRACK_LIMIT = "export_track_limit"
TARGETS = "export_targets"

# Values BEFORE this migration, read from the database on 2026-08-05. The downgrade restores exactly
# these — guest is absent from every map because nothing about it changes (it cannot export at all).
_OLD_STR = {
    SCOPE: {"free": "first_n"},
    TARGETS: {
        "free": "",
        "basic": "spotify,apple",
        "pro": "spotify,apple",
        "max": "spotify,apple,tidal,serato,rekordbox",
    },
}
_OLD_INT = {TRACK_LIMIT: {"free": 10, "pro": 0}}

_NEW_STR = {
    SCOPE: {"free": "full"},
    TARGETS: {
        "free": "txt,apple",
        "basic": "txt,apple",
        "pro": "txt,apple,embed",
        "max": "txt,apple,embed,tidal,serato,rekordbox",
    },
}
_NEW_INT = {TRACK_LIMIT: {"free": 20, "pro": 100}}


def _set(conn, values: dict, column: str, cast) -> None:
    for feature_key, per_plan in values.items():
        for plan_code, val in per_plan.items():
            conn.execute(
                text(
                    f"UPDATE plan_entitlements pe "
                    f"JOIN plans p ON p.id = pe.plan_id "
                    f"JOIN features f ON f.id = pe.feature_id "
                    f"SET pe.{column} = :val "
                    f"WHERE f.`key` = :fk AND p.code = :code"
                ),
                {"val": cast(val), "fk": feature_key, "code": plan_code},
            )


def _describe(conn) -> None:
    """Keep the admin UI's description honest — ``export_track_limit`` no longer belongs to
    ``first_n`` only, and 0 is no longer the way to say "everything"."""
    conn.execute(
        text("UPDATE features SET name = :n, description = :d WHERE `key` = :k"),
        {
            "n": "Export track limit",
            "d": "Max tracks in an export. Also bounded by what the plan unlocks "
                 "(max_tracks_per_playlist), so the file never exceeds what the user can see. "
                 "0 or -1 = no export-specific cap.",
            "k": TRACK_LIMIT,
        },
    )
    conn.execute(
        text("UPDATE features SET description = :d WHERE `key` = :k"),
        {
            "d": "Allowed export destinations (CSV): txt, apple, embed, tidal, serato, rekordbox. "
                 "'apple_music' is accepted as an alias of 'apple'.",
            "k": TARGETS,
        },
    )


def upgrade() -> None:
    conn = op.get_bind()
    _set(conn, _NEW_STR, "string_value", str)
    _set(conn, _NEW_INT, "int_value", int)
    _describe(conn)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))


def downgrade() -> None:
    conn = op.get_bind()
    _set(conn, _OLD_STR, "string_value", str)
    _set(conn, _OLD_INT, "int_value", int)
    conn.execute(
        text("UPDATE features SET name = :n, description = :d WHERE `key` = :k"),
        {
            "n": "Export track limit (first_n)",
            "d": "Track cap when export_scope=first_n; 0 = full.",
            "k": TRACK_LIMIT,
        },
    )
    conn.execute(
        text("UPDATE features SET description = :d WHERE `key` = :k"),
        {"d": "spotify,apple,tidal,serato,rekordbox", "k": TARGETS},
    )
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))
