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

# Run new container
docker run -d \
  -p 443:3000 \
  --restart always \
  --name tamim-app \
  tamim-app:latest

echo "=========================================="
echo "   Update Complete!"
echo "   App restarted on Port 443."
echo "=========================================="
