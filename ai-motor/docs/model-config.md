# Model Config (MotorsAI — Claude-vervanger)

Doel: **normale chat** is je dagelijkse werkpaard (OpenClaw + geheugen + tools). **Agent-modus** alleen voor browser/computer-use.

## Defaults (ingebouwd)

| Variabele | Default | Rol |
|-----------|---------|-----|
| `CHAT_MODEL` | `deepseek/deepseek-v4-pro` | Dagelijkse chat |
| `CHAT_RESEARCH_MODEL` | `perplexity/sonar-pro` | “Zoek op…” — live web in één call |
| `MOTORS_CHAT_USE_OPENCLAW` | `auto` | OpenClaw als gateway draait |
| `MOTORS_CHAT_FAST_PATH` | `0` | Geen bypass naar zwakke flash-route |
| `MOTORS_CHAT_RICH_CONTEXT` | `1` | Qdrant + kennisbank in preamble |
| `MOTORS_CHAT_OPENROUTER_FALLBACK` | `1` | Als Claw faalt → OpenRouter v4-pro |

Kopieer `.env.recommended` naar `.env.local` en vul `OPENROUTER_API_KEY` in.

Max live pagina's: `SCRAPE_PROVIDER=auto` (default) — Jina als `JINA_API_KEY` gezet, anders native fetch. Zie [docs/platform/url-reader.md](platform/url-reader.md).

## Qdrant-collecties (multi-tenant)

Canonical patroon per klant (Week 1 besluit — dual-search, geen scrape-merge):

| Variabele | Default | Rol |
|-----------|---------|-----|
| `QDRANT_URL` | `http://127.0.0.1:6333` | Qdrant REST API (Hetzner via Tailscale in prod) |
| `QDRANT_COLLECTION_PREFIX` | `factory_os` | Prefix voor file-ingest + chat search → `factory_os_fumero`, `factory_os_bokas` |
| `QDRANT_COLLECTION` | `factory_os` | **Legacy** enkelvoudige bucket; alleen voor migratie of zoeken zonder klant |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | `fumero_kennisbank` | Scrape-bucket Fumero (dual-search naast ingest-collectie) |
| `QDRANT_BOKAS_KENNISBANK_COLLECTION` | `bokas_kennisbank` | Scrape-bucket Bokas |
| `QDRANT_MEMORY_COLLECTION` | `motor_memory` | Motor-geheugen (chat memory ingest) |

Helpers: `lib/qdrant-collection.ts` — `qdrantCollectionForScope(klant)`, `qdrantSearchCollectionsForScope(klant)`.

Migratie legacy → per-klant:

```bash
# Eerst tellen (geen writes)
node scripts/qdrant-migrate-collections.mjs --dry-run

# Kopieer vectors met payload client=fumero|bokas
node scripts/qdrant-migrate-collections.mjs --klant fumero
node scripts/qdrant-migrate-collections.mjs
```

Optioneel UI-spiegel (zelfde prefix als server): `NEXT_PUBLIC_QDRANT_COLLECTION_PREFIX` — alleen voor labels in client components.

## OpenClaw primary model

```bash
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-v4-pro"
systemctl --user restart openclaw-gateway.service
```

Zwaar (coding marathon): `openrouter/moonshotai/kimi-k2.6`

## Flow normale chat

1. Lokale actie? → NUC executor (`lees bestand`, `run npm …`)
2. Web-intent? → **Perplexity Sonar** via OpenRouter
3. Anders → **OpenClaw** (tools, geheugen)
4. Claw faalt? → **DeepSeek V4 Pro** via OpenRouter
5. Laatste redmiddel → n8n Factory OS

## Agent-modus

Alleen voor **browser** (n8n / computer-use). Niet nodig voor slimme chat.

## Observability — Langfuse Cloud (Sprint 2.1)

Geen self-host op Hetzner 16 GB — gebruik **Langfuse Cloud** (EU). SDK no-op als keys ontbreken.

| Variabele | Verplicht | Rol |
|-----------|-----------|-----|
| `LANGFUSE_PUBLIC_KEY` | Ja (voor tracing) | Cloud public key (`pk-lf-…`) |
| `LANGFUSE_SECRET_KEY` | Ja (voor tracing) | Cloud secret key (`sk-lf-…`) |
| `LANGFUSE_BASE_URL` | Nee | Default `https://cloud.langfuse.com` |
| `LANGFUSE_ENVIRONMENT` | Nee | `production` / `development` (default: `NODE_ENV`) |
| `LANGFUSE_RELEASE` | Nee | App release tag in traces |

Implementatie: `lib/observability/langfuse.ts` — chat stream trace per `conversationId` + `klant`/`workspace_id`.

## Model routing — `lib/model-router.ts` (Sprint 2.1 / 3.2 SSOT)

**Single source of truth** voor chat-routing. Model-IDs komen uit `lib/chat-models.ts`; routing-beleid uit `lib/chat-routing-policy.ts`. Wijzig chat-modellen of routing op **één** plek — importeer vanuit `model-router` in callers (niet rechtstreeks env lezen).

Centrale routinglaag. Volgorde: **local executor → OpenClaw → OpenRouter (via LiteLLM indien gezet) → n8n**.

