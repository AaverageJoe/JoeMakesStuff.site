#!/usr/bin/env bash
# First-time provisioning for the Joe.MakesStuff site on a Raspberry Pi.
#
# Targets Raspberry Pi OS (Debian-based), 64-bit, Pi 4/5. Works on either
# the Lite or Desktop image — for the rack touchscreen dashboard, also run
# setup-kiosk.sh (Desktop image only) after this.
#
# Review the config block below before running. Then:
#   chmod +x setup-pi.sh && ./setup-pi.sh
#
# Re-running is safe — each step skips itself if already done.

set -euo pipefail

# ---- Config — edit these before running ----
REPO_URL="https://github.com/AaverageJoe/JoeMakesStuff.site.git"
APP_DIR="$HOME/joemakesstuff-site"
DOMAIN="www.joemakesstuff.co.uk"
PORT=4000
NODE_MAJOR=22
SERVICE_USER="$(whoami)"
# ---------------------------------------------

echo "==> Installing system packages"
sudo apt update
sudo apt install -y curl git build-essential python3 ca-certificates

echo "==> Installing Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt install -y nodejs
fi
node -v
npm -v

echo "==> Installing Caddy (reverse proxy with automatic HTTPS)"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
fi

echo "==> Fetching the site"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> Installing dependencies (rebuilds native modules for ARM — can take a few minutes)"
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "!! Created .env from .env.example — edit ADMIN_PASSWORD and SITE_URL in ${APP_DIR}/.env before going live."
fi

echo "==> Building the frontend"
npm run build

echo "==> Installing systemd service"
sudo tee /etc/systemd/system/joemakesstuff.service > /dev/null <<EOF
[Unit]
Description=Joe.MakesStuff site
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now joemakesstuff.service

echo "==> Configuring Caddy reverse proxy for ${DOMAIN}"
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${DOMAIN} {
  reverse_proxy localhost:${PORT}
}
EOF
sudo systemctl reload caddy

cat <<EOF

Done.
  - Service status: sudo systemctl status joemakesstuff
  - Live logs:      journalctl -u joemakesstuff -f
  - Site directory:  ${APP_DIR}

Still to do:
  1. Edit ${APP_DIR}/.env — set a real ADMIN_PASSWORD.
  2. Point DNS for ${DOMAIN} at this Pi (see the deployment options doc for
     the port-forward vs. Cloudflare Tunnel trade-off).
  3. Back up ${APP_DIR}/server/uploads and ${APP_DIR}/server/data somewhere
     off this device — neither is in git, so this Pi is the only copy.
  4. For the rack touchscreen dashboard, run setup-kiosk.sh next.
EOF
