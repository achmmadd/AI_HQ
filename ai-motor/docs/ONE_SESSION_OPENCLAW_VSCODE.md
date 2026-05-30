# One session: OpenClaw Gateway + VS Code (MotorsAI)

## Anti-duplication

| Bestaand | Gebruik |
|----------|---------|
| `lib/motors-orchestrator.ts` | Client hints; server metadata naar OpenClaw |
| `app/api/chat/stream` | Ingress: local executor → OpenClaw → n8n |
| `agent_service/local_executor.py` :8790 | NUC + PC bridge zelfde protocol |
| Project/Mijn werk APIs | OpenClaw tools via HTTP |

## Env (ai-motor `.env.local`)

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<gateway token>
OPENCLAW_AGENT_ID=main
OPENCLAW_CHAT_ENABLED=1
MOTORS_INTERNAL_TOKEN=<optioneel voor tool HTTP>
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
LOCAL_EXECUTOR_SECRET=<secret>
```

## OpenClaw gateway inschakelen

1. Herstel config: `cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json`
2. Zet in `openclaw.json`:

```json
"gateway": {
  "mode": "local",
  "http": {
    "endpoints": {
      "chatCompletions": { "enabled": true }
    }
  }
}
```

3. Start (Node 22): `nvm use 22 && openclaw gateway`
4. Check: `GET https://motorsai.app/api/openclaw/health` (ingelogd)

## Routing in chat SSE

`done.routing`: `openclaw` | `n8n` | `local_executor`

## Tools

Zie `factory-os/openclaw/motors-tools.json` en `scripts/openclaw_register_motors_tools.sh`.

## VS Code

Map `motors-vscode/` — lokaal: `cd motors-vscode && npm install && code --install-extension .`

## PC bridge

`tools/motors-pc-bridge/` — uses public `/api/chat/bridge/*` routes:

```bash
node tools/motors-pc-bridge/index.js register --url https://motorsai.app
node tools/motors-pc-bridge/index.js poll
```

## Demo checklist (sessie-einde)

1. `GET /api/openclaw/health` — configured + reachable (or fallback documented)
2. Chat op `/chat` — SSE `done.routing` = `openclaw` or `n8n`
3. `node tools/motors-pc-bridge/index.js register` — returns bridge_id
4. VS Code: `MotorsAI: Set API Token` + `MotorsAI: Open Chat`
5. `pm2 restart ai-motor` after build
