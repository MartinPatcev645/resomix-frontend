# Resomix Server Architecture & Workflow Diagram

This document provides a comprehensive technical overview and visual workflow diagram of the three primary servers in the Resomix ecosystem: **Alwyzon ("The Brain")**, **Hetzner ("The Muscle")**, and the **GPU Server ("Embedding Generation")**.

---

## 1. Core Server Communications

The three servers coordinate to isolate metadata orchestration, physical file handling, and deep learning feature extraction:

*   **Alwyzon $\leftrightarrow$ Hetzner (Gateway & Processing)**: Alwyzon acts as the secure, transactional controller. It validates client credentials and queries. When a search or ingestion task is triggered, Alwyzon calls Hetzner's internal endpoints via NGINX. Similarly, Hetzner's SFTPGo calls back to Alwyzon's NGINX to validate B2B uploads credentials and notify completed uploads.
*   **Hetzner $\leftrightarrow$ GPU Server (Compute & Feature Extraction)**: During ingestion pipelines, the Hetzner compute engine streams the raw audio file to the GPU server via NGINX. The GPU server processes it and sends high-dimensional float vector embeddings back to Hetzner to be saved and merged into the FAISS indexes.
*   **Alwyzon $\leftrightarrow$ GPU Server (Fully Decoupled)**: No direct communication. The Alwyzon "Brain" is completely decoupled from heavy AI model weights, allowing it to focus entirely on fast database access and user session transactions.

---

## 2. Key Similarity Request Workflows

### Scenario A: Scoped B2B Partner Similarity Search
1.  **Request Ingress**: B2B Partner calls `POST /api/v1/similarity/search` passing their Bearer API Key (`rmx_...`) and a track ID.
2.  **API Gate & Quota Checks**: Alwyzon's NGINX passes the request to FastAPI, which triggers the Auth Service. The system validates the key, permission scopes (`similarity:read`) in MariaDB, and checks Redis to verify they are under their API quota and rate limits.
3.  **Hetzner Delegation**: Alwyzon delegates the similarity search to Hetzner by calling `POST /similarity/query-by-uuid`, sending the target track ID and the partner's unique `partner_id`.
4.  **Sandbox Search**: Hetzner's FastAPI loads/accesses only the partner's local catalog JSON file and queries their *isolated* FAISS sandbox HNSW index in memory. 
5.  **Secure Output**: The nearest neighbors matched *strictly inside their own catalog* are calculated and returned to Alwyzon, which formats the JSON response as `{"data": [...]}` and delivers it back to the B2B Partner.

### Scenario B: Similarity Search from a Frontend End-User
1.  **Request Ingress**: An end-user on `resomix-web` (Frontend App) triggers similarity search (e.g., clicking on a track in a public playlist) calling `GET /api/v1/playlists/similarity/{playlist_id}`.
2.  **User Authentication**: The Alwyzon gateway validates the request using the user's JWT access token in the headers.
3.  **Global Catalog Similarity**: Since frontend users search across the global catalog, Alwyzon calls Hetzner requesting matches from the **Global Open FAISS Index** (which is indexed under the public catalog `partner_id = 0` / default sandbox tenant).
4.  **HLS Playback Stream**: Hetzner's HNSW vector search returns global similar track UUIDs. Alwyzon converts these into a temporary similarity playlist, saves it, and renders an HLS playlist index manifest (`.m3u8`).
5.  **Signed Media Playback**: The Frontend App fetches the `.m3u8` playlist index and requests secure `.ts` stream segments directly from Hetzner's NGINX (using signed, Fernet-encrypted short-lived tokens), providing high-speed, secure audio streaming to the end-user.

---

## 3. System Components & Servers Overview

### A. Alwyzon Server ("The Brain")
*   **Role**: Handles orchestration, metadata cataloging, search indexes, user sessions, partner keys lifecycle, and B2B API gateway queries.
*   **Core Systems**:
    *   **NGINX**: Acts as the primary ingress proxy, enforcing global rate limits (`api_rl`, `global_rl`, `admin_rl`), managing Let's Encrypt SSL, and mitigating automated scans with Fail2Ban.
    *   **FastAPI**: Serves public, admin, and partner-restricted REST routes.
    *   **Auth Service**: Centralized access gate processing B2B Bearer keys (`rmx_<tier>_...`), user JWT tokens, and verifying SFTP credentials.
    *   **MariaDB**: Stores relational data for over 2.3M+ track metadata profiles, partner accounts, subscription levels, and transactional ingestion queues.
    *   **Redis**: Caches API quotas, rate-limiting counters, and partner-isolated idempotency key headers.
    *   **Elasticsearch**: Powering ultra-high-speed text and faceted searches across the metadata catalog.

