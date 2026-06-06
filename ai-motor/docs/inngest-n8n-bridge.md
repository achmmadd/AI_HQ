# Inngest ↔ n8n bridge (Sprint 2.2)

Motor gebruikt **Inngest** voor durable workflows (HITL approvals, toekomstige scrape-cron). **n8n** blijft nodig voor computer-use / legacy Factory flows tot Fase 3 unified routing.

## Wanneer wat?

| Use case | Engine | Reden |
|----------|--------|-------|
| HITL goedkeuring, timeout/remind | **Inngest** | `step.waitForEvent`, geen verloren runs |
| Browser / computer-use | **n8n** (+ agent-browser) | Bestaande webhooks, Stagehand later |
| Chat primary | **OpenClaw** | Ongewijzigd — zie `lib/model-router.ts` |
| Factory OS fallback chat | **n8n** | Laatste redmiddel in chat stream |

## Events

| Event | Trigger | Doel |
|-------|---------|------|
| `motor/approval.requested` | `POST /api/approvals` | Start HITL workflow |
| `motor/approval.decided` | `PATCH /api/approvals` | Resume workflow na menselijke keuze |
| `motor/approval.reminder` | Timeout in workflow | Telegram/remind hook (uitbreidbaar) |
| `motor/n8n.relay` | n8n relay webhook | Legacy run → durable event |

## n8n → Inngest (optioneel)

**Endpoint:** `POST /api/inngest/n8n-relay`

Body (JSON):

```json
{
  "mode": "to-inngest",
  "workflow": "factory-scrape",
  "runId": "exec-123",
  "payload": { "klant": "fumero", "url": "https://..." }
}
```

Modes: `to-inngest` (default), `to-n8n`, `both`.

Optioneel secret: zet `INNGEST_N8N_RELAY_SECRET` en stuur header `x-inngest-relay-secret`.

n8n HTTP Request node voorbeeld:

- Method: POST
- URL: `https://motorsai.app/api/inngest/n8n-relay`
- Body: JSON hierboven

## Inngest → n8n (thin wrapper)

Code: `lib/inngest/n8n-bridge.ts` → `forwardInngestToN8n(webhookUrl, payload)`.

Webhook-volgorde (zelfde als chat agent mode):

1. `N8N_AGENT_WEBHOOK`
2. `COMPUTER_USE_URL`
3. `N8N_FACTORY_OS_WEBHOOK` / `N8N_FACTORY_WEBHOOK`

## Serve endpoint

Inngest Cloud / dev server synct functions via:

```
GET|POST|PUT /api/inngest
```

Zonder keys: JSON stub (`configured: false`) — build en chat blijven werken.

## Env

| Variabele | Rol |
|-----------|-----|
| `INNGEST_EVENT_KEY` | Events sturen (Cloud) |
| `INNGEST_SIGNING_KEY` | Serve auth (Cloud) |
| `INNGEST_DEV=1` | Lokale Inngest dev server (`npx inngest-cli dev`) |
| `INNGEST_APP_ID` | Default `motor-ai` |
| `INNGEST_APPROVAL_TIMEOUT_HOURS` | Default `24` |
| `INNGEST_N8N_RELAY_SECRET` | Optioneel relay auth |

Zie ook [model-config.md](model-config.md).
