#!/usr/bin/env bash
# Pulls the latest main, rebuilds, and restarts the live service.
# Run manually, or triggered by scripts/webhook-listener.js on a GitHub push.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[deploy] $(date -Is) fetching origin/main"
git fetch origin main

if git merge-base --is-ancestor HEAD origin/main; then
  git merge --ff-only origin/main
else
  echo "[deploy] local main has diverged from origin/main — refusing to overwrite, deploy aborted"
  exit 1
fi

echo "[deploy] installing dependencies"
npm install

echo "[deploy] building frontend"
npm run build

echo "[deploy] restarting service"
sudo systemctl restart joemakesstuff.service

echo "[deploy] $(date -Is) done — now at $(git rev-parse --short HEAD)"
