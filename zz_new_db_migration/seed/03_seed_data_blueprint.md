# Seed Data Blueprint (High Fidelity)

This document provides the specific data rows for Step 3 of the database seeding process. It defines a complete ecosystem of 20+ tracks, multiple releases, and user interactions to test the full functionality of the Resomix backend.

---

## 1. Identity & Governance

### Table: `parties`
| id | party_id | party_name | dpid | is_active |
|----|----------|------------|------|-----------|
| 1  | ARGO_01  | ArgoRhythm | DPID_ARGO_001 | 1 |

### Table: `labels`
| id | party_id | label_name | is_active |
|----|----------|------------|-----------|
| 1  | ARGO_01  | Argo Deep  | 1 |
| 2  | ARGO_01  | Argo Techno| 1 |

### Table: `genres`
| id | name | parent_id |
|----|------|-----------|
| 1  | Electronic | NULL |
| 2  | Progressive | 1 |
| 3  | Techno | 1 |
| 4  | Ambient | 1 |

---

## 2. Ingestion & Licensing Chain

### Table: `ingest_log`
| id | party_id | package_folder | status |
|----|----------|----------------|--------|
| 1  | ARGO_01  | /sftp/argo/batch_001 | COMPLETED |

### Table: `messages`
| id | ingest_log_id | party_id | message_id | message_type | ddex_version |
|----|---------------|----------|------------|--------------|--------------|
| 1  | 1             | ARGO_01  | MSG_2025_001 | ERN | 4.3 |

### Table: `deals`
| id | party_id | message_id | deal_ref | commercial_model | is_perpetual |
|----|----------|------------|----------|------------------|--------------|
| 1  | ARGO_01  | MSG_2025_001 | DEAL_001 | PayAsYouGoModel  | 1 |

---

## 3. The Catalog (20+ Tracks)

### Table: `contributors`
| id | party_id | full_name |
|----|----------|-----------|
| 1  | ARGO_01  | Alpha Base|
| 2  | ARGO_01  | Neon Pulse|
| 3  | ARGO_01  | Dr. Synth |
| 4  | ARGO_01  | Stellar   |
| 5  | ARGO_01  | Orbit     |

### Table: `releases`
| id | label_id | party_id | message_id | upc_ean | title | release_type |
|----|----------|----------|------------|---------|-------|--------------|
| 1  | 1        | ARGO_01  | MSG_2025_001 | 111111111111 | Deep Space | Album |
| 2  | 2        | ARGO_01  | MSG_2025_001 | 222222222222 | Techno Pulse | EP |
| 3  | 1        | ARGO_01  | MSG_2025_001 | 333333333333 | Neon Night | Single |

### Table: `tracks` (20 Rows)
| id | isrc | title | duration_ms | bpm | musical_key | mix_name |
|----|------|-------|-------------|-----|-------------|----------|
| 1  | US-AR1-25-00001 | Void Explorer | 300000 | 124 | Am | Original Mix |
| 2  | US-AR1-25-00002 | Gravity Well | 240000 | 128 | C#m | Original Mix |
| 3  | US-AR1-25-00003 | Event Horizon | 320000 | 122 | Dm | Extended Mix |
| 4  | US-AR1-25-00004 | Nebula Drift | 180000 | 110 | Fmaj | Original Mix |
| 5  | US-AR1-25-00005 | Pulsar Beats | 210000 | 126 | G | Club Mix |
| 6  | US-AR1-25-00006 | Solar Wind | 275000 | 125 | Am | Original Mix |
| 7  | US-AR1-25-00007 | Dark Matter | 310000 | 130 | Bm | Dub Mix |
| 8  | US-AR1-25-00008 | Light Speed | 220000 | 132 | E | Original Mix |
| 9  | US-AR1-25-00009 | Asteroid Belt | 195000 | 128 | Cm | Original Mix |
| 10 | US-AR1-25-00010 | Galactic Core | 340000 | 124 | F# | Original Mix |
| 11 | US-AR1-25-00011 | Supernova | 290000 | 128 | Am | 2025 Remaster |
| 12 | US-AR1-25-00012 | Black Hole | 400000 | 120 | Em | Original Mix |
| 13 | US-AR1-25-00013 | Techno Heart | 360000 | 132 | C | Original Mix |
| 14 | US-AR1-25-00014 | Digital Soul | 245000 | 126 | G# | Original Mix |
| 15 | US-AR1-25-00015 | Neon Pulse | 230000 | 122 | D | Radio Edit |
| 16 | US-AR1-25-00016 | Cyber Night | 215000 | 118 | B | Original Mix |
| 17 | US-AR1-25-00017 | Silicon Dreams | 190000 | 115 | F | Original Mix |
| 18 | US-AR1-25-00018 | Data Stream | 260000 | 128 | Am | Original Mix |
| 19 | US-AR1-25-00019 | Logic Gate | 255000 | 130 | Dm | Original Mix |
| 20 | US-AR1-25-00020 | End of Line | 300000 | 124 | C | Outro Mix |

