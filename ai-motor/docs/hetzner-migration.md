# Hetzner-migratie (runbook)

Doel: zware services (Qdrant, Ollama, Dify) gefaseerd verhuizen vanaf een NUC of thuisserver, zonder Motor-frontends in dezelfde PR te mengen met productfeatures.

> **Master plan:** volledige volgorde (bugs → structuur → tech → samensmelting → UI) staat in [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md). Dit document is het **infra-runbook** voor Hetzner-deploy.

**Server:** Hetzner CX/CPX — **8 vCPU, 16 GB RAM, 320 GB disk** (~€25,49/mo). Geen Langfuse self-host op deze box; geen lokale chat-LLM naast Dify.

**Fase 1 (NUC update + Dify op Hetzner):** zie [`hetzner-phase1.md`](hetzner-phase1.md) en scripts `scripts/hetzner-phase1-from-nuc.sh`.

## Uitgangspunten

- **Motor Next** (PM2, poort 3040) kan tijdelijk op de NUC blijven terwijl alleen backends verhuizen.
- Pas `.env` / `ecosystem.config.cjs` aan: alle URL’s die van host veranderen (`QDRANT_URL`, `DIFY_BASE_URL`, `OLLAMA_URL`, eventueel `COMPUTER_USE_URL` naar nieuwe n8n).
- Behoud **Tailscale** of **Cloudflare Tunnel** voor bereikbaarheid; documenteer de uiteindelijke interne vs publieke hostnames in de team-wiki of `README`.

## Voorgestelde volgorde

> **Env single source of truth (NUC):** [`hybrid-env.md`](hybrid-env.md) — `QDRANT_URL`, `OLLAMA_URL`, `DATABASE_URL`, `LITELLM_BASE_URL` via Tailscale.  
> **Unified Hetzner compose:** `infra/hetzner/docker-compose.yml` — core Postgres + Qdrant + Ollama; profiles `litellm`, `n8n`, `full`.

> **Prerequisite:** eerst Fase 0 bugfixes uit [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md) (Qdrant-collecties, auth) — anders migreer je kapotte kennisbank mee.

1. **Qdrant + Ollama (embed only)**  
   - Grootste winst voor embedding-latency en RAM-isolatie.  
   - Migreer collections (snapshot/export) of herbouw kennisbank + `motor_memory` via normale ingest.  
   - Update `QDRANT_URL` en `OLLAMA_URL` op Motor; `verify-live.sh` / health-check.

2. **Postgres** (parallel met of vlak na Qdrant — zie master plan Fase 1)  
   - Docker op Hetzner; Motor op NUC via Tailscale `DATABASE_URL`.  
   - SQLite blijft op NUC tot PG cutover (**26 jul 2026** — zie [`DECISIONS.md`](DECISIONS.md) ADR-002).

3. **Dify** (indien self-hosted)  
   - Na vectordb stabiliteit, zodat Dify-workflows dezelfde Qdrant kunnen blijven gebruiken.  
   - Update builder/chat-gerelateerde Dify base URL + API keys in PM2 env.

4. **LiteLLM + n8n / Computer Use worker**  
   - LiteLLM sidecar vóór model-centralisatie (master plan Fase 2).  
   - Zet `COMPUTER_USE_URL` naar Hetzner webhook; agent-browser on-demand (niet 24/7).

5. **Motor Next — blijft op NUC** (bewust)  
   - PM2 + OpenClaw + local-executor; remote Postgres. Geen Motor-verhuizing naar Hetzner in huidige plan.

## Checklist na elke fase

- [ ] `node scripts/hybrid-smoke.mjs` — Qdrant, Ollama, Postgres (Tailscale). Zie [`hybrid-env.md`](hybrid-env.md).  
- [ ] Smoke `GET /api/health` (dependencies OK).  
- [ ] `GET /api/admin/integration-readiness` → `hybrid.hetzner_core_ok` + checklist (geen secrets in response).  
- [ ] Eén korte chat in `/chat` met bestaande conversatie (geheugen + n8n).  
- [ ] Optioneel: Studio fal-route of builder-generate op acceptatie.

