/*
Database Schema
===============

MariaDB schema definitions for the Resomix Digital Service Provider (DSP).
Synthesized Version: B2B + B2C Combined (Final Architectural Implementation)
Init Date: April 2026
*/

/* ===========================================================
   Resomix – Application DB  (MariaDB 10.5+ / InnoDB)
   Internal primary keys: BIGINT UNSIGNED.
   Public/external user id: users.uuid (CHAR(36)) unique.
   =========================================================== */

/* ---------- 0. Users & Auth Core -------------------------- */
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
    stripe_customer_id     VARCHAR(255) UNIQUE COMMENT 'External Stripe billing mapping',
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_users_email (email),
    KEY idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    user_id     BIGINT UNSIGNED NOT NULL,
    token       VARCHAR(64) NOT NULL,
    expires_at  DATETIME NOT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_evt_token (token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_id     BIGINT UNSIGNED NOT NULL,
    token       VARCHAR(64) NOT NULL,
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_prt_token (token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS two_factor_email_codes (
    user_id     BIGINT UNSIGNED NOT NULL,
    code        VARCHAR(10) NOT NULL,
    purpose     ENUM('login','password_change') DEFAULT 'login',
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (user_id, code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT UNSIGNED NOT NULL,
    session_id         CHAR(36) NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS user_auth_providers (
    user_id       BIGINT UNSIGNED NOT NULL,
    provider      VARCHAR(50) NOT NULL,
    provider_uid  VARCHAR(100) NOT NULL,
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
    isni VARCHAR(50) UNIQUE,
    bio TEXT,
    profile_image_url VARCHAR(500),
    country_code CHAR(2),
    social_links JSON COMMENT '{"instagram": "url", "spotify": "url"}',
    beatport_id VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS labels (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120)  NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    website VARCHAR(255),
    dpid VARCHAR(50) UNIQUE COMMENT 'DDEX Party ID',
    sftp_username VARCHAR(255) UNIQUE COMMENT 'Chroot Jail User',
    contact_email VARCHAR(255),
    contract_status ENUM('active', 'suspended', 'terminated') DEFAULT 'active',
    revenue_share_percent DECIMAL(5,2) DEFAULT 0.00,
    parent_label_id INT UNSIGNED DEFAULT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    country_code CHAR(2),
    social_links JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_label_name (name),
    CONSTRAINT fk_label_parent FOREIGN KEY (parent_label_id) REFERENCES labels(id) ON DELETE SET NULL,
    INDEX idx_label_status (contract_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS genres (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    parent_id INT UNSIGNED DEFAULT NULL,
    UNIQUE KEY uk_genre_name (name),
    CONSTRAINT fk_genre_parent FOREIGN KEY (parent_id) REFERENCES genres(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 3. Releases (Albums/Singles/EPs) & Tracks --------- */
CREATE TABLE IF NOT EXISTS releases (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    artist_id   INT UNSIGNED NOT NULL COMMENT 'Primary Main Artist mapping',
    label_id    INT UNSIGNED,
    title       VARCHAR(200) NOT NULL,
    upc_ean     VARCHAR(20) COMMENT 'Global UPC/EAN Barcode',
    price_cents INT UNSIGNED DEFAULT NULL COMMENT 'Full release purchase price',
    catalog_number VARCHAR(100) COMMENT 'Vital for Electronic Music/Beatport parity',
    release_type ENUM('Album', 'EP', 'Single') DEFAULT 'Album',
    description TEXT,
    p_line      VARCHAR(255) COMMENT 'DDEX P-Line (e.g. 2026 Resomix Records)',
    c_line      VARCHAR(255) COMMENT 'DDEX C-Line (c) copyright text',
    release_date DATE,
    ern_version VARCHAR(10),
    raw_xml_path VARCHAR(500) COMMENT 'Reference to the source DDEX XML file',
    cover_image VARCHAR(255),
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active   TINYINT(1) DEFAULT 1 COMMENT 'Toggle for Takedowns',
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id)  REFERENCES labels(id) ON DELETE SET NULL,
    KEY idx_release_artist (artist_id),
    KEY idx_release_label (label_id),
    KEY idx_release_catalog (catalog_number),
    KEY idx_release_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tracks (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    release_id    INT UNSIGNED,
    label_id      INT UNSIGNED,
    genre_id      INT UNSIGNED,
    user_id       BIGINT UNSIGNED,
    isrc          VARCHAR(15) COMMENT 'International Standard Recording Code',
    title         VARCHAR(255) NOT NULL,
    price_cents   INT UNSIGNED DEFAULT 99 COMMENT 'Base B2C Purchase Price',
    mix_name      VARCHAR(150) DEFAULT 'Original Mix' COMMENT 'Crucial for Electronic genres',
    audio_language CHAR(2) DEFAULT 'xx' COMMENT 'ISO-639-1 code; "xx" for Instrumental',
    year          YEAR,
    duration_sec  DECIMAL(8,3),
    bpm           SMALLINT UNSIGNED,
    musical_key   VARCHAR(5),
    file_path     VARCHAR(500) NOT NULL,
    preview_path  VARCHAR(500),
    file_size     BIGINT UNSIGNED,
    type          VARCHAR(50) DEFAULT 'electrobuzz',
    deal_terms    JSON COMMENT 'Stores the DDEX territorial rules, e.g. ["DE", "AT"]',
    ingestion_source ENUM('ddex', 'cc_by', 'user_upload', 'csv') DEFAULT 'user_upload',
    is_explicit   TINYINT(1) DEFAULT 0 COMMENT 'Parental Advisory Tag',
    is_active     TINYINT(1) DEFAULT 1 COMMENT 'Toggle for Track-level Takedowns',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL,
    KEY idx_track_release (release_id),
    KEY idx_track_label  (label_id),
    KEY idx_track_genre  (genre_id),
    KEY idx_track_user   (user_id),
    KEY idx_track_title  (title),
    KEY idx_track_bpm    (bpm),
    KEY idx_track_key    (musical_key),
    KEY idx_track_active (is_active),
    KEY idx_track_source (ingestion_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS track_artists (
    track_id  BIGINT UNSIGNED NOT NULL,
    artist_id INT UNSIGNED    NOT NULL,
    role      ENUM('MainArtist', 'FeaturedArtist', 'Remixer', 'Producer') DEFAULT 'MainArtist',
    PRIMARY KEY (track_id, artist_id),
    FOREIGN KEY (track_id)  REFERENCES tracks(id)  ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    KEY idx_ta_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 4. Playlists & Engagements -------------------- */
CREATE TABLE IF NOT EXISTS playlists (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    user_id       BIGINT UNSIGNED,
    name          VARCHAR(150) NOT NULL,
    is_public     TINYINT(1) DEFAULT 0,
    type          ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,
    fork_id       VARCHAR(36) NULL,
    forked_at     DATETIME NULL,
    fork_count    INT UNSIGNED NOT NULL DEFAULT 0,
    num_tracks    INT UNSIGNED NOT NULL DEFAULT 0,
    play_time     INT UNSIGNED NOT NULL DEFAULT 0,
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
    position    DECIMAL(12,6) NOT NULL,
    score       DECIMAL(10, 8) NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE RESTRICT,
    KEY idx_pt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    KEY idx_ptt_spotify (spotify_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_playlist_engagements (
    user_id            BIGINT UNSIGNED NOT NULL,
    playlist_id        BIGINT UNSIGNED NOT NULL,
    is_favorite        TINYINT(1) NOT NULL DEFAULT 0,
    is_following       TINYINT(1) NOT NULL DEFAULT 0,
    favorite_at        DATETIME DEFAULT NULL,
    unfavorite_at      DATETIME DEFAULT NULL,
    followed_at        DATETIME DEFAULT NULL,
    unfollowed_at      DATETIME DEFAULT NULL,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, playlist_id),
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    FOREIGN KEY (track_id) REFERENCES tracks(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 5. Ratings, Waitlist & Social ------------- */
CREATE TABLE IF NOT EXISTS track_ratings (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,
    track_id     BIGINT UNSIGNED NOT NULL,
    playlist_id  BIGINT UNSIGNED NULL,
    rating       TINYINT UNSIGNED,
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)     ON DELETE RESTRICT,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlist_ratings (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,
    playlist_id  BIGINT UNSIGNED NOT NULL,
    rating       TINYINT UNSIGNED,
    message      TEXT NULL,
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waitlist (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email     VARCHAR(255) NOT NULL UNIQUE,
    status    ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 6. Billing (purchases + subscriptions) -------- */
CREATE TABLE IF NOT EXISTS purchases (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED,
    track_id     BIGINT UNSIGNED,
    release_id   INT UNSIGNED,
    price_cents  INT UNSIGNED,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id                BIGINT UNSIGNED PRIMARY KEY,
    stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 6.5 Carts & Pending Orders -------------------- */
CREATE TABLE IF NOT EXISTS carts (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED NOT NULL,
    status       ENUM('active', 'pending_checkout', 'completed', 'abandoned') DEFAULT 'active',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cart_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id      BIGINT UNSIGNED NOT NULL,
    track_id     BIGINT UNSIGNED NOT NULL,
    price_cents  INT UNSIGNED NOT NULL,
    added_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id)  REFERENCES carts(id)   ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id)  ON DELETE RESTRICT,
    UNIQUE KEY uk_cart_track (cart_id, track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 7. Logs & Support ----------------------------- */
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
    release_id      INT UNSIGNED,
    artist_id       INT UNSIGNED,
    log_metadata    JSON DEFAULT NULL,
    stack_trace     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (release_id)  REFERENCES releases(id)  ON DELETE SET NULL,
    FOREIGN KEY (artist_id)   REFERENCES artists(id)   ON DELETE SET NULL,
    INDEX idx_syslog_created (created_at),
    INDEX idx_syslog_level (level)
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 8. Operation Limits & Spotify External -------- */
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
    FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS spotify_apps (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     VARCHAR(255),
    client_id       VARCHAR(255) NOT NULL UNIQUE,
    client_secret   VARCHAR(255) NOT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    user_count      INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_spotify_apps (
    user_id         BIGINT UNSIGNED NOT NULL,
    spotify_app_id  INT UNSIGNED NOT NULL,
    created_by      BIGINT UNSIGNED DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (spotify_app_id) REFERENCES spotify_apps(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)     REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ===========================================================
   DDEX & DSP Core Extensions 
   =========================================================== */

/* ---------- 9. Ingestion Pipeline & DDEX Auditing ------- */
CREATE TABLE IF NOT EXISTS sftp_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label_id INT UNSIGNED NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    home_directory VARCHAR(500) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT,
    INDEX idx_sftp_user_active (username, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ingestion_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label_id INT UNSIGNED NOT NULL,
    batch_filename VARCHAR(255),
    status ENUM('processing', 'success', 'failed_validation', 'failed_parsing'),
    error_details TEXT,
    track_count INT UNSIGNED DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT,
    INDEX idx_ingestion_status (status),
    INDEX idx_ingestion_label (label_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ingestion_errors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ingestion_log_id INT UNSIGNED NOT NULL,
    error_severity ENUM('warning', 'critical') DEFAULT 'critical',
    reference_node VARCHAR(255) COMMENT 'E.g., <ReleaseId> or specific ISRC string',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingestion_log_id) REFERENCES ingestion_log(id) ON DELETE CASCADE,
    INDEX idx_ie_severity (error_severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS manual_takedowns (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    track_id BIGINT UNSIGNED NOT NULL,
    admin_user_id BIGINT UNSIGNED NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    INDEX idx_mt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 10. DSRF Telemetry & Consumption Tracking ---- */
CREATE TABLE IF NOT EXISTS consumption_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_category ENUM('stream_start', 'stream_complete', 'stream_skip', 'download_success') NOT NULL,
    track_id BIGINT UNSIGNED,
    isrc VARCHAR(15) COMMENT 'Denormalized heavily for rapid DSRF generation indexing',
    label_id INT UNSIGNED,
    user_id BIGINT UNSIGNED,
    country_code CHAR(2) COMMENT 'Geolocated user state from start IP',
    client_ip VARCHAR(45) COMMENT 'Hashed or raw IP for fraud analysis',
    playback_context VARCHAR(50) COMMENT 'e.g., search, playlist, artist_profile',
    source_device ENUM('web', 'ios', 'android', 'desktop', 'other') DEFAULT 'web',
    session_id CHAR(36) COMMENT 'Cryptographic session. Identifies and deduplicates bot-farms.',
    duration_seconds INT UNSIGNED NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agg_label (label_id, event_category, timestamp),
    INDEX idx_agg_isrc (isrc, event_category, timestamp),
    INDEX idx_ce_session (session_id),
    INDEX idx_dsrf_report (label_id, timestamp, isrc, country_code, event_category),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 11. Admin Dashboard & Reporting Controls ---- */
CREATE TABLE IF NOT EXISTS generated_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label_id INT UNSIGNED NOT NULL,
    reporting_period VARCHAR(7) COMMENT 'Format: YYYY-MM',
    total_valid_streams BIGINT UNSIGNED DEFAULT 0,
    report_file_path VARCHAR(500),
    status ENUM('draft', 'generated', 'sent_to_label') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_label_period (label_id, reporting_period),
    INDEX idx_gr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS label_payouts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label_id INT UNSIGNED NOT NULL,
    report_id INT UNSIGNED NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'EUR',
    payout_status ENUM('calculated', 'processing', 'paid', 'failed') DEFAULT 'calculated',
    transaction_reference VARCHAR(255) COMMENT 'Bank/Stripe transfer ID mapping',
    paid_at DATETIME,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT,
    FOREIGN KEY (report_id) REFERENCES generated_reports(id) ON DELETE CASCADE,
    INDEX idx_lp_status (payout_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 12. Copyright & ACR Monitoring -------------- */
CREATE TABLE IF NOT EXISTS acr_infringement_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    attempted_filename VARCHAR(255),
    matched_title VARCHAR(255) COMMENT 'The copyrighted song title ACR matched against',
    matched_artists VARCHAR(255),
    acr_score DECIMAL(5,2),
    status ENUM('blocked', 'disputed', 'cleared') DEFAULT 'blocked',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_acr_status (status),
    INDEX idx_acr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
