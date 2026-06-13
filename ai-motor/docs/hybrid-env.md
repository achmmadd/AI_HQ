# Hybrid NUC + Hetzner — env single source of truth

> **Sprint 3.1** · **Gerelateerd:** [`hetzner-migration.md`](hetzner-migration.md) · [`DECISIONS.md`](DECISIONS.md) ADR-002 · [`fase1-postgres.md`](fase1-postgres.md) · [`model-config.md`](model-config.md)

Motor Next.js blijft op de **NUC** (PM2 `:3040`). Zware backends draaien op **Hetzner** (16 GB) en zijn bereikbaar via **Tailscale** (`hetzner-motor` hostname).

## Architectuur (kort)

```
NUC (Motor, OpenClaw, local-executor, bookkeeping :8001)
  │
  │  Tailscale mesh
  ▼
Hetzner (Postgres, Qdrant, Ollama embed, LiteLLM, n8n, Dify)
```

Unified compose: `infra/hetzner/docker-compose.yml`

## NUC `.env.local` — Hetzner URLs

Vervang `hetzner-motor` door je Tailscale MagicDNS-naam of `100.x.x.x`.

```bash
# --- Vector + embed (Fase 3 core) ---
QDRANT_URL=http://hetzner-motor:6333
OLLAMA_URL=http://hetzner-motor:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# --- Postgres (Fase 1 — zie ADR-002 milestones) ---
DATABASE_URL=postgres://motor:PASSWORD@hetzner-motor:5432/motor_ai
USE_POSTGRES=0              # M2 (5 jul): 1 = dual-write
POSTGRES_PRIMARY=0          # M4 (26 jul): 1 = PG SSOT

# --- LLM routing (Fase 2) ---
LITELLM_BASE_URL=http://hetzner-motor:4000
OPENROUTER_API_KEY=sk-or-...   # ook op Hetzner voor LiteLLM sidecar

# --- Workflows ---
N8N_BASE_URL=http://hetzner-motor:5678
N8N_FACTORY_WEBHOOK=http://hetzner-motor:5678/webhook/factory-os
COMPUTER_USE_URL=http://hetzner-motor:5678/webhook/agent-mvp

# --- Builder (aparte Dify-stack op Hetzner) ---
DIFY_BASE_URL=http://hetzner-motor:5001
DIFY_API_KEY=app-...

# --- Blijft lokaal op NUC ---
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
```

### Qdrant collecties (ADR-001)

Geen wijziging bij migratie — alleen host:

| Variabele | Default |
|-----------|---------|
| `QDRANT_COLLECTION_PREFIX` | `factory_os` |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | `fumero_kennisbank` |
| `QDRANT_BOKAS_KENNISBANK_COLLECTION` | `bokas_kennisbank` |
| `QDRANT_MEMORY_COLLECTION` | `motor_memory` |

## Hetzner server `.env`

Op Hetzner in `infra/hetzner/`:

```bash
cd /opt/motor/infra/hetzner
cp env.example .env
# Vul POSTGRES_PASSWORD, OPENROUTER_API_KEY, LITELLM_MASTER_KEY
# Bind op Tailscale IP:
#   POSTGRES_BIND=$(tailscale ip -4)
#   QDRANT_BIND=$(tailscale ip -4)
#   OLLAMA_BIND=$(tailscale ip -4)
```

## Deploy op Hetzner

```bash
# Core only (~7.5 GB RAM): Postgres + Qdrant + Ollama
docker compose up -d

# Pull embed model (eenmalig)
docker compose --profile init run --rm ollama-init

# Optioneel: LiteLLM + n8n
docker compose --profile full up -d

# Dify apart (4–6 GB) — niet in unified compose
# Zie scripts/hetzner-phase1-from-nuc.sh → /opt/dify/docker
```

### RAM-budget (16 GB)

| Service | Limit | Profile |
|---------|-------|---------|
| Postgres | 2 GB | core |
| Qdrant | 4 GB | core |
| Ollama (embed) | 1.5 GB | core |
| LiteLLM | 512 MB | `litellm` / `full` |
| n8n | 1 GB | `n8n` / `full` |
| Dify stack | 4–6 GB | extern (`/opt/dify`) |

