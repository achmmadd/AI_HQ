#!/usr/bin/env bash
# Veilige PM2-restart: Node 22 (.nvmrc), native sqlite-rebuild, BUILD_ID en healthcheck.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
nvm use 2>/dev/null || true

REBUILD_NODE="${AI_MOTOR_NODE:-$(nvm which node 2>/dev/null || true)}"
REBUILD_NODE="${REBUILD_NODE:-/home/pietje/.nvm/versions/node/v22.22.2/bin/node}"
export AI_MOTOR_NODE="$REBUILD_NODE"
export PATH="$(dirname "$REBUILD_NODE"):${PATH}"

echo "== pm2-safe-restart: node $(command -v node) ($(node -v)) =="

STRICT=1 bash scripts/ensure-sqlite.sh

BUILD_ID_FILE=".next/BUILD_ID"
if [[ ! -f "$BUILD_ID_FILE" ]]; then
  echo "⚠ .next/BUILD_ID ontbreekt — eerst: npm run build" >&2
  exit 1
fi
echo "== BUILD_ID: $(cat "$BUILD_ID_FILE") =="

pm2 restart ecosystem.config.cjs --only ai-motor --update-env

HEALTH_URL="${MOTORSAI_HEALTH_URL:-http://127.0.0.1:3040/api/health}"
echo "== healthcheck: $HEALTH_URL =="
for attempt in {1..20}; do
  status="$(curl -fsS -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || true)"
  if [[ "$status" == "200" ]]; then
    echo "== pm2-safe-restart: health 200 =="
    exit 0
  fi
  echo "healthcheck poging $attempt/20: HTTP ${status:-000}" >&2
  sleep 1
done

echo "pm2-safe-restart: healthcheck faalde voor $HEALTH_URL" >&2
exit 1
