#!/usr/bin/env bash
# Starts (or restarts) the live Joe.MakesStuff service. Safe to run whether
# it's already running or stopped.
set -e
echo "Restarting Joe.MakesStuff site..."
sudo systemctl restart joemakesstuff.service
sleep 1
sudo systemctl --no-pager status joemakesstuff.service | head -8
echo
read -n1 -r -p "Done. Press any key to close..."
echo
