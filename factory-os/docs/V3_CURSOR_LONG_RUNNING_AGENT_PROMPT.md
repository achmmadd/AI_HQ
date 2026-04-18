# FACTORY OS V3 — CURSOR LONG-RUNNING AGENT PROMPT

**Geef dit aan Cursor → Agents Window → New Agent**

---

## Belangrijk — waar dit draait

- **Draai dit op de NUC** (de machine waar Docker/n8n/Dify/Qdrant draaien), **niet op een laptop** zonder die stack.
- **Geen nieuwe parallelle systemen bouwen** — alleen bestaande stack configureren, valideren, exporteren en documenteren. Niets dubbel maken.

### SSH (vanaf je laptop naar de NUC)

```bash
ssh <jouw-gebruiker>@<nuc-hostnaam-of-ip>
cd ~/AI_HQ
```

Pas `<jouw-gebruiker>` en het adres aan. Voer daarna de stappen hieronder uit **op de NUC-sessie**.

---

## Jouw opdracht

Je bent de **Factory OS build agent**. Voer de stappen **autonoom** uit op de NUC.

- Gebruik **`set -euo pipefail`** in elk bash-blok (staat onderaan expliciet).
- Bij **kritieke** stappen: `|| { echo "…"; exit 1; }`.
- **`git commit` alleen** als de health check en finale validatie **geslaagd** zijn (zie STAP 10).
- Rapporteer aan het eind via **Telegram** (veilige JSON, zie STAP 10).

---

## CONTEXT

Stack op Ubuntu NUC:

- OpenClaw/Optimus — CEO router  
- n8n — poort 5678  
- Dify — **`DIFY_BASE_URL` in `~/AI_HQ/.env`** (geen poort-detectie per stap)  
- Qdrant — poort 6333  
- Ollama — poort 11434  
- Open WebUI — poort 3000  
- Repo: `~/AI_HQ/factory-os/`  
- Secrets: `~/AI_HQ/.env`  

**Verplicht in `.env`:** zet een vaste, curl-bare URL, bijvoorbeeld:

```bash
DIFY_BASE_URL=http://localhost:5001
```

(Of het adres dat vanaf de NUC echt werkt — één bron van waarheid, geen her-detectie in scripts.)

---

## STAP 0 — ANALYSEER EERST

**Scheiding service|url met `|` (niet `:`).**

```bash
set -euo pipefail
cd ~/AI_HQ
set -a
# shellcheck source=/dev/null
source .env
set +a

: "${DIFY_BASE_URL:?Zet DIFY_BASE_URL in .env (vast, curl-bare URL)}"

echo "=== HEALTH CHECK ==="

health_fail=0

for service in \
  "n8n|http://localhost:5678/healthz" \
  "qdrant|http://localhost:6333/healthz" \
  "ollama|http://localhost:11434/api/tags" \
  "open-webui|http://localhost:3000" \
  "dify|${DIFY_BASE_URL%/}/health"; do
  name="${service%%|*}"
  url="${service#*|}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
  if [ "$code" = "200" ]; then
    echo "✅ $name"
  else
    echo "❌ $name ($code)"
    health_fail=1
  fi
done

if openclaw --version 2>/dev/null; then
  echo "✅ openclaw"
else
  echo "❌ openclaw niet gevonden"
  health_fail=1
fi

df -h / | awk 'NR==2{print "Schijf: "$4" vrij van "$2}'

for key in ANTHROPIC_API_KEY OPENAI_API_KEY \
           TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID \
           N8N_API_KEY DIFY_RESEARCH_API_KEY DIFY_BASE_URL; do
  if [ -n "${!key:-}" ]; then
    echo "✅ $key"
  else
    echo "❌ $key MIST"
    health_fail=1
  fi
done

echo "=== HEALTH CHECK KLAAR ==="

if [ "$health_fail" -ne 0 ]; then
  echo "STOP: health niet groen — fix eerst, documenteer in factory-os/docs/V3_STATUS.md"
  exit 1
fi
```

