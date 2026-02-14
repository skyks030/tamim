#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Error Handling
trap 'echo "❌ Error: Command failed on line $LINENO"; exit 1' ERR

echo "=========================================="
echo "   Updating Tamim App..."
echo "=========================================="


# 1. Pull Latest Changes
echo "[1/3] Syncing with latest changes from Git..."
# Force reset to match remote, discarding local changes (fixes "overwrite" errors)
git fetch --all
git reset --hard origin/main

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
    echo "⚠️  Warning: SSL certificates not found in $CERTS_DIR."
    
    # ATTEMPT RECOVERY: Check standard Let's Encrypt path
    # Find the most recently modified directory in /etc/letsencrypt/live/
    LATEST_LE_DIR=$(ls -td /etc/letsencrypt/live/*/ 2>/dev/null | head -1)
    
    if [ -n "$LATEST_LE_DIR" ] && [ -f "${LATEST_LE_DIR}privkey.pem" ]; then
        echo "♻️  Found existing Let's Encrypt certificates in $LATEST_LE_DIR"
        echo "   Copying to local ./certs folder for Docker..."
        mkdir -p "$CERTS_DIR"
        sudo cp "${LATEST_LE_DIR}privkey.pem" "$CERTS_DIR/privkey.pem"
        sudo cp "${LATEST_LE_DIR}fullchain.pem" "$CERTS_DIR/fullchain.pem"
        sudo chmod 644 "$CERTS_DIR/privkey.pem"
        sudo chmod 644 "$CERTS_DIR/fullchain.pem"
        echo "✅ Certificates restored!"
    else
        echo "   Could not find certs in /etc/letsencrypt/live/. App might default to HTTP or self-signed."
    fi
fi



# Ensure persistence directories exist
mkdir -p server/data
mkdir -p server/uploads

# Run new container with SSL support
docker run -d \
  -p 80:3000 \
  -p 443:3443 \
  -v "$CERTS_DIR":/app/certs \
  -v "$(pwd)/server/data":/app/data \
  -v "$(pwd)/server/uploads":/app/uploads \
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
