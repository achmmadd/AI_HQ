# Grondige controle Omega Supremacy — uitkomst

**Datum:** 2026-02-19

## Gecontroleerd

### 1. mission_control.py
- `load_state()` / `save_state()` werken; default state correct.
- `add_mission`, `start_mission`, `complete_mission`, `set_mission_progress` getest.
- Circuit breaker: `record_spend`, `circuit_breaker_ok`, `get_daily_spend`, Telegram-alert bij overschrijding.
- `create_specialist()` schrijft SOUL.md in `holding/agents/<name>/`.

### 2. telegram_bridge.py
- Import `mc_add_mission`, `mc_set_tunnel_url` met fallback als mission_control ontbreekt.
- `_jarvis_assign_specialist()`: keywords → shuri/vision/friday correct.
- Voice: download → Whisper (indien OPENAI_API_KEY) → add_voice_mission.
- «taak: …» / «opdracht: …» → mc_add_mission + reply.
- `/tunnel` slaat URL op via `mc_set_tunnel_url`.

### 3. agent_workers.py
- Import mission_control; poll elke 15s; Jarvis overgeslagen; één QUEUED per specialist per cyclus.
- Placeholder: start_mission → progress 0.3/0.7 → complete_mission; thought_trace geschreven.
- Ongebruikte imports `STATUS_QUEUED`, `STATUS_IN_PROGRESS` verwijderd.

### 4. dashboard.py
- Kanban leest `_load_missions()` (uit mission_control indien missions aanwezig).
- Start/Done roepen `start_mission` / `complete_mission` aan bij use_mc.
- Header: costs_today uit `get_daily_spend()`.
- BU-lijst: `agents` en `data` uitgesloten (alleen echte BU-mappen).
- Links-pagina: tunnel-URL uit `get_tunnel_url()`.

### 5. ai_chat.py
- Circuit breaker aan start: bij overschrijding geen API-call, duidelijke melding.
- Na Gemini-call: `record_spend(0.001)`; na OpenAI: `record_spend(0.01)`.

### 6. Docker
- **Aanpassing:** `omega_holding` volume vervangen door **bind mount `./holding:/app/holding`** voor:
  - omega-bridge
  - omega-mission-control
  - agent-workers  
  Zodat host-`holding/` (SOUL.md + `holding/data/mission_control.json`) in alle containers zichtbaar is en gedeeld wordt.

### 7. Bestanden
- `holding/agents/{jarvis,shuri,vision,friday}/SOUL.md` aanwezig.
- `holding/data/` wordt door mission_control aangemaakt; `mission_control.json` wordt bij eerste gebruik geschreven.

## Testresultaten

- `python3 -c "from mission_control import ...; add_mission('Test'); load_state()"` → OK.
- `timeout 3 python3 scripts/agent_workers.py` → start, één test-missie afgehandeld (QUEUED → COMPLETED).
- `from telegram_bridge import mc_add_mission, _jarvis_assign_specialist` → OK; specialist-toewijzing correct.

## Aanbeveling

Na wijzigingen: `docker compose up -d --build` (en eventueel `--profile with-tunnel`) om alle services met de nieuwe holding-mount te starten.
