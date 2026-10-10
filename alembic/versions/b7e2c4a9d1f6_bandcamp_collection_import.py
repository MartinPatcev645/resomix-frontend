"""bandcamp_connections / user_music_collection / sync_jobs — importing a public Bandcamp collection

WHY

A user enters their public Bandcamp username and what they own is imported, so Sonic Discovery and
Track Intelligence can start from music they already have. Three tables:

* bandcamp_connections — which public username a user linked, and the state of its last sync.
  No credentials: the collection is read from public pages only.
* user_music_collection — one row per owned album/track. Unique on (user_id, source, external_id)
  so a re-sync is an upsert, never a duplicate. ``resomix_track_id`` is set when the item matches a
  catalogue track; SET NULL so removing that track never deletes what the user owns.
* sync_jobs — the progress record a client polls while the import runs in the worker.

Idempotent, like the migrations either side of it.

Revision ID: b7e2c4a9d1f6
Revises: f1c3d5a90b27
Create Date: 2026-10-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "b7e2c4a9d1f6"
down_revision = "f1c3d5a90b27"
branch_labels = None
depends_on = None

CONNECTIONS = "bandcamp_connections"
COLLECTION = "user_music_collection"
JOBS = "sync_jobs"

_TABLE_KW = dict(mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


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
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", name="uq_bandcamp_connections_user"),
            **_TABLE_KW,
        )

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
            sa.Column("resomix_track_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("analysis_status", sa.String(10), nullable=False, server_default="none"),
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
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            **_TABLE_KW,
        )
        op.create_index("ix_sync_jobs_user_source", JOBS, ["user_id", "source"])


def downgrade() -> None:
    conn = op.get_bind()
    existing = _tables(conn)
    for table in (JOBS, COLLECTION, CONNECTIONS):
        if table in existing:
            op.drop_table(table)
