#!/usr/bin/env bash
# Start Zwartehandbot (tweede Telegram-bot naast Omega).
# Gebruik: ./scripts/launch_zwartehand.sh
# Eerst Omega starten: ./launch_factory.sh   daarna dit script.
# Token zetten: nano .env.zwartehand   → TELEGRAM_BOT_TOKEN=<token van @BotFather voor Zwartehandbot>

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env.zwartehand"
LOG_FILE="$ROOT/logs/telegram_bridge_zwartehand.log"

mkdir -p logs

if [ ! -f "$ENV_FILE" ]; then
  echo "  Geen .env.zwartehand. Aanmaken — vul daarna de token van @BotFather voor Zwartehandbot in:"
  echo "  nano $ENV_FILE"
  echo "TELEGRAM_BOT_TOKEN=PLACEHOLDER_VERVANG_DOOR_ZWARTEHANDBOT_TOKEN" > "$ENV_FILE"
  echo ""
  exit 1
fi
if ! grep -q "TELEGRAM_BOT_TOKEN=.*[0-9].*:AA" "$ENV_FILE" 2>/dev/null || grep -q "PLACEHOLDER\|xxx" "$ENV_FILE" 2>/dev/null; then
  echo "  ⚠ Zet in .env.zwartehand de echte TELEGRAM_BOT_TOKEN van @BotFather (Zwartehandbot)."
  echo "  nano $ENV_FILE"
  exit 1
fi

# Venv
[ -d "$ROOT/venv" ] && [ -f "$ROOT/venv/bin/activate" ] && source "$ROOT/venv/bin/activate"

# Stop eventueel oude Zwartehand-bridge, start opnieuw
pkill -f "telegram_bridge.py --zwartehand" 2>/dev/null || true
sleep 2
nohup python3 "$ROOT/telegram_bridge.py" --zwartehand >> "$LOG_FILE" 2>&1 &
disown 2>/dev/null || true
echo "  ✓ Zwartehandbot (daemon). Log: $LOG_FILE"
echo "  Stop alle bridges: pkill -f telegram_bridge.py   (dan opnieuw: ./launch_factory.sh en daarna dit script)"
echo ""
