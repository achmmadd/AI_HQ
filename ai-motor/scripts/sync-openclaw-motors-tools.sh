#!/usr/bin/env bash
# Sync MotorsAI HTTP tool definitions into OpenClaw (~/.openclaw).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="$REPO_ROOT/factory-os/openclaw/motors-tools.json"
DEST_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}"
DEST="$DEST_DIR/motors-tools.json"
OPENCLAW_JSON="$DEST_DIR/openclaw.json"

if [[ ! -f "$SOURCE" ]]; then
  echo "sync-openclaw-motors-tools: source missing: $SOURCE" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$SOURCE" "$DEST"
echo "Copied motors-tools.json → $DEST"

if [[ -f "$OPENCLAW_JSON" ]]; then
  echo ""
  echo "OpenClaw main config: $OPENCLAW_JSON"
  echo "If tools are not loaded automatically, merge motors-tools.json into openclaw.json"
  echo "(MCP / HTTP tools section — see factory-os/openclaw/SYSTEM.md)."
else
  echo "No $OPENCLAW_JSON — motors-tools.json copied standalone."
fi

echo ""
echo "Restart OpenClaw gateway after sync:"
echo "  systemctl --user restart openclaw-gateway"
echo "  # or: openclaw gateway restart"
