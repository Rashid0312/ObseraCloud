#!/bin/bash
# Production Database Restore Script
# Usage: ./restore_database.sh <backup_file.sql.gz>

set -e

if [ $# -eq 0 ]; then
    echo "❌ Usage: $0 <backup_file.sql.gz>"
    echo "Example: $0 ./backups/postgres/skyview_backup_20260108_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "========================================"
echo "⚠️  SkyView Database Restore"
echo "========================================"
echo "📁 Source: $BACKUP_FILE"
echo ""
echo "⚠️  WARNING: This will OVERWRITE the current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🗜️  Decompressing backup..."
gunzip -c "$BACKUP_FILE" > /tmp/skyview_restore.sql

echo "🔄 Restoring database..."
docker exec -i obsera-postgres psql -U "${POSTGRES_USER:-skyview_user}" -d "${POSTGRES_DB:-skyview}" < /tmp/skyview_restore.sql

echo "🧹 Cleaning up..."
rm /tmp/skyview_restore.sql

echo ""
echo "✅ Database restored successfully!"
echo "========================================"