## Rollback

Houd oude host **één week read-only** bereikbaar per service. Zie ook [`hybrid-env.md#rollback-per-service`](hybrid-env.md#rollback-per-service-1-week-read-only).

- `.env` terugzetten op vorige URL's; `pm2 restart ai-motor --update-env`.
- Qdrant: restore snapshot indien nodig.

### Per service (1 week read-only fallback)

| Service | NUC fallback (1 week) | Actie |
|---------|----------------------|--------|
| **Qdrant** | `QDRANT_URL=http://127.0.0.1:6333` | Oude NUC instance read-only laten draaien; geen writes op Hetzner na cutover tot smoke groen |
| **Ollama embed** | `OLLAMA_URL=http://127.0.0.1:11434` | `sudo systemctl start ollama` op NUC; Hetzner Ollama read-only |
| **Postgres** | `USE_POSTGRES=0` | SQLite op NUC blijft SSOT tot ADR-002 cutover |
| **LiteLLM** | unset `LITELLM_BASE_URL` | Motor praat direct met OpenRouter |
| **n8n** | `N8N_FACTORY_WEBHOOK=http://127.0.0.1:5678/webhook/factory-os` | Oude NUC n8n read-only; geen workflow edits op fallback |
| **Dify** | vorige `DIFY_BASE_URL` | Builder workflows ongewijzigd op oude host |
| **OpenClaw** | geen fallback nodig | Blijft op NUC (`127.0.0.1:18789`) |
| **local-executor** | geen fallback nodig | Blijft op NUC (`127.0.0.1:8790`) |

**Volgorde bij rollback:** LiteLLM/n8n → Qdrant/Ollama → Postgres (alleen indien dual-write actief). Na elke stap: `node scripts/hybrid-smoke.mjs` + korte chat.

## LLM-strategie (mei 2026)

### Wat gebruikt Ollama vandaag?

| Pad | Backend | Ollama? |
|-----|---------|--------|
| Kennisbank + `motor_memory` (embed → Qdrant) | `OLLAMA_URL` + `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`) | **Ja — kritiek** |
| Chat `/api/chat/stream` | OpenClaw → OpenRouter (`CHAT_MODEL`) → n8n Factory | Nee (primary is cloud) |
| HTML/project builder | Dify → OpenRouter → n8n | Nee |
| `/code` agent | OpenRouter of Anthropic (`MOTOR_CODE_*`) | Nee |
| OpenClaw `openclaw.json` | `primary`: `openrouter/deepseek/deepseek-v4-pro` | Ollama alleen legacy in `models.json` |
| n8n `review-reply.json` | `127.0.0.1:11434` + `llama3.2` | Legacy op NUC |

**Hetzner Ollama (audit):** modellen `nomic-embed-text`, `llama3:8b`; `ollama serve` ~700 MB RSS idle; geen NVIDIA-GPU (virtio VGA). **NUC:** dubbele Ollama met extra modellen — stoppen na Hetzner-embed OK.

### Aanbevolen pad

1. **Primair:** Ollama op Hetzner **alleen voor embeddings** (`nomic-embed-text` behouden; **niet** willekeurig ander embed-model zonder Qdrant re-index).
2. **Primair (chat):** blijf bij OpenRouter + Dify + Anthropic waar al geconfigureerd; geen lokale 8B-chat op 16 GB RAM.
3. **Fallback:** bij Ollama-down tijdelijk chat/builder via bestaande cloud-keys; embeddings vereisen aparte provider + re-index (zie onder).

### Geen implementatie zonder goedkeuring

- `llama3:8b` op Hetzner verwijderen (`ollama rm llama3:8b`) — bespaart ~4,5 GB disk, geen Motor-code-impact.
- NUC: `sudo systemctl stop ollama` + disable (migration-doc).
- Embed-model wisselen → nieuwe Qdrant-collecties of volledige re-ingest.

### Volgende infra (niet LLM)

- n8n naar Hetzner; `COMPUTER_USE_URL` / webhooks mee.
- Motor Next op NUC laten (PM2 + `better-sqlite3` + local-executor).
