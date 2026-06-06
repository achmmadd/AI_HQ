#!/usr/bin/env bash
# Naloop na sprint / vóór live: lint, build, native module voor de Node die PM2 ook gebruikt.
set -euo pipefail
cd "$(dirname "$0")/.."

REBUILD_NODE="${AI_MOTOR_NODE:-$(command -v node)}"
export PATH="$(dirname "$REBUILD_NODE"):${PATH}"

echo "== verify-live: node $(command -v node) ($(node -v)) =="

NPM_CLI="$(dirname "$REBUILD_NODE")/npm"
if [[ ! -x "$NPM_CLI" ]]; then
  NPM_CLI="$(command -v npm)"
fi

echo "== rebuild better-sqlite3 met: $REBUILD_NODE =="
"$REBUILD_NODE" "$NPM_CLI" rebuild better-sqlite3 --foreground-scripts

npm run lint
npm run build

if [[ "${SKIP_SMOKE:-0}" != "1" ]]; then
  echo "== smoke-quality (SKIP_CHAT=1, geen LLM-kosten) =="
  SKIP_CHAT=1 node scripts/smoke-quality.mjs || {
    echo "⚠ smoke-quality mislukt — controleer BASE_URL/MOTORSAI_TOKEN of zet SKIP_SMOKE=1"
    exit 1
  }
fi

BASE="${BASE_URL:-http://127.0.0.1:3040}"
if curl -sf "${BASE}/api/admin/integration-readiness" -o /tmp/motor-readiness.json 2>/dev/null; then
  echo "== integration-readiness @ ${BASE} =="
  node -e "
    const j=require('/tmp/motor-readiness.json');
    console.log('  qdrant_collections_ok:', j.memory?.qdrant_collections_ok);
    console.log('  hybrid hetzner_core_ok:', j.hybrid?.hetzner_core_ok);
    console.log('  openclaw ok:', j.openclaw?.ok, j.openclaw?.error||'');
    if (process.env.REQUIRE_INTEGRATION_READINESS==='1' && (!j.memory?.qdrant_collections_ok || !j.openclaw?.ok)) process.exit(1);
    if (process.env.REQUIRE_HYBRID==='1' && !j.hybrid?.hetzner_core_ok) process.exit(1);
  "
else
  echo "== integration-readiness skip (server niet op ${BASE}) =="
fi

if [[ "${REQUIRE_HYBRID:-0}" == "1" ]]; then
  echo "== e2e-hybrid (REQUIRE_HYBRID=1, SKIP_CHAT=1) @ ${BASE} =="
  BASE_URL="${BASE}" SKIP_CHAT=1 node scripts/e2e-hybrid.mjs || {
    echo "⚠ e2e-hybrid mislukt — zet MOTORSAI_TOKEN en start PM2, of docs/nuc-readiness.md"
    exit 1
  }
fi

echo "== klaar. Start PM2: pm2 start ecosystem.config.cjs --update-env =="
