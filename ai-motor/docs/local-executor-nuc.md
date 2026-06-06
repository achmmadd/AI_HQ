# NUC-local executor (MotorsAI)

> **Sprint 3.2 bevestiging:** local-executor blijft **altijd op de NUC** — niet naar Hetzner. PC-bridge, VS Code skeleton en file/command-intents vereisen lage latency naar `LOCAL_WORKSPACE_ROOT`.

Zie ook `agent_service/docs/LOCAL_EXECUTOR.md` en `agent_service/docs/PC_BRIDGE.md`.

## Waarom NUC-only

| Reden | Detail |
|-------|--------|
| Latency | Bestanden lezen/schrijven, `npm test`, git — direct op lokale disk |
| Security | Workspace root blijft op vertrouwde thuisserver |
| Hybrid plan | Hetzner = zware backends; NUC = Motor UI + OpenClaw + **local-executor** |

Routing: chat stream probeert local-executor **vóór** OpenClaw/OpenRouter (`lib/model-router.ts` → `resolveChatRoutingDecision` met `includeLocalExecutor: true`).

## Env (`ai-motor/.env.local`)

```
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
LOCAL_EXECUTOR_SECRET=<zelfde als op executor>
LOCAL_WORKSPACE_ROOT=/home/pietje/AI_HQ/projects
MOTORS_LOCAL_CHAT=1              # 0 = local executor uit in chat
```

## Start executor

```bash
cd /home/pietje/AI_HQ/agent_service
export LOCAL_EXECUTOR_SECRET=...
./run_executor.sh
```

## Chat

Agent-modus + zinnen zoals *maak bestand*, *run npm test in project X* → **Actie op NUC** in het antwoord (geen n8n voor die turn).

SSE: `routing_plan` bevat `local_executor` als eerste hop wanneer intent matcht.

## Checks

- `GET /api/local-executor/health` (ingelogd via MotorsAI)
- `GET /api/admin/integration-readiness` → `local_executor_reachable`
- Hybrid smoke (`node scripts/hybrid-smoke.mjs`) — **geen** local-executor op Hetzner verwacht

## Rollback / migratie

Bij Hetzner-backend rollback (Qdrant, Ollama, n8n): local-executor **ongewijzigd** op NUC. Alleen Motor `.env.local` Hetzner-URLs terugzetten; executor blijft `:8790` lokaal.
