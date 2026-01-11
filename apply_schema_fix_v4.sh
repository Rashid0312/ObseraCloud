#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v4 - Description & Unit)..."
cat fix_metrics_schema_v4.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v4 patch applied."