Sla uitvoer op in `~/AI_HQ/factory-os/docs/V3_STATUS.md` (kopieer terminaloutput). **Ga niet verder bij exit 1.**

---

## STAP 1 — SCHOONMAAK (niet destructief)

```bash
set -euo pipefail
cd ~/AI_HQ
set -a; source .env; set +a

chmod 600 .env 2>/dev/null || true
chmod 600 ~/.openclaw/mcp.json 2>/dev/null || true
echo "✅ Secrets-rechten gezet (waar aanwezig)"

if [ -d factory-os/systeem/cherry-studio ]; then
  mv factory-os/systeem/cherry-studio factory-os/systeem/cherry-studio.archief
  echo "✅ Cherry Studio gearchiveerd"
fi

docker image prune -f 2>/dev/null || true
echo "✅ Docker image prune (geen volume prune — bewust weggelaten)"

find ~/AI_HQ -name "*.log" -mtime +30 -delete 2>/dev/null || true
echo "✅ Oude logs (>30d) verwijderd"

if [ -f .env ]; then
  grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env | sort -u > .env.example || true
  echo "✅ .env.example bijgewerkt (keys only)"
fi

mkdir -p factory-os/systeem/n8n-workflows/exports

curl -sf "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -o /tmp/n8n_workflows_list.json \
  || { echo "❌ n8n workflow list failed"; exit 1; }

python3 << 'PY'
import json, os, re, urllib.request
from pathlib import Path

base = "http://localhost:5678/api/v1"
key = os.environ.get("N8N_API_KEY", "")

with open("/tmp/n8n_workflows_list.json") as f:
    data = json.load(f)
workflows = data.get("data", data) if isinstance(data, dict) else data
if isinstance(workflows, dict) and "data" in workflows:
    workflows = workflows["data"]

out_dir = Path("factory-os/systeem/n8n-workflows/exports").resolve()
out_dir.mkdir(parents=True, exist_ok=True)

def slug(s):
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")
    return s or "workflow"

for w in workflows:
    wid = w.get("id")
    name = w.get("name", "unnamed")
    if not wid:
        continue
    req = urllib.request.Request(
        f"{base}/workflows/{wid}",
        headers={"X-N8N-API-KEY": key},
    )
    with urllib.request.urlopen(req) as resp:
        full = json.load(resp)
    fn = out_dir / f"{slug(name)}__{wid}.json"
    fn.write_text(json.dumps(full, indent=2), encoding="utf-8")
    print("exported", fn)
PY

echo "✅ Workflows geëxporteerd naar factory-os/systeem/n8n-workflows/exports/"
```

---

## STAP 2 — OPENCLAW UPDATEREN

```bash
set -euo pipefail
npm install -g openclaw@latest 2>/dev/null || echo "⚠️ globale npm install openclaw mislukt — check handmatig"

openclaw --version || { echo "❌ openclaw niet beschikbaar"; exit 1; }

openclaw daemon restart 2>/dev/null || {
  pkill -f openclaw 2>/dev/null || true
  openclaw daemon start 2>/dev/null || echo "⚠️ daemon handmatig herstarten"
}
```

---

## STAP 3 — DIFY MCP PACKAGE VERIFIËREN + MCP SCHRIJVEN

```bash
set -euo pipefail
cd ~/AI_HQ
set -a; source .env; set +a

: "${DIFY_BASE_URL:?}"
: "${N8N_API_KEY:?}"

npm view dify-mcp-server name version description \
  || { echo "❌ npm view dify-mcp-server faalde — package naam of registry checken"; exit 1; }

mkdir -p ~/.openclaw

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
            "description": "Kennisbank — één collection; filter in query op payload client=fumero|bokas",
        },
        "filesystem": {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-filesystem",
                f"{home}/AI_HQ/factory-os/klanten",
                f"{home}/AI_HQ/factory-os/docs",
            ],
            "description": "Factory OS bestanden lezen",
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
            "description": "n8n workflows triggeren",
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
print("   Dify:", dify_url)
print("   keys n8n:", "ok" if n8n_key else "MISSING")
print("   keys dify:", "ok" if dify_key else "MISSING")
PY
```

