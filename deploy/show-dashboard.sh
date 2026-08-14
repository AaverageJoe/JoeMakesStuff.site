#!/usr/bin/env bash
# Relaunches the rack dashboard fullscreen — the counterpart to the "Hide"
# button on the dashboard itself. Same command the desktop's own autostart
# uses, so it behaves identically (auto-restarts if it crashes, etc).
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
pkill -f "lwrespawn.*chromium.*localhost:4000/dashboard" 2>/dev/null
pkill -f "chromium.*localhost:4000/dashboard" 2>/dev/null
sleep 1
nohup /usr/bin/lwrespawn /usr/bin/chromium --ozone-platform=wayland --noerrdialogs --disable-infobars --kiosk --incognito --disable-session-crashed-bubble --disable-restore-session-state http://localhost:4000/dashboard >/dev/null 2>&1 &
disown
