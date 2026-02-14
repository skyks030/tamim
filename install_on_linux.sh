#!/bin/bash
set -e # Exit immediately on error

# Error Handling
trap 'echo "❌ Error: Command failed on line $LINENO"; exit 1' ERR

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
    docker stop tamim-app >/dev/null
    docker rm tamim-app >/dev/null
fi

echo "-----------------------------------------------------"
docker build --progress=plain -t tamim-app:latest .
echo "-----------------------------------------------------"



# 4. SSL Certificates Setup
echo "=========================================="
echo "   SSL Configuration"
echo "=========================================="
echo "Do you want to set up a trusted SSL certificate with Let's Encrypt?"
echo "1) Yes (requires a domain pointing to this server IP)"
echo "2) No (use self-signed certificate, good for testing/IP-only)"
read -p "Select an option [1/2]: " ssl_choice

CERTS_DIR="$(pwd)/certs"
if [ ! -d "$CERTS_DIR" ]; then
    mkdir -p "$CERTS_DIR"
fi

if [ "$ssl_choice" == "1" ]; then
    echo ""
    read -p "Enter your domain name (e.g., app.example.com): " DOMAIN
    read -p "Enter your email address (for renewal alerts): " EMAIL
    
    echo ""
    echo "This script will now install Certbot and request a certificate for $DOMAIN."
    echo "Ensure that :"
    echo "  - Port 80 is forwarded to this server."
    echo "  - DNS for $DOMAIN points to this server's IP."
    echo ""
    read -p "Press Enter to continue..."
    
    # Install Certbot if missing
    if ! command -v certbot &> /dev/null; then
        echo "Installing Certbot..."
        if [ -x "$(command -v apt-get)" ]; then
            sudo apt-get update && sudo apt-get install -y certbot
        elif [ -x "$(command -v yum)" ]; then
            sudo yum install -y certbot
        else
            echo "Warning: Could not install Certbot automatically."
            echo "Falling back to self-signed certificate."
            ssl_choice="2"
        fi
    fi
    
    if [ "$ssl_choice" == "1" ]; then
        # Check if certs already exist safely
        if [ -f "$CERTS_DIR/privkey.pem" ] && [ -f "$CERTS_DIR/fullchain.pem" ]; then
             echo "Certificates already exist in $CERTS_DIR. Skipping generation."
             # Use them
        else
             # Stop any existing container on port 80
             docker stop tamim-app >/dev/null 2>&1 || true
             
             echo "Requesting certificate..."
             sudo certbot certonly --standalone \
                -d "$DOMAIN" \
                --email "$EMAIL" \
                --agree-tos \
                --non-interactive
                
             if [ $? -eq 0 ]; then
                 echo "Certificate obtained successfully."
                 sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS_DIR/privkey.pem"
                 sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/fullchain.pem"
                 sudo chmod 644 "$CERTS_DIR/privkey.pem"
                 sudo chmod 644 "$CERTS_DIR/fullchain.pem"
             else
                 echo "Error obtaining certificate. Falling back to self-signed."
                 ssl_choice="2"
             fi
        fi
    fi
fi

# Fallback or User Choice: Self-Signed
if [ "$ssl_choice" != "1" ]; then
    if [ ! -f "$CERTS_DIR/privkey.pem" ] || [ ! -f "$CERTS_DIR/fullchain.pem" ]; then
        echo "Generating self-signed certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERTS_DIR/privkey.pem" \
            -out "$CERTS_DIR/fullchain.pem" \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        echo "Self-signed certificates generated."
    else
        echo "Using existing certificates in $CERTS_DIR."
    fi
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
if [ "$ssl_choice" == "1" ]; then
    echo "   App is running at https://$DOMAIN"
else
    echo "   App is running at https://<your-ip>"
    echo "   (Self-signed certificate: Accept warning in browser)"
fi
echo "=========================================="