**Let op:** als `dify-mcp-server` andere env-variabelen verwacht, pas het blok aan op basis van de package README — **geen tweede Dify-bridge** bouwen als dit pakket werkt.

---

## STAP 4 — CLAWHUB SKILLS (bestaand gedrag)

```bash
set -euo pipefail
skills=(agent-browser tavily-search summarize capability-evolver)
for skill in "${skills[@]}"; do
  openclaw install "$skill" 2>/dev/null && echo "✅ $skill" || echo "⚠️ $skill — handmatig"
done
openclaw skills list 2>/dev/null | head -20 || true
```

---

## STAP 5 — TELEGRAM

```bash
set -euo pipefail
cd ~/AI_HQ
set -a; source .env; set +a

openclaw channels list 2>/dev/null | grep -i telegram && echo "✅ Telegram zichtbaar in openclaw" || echo "⚠️ Telegram nog configureren (openclaw onboard / docs)"

curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('ok'); print('✅ bot @'+d['result'].get('username','?'))" \
  || { echo "❌ Telegram getMe failed"; exit 1; }

openclaw channels add telegram \
  --token "$TELEGRAM_BOT_TOKEN" \
  --allow-from "$TELEGRAM_CHAT_ID" \
  2>/dev/null || echo "⚠️ openclaw channels add telegram — indien niet ondersteund: zie OpenClaw docs"

python3 -c "
import json, os, urllib.request
token = os.environ['TELEGRAM_BOT_TOKEN']
chat = os.environ['TELEGRAM_CHAT_ID']
body = json.dumps({'chat_id': chat, 'text': '🏭 Factory OS V3 — health groen, agent klaar voor volgende stappen'}).encode()
req = urllib.request.Request(
  f'https://api.telegram.org/bot{token}/sendMessage',
  data=body,
  headers={'Content-Type': 'application/json'},
  method='POST',
)
with urllib.request.urlopen(req) as r:
  d = json.load(r)
assert d.get('ok'), d
print('✅ Telegram testbericht verstuurd')
"
```

---

## STAP 6 — QDRANT: ÉÉN COLLECTION + VECTORMAAT UIT CONFIG

**Geen vier losse collections.** Eén `factory_os`; onderscheid **fumero** vs **bokas** via **payload** `client` bij ingest (en filter daarop in zoekopdrachten).

**Embedding-dimensie:** stel in `.env` óf `EMBEDDING_DIMENSION=<int>` óf `EMBEDDING_MODEL=<naam>` (lookup in script). Geen hardcoded 1536 zonder check.

```bash
set -euo pipefail
cd ~/AI_HQ
set -a; source .env; set +a

python3 << 'PY'
import json, os, urllib.request

# Optioneel: vaste dim in .env wint altijd
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
    raise SystemExit(
        f"Onbekend EMBEDDING_MODEL={model!r} — zet EMBEDDING_DIMENSION in .env of breid KNOWN uit in dit script"
    )
else:
    raise SystemExit(
        "Zet EMBEDDING_DIMENSION of EMBEDDING_MODEL in .env (zelfde bron als je ingest-pipeline)"
    )

base = "http://localhost:6333"
name = "factory_os"
payload = json.dumps(
    {"vectors": {"size": size, "distance": "Cosine"}}
).encode()

req = urllib.request.Request(
    f"{base}/collections/{name}",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="PUT",
)
try:
    with urllib.request.urlopen(req) as r:
        print("✅ collection", name, "size", size, r.status)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if e.code == 409 or "already exists" in body.lower():
        print("ℹ️ collection bestaat al — controleren of vector size matcht met data (anders nieuwe collection + re-embed)")
    else:
        raise

with urllib.request.urlopen(f"{base}/collections") as r:
    cols = json.load(r).get("result", {}).get("collections", [])
print("collections:", [c["name"] for c in cols])
PY
```

Documenteer in `V3_STATUS.md`: gebruikte `EMBEDDING_MODEL` / `EMBEDDING_DIMENSION`.

---

