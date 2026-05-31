# Motor AI Code (`/code`)

Production coding workspace — Codex/Cursor-light, geïntegreerd in MotorsAI maar **apart van Chat**.

## Wat het is

| Route | Functie |
|-------|---------|
| `/code` | Workspace UI: projecten, bestanden, editor, terminal, agent |
| `/cowork` | Landing automation/approvals (apart van Chat/Code) |
| `/api/code/workspaces` | Lijst + aanmaken projecten op schijf |
| `/api/code/files` | Tree, lezen, schrijven (via executor) |
| `/api/code/terminal` | Allowlisted commando's in workspace |
| `/api/code/git` | Git status, commit, push |
| `/api/code/import` | Chat-project → workspace (Open in Code) |
| `/api/code/executor-target` | NUC vs PC bridge status |
| `/api/code/agent` | Code agent tool-loop (OpenRouter of Anthropic) |

## Workspace layout (per klant)

```
$LOCAL_WORKSPACE_ROOT/     # default ~/AI_HQ/projects
  bokas/
    mijn-app/
      README.md
  fumero/
    ...
```

Klant komt uit de company switcher (`bokas` / `fumero`).

## Vereisten

```bash
LOCAL_EXECUTOR_URL=http://127.0.0.1:8790
LOCAL_EXECUTOR_SECRET=...
LOCAL_WORKSPACE_ROOT=/home/pietje/AI_HQ/projects
OPENROUTER_API_KEY=...                      # aanbevolen voor /code agent
MOTOR_CODE_PROVIDER=openrouter|anthropic|auto # auto = OR als key aanwezig
MOTOR_CODE_MODEL=deepseek/deepseek-v4-flash  # default OpenRouter (override)
# OPENROUTER_FALLBACK_MODEL=deepseek/deepseek-v4-flash  # retry bij 429
# MOTOR_CODE_MODEL=openrouter/pareto-code   # goedkoper, auto-routing
# MOTOR_CODE_MIN_CODING_SCORE=0.65
ANTHROPIC_API_KEY=...                       # fallback / web research
MOTOR_CODE_EXECUTOR=auto|nuc|bridge         # optioneel
MOTOR_CODE_BRIDGE_ID=bridge_...             # optioneel PC bridge
```

Zie ook `docs/env-recommended.code.txt`.

Executor starten:

```bash
cd ~/AI_HQ/agent_service && ./run_executor.sh
```

## Agent tools

- `read_file`, `write_file`, `list_files`, `run_command`, `search_codebase`
- Uitvoering via **NUC local executor** of **PC bridge** (`lib/code-executor.ts`)
- `write_file` → diff review in UI (standaard) vóór schrijven naar schijf
- Max 12 turns per request
- Usage gelogd als `motor-code`

## Definition of Done (handmatig)

1. Login → https://motorsai.app/code
2. Klant **bokas** → project `test-app` aanmaken
3. Map bestaat: `~/AI_HQ/projects/bokas/test-app/`
4. Agent: “Maak index.html met Hello Motor Code” → diff review → **Toepassen** → tree refresh
5. Terminal: `ls` → output; Git: commit + push
6. Chat project → knop **Code** → opent `/code` met bestanden
7. `npm run build` groen; PM2 restart

## Smoke & phase tests

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
MOTORSAI_TOKEN=… node scripts/smoke-quality.mjs
MOTORSAI_TOKEN=… node scripts/test-code-phases.mjs   # fases 1–18
MOTORSAI_TOKEN=… node scripts/test-cowork.mjs
```

## Fase 2 — compleet

- ✅ Monaco editor + syntax highlight
- ✅ Preview panel voor HTML
- ✅ Annotate (selectie → agent)
- ✅ `@file` mentions
- ✅ Diff review vóór apply
- ✅ Git commit/push (`CodeGitBar`)
- ✅ Open in Code vanuit `/chat` (`/api/code/import`)
- ✅ PC bridge als executor target
- ✅ `/cowork` route + sidebar

## Gerelateerd

- [local-executor-nuc.md](./local-executor-nuc.md)
- [motor-build-guide.md](./motor-build-guide.md)
- [WORLD_CLASS_CHECKLIST.md](./WORLD_CLASS_CHECKLIST.md) item #7
