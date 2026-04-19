#!/usr/bin/env bash
# Onderzoek waarom er meerdere telegram_bridge processen draaien (409 Conflict).
# Run op de NUC: bash scripts/diagnose_bridge_conflict.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  DIAGNOSE: telegram_bridge (409 Conflict)"
echo "=============================================="
echo ""

echo "1. DOCKER — container omega-telegram-bridge?"
if command -v docker >/dev/null 2>&1; then
  if docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -q omega-telegram-bridge; then
    docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'NAMES|omega-telegram'
    echo "   → Als Status 'Up' is: Docker draait de bridge (vaak als root). Stop met: docker stop omega-telegram-bridge"
  else
    echo "   Geen container omega-telegram-bridge gevonden."
  fi
else
  echo "   Docker niet geïnstalleerd."
fi
echo ""

echo "2. SYSTEMD USER — omega-holding.service?"
if systemctl --user list-units --type=service 2>/dev/null | grep -q omega-holding; then
  systemctl --user is-active omega-holding.service 2>/dev/null && echo "   Actief (start bridge bij inloggen)" || echo "   Inactief"
else
  echo "   Service niet geladen of niet actief."
fi
echo ""

echo "3. ALLE telegram_bridge.py PROCESSEN (eigenaar + PID)"
ps aux | grep -E '[p]ython3.*telegram_bridge\.py' || true
echo "   → USER=root → vaak Docker of ooit met sudo gestart."
echo "   → USER=pietje → handmatig of systemd --user."
echo ""

echo "4. AANBEVELING"
BRIDGE_COUNT=$(pgrep -f "telegram_bridge.py" 2>/dev/null | wc -l)
if [ "$BRIDGE_COUNT" -gt 1 ]; then
  echo "   Er draaien $BRIDGE_COUNT processen. Gebruik: bash scripts/stop_all_bridge.sh"
  echo "   Daarna: start de bridge maar ÉÉN keer (zie docs/BRIDGE_OP_NUC.md)."
else
  echo "   Er draait $BRIDGE_COUNT proces. Geen conflict."
fi
echo "=============================================="