## STAP 7 — SYSTEEM PROMPT (één collection + payload)

```bash
set -euo pipefail
mkdir -p ~/.openclaw/workspaces/factory-os

cat > ~/.openclaw/workspaces/factory-os/SYSTEM.md << 'SYSEOF'
# Factory OS — OpenClaw CEO

Je bent de CEO van Factory OS voor Pietje.

## Bedrijven
- Fumero (fumero.nl) — HHC e-commerce, 18+, premium, discreet
- Bokas — horeca

## Qdrant (één collection)
- Collection: **factory_os**
- Bij zoeken en opslaan: altijd **payload `client`** zetten of filteren: `fumero` of `bokas`
- Geen aparte collections per klant — alleen dit onderscheid in payload

## Toolvolgorde
1. memory — recente context
2. qdrant — feiten in `factory_os` met juiste `client`-filter
3. dify / n8n / fetch / filesystem naar behoefte
4. Belangrijke nieuwe feiten: terug naar qdrant (zelfde collection, juiste `client`)

## Niet autonoom zonder expliciete toestemming
- E-mail, bestellingen, betalingen, klantcontact

## Outputformaat
# [Titel]
**Bedrijf:** [naam] · **Afdeling:** [@naam]
## Samenvatting
## Inhoud
## Actiepunten
SYSEOF

echo "✅ SYSTEM.md geschreven"
```

---

## STAP 8 — BACKUP (PER COLLECTION SNAPSHOT) + RESTORE DRAAIBOEK

```bash
set -euo pipefail
mkdir -p ~/AI_HQ/scripts ~/AI_HQ/factory-os/docs

cat > ~/AI_HQ/factory-os/docs/QDRANT_RESTORE_RUNBOOK.md << 'RESTOREOF'
# Qdrant — snapshot backup & restore

## Backup (per collection)

Op de NUC, collection `factory_os`:

```bash
curl -s -X POST "http://localhost:6333/collections/factory_os/snapshots" | tee /tmp/qdrant_snapshot_factory_os.json
```

De response bevat de snapshot-naam op de **Qdrant-server** (storage path hangt af van je install: Docker volume of host path).

**Docker:** vind het volume of mount waar Qdrant data staat; kopieer de snapshot-file(s) vanaf die storage naar `~/AI_HQ/backups/<datum>/`.

## Restore (conceptueel)

1. Stop writes (optioneel: read-only maintenance).
2. Herstel snapshot volgens Qdrant-versie-documentatie: **Recovery** uit collection-snapshot (upload/place file in storage + API call of `qdrant` CLI — volg de docs voor jouw Qdrant-versie).
3. Start Qdrant; controleer `GET /collections/factory_os`.

**Test:** minstens één keer een restore op een **test**-volume uitvoeren voordat je op productie vertrouwt.

Meer detail: [Qdrant snapshots](https://qdrant.tech/documentation/concepts/snapshots/)
RESTOREOF

cat > ~/AI_HQ/scripts/factory_os_backup.sh << 'BACKUPEOF'
#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck source=/dev/null
source ~/AI_HQ/.env
set +a

BACKUP_DIR=~/AI_HQ/backups/$(date +%Y%m%d_%H%M)
mkdir -p "$BACKUP_DIR"

curl -s -X POST "http://localhost:6333/collections/factory_os/snapshots" \
  -o "$BACKUP_DIR/qdrant_factory_os_snapshot_meta.json"

curl -sf "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -o "$BACKUP_DIR/n8n_workflows.json"

cp -a ~/.openclaw "$BACKUP_DIR/openclaw_config" 2>/dev/null || true
cp ~/AI_HQ/.env.example "$BACKUP_DIR/" 2>/dev/null || true

echo "✅ Backup meta: $BACKUP_DIR"

python3 -c "
import json, os, urllib.request
token = os.environ.get('TELEGRAM_BOT_TOKEN')
chat = os.environ.get('TELEGRAM_CHAT_ID')
if not token or not chat:
    raise SystemExit(0)
body = json.dumps({
    'chat_id': chat,
    'text': '✅ Factory OS backup klaar: ' + os.path.basename('$BACKUP_DIR'),
}).encode()
req = urllib.request.Request(
    f'https://api.telegram.org/bot{token}/sendMessage',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(req) as r:
    d = json.load(r)
assert d.get('ok'), d
"
BACKUPEOF

chmod +x ~/AI_HQ/scripts/factory_os_backup.sh

CRON_LINE='0 3 * * * ~/AI_HQ/scripts/factory_os_backup.sh'
if crontab -l 2>/dev/null | grep -Fq "$CRON_LINE"; then
  echo "ℹ️ cron backup regel bestond al"
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "✅ cron backup regel toegevoegd"
fi
```

