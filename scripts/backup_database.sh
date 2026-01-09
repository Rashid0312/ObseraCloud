#!/bin/bash
# Production Database Backup Script
# Usage: ./backup_database.sh

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

BACKUP_DIR="./backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/skyview_backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "🔄 SkyView Database Backup"
echo "========================================"
echo "📅 Timestamp: $TIMESTAMP"
echo "📂 Backup location: $BACKUP_FILE"
echo ""

# Create backup
echo "📦 Creating backup..."
docker exec obsera-postgres pg_dump -U "${POSTGRES_USER:-skyview_user}" -d "${POSTGRES_DB:-skyview}" > "$BACKUP_FILE"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"

echo ""
echo "✅ Backup completed successfully!"
echo "📁 File: ${BACKUP_FILE}.gz"
echo "📊 Size: $(du -h "${BACKUP_FILE}.gz" | cut -f1)"
echo ""

# Keep only last 30 backups
echo "🧹 Cleaning old backups (keeping last 30)..."
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm

echo "========================================"
