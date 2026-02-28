# Holding Runbook

## Eerste keer setup

```bash
# 1. Zorg dat omega_db schema up-to-date is (migratie draait automatisch)
cd ~/AI_HQ
python3 -c "import omega_db; omega_db.init_schema()"

# 2. Seed tenants en agents
python3 -c "from holding.src.agent_registry import seed_tenants_and_agents; print(seed_tenants_and_agents())"

# Of via Telegram:
# /holding seed
```

## Dagelijks gebruik

### Via Telegram
```
/holding status                       — overzicht
/holding tasks [lunchroom|webshop]    — taken bekijken
/holding review <task_id>             — review bekijken
/holding approve <task_id>            — goedkeuren
/holding reject <task_id> <feedback>  — afkeuren
/holding costs                        — kosten
/holding health                       — NUC status
```

### Via Streamlit (Mission Control :8501)
- Holding Overview — tenant cards, agent status
- Holding Tasks — pipeline per status
- Holding Agents — hiërarchie + performance
- Holding Costs — kosten per tenant/agent

## Troubleshooting

### Agent in "error" status
```bash
python3 -c "import omega_db; omega_db.holding_agent_set_status('lr_luna', 'idle')"
```

### Taak zit vast
```bash
python3 -c "import omega_db; omega_db.holding_task_update_status('ht_xxx', 'pending')"
```

### Database tabellen checken
```bash
python3 -c "
import omega_db
with omega_db.get_connection() as conn:
    for r in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\"):
        print(r[0])
"
```

### Costs resetten (alleen bij testen)
```bash
python3 -c "
import omega_db
with omega_db.get_connection() as conn:
    conn.execute('DELETE FROM cost_log')
"
```

## Performance

- Max 1 concurrent LLM call (semaphore)
- NUC: bewaar RAM < 7GB
- Gemini rate limits: automatische retry in ai_chat_retries.py
- Als RAM < 500MB: pauzeer task queue
