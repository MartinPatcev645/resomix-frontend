"""rename analysis_per_month -> uploads_per_month, playlists_per_month -> search_playlists_per_month

Model change: an upload now yields BOTH analysis + similarity (counted once), so the old
``analysis_per_month`` becomes ``uploads_per_month``; catalog-only playlists are counted by
``search_playlists_per_month`` (renamed from ``playlists_per_month``). Search-playlist values are
unchanged (they ride the same ``feature_id``); upload values move to the new defaults. Plan
entitlement rows are matched by (plan.code, feature.key); ``entitlements_version`` is bumped so the
Redis entitlement cache is invalidated.

Guarded (WHERE on the old key → no-op if already applied) + reversible. Values mirror
``app/services/entitlement_seed.py`` (admin-editable). ``key`` / ``window`` are backticked
(reserved words); all values are bound parameters (no string interpolation).

Revision ID: a2b3c4d5e6f7
Revises: f1b2c3d4e5f6
Create Date: 2026-07-10
"""

from alembic import op
from sqlalchemy import text

revision = "a2b3c4d5e6f7"
down_revision = "f1b2c3d4e5f6"
branch_labels = None
depends_on = None

# New upload allowance (renamed from analysis_per_month) — per-plan monthly values.
_UPLOAD_VALUES = {
    "uploads_per_month": {"guest": 0, "free": 5, "basic": 30, "pro": 100, "max": 300},
}
# Legacy analysis values (for downgrade).
_ANALYSIS_VALUES = {
    "analysis_per_month": {"guest": 0, "free": 10, "basic": 50, "pro": 200, "max": 1000},
}


def _rename_feature(conn, old_key, new_key, name, window, desc):
    conn.execute(
        text(
            "UPDATE features SET `key` = :nk, name = :nm, `window` = :w, description = :d "
            "WHERE `key` = :ok"
        ),
        {"nk": new_key, "nm": name, "w": window, "d": desc, "ok": old_key},
    )


def _set_values(conn, values):
    for feature_key, per_plan in values.items():
        for plan_code, val in per_plan.items():
            conn.execute(
                text(
                    "UPDATE plan_entitlements pe "
                    "JOIN plans p ON p.id = pe.plan_id "
                    "JOIN features f ON f.id = pe.feature_id "
                    "SET pe.int_value = :val "
                    "WHERE f.`key` = :fk AND p.code = :code"
                ),
                {"val": int(val), "fk": feature_key, "code": plan_code},
            )


def upgrade() -> None:
    conn = op.get_bind()
    _rename_feature(
        conn, "playlists_per_month", "search_playlists_per_month", "Search playlists per month",
        "monthly",
        "Max SEARCH playlists (catalog similarity, not upload) per monthly period (resets on the subject's billing anchor).",
    )
    _rename_feature(
        conn, "analysis_per_month", "uploads_per_month", "Uploads per month",
        "monthly",
        "Monthly upload allowance — one upload = analysis + similarity (resets on the subject's billing anchor).",
    )
    # Search-playlist values are unchanged (carried on feature_id); only the upload allowance moves.
    _set_values(conn, _UPLOAD_VALUES)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))


def downgrade() -> None:
    conn = op.get_bind()
    _rename_feature(
        conn, "search_playlists_per_month", "playlists_per_month", "Playlists per month",
        "monthly", "Max playlists creatable per monthly period (resets on the billing anchor).",
    )
    _rename_feature(
        conn, "uploads_per_month", "analysis_per_month", "Track analyses per month",
        "monthly", "Monthly analysis allowance (resets on the billing anchor).",
    )
    _set_values(conn, _ANALYSIS_VALUES)
    conn.execute(text("UPDATE plans SET entitlements_version = entitlements_version + 1"))
