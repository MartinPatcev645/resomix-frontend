"""playlists.is_library_visible — Library listing cap (pricing v2.1)

Adds the flag that decides whether a playlist is LISTED in the Library page. It does not cap
creation: beyond the plan's ``library_playlists_max`` a playlist is created hidden and stays fully
reachable by link — open, play, rename, export, share, fork all unchanged.

Visibility is decided ONCE at creation and stored. Deleting a visible playlist frees a slot, but
hidden playlists are never promoted — the next newly created playlist takes it. That is why this is
a column and not a "first N by created_at" query: the ordering is not derivable after the fact.

BACKFILL: deliberately none. Existing rows default to TRUE, so nobody loses Library entries they
can see today. A free user who already has 30 playlists keeps all 30 listed; the cap only shapes
what they create from now on. Taking rows away from existing users is a product decision, not a
migration's to make — see the note in the pricing doc.

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


def downgrade() -> None:
    conn = op.get_bind()
    if _has_index(conn, "playlists", "idx_user_visible"):
        op.drop_index("idx_user_visible", table_name="playlists")
    if _has_column(conn, "playlists", "is_library_visible"):
        op.drop_column("playlists", "is_library_visible")
