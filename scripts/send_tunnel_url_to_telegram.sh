#!/usr/bin/env bash
# Haal de Quick Tunnel-URL uit cloudflared-logs en stuur naar Telegram (TELEGRAM_CHAT_ID).
# Gebruik na: docker compose --profile with-tunnel up -d
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env 2>/dev/null || true
  set +a
fi
CONTAINER="${1:-omega-cloudflared}"
MAX_WAIT="${2:-45}"
echo "Wachten op Quick Tunnel-URL in $CONTAINER (max ${MAX_WAIT}s)..."
for i in $(seq 1 "$MAX_WAIT"); do
  URL=$(docker logs "$CONTAINER" 2>&1 | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Geen trycloudflare-URL gevonden in logs. Stuur /tunnel in Telegram."
  exit 1
fi
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "Zet TELEGRAM_BOT_TOKEN en TELEGRAM_CHAT_ID in .env om de link te sturen."
  echo "URL: $URL"
  exit 0
fi
TEXT="🌐 Omega Quick Tunnel (Mission Control): $URL"
if curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=${TEXT}" \
  -d "disable_web_page_preview=1" >/dev/null; then
  echo "Link naar Telegram gestuurd."
else
  echo "Versturen mislukt. URL: $URL"
fi
