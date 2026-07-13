"""create_apple_music_tracks + tracks.source_file_path

(1) apple_music_tracks — one row per catalogue track matched on Apple Music (reverse-lookup of the
    old catalogue, see scripts/apple_music/). Keyed by track_id (one match per track); apple_song_id
    / isrc are indexed but NOT unique. Apple returns no label.
(2) tracks.source_file_path VARCHAR(600) — the original file location on the source (Electrobuzz)
    server; the only reference back to the master when it isn't in our storage.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-07-13 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = :t"
            ),
            {"t": table},
        ).first()
    )


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def upgrade() -> None:
    """Idempotent: create the table only if it isn't already present."""
    if _table_exists("apple_music_tracks"):
        return
    op.create_table(
        "apple_music_tracks",
        sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
        # One Apple match per track.
        sa.Column("track_id", mysql.INTEGER(unsigned=True), nullable=False),
        # Apple identifiers (indexed, NOT unique — dup matches allowed).
        sa.Column("apple_song_id", sa.String(length=30), nullable=True),
        sa.Column("isrc", sa.String(length=30), nullable=True),
        # Apple metadata.
        sa.Column("name", sa.String(length=1024), nullable=True),
        sa.Column("artist", sa.String(length=512), nullable=True),
        sa.Column("album", sa.String(length=1024), nullable=True),
        sa.Column("genres", sa.String(length=255), nullable=True),
        sa.Column("release_date", sa.Date(), nullable=True),
        sa.Column("duration_ms", mysql.INTEGER(unsigned=True), nullable=True),
        sa.Column("artwork_url", sa.String(length=500), nullable=True),
        sa.Column("preview_url", sa.String(length=500), nullable=True),
        sa.Column("deep_link_url", sa.String(length=500), nullable=True),
        sa.Column("match_score", sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("track_id", name="uq_amt_track"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_amt_song", "apple_music_tracks", ["apple_song_id"])
    op.create_index("idx_amt_isrc", "apple_music_tracks", ["isrc"])

    # (2) tracks.source_file_path — original file location on the source (Electrobuzz) server.
    if not _column_exists("tracks", "source_file_path"):
        op.add_column("tracks", sa.Column("source_file_path", sa.String(length=600), nullable=True))


def downgrade() -> None:
    if _column_exists("tracks", "source_file_path"):
        op.drop_column("tracks", "source_file_path")
    if _table_exists("apple_music_tracks"):
        op.drop_table("apple_music_tracks")
