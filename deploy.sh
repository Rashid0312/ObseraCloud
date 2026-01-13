#!/bin/bash

# SkyView Deployment Script
# Usage: ./deploy.sh "Your commit message"

set -e # Exit immediately if a command exits with a non-zero status

# Check if commit message is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a commit message."
    echo "Usage: ./deploy.sh \"message\""
    exit 1
fi

echo "========================================"
echo "🚀 Starting SkyView Deployment"
echo "========================================"

# 1. Local Git Operations
echo "📦 1. Staging and Committing local changes..."
git add .
git commit -m "$1" || echo "⚠️  Nothing to commit, proceeding..."
git push origin main
echo "✅ Local changes pushed to GitHub."

# 2. Remote Operations via SSH
echo "----------------------------------------"
echo "📡 2. Connecting to remote server..."
ssh root@46.62.229.59 << EOF
    set -e
    
    # Check if directory exists
    if [ ! -d "SkyView" ]; then
        echo "❌ Error: SkyView directory not found on server!"
        exit 1
    fi

    cd SkyView
    
    echo "⬇️  Pulling latest code (Force Reset)..."
    git fetch origin
    git reset --hard origin/main
    
    echo "🧹 Cleaning up conflicting services..."
    docker stop rosetta-frontend rosetta-backend || true
    
    # Explicitly stop to ensure recreation
    echo "🛑 Stopping existing containers..."
    docker compose --profile production down

    echo "🔨 Rebuilding Services (No Cache)..."
    # Force rebuild without cache and force recreation of containers
    docker compose --profile production up -d --build --no-cache --force-recreate --remove-orphans
    
    echo "🔄 Forcing Nginx restart to refresh DNS..."
    docker restart obsera-nginx || true
    
    echo "🔍 Checking running containers..."
    docker ps
    
    echo "✨ Server deployment successful!"
EOF

echo "========================================"
echo "🎉 Deployment Complete!"
echo "========================================"
