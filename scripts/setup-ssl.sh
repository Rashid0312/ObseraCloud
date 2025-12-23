#!/bin/bash
# SkyView SSL Setup Script
# Run this on your production server with a domain pointed to it

set -e

DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@example.com"}

echo "🔐 Setting up SSL for: $DOMAIN"
echo "📧 Email: $EMAIL"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        sudo yum install -y certbot
    else
        echo "Please install certbot manually"
        exit 1
    fi
fi

# Create directories
mkdir -p nginx/ssl nginx/html

# Stop nginx if running
docker-compose stop nginx 2>/dev/null || true

# Get certificate (standalone mode)
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

# Copy certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem

echo "✅ SSL certificates installed!"
echo ""
echo "Next steps:"
echo "1. Update nginx/nginx.conf - uncomment the HTTPS server block"
echo "2. Update 'your-domain.com' to '$DOMAIN' in nginx.conf"
echo "3. Uncomment the HTTP->HTTPS redirect"
echo "4. Run: docker-compose --profile production up -d"
