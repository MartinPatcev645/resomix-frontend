Technical Review of Current System vs Requirements (Alwyzon)

THE DIGITAL SUPPLY CHAIN (DDEX)

- Point: DDEX ERN 4.3 Integration for automated ingestion.
- Result: Not currently following.
- Details: We're using custom Python scripts (extract_tracks_info.py, insert_tracks_from_json.py) to parse local files and JSON data. There's no formalized ERN machine-to-machine exchange yet.

- Point: Cloud-Native Ingestion (S3/MinIO).
- Result: Not following.
- Details: The system currently relies on local file paths and scp commands (seen in server.txt) to move files between servers. We aren't using an S3-compatible object storage layer for ingestion.

- Point: DDEX Party Identifier (DPID).
- Result: Not following.
- Details: No evidence of a DPID implementation in the code or config files.

COPYRIGHT AND LIABILITY (ARTICLE 17)

- Point: Automated Content Recognition (ACR) for "stay-down" mechanics.
- Result: Not following.
- Details: The track upload service extracts metadata but doesn't fingerprint audio or check it against a global database (like Audible Magic or ACRCloud). We're purely reliant on what's in our own database.

- Point: GDPR Compliance for transatlantic data flows.
- Result: Following partially.
- Details: Our core servers are on Hetzner (Germany) and Alwyzon (Austria), which is good for data residency. However, if we move backups to Backblaze (US), we'll need to ensure client-side encryption is solid.

SECURE MEDIA DELIVERY

- Point: HLS streaming with AES-128 encryption.
- Result: Not following.
- Details: We currently serve tracks via signed URLs for direct downloads/previews. This is "basic security" and doesn't prevent stream ripping as well as HLS would.

- Point: Tokenized access and link expiration.
- Result: Following.
- Details: The PreviewController uses Fernet encryption and HMAC for signed URLs with expiration timestamps. This works for one-time access but isn't as robust as session-bound HLS tokens.

INFRASTRUCTURE AND RESILIENCE

- Point: High Availability with Load Balancing and Floating IPs.
- Result: Following (Networking layer).
- Details: Your nginx.txt shows rate limiting and proxying set up, and the Alwyzon server is live. However, the application itself seems to be a single node without a floating IP failover system currently active in the code.

- Point: Private Networking for DB isolation.
- Result: Following partially.
- Details: Our DB is on the same machine accessed through localhost. The nginx config is set to deny some direct traffic, but a dedicated vSwitch/Private network for DB-to-API traffic would be better for enterprise compliance.

- Point: Database Clustering (Galera/Orchestrator).
- Result: Not following.
- Details: Our MariaDB setup is currently a single instance. There's no clustering or automatic failover logic implemented.

DATA BACKUP STRATEGY

- Point: 3-2-1 Strategy (3 copies, 2 media, 1 offsite).
- Result: Following partially.
- Details: We have manual backups (mysqldump in server.txt) and RAID on the server side, but a deduplicated offsite backup (Borg/Restic to Backblaze) is missing from the scripts I've seen. There are no automatic backups.

TECHNICAL SYSTEM OVERVIEW

- Database: We're running MariaDB 11.3+ handling 2.3M+ tracks. It's high-performance but remains a single point of failure in the current setup.
- Auth: We have a solid dual-auth system. Simple API keys for public/anonymous access and JWT for registered users. We also support 2FA (email codes).
- Security: We're using Fail2Ban with custom jails (404, admin-abuse, 4xx/5xx burst) and NGINX rate-limiting (3 zones: global, api, and admin). This is very good for baseline protection.
- Architecture: Clean 4-layer architecture (Router -> Controller -> Service -> Repository). This makes it very easy to plug in the missing features like ACR or DDEX ingestion later because the business logic is isolated.
- Open Tracks: We've moved away from Electrobuzz and are now using an internal pipeline that extracts and processes "open" tracks directly into the DB.
