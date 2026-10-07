# Resomix API - Alwyzon Server

**Production Server**: `https://bserver.resomix.com` | **Docs**: `https://bserver.resomix.com/docs`

---

## Overview

FastAPI backend for music discovery through audio similarity analysis. Manages **2.3M+ tracks** in MariaDB with dual authentication (API key + JWT).

---

## Similarity Engine

Audio similarity is powered by an external microservice using:

- **MAEST** - Music Audio Efficient Spectrogram Transformer for audio embeddings
- **Discogs** - Effnet-based model trained on Discogs data

### Endpoints Used

| Endpoint                                           | Purpose                       |
| -------------------------------------------------- | ----------------------------- |
| `/similarity/query-by-upload/`                     | Similarity by file upload     |
| `/similarity/query-by-path/`                       | Similarity by file path       |
| `/generate_embedding_preview`                      | Pipeline embedding generation |
| `/open_tracks_pipeline/generate_embedding_preview` | Open tracks embedding         |

---

## Track Types

| Type          | Description                         |
| ------------- | ----------------------------------- |
| `electrobuzz` | Premium catalog tracks              |
| `upload`      | User-uploaded tracks                |
| `open`        | Open tracks from extraction scripts |

**Open Tracks Pipeline**: Uses scripts in `scripts/open_tracks/` to extract metadata, insert to DB, and generate embeddings via similarity server.

---

## Core Endpoints

### Audio Similarity

- `POST /get_similarity/` - Upload file → find similar tracks
- `POST /get_selection_similarity/` - Query by track ID → similar tracks

### Search & Discovery

- `GET /search_tracks/` - Full-text search
- `POST /metadata/` - Extract metadata from audio file

### Playlists

- `PUT /playlists/rename/` - Rename playlist
- `PUT /playlists/visibility/` - Toggle public/private
- `GET /playlists/similarity/{id}` - Get similarity playlist

### Preview

- `GET /preview/get_preview/` - Time-limited signed URL

### Pipeline

- `POST /monthly_pipeline/track/` - Process electrobuzz track
- `POST /open_tracks_pipeline/track/` - Process open track
- `POST /open_tracks_pipeline/update_embeddings/` - Bulk update embeddings

### Feedback & Contact

- `POST /feedback/` - Submit feedback
- `POST /feedback/contact/` - Submit contact form

---

## Authentication

```bash
# API Key (all protected endpoints)
curl "https://bserver.resomix.com/api/endpoint/?api_key=YOUR_KEY"

# JWT (authenticated users)
curl -H "Authorization: Bearer <JWT>" https://bserver.resomix.com/users/me
```

Health endpoints (`/`, `/health`) are public.

---

## Server Security

### NGINX Rate Limiting

**Config**: `/etc/nginx/conf.d/ratelimits_realip.conf`

| Zone         | Rate     | Purpose                       |
| ------------ | -------- | ----------------------------- |
| `api_rl`     | 3 r/s    | API/search endpoints          |
| `global_rl`  | 5 r/s    | Catch-all safety net          |
| `admin_rl`   | 10 r/min | Admin routes                  |
| `perip_conn` | 30 max   | Concurrent connections per IP |

**Features**:

- Cloudflare real IP restoration via `CF-Connecting-IP`
- CORS allowlist for resomix domains
- HTTPS redirect with Let's Encrypt SSL
- OWASP security headers (X-Frame-Options, HSTS, etc.)

### Fail2Ban

**Jails active**:

| Jail                | Threshold       | Ban Time | Purpose                  |
| ------------------- | --------------- | -------- | ------------------------ |
| `nginx-4xx-5xx`     | 40 hits / 2 min | 2 hours  | Block probing/scans      |
| `nginx-admin-abuse` | 6 hits / 5 min  | 12 hours | Block admin path probing |
| `nginx-404`         | 25 hits / 3 min | 3 hours  | Block 404 storms         |
| `recidive`          | 5 bans / 1 day  | 7 days   | Repeat offenders         |

```bash
# Check jail status
sudo fail2ban-client status nginx-404
sudo fail2ban-client status recidive
```

---

## Architecture

```
Router → Controller → Service → Repository → MariaDB
           ↓            ↓
       Validation    Business
       + Logging     Logic
```

**4-layer design**: Routers (HTTP), Controllers (thin handlers), Services (logic), Repositories (data access).

---

## Tech Stack

| Component  | Version |
| ---------- | ------- |
| Python     | 3.12    |
| FastAPI    | 0.109   |
| MariaDB    | 11.3+   |
| SQLAlchemy | 2.0     |
| FFmpeg     | Latest  |
| Mutagen    | 1.47    |

---

## Response Format

```json
{
  "success": true,
  "data": { ... }
}
```

```json
{
  "success": false,
  "error": "Error description"
}
```

---

**Resomix API v3.0.1** - Audio similarity and music discovery platform
