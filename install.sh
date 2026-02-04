#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🚀 Building Docker Image..."
docker build -t film-dating-app .

echo "🛑 Stopping old container..."
docker stop film-dating-app-container 2>/dev/null || true
docker rm film-dating-app-container 2>/dev/null || true

echo "▶️  Starting new container..."
# Create data directory if it doesn't exist
mkdir -p data
# Run with volume mount for persistence
docker run -d -p 3000:3000 -v "$(pwd)/data:/app/data" --name film-dating-app-container film-dating-app

echo "✅ Deployment Complete!"
echo "📱 Actor View:   http://localhost:3000/app"
echo "🎛️  Control View: http://localhost:3000/control"
