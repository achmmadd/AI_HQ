# Samenvatting: wat we op de NUC hebben gebouwd (voor AI-context)

Dit document beschrijft wat er op de NUC staat, waarom, en wat waar draait. Bedoeld zodat een AI (of jij later) snel begrijpt wat er is gedaan.

---

## 1. Doel van de setup

- **Omega AI-Holding** = een stack die op de **NUC** 24/7 draait.
- Jij praat via **Telegram** tegen de bot(s); de bot voert op de NUC acties uit (taken, notities, status, scripts, herstarten).
- De NUC is de “machine die bestuurd wordt”; de bot mag alleen daar draaien (één Omega = geen Conflict met Telegram).

---

## 2. Wat draait er op de NUC?

| Onderdeel | Bestand / commando | Doel |
|-----------|--------------------|------|
| **Omega Telegram-bridge** | `telegram_bridge.py` (zonder `--zwartehand`) | Hoofdbot; leest berichten, roept AI + tools aan. Token uit `.env`. |
| **Zwartehand Telegram-bridge** | `telegram_bridge.py --zwartehand` | Tweede bot;zelfde AI/tools, andere token. Token uit `.env.zwartehand`. |
| **Dashboard (Mission Control)** | `dashboard.py` via Streamlit, poort 8501 | Web-overzicht: taken, notities, links. http://localhost:8501 (op de NUC). |
| **Heartbeat** | `heartbeat.py` | Daemon; logt elke 60 s “Heartbeat OK” in `logs/heartbeat.log`. |
| **Engineer** | `scripts/engineer_daemon.py` | Daemon; controleert elke 5 min of Omega-bridge nog draait; logt in `logs/engineer.log`. |

Alles wordt gestart met **`./launch_factory.sh`** (Omega + dashboard + heartbeat + engineer). Zwartehand apart met **`./scripts/launch_zwartehand.sh`**.

---

## 3. Waar staat wat? (mappen en belangrijke bestanden)

- **Projectroot op de NUC:** `~/AI_HQ` (of `/home/pietje/AI_HQ`).
- **Belangrijke code:**
  - `telegram_bridge.py` — Telegram-polling; stuurt berichten naar `ai_chat.get_ai_reply()`; bij Zwartehand wordt `TELEGRAM_ENV=.env.zwartehand` gezet.
  - `ai_chat.py` — Eén antwoord per bericht; gebruikt Gemini (met tools) → anders OpenAI → anders Ollama. Laadt `.env` voor keys.
  - `ai_tools.py` — Tools voor Gemini: `save_task`, `list_tasks`, `complete_task`, `write_note`, `list_notes`, `read_note`, `run_ollama`, `system_status`, `request_user_approval`, `run_safe_script`. Plus `get_and_execute_pending_approval` voor de “ja”-flow in Telegram.
  - `dashboard.py` — Streamlit Mission Control (poort 8501).
  - `heartbeat.py` — Heartbeat-daemon.
  - `scripts/engineer_daemon.py` — Engineer-daemon.
  - `scripts/stop_holding.sh` — Stopt Omega, heartbeat, streamlit, engineer (niet Zwartehand). Gebruikt door systemd `ExecStop`.
- **Config:**
  - `.env` — Omega-token (`TELEGRAM_BOT_TOKEN`), `GOOGLE_API_KEY` (voor Gemini). **Niet** op GitHub zetten.
  - `.env.zwartehand` — Alleen Zwartehand-token.
- **Data (op de NUC):**
  - `data/tasks/` — Taken (JSON per taak).
  - `data/notes/` — Notities (tekstbestanden).
  - `data/pending_approvals.json` — Openstaande toestemmingen (wie moet “ja” zeggen voor welk script).
  - `logs/` — o.a. `telegram_bridge.log`, `telegram_bridge_zwartehand.log`, `heartbeat.log`, `streamlit.log`, `engineer.log`.
- **Scripts (allemaal in `scripts/`):**
  - `launch_factory.sh` — Start Omega, heartbeat, dashboard, engineer.
  - `launch_zwartehand.sh` — Start Zwartehand.
  - `stop_holding.sh` — Stopt holding (voor systemd).
  - `fix_omega_conflict.sh` — Verwijdert webhooks, stopt alle bridges, wacht, start alleen Omega (bij Telegram Conflict).
  - `opruimen_verkeerde_sync.sh` — Verwijdert rommel van een verkeerde rsync (Library, Desktop, .cursor, enz.) uit `~/AI_HQ`.
  - `grote_controle_alles.sh` — Controleert of daemons, bestanden, token, dashboard OK zijn.
  - Overige: o.a. `check_zwartehand.sh`, `sync_naar_nuc.sh`, `telegram_webhook_uit.sh`, enz.

