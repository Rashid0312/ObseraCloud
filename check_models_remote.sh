#!/bin/bash
echo "📡 Diagnostics: Checking available Gemini models on remote..."

# Pipe script content directly to remote python inside container
cat list_models.py | ssh root@46.62.229.59 "docker exec -i obsera-backend python -"
