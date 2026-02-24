#!/bin/sh
# LEGACY: Niet meer gebruikt door docker-compose. De cloudflared-service gebruikt
# nu direct: command: tunnel --url http://omega-mission-control:8501
# De Quick Tunnel-URL haal je op via Telegram: /tunnel (LinkScraper in telegram_bridge).
set -e

if [ -n "$TUNNEL_TOKEN" ]; then
  exec cloudflared tunnel --no-autoupdate run
fi

# Quick Tunnel naar Mission Control
mkdir -p /app/data
LOG=/tmp/cf.log
cloudflared tunnel --no-autoupdate --url "http://omega-mission-control:8501" 2>&1 | tee "$LOG" &
PID=$!

# Wacht tot de trycloudflare.com-URL in de logs staat (max 45s)
i=0
URL=""
while [ $i -lt 45 ]; do
  sleep 1
  i=$((i + 1))
  URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
  [ -n "$URL" ] && break
done

if [ -n "$URL" ]; then
  echo "$URL" > /app/data/quick_tunnel_url.txt
fi

wait $PID
