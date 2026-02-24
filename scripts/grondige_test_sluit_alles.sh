#!/usr/bin/env bash
# Grondige test — daarna kun je alles sluiten en in Telegram/browser testen.
# Run op de NUC: cd ~/AI_HQ && ./scripts/grondige_test_sluit_alles.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  GRONDIGE TEST — daarna alles sluiten"
echo "  $ROOT"
echo "=============================================="
echo ""

# 1. Stoppen en schoon starten
echo "1. Schoon starten (oude processen stoppen, opnieuw starten)..."
pkill -f telegram_bridge 2>/dev/null || true
pkill -f heartbeat.py 2>/dev/null || true
pkill -f "streamlit run" 2>/dev/null || true
sleep 3
./launch_factory.sh
echo ""
echo "   Wachten 12 s tot daemons opstarten..."
sleep 12
echo ""

# 2. Grote controle
echo "2. Grote controle"
./scripts/grote_controle_alles.sh
CONTROLE_EXIT=$?
echo ""

# 3. Telegram API (getMe)
echo "3. Telegram API (getMe)"
if [ -f .env ]; then
  set -a; source .env 2>/dev/null || true; set +a
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      echo "  ✓ getMe 200 — bot token geldig"
    else
      echo "  ✗ getMe $CODE — controleer token"
    fi
  else
    echo "  ○ Token niet gezet; skip"
  fi
fi
echo ""

# 4. Dashboard (poort 8501)
echo "4. Dashboard (localhost:8501)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8501 2>/dev/null || echo "000")
if [ "$CODE" = "200" ] || [ "$CODE" = "302" ]; then
  echo "  ✓ Dashboard reageert (HTTP $CODE)"
else
  echo "  ✗ Geen antwoord (HTTP $CODE)"
fi
echo ""

# 5. 24/7-check (parent van bridge)
echo "5. 24/7 (blijft draaien na sluiten terminal?)"
BRIDGE_PID=$(pgrep -f "telegram_bridge.py" 2>/dev/null | head -1)
if [ -n "$BRIDGE_PID" ]; then
  PPID=$(ps -o ppid= -p "$BRIDGE_PID" 2>/dev/null | tr -d ' ')
  PCOMM=$(ps -o comm= -p "$PPID" 2>/dev/null || echo "")
  if [ "$PPID" = "1" ] || [ "$PCOMM" = "systemd" ]; then
    echo "  ✓ Daemons onder PID 1/systemd — blijven draaien na sluiten terminal"
  else
    echo "  ⚠ Parent: $PCOMM (PID $PPID). Voor 24/7: ./scripts/start_24_7.sh systemd"
  fi
else
  echo "  ✗ Geen bridge-proces; start: ./launch_factory.sh"
fi
echo ""

echo "=============================================="
echo "  SLUIT NU ALLES EN TEST"
echo "=============================================="
echo ""
echo "  • Sluit je SSH-sessie of terminal (de Holding blijft draaien)."
echo ""
echo "  • Telegram: open je Omega-bot, typ /start"
echo "    → Je zou het menu moeten zien. Test ook /status of /task test."
echo ""
echo "  • Dashboard (optioneel): op een apparaat in hetzelfde netwerk:"
echo "    → Browser: http://192.168.178.43:8501"
echo "    (of ssh -L 8501:127.0.0.1:8501 pietje@192.168.178.43 en dan http://localhost:8501)"
echo ""
echo "  • Na reboot: als je systemd enable hebt gedaan, start de Holding"
echo "    automatisch. Anders: ssh naar NUC en run ./launch_factory.sh"
echo ""
echo "  • Logs bekijken (na opnieuw inloggen):"
echo "    tail -f ~/AI_HQ/logs/telegram_bridge.log"
echo ""
if [ "$CONTROLE_EXIT" -ne 0 ]; then
  echo "  ⚠ Er waren gefaalde checks; zie boven. Fix die eerst als iets niet werkt."
  exit 1
fi
echo "  Klaar. Succes met testen."
exit 0
