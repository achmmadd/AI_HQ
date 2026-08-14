#!/usr/bin/env bash
# install-llama-service.sh — eenmalige installatie van de motor-pilot-llama
# systemd-unit op de RTX-pc (motorai-server). Enige systeemwijziging na de
# GPU-driver. Uitvoering door de operator:
#   sudo bash ~/motor-pilot/install-llama-service.sh
# Stopt eerst de tijdelijke nohup-server (poort 8080), installeert en start
# daarna de unit, en wacht op health.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Draai dit script met sudo:  sudo bash $0" >&2
  exit 1
fi

UNIT_SRC="/home/motorai/motor-pilot/motor-pilot-llama.service"
UNIT_DST="/etc/systemd/system/motor-pilot-llama.service"

echo "== motor-pilot: systemd-unit installeren =="
[[ -f "$UNIT_SRC" ]] || { echo "✗ unit ontbreekt: $UNIT_SRC"; exit 1; }

echo "── Tijdelijke nohup-server stoppen (indien actief) ──"
pkill -f "llama-server.*--port 8080" 2>/dev/null && echo "  nohup-server gestopt" || echo "  geen nohup-server actief"
sleep 2

echo "── Unit installeren en activeren ──"
install -m 644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now motor-pilot-llama

echo "── Wachten op health (model laadt opnieuw in VRAM) ──"
for i in $(seq 1 60); do
  if curl -sf "http://100.118.204.123:8080/health" >/dev/null 2>&1; then
    echo "✓ health OK — llama-server draait nu onder systemd (start voortaan automatisch bij boot)"
    systemctl --no-pager --full status motor-pilot-llama | head -5
    exit 0
  fi
  sleep 5
done
echo "✗ geen health binnen 5 minuten — zie: journalctl -u motor-pilot-llama -n 50"
exit 1
