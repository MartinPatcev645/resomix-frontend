Hetzner Server Technical Review

This review compares our current Hetzner server implementation against the technical standards required for major label integration and professional music delivery.

1. Digital Supply Chain & Ingestion

- DDEX / ERN Integration: Not Followed. We currently use in-house Python scripts (extract_tracks_info.py) to process files. We do not have an automated DDEX ERN 4.3 or 3.8 XML ingestion pipeline.
- DPID (DDEX Party Identifier): Not Followed. There is no mention of a DPID in our current metadata or communication headers.
- Cloud-Native Ingestion: Not Followed. We rely on manual uploads or local file moves to /mnt/data/ instead of a MinIO/S3 object storage event driven workflow.
- In-house Pipeline: Followed. We have a solid batch processing system using segment_open.py, peaks_open.py, and index_generator.py to prepare tracks for the similarity engine.

2. Media Delivery & HLS

- HLS Architecture: Followed. We are successfully segmenting audio into .ts chunks with a sequence of approximately 6 seconds per segment, hls.m3u8 manifest.
- AES-128 Encryption: Not Followed. Our current hls.m3u8 files lack the #EXT-X-KEY tag. Segments are currently unencrypted and could be easily reassembled by a simple script.
- Signed URLs: Partially Followed. The logic for HMAC signing and Fernet encryption (xpi/token parameters) exists in the code (app/api/audio.py) but is currently commented out or bypassed to allow easier development.
- Token Propagation: Not Followed. Our current manifest links for segments (uuid=...&seg=...) do not carry session tokens or expiration timestamps.
- Nginx secure_link: Not Followed. The current nginx configuration (rmedia) is a basic proxy without the secure_link module validation.

3. Copyright & Compliance (ACR)

- Automated Content Recognition (ACR): Not Followed. We do not have any integration with Audible Magic or ACRCloud to scan uploads for copyright infringement during ingestion.
- Stay-down Mechanism: Not Followed. There is no automated blocklist/registry check to prevent reupload of unauthorized content.
- Data Residency: Followed. We are using EU based providers (Hetzner in Germany, Alwyzon in Austria), which is a strong point for GDPR compliance regarding data residency.

4. Infrastructure & Resilience (HA)

- High Availability (HA): Not Followed. The system is a split stack single server architecture. If either the Alwyzon or Hetzner server fails, the entire service goes down (Single Point of Failure).
- Private Networking: Not Followed. Communication between the servers currently relies on public domains and public IP routing rather than a private Hetzner Cloud Network or vSwitch.
- Database Failover: Not Followed. We are using a single instance of MariaDB and the local FAISS indexes without a cluster (Galera) or automatic failover mechanism.

5. Data Backup & Preservation

- 3-2-1 Backup Strategy: Not Followed. No offsite backups to providers like Backblaze B2 or local snapshots on a Storage Box.
- Deduplication: Not Followed. We don't currently use tools like Restic or Borg, we store original files directly in the RAW/ folder.

6. Overall System Overview (Technical Perspective)

- Architecture: We follow a Split Stack design where Alwyzon handles the "Brain" (FastAPI, MariaDB, Auth) and Hetzner handles the "Muscle" (Audio processing, FAISS similarity, 22TB Storage).
- File Storage: Organized and hierarchical. We store media in /mnt/data/OPEN_TRACKS/ with subfolders for RAW, PREVIEWS, SEGS, AUDIO_PEAKS, and COVERS. This is a very clean setup for scaling.
- Security: Currently basic. We rely on IP Whitelisting and CORS origin validation. We have placeholders for more advanced security (HMAC links) that are not yet active.
- Tech Stack: Modern and efficient. We use Python 3.8+, FastAPI, FAISS, FFmpeg, and Nginx. The use of signed audio streaming (even if simplified) shows the foundation is there for enterprise-grade protection.
