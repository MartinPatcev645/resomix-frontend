/*
Database Schema
===============

MariaDB schema definitions for the Resomix Digital Service Provider (DSP).
Synthesized Version: B2B + B2C Combined (Final Architectural Implementation)
Init Date: April 2026
*/

/* ===========================================================
   Resomix – Application DB  (MariaDB 10.5+ / InnoDB)
   Internal primary keys: INT + BIGINT UNSIGNED.
   Public/external user id: users.uuid (CHAR(36)) unique.
   =========================================================== */


-- ─────────────────────────────────────────────────────────────
-- TIER 0: INFRASTRUCTURE & TENANCY
-- Core infrastructure for multi-tenant isolation.
-- ─────────────────────────────────────────────────────────────

-- Top-level tenant identity. id=1 = public sandbox tenant.
CREATE TABLE IF NOT EXISTS partners (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    partner_uuid    CHAR(36)     NOT NULL UNIQUE         COMMENT 'Public UUID exposed in API responses',
    legal_name      VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL UNIQUE,
    vat_number      VARCHAR(64)  DEFAULT NULL            COMMENT 'EU VAT number; validated via VIES (W4-4)',
    country_code    CHAR(2)      DEFAULT NULL            COMMENT 'ISO 3166-1 alpha-2',
    tier            ENUM('sandbox','starter','growth','enterprise')
                    NOT NULL DEFAULT 'sandbox'           COMMENT 'Drives quota limits and feature flags',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    onboarded_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT         DEFAULT NULL,
    INDEX idx_partner_uuid (partner_uuid),
    INDEX idx_partner_tier (tier, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: public sandbox tenant
INSERT IGNORE INTO partners
    (partner_uuid, legal_name, display_name, contact_email, tier)
VALUES
    ('00000000-0000-0000-0000-000000000000',
     'Resomix Sandbox', 'Sandbox', 'sandbox@resomix.com', 'sandbox');


-- 53. PARTNER API KEYS
-- Hashed API keys. Plaintext NEVER stored.
-- Formats: rmx_live_<urlsafe_32> / rmx_sandbox_<urlsafe_32>
CREATE TABLE IF NOT EXISTS partner_api_keys (
    id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    partner_id          INT UNSIGNED    NOT NULL,
    key_prefix          VARCHAR(16)     NOT NULL                    COMMENT 'Short prefix safe to display (e.g. rmx_live_abc1)',
    key_hash            CHAR(64)        NOT NULL UNIQUE             COMMENT 'SHA-256 hex digest of the full API key',
    label               VARCHAR(100)    DEFAULT NULL                COMMENT 'Human label: Production / Sandbox / Dev',
    scopes              JSON            NOT NULL                    COMMENT '["search:read","ingest:write"]',
    rate_limit_rps      INT UNSIGNED    NOT NULL DEFAULT 10         COMMENT 'Token-bucket burst limit req/sec (W1-7)',
    rate_limit_monthly  INT UNSIGNED    NOT NULL DEFAULT 100000     COMMENT 'Rolling-30-day request cap (W1-8)',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,
    last_used_at        DATETIME        DEFAULT NULL,
    last_used_ip        VARCHAR(45)     DEFAULT NULL,
    expires_at          DATETIME        DEFAULT NULL,
    revoked_at          DATETIME        DEFAULT NULL,
    revoked_reason      VARCHAR(255)    DEFAULT NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
    INDEX idx_apikey_hash   (key_hash),
    INDEX idx_apikey_active (is_active, partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 54. PARTNER QUOTAS
-- Rolling-30-day quota tracking. Incremented atomically via Redis (W1-8),
-- flushed to this table every 5 minutes.
CREATE TABLE IF NOT EXISTS partner_quotas (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    partner_id      INT UNSIGNED    NOT NULL,
    api_key_id      INT UNSIGNED    DEFAULT NULL                    COMMENT 'NULL = aggregate across all keys',
    period_start    DATE            NOT NULL,
    period_end      DATE            NOT NULL,
    requests_made   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    quota_limit     BIGINT UNSIGNED NOT NULL,
    is_overage      TINYINT(1)      NOT NULL DEFAULT 0,
    last_synced_at  DATETIME        DEFAULT NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id)          ON DELETE RESTRICT,
    FOREIGN KEY (api_key_id) REFERENCES partner_api_keys(id)  ON DELETE CASCADE,
    UNIQUE KEY uk_quota_period (partner_id, api_key_id, period_start),
    INDEX idx_quota_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 55. PARTNER USAGE LOG
-- Per-request audit trail written by the audit-log middleware (W2-1).
-- Partitioned by created_at for hot-partition management.
CREATE TABLE IF NOT EXISTS partner_usage_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correlation_id  CHAR(36)        DEFAULT NULL,
    partner_id      INT UNSIGNED    NOT NULL,
    api_key_id      INT UNSIGNED    NOT NULL,
    endpoint        VARCHAR(255)    NOT NULL,
    method          VARCHAR(10)     DEFAULT NULL,
    status_code     SMALLINT UNSIGNED DEFAULT NULL,
    latency_ms      DECIMAL(10,3)   DEFAULT NULL,
    request_bytes   INT UNSIGNED    DEFAULT NULL,
    response_bytes  INT UNSIGNED    DEFAULT NULL,
    client_ip       VARCHAR(45)     DEFAULT NULL,
    user_agent      VARCHAR(500)    DEFAULT NULL,
    error_code      VARCHAR(64)     DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id)  REFERENCES partners(id)         ON DELETE RESTRICT,
    FOREIGN KEY (api_key_id)  REFERENCES partner_api_keys(id) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_usage_partner_time (partner_id, created_at),
    INDEX idx_usage_endpoint     (endpoint, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 55a. ADMIN OPERATION LOGS
-- Comprehensive audit trail for all administrative operations (RBAC Part 1).
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_user_id   INT UNSIGNED NOT NULL,
    action          VARCHAR(100) NOT NULL           COMMENT 'e.g. feedback.resolve, user.role.assign, partner.api_key.revoke',
    target_type     VARCHAR(50)  NOT NULL           COMMENT 'e.g. user, partner, feedback, role',
    target_id       VARCHAR(100) NOT NULL           COMMENT 'UUID or internal ID of target resource',
    before_state    JSON         DEFAULT NULL       COMMENT 'Snapshot before mutation',
    after_state     JSON         DEFAULT NULL       COMMENT 'Snapshot after mutation',
    ip_address      VARCHAR(45)  DEFAULT NULL,
    user_agent      VARCHAR(500) DEFAULT NULL,
    correlation_id  CHAR(36)     DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_admin_op_admin (admin_user_id),
    INDEX idx_admin_op_time  (created_at),
    INDEX idx_admin_op_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 56. PARTNER WEBHOOKS
-- Webhook subscription configuration per partner.
CREATE TABLE IF NOT EXISTS partner_webhooks (
    id                          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    partner_id                  INT UNSIGNED    NOT NULL,
    url                         VARCHAR(500)    NOT NULL,
    secret_hash                 CHAR(64)        NOT NULL                COMMENT 'SHA-256 of signing secret for HMAC (W4-1)',
    events                      JSON            NOT NULL,
    is_active                   TINYINT(1)      NOT NULL DEFAULT 1,
    last_delivery_at            DATETIME        DEFAULT NULL,
    last_delivery_status_code   SMALLINT        DEFAULT NULL,
    consecutive_failures        INT UNSIGNED    NOT NULL DEFAULT 0,
    created_at                  DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
    INDEX idx_webhook_partner_active (partner_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 57. WEBHOOK DELIVERY LOG
-- Individual delivery attempt written by the Celery dispatcher (W4-1).
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correlation_id      CHAR(36)        DEFAULT NULL,
    webhook_id          INT UNSIGNED    NOT NULL,
    partner_id          INT UNSIGNED    NOT NULL,
    event_type          VARCHAR(64)     NOT NULL,
    payload             JSON            NOT NULL,
    attempt_number      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    response_status     SMALLINT        DEFAULT NULL,
    response_latency_ms INT UNSIGNED    DEFAULT NULL,
    error_message       TEXT            DEFAULT NULL,
    delivered_at        DATETIME        DEFAULT NULL,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id)  REFERENCES partner_webhooks(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id)  REFERENCES partners(id)         ON DELETE RESTRICT,
    INDEX idx_delivery_partner_event (partner_id, event_type, created_at),
    INDEX idx_delivery_status        (response_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TIER 1: INDEPENDENT CORE TABLES
-- Tables with no foreign key dependencies or only self-references.
-- ─────────────────────────────────────────────────────────────

-- 1. USERS
-- Core user accounts and authentication state.
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                   CHAR(36) NOT NULL UNIQUE,          -- public id
    username               VARCHAR(50)  NOT NULL UNIQUE,
    email                  VARCHAR(100) NOT NULL UNIQUE,
    password_hash          VARCHAR(255) NOT NULL,             -- salted hash (argon2/bcrypt)
    name                   VARCHAR(100),
    profile_picture        VARCHAR(255),
    language               VARCHAR(10),
    timezone               VARCHAR(50),
    is_active              TINYINT(1)   NOT NULL DEFAULT 1,
    is_email_verified      TINYINT(1)   DEFAULT 0,
    is_two_factor_enabled  TINYINT(1) DEFAULT 0,
    two_factor_method      ENUM('email','app') DEFAULT 'email',
    stripe_customer_id     VARCHAR(255) UNIQUE COMMENT 'External Stripe billing mapping',
    partner_id             INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_users_email (email),
    KEY idx_users_partner (partner_id),
    KEY idx_users_username (username),
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. ROLES
-- RBAC Roles (e.g., Admin, Label, Artist, User).
CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. PERMISSIONS
-- Fine-grained RBAC permissions (e.g., 'upload_track', 'view_reports').
CREATE TABLE IF NOT EXISTS permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. GENRES
-- Music genres with support for hierarchical (parent/child) relationships.
CREATE TABLE IF NOT EXISTS genres (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    parent_id INT UNSIGNED DEFAULT NULL,
    UNIQUE KEY uk_genre_name (name),
    CONSTRAINT fk_genre_parent FOREIGN KEY (parent_id) REFERENCES genres(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. OPERATION TYPES
-- Definitions for rate-limited actions (e.g., 'track_download', 'api_call').
CREATE TABLE IF NOT EXISTS operation_types (
    id          TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. USER OPERATION LIMITS
-- Per-user rate limits and usage tracking for specific operations.
CREATE TABLE IF NOT EXISTS user_operation_limits (
    user_id INT UNSIGNED NOT NULL,
    operation_id   TINYINT UNSIGNED NOT NULL,
    limit_value    INT UNSIGNED NOT NULL,
    window_seconds INT UNSIGNED DEFAULT NULL,
    usage_count    INT UNSIGNED NOT NULL DEFAULT 0,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, operation_id),
    FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operation_types(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 7. SPOTIFY APPS
-- Configurations for external Spotify API integrations.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 8. USER SPOTIFY APPS
-- Junction linking users to their authorized Spotify applications.
CREATE TABLE IF NOT EXISTS user_spotify_apps (
    user_id INT UNSIGNED NOT NULL,
    spotify_app_id  INT UNSIGNED NOT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (spotify_app_id) REFERENCES spotify_apps(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)     REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 9. PARTIES
-- Legal entities, distributors, or aggregators providing content (DDEX PartyId).
CREATE TABLE parties (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL UNIQUE,   -- SFTP folder name / DDEX PartyId
  party_name      VARCHAR(255)  NOT NULL,
  dpid            VARCHAR(100),                    -- DDEX Party ID (DPID)
  email           VARCHAR(255),
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  partner_id      INT UNSIGNED  NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_party_id (party_id),
  INDEX idx_party_partner (partner_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- ─────────────────────────────────────────────────────────────
-- TIER 2: FIRST-LEVEL DEPENDENCIES
-- Tables that depend directly on Tier 1 (Users, Roles, Parties).
-- ─────────────────────────────────────────────────────────────

-- 10. USER TOKENS
-- Unified storage for email verification, password resets, and 2FA codes.
CREATE TABLE IF NOT EXISTS user_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token VARCHAR(255) NOT NULL,
    token_type ENUM('email_verification', 'password_reset', '2fa') NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_token (user_id, token_type),
    INDEX idx_token_lookup (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 11. USER SESSIONS
-- Active login sessions and refresh tokens for stateful authentication.
CREATE TABLE IF NOT EXISTS user_sessions (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 12. USER ROLES
-- Junction mapping users to their assigned RBAC roles.
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by INT UNSIGNED DEFAULT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)  ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 13. ROLE PERMISSIONS
-- Junction mapping roles to their permitted actions.
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 14. INGEST LOG
-- Audit trail for every DDEX package or batch upload received.
CREATE TABLE ingest_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL,
  package_folder  VARCHAR(512)  NOT NULL,          -- relative SFTP path
  message_id      VARCHAR(255),                    -- DDEX MessageId
  ddex_version    VARCHAR(20),                     -- e.g. "4.3"
  status          ENUM('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  file_count      INT UNSIGNED  DEFAULT 0,
  batch_filename  VARCHAR(255),
  track_count     INT UNSIGNED  DEFAULT 0,
  started_at      DATETIME,
  completed_at    DATETIME,
  partner_id      INT UNSIGNED  NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party_folder (party_id, package_folder(255)),
  INDEX idx_status       (status),
  INDEX idx_ingest_partner (partner_id),
  FOREIGN KEY (party_id) REFERENCES parties(party_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 15. LABELS
-- Record labels or publishers owned by a specific Party.
CREATE TABLE labels (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id        VARCHAR(100)  NOT NULL,
  dpid            VARCHAR(100),
  label_name      VARCHAR(512)  NOT NULL,
  label_type      ENUM('RecordLabel','MusicPublisher','OriginalPublisher','SubPublisher','Other')
                  DEFAULT 'RecordLabel',
  partner_id      INT UNSIGNED  NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_label_name (label_name(191)),
  INDEX idx_label_partner (partner_id),
  FOREIGN KEY (party_id) REFERENCES parties(party_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 16. CONTRIBUTORS
-- Master identity table for all artists, composers, and publishers.
CREATE TABLE contributors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id         VARCHAR(100)  NOT NULL,          -- owning distributor
  full_name        VARCHAR(512)  NOT NULL,
  -- Identity / rights IDs
  isni             VARCHAR(30)   NOT NULL DEFAULT '', -- ISNI (artists)
  ipi              VARCHAR(30)   NOT NULL DEFAULT '', -- IPI  (composers/publishers)
  ipn              VARCHAR(30)   NOT NULL DEFAULT '', -- IPN  (DDEX)
  dpid             VARCHAR(100),                      -- DDEX Party ID
  -- PRO affiliation (composers/lyricists)
  pro_affiliation  VARCHAR(100),                    -- ASCAP, BMI, SESAC, PRS…
  -- Optional artist-facing metadata
  artist_name      VARCHAR(512),                    -- stage name if different
  partner_id       INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,
  -- A person is unique per distributor + full name + IPI/ISNI combination
  UNIQUE KEY uq_person (party_id, full_name, ipi, isni),
  INDEX idx_full_name  (full_name(191)),
  INDEX idx_ipi        (ipi),
  INDEX idx_isni       (isni),
  INDEX idx_party      (party_id),
  INDEX idx_contributor_partner (partner_id),
  FOREIGN KEY (party_id) REFERENCES parties(party_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;







-- ─────────────────────────────────────────────────────────────
-- TIER 3: THE MUSIC CORE
-- The primary entities of the DSP ecosystem (Tracks, Releases, Files).
-- ─────────────────────────────────────────────────────────────

-- 17. MESSAGES
-- DDEX ERN MessageHeader metadata for tracking ingestion sources.
CREATE TABLE messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party_id  (party_id),
  INDEX idx_message_partner (partner_id),
  FOREIGN KEY (ingest_log_id) REFERENCES ingest_logs(id),
  FOREIGN KEY (party_id)      REFERENCES parties(party_id),
  FOREIGN KEY (partner_id)    REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 18. DEALS
-- Commercial terms and licensing logic from DDEX DealList.
CREATE TABLE deals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_party     (party_id),
  INDEX idx_message   (message_id),
  INDEX idx_deal_partner (partner_id),
  FOREIGN KEY (party_id)   REFERENCES parties(party_id),
  FOREIGN KEY (message_id) REFERENCES messages(message_id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 19. TRACKS
-- The "Metaphysical" sound recording (ISRC) and its musical metadata.
CREATE TABLE tracks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                VARCHAR(36) NOT NULL UNIQUE,
    user_id             INT UNSIGNED,                  -- Uploader
    party_id            VARCHAR(100),
    resource_ref        VARCHAR(100),
    proprietary_id      VARCHAR(100),
    isrc                VARCHAR(30) NOT NULL,          -- ISRC (recording ID)
    title               VARCHAR(1024) NOT NULL,
    version_title       VARCHAR(512),
    display_artist      VARCHAR(512),
    partner_id          INT UNSIGNED NOT NULL DEFAULT 1, -- Multi-tenant isolation (W1-4)
    duration_ms         INT UNSIGNED,                  -- Duration in milliseconds
    bpm                 SMALLINT UNSIGNED,
    musical_key         VARCHAR(10),
    key_signature       VARCHAR(10),
    audio_language      CHAR(2) DEFAULT 'xx',          -- DDEX LanguageCode
    language_of_lyrics  VARCHAR(10),
    genre               VARCHAR(255),
    sub_genre           VARCHAR(255),
    price_cents         INT UNSIGNED DEFAULT 99,       -- Default 99 cents
    mix_name            VARCHAR(150) DEFAULT 'Original Mix',
    type                VARCHAR(50) DEFAULT 'electrobuzz',

    -- Rights & Licensing
    p_line_year         YEAR,
    p_line_text         VARCHAR(512),
    deal_terms          JSON,
    parental_warning    ENUM('NoAdviceAvailable','NotExplicit','Explicit','ExplicitContentEdited')
                        DEFAULT 'NotExplicit',
    is_explicit         TINYINT(1) DEFAULT 0,
    is_instrumental     TINYINT(1) DEFAULT 0,

    -- Status & Ingestion
    is_active           TINYINT(1) DEFAULT 1,
    ingestion_source    ENUM('ddex','cc_by','user_upload','csv') DEFAULT 'user_upload',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,


    KEY idx_track_title  (title),
    KEY idx_track_bpm    (bpm),
    KEY idx_track_key    (musical_key),
    KEY idx_track_active (is_active),
    KEY idx_track_source (ingestion_source),
    KEY idx_isrc         (isrc),
    KEY idx_party        (party_id),

    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (party_id)   REFERENCES parties(party_id),
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- 20. RELEASES
-- Commercial product containers (Albums, Singles, EPs) identified by UPC/EAN.
CREATE TABLE releases (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    label_id                INT UNSIGNED,
    party_id                VARCHAR(100) NOT NULL,
    message_id              VARCHAR(255) NOT NULL,
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
    partner_id              INT UNSIGNED NOT NULL DEFAULT 1, -- Multi-tenant isolation (W1-4)
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
    cover_image             VARCHAR(255),
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,


    KEY idx_release_label    (label_id),
    KEY idx_release_catalog  (catalog_number),
    KEY idx_release_active   (is_active),
    KEY idx_icpn             (icpn),
    KEY idx_party            (party_id),
    KEY idx_message          (message_id),


    CONSTRAINT fk_release_label 
        FOREIGN KEY (label_id)  REFERENCES labels(id) ON DELETE SET NULL,

    CONSTRAINT fk_release_party 
        FOREIGN KEY (party_id)  REFERENCES parties(party_id),

    CONSTRAINT fk_release_message 
        FOREIGN KEY (message_id) REFERENCES messages(message_id),

    CONSTRAINT fk_release_partner
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- 21a. AUDIO FILES (Strictly for streaming/download assets)
CREATE TABLE audio_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)    NOT NULL,
  ingest_log_id       BIGINT UNSIGNED NOT NULL,
  track_id INT UNSIGNED NOT NULL,
  asset_class         ENUM('Master', 'StreamingProfile', 'Ephemeral') NOT NULL DEFAULT 'Master',
  expires_at          DATETIME NULL COMMENT 'For TTL cleanup of Ephemeral assets',
  
  -- Storage location
  original_filename   VARCHAR(512)    NOT NULL,       -- filename as received from label
  stored_path         VARCHAR(1024)   NOT NULL,       -- absolute path on our storage
  mime_type           VARCHAR(100),                   -- mime type of the file
  
  -- Size & Integrity
  file_size_bytes     BIGINT UNSIGNED,
  checksum_md5        VARCHAR(64),
  checksum_sha256     VARCHAR(128),
  
  -- Audio Specifications
  duration_seconds    INT UNSIGNED,
  audio_codec         VARCHAR(50),                 -- e.g., FLAC, MP3
  sample_rate         INT UNSIGNED,                -- e.g., 44100, 48000
  bit_depth           SMALLINT UNSIGNED,           -- e.g., 16, 24
  channels            TINYINT UNSIGNED,            -- e.g., 1, 2
  bitrate_kbps        SMALLINT UNSIGNED,           -- e.g., 1411, 320
  ddex_resource_ref   VARCHAR(100),
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audio_track (track_id),
  INDEX idx_audio_expires (expires_at),
  INDEX idx_audio_partner (partner_id),
  UNIQUE KEY uq_audio_path (stored_path(512)),
  FOREIGN KEY (party_id)      REFERENCES parties(party_id),
  FOREIGN KEY (ingest_log_id) REFERENCES ingest_logs(id),
  FOREIGN KEY (track_id)      REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id)    REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21b. IMAGE FILES (Strictly for artwork and profiles)
CREATE TABLE image_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)    NOT NULL,
  ingest_log_id       BIGINT UNSIGNED NOT NULL,
  
  -- Storage location
  original_filename   VARCHAR(512)    NOT NULL,
  stored_path         VARCHAR(1024)   NOT NULL,
  mime_type           VARCHAR(100),
  
  -- Size & Integrity
  file_size_bytes     BIGINT UNSIGNED,
  checksum_md5        VARCHAR(64),
  checksum_sha256     VARCHAR(128),
  
  -- Image Specifications
  image_width         INT UNSIGNED,
  image_height        INT UNSIGNED,
  color_depth         TINYINT UNSIGNED,
  image_codec         VARCHAR(50),
  
  -- DDEX Traceability
  ddex_resource_ref   VARCHAR(100),
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_image_path (stored_path(512)),
  INDEX idx_image_partner (partner_id),
  FOREIGN KEY (party_id)      REFERENCES parties(party_id),
  FOREIGN KEY (ingest_log_id) REFERENCES ingest_logs(id),
  FOREIGN KEY (partner_id)    REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21c. DOCUMENT FILES (Strictly for DDEX XMLs, PDFs, Lyrics, etc.)
CREATE TABLE document_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id            VARCHAR(100)    NOT NULL,
  ingest_log_id       BIGINT UNSIGNED NOT NULL,
  track_id INT UNSIGNED,             -- Optional: Link to a specific track (lyrics/midi)
  
  -- Storage location
  original_filename   VARCHAR(512)    NOT NULL,
  stored_path         VARCHAR(1024)   NOT NULL,
  mime_type           VARCHAR(100),                -- e.g., text/xml, application/pdf
  
  -- Size & Integrity
  file_size_bytes     BIGINT UNSIGNED,
  checksum_md5        VARCHAR(64),
  checksum_sha256     VARCHAR(128),
  
  -- DDEX Traceability
  ddex_resource_ref   VARCHAR(100),
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doc_track (track_id),
  INDEX idx_doc_partner (partner_id),
  UNIQUE KEY uq_doc_path (stored_path(512)),
  FOREIGN KEY (party_id)      REFERENCES parties(party_id),
  FOREIGN KEY (ingest_log_id) REFERENCES ingest_logs(id),
  FOREIGN KEY (track_id)      REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (partner_id)    REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






-- ─────────────────────────────────────────────────────────────
-- TIER 4: JUNCTIONS & RELATIONSHIPS
-- Tables mapping the complex relationships between Music and Business.
-- ─────────────────────────────────────────────────────────────

-- 22. TRACK CONTRIBUTORS
-- Royalty splits and credits (MainArtist, Producer, Composer, etc.).

CREATE TABLE track_contributors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  track_id INT UNSIGNED NOT NULL,
  person_id           INT UNSIGNED NOT NULL,
  role                ENUM(
    -- Performing / artist roles
    'MainArtist',
    'FeaturedArtist',
    'Remixer',
    'Conductor',
    'Orchestra',
    'Soloist',
    -- Songwriting / composition roles  (mechanical royalties)
    'Composer',
    'Lyricist',
    'ComposerLyricist',
    'Arranger',
    -- Production / technical roles  (producer royalties)
    'Producer',
    'ExecutiveProducer',
    'MixEngineer',
    'MasteringEngineer',
    'RecordingEngineer',
    -- Publishing roles
    'MusicPublisher',
    'SubPublisher',
    'AdministratingPublisher',
    -- Other
    'Other'
  ) NOT NULL,
  -- Royalty split for this role on this track
  royalty_type        ENUM(
    'MasterRights',       -- label / rights controller
    'NeighboringRights',  -- performing artist
    'Mechanical',         -- composer / lyricist
    'Performance',        -- PRO collected
    'Producer',           -- producer points
    'Sync',
    'Other'
  ) NOT NULL,
  ownership_share     DECIMAL(8,5),                 -- % e.g. 33.33333
  sequence_num        SMALLINT UNSIGNED DEFAULT 1,  -- display order
  -- Prevent same person having same role twice on same track
  UNIQUE KEY uq_participant (track_id, person_id, role),
  INDEX idx_recording  (track_id),
  INDEX idx_person     (person_id),
  INDEX idx_role       (role),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id)          REFERENCES contributors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 22.a RELEASES CONTRIBUTORS
-- Junction mapping releases to contributors with role and sequence information.
CREATE TABLE release_contributors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id          INT UNSIGNED NOT NULL,
  person_id           INT UNSIGNED NOT NULL,
  role                ENUM('MainArtist', 'FeaturedArtist', 'Producer', 'Other') NOT NULL DEFAULT 'MainArtist',
  sequence_num        SMALLINT UNSIGNED DEFAULT 1,
  UNIQUE KEY uq_rel_participant (release_id, person_id, role),
  FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES contributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 23. RELEASE FILES
-- Junction mapping assets (Covers, Booklets) to specific Releases.
CREATE TABLE release_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id   INT UNSIGNED NOT NULL,
  image_file_id INT UNSIGNED NOT NULL,          -- Changed from file_id to image_file_id
  file_role    ENUM(
    'FrontCoverImage', 'BackCoverImage', 'BookletFront',
    'BookletBack', 'Poster', 'ArtistPhoto', 'Tray', 'Liner', 'Other'
  ) NOT NULL DEFAULT 'FrontCoverImage',
  sequence_num SMALLINT UNSIGNED DEFAULT 1,
  
  UNIQUE KEY uq_release_file_role (release_id, image_file_id, file_role),
  FOREIGN KEY (release_id)   REFERENCES releases(id) ON DELETE CASCADE,
  FOREIGN KEY (image_file_id) REFERENCES image_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 24. RELEASE TRACKS
-- Junction mapping tracks to releases with position and disc metadata.
CREATE TABLE release_tracks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id          INT UNSIGNED NOT NULL,
  track_id INT UNSIGNED NOT NULL,

  -- Position metadata is per-appearance, not per-recording
  -- (Track 3 on the album, but Track 1 on the single release)
  track_number        SMALLINT UNSIGNED,
  disc_number         SMALLINT UNSIGNED DEFAULT 1,
  sequence_num        SMALLINT UNSIGNED,          -- overall sequence across discs

  -- The same recording can appear under a different title context
  -- e.g. "Echoes in the Dark (Album Version)" vs "Echoes in the Dark"
  display_title_override VARCHAR(512),            -- NULL = use tracks.title

  -- Why this recording is on this release
  release_context     ENUM(
    'Original',        -- first release this recording appeared on
    'Single',          -- released as a single
    'Album',           -- part of an album
    'Compilation',     -- appears on a greatest hits / compilation
    'Deluxe',          -- bonus track on deluxe edition
    'Remaster',        -- remastered version of the same ISRC
    'BonusTrack',
    'HiddenTrack',
    'Other'
  ) DEFAULT 'Original',

  is_bonus_track      TINYINT(1) DEFAULT 0,
  is_hidden_track     TINYINT(1) DEFAULT 0,

  -- Each appearance can have its own deal reference
  -- (compilation may have different licensing than album)
  deal_id INT UNSIGNED NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Same recording cannot appear twice on the same release
  -- (same disc + track number slot)
  UNIQUE KEY uq_release_recording   (release_id, track_id),
  UNIQUE KEY uq_release_track_slot  (release_id, disc_number, track_number),

  INDEX idx_release    (release_id),
  INDEX idx_recording  (track_id),

  FOREIGN KEY (release_id)         REFERENCES releases(id)         ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (deal_id)            REFERENCES deals(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 25. RELEASE DEALS
-- Mapping specific deals to releases.
CREATE TABLE release_deals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  release_id  INT UNSIGNED NOT NULL,
  deal_id INT UNSIGNED NOT NULL,
  partner_id  INT UNSIGNED NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  UNIQUE KEY uq_rel_deal (release_id, deal_id),
  INDEX idx_rel_deal_partner (partner_id),
  FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
  FOREIGN KEY (deal_id)    REFERENCES deals(id)    ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 26. DEAL TERRITORIES
-- Geographic restrictions or permissions for a specific deal.
CREATE TABLE deal_territories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id INT UNSIGNED NOT NULL,
  territory   VARCHAR(10)     NOT NULL,           -- ISO 3166-1 alpha-2 or 'Worldwide'
  is_excluded TINYINT(1)      DEFAULT 0,          -- TerritoryCode vs ExcludedTerritoryCode
  partner_id  INT UNSIGNED    NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  INDEX idx_deal (deal_id),
  INDEX idx_territory_partner (partner_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 27. DEAL USE TYPES
-- Permitted usage models (Stream, Download, etc.) for a deal.
CREATE TABLE deal_use_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id INT UNSIGNED NOT NULL,
  use_type    VARCHAR(100)    NOT NULL,           -- OnDemandStream, PermanentDownload …
  partner_id  INT UNSIGNED    NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  INDEX idx_deal (deal_id),
  INDEX idx_use_type_partner (partner_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 28. ROYALTY RATES
-- Detailed financial terms (Fixed, RevenueShare, etc.) for deals.
CREATE TABLE royalty_rates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id INT UNSIGNED NOT NULL,
  rate_type           ENUM('FixedRate','RevenueShare','PerStream',
                           'PerDownload','MinGuarantee','Other')
                      NOT NULL DEFAULT 'RevenueShare',
  rate_value          DECIMAL(12,6)   NOT NULL,   -- % or $ depending on rate_type
  currency            VARCHAR(3)      DEFAULT 'USD',
  tier                VARCHAR(100),               -- optional tier / tier label
  effective_from      DATE,
  effective_to        DATE,
  partner_id          INT UNSIGNED    NOT NULL DEFAULT 1  COMMENT 'Multi-tenant isolation (W1-4)',
  INDEX idx_deal (deal_id),
  INDEX idx_royalty_partner (partner_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






-- ─────────────────────────────────────────────────────────────
-- TIER 5: USER ECOSYSTEM & EXTENDED SERVICES
-- User-facing features, engagement, billing, and system telemetry.
-- ─────────────────────────────────────────────────────────────

-- 29. PLAYLISTS
-- User-created or system-generated track collections.
CREATE TABLE IF NOT EXISTS playlists (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    user_id INT UNSIGNED,
    name          VARCHAR(150) NOT NULL,
    is_public     TINYINT(1) DEFAULT 0,
    type          ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id INT UNSIGNED,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 30. PLAYLIST TRACKS
-- Junction mapping tracks to playlists with ordering and scoring.
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INT UNSIGNED NOT NULL,
    track_id INT UNSIGNED NOT NULL,
    position    DECIMAL(12,6) NOT NULL,
    score       DECIMAL(10, 8) NULL,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE RESTRICT,
    KEY idx_pt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 31. USER TRACK ENGAGEMENTS
-- Tracking favorites and follows at the track level.
CREATE TABLE IF NOT EXISTS user_track_engagements (
    user_id INT UNSIGNED NOT NULL,
    track_id INT UNSIGNED NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 31.5 PROMO CODES
-- Discount codes applicable to carts and orders.
CREATE TABLE IF NOT EXISTS promo_codes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code                  VARCHAR(50) UNIQUE NOT NULL,
    discount_type         ENUM('percentage', 'fixed_amount') NOT NULL,
    discount_value        INT UNSIGNED NOT NULL,
    max_uses              INT UNSIGNED,
    uses_count            INT UNSIGNED DEFAULT 0,
    expires_at            DATETIME,
    is_active             TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 31.6 ORDERS
-- Immutable financial ledger of user checkouts.
CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    stripe_session_id VARCHAR(255) UNIQUE,
    promo_code_id INT UNSIGNED,
    subtotal_cents INT UNSIGNED NOT NULL,
    discount_cents INT UNSIGNED DEFAULT 0,
    total_cents INT UNSIGNED NOT NULL,
    status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 32. PURCHASES
-- Historical record of track and release transactions.
CREATE TABLE IF NOT EXISTS purchases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    order_id INT UNSIGNED NOT NULL,
    track_id INT UNSIGNED,
    release_id   INT UNSIGNED,
    source_playlist_id INT UNSIGNED,
    price_cents  INT UNSIGNED NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE RESTRICT,
    FOREIGN KEY (source_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 33. CARTS
-- Shopping cart state for pending transactions.
CREATE TABLE IF NOT EXISTS carts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    promo_code_id INT UNSIGNED DEFAULT NULL,
    status        ENUM('active', 'pending_checkout', 'completed', 'abandoned') DEFAULT 'active',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE SET NULL,
    INDEX idx_cart_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 34. SYSTEM LOGS
-- Comprehensive application audit trail for debugging and security.
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
    track_id INT UNSIGNED,
    playlist_id INT UNSIGNED,
    release_id      INT UNSIGNED,
    contributor_id INT UNSIGNED,
    log_metadata    JSON DEFAULT NULL,
    stack_trace     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    FOREIGN KEY (release_id)  REFERENCES releases(id)  ON DELETE SET NULL,
    FOREIGN KEY (contributor_id) REFERENCES contributors(id) ON DELETE SET NULL,
    INDEX idx_syslog_created (created_at),
    INDEX idx_syslog_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 35. USER AUTH PROVIDERS
-- External OAuth mappings (Google, Spotify, etc.) for Social Login.
CREATE TABLE IF NOT EXISTS user_auth_providers (
    user_id INT UNSIGNED NOT NULL,
    provider      VARCHAR(50) NOT NULL,
    provider_uid  VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, provider),
    UNIQUE KEY uk_provider_uid (provider, provider_uid),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 36. PLAYLIST TRANSFER TRACKS
-- Cross-platform mapping (Spotify/Apple ID) for playlist migration.
CREATE TABLE IF NOT EXISTS playlist_transfer_tracks (
    track_id INT UNSIGNED NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 37. USER PLAYLIST ENGAGEMENTS
-- Tracking favorites and follows at the playlist level.
CREATE TABLE IF NOT EXISTS user_playlist_engagements (
    user_id INT UNSIGNED NOT NULL,
    playlist_id INT UNSIGNED NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 38. TRACK RATINGS
-- User-submitted 1-5 star ratings for tracks.
CREATE TABLE IF NOT EXISTS track_ratings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    track_id INT UNSIGNED NOT NULL,
    playlist_id INT UNSIGNED NULL,
    rating       TINYINT UNSIGNED,
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id)    REFERENCES tracks(id)     ON DELETE RESTRICT,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 39. PLAYLIST RATINGS
-- User-submitted ratings and reviews for playlists.
CREATE TABLE IF NOT EXISTS playlist_ratings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    playlist_id INT UNSIGNED NOT NULL,
    rating       TINYINT UNSIGNED,
    message      TEXT NULL,
    rated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 40. WAITLIST
-- Early access signup tracking for prospective users.
CREATE TABLE IF NOT EXISTS waitlists (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email     VARCHAR(255) NOT NULL UNIQUE,
    status    ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- 41. USER SUBSCRIPTIONS
-- Integration mapping for recurring Stripe subscriptions.
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id INT UNSIGNED PRIMARY KEY,
    stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- 42. CART ITEMS
-- Individual items inside an active user cart.
CREATE TABLE IF NOT EXISTS cart_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id INT UNSIGNED NOT NULL,
    track_id INT UNSIGNED NOT NULL,
    release_id   INT UNSIGNED NULL,                -- Grouping tag for "Complete My Album"
    source_playlist_id INT UNSIGNED NULL,
    price_cents  INT UNSIGNED NOT NULL,
    added_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id)    REFERENCES carts(id)      ON DELETE CASCADE,
    FOREIGN KEY (track_id)   REFERENCES tracks(id)     ON DELETE RESTRICT,
    FOREIGN KEY (release_id) REFERENCES releases(id)   ON DELETE SET NULL,
    FOREIGN KEY (source_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
    INDEX idx_cart_release (release_id),
    UNIQUE KEY uk_cart_track (cart_id, track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- 43. FEEDBACK
-- User-submitted application feedback and satisfaction scores.
CREATE TABLE IF NOT EXISTS feedbacks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    category      VARCHAR(50),
    message       TEXT,
    satisfaction  INT UNSIGNED,
    recommendation INT UNSIGNED,
    status        ENUM('open','resolved') DEFAULT 'open',
    partner_id    INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedback_partner (partner_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 44. CONTACT
-- General inquiry and support contact submissions.
CREATE TABLE IF NOT EXISTS contacts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    name        VARCHAR(100),
    email       VARCHAR(100),
    subject     VARCHAR(150),
    phone       VARCHAR(20),
    message     TEXT,
    status      ENUM('open','resolved') DEFAULT 'open',
    partner_id  INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contact_partner (partner_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- 45. SFTP USERS
-- Virtual users for B2B partners to upload content via SFTP.
-- Extended W2-4: provisioning columns for automated SFTPGo user creation.
CREATE TABLE IF NOT EXISTS sftp_users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    -- Legacy label FK — nullable for direct B2B partner accounts (W2-4)
    label_id        INT UNSIGNED          DEFAULT NULL COMMENT 'Legacy label FK; NULL for B2B partner SFTP accounts',
    partner_id      INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    username        VARCHAR(255) NOT NULL UNIQUE,
    -- bcrypt hash; NULL when use_public_key=TRUE and no password is configured
    password_hash   VARCHAR(255)          DEFAULT NULL COMMENT 'bcrypt hash; nullable for public-key-only accounts',
    home_directory  VARCHAR(500) NOT NULL COMMENT 'Legacy home dir; prefer sftp_home_dir for provisioned accounts',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    user_id         INT UNSIGNED          DEFAULT NULL COMMENT 'Link to platform user (RBAC Part 1)',
    -- W2-4 Provisioning fields ------------------------------------------------
    public_key      TEXT                  DEFAULT NULL COMMENT 'OpenSSH public key for key-based SFTP auth',
    use_public_key  TINYINT(1)   NOT NULL DEFAULT 0   COMMENT 'Return public key list to SFTPGo auth hook when 1',
    allowed_ip      VARCHAR(255)          DEFAULT NULL COMMENT 'Comma-separated IP/CIDR whitelist for SFTPGo filters',
    sftp_home_dir   VARCHAR(500)          DEFAULT NULL COMMENT 'SFTPGo chroot path, e.g. /srv/sftp/partners/42',
    sftp_provisioned_at DATETIME          DEFAULT NULL COMMENT 'When Hetzner SFTPGo provisioning succeeded; NULL = pending',
    -- -------------------------------------------------------------------------
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (label_id)   REFERENCES labels(id)    ON DELETE RESTRICT,
    FOREIGN KEY (partner_id) REFERENCES partners(id)  ON DELETE RESTRICT,
    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE SET NULL,
    -- Compound index for provisioning service queries (get_by_partner_id, get_unprovisioned)
    INDEX idx_sftp_partner_active (partner_id, is_active),
    INDEX idx_sftp_user_active    (username, is_active),
    INDEX idx_sftp_user_id        (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- 46. INGESTION ERRORS
-- Detailed failure logs for specific DDEX nodes during processing.
CREATE TABLE IF NOT EXISTS ingestion_errors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ingest_log_id BIGINT UNSIGNED NOT NULL,
    partner_id    INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    error_code    VARCHAR(50) NOT NULL,
    error_severity ENUM('warning', 'critical') DEFAULT 'critical',
    reference_node VARCHAR(255) COMMENT 'E.g., <ReleaseId> or specific ISRC string',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingest_log_id) REFERENCES ingest_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
    INDEX idx_ie_severity (error_severity),
    INDEX idx_ie_partner (partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 47. MANUAL TAKEDOWNS
-- Admin-driven content removal records for compliance or DMCA.
CREATE TABLE IF NOT EXISTS manual_takedowns (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    track_id INT UNSIGNED NOT NULL,
    admin_user_id INT UNSIGNED NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
    INDEX idx_mt_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 48. CONSUMPTION EVENTS
-- High-frequency telemetry for DSRF reporting and fraud analysis.
CREATE TABLE IF NOT EXISTS consumption_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_category ENUM('stream_start', 'stream_complete', 'stream_skip', 'download_success') NOT NULL,
    track_id INT UNSIGNED,
    isrc VARCHAR(15) COMMENT 'Denormalized heavily for rapid DSRF generation indexing',
    label_id INT UNSIGNED,
    user_id INT UNSIGNED,
    country_code CHAR(2) COMMENT 'Geolocated user state from start IP',
    client_ip VARCHAR(45) COMMENT 'Hashed or raw IP for fraud analysis',
    playback_context VARCHAR(50) COMMENT 'e.g., search, playlist, artist_profile',
    source_device ENUM('web', 'ios', 'android', 'desktop', 'other') DEFAULT 'web',
    partner_id    INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Multi-tenant isolation (W1-4)',
    session_id CHAR(36) COMMENT 'Cryptographic session. Identifies and deduplicates bot-farms.',
    duration_seconds INT UNSIGNED NOT NULL,
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agg_label (label_id, event_category, event_timestamp),
    INDEX idx_agg_isrc (isrc, event_category, event_timestamp),
    INDEX idx_ce_session (session_id),
    INDEX idx_ce_partner (partner_id),
    INDEX idx_dsrf_report (label_id, event_timestamp, isrc, country_code, event_category),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 49. GENERATED REPORTS
-- Metadata for monthly label royalty and usage reports.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 50. LABEL PAYOUTS
-- Tracking disbursement status and transaction IDs for label revenue.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 51. ACR INFRINGEMENT LOGS
-- Automated Content Recognition match results for copyright protection.
CREATE TABLE IF NOT EXISTS acr_infringement_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    attempted_filename VARCHAR(255),
    matched_title VARCHAR(255) COMMENT 'The copyrighted song title ACR matched against',
    matched_artists VARCHAR(255),
    acr_score DECIMAL(5,2),
    status ENUM('blocked', 'disputed', 'cleared') DEFAULT 'blocked',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_acr_status (status),
    INDEX idx_acr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 6: B2B PARTNER / MULTI-TENANCY LAYER  (W1-1 — 35-Day Roadmap v3.0)
-- Additive tables — no existing tables modified.
-- ─────────────────────────────────────────────────────────────────────────────
