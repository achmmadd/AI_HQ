#!/usr/bin/env bash
# Registreer MotorsAI MCP servers op OpenClaw (Node 22+).
set -euo pipefail
export PATH="${HOME}/.nvm/versions/node/v22.22.2/bin:${HOME}/.npm-global/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_JSON="${ROOT}/factory-os/openclaw/motors-tools.json"

if ! command -v openclaw >/dev/null; then
  echo "openclaw niet gevonden — installeer met: npm install -g openclaw@latest (Node 22+)"
  exit 1
fi

echo "OpenClaw: $(openclaw --version)"
echo "Motors tools manifest: ${TOOLS_JSON}"
echo ""
echo "Bestaande MCP servers:"
openclaw mcp list 2>/dev/null || true
echo ""
echo "Zorg dat gateway chat completions aan staat (zie ai-motor/docs/ONE_SESSION_OPENCLAW_VSCODE.md)."
echo "Motors HTTP tools draaien tegen ai-motor :3040 — start PM2 ai-motor indien nodig."
echo ""
echo "Handmatig: gebruik motors-tools.json als referentie voor n8n/qdrant/dify MCP die al in openclaw.json staan."
