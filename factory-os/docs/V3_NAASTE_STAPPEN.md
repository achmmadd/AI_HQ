# Factory OS V3 — automatisch gedaan vs. handmatig

**Uitgevoerd op de NUC (Cursor):**

- `~/.openclaw/mcp.json` (chmod 600) — 6 MCP servers, collection `factory_os`
- `~/.openclaw/workspaces/factory-os/SYSTEM.md`
- Qdrant collection **`factory_os`**, vectors **1536** (Cosine)
- `.env`: **`EMBEDDING_DIMENSION=1536`** toegevoegd (pas aan als Dify ander embed-model gebruikt)
- `scripts/factory_os_backup.sh` + **cron** dagelijks 03:00
- `factory-os/docs/QDRANT_RESTORE_RUNBOOK.md`
- n8n webhook **`/webhook/factory-os`** getest — **ok**

**Nog door jou / omgeving:**

| Item | Actie |
|------|--------|
| **N8N_API_KEY** | In n8n UI API key aanmaken → in `~/AI_HQ/.env` zetten → dan werkt n8n MCP + workflow-export in backup volledig |
| **TELEGRAM_BOT_TOKEN** + **TELEGRAM_CHAT_ID** | Invullen in `.env` (nu leeg) → test `getMe` / rollout STAP 5 |
| **OpenClaw CLI** | Vereist **Node ≥ 22.12**; nu Node 20 → upgrade Node (nvm/apt) → `openclaw daemon restart`, `openclaw mcp list`, skills |
| **git push** | SSH-key voor `git@github.com` op deze machine → `git push origin master` |

**Verifiëren:**

```bash
curl -s http://localhost:6333/collections/factory_os
cat ~/.openclaw/mcp.json | python3 -c "import sys,json; print(list(json.load(sys.stdin)['mcpServers']))"
```
