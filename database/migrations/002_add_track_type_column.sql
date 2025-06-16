/*
Migration: 002_add_track_type_column
====================================

Add track type column to distinguish between different track sources.
This migration adds a 'type' column to the tracks table with default value 'electrobuzz'
for existing tracks and support for 'upload' type for user-uploaded tracks.

Version: 3.0.1
Created: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

-- Insert this migration record
INSERT IGNORE INTO schema_migrations (version, description, checksum) 
VALUES ('002_add_track_type_column', 'Add track type column to distinguish between different track sources', 'b2c3d4e5f6g7');

-- Add the type column to tracks table with comment
ALTER TABLE tracks 
ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'electrobuzz' 
COMMENT 'Track source type: electrobuzz, upload, etc.'
AFTER file_size;

-- Add index for efficient filtering by type
ALTER TABLE tracks 
ADD INDEX idx_track_type (type);

-- Update existing tracks to have 'electrobuzz' type (redundant but explicit)
UPDATE tracks SET type = 'electrobuzz' WHERE type = 'electrobuzz';
