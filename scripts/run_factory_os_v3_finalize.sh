#!/usr/bin/env bash
# Eenmalige finalisatie: MCP, scoped Qdrant collections, SYSTEM.md.
# Root-owned scripts/factory_os_v3_finalize.sh is legacy; use this wrapper.
set -euo pipefail

AI_HQ="${AI_HQ:-$HOME/AI_HQ}"
cd "$AI_HQ"

# shellcheck source=lib/qdrant-collection.sh
source "$AI_HQ/scripts/lib/qdrant-collection.sh"

set -a
# shellcheck source=/dev/null
source "$AI_HQ/.env"
set +a

QDRANT_FUMERO_COLLECTION="$(qdrant_collection_for_scope fumero)"
QDRANT_BOKAS_COLLECTION="$(qdrant_collection_for_scope bokas)"
QDRANT_MOTOR_COLLECTION="$(qdrant_collection_for_scope motor)"

if ! grep -q '^EMBEDDING_DIMENSION=' "$AI_HQ/.env" 2>/dev/null; then
  printf '\n# Factory OS V3 — default; pas aan naar je embedding model (Ollama nomic-embed-text = 768)\nEMBEDDING_DIMENSION=768\n' >> "$AI_HQ/.env"
  set -a
  # shellcheck source=/dev/null
  source "$AI_HQ/.env"
  set +a
  echo "✅ EMBEDDING_DIMENSION=768 toegevoegd aan .env"
fi

: "${DIFY_BASE_URL:?}"

mkdir -p "$HOME/.openclaw/workspaces/factory-os"

export QDRANT_FUMERO_COLLECTION QDRANT_BOKAS_COLLECTION QDRANT_MOTOR_COLLECTION

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

fumero_col = os.environ["QDRANT_FUMERO_COLLECTION"]
bokas_col = os.environ["QDRANT_BOKAS_COLLECTION"]

config = {
    "mcpServers": {
        "qdrant": {
            "command": "npx",
            "args": ["-y", "@qdrant/mcp-server-qdrant"],
            "env": {
                "QDRANT_URL": "http://localhost:6333",
                "QDRANT_API_KEY": "",
                "COLLECTION_NAME": fumero_col,
            },
            "description": (
                f"Kennisbank — scoped ingest {fumero_col} (primair Fumero); "
                f"Bokas via {bokas_col} of n8n/dify dual-search"
            ),
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
print("   qdrant COLLECTION_NAME:", fumero_col)
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

scoped = [
    os.environ["QDRANT_FUMERO_COLLECTION"],
    os.environ["QDRANT_BOKAS_COLLECTION"],
    os.environ["QDRANT_MOTOR_COLLECTION"],
]
base = os.environ.get("QDRANT_URL", "http://localhost:6333").rstrip("/")
payload = json.dumps({"vectors": {"size": size, "distance": "Cosine"}}).encode()

for name in scoped:
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
            print("ℹ️", name, "bestond al:", body[:120])
        else:
            raise

with urllib.request.urlopen(f"{base}/collections") as r:
    cols = json.load(r).get("result", {}).get("collections", [])
print("collections:", [c["name"] for c in cols])
PY

cat > "$HOME/.openclaw/workspaces/factory-os/SYSTEM.md" << SYSEOF
# Factory OS — OpenClaw CEO

Je bent de CEO van Factory OS voor Pietje.

## Bedrijven
- Fumero (fumero.nl) — HHC e-commerce, 18+, premium, discreet
- Bokas — horeca

## Qdrant (scoped collections — SSOT ai-motor/lib/qdrant-collection.ts)
- Fumero ingest: **${QDRANT_FUMERO_COLLECTION}** (+ scrape bucket fumero_kennisbank via n8n/dify)
- Bokas ingest: **${QDRANT_BOKAS_COLLECTION}** (+ scrape bucket bokas_kennisbank)
- Motor/system: **${QDRANT_MOTOR_COLLECTION}**
- Legacy \`factory_os\` zonder suffix: **niet** gebruiken voor nieuwe writes
- OpenClaw MCP qdrant-tool wijst op **${QDRANT_FUMERO_COLLECTION}**; voor Bokas gebruik n8n/dify of filesystem

## Toolvolgorde
1. memory → 2. qdrant (juiste scoped collection per klant) → 3. dify / n8n / fetch / filesystem

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
