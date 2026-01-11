#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v2 - Scope Columns)..."
cat fix_metrics_schema_v2.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v2 patch applied."
