#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🚀 Building Docker Image..."
# Exit immediately if a command exits with a non-zero status
set -e
docker build -t film-dating-app .

echo "🛑 Stopping old container..."
docker stop film-dating-app-container 2>/dev/null || true
docker rm film-dating-app-container 2>/dev/null || true

echo "▶️  Starting new container..."
# Create data and uploads directories if they don't exist
mkdir -p data
mkdir -p uploads

# Run with volume mount for persistence (updated to include uploads)
docker run -d -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  --name film-dating-app-container \
  film-dating-app

echo "⏳ Waiting for server to start..."
# Wait for up to 10 seconds for the server to respond
for i in {1..10}; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Server returned HTTP 200 (OK)"
        break
    fi
    echo "   ... checking ($i/10)"
    sleep 1
done

# Verify container status
if [ "$(docker inspect -f '{{.State.Running}}' film-dating-app-container)" = "true" ]; then
    echo "✅ Container is RUNNING."
    echo "📊 Docker Processes:"
    docker ps --filter "name=film-dating-app-container" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo "✅ Deployment Complete!"
    echo "📱 Actor View:   http://localhost:3000/app"
    echo "🎛️  Control View: http://localhost:3000/control"
else
    echo "❌ Container failed to start or crashed!"
    echo "🔍 Checking logs:"
    docker logs film-dating-app-container
    exit 1
fi