### B. Hetzner Server ("The Muscle" - 22TB Storage)
*   **Role**: Handles physical supply-chain audio file storage, chunked HLS preview generation, wave visualizer peak extraction, and high-performance multi-tenant vector searches.
*   **Core Systems**:
    *   **NGINX**: Manages asset delivery paths with secure Fernet/HMAC validation.
    *   **SFTPGo**: Exposes secure SFTP chroot home directories for partners to upload raw MP3/WAV files and manifest CSVs.
    *   **FastAPI Compute Engine**: Executes internal APIs to provision directories, rebuild indexes, and trigger audio processing hooks.
    *   **FAISS HNSW Vector Sandbox**: Stores partner vector indexes in memory, hot-swapping isolated index workspaces thread-safely via our reentrant sandbox.
    *   **File Storage (22TB)**: Organizes original raw audio binaries (`RAW/`), generated FAISS indexes, catalog mapping JSON files, visualizer waveform peak coordinates, and HLS segments (`.ts` and `.m3u8` playlists).

### C. GPU Server ("Embedding Generation")
*   **Role**: High-speed deep learning inference cluster.
*   **Core Systems**:
    *   **NGINX**: Directs ingestion calls to the local FastAPI listener, protecting the model execution layer.
    *   **Embedding Generation FastAPI**: Runs GPU-accelerated PyTorch audio analysis pipelines (including MAEST and Discogs models) to instantly convert audio binary wave streams into compact high-dimensional float feature embeddings.

---

## 2. Server Architecture Workflow (Mermaid)

The following Mermaid diagram traces consumer, administrator, and B2B partner interactions, showing the complete flow of data across the three NGINX-shielded servers:

```mermaid
graph TB
    %% --- Theme Class Definitions ---
    classDef client fill:#fafafa,stroke:#737373,stroke-width:2px,color:#171717;
    classDef alwyzon fill:#e0f2fe,stroke:#0369a1,stroke-width:2px,color:#0c4a6e;
    classDef hetzner fill:#fef2f2,stroke:#b91c1c,stroke-width:2px,color:#7f1d1d;
    classDef gpu fill:#f0fdf4,stroke:#15803d,stroke-width:2px,color:#14532d;
    classDef db fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#854d0e;

    %% --- CLIENTS & CONSUMERS BOUNDARY ---
    subgraph Clients["1. Clients & Consumers Boundary"]
        FE["Frontend App (React / Mobile)"]:::client
        Admin["Admin Portal / Operations"]:::client
        Partner["B2B Partners"]:::client
    end

    %% --- ALWYZON GATEWAY ---
    subgraph Alwyzon["2. Alwyzon Server ('The Brain')"]
        ANgx["NGINX Proxy (Rate Limiting & SSL)"]:::alwyzon
        API["FastAPI Orchestrator (V1 API)"]:::alwyzon
        Auth["Auth Service (Bearer Keys & JWT)"]:::alwyzon
        
        %% Databases inside Alwyzon
        MDB[("MariaDB (2.3M+ Tracks, Quotas)")]:::db
        RDS[("Redis (Rate-limits, Idempotency)")]:::db
        ES[("Elasticsearch (Search Index)")]:::db
    end

    %% --- HETZNER STORAGE & SIMILARITY ---
    subgraph Hetzner["3. Hetzner Server ('The Muscle' - 22TB)"]
        HNgx["NGINX Proxy (Secure Link & SSL)"]:::hetzner
        SFTPGo["SFTPGo Server (Chroot Jails)"]:::hetzner
        HFastAPI["FastAPI Compute Engine"]:::hetzner
        FAISS["FAISS HNSW Vector Sandbox"]:::hetzner
        
        FS["File Storage (Raw Audio, Previews, Segments, Peaks, Embeddings, Indices)"]:::hetzner
    end

    %% --- GPU INFERENCE LAYER ---
    subgraph GPUServer["4. GPU Server (AI Embeddings)"]
        GNgx["NGINX Proxy (Access Protection)"]:::gpu
        GPFastAPI["Embedding Generation FastAPI"]:::gpu
    end

    %% --- NETWORK WORKFLOW LINKS ---
    
    %% Frontend Stream & API Traffic
    FE -->|1. Request Search / Playlists| ANgx
    FE -->|2. Request Stream / Previews / Peaks| HNgx
    HNgx -->|Stream Media| FE
    
    %% Admin Actions & Partner APIs
    Admin -->|CRUD / Operations / Key Config| ANgx
    Partner -->|B2B Search & Similarity APIs| ANgx
    
    %% Alwyzon Internal Routing
    ANgx --> API
    API --> Auth
    Auth -->|Validate Keys & Logs| MDB
    Auth -->|Manage Rate Limits & Caches| RDS
    API -->|High-speed text search| ES
    
    %% SFTP Supply-Chain Flow
    Partner -->|Uploads manifest & tracks| HNgx
    HNgx --> SFTPGo
    SFTPGo -->|1. Validate Credentials| ANgx
    ANgx -->|2. Check Username & Password| Auth
    SFTPGo -->|3. Write Files| FS
    SFTPGo -->|4. Done Event Hook| ANgx
    ANgx -->|5. Trigger Batch Ingestion| API
    
    %% Similarity Calculation Flow
    API -->|Delegates Vector Search| HNgx
    HNgx --> HFastAPI
    HFastAPI -->|Query Nearest Neighbors| FAISS
    FAISS -->|Returns Match Track UUIDs| HFastAPI
    HFastAPI -->|Resolves Asset| FS
    
    %% GPU Model Inference Flow
    FS -->|Send Audio Stream for Extraction| GNgx
    GNgx --> GPFastAPI
    GPFastAPI -->|Return High-D Embeddings| HFastAPI
    HFastAPI -->|Save Vector Embedding| FS
    HFastAPI -->|Merge vectors to partner index| FAISS

    %% --- Applied Styling ---
    class FE,Admin,Partner client;
    class ANgx,API,Auth alwyzon;
    class HNgx,SFTPGo,HFastAPI,FAISS,FS hetzner;
    class GNgx,GPFastAPI gpu;
    class MDB,RDS,ES db;
```

