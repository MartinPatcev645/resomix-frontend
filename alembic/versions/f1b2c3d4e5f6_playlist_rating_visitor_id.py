"""add visitor_id to playlist_ratings (guest playlist rating/feedback)

Playlist rating + feedback is open to guests; a guest's rating is associated with their
server-derived ``visitor_id`` (track rating stays login-only and is unaffected). Guarded +
reversible.

Revision ID: f1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Create Date: 2026-07-05
"""

from alembic import op
from sqlalchemy import text

revision = "f1b2c3d4e5f6"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def _has_column(conn, table, column) -> bool:
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "playlist_ratings", "visitor_id"):
        conn.execute(text("ALTER TABLE playlist_ratings ADD COLUMN visitor_id VARCHAR(64) NULL AFTER user_id"))
        conn.execute(text("CREATE INDEX ix_playlist_ratings_visitor_id ON playlist_ratings (visitor_id)"))


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "playlist_ratings", "visitor_id"):
        conn.execute(text("DROP INDEX ix_playlist_ratings_visitor_id ON playlist_ratings"))
        conn.execute(text("ALTER TABLE playlist_ratings DROP COLUMN visitor_id"))
