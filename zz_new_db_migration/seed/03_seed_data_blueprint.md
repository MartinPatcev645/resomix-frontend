# Seed Data Blueprint (High Fidelity)

This document provides the specific data rows for the database seeding process. It defines a complete ecosystem of 20 tracks, multiple releases, and user interactions to test the full functionality of the Resomix backend.

---

## 1. Identity & Governance

### Table: `parties`
| id | party_id | party_name | dpid | is_active |
|----|----------|------------|------|-----------|
| 1  | ARGO_01  | ArgoRhythm | DPID_ARGO_001 | 1 |

### Table: `labels`
| id | party_id | label_name | label_type |
|----|----------|------------|------------|
| 1  | ARGO_01  | Argo Deep  | RecordLabel |
| 2  | ARGO_01  | Argo Techno| RecordLabel |

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
| 1  | 1             | ARGO_01  | MSG_2026_001 | ERN | 4.3 |

### Table: `deals`
| id | party_id | message_id | deal_ref | commercial_model | is_perpetual |
|----|----------|------------|----------|------------------|--------------|
| 1  | ARGO_01  | MSG_2026_001 | DEAL_001 | PayAsYouGoModel  | 1 |

---

## 3. The Catalog (20 Tracks)

### Table: `contributors`
| id | party_id | full_name | isni |
|----|----------|-----------|------|
| 1  | ARGO_01  | Alpha Base| 0000000123456789 |
| 2  | ARGO_01  | Neon Pulse| 0000000987654321 |
| 3  | ARGO_01  | Dr. Synth | 0000000000000000 |
| 4  | ARGO_01  | Stellar   | 0000000111111111 |
| 5  | ARGO_01  | Orbit     | 0000000222222222 |

### Table: `releases`
| id | label_id | party_id | message_id | upc_ean | title | release_type |
|----|----------|----------|------------|---------|-------|--------------|
| 1  | 1        | ARGO_01  | MSG_2026_001 | 111111111111 | Deep Space | Album |
| 2  | 2        | ARGO_01  | MSG_2026_001 | 222222222222 | Techno Pulse | EP |
| 3  | 1        | ARGO_01  | MSG_2026_001 | 333333333333 | Neon Night | Single |

### Table: `tracks` (20 Rows)
| id | uuid | isrc | title | duration_ms | bpm | musical_key | mix_name | genre | price_cents |
|----|------|------|-------|-------------|-----|-------------|----------|-------|-------------|
| 1  | 550e8400-e29b-41d4-a716-446655440000 | US-AR1-26-00001 | Void Explorer | 300000 | 124 | Am | Original Mix | Techno | 99 |
| 2  | 550e8400-e29b-41d4-a716-446655440001 | US-AR1-26-00002 | Gravity Well | 240000 | 128 | C#m | Original Mix | Techno | 99 |
| 3  | 550e8400-e29b-41d4-a716-446655440002 | US-AR1-26-00003 | Event Horizon | 320000 | 122 | Dm | Extended Mix | Progressive | 99 |
| 4  | 550e8400-e29b-41d4-a716-446655440003 | US-AR1-26-00004 | Nebula Drift | 180000 | 110 | Fmaj | Original Mix | Ambient | 99 |
| 5  | 550e8400-e29b-41d4-a716-446655440004 | US-AR1-26-00005 | Pulsar Beats | 210000 | 126 | G | Club Mix | Electronic | 99 |
| 6  | 550e8400-e29b-41d4-a716-446655440005 | US-AR1-26-00006 | Solar Wind | 275000 | 125 | Am | Original Mix | Electronic | 99 |
| 7  | 550e8400-e29b-41d4-a716-446655440006 | US-AR1-26-00007 | Dark Matter | 310000 | 130 | Bm | Dub Mix | Techno | 99 |
| 8  | 550e8400-e29b-41d4-a716-446655440007 | US-AR1-26-00008 | Light Speed | 220000 | 132 | E | Original Mix | Electronic | 99 |
| 9  | 550e8400-e29b-41d4-a716-446655440008 | US-AR1-26-00009 | Asteroid Belt | 195000 | 128 | Cm | Original Mix | Electronic | 99 |
| 10 | 550e8400-e29b-41d4-a716-446655440009 | US-AR1-26-00010 | Galactic Core | 340000 | 124 | F# | Original Mix | Electronic | 99 |
| 11 | 550e8400-e29b-41d4-a716-446655440010 | US-AR1-26-00011 | Supernova | 290000 | 128 | Am | 2026 Remaster | Electronic | 99 |
| 12 | 550e8400-e29b-41d4-a716-446655440011 | US-AR1-26-00012 | Black Hole | 400000 | 120 | Em | Original Mix | Ambient | 99 |
| 13 | 550e8400-e29b-41d4-a716-446655440012 | US-AR1-26-00013 | Techno Heart | 360000 | 132 | C | Original Mix | Techno | 99 |
| 14 | 550e8400-e29b-41d4-a716-446655440013 | US-AR1-26-00014 | Digital Soul | 245000 | 126 | G# | Original Mix | Electronic | 99 |
| 15 | 550e8400-e29b-41d4-a716-446655440014 | US-AR1-26-00015 | Neon Pulse | 230000 | 122 | D | Radio Edit | Electronic | 99 |
| 16 | 550e8400-e29b-41d4-a716-446655440015 | US-AR1-26-00016 | Cyber Night | 215000 | 118 | B | Original Mix | Electronic | 99 |
| 17 | 550e8400-e29b-41d4-a716-446655440016 | US-AR1-26-00017 | Silicon Dreams | 190000 | 115 | F | Original Mix | Electronic | 99 |
| 18 | 550e8400-e29b-41d4-a716-446655440017 | US-AR1-26-00018 | Data Stream | 260000 | 128 | Am | Original Mix | Electronic | 99 |
| 19 | 550e8400-e29b-41d4-a716-446655440018 | US-AR1-26-00019 | Logic Gate | 255000 | 130 | Dm | Original Mix | Electronic | 99 |
| 20 | 550e8400-e29b-41d4-a716-446655440019 | US-AR1-26-00020 | End of Line | 300000 | 124 | C | Outro Mix | Electronic | 99 |

