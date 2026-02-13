# Tamim App

A containerized messaging and dating simulation application.

## 🚀 Quick Install on Linux

Run this single command on your Linux server to install Docker, build the app, and run it:

```bash
git clone https://github.com/skyks030/Tamim.git && cd Tamim && chmod +x install_on_linux.sh && ./install_on_linux.sh
```

This will:
1. Install Git and Docker (if missing).
2. Clone the repository.
3. Build the Docker image.
4. Start the application on **Port 443** (mapped to internal port 3000).

---

## 🔄 How to Update

To update the application to the latest version on GitHub, run:

```bash
./update.sh
```

This will automatically pull the latest code, rebuild the container, and restart the app.
