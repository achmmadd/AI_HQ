#!/usr/bin/env bash
# Omega Conflict oplossen: webhooks verwijderen, alle bridges stoppen, 10s wachten, alleen Omega starten.
# Gebruik als Omega niet reageert door "Conflict: getUpdates".
# Daarna eventueel: ./scripts/launch_zwartehand.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "1. Webhook verwijderen (Omega-token uit .env)..."
set -a
# shellcheck source=/dev/null
source "$ROOT/.env" 2>/dev/null || true
set +a
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" | grep -q '"ok":true' && echo "   Omega webhook weg" || true
fi

echo "2. Webhook verwijderen (Zwartehand-token uit .env.zwartehand)..."
set -a
# shellcheck source=/dev/null
source "$ROOT/.env.zwartehand" 2>/dev/null || true
set +a
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" | grep -q '"ok":true' && echo "   Zwartehand webhook weg" || true
fi

echo "3. Alle Telegram-bridges stoppen..."
pkill -f "telegram_bridge.py" 2>/dev/null || true
echo "   Wacht 10 s zodat Telegram de verbinding loslaat..."
sleep 10

echo "4. Alleen Omega starten (launch_factory)..."
./launch_factory.sh

echo ""
echo "Klaar. Test Omega in Telegram."
echo "Als je ook Zwartehand wilt: ./scripts/launch_zwartehand.sh"
echo "Blijft Conflict? Dan draait Omega ook elders (bijv. NUC) — zet hem daar uit."
