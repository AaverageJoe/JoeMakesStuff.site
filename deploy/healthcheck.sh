#!/usr/bin/env bash
# Runs every minute via systemd timer. If the site stops responding, captures
# a full diagnostic snapshot (why it happened) before restarting the
# affected service (so it recovers on its own, no one has to notice and SSH in).
set -u

LOG_DIR="/home/joe/joemakesstuff-site/server/data"
LOG_FILE="$LOG_DIR/healthcheck.log"
mkdir -p "$LOG_DIR"

check() {
  curl -s -o /dev/null -w "%{http_code}" -m 8 "$1" 2>/dev/null
}

snapshot() {
  {
    echo "=== $(date -Is) — diagnostic snapshot ==="
    echo "--- memory ---"; free -h
    echo "--- temp/throttle ---"; vcgencmd measure_temp 2>&1; vcgencmd get_throttled 2>&1
    echo "--- load ---"; uptime
    echo "--- top by memory ---"; ps aux --sort=-%mem | head -11
    echo "--- top by cpu ---"; ps aux --sort=-%cpu | head -11
    echo "--- service states ---"
    systemctl is-active joemakesstuff.service caddy.service cloudflared.service joemakesstuff-webhook.service
    echo "--- recent journal (last 2 min, our services) ---"
    journalctl --since "2 min ago" -u joemakesstuff.service -u caddy.service -u cloudflared.service --no-pager
    echo
  } >> "$LOG_FILE"
}

SITE_CODE=$(check "http://localhost/")

if [ "$SITE_CODE" != "200" ]; then
  echo "=== $(date -Is) — site check failed (HTTP ${SITE_CODE:-timeout}) ===" >> "$LOG_FILE"
  snapshot

  # Narrow down and restart only what's actually unhealthy.
  APP_CODE=$(check "http://localhost:4000/api/projects")
  if [ "$APP_CODE" != "200" ]; then
    echo "$(date -Is): app unresponsive, restarting joemakesstuff.service" >> "$LOG_FILE"
    sudo systemctl restart joemakesstuff.service
  elif ! systemctl is-active --quiet caddy.service; then
    echo "$(date -Is): caddy down, restarting" >> "$LOG_FILE"
    sudo systemctl restart caddy.service
  else
    echo "$(date -Is): app+caddy responsive individually but site check still failed — restarting caddy as a precaution" >> "$LOG_FILE"
    sudo systemctl restart caddy.service
  fi
fi

# Keep the log from growing forever — trim to the last ~5000 lines weekly-ish.
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 5000 ]; then
  tail -n 3000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
