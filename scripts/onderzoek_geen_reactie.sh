#!/usr/bin/env bash
# Grondig onderzoek: waarom reageert de Telegram-bot niet?
# Run: cd ~/AI_HQ && ./scripts/onderzoek_geen_reactie.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  ONDERZOEK: waarom geen reactie van de bot?"
echo "  $ROOT"
echo "=============================================="
echo ""

# ——— 1. Welk bridge-bestand wordt gestart? ———
echo "1. BRIDGE-BESTAND (launch_factory start ROOT/telegram_bridge.py)"
if [ -f "$ROOT/telegram_bridge.py" ]; then
  echo "  ✓ $ROOT/telegram_bridge.py bestaat"
else
  echo "  ✗ $ROOT/telegram_bridge.py ONTBREEKT — sync vanaf laptop: ./scripts/sync_naar_nuc.sh"
fi
if [ -f "$ROOT/factory_core/telegram_bridge.py" ]; then
  echo "  ✓ $ROOT/factory_core/telegram_bridge.py bestaat"
else
  echo "  ○ factory_core/telegram_bridge.py niet aanwezig"
fi
echo ""

# ——— 2. Token: placeholder = crash bij start ———
echo "2. TOKEN (placeholder = bridge crasht direct)"
if [ ! -f "$ROOT/.env" ]; then
  echo "  ✗ Geen .env — run ./scripts/create_env_if_missing.sh en vul TELEGRAM_BOT_TOKEN in"
else
  TOKEN=$(grep -m1 "^TELEGRAM_BOT_TOKEN=" "$ROOT/.env" 2>/dev/null | sed 's/^TELEGRAM_BOT_TOKEN=//' | tr -d '"' | tr -d "'" | tr -d '\r')
  if [ -z "$TOKEN" ]; then
    echo "  ✗ TELEGRAM_BOT_TOKEN is leeg in .env"
  elif [ "$TOKEN" = "123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ] || echo "$TOKEN" | grep -q "xxx"; then
    echo "  ✗ Nog de PLACEHOLDER — Telegram weigert die. Bridge crasht met InvalidToken."
    echo "    Fix: nano .env en plak de echte token van @BotFather"
  else
    echo "  ✓ Token gezet (geen placeholder)"
    # Snelle API-check
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://api.telegram.org/bot${TOKEN}/getMe" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      echo "  ✓ getMe 200 — token geldig bij Telegram"
    else
      echo "  ✗ getMe $CODE — token ongeldig of netwerkprobleem"
    fi
  fi
fi
echo ""

# ——— 3. holding.config (ontbreekt = crash bij /start) ———
echo "3. MODULE holding.config (nodig voor /start-handler)"
if python3 -c "import sys; sys.path.insert(0, '$ROOT'); import holding.config" 2>/dev/null; then
  echo "  ✓ import holding.config OK"
else
  echo "  ✗ ModuleNotFoundError: holding.config — bij /start crasht de handler, geen reactie."
  echo "    Fix: er moet holding/config.py bestaan (is nu in repo). Sync: ./scripts/sync_naar_nuc.sh"
fi
echo ""

# ——— 4. Proces en log ———
echo "4. BRIDGE-PROCES"
if pgrep -f "telegram_bridge" >/dev/null; then
  echo "  ✓ Bridge draait (PID: $(pgrep -f 'telegram_bridge' | tr '\n' ' '))"
else
  echo "  ✗ Geen bridge-proces — waarschijnlijk gecrasht bij opstart (zie token) of na /start (zie holding.config)"
fi
echo ""

echo "5. LAATSTE FOUTEN IN LOG (relevante regels)"
for pattern in "InvalidToken" "ModuleNotFoundError" "holding.config" "Error" "Traceback" "Exception"; do
  LINE=$(grep -n "$pattern" "$ROOT/logs/telegram_bridge.log" 2>/dev/null | tail -1)
  [ -n "$LINE" ] && echo "  $LINE"
done
echo ""
echo "  (volledige tail: tail -80 logs/telegram_bridge.log)"
echo ""

# ——— 6. Webhook ———
echo "6. WEBHOOK"
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env" 2>/dev/null || true; set +a
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
    INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" 2>/dev/null || echo "{}")
    if echo "$INFO" | grep -q '"url":""'; then
      echo "  ✓ Geen webhook — polling kan updates ontvangen"
    else
      echo "  ⚠ Webhook gezet — run ./scripts/telegram_webhook_uit.sh"
    fi
  fi
fi
echo ""

echo "=============================================="
echo "  SAMENVATTING & ACTIES"
echo "=============================================="
echo "  • Placeholder token    → nano .env, echte token van @BotFather"
echo "  • holding.config mist → sync vanaf laptop: ./scripts/sync_naar_nuc.sh"
echo "  • Webhook gezet       → ./scripts/telegram_webhook_uit.sh"
echo "  • Daarna herstarten   → ./launch_factory.sh"
echo "  • Live fout zien      → python3 telegram_bridge.py (voorgrond)"
echo ""
