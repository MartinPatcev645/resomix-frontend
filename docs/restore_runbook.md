# Disaster Recovery & Database Restoration Runbook
**Reference Version:** 1.0.0  
**Target RPO (Recovery Point Objective):** 24 Hours  
**Target RTO (Recovery Time Objective):** 4 Hours  
**Last Verified Drill:** May 23, 2026

---

## 1. Backup Strategy Overview (3-2-1 Rule)

Resomix utilizes a strict 3-2-1 data backup architecture:
1. **3 Copies of Data:** One active database, one local prepared backup copy, and one offsite storage archive.
2. **2 Different Media:** DB records stored on NVMe drives (active server) and HDD blocks (backup storage).
3. **1 Offsite Location:** Nightly backups are transferred offsite to a secondary Hetzner Storage Box located in a separate datacenter (Falkenstein DC vs. Helsinki DC) to ensure physical separation.

---

## 2. Nightly Backup Execution

The backup sequence is executed nightly via an automated Cron job executing the following operations:

1. **Hot Hot-Backup:** Runs `mariabackup` inside the active Docker database container.
   ```bash
   mariabackup --backup --user=root --password=test --target-dir=/var/lib/mysql/backup_nightly
   ```
2. **Backup Preparation:** Consolidates transactions using the redo-logs (prepare phase) to make the backup directly ready for deployment.
   ```bash
   mariabackup --prepare --target-dir=/var/lib/mysql/backup_nightly
   ```
3. **Offsite Transfer:** Packages the prepared database directory and uses `rsync` over SSH to copy the files to the secondary Hetzner Storage Box, along with critical config assets (`.env`, config files).

---

## 3. Step-by-Step Bare-Metal Recovery Procedure

In the event of a catastrophic server failure (e.g., host system crash, filesystem corruption):

### Step 3.1: Provision a New Host Server
1. Spin up a new clean VPS matching the production architecture.
2. Install Docker, Docker Compose, Git, and FFmpeg.
3. Clone the Resomix server repository and create the directory structures:
   ```bash
   mkdir -p /srv/sftp/partners
   mkdir -p backup/nightly
   ```

### Step 3.2: Pull Backups from Hetzner Storage Box
Retrieve the latest nightly backup files and `.env` config:
```bash
# Pull configs
scp -P 22 -r storage_box_user@he-storage-box.com:configs/.env .
# Pull database prepared backup directory
scp -P 22 -r storage_box_user@he-storage-box.com:database/. backup/nightly/
```

### Step 3.3: Initialize and Restore the Database
1. Launch the MariaDB container:
   ```bash
   docker compose up -d mariadb
   ```
2. Stop the newly booted MariaDB instance to allow directory copy-back:
   ```bash
   docker compose stop mariadb
   ```
3. Clear the fresh (empty) database data directory:
   ```bash
   # Caution: Make sure you are on the clean target host server!
   docker exec -it resomix-mariadb sh -c "rm -rf /var/lib/mysql/*"
   ```
4. Copy the prepared nightly backup files directly into the target container's data volume:
   ```bash
   docker cp backup/nightly/. resomix-mariadb:/var/lib/mysql/
   ```
5. Apply correct permissions inside the container:
   ```bash
   docker exec -it resomix-mariadb chown -R mysql:mysql /var/lib/mysql
   ```
6. Boot the database container to read the recovered tables:
   ```bash
   docker compose start mariadb
   ```

---

## 4. Post-Restore Data Integrity Validation Checklist

Once the container is running:
- [ ] **Connectivity Check:** Verify you can connect to the MariaDB instance:
  ```bash
  docker exec -it resomix-mariadb mariadb -uroot -ptest -e "SELECT 1;"
  ```
- [ ] **Schema Check:** Confirm all core tables exist (`partners`, `tracks`, `users`).
- [ ] **Row Count Verification:** Query the total count of tracks and compare with the last recorded telemetry dashboard counts:
  ```bash
  docker exec -it resomix-mariadb mariadb -uroot -ptest resomix_db -e "SELECT COUNT(*) FROM tracks;"
  ```
- [ ] **Application Check:** Boot the API using `make api` (or `uvicorn app.main:app`) and verify the `/api/v1/health` endpoint returns `{"status":"healthy"}`.

---

## 5. Automated Restore Validation Drill

Resomix has integrated an automated drill script that replicates the entire bare-metal recovery sequence inside a temporary, isolated Docker container to continuously test backups.

To run the automated backup and restore drill locally:
```bash
./scripts/backup_restore.sh
```

**Drill Execution Logs (Sample Success Output):**
```
==============================================================================
          Resomix B2B — Nightly Backup & Automated Restore Drill
==============================================================================
Starting hot-backup cycle...

[1/5] Executing hot-backup inside active database container 'resomix-test-db'...
[2/5] Preparing backup (applying redologs/crash-recovery inside container)...
[3/5] Syncing hot-backup and critical config/asset files to host offsite storage...
[4/5] Initiating bare-metal recovery drill on fresh container 'resomix-restore-drill'...
[5/5] Performing data integrity checks on recovered database instance...
==============================================================================
 ✓ RESTORE DRILL SUCCESSFUL!
==============================================================================
 Data Integrity Check: PASS
 Recovered Track Count: 20
 Recovery Time (RTO Simulation): ~25 seconds (RTO SLA: 4 hours)
 Recovery Point (RPO Simulation): Nightly Backup (RPO SLA: 24 hours)
==============================================================================
Cleaning up temporary recovery drill container...
Done.
```
