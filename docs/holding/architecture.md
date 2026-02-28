# Holding Architecture — Fase 0 (Garage Mode)

## Overzicht

De holding-module breidt het bestaande Omega-systeem uit met multi-tenant agent teams.
Twee bedrijven (tenants): **Lunchroom** en **Webshop**, elk met 3-4 agents.

## Stack

```
telegram_bridge.py  →  /holding commands
ai_chat.py          →  Gemini + holding tools (create_holding_task, get_holding_status, review_holding_task)
ai_tools.py         →  holding tools geregistreerd
omega_db.py         →  data/omega.db (bestaande + holding_ tabellen)
holding/src/        →  module (tenant_context, agent_registry, llm_router, task_pipeline, correction_engine, cost_tracker)
pages/              →  Streamlit multi-page (holding_overview, _tasks, _agents, _costs)
config/             →  tenants.yaml, correction_rules.yaml
```

## Database

Alle holding-tabellen staan in dezelfde `data/omega.db`:
- `tenants` — bedrijfsprofielen
- `holding_agents` — agents per tenant
- `holding_tasks` — taak-pipeline
- `corrections` — auditor correcties
- `cost_log` — LLM kosten tracking
- `holding_audit` — audit trail

Migratie: `migrations/001_holding_tables.sql` (idempotent, draait bij `init_schema()`).

## Agent Hiërarchie

Per tenant:
1. **Manager** — strategie, delegatie
2. **Werkers** — content productie (Luna/Rico voor lunchroom, Nova/Scout voor webshop)
3. **Auditor** — kwaliteitscontrole (Chef voor lunchroom, Judge voor webshop)

## Task Pipeline

```
create_task → assign_to_agent → execute_task (LLM) → submit_for_review → auditor_review
  → confidence >= 0.9 + pass: auto_approve
  → confidence < 0.8 of fail: send_back (max 3 revisies)
  → 3x gefaald of critical: escalate via Telegram
```

## LLM Routing

- **Gemini** (via bestaande `ai_chat.py`) = primair
- **Ollama** (lokaal, optioneel) = voor simpele taken
- `asyncio.Semaphore(1)` — max 1 concurrent LLM call
- Alle calls gelogd in `cost_log`

## Integratie

De holding haakt aan op bestaande componenten:
- `telegram_bridge.py`: `/holding` command toegevoegd
- `ai_tools.py`: 3 holding tools toegevoegd
- `ai_chat.py`: tools geregistreerd in Gemini function declarations
- `omega_db.py`: CRUD voor alle holding-tabellen
- `dashboard.py`: niet gewijzigd; Streamlit pages in `pages/`
