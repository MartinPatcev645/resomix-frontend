/*
Migration: Add Spotify App Management Tables
============================================

Adds tables for managing multiple Spotify apps and associating users with specific apps.
This allows handling more than 25 users by distributing them across multiple Spotify apps.

Version: 3.2.2
Date: 2025-11-14
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

/* Disable foreign key checks for table creation */
SET FOREIGN_KEY_CHECKS = 0;

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

/* Re-enable foreign key checks */
SET FOREIGN_KEY_CHECKS = 1;

