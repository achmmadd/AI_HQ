#!/usr/bin/env bash
# Verwijder Telegram webhook zodat de bridge updates via polling krijgt (en weer reageert).
# Run: cd ~/AI_HQ && ./scripts/telegram_webhook_uit.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$ROOT/.env" ]; then
  echo "Geen .env gevonden."
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ROOT/.env" 2>/dev/null || true
set +a

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [[ "$TELEGRAM_BOT_TOKEN" == *"xxx"* ]]; then
  echo "Zet TELEGRAM_BOT_TOKEN in .env"
  exit 1
fi

echo "Webhook verwijderen..."
RES=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook")
if echo "$RES" | grep -q '"ok":true'; then
  echo "  ✓ Webhook verwijderd. Herstart de bridge: ./launch_factory.sh"
else
  echo "  Response: $RES"
fi
