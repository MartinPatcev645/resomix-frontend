"""track_artifact_status — the fact the Library was guessing at

WHY

Every consumer upload produces two sibling artifacts: a similarity playlist and an analysis. The
Library shows a capsule for each, and until now it decided what to show from the track's *age*:
younger than 15 minutes → "generating", older → "Analysis coming soon". So an analysis that took
longer than 15 minutes was reported to the user as an unbuilt feature, and a failed one looked
exactly like a healthy one.

The guess existed because there was nothing to read. A missing `playlist_uuid` / `analysis_uuid`
means one of four things — queued, running, ran-and-produced-nothing, failed — and the API had no
way to say which.

WHY NOT track_processing_status

It is the obvious candidate and it is the wrong one: that table is the partner SFTP ingestion state
machine (transcode → embedding → peaks → segments → FAISS), written only by the ingestion path.
A consumer upload never gets a row in it. Confirmed by reading every construction site of
`TrackProcessingStatus` — `ingestion_persist.py:129` and `ingestion_service.py:1038`, both inside
the partner batch flow.

BACKFILL

Existing uploads get a row, with the state inferred from what actually exists: a playlist or an
analysis found for the track is `ready`, its absence on a row this old is `unavailable`. That is
the honest reading — those pipelines finished long ago, so anything still missing is never
arriving. It also means no existing row can sit on `pending` and poll forever, which is the one
outcome a null-state backfill would guarantee.

Idempotent, like the migrations either side of it.

Revision ID: e4a9b2c7d135
Revises: d3f7a1c5e982
Create Date: 2026-08-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "e4a9b2c7d135"
down_revision = "d3f7a1c5e982"
branch_labels = None
depends_on = None

TABLE = "track_artifact_status"


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
        sa.Column("partner_id", mysql.INTEGER(unsigned=True), nullable=False, server_default="1"),
        sa.Column("user_id", mysql.INTEGER(unsigned=True), nullable=True),
        sa.Column("playlist_state", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("playlist_error", mysql.TEXT, nullable=True),
        sa.Column("playlist_completed_at", sa.DateTime, nullable=True),
        sa.Column("analysis_state", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("analysis_error", mysql.TEXT, nullable=True),
        sa.Column("analysis_completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column(
            "updated_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        # One row per track. This is what makes every setter idempotent: they are UPDATEs keyed on
        # track_id, so a retried Celery task cannot write a second, contradictory row.
        sa.UniqueConstraint("track_id", name="uq_track_artifact_status_track"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_track_artifact_status_partner", TABLE, ["partner_id"])
    op.create_index("ix_track_artifact_status_user", TABLE, ["user_id"])
    op.create_index("ix_track_artifact_status_playlist_state", TABLE, ["playlist_state"])
    op.create_index("ix_track_artifact_status_analysis_state", TABLE, ["analysis_state"])

    # --- Backfill every existing consumer upload ------------------------------------------- #
    # `ready` where the artifact is actually there, `unavailable` where it is not. Never `pending`:
    # these pipelines ran to completion (or died) long ago, and seeding them as pending would put
    # every historic upload into a poll that can never terminate.
    conn.execute(
        text(
            """
            INSERT INTO track_artifact_status
                (track_id, partner_id, user_id,
                 playlist_state, playlist_completed_at,
                 analysis_state, analysis_completed_at,
                 created_at, updated_at)
            SELECT
                t.id,
                t.partner_id,
                t.user_id,
                CASE WHEN p.id IS NOT NULL THEN 'ready' ELSE 'unavailable' END,
                p.created_at,
                CASE WHEN a.id IS NOT NULL THEN 'ready' ELSE 'unavailable' END,
                a.created_at,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM tracks t
            LEFT JOIN (
                -- The same three conditions `async_get_similarity_playlist_map` applies, so the
                -- backfilled state and what the Library actually shows cannot disagree on day one.
                SELECT seed_track_id, MIN(id) AS id, MIN(created_at) AS created_at
                FROM playlists
                WHERE seed_track_id IS NOT NULL
                  AND type IN ('similarity', 'waiting_segments')
                  AND deleted_at IS NULL
                GROUP BY seed_track_id
            ) p ON p.seed_track_id = t.id
            LEFT JOIN (
                SELECT track_id, MIN(id) AS id, MIN(created_at) AS created_at
                FROM track_analysis_results
                GROUP BY track_id
            ) a ON a.track_id = t.id
            -- `tracks.type`, not `track_type`: the model maps the attribute `track_type` onto a
            -- column literally called `type`. Raw SQL has to use the column name.
            WHERE t.type = 'upload' AND t.user_id IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    if TABLE in _tables(conn):
        op.drop_table(TABLE)
