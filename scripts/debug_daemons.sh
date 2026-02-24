#!/usr/bin/env bash
# Waarom reageert de bot niet? Run op de NUC: cd ~/AI_HQ && ./scripts/debug_daemons.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  Debug: waarom geen reactie van de bot?"
echo "  $ROOT"
echo "=============================================="
echo ""

# 1. Bestand en proces
echo "1. BRIDGE BESTAND & PROCES"
if [ -f "$ROOT/telegram_bridge.py" ]; then
  echo "  ✓ telegram_bridge.py aanwezig"
else
  echo "  ✗ telegram_bridge.py ONTBREEKT — sync vanaf laptop: ./scripts/sync_naar_nuc.sh"
fi
if pgrep -f "telegram_bridge" >/dev/null; then
  echo "  ✓ Bridge-proces draait (PID: $(pgrep -f 'telegram_bridge' | tr '\n' ' '))"
else
  echo "  ✗ Geen bridge-proces — waarschijnlijk gecrasht. Zie log hieronder."
fi
echo ""

# 2. Laatste regels bridge-log (belangrijkste voor crash)
echo "2. LAATSTE REGELS telegram_bridge.log"
if [ -f "$ROOT/logs/telegram_bridge.log" ]; then
  tail -60 "$ROOT/logs/telegram_bridge.log"
else
  echo "  (bestand niet gevonden)"
fi
echo ""

# 3. Webhook? Als er een webhook staat, krijgt polling geen updates
echo "3. TELEGRAM WEBHOOK (als er een webhook staat, reageert de bot niet op polling)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env" 2>/dev/null || true
  set +a
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
    INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" 2>/dev/null || echo "{}")
    if echo "$INFO" | grep -q '"url":""'; then
      echo "  ✓ Geen webhook — polling kan updates ontvangen."
    elif echo "$INFO" | grep -q '"url":"[^"]*"'; then
      echo "  ⚠ Er staat een webhook — daarom geen reactie. Verwijderen: ./scripts/telegram_webhook_uit.sh"
      echo "$INFO" | head -c 200
    else
      echo "  ? getWebhookInfo: $INFO"
    fi
  else
    echo "  ○ Token niet gezet in .env"
  fi
else
  echo "  ○ Geen .env"
fi
echo ""

# 4. Overige logs
echo "4. HEARTBEAT / STREAMLIT (laatste regels)"
tail -15 "$ROOT/logs/heartbeat.log" 2>/dev/null || echo "  (geen heartbeat.log)"
tail -10 "$ROOT/logs/streamlit.log" 2>/dev/null || echo "  (geen streamlit.log)"
echo ""

echo "=============================================="
echo "  WAT NU?"
echo "=============================================="
echo "  • Als er een webhook staat:  ./scripts/telegram_webhook_uit.sh"
echo "  • Daarna bridge herstarten:  ./launch_factory.sh"
echo "  • Of bridge in voorgrond (zie je fout direct):  python3 telegram_bridge.py"
echo ""
