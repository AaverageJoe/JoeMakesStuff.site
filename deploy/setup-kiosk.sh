#!/usr/bin/env bash
# Configures this Pi's desktop to auto-launch the /dashboard page fullscreen
# on boot, for the rack-mounted touchscreen. Requires Raspberry Pi OS with
# Desktop (not Lite) and a working X session. Run setup-pi.sh first so the
# server is actually up before this tries to point Chromium at it.
#
#   chmod +x setup-kiosk.sh && ./setup-kiosk.sh
#   sudo reboot

set -euo pipefail

PORT=4000
URL="http://localhost:${PORT}/dashboard"

echo "==> Installing Chromium"
sudo apt update
sudo apt install -y chromium-browser unclutter

AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/joemakesstuff-dashboard.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Joe.MakesStuff Dashboard
Exec=chromium-browser --noerrdialogs --disable-infobars --kiosk --incognito --disable-session-crashed-bubble --disable-restore-session-state ${URL}
X-GNOME-Autostart-enabled=true
EOF

echo "==> Disabling screen blanking/sleep and hiding the mouse cursor"
LXSESSION_DIR="$HOME/.config/lxsession/LXDE-pi"
mkdir -p "$LXSESSION_DIR"
AUTOSTART_FILE="$LXSESSION_DIR/autostart"
touch "$AUTOSTART_FILE"
for line in "@xset s off" "@xset -dpms" "@xset s noblank" "@unclutter -idle 0.5 -root"; do
  grep -qxF "$line" "$AUTOSTART_FILE" || echo "$line" >> "$AUTOSTART_FILE"
done

cat <<EOF

Done. Reboot to launch the dashboard fullscreen: sudo reboot

To swap it out temporarily (e.g. for maintenance), Alt+F4 closes Chromium —
it'll relaunch on the next reboot. To disable permanently, delete:
  ${AUTOSTART_DIR}/joemakesstuff-dashboard.desktop
EOF
