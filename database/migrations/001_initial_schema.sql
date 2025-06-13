/*
Migration: 001_initial_schema
=============================

Initial database schema creation for ResomiX Audio Similarity API.
This migration creates all core tables, indexes, and constraints
for the complete application functionality.

Version: 3.0.1
Created: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

-- Migration tracking table (must be created first)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    checksum VARCHAR(64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert this migration record
INSERT IGNORE INTO schema_migrations (version, description, checksum) 
VALUES ('001_initial_schema', 'Initial database schema creation', 'a1b2c3d4e5f6');

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
    duration_sec  INT UNSIGNED,
    bpm           SMALLINT UNSIGNED,
    musical_key   VARCHAR(5),                  -- e.g. "C#m"
    file_path     VARCHAR(500) NOT NULL,       -- original / full file
    preview_path  VARCHAR(500),                -- 30-sec MP3 etc.
    file_size     BIGINT UNSIGNED,             -- bytes
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
    user_id     CHAR(36),                         -- nullable (anon)
    name        VARCHAR(150) NOT NULL,
    is_public   TINYINT(1) DEFAULT 0,
    type        ENUM('custom','similarity') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    KEY idx_playlist_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BIGINT UNSIGNED NOT NULL,
    track_id    BIGINT UNSIGNED NOT NULL,
    position    INT UNSIGNED NOT NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE,
    KEY idx_pt_track (track_id)
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

/* ---------- 6. Ratings (track & playlist) ----------------- */

CREATE TABLE IF NOT EXISTS track_ratings (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    track_id  BIGINT UNSIGNED NOT NULL,
    rating    TINYINT UNSIGNED,      -- 0/1 "dislike/like"
    rated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    KEY idx_tr_user (user_id, track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_ratings (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    CHAR(36),
    playlist_id BIGINT UNSIGNED NOT NULL,
    rating     TINYINT UNSIGNED,     -- 0-3 stars
    rated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    KEY idx_pr_user (user_id, playlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 7. Logs & Feedback ---------------------------- */

CREATE TABLE IF NOT EXISTS logs (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id   CHAR(36),
    track_id  BIGINT UNSIGNED,
    action    VARCHAR(50) NOT NULL,
    message   VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    KEY idx_log_user (user_id),
    KEY idx_log_track (track_id)
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
    KEY idx_contact_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; 