#!/bin/bash
echo "📡 Diagnostics: Extended Remote Checks..."
ssh root@46.62.229.59 << EOF
    echo "--------------------------------"
    echo "🔍 1. OTel Collector Logs (Last 100 lines):"
    docker logs obsera-otel-collector --tail 100 2>&1
    
    echo "--------------------------------"
    echo "🔍 2. ClickHouse Logs (Last 50 lines - looking for insert errors):"
    docker logs obsera-clickhouse --tail 50 2>&1
EOF
