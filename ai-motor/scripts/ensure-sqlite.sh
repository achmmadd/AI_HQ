#!/usr/bin/env bash
# Rebuild better-sqlite3 alleen bij ABI-mismatch met de huidige Node.
# CI-vriendelijk: mislukte rebuild breekt npm install niet (exit 0), tenzij STRICT=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REBUILD_NODE="${AI_MOTOR_NODE:-$(command -v node)}"
export PATH="$(dirname "$REBUILD_NODE"):${PATH}"

if "$REBUILD_NODE" -e "require('better-sqlite3')" 2>/dev/null; then
  exit 0
fi

echo "ensure-sqlite: better-sqlite3 past niet bij $($REBUILD_NODE -v) — rebuild…" >&2
NPM_CLI="$(dirname "$REBUILD_NODE")/npm"
[[ -x "$NPM_CLI" ]] || NPM_CLI="$(command -v npm)"

if "$REBUILD_NODE" "$NPM_CLI" rebuild better-sqlite3 --foreground-scripts; then
  echo "ensure-sqlite: rebuild geslaagd" >&2
  exit 0
fi

echo "ensure-sqlite: rebuild mislukt — op server: bash scripts/pm2-safe-restart.sh" >&2
[[ "${STRICT:-0}" == "1" ]] && exit 1
exit 0
