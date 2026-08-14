#!/usr/bin/env bash
# install-llama-service.sh — eenmalige installatie van de motor-pilot-llama
# systemd-unit op de RTX-pc. Enige systeemwijziging na de GPU-driver.
# Uitvoering door de operator:
#   RTX_TAILNET_IP=100.x.y.z sudo -E bash ~/motor-pilot/install-llama-service.sh
#
# Vereiste runtime-configuratie (env; staat bewust niet in de repo):
#   RTX_TAILNET_IP   tailnet-IP van deze RTX-pc
# Optioneel:
#   LLAMA_USER       linux-user voor de unit      (default: $SUDO_USER of $USER)
#   LLAMA_HOME       homedir met motor-pilot/     (default: /home/$LLAMA_USER)
#   MODEL_PATH       pad naar de GGUF             (default: $LLAMA_HOME/models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf)
#   UNIT_SRC         template-pad                 (default: $LLAMA_HOME/motor-pilot/motor-pilot-llama.service)
#
# Stopt eerst de tijdelijke nohup-server (poort 8080), rendert en installeert
# daarna de unit, en wacht op health.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Draai dit script met sudo:  RTX_TAILNET_IP=100.x.y.z sudo -E bash $0" >&2
  exit 1
fi

RTX_TAILNET_IP="${RTX_TAILNET_IP:?ontbreekt — tailnet-IP van deze RTX-pc}"
LLAMA_USER="${LLAMA_USER:-${SUDO_USER:-$USER}}"
LLAMA_HOME="${LLAMA_HOME:-/home/$LLAMA_USER}"
MODEL_PATH="${MODEL_PATH:-$LLAMA_HOME/models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf}"
UNIT_SRC="${UNIT_SRC:-$LLAMA_HOME/motor-pilot/motor-pilot-llama.service}"
UNIT_DST="/etc/systemd/system/motor-pilot-llama.service"

echo "== motor-pilot: systemd-unit installeren =="
[[ -f "$UNIT_SRC" ]] || { echo "✗ unit-template ontbreekt: $UNIT_SRC"; exit 1; }
[[ -f "$MODEL_PATH" ]] || { echo "✗ model ontbreekt: $MODEL_PATH"; exit 1; }

echo "── Tijdelijke nohup-server stoppen (indien actief) ──"
pkill -f "llama-server.*--port 8080" 2>/dev/null && echo "  nohup-server gestopt" || echo "  geen nohup-server actief"
sleep 2

echo "── Unit renderen (placeholders → runtime-waarden) en activeren ──"
sed -e "s|@LLAMA_USER@|$LLAMA_USER|g" \
    -e "s|@LLAMA_HOME@|$LLAMA_HOME|g" \
    -e "s|@MODEL_PATH@|$MODEL_PATH|g" \
    -e "s|@RTX_TAILNET_IP@|$RTX_TAILNET_IP|g" \
    "$UNIT_SRC" > "$UNIT_DST"
chmod 644 "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now motor-pilot-llama

echo "── Wachten op health (model laadt opnieuw in VRAM) ──"
for i in $(seq 1 60); do
  if curl -sf "http://$RTX_TAILNET_IP:8080/health" >/dev/null 2>&1; then
    echo "✓ health OK — llama-server draait nu onder systemd (start voortaan automatisch bij boot)"
    systemctl --no-pager --full status motor-pilot-llama | head -5
    exit 0
  fi
  sleep 5
done
echo "✗ geen health binnen 5 minuten — zie: journalctl -u motor-pilot-llama -n 50"
exit 1