---

## 4. Wat we bewust zo hebben gedaan

- **Omega alleen op de NUC**  
  Zodat één proces met de Omega-token getUpdates doet en de NUC bestuurt. Omega **niet** op de laptop starten (anders Conflict).
- **Sync: altijd vanaf de laptop (Mac) naar de NUC**  
  Rsync moet je draaien vanuit de **AI_HQ-map op de laptop**, niet vanuit een SSH-sessie op de NUC. Doel: `./` = alleen AI_HQ, niet je hele home.
- **Twee bots**  
  Omega (`.env`) en Zwartehand (`.env.zwartehand`); verschillende tokens, kunnen allebei op de NUC.
- **Toestemming voor risicovolle acties**  
  Scripts die iets wijzigen (herstart, sync, enz.) gaan via `request_user_approval`; de gebruiker zegt “ja” in Telegram, daarna voert de bridge `get_and_execute_pending_approval` uit en draait het script.
- **Ontbrekende onderdelen toegevoegd**  
  `heartbeat.py`, `scripts/engineer_daemon.py`, `scripts/stop_holding.sh`, `dashboard.py` bestonden niet; die zijn toegevoegd zodat `launch_factory.sh` en systemd kloppen.
- **Opruimen verkeerde sync**  
  Er is een keer per ongeluk de hele Mac-home naar `~/AI_HQ` op de NUC gesynct. Daarvoor is `opruimen_verkeerde_sync.sh` gemaakt (verwijdert o.a. Library, Desktop, .cursor, Creative Cloud uit `~/AI_HQ`).

---

## 5. 24/7 en herstart

- **Zonder systemd:** `./launch_factory.sh` start processen met nohup/disown; ze blijven draaien na het sluiten van SSH. Na een **reboot van de NUC** moet je opnieuw `./launch_factory.sh` (en eventueel `./scripts/launch_zwartehand.sh`) draaien.
- **Met systemd (echte 24/7 na reboot):**  
  `omega-holding.service` (zie `scripts/omega-holding.service`) kopiëren naar `~/.config/systemd/user/`, daemon-reload, enable + start. Dan start de holding automatisch bij inloggen/reboot. Zwartehand kan apart gestart worden of later met een eigen service.

---

## 6. Documentatie die we hebben toegevoegd

- **`docs/WAT_TE_DOEN.md`** — Stappen om code naar de NUC te brengen (rsync vanaf laptop), in te loggen met SSH, rechten te zetten en Omega (en optioneel Zwartehand) te starten. Duidelijk gemaakt: rsync niet vanaf de NUC zelf draaien.
- **`docs/OMEGA_OP_NUC.md`** — Waarom Omega op de NUC hoort en hoe de aanbevolen setup eruitziet.
- **`docs/NALOOP.md`** — Grote naloop: wat ontbrak (heartbeat, engineer, stop_holding), wat we hebben opgelost, en vervolgstappen.
- **`docs/INSTALL_NUC.md`** — Bijgewerkt met heartbeat, engineer, dashboard, stop_holding.
- **`docs/CURSOR_TIPS.md`** — Tips voor het gebruik van Cursor in dit project (sneltoetsen, @, terminal, sync).
- **`docs/SAMENVATTING_NUC_SETUP.md`** — Dit bestand; samenvatting voor je AI.

---

## 7. Korte “waar / wat” voor een AI

- **Waar:** Alles hierboven speelt zich af in het project **AI_HQ**, op de **NUC** in `~/AI_HQ`. De **laptop (Mac)** is waar je in Cursor werkt en vanaf waar je rsync naar de NUC doet.
- **Wat:** Een Telegram-gestuurde “holding” op de NUC: twee bots (Omega + Zwartehand), AI (Gemini met tools), taken/notities/status/scripts, toestemming-flow, dashboard, heartbeat, engineer. Alles start via `launch_factory.sh` (+ eventueel `launch_zwartehand.sh`); stoppen kan met `scripts/stop_holding.sh` of de pkill-regel uit `launch_factory.sh`.
- **Problemen die we zijn tegengekomen:**  
  Telegram Conflict (twee Omega’s) → oplossing: Omega alleen op NUC, eventueel `fix_omega_conflict.sh`.  
  Verkeerde rsync (hele home in AI_HQ) → oplossing: alleen rsync vanuit AI_HQ-map, opruimen met `opruimen_verkeerde_sync.sh`.

Als je AI dit bestand leest, weet hij waar en wat we op de NUC hebben gebouwd en waarom.
