# Hetzner-migratie (runbook)

Doel: zware services (Qdrant, Ollama, Dify) gefaseerd verhuizen vanaf een NUC of thuisserver, zonder Motor-frontends in dezelfde PR te mengen met productfeatures.

**Fase 1 (NUC update + Dify op Hetzner):** zie [`hetzner-phase1.md`](hetzner-phase1.md) en scripts `scripts/hetzner-phase1-from-nuc.sh`.

## Uitgangspunten

- **Motor Next** (PM2, poort 3040) kan tijdelijk op de NUC blijven terwijl alleen backends verhuizen.
- Pas `.env` / `ecosystem.config.cjs` aan: alle URL’s die van host veranderen (`QDRANT_URL`, `DIFY_BASE_URL`, `OLLAMA_URL`, eventueel `COMPUTER_USE_URL` naar nieuwe n8n).
- Behoud **Tailscale** of **Cloudflare Tunnel** voor bereikbaarheid; documenteer de uiteindelijke interne vs publieke hostnames in de team-wiki of `README`.

## Voorgestelde volgorde

1. **Qdrant + Ollama**  
   - Grootste winst voor embedding-latency en RAM-isolatie.  
   - Migreer collections (snapshot/export) of herbouw kennisbank + `motor_memory` via normale ingest.  
   - Update `QDRANT_URL` en `OLLAMA_URL` op Motor; `verify-live.sh` / health-check.

2. **Dify** (indien self-hosted)  
   - Na vectordb stabiliteit, zodat Dify-workflows dezelfde Qdrant kunnen blijven gebruiken.  
   - Update builder/chat-gerelateerde Dify base URL + API keys in PM2 env.

3. **n8n / Computer Use worker**  
   - Zet `COMPUTER_USE_URL` naar de nieuwe webhook.  
   - Worker die Playwright of Computer Use draait: co-locate met GPU/CPU die je kiest; Motor blijft orchestrator.

4. **Motor Next** (optioneel laatste)  
   - Verplaats wanneer build/PM2 op Hetzner beheerbaar is; letzelfde Node-major als `AI_MOTOR_NODE` voor `better-sqlite3`.

## Checklist na elke fase

- [ ] Smoke `GET /api/health` (dependencies OK).  
- [ ] `GET /api/admin/integration-readiness` (geen secrets in response): Qdrant, Ollama, Agent-URL’s kloppen.  
- [ ] Eén korte chat in `/chat` met bestaande conversatie (geheugen + n8n).  
- [ ] Optioneel: Studio fal-route of builder-generate op acceptatie.

## Rollback

- Houd oude host een week read-only bereikbaar.  
- `.env` terugzetten op vorige URL’s; `pm2 restart ai-motor --update-env`.  
- Qdrant: restore snapshot indien nodig.

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
2. **Primair (chat):** blijf bij OpenRouter + Dify + Anthropic waar al geconfigureerd; geen lokale 8B-chat op 15 GB RAM.
3. **Fallback:** bij Ollama-down tijdelijk chat/builder via bestaande cloud-keys; embeddings vereisen aparte provider + re-index (zie onder).

### Geen implementatie zonder goedkeuring

- `llama3:8b` op Hetzner verwijderen (`ollama rm llama3:8b`) — bespaart ~4,5 GB disk, geen Motor-code-impact.
- NUC: `sudo systemctl stop ollama` + disable (migration-doc).
- Embed-model wisselen → nieuwe Qdrant-collecties of volledige re-ingest.

### Volgende infra (niet LLM)

- n8n naar Hetzner; `COMPUTER_USE_URL` / webhooks mee.
- Motor Next op NUC laten (PM2 + `better-sqlite3` + local-executor).
