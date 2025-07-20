-- Migration: Add Tidal support to playlist_transfer_tracks table
-- This migration adds the tidal_id column and index to support Tidal playlist transfers
-- Date: June 11, 2025

-- Add tidal_id column to playlist_transfer_tracks table
ALTER TABLE playlist_transfer_tracks 
ADD COLUMN tidal_id VARCHAR(100) NULL 
COMMENT 'Tidal track ID';

-- Add index for tidal_id column
ALTER TABLE playlist_transfer_tracks 
ADD KEY idx_ptt_tidal (tidal_id);
