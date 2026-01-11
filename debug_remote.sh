#!/bin/bash
echo "📡 Diagnostics: Connecting to remote server..."
ssh root@46.62.229.59 << EOF
    echo "--------------------------------"
    echo "🔍 1. Docker Containers Status:"
    docker ps -a | grep obsera
    
    echo "--------------------------------"
    echo "🔍 2. Nginx Error Logs (Last 20 lines):"
    docker logs obsera-nginx --tail 20 2>&1
    
    echo "--------------------------------"
    echo "🔍 3. Backend Logs (Last 50 lines):"
    docker logs obsera-backend --tail 50 2>&1
EOF
