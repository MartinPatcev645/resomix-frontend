-- Migration: Add playlist fork support and improve position precision
-- Date: 2025-01-27
-- Reason: Enable playlist forking functionality and improve track reordering efficiency

-- Add fork-related columns to playlists table
ALTER TABLE playlists 
    ADD COLUMN fork_id   VARCHAR(36) NULL AFTER seed_track_id,
    ADD COLUMN forked_at DATETIME    NULL AFTER fork_id,
    ADD COLUMN fork_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER forked_at,
    ADD INDEX  idx_playlist_fork (fork_id),
    ADD CONSTRAINT fk_playlists_fork
        FOREIGN KEY (fork_id) REFERENCES playlists(uuid)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- Change position column to high-precision decimal for efficient reordering
ALTER TABLE playlist_tracks
    MODIFY COLUMN position DECIMAL(12,6) NOT NULL;
