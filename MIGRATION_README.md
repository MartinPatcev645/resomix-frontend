# Track Type Migration Guide

## Overview

This migration adds a `type` column to the `tracks` table to distinguish between different track sources:
- `electrobuzz` (default) - Existing tracks from ElectroBuzz source
- `upload` - User-uploaded tracks
- Future types can be added as needed

## Migration Details

### Files Created:
- `database/migrations/002_add_track_type_column.sql` - Main migration
- `database/migrations/002_add_track_type_column_rollback.sql` - Rollback migration
- `app/models/constants.py` - Track type constants
- `run_migration.py` - Migration runner script

### Changes Made:
1. **Database Schema**: Added `type VARCHAR(50) NOT NULL DEFAULT 'electrobuzz'` column to `tracks` table
2. **Model Update**: Updated `Track` model in `app/models/track.py`
3. **Index Added**: Added `idx_track_type` index for efficient filtering
4. **Constants**: Created `TrackType` constants for consistent usage

## Running the Migration

### Option 1: Using the Migration Runner Script
```bash
python run_migration.py
```

### Option 2: Using the Migration Manager Directly
```python
from database.migration_manager import MigrationManager

manager = MigrationManager()
manager.run_migrations()
```

### Option 3: Manual SQL Execution
```sql
-- Run the migration SQL directly
source database/migrations/002_add_track_type_column.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check the table structure
DESCRIBE tracks;

-- Verify the type column exists with default value
SELECT COUNT(*) as electrobuzz_count FROM tracks WHERE type = 'electrobuzz';

-- Check the index was created
SHOW INDEXES FROM tracks WHERE Key_name = 'idx_track_type';
```

## Usage in Code

### Using Constants
```python
from app.models.constants import TrackType

# Create an uploaded track
track = Track(
    title="User Upload",
    type=TrackType.UPLOAD,
    # ... other fields
)

# Filter by track type
electrobuzz_tracks = session.query(Track).filter(Track.type == TrackType.ELECTROBUZZ).all()
upload_tracks = session.query(Track).filter(Track.type == TrackType.UPLOAD).all()
```

### Checking Track Types
```python
from app.models.constants import TrackType

# Validate track type
if TrackType.is_valid("upload"):
    print("Valid track type")

# Get all valid types
valid_types = TrackType.ALL_TYPES
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
source database/migrations/002_add_track_type_column_rollback.sql
```

**Warning**: Rollback will permanently delete the `type` column and all its data!

## Next Steps

After the migration:
1. Update your track creation logic to specify the appropriate type
2. Use `TrackType.UPLOAD` for user-uploaded tracks
3. Use `TrackType.ELECTROBUZZ` for existing ElectroBuzz tracks (or rely on default)
4. Consider adding validation in your API endpoints to ensure valid track types 