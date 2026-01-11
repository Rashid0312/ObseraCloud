#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v8b - Gauge Super Table)..."
cat fix_support_v8_gauge.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v8b patch applied."
