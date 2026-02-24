#!/usr/bin/env bash
# Stop alle Omega Telegram-bridge processen en start één keer opnieuw.
# Gebruik als je "Conflict: getUpdates" ziet of geen menu/commando's werken.

set -e
cd "$(dirname "$0")/.."

echo "Stoppen van alle telegram_bridge processen (inclusief factory_core indien aanwezig)..."
pkill -f "telegram_bridge" 2>/dev/null || true
sleep 3
if pgrep -f "telegram_bridge" >/dev/null 2>&1; then
  echo "Waarschuwing: bridge draait nog. Force kill..."
  pkill -9 -f "telegram_bridge" 2>/dev/null || true
  sleep 2
fi
echo "Starten van launch_factory (één bridge)..."
./launch_factory.sh
echo ""
echo "Test in Telegram: /start (je zou nu het menu moeten zien)."
