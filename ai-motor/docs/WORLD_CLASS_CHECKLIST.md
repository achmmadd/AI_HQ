# MotorsAI — wereldklasse-checklist

Doel: één platform dat Claude/Cursor/Lovable voor Fumero/Bokas vervangt.  
Status: **sterke interne basis** · **nog geen wereldklasse vs. Claude/Cursor/Lovable**

| # | Criterium | Status | Notities |
|---|-----------|--------|----------|
| 1 | Eén chat-UI, intent-routing | ✅ | Orchestrator + unified workspace |
| 2 | OpenClaw gateway stabiel | ✅ | systemd `openclaw-gateway` op 18789; primair `google/gemini-2.0-flash` |
| 3 | Chat routing `openclaw` | ✅ | Getest: SSE `routing: openclaw`, antwoord via gateway; bij LLM-fout → n8n |
| 4 | Geheugen + hervatten project | ✅ | `project_resume_notes`, Mijn werk |
| 5 | React/Next projectstack | ✅ | `project-stack.ts`, preview |
| 6 | PC-bridge + VS Code skeleton | ✅ | `/api/chat/bridge/*`, `motors-vscode/` |
| 7 | Multi-file repo-agent | ❌ | Geen Cursor-niveau edits |
| 8 | Betrouwbare SLA / self-serve | ❌ | NUC-setup, geen billing |
| 9 | Productie-apps + CI | ❌ | Prototypes, geen volledige pipeline |
| 10 | Laptop = eerste klas | ❌ | Bridge MVP |

## NUC-model (OpenClaw)

- **Niet gebruiken:** `qwen3:4b` op 8 GB RAM (OOM ~39 GiB).
- **Primair:** `ollama/llama3:8b` met `contextWindow` ≥ 16000 in `~/.openclaw/openclaw.json`.
- **Alternatief:** Google `gemini-2.0-flash` als API-key geldig is.

## Snel testen

```bash
openclaw gateway status
curl -s http://127.0.0.1:3040/api/stack-health | jq '.dependencies.openclaw'
BASE_URL=http://127.0.0.1:3040 node scripts/smoke-chat-openclaw.mjs
```

**Snelheid (ingebouwd):** OpenClaw-chat slaat Qdrant-preamble over (`OPENCLAW_FAST_PREAMBLE`, default aan), cachet gateway-health 45s, parallel health + prompt-bouw. SSE toont `routing` + `ttft_ms` bij eerste token.

Chat: https://motorsai.app/chat — in SSE `done` controleren: `routing: "openclaw"`.
