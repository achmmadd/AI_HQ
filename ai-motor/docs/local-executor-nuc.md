# NUC-local executor (MotorsAI)

Zie ook `agent_service/docs/LOCAL_EXECUTOR.md` en `agent_service/docs/PC_BRIDGE.md`.

## Env (`ai-motor/.env`)

```
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
LOCAL_EXECUTOR_SECRET=<zelfde als op executor>
LOCAL_WORKSPACE_ROOT=/home/pietje/AI_HQ/projects
```

## Start executor

```bash
cd /home/pietje/AI_HQ/agent_service
export LOCAL_EXECUTOR_SECRET=...
./run_executor.sh
```

## Chat

Agent-modus + zinnen zoals *maak bestand*, *run npm test in project X* → **Actie op NUC** in het antwoord (geen n8n voor die turn).

## Checks

- `GET /api/local-executor/health` (ingelogd via MotorsAI)
- `GET /api/admin/integration-readiness` → `local_executor_reachable`
