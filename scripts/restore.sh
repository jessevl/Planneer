#!/bin/bash
# restore.sh - Restore PocketBase data from backup
#
# Usage:
#   ./scripts/restore.sh                    # Restore from latest backup
#   ./scripts/restore.sh backup.zip         # Restore from specific file
#
# WARNING: This will overwrite the current database!

set -euo pipefail

# Configuration
DATA_DIR="${PB_DATA_DIR:-./pb_data}"
BACKUP_DIR="./backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine backup file to restore
if [ $# -eq 0 ]; then
    # Use latest backup
    BACKUP_FILE="${BACKUP_DIR}/latest.zip"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}Error: No backup file specified and no latest.zip found${NC}"
        echo "Usage: $0 [backup_file.zip]"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}                  PLANNEER RESTORE UTILITY                  ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Backup file: ${BACKUP_FILE}"
echo "  Target dir:  ${DATA_DIR}"
echo ""

# Show backup contents
echo "Backup contents:"
unzip -l "$BACKUP_FILE" | head -20
echo ""

# Confirmation prompt
echo -e "${RED}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Check if PocketBase is running
if pgrep -f "planneer-backend" > /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}PocketBase appears to be running.${NC}"
    read -p "Stop PocketBase before continuing? (yes/no): " STOP_PB
    
    if [ "$STOP_PB" = "yes" ]; then
        echo "Stopping PocketBase..."
        pkill -f "planneer-backend" || true
        sleep 2
    else
        echo -e "${RED}Cannot restore while PocketBase is running. Aborting.${NC}"
        exit 1
    fi
fi

# Create backup of current data (just in case)
if [ -f "${DATA_DIR}/data.db" ]; then
    echo ""
    echo "Creating safety backup of current database..."
    SAFETY_BACKUP="${BACKUP_DIR}/pre_restore_$(date +%Y%m%d_%H%M%S).zip"
    mkdir -p "$BACKUP_DIR"
    
    cd "$DATA_DIR"
    zip -r "$SAFETY_BACKUP" data.db storage 2>/dev/null || true
    cd - > /dev/null
    
    echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}${NC}"
fi

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract backup
echo ""
echo "Extracting backup..."
unzip -q "$BACKUP_FILE" -d "$TEMP_DIR"

# Validate extracted content
if [ ! -f "${TEMP_DIR}/data.db" ]; then
    echo -e "${RED}Error: Backup does not contain data.db${NC}"
    exit 1
fi

# Verify database integrity
if command -v sqlite3 &> /dev/null; then
    echo "Verifying database integrity..."
    INTEGRITY=$(sqlite3 "${TEMP_DIR}/data.db" "PRAGMA integrity_check;")
    
    if [ "$INTEGRITY" != "ok" ]; then
        echo -e "${RED}Error: Database integrity check failed: ${INTEGRITY}${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Database integrity verified${NC}"
fi

# Create data directory if needed
mkdir -p "$DATA_DIR"

# Restore database
echo ""
echo "Restoring database..."
cp "${TEMP_DIR}/data.db" "${DATA_DIR}/data.db"

# Restore storage directory
if [ -d "${TEMP_DIR}/storage" ]; then
    echo "Restoring storage files..."
    rm -rf "${DATA_DIR}/storage"
    cp -r "${TEMP_DIR}/storage" "${DATA_DIR}/storage"
fi

# Restore hooks if present
if [ -d "${TEMP_DIR}/pb_hooks" ]; then
    echo "Restoring hooks..."
    cp -r "${TEMP_DIR}/pb_hooks" "${DATA_DIR}/pb_hooks"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              RESTORE COMPLETED SUCCESSFULLY               ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Restored from: ${BACKUP_FILE}"
echo ""
echo "Next steps:"
echo "  1. Start PocketBase: ./planneer-backend serve"
echo "  2. Verify data in Admin UI: http://localhost:8090/_/"
echo ""

# Optional: Show database statistics
if command -v sqlite3 &> /dev/null; then
    echo "Database statistics:"
    echo "-------------------"
    for table in workspaces workspace_members projects tasks notes; do
        COUNT=$(sqlite3 "${DATA_DIR}/data.db" "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "0")
        printf "  %-20s %s records\n" "${table}:" "$COUNT"
    done
fi
