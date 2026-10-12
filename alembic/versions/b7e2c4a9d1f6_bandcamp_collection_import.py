"""bandcamp_connections / user_music_collection / sync_jobs — importing a public Bandcamp collection

WHY

A user enters their public Bandcamp username and what they own is imported, so Sonic Discovery and
Track Intelligence can start from music they already have. Three tables:

* bandcamp_connections — which public username a user linked, and the state of its last sync.
  No credentials: the collection is read from public pages only. ``resume_token`` is the
  older_than_token a capped sync will continue from.
* user_music_collection — one row per owned album/track. Unique on (user_id, source, external_id)
  so a re-sync is an upsert, never a duplicate. ``added_at`` is when the fan added the item
  (parsed from the Bandcamp item token) and is what the collection list orders by.
  ``resomix_track_id`` is set when the item matches a catalogue track; SET NULL so removing that
  track never deletes what the user owns. Albums are stored but not matched to a track.
* sync_jobs — the progress record a client polls while the import runs in the worker.
  ``incremental`` and ``resume_token`` are fixed when the job is created.

Also indexes ``track_store_links.bandcamp_url`` so a page of collection URLs can be matched
with one lookup. That table already exists (``a3d7e1f9c2b4``).

Idempotent, like the migrations either side of it. If these tables were created by an earlier
draft of this revision, the missing columns are added and ``analysis_status`` is removed.

Revision ID: b7e2c4a9d1f6
Revises: a3d7e1f9c2b4
Create Date: 2026-10-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "b7e2c4a9d1f6"
down_revision = "a3d7e1f9c2b4"
branch_labels = None
depends_on = None

CONNECTIONS = "bandcamp_connections"
COLLECTION = "user_music_collection"
JOBS = "sync_jobs"
STORE_LINKS = "track_store_links"
STORE_LINK_INDEX = "ix_track_store_links_bandcamp_url"

_TABLE_KW = dict(mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def _has_column(conn, table: str, column: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
    )


def _has_index(conn, table: str, index: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i"
            ),
            {"t": table, "i": index},
        ).first()
    )


def upgrade() -> None:
    conn = op.get_bind()
    existing = _tables(conn)

    if CONNECTIONS not in existing:
        op.create_table(
            CONNECTIONS,
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, nullable=False),
            sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("bandcamp_username", sa.String(100), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("last_synced_at", sa.DateTime, nullable=True),
            sa.Column("error_message", mysql.TEXT, nullable=True),
            sa.Column("resume_token", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", name="uq_bandcamp_connections_user"),
            **_TABLE_KW,
        )
    elif not _has_column(conn, CONNECTIONS, "resume_token"):
        op.add_column(CONNECTIONS, sa.Column("resume_token", sa.String(255), nullable=True))

    if COLLECTION not in existing:
        op.create_table(
            COLLECTION,
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
            sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("source", sa.String(30), nullable=False, server_default="bandcamp"),
            sa.Column("external_id", sa.String(64), nullable=False),
            sa.Column("item_type", sa.String(10), nullable=False),
            sa.Column("artist", sa.String(512), nullable=True),
            sa.Column("title", sa.String(1024), nullable=True),
            sa.Column("album", sa.String(1024), nullable=True),
            sa.Column("artwork_url", sa.String(500), nullable=True),
            sa.Column("source_url", sa.String(500), nullable=True),
            sa.Column("duration_ms", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("added_at", sa.DateTime, nullable=True),
            sa.Column("resomix_track_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["resomix_track_id"], ["tracks.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("user_id", "source", "external_id", name="uq_user_music_collection_item"),
            **_TABLE_KW,
        )
        op.create_index("ix_user_music_collection_user_source", COLLECTION, ["user_id", "source"])
        op.create_index("ix_user_music_collection_source_url", COLLECTION, ["source_url"])
        op.create_index("ix_user_music_collection_resomix_track_id", COLLECTION, ["resomix_track_id"])
    else:
        if _has_column(conn, COLLECTION, "analysis_status"):
            op.drop_column(COLLECTION, "analysis_status")
        if not _has_column(conn, COLLECTION, "added_at"):
            op.add_column(COLLECTION, sa.Column("added_at", sa.DateTime(), nullable=True))

    if JOBS not in existing:
        op.create_table(
            JOBS,
            sa.Column("id", sa.CHAR(36), nullable=False),
            sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("source", sa.String(30), nullable=False, server_default="bandcamp"),
            sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
            sa.Column("total", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("processed", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("error", mysql.TEXT, nullable=True),
            sa.Column("incremental", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("resume_token", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            **_TABLE_KW,
        )
        op.create_index("ix_sync_jobs_user_source", JOBS, ["user_id", "source"])
    else:
        if not _has_column(conn, JOBS, "incremental"):
            op.add_column(
                JOBS,
                sa.Column("incremental", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            )
        if not _has_column(conn, JOBS, "resume_token"):
            op.add_column(JOBS, sa.Column("resume_token", sa.String(255), nullable=True))

    if STORE_LINKS in _tables(conn) and not _has_index(conn, STORE_LINKS, STORE_LINK_INDEX):
        op.create_index(STORE_LINK_INDEX, STORE_LINKS, ["bandcamp_url"])


def downgrade() -> None:
    conn = op.get_bind()
    existing = _tables(conn)
    if STORE_LINKS in existing and _has_index(conn, STORE_LINKS, STORE_LINK_INDEX):
        op.drop_index(STORE_LINK_INDEX, table_name=STORE_LINKS)
    for table in (JOBS, COLLECTION, CONNECTIONS):
        if table in existing:
            op.drop_table(table)
