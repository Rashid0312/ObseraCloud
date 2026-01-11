#!/bin/bash
echo "🔄 Fix: Restarting Nginx to refresh DNS resolution..."
ssh root@46.62.229.59 << EOF
    docker restart obsera-nginx
    echo "✅ Nginx restarted."
    
    echo "--------------------------------"
    echo "🔍 New Nginx Status:"
    docker ps | grep obsera-nginx
EOF
