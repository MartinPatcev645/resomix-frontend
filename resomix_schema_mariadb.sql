/*
Database Schema
===============

MariaDB schema definitions for the ResomiX Audio Similarity API.
This file contains table definitions, indexes, constraints, and relationships
for the complete database structure supporting audio similarity operations.

Includes tables for tracks, artists, albums, genres, labels, users, feedback,
contact forms, playlists, ratings, purchases, and system logging.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

/* ===========================================================
   ResomiX – Application DB  (MariaDB 10.5+ / InnoDB)
   Auth is still handled by Supabase; user IDs are UUID strings.
   =========================================================== */

/* ---------- 1. RBAC (users / roles / permissions) ---------- */

CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id CHAR(36) NOT NULL,                 -- Supabase UUID string
    role_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 2. Catalog tables (artists, labels, genres) ---- */

CREATE TABLE IF NOT EXISTS artists (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    UNIQUE KEY uk_artist_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS labels (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120)  NOT NULL,
    website VARCHAR(255),
    UNIQUE KEY uk_label_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS genres (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    UNIQUE KEY uk_genre_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 3. Albums & Tracks ---------------------------- */

CREATE TABLE IF NOT EXISTS albums (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    artist_id   INT UNSIGNED NOT NULL,
    title       VARCHAR(200) NOT NULL,
    release_date DATE,
    cover_image VARCHAR(255),
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    KEY idx_album_artist (artist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tracks (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    album_id      INT UNSIGNED,                -- NULL for singles
    label_id      INT UNSIGNED,
    genre_id      INT UNSIGNED,                -- Single genre per track
    title         VARCHAR(255) NOT NULL,
    year          YEAR,
    duration_sec  DECIMAL(8,3),
    bpm           SMALLINT UNSIGNED,
    musical_key   VARCHAR(5),                  -- e.g. "C#m"
    file_path     VARCHAR(500) NOT NULL,       -- original / full file
    preview_path  VARCHAR(500),                -- 30-sec MP3 etc.
    file_size     BIGINT UNSIGNED,             -- bytes
    type          VARCHAR(50) DEFAULT 'electrobuzz',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE SET NULL,
    KEY idx_track_album  (album_id),
    KEY idx_track_label  (label_id),
    KEY idx_track_genre  (genre_id),
    KEY idx_track_title  (title),
    KEY idx_track_bpm    (bpm),
    KEY idx_track_key    (musical_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Many-to-many for track ↔ artists (collabs, remixes, etc.) */
CREATE TABLE IF NOT EXISTS track_artists (
    track_id  BIGINT UNSIGNED NOT NULL,
    artist_id INT UNSIGNED    NOT NULL,
    PRIMARY KEY (track_id, artist_id),
    FOREIGN KEY (track_id)  REFERENCES tracks(id)  ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 4. Playlists & list contents ------------------ */

CREATE TABLE IF NOT EXISTS playlists (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid        VARCHAR(36) NOT NULL UNIQUE,
    user_id     CHAR(36),                         -- nullable (anon)
    name        VARCHAR(150) NOT NULL,
    is_public   TINYINT(1) DEFAULT 0,
    type        ENUM('custom','similarity') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    KEY idx_playlist_user (user_id),
    KEY idx_playlist_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BIGINT UNSIGNED NOT NULL,
    track_id    BIGINT UNSIGNED NOT NULL,
    position    INT UNSIGNED NOT NULL,
    score       DECIMAL(10, 8) NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE,
    KEY idx_pt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 4.5 Playlist Transfer Tracks (External Platform Caching) ---------- */

CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id        BIGINT UNSIGNED NOT NULL,
    spotify_id      VARCHAR(100) NULL,                -- Spotify track ID/URI
    apple_music_id  VARCHAR(100) NULL,                -- Apple Music track ID
    beatport_id     VARCHAR(100) NULL,                -- Beatport track ID
    deezer_id       VARCHAR(100) NULL,                -- Deezer track ID
    tidal_id        VARCHAR(100) NULL,                -- Tidal track ID
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

/* ---------- 5. Billing (purchases + subscriptions) -------- */

CREATE TABLE IF NOT EXISTS purchases (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      CHAR(36),                      -- nullable
    track_id     BIGINT UNSIGNED,
    album_id     INT UNSIGNED,
    price_cents  INT UNSIGNED,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE RESTRICT,
    KEY idx_purchase_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id                CHAR(36) PRIMARY KEY,   -- must be non-NULL here
    stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CREATE TABLE IF NOT EXISTS promo_codes (
--   code TEXT PRIMARY KEY,
--   discount_percent INTEGER,
--   max_uses INTEGER,
--   uses INTEGER DEFAULT 0,
--   expires_at TIMESTAMP,
--   created_by VARCHAR(36) REFERENCES auth.users (id)   -- Error here, auth.users is in supabase
-- );

/* ---------- 6. Ratings (track & playlist) ----------------- */
/* Surrogate keys so user_id can be nullable                    */

CREATE TABLE IF NOT EXISTS track_ratings (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    track_id  BIGINT UNSIGNED NOT NULL,
    playlist_id BIGINT UNSIGNED NULL,
    rating    TINYINT UNSIGNED,      -- 0/1 "dislike/like"
    rated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    KEY idx_tr_user (user_id, track_id),
    KEY idx_tr_playlist (playlist_id),
    KEY idx_tr_user_track_playlist (user_id, track_id, playlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_ratings (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    CHAR(36),
    playlist_id BIGINT UNSIGNED NOT NULL,
    rating     TINYINT UNSIGNED,     -- 0-3 stars
    message    TEXT NULL,            -- Optional user message/feedback
    rated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    KEY idx_pr_user (user_id, playlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 7. Logs & Feedback ---------------------------- */

CREATE TABLE IF NOT EXISTS system_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correlation_id  VARCHAR(36),                    -- Optional: for request tracing
    method          VARCHAR(10),                    -- HTTP method (GET, POST, etc.)
    endpoint        VARCHAR(500),                   -- API endpoint path
    path            VARCHAR(500),                   -- Full request path with params
    query_params    JSON,                          -- Query parameters as JSON
    status_code     SMALLINT UNSIGNED,             -- HTTP status code (200, 404, 500, etc.)
    response_size   INT UNSIGNED,                  -- Response size in bytes
    duration_ms     DECIMAL(10,3),                 -- Request duration in milliseconds
    level           ENUM('DEBUG','INFO','WARNING','ERROR','CRITICAL') DEFAULT 'INFO',
    category        VARCHAR(50),                   -- REQUEST, ERROR, USER_ACTION, SYSTEM, etc.
    action          VARCHAR(100),                  -- Specific action (upload_track, create_playlist, etc.)
    message         TEXT,                          -- Detailed log message
    client_ip       VARCHAR(45),                   -- IPv4/IPv6 address
    user_agent      VARCHAR(500),                  -- Browser/client info
    referer         VARCHAR(500),                  -- Request referer
    cpu_percent     DECIMAL(5,2),                  -- CPU usage at request time
    memory_percent  DECIMAL(5,2),                  -- Memory usage percentage
    track_id        BIGINT UNSIGNED,               -- Related track
    playlist_id     BIGINT UNSIGNED,               -- Related playlist
    album_id        INT UNSIGNED,                  -- Related album
    artist_id       INT UNSIGNED,                  -- Related artist
    log_metadata    JSON DEFAULT NULL COMMENT 'Additional structured data',
    stack_trace     TEXT,                          -- For error logs
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_syslog_level (level),
    KEY idx_syslog_category (category),
    KEY idx_syslog_action (action),
    KEY idx_syslog_created (created_at),
    KEY idx_syslog_correlation (correlation_id),
    KEY idx_syslog_endpoint (endpoint),
    KEY idx_syslog_status (status_code),
    KEY idx_syslog_track (track_id),
    KEY idx_syslog_playlist (playlist_id),
    KEY idx_syslog_album (album_id),
    KEY idx_syslog_artist (artist_id),
    KEY idx_syslog_ip (client_ip),
    KEY idx_syslog_level_created (level, created_at),
    KEY idx_syslog_category_created (category, created_at),
    KEY idx_syslog_endpoint_status (endpoint, status_code),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    category  VARCHAR(50),
    message   TEXT,
    satisfaction INT UNSIGNED,
    recommendation INT UNSIGNED,
    status    ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fb_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    name      VARCHAR(100),
    email     VARCHAR(100),
    subject   VARCHAR(150),
    phone     VARCHAR(20),
    message   TEXT,
    status    ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fb_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 8. Waitlist ---------------------------- */

CREATE TABLE IF NOT EXISTS waitlist (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email     VARCHAR(255) NOT NULL UNIQUE,
    status    ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_waitlist_email (email),
    KEY idx_waitlist_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==========================================================
   Indexing & performance notes
   ----------------------------------------------------------
   • Frequently-queried columns (track title, bpm, key, user-id
     lookups) are individually indexed.
   • For full-text search on titles/artists, add a FULLTEXT
     index once the table is populated (InnoDB supports FULLTEXT
     in MariaDB 10.5+).
   • Redis → ideal keys:
       - track:{id}              → track JSON blob
       - playlist:{id}           → playlist header + track IDs
       - artist:{id}             → artist JSON blob
   • If write volume on logs grows large, consider daily/weekly
     partitioning by RANGE COLUMNS (created_at) in MariaDB 10.5+.
   ========================================================== */
