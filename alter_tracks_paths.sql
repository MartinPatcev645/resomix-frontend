-- Alter tracks table to increase path column lengths
-- This allows for longer file paths which are common in nested directory structures

ALTER TABLE tracks 
MODIFY COLUMN file_path VARCHAR(500) NOT NULL COMMENT 'Path to the original audio file',
MODIFY COLUMN preview_path VARCHAR(500) COMMENT 'Path to the preview/sample audio file';

-- Verify the changes
DESCRIBE tracks; 