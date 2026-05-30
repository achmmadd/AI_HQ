#!/usr/bin/env bash
# Smoke: agent-use Docker, MotorsAI PM2, n8n webhook (Factory-tak snel, browser-tak lang).
set -euo pipefail

AGENT_URL="${AGENT_HEALTH_URL:-http://127.0.0.1:8787/health}"
MOTOR_URL="${MOTOR_HEALTH_URL:-http://127.0.0.1:3040/api/health}"
WEBHOOK_URL="${AGENT_MVP_WEBHOOK:-http://127.0.0.1:5678/webhook/agent-mvp}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing: $1" >&2
    exit 1
  }
}
need_cmd curl

echo "== 1 agent-use /health =="
curl -sS -m 15 -f "$AGENT_URL" | python3 -c "import sys,json; j=json.load(sys.stdin); assert j.get('ok') is True"

echo "== 2 MotorsAI /api/health =="
code="$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "$MOTOR_URL" || echo 000)"
[[ "$code" == "200" ]] || {
  echo "Motor HTTP $code (expected 200)"
  exit 1
}

echo "== 3 webhook agent-mvp (Factory-branch, browser_task=false) ~120s timeout =="
curl -sS -m 130 -f -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"smoke-ready","klant":"verify","browser_task":false,"agent_mode":true}' \
  | python3 -c "import sys,json; j=json.load(sys.stdin); assert j.get('status') in ('ok','error') or 'output' in j or 'answer_raw' in j, j"

echo "READY: core smoke passes. Voor Browserbase/agent-run gebruik curl -m 600 op dezelfde webhook met browser_task:true."
