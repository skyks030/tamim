#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Error Handling
trap 'echo "❌ Error: Command failed on line $LINENO"; exit 1' ERR

echo "=========================================="
echo "   Updating Tamim App..."
echo "=========================================="

# 1. Pull Latest Changes
echo "[1/3] Pulling latest changes from Git..."
git pull origin main

# 2. Rebuild Docker Image with Verbose Output
echo "[2/3] Rebuilding Docker Image..."
echo "-----------------------------------------------------"
docker build --progress=plain -t tamim-app:latest .
echo "-----------------------------------------------------"

# 3. Restart Container
echo "[3/3] Restarting Container..."

# Stop and remove existing container
if [ "$(docker ps -aq -f name=tamim-app)" ]; then
    docker stop tamim-app >/dev/null
    docker rm tamim-app >/dev/null
fi

# Detect Certs Directory
CERTS_DIR="$(pwd)/certs"

# Check if certs exist to warn user
if [ ! -f "$CERTS_DIR/privkey.pem" ] || [ ! -f "$CERTS_DIR/fullchain.pem" ]; then
    echo "⚠️  Warning: SSL certificates not found in $CERTS_DIR. App might default to HTTP or self-signed if generated."
fi


# Run new container with SSL support
docker run -d \
  -p 80:3000 \
  -p 443:3443 \
  -v "$CERTS_DIR":/app/certs \
  --restart always \
  --name tamim-app \
  tamim-app:latest

echo "Waiting for container to initialize..."
sleep 5

# Check if container is running
if [ "$(docker inspect -f '{{.State.Running}}' tamim-app 2>/dev/null)" == "true" ]; then
    echo "=========================================="
    echo "   ✅ Update Complete & Running!"
    echo "   App restarted on Port 443."
    echo "=========================================="
else
    echo "=========================================="
    echo "   ❌ Error: Container failed to start!"
    echo "   Checking logs..."
    echo "=========================================="
    docker logs tamim-app
    exit 1
fi