---

## 4. User Engagement & Playlists

### Table: `users`
| id | uuid | username | email | password_hash | name | is_email_verified |
|----|------|----------|-------|---------------|------|-------------------|
| 1  | f47ac10b-58cc-4372-a567-0e02b2c3d479 | admin | dj@argo.fm | (hashed) | DJ Argo (Admin) | 1 |
| 2  | f47ac10b-58cc-4372-a567-0e02b2c3d480 | listener_01 | listener@resomix.com | (hashed) | Music Lover | 1 |

### Table: `playlists`
| id | uuid | user_id | name | is_public | type |
|----|------|---------|------|-----------|------|
| 1  | a623405c-18df-4835-8666-4d22384a5142 | 1 | Ultimate Argo Collection | 1 | custom |

### Table: `playlist_tracks` (10 Tracks)
| playlist_id | track_id | position | score |
|-------------|----------|----------|-------|
| 1           | 1        | 1.0      | 0.95  |
| 1           | 2        | 2.0      | 0.90  |
| 1           | 3        | 3.0      | 0.85  |
| 1           | 5        | 4.0      | 0.80  |
| 1           | 7        | 5.0      | 0.75  |

---

## 5. Commerce & Transactions

### Table: `orders`
| id | user_id | subtotal_cents | total_cents | status |
|----|---------|----------------|-------------|--------|
| 1  | 2       | 297            | 297         | paid   |

### Table: `purchases`
| id | order_id | user_id | track_id | source_playlist_id | price_cents |
|----|----------|---------|----------|--------------------|-------------|
| 1  | 1        | 2       | 1        | 1                  | 99          |
| 2  | 1        | 2       | 2        | 1                  | 99          |
| 3  | 1        | 2       | 13       | 1                  | 99          |

---

## 6. Telemetry & Physical Assets

### Table: `audio_files`
| track_id | party_id | ingest_log_id | asset_class | stored_path | audio_codec |
|----------|----------|---------------|-------------|-------------|-------------|
| 1        | ARGO_01  | 1             | Master      | /argo/trk1/master.flac | FLAC |
| 1        | ARGO_01  | 1             | StreamingProfile | /argo/trk1/hls/index.m3u8 | AAC |

### Table: `consumption_events`
| event_category | track_id | user_id | duration_seconds | playback_context | event_timestamp |
|----------------|----------|---------|------------------|------------------|-----------------|
| stream_complete| 1        | 2       | 300              | playlist:1       | 2026-05-04 10:00:00 |
| stream_complete| 13       | 2       | 360              | home_search      | 2026-05-04 10:10:00 |
| stream_skip    | 2        | 2       | 15               | playlist:1       | 2026-05-04 10:20:00 |
