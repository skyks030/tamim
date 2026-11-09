#!/bin/bash
# Tamim App – Update script
#
# The whole script lives inside main() and is only called on the very last line.
# Bash therefore reads the complete file BEFORE running anything, so the
# "git reset --hard" below can safely replace this file while it is running.

main() {
set -e # Exit immediately if a command exits with a non-zero status

# Error Handling
trap 'echo "❌ Error: Command failed on line $LINENO"; exit 1' ERR

# Only images built from this repo carry this label (see Dockerfile)
APP_LABEL="app=tamim"

echo "=========================================="
echo "   Updating Tamim App..."
echo "=========================================="

# 0. Free space left over by earlier / failed builds of THIS app
echo "[0/4] Cleaning up leftovers from previous builds..."
docker image prune -f --filter "label=$APP_LABEL" >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
echo "      Free disk space: $(df -h . | awk 'NR==2 {print $4}')"

# 1. Pull Latest Changes
echo "[1/4] Syncing with latest changes from Git..."
# Force reset to match remote, discarding local changes (fixes "overwrite" errors)
git fetch --all
git reset --hard origin/main
chmod +x ./*.sh 2>/dev/null || true

# Remember the image that is running right now, so it can be removed after a successful update
OLD_IMAGE_ID="$(docker image inspect -f '{{.Id}}' tamim-app:latest 2>/dev/null || true)"

# 2. Rebuild Docker Image with Verbose Output
echo "[2/4] Rebuilding Docker Image..."
echo "-----------------------------------------------------"
docker build --progress=plain -t tamim-app:latest .
echo "-----------------------------------------------------"
NEW_IMAGE_ID="$(docker image inspect -f '{{.Id}}' tamim-app:latest)"

# 3. Restart Container
echo "[3/4] Restarting Container..."

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
    # 4. Clean up: remove the previous image and any build cache of this app
    echo "[4/4] Removing old images and build cache..."
    if [ -n "$OLD_IMAGE_ID" ] && [ "$OLD_IMAGE_ID" != "$NEW_IMAGE_ID" ]; then
        docker image rm "$OLD_IMAGE_ID" >/dev/null 2>&1 || true
    fi
    docker image prune -f --filter "label=$APP_LABEL" >/dev/null 2>&1 || true
    docker builder prune -af >/dev/null 2>&1 || true

    echo "=========================================="
    echo "   ✅ Update Complete & Running!"
    echo "   App restarted on Port 443."
    echo "   Free disk space: $(df -h . | awk 'NR==2 {print $4}')"
    echo "=========================================="
else
    echo "=========================================="
    echo "   ❌ Error: Container failed to start!"
    echo "   The previous image was kept for troubleshooting."
    echo "   Checking logs..."
    echo "=========================================="
    docker logs tamim-app
    exit 1
fi
}

main "$@"; exit $?
