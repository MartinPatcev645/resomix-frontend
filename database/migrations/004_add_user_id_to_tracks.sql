-- Add user_id to tracks table for tracking upload ownership
ALTER TABLE tracks
ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER genre_id;

-- Add foreign key reference to users table
ALTER TABLE tracks
ADD CONSTRAINT fk_tracks_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for fast user track lookups
CREATE INDEX idx_track_user ON tracks(user_id);
