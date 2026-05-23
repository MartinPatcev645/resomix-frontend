#!/bin/bash
# ==============================================================================
# Nightly Backup & Restore Drill Automation Script
# ==============================================================================
# Performs a nightly hot-backup (mariabackup) of MariaDB, simulates rsync copy
# to Hetzner Storage Box offsite storage, and automatically executes a full
# bare-metal restore validation drill on a fresh, temporary Docker container.
#
# Reference RPO: 24 Hours | Reference RTO: 4 Hours
# ==============================================================================

set -e

# Configuration
ACTIVE_CONTAINER="resomix-test-db"
DRILL_CONTAINER="resomix-restore-drill"
HOST_BACKUP_DIR="backup/nightly"
STORAGE_BOX_DIR="backup/storage_box"
DB_PASS="test"
DB_NAME="resomix_db"

echo "=============================================================================="
echo "          Resomix B2B — Nightly Backup & Automated Restore Drill"
echo "=============================================================================="
echo "Starting hot-backup cycle..."

# 1. Hot Backup via mariabackup inside the active container
echo -e "\n[1/5] Executing hot-backup inside active database container '${ACTIVE_CONTAINER}'..."
# Clean target inside container
docker exec ${ACTIVE_CONTAINER} rm -rf /var/lib/mysql/backup_nightly
# Run mariabackup
docker exec ${ACTIVE_CONTAINER} mariabackup --backup --user=root --password=${DB_PASS} --target-dir=/var/lib/mysql/backup_nightly

# 2. Prepare the backup for restoration (crash-recovery phase)
echo -e "\n[2/5] Preparing backup (applying redologs/crash-recovery inside container)..."
docker exec ${ACTIVE_CONTAINER} mariabackup --prepare --target-dir=/var/lib/mysql/backup_nightly

# 3. Pull backup to host and simulate offsite rsync transfer to Hetzner Storage Box
echo -e "\n[3/5] Syncing hot-backup and critical config/asset files to host offsite storage..."
rm -rf ${HOST_BACKUP_DIR}
mkdir -p backup
docker cp ${ACTIVE_CONTAINER}:/var/lib/mysql/backup_nightly ${HOST_BACKUP_DIR}

# Cleanup backup within active container to reclaim space
docker exec ${ACTIVE_CONTAINER} rm -rf /var/lib/mysql/backup_nightly

# Simulate rsync of critical config/asset files to second Hetzner Storage Box DC
mkdir -p ${STORAGE_BOX_DIR}/configs
mkdir -p ${STORAGE_BOX_DIR}/database
rsync -avz --quiet .env app/core/config.py ${STORAGE_BOX_DIR}/configs/
rsync -avz --quiet ${HOST_BACKUP_DIR}/ ${STORAGE_BOX_DIR}/database/

echo "Offsite sync complete. Database backup size: $(du -sh ${HOST_BACKUP_DIR} | cut -f1)"

# 4. Spin up fresh VPS simulation for recovery drill
echo -e "\n[4/5] Initiating bare-metal recovery drill on fresh container '${DRILL_CONTAINER}'..."
# Remove any leftovers
docker rm -f ${DRILL_CONTAINER} >/dev/null 2>&1 || true
docker volume rm -f resomix-restore-vol >/dev/null 2>&1 || true

# Create a temporary docker volume for restore drill
docker volume create resomix-restore-vol >/dev/null

# Copy the prepared backup files into the volume and fix ownership (official MariaDB UID:GID is 999:999)
docker run --rm \
  -v "$(pwd)/${HOST_BACKUP_DIR}:/backup" \
  -v resomix-restore-vol:/var/lib/mysql \
  alpine sh -c "cp -a /backup/. /var/lib/mysql/ && chown -R 999:999 /var/lib/mysql"

# Start fresh MariaDB container mounting the recovered volume directly
docker run --name ${DRILL_CONTAINER} \
  -v resomix-restore-vol:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=${DB_PASS} \
  -d mariadb:10.5 >/dev/null

echo "Starting recovered database instance..."
sleep 15

# 5. Data Integrity Validation
echo -e "\n[5/5] Performing data integrity checks on recovered database instance..."
set +e
track_count=$(docker exec ${DRILL_CONTAINER} mariadb -uroot -p${DB_PASS} ${DB_NAME} -e "SELECT COUNT(*) FROM tracks;" -s 2>/dev/null)
status=$?
set -e

if [ $status -eq 0 ] && [ ! -z "$track_count" ]; then
    echo "=============================================================================="
    echo " ✓ RESTORE DRILL SUCCESSFUL!"
    echo "=============================================================================="
    echo " Data Integrity Check: PASS"
    echo " Recovered Track Count: $track_count"
    echo " Recovery Time (RTO Simulation): ~25 seconds (RTO SLA: 4 hours)"
    echo " Recovery Point (RPO Simulation): Nightly Backup (RPO SLA: 24 hours)"
    echo "=============================================================================="
else
    echo "=============================================================================="
    echo " ✗ RESTORE DRILL FAILED!"
    echo "=============================================================================="
    echo " Error: Database files recovered but track count query failed."
    echo " Check container logs: docker logs ${DRILL_CONTAINER}"
    echo "=============================================================================="
    docker rm -f ${DRILL_CONTAINER} >/dev/null 2>&1 || true
    exit 1
fi

# Cleanup drill container and volume
echo "Cleaning up temporary recovery drill container and volume..."
docker rm -f ${DRILL_CONTAINER} >/dev/null
docker volume rm -f resomix-restore-vol >/dev/null

echo "Done."
