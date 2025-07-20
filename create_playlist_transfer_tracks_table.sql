-- Create playlist_transfer_tracks table for caching external platform track IDs
-- This table prevents repeated searches on platforms like Spotify, Apple Music, Tidal, etc.

CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id        BIGINT UNSIGNED NOT NULL,
    spotify_id      VARCHAR(100),                -- Spotify track ID/URI
    apple_music_id  VARCHAR(100),                -- Apple Music track ID
    beatport_id     VARCHAR(100),                -- Beatport track ID
    deezer_id       VARCHAR(100),                -- Deezer track ID
    tidal_id        VARCHAR(100),                -- Tidal track ID
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    KEY idx_ptt_spotify (spotify_id),
    KEY idx_ptt_apple (apple_music_id),
    KEY idx_ptt_beatport (beatport_id),
    KEY idx_ptt_deezer (deezer_id),
    KEY idx_ptt_tidal (tidal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
