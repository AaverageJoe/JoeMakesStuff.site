#!/usr/bin/env bash
# Pulls the latest main, rebuilds, and restarts the live service.
# Thin wrapper around scripts/deploy.sh (the same pipeline the GitHub
# webhook triggers) so the desktop shortcut and auto-deploy stay in sync.
set -e
cd "$(dirname "$0")/.."
bash scripts/deploy.sh
echo
read -n1 -r -p "Done. Press any key to close..."
echo
