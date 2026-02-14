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


# 4. SSL Certificates (Self-Signed for testing if not present)
echo "[4/5] Checking SSL Certificates..."
CERTS_DIR="$(pwd)/certs"

if [ ! -d "$CERTS_DIR" ]; then
    mkdir -p "$CERTS_DIR"
fi

if [ ! -f "$CERTS_DIR/privkey.pem" ] || [ ! -f "$CERTS_DIR/fullchain.pem" ]; then
    echo "No certificates found. Generating self-signed certificates for testing..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/privkey.pem" \
        -out "$CERTS_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    echo "Self-signed certificates generated."
else
    echo "Certificates found in $CERTS_DIR."
fi

# 5. Run Container
echo "[5/5] Starting Application..."
echo "Running on:"
echo "  - HTTP:  http://<your-ip>:80 -> 3000 (Internal)"
echo "  - HTTPS: https://<your-ip>:443 -> 3443 (Internal)"

docker run -d \
  -p 80:3000 \
  -p 443:3443 \
  -v "$CERTS_DIR":/app/certs \
  --restart always \
  --name tamim-app \
  tamim-app:latest

echo "=========================================="
echo "   Installation Complete!"
echo "   App is running at https://<your-ip>"
echo "   (Accept the self-signed certificate warning if using generated certs)"
echo "=========================================="
