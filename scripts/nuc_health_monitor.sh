#!/usr/bin/env bash
# NUC health monitor — bedoeld voor cron (elk uur).
set -euo pipefail
cd /home/pietje/AI_HQ
set -a
# shellcheck disable=SC1091
source .env
set +a

ALERTS=""
REPORT=""

check_service() {
  local name=$1
  local url=$2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if echo "$code" | grep -qE '^(200|207|401)$'; then
    REPORT="${REPORT}"$'\n'"✅ $name"
  else
    REPORT="${REPORT}"$'\n'"❌ $name ($code)"
    ALERTS="${ALERTS}"$'\n'"❌ $name is DOWN (HTTP $code)"
  fi
}

check_service "AI Motor" "http://127.0.0.1:3040/"
check_service "n8n" "http://127.0.0.1:5678/healthz"
check_service "Qdrant" "http://127.0.0.1:6333/healthz"
check_service "Ollama" "http://127.0.0.1:11434/api/tags"
DIFY_URL="${DIFY_BASE_URL:-http://127.0.0.1:5001}"
check_service "Dify" "${DIFY_URL}/console/api/setup"

DISK_FREE=$(df -h / | awk 'NR==2{print $4}')
DISK_PCT=$(df / | awk 'NR==2{print $5}' | tr -d '%')
if [ "${DISK_PCT:-0}" -gt 85 ] 2>/dev/null; then
  ALERTS="${ALERTS}"$'\n'"⚠️ Schijf bijna vol: ${DISK_PCT}% gebruikt"
fi

RAM_FREE=$(free -h | awk '/^Mem:/{print $4}')

export ALERTS REPORT DISK_FREE RAM_FREE

if [ -n "${ALERTS//[$'\t\r\n ']/}" ]; then
  python3 << 'PY'
import json, os, urllib.request

token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
if not token or not chat_id:
    raise SystemExit(0)

msg = f"""🚨 NUC ALERT

Problemen:{os.environ.get("ALERTS", "")}

Status:{os.environ.get("REPORT", "")}

Schijf vrij: {os.environ.get("DISK_FREE", "?")}
RAM vrij: {os.environ.get("RAM_FREE", "?")}
"""

data = json.dumps({"chat_id": chat_id, "text": msg}).encode()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/sendMessage",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
urllib.request.urlopen(req, timeout=20)
print("Alert verstuurd")
PY
fi

HOUR=$(date +%H)
if [ "$HOUR" = "07" ]; then
  python3 << 'PY'
import json, os, urllib.request
from datetime import date

token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
if not token or not chat_id:
    raise SystemExit(0)

msg = f"""🌅 Factory OS dagrapport — {date.today().isoformat()}
{os.environ.get("REPORT", "")}

Schijf: {os.environ.get("DISK_FREE", "?")} vrij
RAM: {os.environ.get("RAM_FREE", "?")} vrij
"""

data = json.dumps({"chat_id": chat_id, "text": msg}).encode()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/sendMessage",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
urllib.request.urlopen(req, timeout=20)
PY
fi
