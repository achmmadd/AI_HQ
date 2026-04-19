#!/usr/bin/env bash
# Stop alle telegram_bridge instanties: Docker container + alle host-processen (incl. root).
# Gebruik op de NUC vóór je de bridge handmatig opnieuw start.
# Run: bash scripts/stop_all_bridge.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Stoppen van alle Omega Telegram Bridge instanties..."

# 1. Docker container (draait vaak als root)
if command -v docker >/dev/null 2>&1; then
  if docker ps -q -f name=omega-telegram-bridge 2>/dev/null | grep -q .; then
    docker stop omega-telegram-bridge 2>/dev/null && echo "  ✓ Docker container omega-telegram-bridge gestopt" || true
  fi
fi

# 2. Alle host-processen (pietje + root)
for pid in $(pgrep -f "telegram_bridge.py" 2>/dev/null); do
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
done
sleep 2
# Forceer rest (bijv. root)
for pid in $(pgrep -f "telegram_bridge.py" 2>/dev/null); do
  echo "  Force stop PID $pid (sudo)..."
  sudo kill -9 "$pid" 2>/dev/null || true
done
sleep 1

if pgrep -f "telegram_bridge.py" >/dev/null 2>&1; then
  echo "  ⚠ Nog processen over. Handmatig: sudo pkill -9 -f telegram_bridge.py"
  exit 1
fi
echo "  ✓ Alle bridge-processen gestopt."
echo ""
echo "Start daarna ÉÉN keer: cd $ROOT && source venv/bin/activate && nohup python3 telegram_bridge.py >> logs/telegram_bridge.log 2>&1 &"
