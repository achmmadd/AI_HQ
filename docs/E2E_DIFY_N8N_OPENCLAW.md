# E2E-keten: Dify → n8n → OpenClaw (Optimus API)

**Volgorde (afgesproken):** eerst **infra + bedrading** (URLs, keys, netwerk, eerste geslaagde HTTP-calls), daarna pas zware code (compose-uitrol, supervisor, React-UI, extra endpoints).  
**Nuance:** Pipe/OpenClaw → live paneel kun je **lokaal** al testen (WebUI in hetzelfde Docker-netwerk als `omega-optimus-api`). Voor **volledige** ketens met echte Dify-workflows en n8n moeten Dify én n8n stabiel bereikbaar zijn vanaf de plek waar ze elkaar aanroepen.

---

## 1. Dify op de server (API-basis-URL + curl)

### Zwakke plek die we rechtzetten

- **`DIFY_BASE_URL`** moet de **API-root** zijn: het hostdeel waarna je **`/v1/...`** aanroept. Vaak is dat dezelfde origin als de browser-UI, maar **niet** altijd (reverse proxy, aparte `api`-service). Gebruik geen trailing slash.
- **`GET /health`** op de **webroot** kan **404** geven (Next.js-app); dat zegt **niets** over de API. Test altijd **`/v1/...` met een app-API-key**.

### Stappen

1. **Noteer de basis-URL** (voorbeeld): `http://jouw-server` of `https://dify.example.com` (poort alleen als je die echt nodig hebt).
2. **App API-key** in Dify: *App* → *API Access* → API key (begint meestal met `app-`).
3. **Smoke-test (verplicht):**

```bash
cd ~/AI_HQ
set -a && source .env && set +a
BASE="${DIFY_API_BASE:-$DIFY_BASE_URL}"
BASE="${BASE%/}"
curl -sS -o /dev/null -w "parameters HTTP %{http_code}\n" \
  -H "Authorization: Bearer ${DIFY_API_KEY_optimus}" \
  "${BASE}/v1/parameters"
```

Verwachting: **HTTP 200** en JSON met o.a. `system_parameters`.

4. **Workflow-run (als je een workflow hebt):** gebruik in Dify de documentatie voor `POST /v1/workflows/run` met `inputs` en de juiste key voor **die** app. Eerst in Postman/curl laten slagen, daarna pas in n8n kopiëren.

### Optionele variabele

- **`DIFY_API_BASE`** — zet dit als de API op een **andere** host/poort staat dan `DIFY_BASE_URL`. Scripts vallen terug op `DIFY_BASE_URL` als `DIFY_API_BASE` leeg is (zie `scripts/check_dify_n8n_openclaw.sh`).

---

## 2. OpenClaw / Optimus API (twee URL’s)

### Zwakke plek

- **`OPENCLAW_BASE_URL=http://omega-optimus-api:8890`** werkt alleen **binnen hetzelfde Docker-netwerk** (bv. Open WebUI Pipe).  
- **n8n** op de host, op een andere VPS of in een andere compose-stack ziet die hostname **niet**. Daar heb je een **publiek bereikbare** of LAN-URL nodig.

### Stappen

1. **Binnen Docker (Pipe / WebUI):** laat `OPENCLAW_BASE_URL` op de service-naam staan.
2. **Vanaf n8n / laptop / andere server:** zet in `.env` (of in n8n Credentials):

   - **`OPENCLAW_PUBLIC_BASE_URL`** — bijv. `http://192.168.178.43:8890`, Tailscale-IP, of `https://optimus.example.com` achter je proxy.

3. **Smoke-test:**

```bash
URL="${OPENCLAW_PUBLIC_BASE_URL:-http://127.0.0.1:8890}"
URL="${URL%/}"
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" "${URL}/health"
curl -sS "${URL}/openapi.json" | head -c 200; echo
```

Verwachting: **`/health` → 200**, OpenAPI noemt o.a. `Optimus API` en versie.

4. **Webhook naar OpenClaw** (als je die route gebruikt): noteer het **exacte pad** (bv. `/api/webhook/inbound`) en of er een **Authorization**- of custom **header** nodig is. Zet gevoelige waarden in **n8n Credentials**, niet in plaintext in workflows die je exporteert.

---

## 3. n8n: Dify + OpenClaw bereikbaar maken

### Zwakke plekken

- n8n leest **niet automatisch** `AI_HQ/.env`. Je moet **Credentials** / **environment** in n8n zelf vullen (of n8n via Docker `env_file` koppelen aan een **kopie** van de juiste variabelen — niet per ongeluk de hele `.env` met Telegram-keys).
- **DNS:** vanuit de n8n-container moet `curl` naar `DIFY_API_BASE` en `OPENCLAW_PUBLIC_BASE_URL` kunnen (firewall, TLS, self-signed cert: in n8n “Ignore SSL” alleen als je het risico accepteert).

