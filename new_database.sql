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

CREATE TABLE IF NOT EXISTS user_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token VARCHAR(255) NOT NULL,
    token_type ENUM('email_verification', 'password_reset', '2fa') NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_token (user_id, token_type),
    INDEX idx_token_lookup (token)
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


CREATE TABLE IF NOT EXISTS genres (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    parent_id INT UNSIGNED DEFAULT NULL,
    UNIQUE KEY uk_genre_name (name),
    CONSTRAINT fk_genre_parent FOREIGN KEY (parent_id) REFERENCES genres(id) ON DELETE SET NULL
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

/* ---------- 5.5 E-Commerce & Formats ---------------------- */
CREATE TABLE IF NOT EXISTS promo_codes (
    id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code                  VARCHAR(50) UNIQUE NOT NULL,
    discount_type         ENUM('percentage', 'fixed_amount'),
    discount_value        INT UNSIGNED NOT NULL,
    max_uses              INT UNSIGNED,
    uses_count            INT UNSIGNED DEFAULT 0,
    expires_at            DATETIME,
    is_active             TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS track_formats (
    id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    track_id              BIGINT UNSIGNED NOT NULL,
    audio_format          ENUM('mp3', 'wav', 'flac', 'aiff') NOT NULL,
    price_cents           INT UNSIGNED NOT NULL,
    file_path             VARCHAR(500),
    file_size             BIGINT UNSIGNED,
    is_generated          TINYINT(1) DEFAULT 0 COMMENT '0: convert on demand, 1: file exists',
    last_downloaded_at    DATETIME,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE KEY uk_track_format (track_id, audio_format)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 6. Billing (purchases + subscriptions) -------- */
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    stripe_session_id VARCHAR(255) UNIQUE,
    promo_code_id BIGINT UNSIGNED,
    subtotal_cents INT UNSIGNED NOT NULL,
    discount_cents INT UNSIGNED DEFAULT 0,
    total_cents INT UNSIGNED NOT NULL,
    status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchases (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id           BIGINT UNSIGNED NOT NULL,
    user_id            BIGINT UNSIGNED,
    track_format_id    BIGINT UNSIGNED,
    source_playlist_id BIGINT UNSIGNED COMMENT 'For UI grouping if bought via playlist',
    release_id         INT UNSIGNED,
    price_cents        INT UNSIGNED COMMENT 'Original price before discount',
    purchased_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (track_format_id) REFERENCES track_formats(id) ON DELETE RESTRICT,
    FOREIGN KEY (source_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id                BIGINT UNSIGNED PRIMARY KEY,
    stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------- 6.5 Carts & Pending Orders -------------------- */
CREATE TABLE IF NOT EXISTS carts (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT UNSIGNED NOT NULL,
    promo_code_id  BIGINT UNSIGNED,
    status         ENUM('active', 'pending_checkout', 'completed', 'abandoned') DEFAULT 'active',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE SET NULL,
    INDEX idx_cart_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id            BIGINT UNSIGNED NOT NULL,
    track_format_id    BIGINT UNSIGNED NOT NULL,
    source_playlist_id BIGINT UNSIGNED COMMENT 'For UI grouping if added via playlist',
    price_cents        INT UNSIGNED NOT NULL,
    added_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (track_format_id) REFERENCES track_formats(id) ON DELETE RESTRICT,
    FOREIGN KEY (source_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    UNIQUE KEY uk_cart_track_format (cart_id, track_format_id)
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
    user_id BIGINT UNSIGNED NOT NULL COMMENT 'Links to core users table for authentication',
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    home_directory VARCHAR(500) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
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
    track_format_id BIGINT UNSIGNED,
    INDEX idx_agg_label (label_id, event_category, timestamp),
    INDEX idx_agg_isrc (isrc, event_category, timestamp),
    INDEX idx_ce_session (session_id),
    INDEX idx_dsrf_report (label_id, timestamp, isrc, country_code, event_category),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    FOREIGN KEY (track_format_id) REFERENCES track_formats(id) ON DELETE SET NULL,
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



-- ─────────────────────────────────────────────────────────────
-- 1. PARTIES  (distributors / aggregators / labels)
--    folder name on SFTP = party_id
-- ─────────────────────────────────────────────────────────────
CREATE TABLE parties (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL UNIQUE,   -- SFTP folder name / DDEX PartyId
  party_name      VARCHAR(255)  NOT NULL,
  dpid            VARCHAR(100),                    -- DDEX Party ID (DPID)
  email           VARCHAR(255),
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_party_id (party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 2. INGEST LOG  (one row per package received)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ingest_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL,
  package_folder  VARCHAR(512)  NOT NULL,          -- relative SFTP path
  message_id      VARCHAR(255),                    -- DDEX MessageId
  ddex_version    VARCHAR(20),                     -- e.g. "4.3"
  status          ENUM('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  file_count      INT UNSIGNED  DEFAULT 0,
  started_at      DATETIME,
  completed_at    DATETIME,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party_folder (party_id, package_folder(255)),
  INDEX idx_status       (status),
  FOREIGN KEY (party_id) REFERENCES parties(party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 3. MESSAGES  (DDEX ERN MessageHeader)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ingest_log_id       BIGINT UNSIGNED NOT NULL,
  party_id            VARCHAR(100)    NOT NULL,
  message_id          VARCHAR(255)    NOT NULL UNIQUE,
  message_thread_id   VARCHAR(255),
  message_type        VARCHAR(100),                -- e.g. "NewReleaseMessage"
  ddex_version        VARCHAR(20),
  sender_dpid         VARCHAR(100),
  sender_name         VARCHAR(255),
  recipient_dpid      VARCHAR(100),
  recipient_name      VARCHAR(255),
  message_created_at  DATETIME,
  is_update           TINYINT(1)      DEFAULT 0,   -- UpdateIndicator
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party_id  (party_id),
  FOREIGN KEY (ingest_log_id) REFERENCES ingest_log(id),
  FOREIGN KEY (party_id)      REFERENCES parties(party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 4. ARTISTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE artists (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL,          -- owning distributor
  isni            VARCHAR(30),                     -- ISNI
  ipn             VARCHAR(30),                     -- IPN (DDEX proprietary)
  full_name       VARCHAR(512)  NOT NULL,
  artist_type     ENUM('MainArtist','FeaturedArtist','Remixer','Composer',
                       'Lyricist','Producer','Conductor','Orchestra','Other')
                  DEFAULT 'MainArtist',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_full_name (full_name(191)),
  INDEX idx_party     (party_id),
  FOREIGN KEY (party_id) REFERENCES parties(party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 5. LABELS  (RecordLabel / MusicPublisher)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE labels (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL,
  dpid            VARCHAR(100),
  label_name      VARCHAR(512)  NOT NULL,
  label_type      ENUM('RecordLabel','MusicPublisher','OriginalPublisher','SubPublisher','Other')
                  DEFAULT 'RecordLabel',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_label_name (label_name(191)),
  FOREIGN KEY (party_id) REFERENCES parties(party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 6. RELEASES  (Album / Single / EP / Bundle)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE releases (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    artist_id               BIGINT UNSIGNED,
    label_id                BIGINT UNSIGNED,
    party_id                VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    message_id              VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    release_ref             VARCHAR(100),
    ern_version             VARCHAR(10),
    raw_xml_path            VARCHAR(500),
    icpn                    VARCHAR(30),
    upc_ean                 VARCHAR(20),
    grid                    VARCHAR(30),
    catalog_number          VARCHAR(100),
    title                   VARCHAR(1024) NOT NULL,
    subtitle                VARCHAR(1024),
    description             TEXT,
    display_artist          VARCHAR(512),
    release_type            ENUM('Album','EP','Single') DEFAULT 'Album',
    release_date            DATE,
    original_release_date   DATE,
    ingested_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    p_line_year             YEAR,
    p_line_text             VARCHAR(512),
    c_line_year             YEAR,
    c_line_text             VARCHAR(512),
    p_line                  VARCHAR(255),
    c_line                  VARCHAR(255),
    genre                   VARCHAR(255),
    sub_genre               VARCHAR(255),
    parental_warning        ENUM('NoAdviceAvailable','NotExplicit','Explicit','ExplicitContentEdited')
                            DEFAULT 'NotExplicit',
    is_compilation          TINYINT(1) DEFAULT 0,
    is_active               TINYINT(1) DEFAULT 1,
    price_cents             INT UNSIGNED,
    artwork_path            VARCHAR(1024),
    cover_image             VARCHAR(255),
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_release_artist   (artist_id),
    KEY idx_release_label    (label_id),
    KEY idx_release_catalog  (catalog_number),
    KEY idx_release_active   (is_active),
    KEY idx_icpn             (icpn),
    KEY idx_party            (party_id),
    KEY idx_message          (message_id),

    CONSTRAINT fk_release_artist 
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,

    CONSTRAINT fk_release_label 
        FOREIGN KEY (label_id)  REFERENCES labels(id) ON DELETE SET NULL,

    CONSTRAINT fk_release_party 
        FOREIGN KEY (party_id)  REFERENCES parties(party_id),

    CONSTRAINT fk_release_message 
        FOREIGN KEY (message_id) REFERENCES messages(message_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 7. RELEASE_ARTISTS  (junction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE release_artists (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id      BIGINT UNSIGNED NOT NULL,
  artist_id       BIGINT UNSIGNED NOT NULL,
  sequence_num    SMALLINT UNSIGNED DEFAULT 1,
  artist_role     VARCHAR(100)  DEFAULT 'MainArtist',
  UNIQUE KEY uq_release_artist (release_id, artist_id),
  FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id)  REFERENCES artists(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 8. SOUND RECORDINGS  (individual tracks)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE tracks (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                VARCHAR(36) NOT NULL UNIQUE,
    release_id          BIGINT UNSIGNED,
    party_id            VARCHAR(100),
    resource_ref        VARCHAR(100),
    proprietary_id      VARCHAR(100),
    isrc                VARCHAR(30) NOT NULL,
    title               VARCHAR(1024) NOT NULL,
    version_title       VARCHAR(512),
    display_artist      VARCHAR(512),
    track_number        SMALLINT UNSIGNED,
    disk_number         SMALLINT UNSIGNED DEFAULT 1,
    duration_seconds    INT UNSIGNED,
    duration_iso        VARCHAR(30),
    duration_sec        DECIMAL(8,3),
    bpm                 SMALLINT UNSIGNED,
    musical_key         VARCHAR(10),
    key_signature       VARCHAR(10),
    audio_language      CHAR(2) DEFAULT 'xx',
    language_of_lyrics  VARCHAR(10),
    genre               VARCHAR(255),
    sub_genre           VARCHAR(255),
    price_cents         INT UNSIGNED DEFAULT 99,
    mix_name            VARCHAR(150) DEFAULT 'Original Mix',
    type                VARCHAR(50) DEFAULT 'electrobuzz',
    file_path           VARCHAR(1024) NOT NULL,
    preview_path        VARCHAR(500),
    audio_path          VARCHAR(1024),
    file_size           BIGINT UNSIGNED,
    file_size_bytes     BIGINT UNSIGNED,
    audio_codec         VARCHAR(50),
    bit_depth           SMALLINT,
    sample_rate         INT,
    channels            TINYINT,
    p_line_year         YEAR,
    p_line_text         VARCHAR(512),
    deal_terms          JSON,
    parental_warning    ENUM('NoAdviceAvailable','NotExplicit','Explicit','ExplicitContentEdited')
                        DEFAULT 'NotExplicit',
    is_explicit         TINYINT(1) DEFAULT 0,
    is_instrumental     TINYINT(1) DEFAULT 0,
    is_active           TINYINT(1) DEFAULT 1,
    ingestion_source    ENUM('ddex','cc_by','user_upload','csv') DEFAULT 'user_upload',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_track_release (release_id),
    KEY idx_track_title  (title),
    KEY idx_track_bpm    (bpm),
    KEY idx_track_key    (musical_key),
    KEY idx_track_active (is_active),
    KEY idx_track_source (ingestion_source),
    KEY idx_isrc         (isrc),
    KEY idx_party        (party_id),

    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL,
    FOREIGN KEY (party_id)   REFERENCES parties(party_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- 9. RECORDING_ARTISTS  (junction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE recording_artists (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  track_id  BIGINT UNSIGNED NOT NULL,
  artist_id           BIGINT UNSIGNED NOT NULL,
  sequence_num        SMALLINT UNSIGNED DEFAULT 1,
  artist_role         VARCHAR(100)  DEFAULT 'MainArtist',
  UNIQUE KEY uq_rec_artist (track_id, artist_id),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id)          REFERENCES artists(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 10. RIGHTS_CONTROLLERS  (who earns royalties)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE rights_controllers (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)  NOT NULL,      -- distributor
  track_id  BIGINT UNSIGNED NOT NULL,
  controller_name     VARCHAR(512)  NOT NULL,
  controller_dpid     VARCHAR(100),
  right_type          ENUM('MasterRights','NeighboringRights',
                           'PerformingRights','MechanicalRights',
                           'SyncRights','Other')
                      NOT NULL DEFAULT 'MasterRights',
  ownership_share     DECIMAL(8,5),                -- 0.00000 – 100.00000
  territory           VARCHAR(10)   DEFAULT 'Worldwide',
  valid_from          DATE,
  valid_to            DATE,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sr_id (track_id),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (party_id)           REFERENCES parties(party_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 11. DEALS  (commercial terms from DDEX DealList)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE deals (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)    NOT NULL,
  message_id          VARCHAR(255)    NOT NULL,
  deal_ref            VARCHAR(100),                -- DDEX DealReference
  licensee_dpid       VARCHAR(100),               -- who is licensed (us, the DSP)
  deal_start_date     DATE,
  deal_end_date       DATE,
  is_perpetual        TINYINT(1)      DEFAULT 1,
  commercial_model    VARCHAR(100),               -- SubscriptionModel, PayAsYouGoModel …
  distribution_channel VARCHAR(100),             -- ElectronicDistribution …
  preorder_allowed    TINYINT(1)      DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party     (party_id),
  INDEX idx_message   (message_id),
  FOREIGN KEY (party_id)   REFERENCES parties(party_id),
  FOREIGN KEY (message_id) REFERENCES messages(message_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 12. DEAL_TERRITORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE deal_territories (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id     BIGINT UNSIGNED NOT NULL,
  territory   VARCHAR(10)     NOT NULL,           -- ISO 3166-1 alpha-2 or 'Worldwide'
  is_excluded TINYINT(1)      DEFAULT 0,          -- TerritoryCode vs ExcludedTerritoryCode
  INDEX idx_deal (deal_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 13. DEAL_USE_TYPES  (stream, download, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE deal_use_types (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id     BIGINT UNSIGNED NOT NULL,
  use_type    VARCHAR(100)    NOT NULL,           -- OnDemandStream, PermanentDownload …
  INDEX idx_deal (deal_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 14. ROYALTY_RATES  (rate details attached to a deal)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE royalty_rates (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id             BIGINT UNSIGNED NOT NULL,
  rate_type           ENUM('FixedRate','RevenueShare','PerStream',
                           'PerDownload','MinGuarantee','Other')
                      NOT NULL DEFAULT 'RevenueShare',
  rate_value          DECIMAL(12,6)   NOT NULL,   -- % or $ depending on rate_type
  currency            VARCHAR(3)      DEFAULT 'USD',
  tier                VARCHAR(100),               -- optional tier / tier label
  effective_from      DATE,
  effective_to        DATE,
  INDEX idx_deal (deal_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 15. RELEASE_DEALS  (which releases are covered by which deal)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE release_deals (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id  BIGINT UNSIGNED NOT NULL,
  deal_id     BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_rel_deal (release_id, deal_id),
  FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
  FOREIGN KEY (deal_id)    REFERENCES deals(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 16. RESOURCES  (physical files: audio + artwork)
--    Stores the final saved path on our storage
-- ─────────────────────────────────────────────────────────────
CREATE TABLE resources (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)   NOT NULL,
  ingest_log_id       BIGINT UNSIGNED NOT NULL,
  resource_ref        VARCHAR(100),               -- DDEX ResourceReference
  resource_type       ENUM('SoundRecording','Image','Video','Text','Software','Other')
                      NOT NULL,
  original_filename   VARCHAR(512),
  stored_path         VARCHAR(1024)  NOT NULL,    -- path on our file system / object store
  file_size_bytes     BIGINT UNSIGNED,
  mime_type           VARCHAR(100),
  checksum_md5        VARCHAR(64),
  checksum_sha256     VARCHAR(128),
  linked_track_id BIGINT UNSIGNED,            -- FK to sound_recordings (nullable)
  linked_release_id   BIGINT UNSIGNED,            -- FK to releases (nullable for artwork)
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party          (party_id),
  INDEX idx_ingest         (ingest_log_id),
  FOREIGN KEY (party_id)           REFERENCES parties(party_id),
  FOREIGN KEY (ingest_log_id)      REFERENCES ingest_log(id),
  FOREIGN KEY (linked_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (linked_release_id)   REFERENCES releases(id)         ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE contributors (
id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
party_id VARCHAR(100) NOT NULL,
full_name VARCHAR(512) NOT NULL,
ipi VARCHAR(30),
isni VARCHAR(30),
ipn VARCHAR(30),
pro_affiliation VARCHAR(100),
contributor_type ENUM(
'Composer',
'Lyricist',
'ComposerLyricist',
'Producer',
'ExecutiveProducer',
'MixEngineer',
'MasteringEngineer',
'Remixer',
'Arranger',
'MusicPublisher',
'SubPublisher',
'Other'
) NOT NULL DEFAULT 'Composer',
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
INDEX idx_full_name (full_name(191)),
INDEX idx_ipi (ipi),
INDEX idx_party (party_id),
FOREIGN KEY (party_id) REFERENCES parties(party_id)
) ENGINE=InnoDB;


CREATE TABLE recording_contributors (
id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
track_id BIGINT UNSIGNED NOT NULL,
contributor_id BIGINT UNSIGNED NOT NULL,
contributor_role ENUM(
'Composer',
'Lyricist',
'ComposerLyricist',
'Producer',
'MixEngineer',
'MasteringEngineer',
'ExecutiveProducer',
'Remixer',
'Arranger',
'MusicPublisher',
'SubPublisher',
'Other'
)  NOT NULL,
royalty_type ENUM(
'Mechanical', -- composer / lyricist
'Performance', -- PRO collected
'Producer', -- producer points
'Sync',
'MasterShare',
'Other'
) NOT NULL DEFAULT 'Mechanical',
ownership_share DECIMAL(8,5), -- % of that royalty type e.g. 33.33333
sequence_num SMALLINT UNSIGNED DEFAULT 1,
UNIQUE KEY uq_sr_contrib (track_id, contributor_id, contributor_role),
FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
FOREIGN KEY (contributor_id) REFERENCES contributors(id)
) ENGINE=InnoDB;


CREATE TABLE publisher_shares (
id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
track_id BIGINT UNSIGNED NOT NULL,
publisher_id BIGINT UNSIGNED NOT NULL, -- FK to contributors
publisher_role ENUM(
'OriginalPublisher',
'SubPublisher',
'AdministratingPublisher',
'AcquisitionPublisher'
) NOT NULL DEFAULT 'OriginalPublisher',
share_percentage DECIMAL(8,5) NOT NULL, -- e.g. 50.00000
territory VARCHAR(10) DEFAULT 'Worldwide',
valid_from DATE,
valid_to DATE,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
INDEX idx_sr (track_id),
INDEX idx_pub (publisher_id),
FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
FOREIGN KEY (publisher_id) REFERENCES contributors(id)
) ENGINE=InnoDB;


