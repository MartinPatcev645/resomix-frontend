/*
Migration: Add consumption_events table
========================================

Creates the consumption_events table for DSRF-compliant stream telemetry tracking.
This table stores all playback events (stream_start, stream_complete, stream_skip,
download_success) for royalty reporting and analytics.

Version: 3.3.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

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
