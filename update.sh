#!/bin/bash

# Tamim App - Update Script

echo "=========================================="
echo "   Updating Tamim App..."
echo "=========================================="

# 1. Pull Latest Changes
echo "[1/3] Pulling latest changes from Git..."
git pull origin main

# 2. Rebuild Docker Image
echo "[2/3] Rebuilding Docker Image..."
docker build -t tamim-app:latest .


# 3. Restart Container
echo "[3/3] Restarting Container..."

# Stop and remove existing container
if [ "$(docker ps -aq -f name=tamim-app)" ]; then
    docker stop tamim-app
    docker rm tamim-app
fi

# Detect Certs Directory
CERTS_DIR="$(pwd)/certs"

# Run new container with SSL support
docker run -d \
  -p 80:3000 \
  -p 443:3443 \
  -v "$CERTS_DIR":/app/certs \
  --restart always \
  --name tamim-app \
  tamim-app:latest

echo "=========================================="
echo "   Update Complete!"
echo "   App restarted on Port 443."
echo "=========================================="
