#!/bin/bash

# Tamim App - Auto Installer for Linux

echo "=========================================="
echo "   Tamim App Installer via Docker"
echo "=========================================="

# 1. Check & Install Dependencies (Docker & Git)
echo "[1/4] Checking dependencies..."

if ! command -v git &> /dev/null; then
    echo "Git not found. Installing..."
    if [ -x "$(command -v apt-get)" ]; then
        sudo apt-get update && sudo apt-get install -y git
    elif [ -x "$(command -v yum)" ]; then
        sudo yum install -y git
    else
        echo "Error: Could not install Git. Please install it manually."
        exit 1
    fi
else
    echo "Git is already installed."
fi

if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo "Docker installed successfully."
else
    echo "Docker is already installed."
fi

# Ensure Docker service is running
if ! systemctl is-active --quiet docker; then
    echo "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# 2. Setup Directory
echo "[2/4] Setting up directory..."
# Check if we are already inside the repo
if [ -d ".git" ]; then
    echo "Already inside the repository."
else
    # Clone if not present
    if [ ! -d "Tamim" ]; then
        echo "Cloning repository..."
        git clone https://github.com/skyks030/Tamim.git
    fi
    cd Tamim || exit
fi

# 3. Build Docker Image
echo "[3/4] Building Docker Image..."
# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=tamim-app)" ]; then
    echo "Stopping existing container..."
    docker stop tamim-app
    docker rm tamim-app
fi

docker build -t tamim-app:latest .

# 4. Run Container
echo "[4/4] Starting Application..."
echo "Running on Port 443 (External) -> 3000 (Internal)"

docker run -d \
  -p 443:3000 \
  --restart always \
  --name tamim-app \
  tamim-app:latest

echo "=========================================="
echo "   Installation Complete!"
echo "   App is running at http://<your-ip>:443"
echo "=========================================="
