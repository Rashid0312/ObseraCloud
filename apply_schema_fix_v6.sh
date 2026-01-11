#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v6 - TimeUnix)..."
cat fix_metrics_schema_v6.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v6 patch applied."
