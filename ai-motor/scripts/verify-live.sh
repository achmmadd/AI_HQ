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

echo "== klaar. Start PM2: pm2 start ecosystem.config.cjs --update-env =="
