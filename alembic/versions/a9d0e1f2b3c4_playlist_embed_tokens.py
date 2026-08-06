"""embed access tokens (pricing v2.1, G1)

Embedding is sold as a Pro feature, but the widget fetches a playlist by UUID from the general
public route with — in ``apps/embed/src/api.ts``'s own words — *"no auth, no API key, no cookies"*.
Anyone could swap the UUID in an embed URL and render **any** public playlist, including one they
do not own. A Pro gate on the button means nothing while that holds: the gate is on the UI, and the
data is not behind it.

A token makes embedding a deliberate, owner-initiated, **revocable** act:

  * minted only by the owner, only on a plan whose ``export_targets`` include ``embed``;
  * checked by a dedicated endpoint, so the general public-playlist route is untouched — public
    playlists stay public, which is what they are for;
  * revocable, so an embed can be withdrawn without deleting or unpublishing the playlist.

``token`` is UNIQUE — it is the lookup key, and the index is what keeps validation a point read
rather than a scan.

Guarded and reversible.

Revision ID: a9d0e1f2b3c4
Revises: f8c9d0e1a2b3
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "a9d0e1f2b3c4"
down_revision = "f8c9d0e1a2b3"
branch_labels = None
depends_on = None


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if "playlist_embed_tokens" in _tables(conn):
        return

    op.create_table(
        "playlist_embed_tokens",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        # The lookup key. Unique so validation is a single indexed read, and so a collision is a
        # database error rather than two playlists quietly sharing one embed.
        sa.Column("token", sa.String(length=16), nullable=False, unique=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        # Soft revocation: the row stays so "this embed used to exist and was withdrawn" is still
        # answerable. Deleting it would make a withdrawn embed indistinguishable from one that was
        # never minted.
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Index("idx_playlist", "playlist_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    conn = op.get_bind()
    if "playlist_embed_tokens" in _tables(conn):
        op.drop_table("playlist_embed_tokens")
