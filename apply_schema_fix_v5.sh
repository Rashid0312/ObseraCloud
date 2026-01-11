#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v5 - StartTimeUnix)..."
cat fix_metrics_schema_v5.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v5 patch applied."
