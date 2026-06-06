# agent-browser on-demand (Sprint 2.2)

Browser automation draait **alleen on-demand** op Hetzner — geen 24/7 RAM-vreter.

## Infra

```bash
cd infra/agent-browser
docker compose --profile on-demand up -d    # start bij taak
docker compose --profile on-demand down      # stop na idle
```

Compose: `infra/agent-browser/docker-compose.yml` — `browserless/chrome` skeleton; Stagehand sidecar placeholder voor Fase 3.

## Motor env (NUC `.env.local` / PM2)

| Variabele | Verplicht | Rol |
|-----------|-----------|-----|
| `COMPUTER_USE_URL` | Aanbevolen | n8n webhook voor Agent mode (zie [computer-use-n8n.md](computer-use-n8n.md)) |
| `N8N_AGENT_WEBHOOK` | Alias | Heeft voorrang op Factory webhook voor agent-chat |
| `AGENT_BROWSER_URL` | Nee | Directe health naar browserless sidecar (default `http://127.0.0.1:8787` op Hetzner) |
| `AGENT_BROWSER_TOKEN` | Nee | Bearer token voor browserless (compose `TOKEN`) |
| `COMPUTER_USE_VIEWER_URL` | Nee | iframe live view in Agent-paneel |
| `COMPUTER_USE_SCREENSHOT_URL` | Nee | Screenshot proxy via `/api/agent/screenshot` |

Runtime-check: `GET /api/computer-use` (ingelogde sessie).

## Flow (eindbeeld Fase 3)

1. Gebruiker zet Agent mode aan → Motor POST naar `COMPUTER_USE_URL` (n8n).
2. n8n start on-demand `agent-browser` compose profile (of roept bestaande `agent_service/` aan op NUC).
3. Browser-taak eindigt → container down / idle timeout.

OpenClaw blijft primary voor normale chat; agent-browser alleen voor computer-use.
