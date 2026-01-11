#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v3 - ScopeDroppedAttrCount)..."
cat fix_metrics_schema_v3.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v3 patch applied."
