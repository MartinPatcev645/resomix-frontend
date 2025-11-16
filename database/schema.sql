/*
Database Schema
===============

MariaDB schema definitions for the Resomix Audio Similarity API.

Version: 3.2.0           -- Auth: numeric user IDs (BIGINT), UUID kept as public id
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

/* ===========================================================
   Resomix – Application DB  (MariaDB 10.5+ / InnoDB)
   Internal primary keys: BIGINT UNSIGNED.
   Public/external user id: users.uuid (CHAR(36)) unique.
   =========================================================== */

/* ---------- 0. Users & Auth Core -------------------------- */

/* Primary user profile / credentials
   - id: internal surrogate key (fast FKs)
   - uuid: external/public stable id (keep existing UUIDs) */
CREATE TABLE IF NOT EXISTS users (
    id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                   CHAR(36) NOT NULL UNIQUE,          -- public id
    username               VARCHAR(50)  NOT NULL UNIQUE,
    email                  VARCHAR(100) NOT NULL UNIQUE,
    password_hash          VARCHAR(255) NOT NULL,             -- salted hash (argon2/bcrypt)
    name                   VARCHAR(100),
    profile_picture        VARCHAR(255),
    language               VARCHAR(10),
    timezone               VARCHAR(50),
    is_email_verified      TINYINT(1) DEFAULT 0,
    is_two_factor_enabled  TINYINT(1) DEFAULT 0,
    two_factor_method      ENUM('email','app') DEFAULT 'email',
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_users_email (email),
    KEY idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* One-time email verification tokens */
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    user_id     BIGINT UNSIGNED NOT NULL,
    token       VARCHAR(64) NOT NULL,              -- 64 chars for token_urlsafe(32) which generates ~43 chars
    expires_at  DATETIME NOT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_evt_token (token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* One-time password reset tokens */
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_id     BIGINT UNSIGNED NOT NULL,
    token       VARCHAR(64) NOT NULL,              -- 64 chars for token_urlsafe(32) which generates ~43 chars
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_prt_token (token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 2FA via email codes (short-lived) */
CREATE TABLE IF NOT EXISTS two_factor_email_codes (
    user_id     BIGINT UNSIGNED NOT NULL,
    code        VARCHAR(10) NOT NULL,             -- e.g., 6-digit code
    purpose     ENUM('login','password_change') DEFAULT 'login',
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id, code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Optional: sessions/refresh tokens (device tracking / revocation) */
CREATE TABLE IF NOT EXISTS user_sessions (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT UNSIGNED NOT NULL,
    session_id         CHAR(36) NOT NULL UNIQUE,     -- or opaque random id
    refresh_token_hash VARCHAR(255) DEFAULT NULL,
    user_agent         VARCHAR(255),
    ip_address         VARCHAR(45),
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at         DATETIME DEFAULT NULL,
    revoked_at         DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expires (expires_at),
    KEY idx_sessions_revoked (revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* OAuth / Social login links (e.g., Google) */
CREATE TABLE IF NOT EXISTS user_auth_providers (
    user_id       BIGINT UNSIGNED NOT NULL,
    provider      VARCHAR(50) NOT NULL,            -- 'google', etc.
    provider_uid  VARCHAR(100) NOT NULL,           -- external subject/id
    PRIMARY KEY (user_id, provider),
    UNIQUE KEY uk_provider_uid (provider, provider_uid),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    user_id BIGINT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)  ON DELETE CASCADE
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
    album_id      INT UNSIGNED,
    label_id      INT UNSIGNED,
    genre_id      INT UNSIGNED,
    title         VARCHAR(255) NOT NULL,
    year          YEAR,
    duration_sec  DECIMAL(8,3),
    bpm           SMALLINT UNSIGNED,
    musical_key   VARCHAR(5),
    file_path     VARCHAR(500) NOT NULL,
    preview_path  VARCHAR(500),
    file_size     BIGINT UNSIGNED,
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

/* Many-to-many for track ↔ artists */
CREATE TABLE IF NOT EXISTS track_artists (
    track_id  BIGINT UNSIGNED NOT NULL,
    artist_id INT UNSIGNED    NOT NULL,
    PRIMARY KEY (track_id, artist_id),
    FOREIGN KEY (track_id)  REFERENCES tracks(id)  ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 4. Playlists & list contents ------------------ */

CREATE TABLE IF NOT EXISTS playlists (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    user_id       BIGINT UNSIGNED,                 -- nullable (anon)
    name          VARCHAR(150) NOT NULL,
    is_public     TINYINT(1) DEFAULT 0,
    type          ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    fork_id       VARCHAR(36) NULL,                -- UUID of original playlist if forked
    forked_at     DATETIME NULL,                   -- when the fork was created
    fork_count    INT UNSIGNED NOT NULL DEFAULT 0, -- how many times this playlist has been forked
    num_tracks    INT UNSIGNED NOT NULL DEFAULT 0, -- number of tracks in playlist_tracks
    play_time     INT UNSIGNED NOT NULL DEFAULT 0, -- total play time in seconds (sum of track durations)
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (fork_id)      REFERENCES playlists(uuid) ON DELETE SET NULL,
    KEY idx_playlist_user (user_id),
    KEY idx_playlist_uuid (uuid),
    KEY idx_playlist_fork (fork_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BIGINT UNSIGNED NOT NULL,
    track_id    BIGINT UNSIGNED NOT NULL,
    position    DECIMAL(12,6) NOT NULL,            -- high precision for efficient reordering
    score       DECIMAL(10, 8) NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE,
    KEY idx_pt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 4.5 Playlist Transfer Tracks (External Platform Caching) ---------- */

CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id        BIGINT UNSIGNED NOT NULL,
    spotify_id      VARCHAR(100) NULL,
    apple_music_id  VARCHAR(100) NULL,
    beatport_id     VARCHAR(100) NULL,
    deezer_id       VARCHAR(100) NULL,
    tidal_id        VARCHAR(100) NULL,
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

/* ---------- 4.7 Playlist and Track Favorites and Follows ---------- */

/* ===========================================================
   9. Engagements: favorites & follows (playlists, tracks)
   =========================================================== */

/* User ↔ Playlist engagement */
CREATE TABLE IF NOT EXISTS user_playlist_engagements (
    user_id            BIGINT UNSIGNED NOT NULL,
    playlist_id        BIGINT UNSIGNED NOT NULL,

    /* current states */
    is_favorite        TINYINT(1) NOT NULL DEFAULT 0,
    is_following       TINYINT(1) NOT NULL DEFAULT 0,

    /* state transition timestamps (last time each state became true/false) */
    favorite_at        DATETIME DEFAULT NULL,      -- when set to favorite (last time)
    unfavorite_at      DATETIME DEFAULT NULL,      -- when removed from favorite (last time)
    followed_at        DATETIME DEFAULT NULL,      -- when follow turned on (last time)
    unfollowed_at      DATETIME DEFAULT NULL,      -- when follow turned off (last time)

    /* metadata */
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, playlist_id),
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE,

    /* common query patterns */
    KEY idx_upe_user_fav       (user_id, is_favorite, favorite_at),
    KEY idx_upe_user_follow    (user_id, is_following, followed_at),
    KEY idx_upe_playlist_fav   (playlist_id, is_favorite, favorite_at),
    KEY idx_upe_playlist_follow(playlist_id, is_following, followed_at),
    KEY idx_upe_updated        (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* User ↔ Track engagement */
CREATE TABLE IF NOT EXISTS user_track_engagements (
    user_id            BIGINT UNSIGNED NOT NULL,
    track_id           BIGINT UNSIGNED NOT NULL,

    is_favorite        TINYINT(1) NOT NULL DEFAULT 0,
    is_following       TINYINT(1) NOT NULL DEFAULT 0,

    favorite_at        DATETIME DEFAULT NULL,
    unfavorite_at      DATETIME DEFAULT NULL,
    followed_at        DATETIME DEFAULT NULL,
    unfollowed_at      DATETIME DEFAULT NULL,

    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, track_id),
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id)  ON DELETE CASCADE,

    KEY idx_ute_user_fav       (user_id, is_favorite, favorite_at),
    KEY idx_ute_user_follow    (user_id, is_following, followed_at),
    KEY idx_ute_track_fav      (track_id, is_favorite, favorite_at),
    KEY idx_ute_track_follow   (track_id, is_following, followed_at),
    KEY idx_ute_updated        (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ---------- 5. Billing (purchases + subscriptions) -------- */

CREATE TABLE IF NOT EXISTS purchases (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,                 -- nullable
    track_id     BIGINT UNSIGNED,
    album_id     INT UNSIGNED,
    price_cents  INT UNSIGNED,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL,
    KEY idx_purchase_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id                BIGINT UNSIGNED PRIMARY KEY,
    stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 6. Ratings (track & playlist) ----------------- */

CREATE TABLE IF NOT EXISTS track_ratings (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,
    track_id     BIGINT UNSIGNED NOT NULL,
    playlist_id  BIGINT UNSIGNED NULL,
    rating       TINYINT UNSIGNED,      -- 0/1 "dislike/like"
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)     ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    KEY idx_tr_user (user_id, track_id),
    KEY idx_tr_playlist (playlist_id),
    KEY idx_tr_user_track_playlist (user_id, track_id, playlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_ratings (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,
    playlist_id  BIGINT UNSIGNED NOT NULL,
    rating       TINYINT UNSIGNED,     -- 0-3 stars
    message      TEXT NULL,            -- Optional user message/feedback
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    KEY idx_pr_user (user_id, playlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 7. Logs & Feedback ---------------------------- */

CREATE TABLE IF NOT EXISTS system_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correlation_id  VARCHAR(36),
    method          VARCHAR(10),
    endpoint        VARCHAR(500),
    path            VARCHAR(500),
    query_params    JSON,
    status_code     SMALLINT UNSIGNED,
    response_size   INT UNSIGNED,
    duration_ms     DECIMAL(10,3),
    level           ENUM('DEBUG','INFO','WARNING','ERROR','CRITICAL') DEFAULT 'INFO',
    category        VARCHAR(50),
    action          VARCHAR(100),
    message         TEXT,
    client_ip       VARCHAR(45),
    user_agent      VARCHAR(500),
    referer         VARCHAR(500),
    cpu_percent     DECIMAL(5,2),
    memory_percent  DECIMAL(5,2),
    track_id        BIGINT UNSIGNED,
    playlist_id     BIGINT UNSIGNED,
    album_id        INT UNSIGNED,
    artist_id       INT UNSIGNED,
    log_metadata    JSON DEFAULT NULL,
    stack_trace     TEXT,
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
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (album_id)    REFERENCES albums(id)    ON DELETE SET NULL,
    FOREIGN KEY (artist_id)   REFERENCES artists(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT UNSIGNED,
    category      VARCHAR(50),
    message       TEXT,
    satisfaction  INT UNSIGNED,
    recommendation INT UNSIGNED,
    status        ENUM('open','resolved') DEFAULT 'open',
    submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_fb_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED,
    name        VARCHAR(100),
    email       VARCHAR(100),
    subject     VARCHAR(150),
    phone       VARCHAR(20),
    message     TEXT,
    status      ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
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

/* ---------- 9. Operation Limits ---------------------------- */

CREATE TABLE IF NOT EXISTS operation_types (
    id          TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_operation_limits (
    user_id        BIGINT UNSIGNED NOT NULL,
    operation_id   TINYINT UNSIGNED NOT NULL,
    limit_value    INT UNSIGNED NOT NULL,
    window_seconds INT UNSIGNED DEFAULT NULL,
    usage          INT UNSIGNED NOT NULL DEFAULT 0,
    created_by     BIGINT UNSIGNED DEFAULT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, operation_id),
    FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operation_types(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_uol_operation (operation_id),
    KEY idx_uol_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 10. Spotify App Management ---------------------------- */

/* Spotify apps configuration (for managing multiple Spotify apps to handle >25 users) */
CREATE TABLE IF NOT EXISTS spotify_apps (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     VARCHAR(255),
    client_id       VARCHAR(255) NOT NULL UNIQUE,
    client_secret   VARCHAR(255) NOT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    user_count      INT UNSIGNED NOT NULL DEFAULT 0,  -- number of users associated with this app
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_spotify_apps_active (is_active),
    KEY idx_spotify_apps_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* User ↔ Spotify App association (associates users with specific Spotify apps) */
CREATE TABLE IF NOT EXISTS user_spotify_apps (
    user_id         BIGINT UNSIGNED NOT NULL,
    spotify_app_id  INT UNSIGNED NOT NULL,
    created_by      BIGINT UNSIGNED DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (spotify_app_id) REFERENCES spotify_apps(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)     REFERENCES users(id)        ON DELETE SET NULL,
    KEY idx_usa_spotify_app (spotify_app_id),
    KEY idx_usa_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
