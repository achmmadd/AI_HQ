#!/usr/bin/env bash
# Nightly: feedback-digest, experiments, automation. Vereist FEEDBACK_CRON_SECRET + draaiende app op :3040.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

SECRET="${FEEDBACK_CRON_SECRET:-}"
BASE="${MOTOR_APP_URL:-http://127.0.0.1:3040}"

if [[ -z "$SECRET" ]]; then
  echo "FEEDBACK_CRON_SECRET ontbreekt"
  exit 1
fi

DATE="$(date +%Y-%m-%d)"
echo "Nightly improvement: $DATE"

curl -sS "${BASE}/api/cron/feedback-digest?date=${DATE}&secret=${SECRET}" --max-time 60 || true

curl -sS -X POST "${BASE}/api/cron/experiments/run?secret=${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"seed_if_idle":true}' \
  --max-time 120 || true

curl -sS -X POST "${BASE}/api/cron/automation?secret=${SECRET}" --max-time 180 || true

echo "Done."
