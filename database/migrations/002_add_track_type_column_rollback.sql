/*
Migration Rollback: 002_add_track_type_column
=============================================

Rollback migration to remove the track type column.
This migration removes the 'type' column from the tracks table
and reverts the database to the previous state.

Version: 3.0.1
Created: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

-- Remove the type column index first
ALTER TABLE tracks DROP INDEX idx_track_type;

-- Remove the type column from tracks table
ALTER TABLE tracks DROP COLUMN type;

-- Remove this migration from tracking table
DELETE FROM schema_migrations WHERE version = '002_add_track_type_column';
