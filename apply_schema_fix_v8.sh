#!/bin/bash
echo "🔧 Patching ClickHouse Metrics Schema (v8 - AggregationTemporality & Min/Max)..."
cat fix_metrics_schema_v8.sql | ssh root@46.62.229.59 "docker exec -i obsera-clickhouse clickhouse-client"
echo "✅ Schema v8 patch applied."
