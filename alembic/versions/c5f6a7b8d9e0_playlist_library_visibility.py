"""pricing v2.1 — Library visibility column + the three new entitlement features

Two things, deliberately in one revision so a single ``alembic upgrade head`` is the whole deploy:

  1. ``playlists.is_library_visible`` (+ index + backfill)
  2. the ``library_playlists_max`` / ``exports_per_day`` / ``can_view_full_analysis`` features and
     their per-plan values — created here rather than left to the manual
     ``python -m scripts.seed_entitlements``, because a forgotten seed makes gated code raise
     ``Unknown entitlement feature key`` on live. ``entitlement_seed`` still carries them for
     fresh installs; both are create-if-missing so they cannot fight.

The flag decides whether a playlist is LISTED in the Library page. It does not cap
creation: beyond the plan's ``library_playlists_max`` a playlist is created hidden and stays fully
reachable by link — open, play, rename, export, share, fork all unchanged.

Visibility is decided ONCE at creation and stored. Deleting a visible playlist frees a slot, but
hidden playlists are never promoted — the next newly created playlist takes it. That is why this is
a column and not a "first N by created_at" query: the ordering is not derivable after the fact.

BACKFILL: the N most recent non-deleted playlists stay visible, the rest are hidden — so existing
accounts land in the same state a new account would reach. N is the owner's own
``library_playlists_max``, resolved exactly the way the app resolves it (active subscription's plan
→ ``users.plan_id`` → default plan), so a Pro user with ``-1`` is left entirely alone.

Guest playlists (``user_id IS NULL``) are not touched: there is no Library page for a guest, so
hiding them would change nothing and would only surprise whoever later attributes them to an account.

Revision ID: c5f6a7b8d9e0
Revises: b4e5a6c7d8f9
Create Date: 2026-08-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "c5f6a7b8d9e0"
down_revision = "b4e5a6c7d8f9"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def _has_index(conn, table: str, index: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.STATISTICS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"
            ),
            {"t": table, "i": index},
        ).first()
    )


def upgrade() -> None:
    conn = op.get_bind()

    # Guarded so a re-run is a no-op, matching the other migrations in this project.
    if not _has_column(conn, "playlists", "is_library_visible"):
        op.add_column(
            "playlists",
            sa.Column(
                "is_library_visible",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("1"),
            ),
        )

    # Covers the two hot queries: counting a user's visible playlists at creation time, and
    # listing them. `deleted_at` is included because both must exclude soft-deleted rows.
    if not _has_index(conn, "playlists", "idx_user_visible"):
        op.create_index(
            "idx_user_visible",
            "playlists",
            ["user_id", "is_library_visible", "deleted_at"],
        )

    # Create the features BEFORE the backfill — it reads library_playlists_max — and before any
    # code that gates on them can run. Relying on `python -m scripts.seed_entitlements` for this
    # would make a forgotten manual step a hard failure: EntitlementService.get_entitlement raises
    # `Unknown entitlement feature key` for a feature that does not exist.
    _ensure_features(conn)
    _backfill_visibility(conn)


# key -> (name, value_type, window, default, description)
_NEW_FEATURES = {
    "library_playlists_max": (
        "Playlists visible in Library", "int", "none", "0",
        "How many playlists are LISTED in the Library. Does not cap creation — beyond this they are "
        "created hidden and stay reachable by link. -1 = unlimited.",
    ),
    "exports_per_day": (
        "Exports per day", "int", "daily", "0",
        "Playlist exports per UTC day (txt / apple_music / embed all count). -1 = unlimited.",
    ),
    "can_view_full_analysis": (
        "Can open full Track Intelligence", "bool", "none", "false",
        "The analysis SUMMARY card is available to anyone who can upload; this gates the full "
        "Track Intelligence page.",
    ),
}

# plan_code -> {feature_key: value}.  -1 = unlimited (EntitlementGate.UNLIMITED); 0 denies.
_NEW_VALUES = {
    "guest": {"library_playlists_max": 0,  "exports_per_day": 0,  "can_view_full_analysis": False},
    "free":  {"library_playlists_max": 5,  "exports_per_day": 1,  "can_view_full_analysis": False},
    "basic": {"library_playlists_max": 25, "exports_per_day": 5,  "can_view_full_analysis": True},
    "pro":   {"library_playlists_max": -1, "exports_per_day": -1, "can_view_full_analysis": True},
    "max":   {"library_playlists_max": -1, "exports_per_day": -1, "can_view_full_analysis": True},
}


def _ensure_features(conn) -> None:
    """Create-if-missing, mirroring ``entitlement_seed``: never clobber an admin's edit."""
    for key, (name, vtype, window, default, desc) in _NEW_FEATURES.items():
        conn.execute(
            text(
                "INSERT INTO features (`key`, name, value_type, `window`, default_value, description) "
                "SELECT :k, :n, :vt, :w, :dv, :d "
                "FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM features WHERE `key` = :k)"
            ),
            {"k": key, "n": name, "vt": vtype, "w": window, "dv": default, "d": desc},
        )

    for plan_code, per_feature in _NEW_VALUES.items():
        for key, value in per_feature.items():
            is_bool = _NEW_FEATURES[key][1] == "bool"
            conn.execute(
                text(
                    "INSERT INTO plan_entitlements (plan_id, feature_id, int_value, bool_value) "
                    "SELECT p.id, f.id, :iv, :bv FROM plans p JOIN features f ON f.`key` = :k "
                    "WHERE p.code = :code AND NOT EXISTS ("
                    "  SELECT 1 FROM plan_entitlements pe "
                    "  WHERE pe.plan_id = p.id AND pe.feature_id = f.id)"
                ),
                {
                    "iv": None if is_bool else int(value),
                    "bv": bool(value) if is_bool else None,
                    "k": key,
                    "code": plan_code,
                },
            )

    # Invalidate the Redis entitlement cache, or the old map serves until its TTL expires.
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))


