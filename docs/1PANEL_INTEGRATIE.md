# Omega AI-Holding ↔ 1Panel integratie

Industrieel serverbeheer via 1Panel, met Omega Command Center in 1Panel-stijl.

---

## Snel: de lijm in Cursor

Het **install_1panel_bridge.sh**-script is de lijm: het zorgt ervoor dat de Python-omgeving van je AI kan praten met de Docker-omgeving van 1Panel.

1. Open de **terminal in Cursor** (in de map `AI_HQ`).
2. Voer uit:
   ```bash
   chmod +x scripts/install_1panel_bridge.sh && ./scripts/install_1panel_bridge.sh
   ```
3. Vul de 1Panel-URL en API-key in (1Panel → Instellingen → Panel). Daarna wordt `.env.1panel` geschreven en de verbinding getest.

**De visuele transitie**  
Je dashboard op **poort 8501** ziet er daarna compleet anders uit: geen eenvoudige website meer, maar een interface met de grijstinten (#141414) en blauwe accenten (#1677ff) van 1Panel. Dat geeft een naadloze ervaring als je schakelt tussen serverbeheer (1Panel) en AI-management (Omega Command Center). Ververs de pagina of herstart Streamlit om het te zien.

---

## Status

**Gedaan:** 1Panel - Instellingen - Panel (API inschakelen, API-key), eventueel IP-allowlist. **De rest:** eenmalig `./scripts/install_1panel_bridge.sh` (of met env vars), daarna `./scripts/singularity_rest.sh` en start (launch_factory of docker compose). Zie `docs/SINGULARITY_1PANEL.md`.

---

## Singularity-stack (Master Prompt)

Voor de volledige **Omega 1Panel Edition**-stack (omega_core + omega_dashboard + bu_*):

- **Compose:** `docker-compose.singularity.yml`
- **Bridge:** `omega_1panel_bridge.py` (CPU/RAM, restart, firewall)
- **Telegram:** `/panel`, `/restart <naam>`, `/secure`
- **Dashboard:** tab Server Health (1Panel), Logs (terminal-widget)
- **Log-watcher:** `python3 scripts/onepanel_log_watcher.py` (Error/Panic → Telegram)
- **Volledige uitleg en 1Panel-instellingen:** `docs/SINGULARITY_1PANEL.md`

---

## Wat er staat

### 1. Docker Compose (1Panel import)

- **Bestand:** `docker-compose.yml`  
- **Services:** `omega-bridge`, `heartbeat`, `dashboard`, `engineer`  
- **Build:** `docker compose build` → image `omega-holding:latest`  
- **Run:** `docker compose up -d`  
- **1Panel:** Container → Compose → Create → bestand kiezen of inhoud plakken  

Vereist `.env` met `TELEGRAM_BOT_TOKEN` en `GOOGLE_API_KEY` (of OpenAI/Ollama).

### 2. 1Panel API-bridge

- **Script:** `./scripts/install_1panel_bridge.sh`  
  - Vraagt 1Panel-URL en API-key (Instellingen → Panel)  
  - Schrijft `.env.1panel` (ONEPANEL_BASE_URL, ONEPANEL_API_KEY)  
  - Test verbinding (dashboard/base/os)  
- **Python:** `scripts/onepanel_api.py`  
  - Token: `md5('1panel' + API_KEY + Timestamp)`  
  - `onepanel_request(method, path)`, `get_system_status()`  
  - CLI: `python3 scripts/onepanel_api.py status`  

Jarvis/ai_tools kunnen hiermee metrics ophalen en (later) Sleep Calculator / Decision Engine aansturen.

### 3. Omega Command Center (dashboard 1Panel-stijl)

- **Thema:** `.streamlit/config.toml` — dark, primaryColor `#1677ff`, backgroundColor `#141414`  
- **UI:** `dashboard.py` — zijbalk-navigatie (Status, Data, Links), kaarten met `.omega-card`, kleuren #141414 / #1677ff / #1f1f1f  

Ververs het dashboard; na herstart Streamlit zie je de nieuwe stijl.

### 4. BU deploy & log-monitor

- **deploy_bu.sh:** `./scripts/deploy_bu.sh marketing` — maakt `holding/marketing` en `holding/marketing/data`, 1Panel App Store-logica.  
- **onepanel_log_monitor.sh:** Checkt Docker-containers (omega-*); bij niet-running stuurt hij een Telegram-alert (vereist `TELEGRAM_CHAT_ID` in .env).  
  - Cron of systemd timer: periodiek uitvoeren.  
  - Uitbreiding: 1Panel error logs (Nginx/Docker) lezen en bij kritieke fout Telegram: *"Meneer, container [BU-Marketing] is gecrasht. Ik heb 1Panel opdracht gegeven voor een herstart."*

---

## Volgende stappen (optioneel)

- **Resource monitoring:** 1Panel-metrics (CPU, RAM) in `onepanel_api.py` ophalen en aan Sleep Calculator / Decision Engine koppelen (Jarvis pauzeert bij hoge temperatuur/load).  
- **WAF/Firewall:** OpenResty/Nginx van 1Panel als reverse proxy; Vesting-modus via 1Panel Firewall API.  
- **Per-BU containers:** In `docker-compose.yml` of via 1Panel App Store een service per BU (bijv. `omega-bu-marketing`) toevoegen; `deploy_bu.sh` kan daarop aansluiten.  
- **Log → Telegram:** 1Panel log-API of bestanden (Nginx/Docker) monitoren en bij errors Jarvis een bericht laten sturen + evt. herstart via API.

---

## Referentie

- 1Panel API: `http://IP:port/1panel/swagger/index.html`  
- Auth: headers `1Panel-Token` (md5('1panel'+API_KEY+Timestamp)), `1Panel-Timestamp`  
- API-key: 1Panel → Instellingen → Panel
