/*
Migration: Add Spotify App Management Tables
============================================

Adds tables for managing multiple Spotify apps and associating users with specific apps.
This allows handling more than 25 users by distributing them across multiple Spotify apps.

Version: 3.2.3
Date: 2026-03-05
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

/* Disable foreign key checks for table creation */
SET FOREIGN_KEY_CHECKS = 0;

/* ---------- 10. Spotify App Management ---------------------------- */

-- Add user_id to tracks table for tracking upload ownership
ALTER TABLE tracks
ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER genre_id;

-- Add foreign key reference to users table
ALTER TABLE tracks
ADD CONSTRAINT fk_tracks_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for fast user track lookups
CREATE INDEX idx_track_user ON tracks(user_id);

/* Re-enable foreign key checks */
SET FOREIGN_KEY_CHECKS = 1;

