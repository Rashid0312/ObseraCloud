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
    
    echo "⬇️  Pulling latest code..."
    git pull origin main
    
    echo "🔨 Rebuilding Frontend Container..."
    # Using 'docker compose' (v2) as confirmed on server
    docker compose up -d --build frontend
    
    echo "✨ Server deployment successful!"
EOF

echo "========================================"
echo "🎉 Deployment Complete!"
echo "========================================"
