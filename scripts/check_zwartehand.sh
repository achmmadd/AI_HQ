#!/usr/bin/env bash
# Snel check: draait Zwartehandbot en wat zegt de log? Run op NUC: ./scripts/check_zwartehand.sh
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== Zwartehandbot ==="
echo "Proces (--zwartehand):"
pgrep -af "telegram_bridge.py --zwartehand" 2>/dev/null || echo "  Geen proces — start: ./scripts/launch_zwartehand.sh"
echo ""
echo "Laatste regels log:"
tail -25 "$ROOT/logs/telegram_bridge_zwartehand.log" 2>/dev/null || echo "  Geen log."
echo ""
echo "Token in .env.zwartehand (eerste 20 tekens):"
grep -m1 "TELEGRAM_BOT_TOKEN=" "$ROOT/.env.zwartehand" 2>/dev/null | sed 's/\(.\{20\}\).*/\1.../' || echo "  Bestand niet gevonden."