---

## STAP 9 — FINALE VALIDATIE

```bash
set -euo pipefail
cd ~/AI_HQ
set -a; source .env; set +a

echo "=== FINALE VALIDATIE ==="

curl -sf -X POST "http://localhost:5678/webhook/factory-os" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test v3","klant":"fumero"}' \
  --max-time 60 \
  -o /tmp/v3_test.json \
  || { echo "❌ n8n webhook factory-os failed"; exit 1; }

python3 -c "import json; d=json.load(open('/tmp/v3_test.json')); print('dispatcher:', d)"

openclaw mcp list 2>/dev/null | sed 's/^/  /' || echo "  (openclaw mcp list — handmatig)"

curl -sf "http://localhost:6333/collections" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for c in d.get('result',{}).get('collections',[]):
    print(' ✅', c['name'])
"

echo "=== VALIDATIE KLAAR ==="
```

---

## STAP 10 — GIT + TELEGRAM RAPPORT (ALLEEN BIJ SUCCES)

Voer dit **alleen** uit als STAP 0 t/m 9 zonder `exit 1` zijn gelopen (zelfde shell-sessie met `set -e` is voldoende).

```bash
set -euo pipefail
cd ~/AI_HQ

git add -A
git status --short | head -30

git commit -m "feat: Factory OS V3 — OpenClaw MCP, enkele Qdrant collection, backups

- DIFY_BASE_URL als vaste bron in .env
- Qdrant: factory_os + payload client fumero|bokas
- MCP config + workflow exports + backup script/cron
- Qdrant restore runbook toegevoegd" \
  || echo "ℹ️ geen commit (geen wijzigingen of git fout)"

set -a; source .env; set +a

python3 << 'PY'
import json, os, urllib.request

token = os.environ["TELEGRAM_BOT_TOKEN"]
chat = os.environ["TELEGRAM_CHAT_ID"]
lines = [
    "🏭 FACTORY OS V3 — run afgerond",
    "",
    "✅ Health + validatie doorlopen",
    "✅ MCP geschreven (dify-mcp-server geverifieerd met npm view)",
    "✅ Qdrant: één collection factory_os",
    "✅ Workflows geëxporteerd naar factory-os/systeem/n8n-workflows/exports/",
    "✅ Backup script + runbook",
    "",
    "Test in Telegram: Wat weet je over Fumero?",
]
body = json.dumps({"chat_id": chat, "text": "\n".join(lines)}).encode()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/sendMessage",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    d = json.load(r)
assert d.get("ok"), d
print("✅ Telegram rapport verstuurd")
PY
```

---

## STATUS-DOC

Vul in: `~/AI_HQ/factory-os/docs/V3_STATUS.md` — datum, wat groen/rood was, handmatige vervolgstappen.

---

## CHECKLIST

```
□ Op NUC uitgevoerd (SSH)
□ DIFY_BASE_URL in .env (vast)
□ STAP 0 groen (of gestopt met exit 1)
□ Geen volume prune
□ npm view dify-mcp-server geslaagd
□ Qdrant factory_os + EMBEDDING_* correct
□ Workflows als JSON in exports/
□ Backup + runbook aanwezig
□ Cron alleen toegevoegd als regel nog niet bestond
□ Telegram via python json
□ Git commit alleen na succesvolle run
```

---

*Factory OS V3 — geen dubbele ketens; één collection, payload `client`, vaste Dify-URL.*
