#!/usr/bin/env bash
# Register MotorsAI HTTP tools in OpenClaw (~/.openclaw/openclaw.json) via MCP stdio server.
set -euo pipefail

export PATH="${HOME}/.nvm/versions/node/v22.22.2/bin:${HOME}/.npm-global/bin:${PATH}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_MOTOR_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AI_HQ_ROOT="$(cd "$AI_MOTOR_ROOT/.." && pwd)"
MCP_SCRIPT="$SCRIPT_DIR/motors-http-mcp.mjs"
TOOLS_SOURCE="$AI_HQ_ROOT/factory-os/openclaw/motors-tools.json"
ENV_LOCAL="$AI_MOTOR_ROOT/.env.local"
OPENCLAW_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_JSON="$OPENCLAW_DIR/openclaw.json"
TOOLS_DEST="$OPENCLAW_DIR/motors-tools.json"

if [[ ! -f "$TOOLS_SOURCE" ]]; then
  echo "openclaw-register-motors-http: missing $TOOLS_SOURCE" >&2
  exit 1
fi
if [[ ! -f "$MCP_SCRIPT" ]]; then
  echo "openclaw-register-motors-http: missing $MCP_SCRIPT" >&2
  exit 1
fi
if [[ ! -f "$OPENCLAW_JSON" ]]; then
  echo "openclaw-register-motors-http: missing $OPENCLAW_JSON — run openclaw onboard first" >&2
  exit 1
fi

chmod +x "$MCP_SCRIPT"

# Sync tool manifest
mkdir -p "$OPENCLAW_DIR"
cp "$TOOLS_SOURCE" "$TOOLS_DEST"
echo "Synced motors-tools.json → $TOOLS_DEST"

# Ensure MOTORS_INTERNAL_TOKEN in .env.local
if [[ -f "$ENV_LOCAL" ]]; then
  if ! grep -qE '^MOTORS_INTERNAL_TOKEN=.+' "$ENV_LOCAL" 2>/dev/null; then
    TOKEN="$(openssl rand -hex 32)"
    if grep -qE '^MOTORS_INTERNAL_TOKEN=' "$ENV_LOCAL" 2>/dev/null; then
      sed -i "s/^MOTORS_INTERNAL_TOKEN=.*/MOTORS_INTERNAL_TOKEN=$TOKEN/" "$ENV_LOCAL"
    else
      printf '\n# OpenClaw internal HTTP tools\nMOTORS_INTERNAL_TOKEN=%s\n' "$TOKEN" >> "$ENV_LOCAL"
    fi
    echo "Generated MOTORS_INTERNAL_TOKEN in $ENV_LOCAL"
  fi
else
  echo "WARN: $ENV_LOCAL not found — set MOTORS_INTERNAL_TOKEN manually" >&2
fi

# Read secrets for MCP env (never print values)
read_env_var() {
  local key="$1"
  if [[ -f "$ENV_LOCAL" ]]; then
    grep -E "^${key}=" "$ENV_LOCAL" 2>/dev/null | head -1 | cut -d= -f2- || true
  fi
}

MOTORS_TOKEN="$(read_env_var MOTORS_INTERNAL_TOKEN)"
EXECUTOR_SECRET="$(read_env_var LOCAL_EXECUTOR_SECRET)"

python3 << PY
import json, os, shutil
from datetime import datetime, timezone

openclaw_json = os.path.expanduser("${OPENCLAW_JSON}")
backup = openclaw_json + ".bak.motors-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
shutil.copy2(openclaw_json, backup)

with open(openclaw_json, "r", encoding="utf-8") as f:
    cfg = json.load(f)

mcp_script = "${MCP_SCRIPT}"
tools_dest = "${TOOLS_DEST}"
motors_token = """${MOTORS_TOKEN}"""
executor_secret = """${EXECUTOR_SECRET}"""

cfg.setdefault("mcp", {}).setdefault("servers", {})["motors"] = {
    "command": "node",
    "args": [mcp_script],
    "env": {
        "MOTORS_TOOLS_JSON": tools_dest,
        **({"MOTORS_INTERNAL_TOKEN": motors_token} if motors_token else {}),
        **({"LOCAL_EXECUTOR_SECRET": executor_secret} if executor_secret else {}),
    },
    "description": "MotorsAI HTTP tools (ai-motor :3040, executor :8790)",
}

tools = cfg.setdefault("tools", {})
allow = tools.get("allow")
if allow is None:
    allow = []
elif isinstance(allow, str):
    allow = [allow]
else:
    allow = list(allow)
for entry in ("motors__*", "bundle-mcp"):
    if entry not in allow:
        allow.append(entry)
tools["allow"] = allow

with open(openclaw_json, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
os.chmod(openclaw_json, 0o600)

print(f"Merged mcp.servers.motors + tools.allow into {openclaw_json}")
print(f"Backup: {backup}")
if not motors_token:
    print("WARN: MOTORS_INTERNAL_TOKEN empty — save-from-chat internal auth disabled until set")
PY

echo ""
echo "Restart OpenClaw gateway to load MCP tools:"
echo "  systemctl --user restart openclaw-gateway"
echo ""
echo "Restart ai-motor so MOTORS_INTERNAL_TOKEN is active:"
echo "  pm2 restart ai-motor --update-env"
echo ""
echo "Verify tool (Node 22+):"
echo "  openclaw mcp list"
echo "  curl -sS -X POST http://127.0.0.1:3040/api/knowledge/save-from-chat \\"
echo "    -H 'Authorization: Bearer \$MOTORS_INTERNAL_TOKEN' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"klant\":\"fumero\",\"content\":\"Test kennisbank opslag vanuit OpenClaw interne token.\"}'"
