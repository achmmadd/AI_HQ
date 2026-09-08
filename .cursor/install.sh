#!/usr/bin/env bash
# Idempotent install for the active Motor app (ai-motor). Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/ai-motor"

# Deterministic install from the committed lockfile.
npm ci

# Fail fast if the runtime Node major does not match .nvmrc (22).
node scripts/assert-node-version.mjs

# Ensure better-sqlite3 native binding matches the current Node ABI.
bash scripts/ensure-sqlite.sh

# Provide predictable dev credentials + SQLite-only config if not already present.
# demo123 is the app's built-in development password (see lib/auth-session.ts);
# these are dev-only, non-secret defaults. .env.local is gitignored.
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Auto-generated dev env for Cloud Agent (SQLite, no external services).
MOTORSAI_PASSWORD=demo123
MOTORSAI_SESSION_SECRET=dev-local-session-secret-change-me
USE_POSTGRES=0
POSTGRES_PRIMARY=0
SQLITE_FALLBACK=1
MOTORSAI_DEV_PANEL=1
EOF
  echo "install.sh: created ai-motor/.env.local with dev defaults"
fi

echo "install.sh: done"