| Bestand | Rol |
|---------|-----|
| `lib/chat-models.ts` | Model-IDs, timeouts, `CHAT_MODEL` / `FUMERO_*` env |
| `lib/chat-routing-policy.ts` | Feature flags (`MOTORS_CHAT_*`, `FUMERO_CHAT_FAST_PATH`) |
| `lib/model-router.ts` | `resolveOpenClawStreamRoute`, `resolveChatRoutingDecision`, LiteLLM URL |
| `docs/model-config.md` | Dit document — env-tabel + deploy |

Chat stream (`app/api/chat/stream/route.ts`) en OpenClaw handler (`lib/openclaw-chat-handler.ts`) gebruiken **alleen** `resolveOpenClawStreamRoute` / `resolveChatRoutingDecision` — geen parallelle if-ketens.

Routingbeslissingen worden gelogd naar **Langfuse** (`routing_plan`, `routing_primary`, `litellm_proxy`) en **usage** (`routing_plan` in OpenMeter-stub + `done` SSE).

| Variabele | Default | Rol |
|-----------|---------|-----|
| `MOTORS_CHAT_USE_OPENCLAW` | `auto` | OpenClaw gateway als primary |
| `MOTORS_CHAT_OPENROUTER_FALLBACK` | `1` | Claw faalt → OpenRouter |
| `MOTORS_CHAT_FAST_PATH` | `0` | OpenRouter bypass (geen Claw) |
| `FUMERO_CHAT_FAST_PATH` | `0` | Fumero Max direct OpenRouter |
| `LITELLM_BASE_URL` | — | Hetzner LiteLLM proxy (bijv. `http://hetzner-motor:4000`) |
| `LITELLM_PROXY_URL` | — | Alias voor `LITELLM_BASE_URL` |

Zonder `LITELLM_*` praat Motor direct met OpenRouter (`lib/openrouter-request.ts`).

LiteLLM sidecar (Hetzner only): `infra/litellm/docker-compose.yml` + `config.yaml`.

## Usage logging & OpenMeter stub

Chat stream schrijft tokens naar `usage_logs` (SQLite) via `lib/chat-usage.ts`.

| Variabele | Default | Rol |
|-----------|---------|-----|
| `OPENMETER_STUB` | `0` | `1` = log CloudEvents-vormige usage naar stdout |
| `USE_POSTGRES` | `0` | `1` = persist usage events naar PG `usage_events` (naast SQLite `usage_logs`) |

OpenMeter PG schema: `lib/db/drizzle/schema/usage-events.ts` — live OpenMeter ingest volgt in Fase 4+.

## Nango OAuth skeleton (Sprint 2.3.1)

Placeholder voor Odoo/Mollie OAuth — geen live calls tot provider `available`.

| Variabele | Default | Rol |
|-----------|---------|-----|
| `NANGO_ENABLED` | `0` | `1` = Nango-pad actief |
| `NANGO_SECRET_KEY` | — | Server secret (Nango dashboard) |
| `NANGO_HOST` | `https://api.nango.dev` | Nango API host (self-host optioneel later) |

Implementatie: `lib/connectors/nango.ts` + registry entries `odoo`, `mollie`.

## Durable workflows — Inngest (Sprint 2.2)

HITL approvals + toekomstige scrape-cron. No-op zonder keys — chat/OpenClaw ongewijzigd.

| Variabele | Verplicht | Rol |
|-----------|-----------|-----|
| `INNGEST_EVENT_KEY` | Ja (Cloud) | Events sturen naar Inngest |
| `INNGEST_SIGNING_KEY` | Ja (Cloud) | Auth op `/api/inngest` serve handler |
| `INNGEST_DEV` | Nee | `1` = lokale dev server (`npx inngest-cli dev`) |
| `INNGEST_APP_ID` | Nee | Default `motor-ai` |
| `INNGEST_APPROVAL_TIMEOUT_HOURS` | Nee | Default `24` — HITL wait timeout |
| `INNGEST_N8N_RELAY_SECRET` | Nee | Bearer/ header secret voor `/api/inngest/n8n-relay` |

Implementatie: `lib/inngest/` — HITL `approval-hitl` workflow; bridge: [docs/inngest-n8n-bridge.md](inngest-n8n-bridge.md).

## agent-browser on-demand (Sprint 2.2)

| Variabele | Rol |
|-----------|-----|
| `COMPUTER_USE_URL` | n8n agent webhook (primary) — zie [computer-use-n8n.md](computer-use-n8n.md) |
| `AGENT_BROWSER_URL` | Directe sidecar health (Hetzner on-demand compose) |
| `AGENT_BROWSER_TOKEN` | browserless token (compose) |

Infra: `infra/agent-browser/docker-compose.yml` — `--profile on-demand`. Zie [agent-browser.md](agent-browser.md).

## Embeddings eval

Baseline: `nomic-embed-text` (niet wisselen zonder Qdrant re-index).

```bash
node scripts/eval-embeddings.mjs              # dry-run
node scripts/eval-embeddings.mjs --live       # vergelijk met EMBED_EVAL_CANDIDATE (default e5-base-trm-nl)
```

## Deploy

```bash
cd AI_HQ/ai-motor && nvm use && npm run build && pm2 restart ai-motor --update-env
```