### Stappen

1. **n8n op de NUC** — vaak als Docker-container **`n8n`** met host-poort **5678** (`0.0.0.0:5678→5678`). Controleer met `docker ps --filter name=n8n` en `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5678/healthz` (verwacht **200**). Zet voor duidelijkheid in `.env`: **`N8N_BASE_URL=http://127.0.0.1:5678`** (of je LAN-/Tailscale-URL als je vanaf andere hosts checkt).
2. In een **Execute Command**-node of op de n8n-host:

   - `curl -sS -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <DIFY_KEY>" "<DIFY_API_BASE>/v1/parameters"`
   - `curl -sS -o /dev/null -w "%{http_code}\n" "<OPENCLAW_PUBLIC_BASE_URL>/health"`

3. **HTTP Request-nodes:** base URL = `DIFY_API_BASE` / `OPENCLAW_PUBLIC_BASE_URL`, pad = `/v1/...` of `/api/...`, headers: `Authorization: Bearer ...` waar nodig.
4. **Secrets:** gebruik n8n *Credentials* voor API keys; verwijs in nodes naar credentials i.p.v. hardcoded strings.

---

## 4. Geautomatiseerde check (aanbevolen)

Vanaf een machine die `.env` mag lezen en die dezelfde netwerk-route heeft als je workflows:

```bash
cd ~/AI_HQ
./scripts/check_dify_n8n_openclaw.sh
```

Optioneel: `N8N_BASE_URL=https://n8n.example.com ./scripts/check_dify_n8n_openclaw.sh`

Als je **geen** `OPENCLAW_PUBLIC_BASE_URL` hebt gezet en alleen `OPENCLAW_BASE_URL` met een Docker-naam, probeert het script automatisch `http://127.0.0.1:8890` (override met `OPENCLAW_LOCAL_FALLBACK`). Dat is handig op de NUC waar de API op de host draait; voor n8n op een andere machine moet je wél `OPENCLAW_PUBLIC_BASE_URL` invullen.

---

## 5. Daarna: code en uitrol

Pas als bovenstaande stappen **groen** zijn:

- compose-aanpassingen, supervisor, React-UI, extra API-routes — anders debug je blind tegen verkeerde URLs of keys.

Lokaal **zonder** Dify/n8n kun je nog steeds: WebUI → Pipe → `OPENCLAW_BASE_URL` → live paneel / chat-endpoints testen.

---

## Snelle referentie variabelen

| Variabele | Doel |
|-----------|------|
| `DIFY_BASE_URL` | Standaard API-host (zonder `/v1`, zonder trailing slash) |
| `DIFY_API_BASE` | Overschrijft host als API elders staat |
| `DIFY_API_KEY_*` | Per-app keys uit Dify |
| `OPENCLAW_BASE_URL` | Alleen binnen gedeeld Docker-netwerk |
| `OPENCLAW_PUBLIC_BASE_URL` | n8n / externe callers |
| `N8N_BASE_URL` | Alleen voor optionele health-check in script |
| `OPTIMUS_API_VERSION` | OpenAPI-/health-versie van de Optimus API (`openclaw/api/app.py`); default `26.03.26` |
| `QDRANT_URL` | Volledige Qdrant Cloud-URL incl. poort, bv. `https://….qdrant.io:6333` |
| `QDRANT_CLUSTER_ENDPOINT` | Alternatief zonder poort; code vult bij HTTPS `:6333` aan |
| `QDRANT_API_KEY` | Key uit Qdrant Cloud Console — **niet committen** |

Smoke-test: `cd ~/AI_HQ && pip install -r requirements-qdrant.txt && ./venv/bin/python scripts/qdrant_smoke.py` — gebruikt `openclaw.logic.qdrant_cloud.get_qdrant_client()` (zelfde patroon als `QdrantClient(url=…, api_key=…)`).

### Dify Workflow → Agent → Function calling via Optimus (OpenClaw)

Als in Dify het **custom OpenAI-compat endpoint** naar Optimus wijst (`…/v1/chat/completions`), moet de gateway **`tools` / `tool_choice`** en **`tool`-rollen** doorgeven. Dat gebeurt nu automatisch zodra het verzoek tools bevat of een `tool`-message heeft. Gebruik in Dify een **model-id** dat bij een Optimus-profiel hoort met backend **`openai`** of **`groq`** (bijv. `optimus-snel`, `optimus-flits`); profielen met alleen Claude/Ollama krijgen hiervoor **400** met uitleg.

**Docker:** na wijzigingen in `.env` de `omega-optimus-api`-container **opnieuw aanmaken** (`docker compose up -d` met jouw compose-bestand), anders ziet het proces de nieuwe variabelen niet.

Zie ook: `START_CHECKLIST.md` (Omega-start) en dit document voor de **AI-keten**.
