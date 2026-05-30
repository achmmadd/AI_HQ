# NUC Local Executor

Whitelisted bestands- en commando-operaties binnen `LOCAL_WORKSPACE_ROOT` (standaard `/home/pietje/AI_HQ/projects`).

## Starten

```bash
cd /home/pietje/AI_HQ/agent_service
export LOCAL_EXECUTOR_SECRET="$(openssl rand -hex 32)"
chmod +x run_executor.sh
./run_executor.sh
```

Zelfde secret in `ai-motor/.env`:

```
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
LOCAL_EXECUTOR_SECRET=<zelfde waarde>
LOCAL_WORKSPACE_ROOT=/home/pietje/AI_HQ/projects
```

## PM2 (optioneel)

```javascript
{
  name: "local-executor",
  cwd: "/home/pietje/AI_HQ/agent_service",
  script: "run_executor.sh",
  interpreter: "bash",
}
```

## API

- `GET /executor/health` — geen auth
- `POST /executor/execute` — `Authorization: Bearer <LOCAL_EXECUTOR_SECRET>`

Body:

```json
{ "op": "read_file", "path": "myapp/README.md" }
{ "op": "write_file", "path": "myapp/foo.txt", "content": "hello" }
{ "op": "list_dir", "path": "myapp" }
{ "op": "run_command", "command": "npm run build", "cwd": "myapp" }
```

## Allowlist commando’s

Prefixes: `npm `, `npx `, `node `, `python3 `, `pnpm `, `yarn `, `git status`, `git diff`, `git log`, `ls`, `pwd`, `cat `, `make `.

Geen shell-meta (`;`, `|`, `$`, backticks, …).

## MotorsAI

Chat in **agent-modus** met lokale intent (bv. “maak bestand …”, “run npm test”) roept de executor aan vóór n8n en toont **Actie op NUC: …** in het antwoord.
