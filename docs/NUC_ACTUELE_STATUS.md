# NUC — Actuele status en handoff (voor volgende chat/agent)

Dit document beschrijft **wat er nu op de NUC draait** en **wat we gedaan hebben**, zodat je (of een andere AI/agent) in een volgende sessie verder kunt. Laatste grote update: grondige test + fixes (feb 2025).

---

## 1. Huidige architectuur (Docker + omega.db)

| Onderdeel | Hoe het draait | Poort / pad |
|-----------|----------------|-------------|
| **Omega Telegram-bridge** | Docker: `omega-telegram-bridge` | Polling; praat met Gemini + ai_tools |
| **Mission Control (dashboard)** | Docker: `omega-mission-control` (Streamlit) | http://localhost:8501 |
| **Heartbeat** | Docker: `omega-heartbeat` | Elke 60s naar omega.db |
| **Engineer daemon** | Docker: `omega-engineer` | Controleert bridge, git rollback mogelijk |
| **Agent workers** | Docker: `omega-agent-workers` | Pollt omega_db voor QUEUED missions |
| **Resource warden** | Docker: `omega-resource-warden` | Temp/load bewaking |
| **Tunnel watcher** | Docker: `omega-tunnel-watcher` | Cloudflare tunnel-URL bijwerken |
| **Cloudflared** | Docker: `omega-cloudflared` | Tunnel naar dashboard (optioneel, profile) |
| **Evomap backend** | Docker: `evomap-backend` (apart compose in `evomap/`) | http://localhost:8000 |
| **Evomap frontend** | Docker: `evomap-frontend` | http://localhost:3001 |

**Data (Single Source of Truth):**  
- Database: **`holding/data/omega.db`** (SQLite, WAL). Bevat: missions, tasks, notes, approvals, heartbeat_history, mission_state.  
- Souls (SOUL.md voor agents): **`holding/data/souls/`** — moet bestaan voor `get_soul_context` in containers (omdat `./holding/data` overschrijft `/app/data`).  
- Logs: Docker volume `omega_logs` + evomap eigen logs.

**Start/stop:**  
- Hoofdstack: `cd ~/AI_HQ && docker compose up -d` (of `docker compose build && docker compose up -d --force-recreate` na code/env wijzigingen).  
- Evomap: `cd ~/AI_HQ/evomap && docker compose up -d`.

---

## 2. Wat we gedaan hebben (grondige test + fixes)

- **Telegram Conflict opgelost**  
  Er draaide een lokale `telegram_bridge.py` + `engineer_daemon.py` naast Docker. Alleen **één** Omega-bridge mag getUpdates doen. Lokale processen gestopt; alleen de Docker-bridge mag draaien.

- **Engineer: git in container**  
  In de Docker-image ontbrak `git`; engineer kon geen rollback. **Dockerfile** aangepast: `git` en `procps` toegevoegd. Image herbouwd.

- **Git “dubious ownership”**  
  Container draait als root, repo van pietje. In **Dockerfile**: `git config --global --add safe.directory /app`.

- **SOUL-bestanden in container**  
  Volume `./holding/data:/app/data` overschaduwde `./data/souls/`. Souls gekopieerd naar **`holding/data/souls/`** (o.a. trend_hunter, copy_architect, seo_analyst, visual_strategist, lead_gen).

- **read_note verbeterd**  
  AI gaf vaak alleen titel door; notitie niet gevonden. **ai_tools.read_note** uitgebreid met zoeken op titel/slug (fuzzy match op `id` en `title`).

- **list_tasks**  
  Return-dict uitgebreid met **`count`** voor duidelijke feedback.

- **git_commit timeouts**  
  Timeout verhoogd (add 120s, commit 60s) en **.gitignore** uitgebreid zodat geen enorme mappen (Movies, Music, venv, …) worden geadd.

- **Ollama bereikbaar vanuit containers**  
  Ollama luisterde alleen op localhost.  
  1) **Ollama:** `OLLAMA_HOST=0.0.0.0:11434` in systemd override (`/etc/systemd/system/ollama.service.d/listen.conf`), daemon-reload + restart.  
  2) **UFW:** Containers op Docker-bridge konden host niet bereiken. Regel toegevoegd:  
     `sudo ufw allow from 172.16.0.0/12 to any port 11434 comment "Ollama voor Docker containers"`.  
  In **.env**: `OLLAMA_HOST=http://172.17.0.1:11434` en `OLLAMA_MODEL=llama3:8b`.

- **RAG + audit-tools in image**  
  **requirements.txt**: `sentence-transformers`, `bandit`, `pylint` toegevoegd. Image herbouwd. RAG-index opgebouwd met `rag.index_all()` (chunks in omega.db / sqlite-vec).

- **Agent workers logs**  
  Misleidende “READ mission_control.json” verwijderd; workers gebruiken omega_db.

- **Evomap API vanuit containers**  
  `EVOMAP_API_URL=http://172.17.0.1:8000` in **.env** zodat omega-containers de Evomap-backend kunnen bereiken.

---

## 3. Belangrijke paden en config

- **Projectroot:** `~/AI_HQ` (NUC).  
- **Code o.a.:** `ai_chat.py`, `ai_tools.py`, `telegram_bridge.py`, `omega_db.py`, `mission_control.py`, `dashboard.py`, `rag.py`, `scripts/agent_workers.py`, `scripts/engineer_daemon.py`.  
- **Config:** `.env` (TELEGRAM_BOT_TOKEN, GOOGLE_API_KEY, OLLAMA_HOST, OLLAMA_MODEL, EVOMAP_API_URL). Niet in git.  
- **Database:** `holding/data/omega.db` (gedeeld door alle Omega-containers).  
- **Souls:** `holding/data/souls/*_SOUL.md` en `data/souls/` (host); in container telt alleen `holding/data/souls/`.  
- **Evomap:** `evomap/docker-compose.yml` (frontend 3001, backend 8000).

---

## 4. Snel controleren of alles werkt

- **Containers:**  
  `docker ps` — alle omega-* en evomap-* draaien.  
  `docker logs omega-telegram-bridge --tail 20` — geen “Conflict” errors.

- **Eén commando (alle tools in container):**  
  `docker exec omega-telegram-bridge python3 -c "import ai_tools; r=ai_tools.system_status(); print(r); r2=ai_tools.list_tasks('open'); print('tasks', r2.get('count')); r3=ai_tools.run_ollama('Zeg alleen: OK'); print('ollama', r3.get('ok'))"`

- **Telegram-testprompts (kort):**  
  - “Maak taak 'X' en schrijf notitie 'Y' met inhoud: Z.”  
  - “Laat de open taken zien en lees de notitie 'Y'.”  
  - “Vraag aan Ollama: wat is 7 maal 8? Geef alleen het getal.”

---

## 5. Waar meer staat

- **Algemene NUC-samenvatting (ouder, o.a. launch_factory):** `docs/SAMENVATTING_NUC_SETUP.md`.  
- **Dit bestand:** actuele Docker + omega.db + Evomap + Ollama/UFW stand.  
- **Plan/backlog:** zie eventueel `.cursor/plans/` of project-backlog als die er is.

Als je dit bestand leest in een nieuwe chat of met een andere agent: dit is de huidige stand; je kunt hierop verder bouwen.
