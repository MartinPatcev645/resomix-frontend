# Resomix Database Documentation

**Comprehensive database schema and operations guide for MariaDB 10.5+**

---

## 🗄️ Database Overview

### System Specifications
- **Database Engine**: MariaDB 10.5+ with InnoDB storage engine
- **Character Set**: utf8mb4 (full Unicode support)
- **Connection**: `mysql+aiomysql://` (async) / `mariadb+mariadbconnector://` (sync)
- **Connection Pooling**: SQLAlchemy with QueuePool (10 base connections, 20 overflow)
- **ORM**: SQLAlchemy 2.x with declarative base

### Production Configuration
- **Server**: `bserver.resomix.com`
- **Port**: 3306 (standard MySQL/MariaDB port)
- **SSL**: Configurable (disabled in development)
- **Timezone**: UTC (enforced at connection level)

---

## 📊 Database Schema

### Core Data Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Artists     │    │     Labels      │    │     Genres      │
│  (100+ names)   │    │  (120+ names)   │    │  (80+ names)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Tracks                                │
│              (2.2M+ records - Core Entity)                     │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────────────┐   │
│  │   UUID  │  Title  │  Year   │  BPM    │   Musical Key   │   │
│  │Duration │ Paths   │  Size   │  Type   │   Created At    │   │
│  └─────────┴─────────┴─────────┴─────────┴─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│ Track_Artists   │                          │   Playlists     │
│ (M:M Junction)  │                          │ (Custom/Similar)│
└─────────────────┘                          └─────────────────┘
```

---

## 🏗️ Table Structures

### 1. Core Music Tables

#### **tracks** (Primary Entity)
```sql
CREATE TABLE tracks (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,              -- Public identifier
    album_id      INT UNSIGNED,                             -- FK to albums
    label_id      INT UNSIGNED,                             -- FK to labels  
    genre_id      INT UNSIGNED,                             -- FK to genres
    title         VARCHAR(255) NOT NULL,                    -- Track title
    year          YEAR,                                     -- Release year
    duration_sec  INT UNSIGNED,                             -- Duration in seconds
    bpm           SMALLINT UNSIGNED,                        -- Beats per minute
    musical_key   VARCHAR(5),                               -- Musical key (e.g., "C#m")
    file_path     VARCHAR(500) NOT NULL,                    -- Original file path
    preview_path  VARCHAR(500),                             -- Preview file path
    file_size     BIGINT UNSIGNED,                          -- File size in bytes
    type          VARCHAR(50) DEFAULT 'electrobuzz',        -- Track source type
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    KEY idx_track_title  (title),
    KEY idx_track_bpm    (bpm),
    KEY idx_track_key    (musical_key),
    KEY idx_track_type   (type)
);
```

#### **artists** (Catalog Table)
```sql
CREATE TABLE artists (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
```

#### **track_artists** (Many-to-Many Junction)
```sql
CREATE TABLE track_artists (
    track_id  BIGINT UNSIGNED NOT NULL,
    artist_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (track_id, artist_id),
    FOREIGN KEY (track_id)  REFERENCES tracks(id)  ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
```

### 2. Playlist System

#### **playlists**
```sql
CREATE TABLE playlists (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid          VARCHAR(36) NOT NULL UNIQUE,
    user_id       CHAR(36),                                 -- Supabase UUID
    name          VARCHAR(100) NOT NULL,
    is_public     TINYINT(1) DEFAULT 0,
    type          ENUM('custom','similarity','waiting_segments') DEFAULT 'custom',
    seed_track_id BIGINT UNSIGNED,                          -- For similarity playlists
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### **playlist_tracks** (Ordered Track Lists)
```sql
CREATE TABLE playlist_tracks (
    playlist_id BIGINT UNSIGNED NOT NULL,
    track_id    BIGINT UNSIGNED NOT NULL,
    position    INT UNSIGNED NOT NULL,                     -- Track order
    score       DECIMAL(10, 8) NULL,                       -- Similarity score
    PRIMARY KEY (playlist_id, track_id)
);
```

### 3. User Engagement

#### **feedback** (User Satisfaction)
```sql
CREATE TABLE feedback (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        CHAR(36),                               -- Optional user ID
    category       VARCHAR(50),                            -- Feedback category
    message        TEXT,                                   -- User message
    satisfaction   INT UNSIGNED,                           -- Rating 1-10
    recommendation INT UNSIGNED,                           -- Rating 1-10
    status         ENUM('open','resolved') DEFAULT 'open',
    submitted_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### **contact** (Support Requests)
```sql
CREATE TABLE contact (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      CHAR(36),
    name         VARCHAR(100),
    email        VARCHAR(100),
    subject      VARCHAR(150),
    phone        VARCHAR(20),
    message      TEXT,
    status       ENUM('open','resolved') DEFAULT 'open',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. System Tables

#### **logs** (Activity Tracking)
```sql
CREATE TABLE logs (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    CHAR(36),
    track_id   BIGINT UNSIGNED,
    action     VARCHAR(50) NOT NULL,
    message    VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔗 Relationships & Foreign Keys

### Primary Relationships
1. **Track → Artist**: Many-to-many via `track_artists`
2. **Track → Album**: Many-to-one (nullable)
3. **Track → Label**: Many-to-one (nullable)
4. **Track → Genre**: Many-to-one (nullable)
5. **Playlist → Track**: Many-to-many via `playlist_tracks`
6. **Playlist → User**: Many-to-one (nullable for anonymous)

### Cascade Behaviors
- **DELETE CASCADE**: `track_artists`, `playlist_tracks`
- **SET NULL**: `tracks.album_id`, `tracks.label_id`, `tracks.genre_id`
- **RESTRICT**: `purchases` (prevents deletion of purchased content)

---

## 🚀 Common Database Operations

### Basic Queries

#### Find tracks by artist
```sql
SELECT t.title, t.year, t.bpm, t.musical_key
FROM tracks t
JOIN track_artists ta ON t.id = ta.track_id
JOIN artists a ON ta.artist_id = a.id
WHERE a.name LIKE '%artist_name%'
ORDER BY t.created_at DESC
LIMIT 20;
```

#### Search tracks with metadata
```sql
SELECT 
    t.uuid,
    t.title,
    t.year,
    t.duration_sec,
    t.bpm,
    t.musical_key,
    l.name as label,
    g.name as genre,
    GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as artists
FROM tracks t
LEFT JOIN labels l ON t.label_id = l.id
LEFT JOIN genres g ON t.genre_id = g.id
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
WHERE t.title LIKE '%search_term%'
   OR a.name LIKE '%search_term%'
   OR l.name LIKE '%search_term%'
GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, t.bpm, t.musical_key, l.name, g.name
ORDER BY t.created_at DESC;
```

#### Get playlist with tracks
```sql
SELECT 
    p.name as playlist_name,
    p.type,
    pt.position,
    pt.score,
    t.title,
    t.year,
    GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as artists
FROM playlists p
JOIN playlist_tracks pt ON p.id = pt.playlist_id
JOIN tracks t ON pt.track_id = t.id
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
WHERE p.uuid = 'playlist_uuid_here'
GROUP BY p.name, p.type, pt.position, pt.score, t.title, t.year
ORDER BY pt.position;
```

### Advanced Analytics

#### Track statistics by genre
```sql
SELECT 
    g.name as genre,
    COUNT(t.id) as track_count,
    AVG(t.duration_sec) as avg_duration,
    AVG(t.bpm) as avg_bpm,
    MIN(t.year) as earliest_year,
    MAX(t.year) as latest_year
FROM genres g
LEFT JOIN tracks t ON g.id = t.genre_id
GROUP BY g.id, g.name
HAVING track_count > 0
ORDER BY track_count DESC;
```

#### Most active labels
```sql
SELECT 
    l.name as label,
    COUNT(t.id) as track_count,
    COUNT(DISTINCT ta.artist_id) as unique_artists,
    MAX(t.created_at) as last_upload
FROM labels l
JOIN tracks t ON l.id = t.label_id
LEFT JOIN track_artists ta ON t.id = ta.track_id
GROUP BY l.id, l.name
ORDER BY track_count DESC
LIMIT 10;
```

---

## ⚡ Performance Optimization

### Indexes Strategy

#### Existing Indexes
```sql
-- Primary indexes (automatically created)
PRIMARY KEY (id) ON ALL TABLES

-- Track performance indexes
KEY idx_track_title (title)         -- Text search
KEY idx_track_bpm (bpm)             -- BPM filtering  
KEY idx_track_key (musical_key)     -- Key filtering
KEY idx_track_type (type)           -- Source filtering
KEY idx_track_album (album_id)      -- Album relationships
KEY idx_track_label (label_id)      -- Label relationships
KEY idx_track_genre (genre_id)      -- Genre relationships

-- UUID lookups
UNIQUE KEY uuid (uuid) ON tracks, playlists

-- User activity indexes
KEY idx_playlist_user (user_id) ON playlists
KEY idx_fb_user (user_id) ON feedback
KEY idx_contact_user (user_id) ON contact
```

#### Recommended Additional Indexes
```sql
-- For advanced text search (if needed)
ALTER TABLE tracks ADD FULLTEXT(title);
ALTER TABLE artists ADD FULLTEXT(name);

-- For time-based queries
ALTER TABLE tracks ADD KEY idx_created_at (created_at);
ALTER TABLE feedback ADD KEY idx_submitted_at (submitted_at);

-- For popularity tracking
ALTER TABLE playlist_tracks ADD KEY idx_track_popularity (track_id);
```

### Query Optimization Tips

1. **Use EXPLAIN** to analyze query performance:
```sql
EXPLAIN SELECT * FROM tracks WHERE title LIKE '%keyword%';
```

2. **Limit large result sets**:
```sql
SELECT * FROM tracks ORDER BY created_at DESC LIMIT 100;
```

3. **Use covering indexes** for frequently accessed columns:
```sql
-- Covers common track metadata queries
ALTER TABLE tracks ADD KEY idx_track_meta (title, year, bpm, musical_key);
```

---

## 🛠️ Database Maintenance

### Health Monitoring

#### Connection status
```sql
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Connections';
SHOW STATUS LIKE 'Threads_connected';
```

#### Table statistics
```sql
SELECT 
    table_name,
    table_rows,
    ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb,
    ROUND(index_length / 1024 / 1024, 2) as index_size_mb
FROM information_schema.tables 
WHERE table_schema = 'resomix_db'
ORDER BY (data_length + index_length) DESC;
```

#### Database size
```sql
SELECT 
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_size_mb,
    ROUND(SUM(data_length) / 1024 / 1024, 2) as data_size_mb,
    ROUND(SUM(index_length) / 1024 / 1024, 2) as index_size_mb
FROM information_schema.tables 
WHERE table_schema = 'resomix_db';
```

### Regular Maintenance Tasks

#### Optimize tables (monthly)
```sql
OPTIMIZE TABLE tracks, artists, playlists, feedback, contact;
```

#### Analyze tables (weekly)
```sql
ANALYZE TABLE tracks, artists, playlists, feedback, contact;
```

#### Clean old logs (daily)
```sql
DELETE FROM logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Backup Operations

#### Create backup
```bash
# Full database backup
mysqldump -h bserver.resomix.com -u username -p \
  --single-transaction \
  --routines \
  --triggers \
  resomix_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Structure only backup
mysqldump -h bserver.resomix.com -u username -p \
  --no-data \
  resomix_db > schema_backup.sql

# Specific table backup
mysqldump -h bserver.resomix.com -u username -p \
  resomix_db tracks > tracks_backup.sql
```

#### Restore from backup
```bash
# Restore full database
mysql -h bserver.resomix.com -u username -p resomix_db < backup_file.sql

# Restore specific table
mysql -h bserver.resomix.com -u username -p resomix_db < tracks_backup.sql
```

---

## 🔒 Security & Best Practices

### Connection Security
- **SSL/TLS**: Enabled in production
- **User Privileges**: Principle of least privilege
- **Connection Limits**: Configured per user
- **Password Policy**: Strong passwords enforced

### Data Protection
- **Backup Encryption**: Automated encrypted backups
- **User Data**: Minimal PII storage (delegated to Supabase)
- **Audit Logs**: Activity tracking in `logs` table
- **Data Retention**: Configurable cleanup policies

### Performance Guidelines
1. **Connection Pooling**: 10 base + 20 overflow connections
2. **Query Timeout**: 30 seconds read/write timeout
3. **Pool Recycling**: 1-hour connection lifecycle
4. **Pre-ping**: Validates connections before use

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor
- **Connection Pool**: Active/idle connections
- **Query Performance**: Slow query log analysis
- **Disk Usage**: Database size growth
- **Replication Lag**: If using replication
- **Error Rates**: Failed queries and connections

### Health Check Endpoints
The application provides database health information via:
- **API Health Check**: `GET /health` (basic connectivity)
- **Database Utils**: Comprehensive health reporting
- **Metrics Export**: Table counts, performance stats

---

## 🔄 Migration Management

### Schema Evolution
- **Version Control**: SQL migrations in `database/migrations/`
- **Rollback Support**: Paired up/down migration files
- **Environment Safety**: Separate staging/production workflows

### Migration Commands
```bash
# Apply pending migrations
python database/migration_manager.py apply

# Create new migration
python database/migration_manager.py create "add_new_feature"

# Rollback last migration  
python database/migration_manager.py rollback
```

---

## 🎯 Data Insights

### Current Scale (Production)
- **Tracks**: 2.2+ million records
- **Artists**: 100,000+ unique artists
- **Playlists**: Thousands of similarity-generated playlists
- **Daily Growth**: Hundreds of new tracks via monthly pipeline

### Performance Benchmarks
- **Simple Queries**: < 10ms response time
- **Complex Joins**: < 100ms for typical similarity queries
- **Full-text Search**: < 500ms for comprehensive searches
- **Bulk Operations**: Optimized for batch insertions

---

**Resomix Database v3.0.1** - High-performance music metadata storage with MariaDB 10.5+
