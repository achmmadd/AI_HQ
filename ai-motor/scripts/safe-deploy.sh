#!/usr/bin/env bash
# Production deploy: build must finish (exit 0) before PM2 restart — never restart on a failed/incomplete build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== safe-deploy: directory $ROOT =="

REBUILD_NODE="${AI_MOTOR_NODE:-$(command -v node)}"
export PATH="$(dirname "$REBUILD_NODE"):${PATH}"
echo "== safe-deploy: node $(command -v node) ($(node -v)) =="

echo "== safe-deploy: npm run build (wacht op exit 0) =="
npm run build
echo "== safe-deploy: build geslaagd =="

echo "== safe-deploy: pm2 restart ecosystem.config.cjs --update-env =="
pm2 restart ecosystem.config.cjs --update-env
echo "== safe-deploy: PM2 herstart =="

BASE="${BASE_URL:-http://127.0.0.1:3040}"
HEALTH_URL="${BASE}/api/health"
if [[ "${SKIP_HEALTH_CHECK:-0}" != "1" ]]; then
  echo "== safe-deploy: health check @ ${HEALTH_URL} =="
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "$HEALTH_URL" -o /tmp/motor-health.json 2>/dev/null; then
      echo "== safe-deploy: health OK (poging $i) =="
      node -e "const j=require('/tmp/motor-health.json'); console.log('  status:', j.status||j.ok||'ok');" 2>/dev/null || true
      echo "== safe-deploy: klaar =="
      exit 0
    fi
    sleep 2
  done
  echo "⚠ safe-deploy: health check timeout — PM2 draait wel; controleer logs: pm2 logs ai-motor --lines 30" >&2
  exit 1
fi

echo "== safe-deploy: klaar (health check overgeslagen: SKIP_HEALTH_CHECK=1) =="