**Regels:** geen Langfuse self-host; geen chat-LLM op Ollama; agent-browser on-demand only.

## Verificatie vanaf NUC

```bash
# Directe connectivity (geen Motor server nodig)
node scripts/hybrid-smoke.mjs

# End-to-end hybrid (Motor API + auth + kennisbank + approvals) — Sprint 3.3
BASE_URL=http://127.0.0.1:3040 MOTORSAI_TOKEN=… SKIP_CHAT=1 node scripts/e2e-hybrid.mjs
RUN_INFRA_SMOKE=1 REQUIRE_HYBRID_CORE=1 node scripts/e2e-hybrid.mjs

# Hetzner RAM budget (op server of via ssh)
bash scripts/hetzner-load-check.sh

# Via Motor API (ingelogd)
curl -s http://127.0.0.1:3040/api/admin/integration-readiness | jq '.hybrid'

# Dev health dashboard
open http://127.0.0.1:3040/dev
```

Zie ook [`nuc-readiness.md`](nuc-readiness.md) voor PG cutover checklist.

### Checklist na elke sub-migratie

Zie [`hetzner-migration.md#checklist-na-elke-fase`](hetzner-migration.md#checklist-na-elke-fase):

1. `node scripts/hybrid-smoke.mjs` groen  
2. `GET /api/admin/integration-readiness` → `hybrid.hetzner_core_ok`  
3. Korte chat met kennisbank-treffer  
4. `npm run build` + `pm2 restart ecosystem.config.cjs --update-env`

## Rollback per service (1 week read-only)

Na elke sub-migratie: oude host **7 dagen read-only** laten draaien (geen nieuwe writes, wel lezen voor vergelijking).

| Stap | Terug naar NUC/local | Verificatie |
|------|---------------------|-------------|
| 1 | `QDRANT_URL=http://127.0.0.1:6333` | `hybrid-smoke.mjs` → qdrant OK |
| 2 | `OLLAMA_URL=http://127.0.0.1:11434` + `systemctl start ollama` | embed smoke in dev health |
| 3 | unset `LITELLM_BASE_URL` | chat via direct OpenRouter |
| 4 | `N8N_*` / `COMPUTER_USE_URL` → NUC `:5678` | factory-os webhook test |
| 5 | `DIFY_BASE_URL` → vorige host | builder generate smoke |
| 6 | `USE_POSTGRES=0` (alleen vóór ADR-002 cutover) | SQLite chat history intact |

**Niet rollbacken:** OpenClaw gateway, local-executor, Motor Next.js — blijven op NUC.

```bash
# Snelle terugzet (voorbeeld — pas aan naar jouw oude waarden)
cp .env.local.backup .env.local
pm2 restart ecosystem.config.cjs --update-env
node scripts/hybrid-smoke.mjs
```

Volledige tabel: [`hetzner-migration.md#rollback`](hetzner-migration.md#rollback).

## Rollback (1 week read-only) — legacy sectie

1. Zet NUC `.env.local` terug naar lokale URLs (`127.0.0.1:6333`, `:11434`, …).  
2. `pm2 restart ecosystem.config.cjs --update-env`  
3. Qdrant: restore snapshot indien nodig (`scripts/backup-qdrant.sh`).

## NUC Ollama uitzetten

Na `hybrid-smoke.mjs` groen + chat-embed OK:

```bash
sudo systemctl stop ollama
sudo systemctl disable ollama
```

## AgentShield security scan (2026-06-13)

One-time audit for MKB security dept baseline:

```bash
npx ecc-agentshield scan   # from ai-motor root
```

| Grade | Score | Findings |
|-------|-------|----------|
| A | 100/100 | 0 (secrets, permissions, hooks, MCP, agents) |

Re-run after adding MCP servers, hooks, or agent configs. See [AgentShield](https://www.npmjs.com/package/ecc-agentshield).
