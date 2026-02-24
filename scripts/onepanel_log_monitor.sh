#!/usr/bin/env bash
# Omega AI-Holding — 1Panel / Docker error logs monitoren; bij kritieke fout Telegram sturen.
# Jarvis: "Meneer, container [BU-Marketing] is gecrasht. Ik heb 1Panel opdracht gegeven voor een herstart."
# Run als cron of systemd timer, of start in achtergrond: nohup ./scripts/onepanel_log_monitor.sh >> logs/onepanel_monitor.log 2>&1 &
# Vereist: .env met TELEGRAM_BOT_TOKEN en TELEGRAM_CHAT_ID (of een vaste chat-id); optioneel .env.1panel voor 1Panel API.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p logs

# Laad .env voor Telegram
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env" 2>/dev/null || true
  set +a
fi

# Chat-id waar Jarvis naartoe stuurt (jouw Telegram chat-id)
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
if [ -z "$CHAT_ID" ]; then
  echo "  TELEGRAM_CHAT_ID niet gezet. Stel in .env in voor log-alerts."
  exit 0
fi

# Optioneel: 1Panel API voor herstart
if [ -f "$ROOT/.env.1panel" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env.1panel" 2>/dev/null || true
  set +a
fi

# Voorbeeld: check of omega-containers nog draaien (docker)
SEND_ALERT() {
  local msg="$1"
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${CHAT_ID}&text=${msg}&disable_web_page_preview=1" >/dev/null 2>&1 || true
  fi
  echo "[$(date -Iseconds)] ALERT: $msg"
}

# Check Docker containers (omega-*)
if command -v docker >/dev/null 2>&1; then
  for name in omega-telegram-bridge omega-heartbeat omega-dashboard omega-engineer; do
    status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
    if [ "$status" != "running" ] && [ "$status" != "missing" ]; then
      SEND_ALERT "Jarvis: container [$name] is niet running (status=$status). Overweeg herstart via 1Panel of: docker start $name"
    fi
  done
fi

# Optioneel: 1Panel API aanroepen voor herstart (voorbeeld)
# if [ -n "$ONEPANEL_BASE_URL" ] && [ -n "$ONEPANEL_API_KEY" ]; then
#   python3 "$ROOT/scripts/onepanel_api.py" restart-container "omega-dashboard" && \
#     SEND_ALERT "Jarvis: 1Panel opdracht gegeven voor herstart container omega-dashboard."
# fi

exit 0
