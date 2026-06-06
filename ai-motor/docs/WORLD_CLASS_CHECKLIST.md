# MotorsAI — wereldklasse-checklist

Doel: één platform dat Claude/Cursor/Lovable voor Fumero/Bokas vervangt.  
Status: **sterke interne basis** · **Fase 4 polish afgerond** · items 8–10 gedeeltelijk op weg naar wereldklasse

| # | Criterium | Status | Notities |
|---|-----------|--------|----------|
| 1 | Eén chat-UI, intent-routing | ✅ | Orchestrator + unified workspace |
| 2 | OpenClaw gateway stabiel | ✅ | systemd `openclaw-gateway` op 18789; primair `google/gemini-2.0-flash` |
| 3 | Chat routing `openclaw` | ✅ | Getest: SSE `routing: openclaw`, antwoord via gateway; bij LLM-fout → n8n |
| 4 | Geheugen + hervatten project | ✅ | `project_resume_notes`, Mijn werk |
| 5 | React/Next projectstack | ✅ | `project-stack.ts`, preview |
| 6 | PC-bridge + VS Code skeleton | ✅ | `/api/chat/bridge/*`, `motors-vscode/` |
| 7 | Multi-file repo-agent | ❌ | Geen Cursor-niveau edits |
| 8 | Betrouwbare SLA / self-serve | 🟡 | Onboarding, Master Context UI, team-invite skeleton, white-label runbook (`docs/white-label-deploy.md`); **nog geen** Stripe billing of SLA-contract |
| 9 | Productie-apps + CI | 🟡 | `hybrid-smoke.mjs`, `verify-live.sh`, design system, Hetzner hybrid; **nog geen** volledige deploy-pipeline per klant-app |
| 10 | Laptop = eerste klas | 🟡 | Mobile bottom-nav, opa-proof touch targets, workspace shells; bridge nog MVP |

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

## Fase 4 additions (Sprint 4.3)

- **Master Context:** `/settings/context` — bewerken + chat-preview snippet
- **Team:** `/settings/team` — admin/editor/viewer, invite-link stub (geen e-mail infra)
- **White-label:** [`white-label-deploy.md`](white-label-deploy.md) — nieuwe tenant &lt; 1 dag