---

## 3. Server Transaction Sequence (PlantUML)

The following PlantUML sequence diagram maps the multi-server network transactions and database hooks executed during media consumption, B2B uploads, and GPU ingestion pipelines:

```plantuml
@startuml
autonumber
skinparam BoxPadding 10
skinparam ParticipantPadding 10

box "1. Clients & Consumers (resomix-web)" #LightGray
actor "Frontend App" as FE
actor "B2B Partner" as B2B
end box

box "2. Alwyzon Server (basic_fastapi_server_resomix)" #LightSkyBlue
participant "Alwyzon NGINX" as ANgx
participant "Alwyzon FastAPI" as API
participant "Auth Service" as Auth
database "MariaDB / ES" as DB
database "Redis Cache" as RDS
end box

box "3. Hetzner Server (resomix-similarity-open)" #LightPink
participant "Hetzner NGINX" as HNgx
participant "SFTPGo Server" as SFTP
participant "Hetzner FastAPI" as HAPI
database "FAISS / Storage" as HFS
end box

box "4. GPU Server" #LightGreen
participant "GPU NGINX" as GNgx
participant "Embedding FastAPI" as GPFast
end box

== Workflow A: Media Search & Audio Playback ==
FE -> ANgx: GET /search_tracks?query=x
ANgx -> API: Route Search Request
API -> DB: Query Elasticsearch & MariaDB
DB --> API: Return Track Metadata
API --> ANgx: JSON Search Results
ANgx --> FE: Display Track Metadata

FE -> HNgx: GET /audio/stream/{uuid} (Signed URL)
HNgx -> HAPI: Authenticate & Load Playout
HAPI -> HFS: Read HLS segments / Previews
HFS --> HAPI: Segment Binary Data
HAPI --> HNgx: Playout stream manifest
HNgx --> FE: High-Performance Audio Playback

== Workflow B: Supply-Chain SFTP Upload ==
B2B -> HNgx: SFTP Connection request
HNgx -> SFTP: Handshake
SFTP -> ANgx: GET /internal/sftp/auth (Auth Hook)
ANgx -> API: Validate credentials & scopes
API -> DB: Fetch Partner Account & Quota limits
DB --> API: Partner settings
API --> ANgx: Success Response (Status 1, dynamic Home chroot)
ANgx --> SFTP: Allow SFTP Session (Chroot root)
B2B -> SFTP: Upload Manifest CSV & raw audio files
SFTP -> HFS: Save assets to storage volume

== Workflow C: Background Ingestion & Embedding Generation ==
SFTP -> ANgx: POST /internal/sftp/event (Done file hook)
ANgx -> API: Enqueue Background Ingestion Task
API -> HNgx: POST /internal/ingest/add-vector
HNgx -> HAPI: Process audio track
HAPI -> HFS: Load raw audio file
HAPI -> GNgx: POST /generate_embedding (Audio file stream)
GNgx -> GPFast: Extract high-dimensional feature embeddings
GPFast --> GNgx: float32 Vector Embeddings (768-D / 1280-D)
GNgx --> HAPI: Embeddings response
HAPI -> HFS: Save vector to storage volume
HAPI -> HFS: Rebuild & merge into FAISS HNSW Sandbox Index
HAPI --> HNgx: Ingestion Success
HNgx --> API: Task Complete status
API -> DB: Log Ingestion status (IngestLog COMPLETED)

== Workflow D: Scoped B2B Partner Similarity Search ==
B2B -> ANgx: POST /api/v1/similarity/search (track_id, top_sk)
ANgx -> API: Route Similarity Request
API -> Auth: Validate B2B API Key & Scopes
Auth -> DB: Check Bearer Key, scopes (similarity:read), & partner state
DB --> Auth: Key Valid (Partner tenant resolved)
Auth -> RDS: Check Quota Limits & Rate limiting
RDS --> Auth: Under limit / Allowed
API -> HNgx: POST /similarity/query-by-uuid (Target UUID, partner_id)
HNgx -> HAPI: Authenticate & Delegate query
HAPI -> HFS: Read Partner local catalog.json (Scope check)
HFS --> HAPI: Partner track catalog mappings
HAPI -> HFS: Query partner's sandboxed FAISS HNSW index
HFS --> HAPI: Vector matches (IDs & cosine distances)
HAPI --> HNgx: Similarity matches JSON
HNgx --> API: Scoped B2B matches list
API --> ANgx: Standard JSON response format {"data": ...}
ANgx --> B2B: Isolated track similarity results
@enduml
```

