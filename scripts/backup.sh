#!/bin/bash
# backup.sh - Backup PocketBase data
#
# Usage:
#   ./scripts/backup.sh              # Backup to default location
#   ./scripts/backup.sh /path/to    # Backup to custom location
#
# Creates a timestamped zip archive of:
#   - pb_data/data.db (SQLite database)
#   - pb_data/storage/ (uploaded files)

set -euo pipefail

# Configuration
DATA_DIR="${PB_DATA_DIR:-./pb_data}"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="planneer_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}.zip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Planneer backup...${NC}"

# Validate data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${RED}Error: Data directory not found: ${DATA_DIR}${NC}"
    exit 1
fi

# Check for SQLite database
if [ ! -f "${DATA_DIR}/data.db" ]; then
    echo -e "${RED}Error: Database not found: ${DATA_DIR}/data.db${NC}"
    exit 1
fi

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Create temporary directory for consistent backup
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Copying database..."
# Use SQLite backup command for consistent snapshot
if command -v sqlite3 &> /dev/null; then
    sqlite3 "${DATA_DIR}/data.db" ".backup '${TEMP_DIR}/data.db'"
else
    # Fall back to file copy (less safe if DB is being written to)
    echo -e "${YELLOW}Warning: sqlite3 not found, using file copy${NC}"
    cp "${DATA_DIR}/data.db" "${TEMP_DIR}/data.db"
fi

# Copy storage directory if exists
if [ -d "${DATA_DIR}/storage" ]; then
    echo "Copying storage files..."
    cp -r "${DATA_DIR}/storage" "${TEMP_DIR}/storage"
fi

# Copy any additional files (hooks, migrations output)
for item in "pb_hooks" "pb_migrations"; do
    if [ -d "${DATA_DIR}/${item}" ]; then
        cp -r "${DATA_DIR}/${item}" "${TEMP_DIR}/${item}"
    fi
done

# Create zip archive
echo "Creating archive..."
cd "$TEMP_DIR"
zip -r "${BACKUP_PATH}" ./* -x "*.log"
cd - > /dev/null

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)

# Create latest symlink
ln -sf "${BACKUP_NAME}.zip" "${BACKUP_DIR}/latest.zip"

echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo ""
echo "  Location: ${BACKUP_PATH}"
echo "  Size:     ${BACKUP_SIZE}"
echo "  Latest:   ${BACKUP_DIR}/latest.zip"

# Cleanup old backups (keep last 10)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/planneer_backup_*.zip 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
    echo ""
    echo "Cleaning up old backups (keeping last 10)..."
    ls -1t "${BACKUP_DIR}"/planneer_backup_*.zip | tail -n +11 | xargs rm -f
    echo -e "${GREEN}✓ Cleanup complete${NC}"
fi

# Optional: Verify backup integrity
if command -v sqlite3 &> /dev/null; then
    echo ""
    echo "Verifying backup integrity..."
    unzip -q -c "$BACKUP_PATH" data.db > /tmp/verify_backup.db
    INTEGRITY=$(sqlite3 /tmp/verify_backup.db "PRAGMA integrity_check;")
    rm -f /tmp/verify_backup.db
    
    if [ "$INTEGRITY" = "ok" ]; then
        echo -e "${GREEN}✓ Backup integrity verified${NC}"
    else
        echo -e "${RED}✗ Backup integrity check failed: ${INTEGRITY}${NC}"
        exit 1
    fi
fi