### Table: `release_tracks` (Mapping Tracks 1-12 to Album, 13-16 to EP, 17 to Single)
- Release 1: Tracks 1 to 12 (Sequence 1-12)
- Release 2: Tracks 13 to 16 (Sequence 1-4)
- Release 3: Track 17 (Sequence 1)

---

## 4. User Engagement & Playlists

### Table: `users`
| id | email | full_name | is_admin |
|----|-------|-----------|----------|
| 1  | dj@argo.fm | DJ Argo (Admin) | 1 |
| 2  | listener@resomix.com | Music Lover | 0 |

### Table: `playlists`
| id | user_id | name | is_public | type |
|----|---------|------|-----------|------|
| 1  | 1       | Ultimate Argo Collection | 1 | admin |

### Table: `playlist_tracks` (10 Tracks)
| playlist_id | track_id | position | score |
|-------------|----------|----------|-------|
| 1           | 1        | 1        | 0.95  |
| 1           | 2        | 2        | 0.90  |
| 1           | 3        | 3        | 0.85  |
| 1           | 5        | 4        | 0.80  |
| 1           | 7        | 5        | 0.75  |
| 1           | 10       | 6        | 0.70  |
| 1           | 13       | 7        | 0.65  |
| 1           | 15       | 8        | 0.60  |
| 1           | 18       | 9        | 0.55  |
| 1           | 20       | 10       | 0.50  |

---

## 5. Commerce & Transactions

### Table: `orders`
| id | user_id | subtotal_cents | total_cents | status |
|----|---------|----------------|-------------|--------|
| 1  | 2       | 297            | 297         | paid   |

### Table: `purchases` (3 Tracks purchased from the admin playlist)
| id | order_id | user_id | track_id | source_playlist_id | price_cents |
|----|----------|---------|----------|--------------------|-------------|
| 1  | 1        | 2       | 1        | 1                  | 99          |
| 2  | 1        | 2       | 2        | 1                  | 99          |
| 3  | 1        | 2       | 13       | 1                  | 99          |

---

## 6. Telemetry & Physical Assets

### Table: `audio_files` (Example for Track 1)
| track_id | asset_class | stored_path | audio_codec |
|----------|-------------|-------------|-------------|
| 1        | Master      | /argo/trk1/master.flac | FLAC |
| 1        | StreamingProfile | /argo/trk1/hls/index.m3u8 | AAC |

### Table: `consumption_events`
| event_category | track_id | user_id | duration_seconds | playback_context |
|----------------|----------|---------|------------------|------------------|
| stream_complete| 1        | 2       | 300              | playlist:1       |
| stream_complete| 13       | 2       | 360              | home_search      |
| stream_skip    | 2        | 2       | 15               | playlist:1       |
