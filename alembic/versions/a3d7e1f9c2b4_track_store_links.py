"""track_store_links: the outside store link per catalogue track (Traxsource now, Bandcamp later)

WHY

The track page gets a "Buy on Traxsource" button (and later "Buy on Bandcamp") for the tracks we
matched to those stores. George's call (9 Oct 2026) is to store only the link; the full store data
and the match evidence stay in the matcher's SQLite files on Alwyzon.

WHY ITS OWN TABLE

Same shape as apple_music_tracks: one row per track that has a link, joined onto the serialized
tracks in one batch read. The 2.2M-row tracks table is left alone (no ALTER on the biggest table,
no edits to every query that selects tracks), and Bandcamp only has to fill its column.

Idempotent, like the migrations either side of it.

Revision ID: a3d7e1f9c2b4
Revises: f1c3d5a90b27
Create Date: 2026-10-09
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "a3d7e1f9c2b4"
down_revision = "f1c3d5a90b27"
branch_labels = None
depends_on = None

TABLE = "track_store_links"


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if TABLE in _tables(conn):
        return
    op.create_table(
        TABLE,
        sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("track_id", mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column("traxsource_url", sa.String(500), nullable=True),
        sa.Column("bandcamp_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # CASCADE: a deleted track takes its links with it, as apple_music_tracks does.
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        # One row per track, so the loader is an upsert and a re-run never leaves a twin.
        sa.UniqueConstraint("track_id", name="uq_track_store_links_track"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    conn = op.get_bind()
    if TABLE in _tables(conn):
        op.drop_table(TABLE)
