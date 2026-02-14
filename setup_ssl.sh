#!/bin/bash

# SSL Setup Script for Tamim (Let's Encrypt)
# Usage: ./setup_ssl.sh <domain-name>

if [ -z "$1" ]; then
    echo "Usage: sudo ./setup_ssl.sh <your-domain.com>"
    exit 1
fi

DOMAIN=$1
EMAIL="admin@$DOMAIN" # Default email, change if needed
CERTS_DIR="$(pwd)/certs"

echo "=========================================="
echo "   Setting up SSL for $DOMAIN"
echo "=========================================="

# 1. Install Certbot (if not present)
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    if [ -x "$(command -v apt-get)" ]; then
        sudo apt-get update
        sudo apt-get install -y certbot
    elif [ -x "$(command -v yum)" ]; then
        sudo yum install -y certbot
    else
        echo "Error: Certbot not found and could not be installed automatically."
        echo "Please install Certbot manually and run this script again."
        exit 1
    fi
fi

# 2. Stop valid port 80 conflicts (the running container)
echo "Stopping existing Tamim container to free port 80..."
docker stop tamim-app || true

# 3. Request Certificate
echo "Requesting certificate for $DOMAIN..."
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

if [ $? -ne 0 ]; then
    echo "Error: Certificate generation failed."
    echo "Make sure port 80 is open and forwarded to this server."
    # Restart the app anyway so site isn't down
    ./install_on_linux.sh
    exit 1
fi

# 4. Copy/Link Certificates to App Directory
echo "Copying certificates to $CERTS_DIR..."
mkdir -p "$CERTS_DIR"

# Certbot saves in /etc/letsencrypt/live/$DOMAIN/
# We copy them so the container can access them easily without complex volume mapping of /etc
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS_DIR/privkey.pem"
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/fullchain.pem"

# Set permissions so the app user can read them
sudo chmod 644 "$CERTS_DIR/privkey.pem"
sudo chmod 644 "$CERTS_DIR/fullchain.pem"

echo "Certificates installed."

# 5. Restart Application
echo "Restarting Application..."
./install_on_linux.sh

echo "=========================================="
echo "   SSL Setup Complete!"
echo "   Your app should now be accessible at https://$DOMAIN"
echo "=========================================="
