#!/usr/bin/env bash
# Pulls the latest code, rebuilds, and restarts the live service. Run this
# on the Pi after pushing changes from elsewhere — or have Claude Code run
# it directly if you're editing on the Pi itself.
#
#   chmod +x update.sh && ./update.sh

set -euo pipefail

APP_DIR="$HOME/joemakesstuff-site"
cd "$APP_DIR"

git pull
npm install
npm run build
sudo systemctl restart joemakesstuff

echo "Updated and restarted. Logs: journalctl -u joemakesstuff -f"