def _backfill_visibility(conn) -> None:
    """Hide everything past each owner's cap, keeping their most recent N.

    The cap is resolved with the SAME precedence the app uses — active subscription's plan, then
    ``users.plan_id``, then the default plan — so this cannot disagree with what the running
    entitlement service would say. A negative cap means unlimited and is skipped entirely.

    Ordered by ``created_at DESC, id DESC``: the id is the tiebreaker because several playlists can
    share a timestamp, and without it the "5 most recent" would be non-deterministic between runs.
    """
    conn.execute(
        text(
            """
            UPDATE playlists p
            JOIN (
                SELECT pl.id,
                       cap.max_visible,
                       ROW_NUMBER() OVER (
                           PARTITION BY pl.user_id
                           ORDER BY pl.created_at DESC, pl.id DESC
                       ) AS rn
                FROM playlists pl
                JOIN (
                    SELECT u.id AS user_id,
                           COALESCE(sub_pe.int_value, usr_pe.int_value, def_pe.int_value) AS max_visible
                    FROM users u
                    LEFT JOIN user_subscriptions s
                           ON s.user_id = u.id AND s.status IN ('active', 'trialing')
                    LEFT JOIN plan_entitlements sub_pe
                           ON sub_pe.plan_id = s.plan_id AND sub_pe.feature_id = :fid
                    LEFT JOIN plan_entitlements usr_pe
                           ON usr_pe.plan_id = u.plan_id AND usr_pe.feature_id = :fid
                    LEFT JOIN plans def_p ON def_p.is_default = 1
                    LEFT JOIN plan_entitlements def_pe
                           ON def_pe.plan_id = def_p.id AND def_pe.feature_id = :fid
                ) cap ON cap.user_id = pl.user_id
                WHERE pl.user_id IS NOT NULL
                  AND pl.deleted_at IS NULL
                  AND cap.max_visible IS NOT NULL
                  AND cap.max_visible >= 0
            ) x ON x.id = p.id
            SET p.is_library_visible = 0
            WHERE x.rn > x.max_visible
            """
        ),
        {"fid": _feature_id(conn, "library_playlists_max")},
    )


def _feature_id(conn, key: str):
    row = conn.execute(
        text("SELECT id FROM features WHERE `key` = :k"), {"k": key}
    ).first()
    # The feature is seeded separately (scripts.seed_entitlements). Missing → -1 matches no row, so
    # the backfill is a no-op rather than an error; re-run it after seeding.
    return row[0] if row else -1


def downgrade() -> None:
    conn = op.get_bind()

    # Remove only what this revision inserted. Plan values go first (FK), then the features.
    for key in _NEW_FEATURES:
        conn.execute(
            text(
                "DELETE pe FROM plan_entitlements pe "
                "JOIN features f ON f.id = pe.feature_id WHERE f.`key` = :k"
            ),
            {"k": key},
        )
        conn.execute(text("DELETE FROM features WHERE `key` = :k"), {"k": key})
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))

    if _has_index(conn, "playlists", "idx_user_visible"):
        op.drop_index("idx_user_visible", table_name="playlists")
    if _has_column(conn, "playlists", "is_library_visible"):
        op.drop_column("playlists", "is_library_visible")
