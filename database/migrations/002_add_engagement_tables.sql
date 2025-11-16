/*
Migration: Add Engagement Tables
=================================

Adds user engagement tables for favorites and follows functionality
for both playlists and tracks.

Version: 3.2.1
Date: 2025-10-25
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

/* Disable foreign key checks for table creation */
SET FOREIGN_KEY_CHECKS = 0;

/* ---------- 4.7 Playlist and Track Favorites and Follows ---------- */

/* ===========================================================
   Engagements: favorites & follows (playlists, tracks)
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

/* ---------- Add num_tracks and play_time columns to playlists table ---------- */

ALTER TABLE playlists
ADD COLUMN num_tracks INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'number of tracks in playlist_tracks' AFTER fork_count,
ADD COLUMN play_time INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'total play time in seconds (sum of track durations)' AFTER num_tracks;

CREATE TABLE operation_types (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_operation_limits (
    user_id BIGINT UNSIGNED NOT NULL,
    operation_id TINYINT UNSIGNED NOT NULL,
    limit_value INT UNSIGNED NOT NULL,
    window_seconds INT UNSIGNED DEFAULT NULL,
    usage INT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, operation_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operation_types(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_uol_operation (operation_id),
    KEY idx_uol_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO operation_types (code, description)
VALUES ('playlist_create', 'Maximum playlists the user can create');

/* Re-enable foreign key checks */
SET FOREIGN_KEY_CHECKS = 1;
