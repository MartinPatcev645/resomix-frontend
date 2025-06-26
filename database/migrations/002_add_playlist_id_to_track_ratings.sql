-- Migration: Add playlist_id to track_ratings table
-- Date: January 2025
-- Description: Add playlist_id foreign key to track_ratings table to track which playlist a rating came from

-- First, delete all existing track ratings as requested
DELETE FROM track_ratings;

-- Add the playlist_id column with foreign key constraint
ALTER TABLE track_ratings 
ADD COLUMN playlist_id BIGINT UNSIGNED NULL AFTER track_id,
ADD FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE;

-- Optional: Add index for better performance on playlist_id queries
ALTER TABLE track_ratings ADD INDEX idx_tr_playlist (playlist_id);

-- Optional: Add composite index for user_id, track_id, playlist_id
ALTER TABLE track_ratings ADD INDEX idx_tr_user_track_playlist (user_id, track_id, playlist_id); 