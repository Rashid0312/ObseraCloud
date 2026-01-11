#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema..."
cat fix_metrics_schema.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema patch applied."
