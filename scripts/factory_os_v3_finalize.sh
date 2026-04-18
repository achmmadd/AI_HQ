#!/usr/bin/env bash
# Eenmalige finalisatie: MCP, Qdrant collection, SYSTEM.md, backup script, cron.
set -euo pipefail
AI_HQ="${AI_HQ:-$HOME/AI_HQ}"
cd "$AI_HQ"

set -a
# shellcheck source=/dev/null
source "$AI_HQ/.env"
set +a

if ! grep -q '^EMBEDDING_DIMENSION=' "$AI_HQ/.env" 2>/dev/null; then
  printf '\n# Factory OS V3 — default; pas aan naar je Dify embedding model\nEMBEDDING_DIMENSION=1536\n' >> "$AI_HQ/.env"
  set -a
  # shellcheck source=/dev/null
  source "$AI_HQ/.env"
  set +a
  echo "✅ EMBEDDING_DIMENSION=1536 toegevoegd aan .env"
fi

: "${DIFY_BASE_URL:?}"

mkdir -p "$HOME/.openclaw/workspaces/factory-os"

python3 << 'PY'
import json, os

home = os.path.expanduser("~")
n8n_key = os.environ.get("N8N_API_KEY", "")
dify_key = os.environ.get(
    "DIFY_AGENT_API_KEY",
    os.environ.get("DIFY_RESEARCH_API_KEY", ""),
)
dify_url = os.environ.get("DIFY_BASE_URL", "").rstrip("/")
if not dify_url:
    raise SystemExit("DIFY_BASE_URL leeg")

config = {
    "mcpServers": {
        "qdrant": {
            "command": "npx",
            "args": ["-y", "@qdrant/mcp-server-qdrant"],
            "env": {
                "QDRANT_URL": "http://localhost:6333",
                "QDRANT_API_KEY": "",
                "COLLECTION_NAME": "factory_os",
            },
            "description": "Kennisbank — factory_os; payload client=fumero|bokas",
        },
        "filesystem": {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-filesystem",
                f"{home}/AI_HQ/factory-os/klanten",
                f"{home}/AI_HQ/factory-os/docs",
            ],
            "description": "Factory OS bestanden",
        },
        "fetch": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-fetch"],
            "description": "Websites ophalen",
        },
        "memory": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-memory"],
            "description": "Sessie-geheugen",
        },
        "n8n": {
            "command": "npx",
            "args": ["-y", "n8n-mcp-server"],
            "env": {
                "N8N_BASE_URL": "http://localhost:5678",
                "N8N_API_KEY": n8n_key,
            },
            "description": "n8n workflows",
        },
        "dify": {
            "command": "npx",
            "args": ["-y", "dify-mcp-server"],
            "env": {
                "DIFY_BASE_URL": dify_url,
                "DIFY_API_KEY": dify_key,
            },
            "description": "Dify agents",
        },
    }
}

path = os.path.expanduser("~/.openclaw/mcp.json")
with open(path, "w") as f:
    json.dump(config, f, indent=2)
os.chmod(path, 0o600)
print("✅", path)
print("   n8n key:", "ok" if n8n_key else "LEEG — vul N8N_API_KEY in .env")
print("   dify key:", "ok" if dify_key else "LEEG")
PY

python3 << 'PY'
import json, os, urllib.request

dim_env = os.environ.get("EMBEDDING_DIMENSION", "").strip()
model = os.environ.get("EMBEDDING_MODEL", "").strip().lower()
KNOWN = {
    "text-embedding-ada-002": 1536,
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "nomic-embed-text": 768,
    "mxbai-embed-large": 1024,
    "bge-m3": 1024,
}
if dim_env.isdigit():
    size = int(dim_env)
elif model in KNOWN:
    size = KNOWN[model]
elif model:
    raise SystemExit(f"Onbekend EMBEDDING_MODEL={model!r}")
else:
    raise SystemExit("EMBEDDING_DIMENSION ontbreekt")

base = "http://localhost:6333"
name = "factory_os"
payload = json.dumps({"vectors": {"size": size, "distance": "Cosine"}}).encode()
req = urllib.request.Request(
    f"{base}/collections/{name}",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="PUT",
)
try:
    with urllib.request.urlopen(req) as r:
        print("✅ Qdrant collection", name, "dim", size, "HTTP", r.status)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if e.code == 409 or "already exists" in body.lower():
        print("ℹ️ factory_os bestond al:", body[:200])
    else:
        raise
with urllib.request.urlopen(f"{base}/collections") as r:
    cols = json.load(r).get("result", {}).get("collections", [])
print("collections:", [c["name"] for c in cols])
PY

cat > "$HOME/.openclaw/workspaces/factory-os/SYSTEM.md" << 'SYSEOF'
# Factory OS — OpenClaw CEO

Je bent de CEO van Factory OS voor Pietje.

## Bedrijven
- Fumero (fumero.nl) — HHC e-commerce, 18+, premium, discreet
- Bokas — horeca

## Qdrant (één collection)
- Collection: **factory_os**
- Payload **`client`**: `fumero` of `bokas`

## Toolvolgorde
1. memory → 2. qdrant (met client-filter) → 3. dify / n8n / fetch / filesystem

## Niet autonoom zonder toestemming
- E-mail, bestellingen, betalingen, klantcontact

## Outputformaat
# [Titel]
**Bedrijf:** [naam] · **Afdeling:** [@naam]
## Samenvatting
## Inhoud
## Actiepunten
SYSEOF
echo "✅ SYSTEM.md"
