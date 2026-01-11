#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v7 - Flags & Exemplars)..."
cat fix_metrics_schema_v7.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v7 patch applied."
