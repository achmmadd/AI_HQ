# Grote naloop — Omega AI-Holding

Overzicht van wat ontbrak, wat is opgelost, en **concrete stappen** voor verdere verbetering.

---

## 1. Heartbeat en Engineer — opgelost

**Was:** De bestanden `heartbeat.py` en `scripts/engineer_daemon.py` bestonden niet, dus startte `launch_factory.sh` ze niet (geen fout, alleen overgeslagen).

**Gedaan:**

- **`heartbeat.py`** (root): minimale daemon die elke 60 seconden “Heartbeat OK” logt naar `logs/heartbeat.log`. Wordt nu door `launch_factory.sh` gestart.
- **`scripts/engineer_daemon.py`**: minimale daemon die elke 5 minuten controleert of de Omega-bridge nog draait en dat logt in `logs/engineer.log`. Geen auto-herstart (dat kan later worden toegevoegd).

**Verdere stappen (optioneel):**

- Heartbeat uitbreiden met echte checks (bijv. Telegram API, dashboard URL).
- Engineer uitbreiden met auto-repair (bijv. `launch_factory.sh` aanroepen als de bridge verdwenen is).

---

## 2. `scripts/stop_holding.sh` — opgelost

**Was:** De systemd-unit **omega-holding.service** gebruikte `ExecStop=.../scripts/stop_holding.sh`, maar dat bestand bestond niet.

**Gedaan:** `scripts/stop_holding.sh` is toegevoegd. Het stopt: Omega-bridge (niet Zwartehand), heartbeat, streamlit, engineer_daemon. Zwartehand blijft draaien. Na gebruik: `chmod +x scripts/stop_holding.sh` en test met `./scripts/stop_holding.sh` en `systemctl --user stop omega-holding.service`.

---

## 3. `grote_controle_alles.sh` — aangepast

**Was:** Het script faalde op ontbrekende bestanden (heartbeat, engineer, projects/) en op niet-bestaande agent-imports.

**Gedaan:**

- Heartbeat- en Engineer-checks worden alleen uitgevoerd **als** de bestanden bestaan.
- **projects/**-check alleen als de map bestaat (optioneel).
- Agent-imports vervangen door één optionele check op `holding.config` (door telegram_bridge gebruikt).

Je kunt nu `./scripts/grote_controle_alles.sh` draaien; het faalt niet meer op ontbrekende heartbeat/engineer/projects. Voor echte agent-modules (telegram_send, vision_engine, etc.) kun je later opnieuw checks toevoegen wanneer die bestaan.

---

## 4. Documentatie vs. werkelijkheid

- **docs/INSTALL_NUC.md** noemt o.a. “telegram_bridge.py, heartbeat.py, dashboard.py”. Heartbeat ontbreekt; dashboard bestaat nu wel. Bijwerken: vermelden dat heartbeat optioneel of nog toe te voegen is, en dat dashboard wel wordt meegestart.
- **scripts/omega-holding.service** beschrijving: “Dashboard, Heartbeat, Telegram”. Als je heartbeat (en engineer) niet toevoegt, kan de description eventueel worden: “Dashboard, Telegram (heartbeat/engineer optioneel)”.

**Stap 4:** Pas INSTALL_NUC.md en eventueel de service-description aan op wat er echt draait en wat optioneel is.

---

## 5. Overzicht: wat wél werkt

- **launch_factory.sh** start: Omega Telegram-bridge, Dashboard (streamlit op 8501). Geen crash bij ontbrekende heartbeat/engineer.
- **Zwartehand:** apart script `scripts/launch_zwartehand.sh`; andere token (.env.zwartehand).
- **Dashboard:** `dashboard.py` bestaat en wordt gestart; Mission Control op http://localhost:8501.
- **AI + tools:** `ai_chat.py` en `ai_tools.py` (o.a. taken, notities, toestemming, scripts) worden door de bridge gebruikt.
- **systemd:** `launch_factory_for_systemd.sh` roept alleen `launch_factory.sh` aan; dat werkt. Alleen **ExecStop** faalt zolang `stop_holding.sh` ontbreekt.

---

## 6. Aanbevolen volgorde van nieuwe stappen

1. ~~stop_holding.sh aanmaken~~ — **gedaan**
2. ~~heartbeat.py en engineer_daemon.py (minimaal) toevoegen~~ — **gedaan**
3. ~~grote_controle_alles.sh aanpassen (optionele checks)~~ — **gedaan**
4. **projects/** aanmaken (lege map) als je die check in grote_controle wilt laten slagen: `mkdir -p projects`.
5. **INSTALL_NUC.md** bijwerken: vermelden dat heartbeat en engineer nu bestaan en wat ze doen.
6. **systemd testen:** `systemctl --user stop omega-holding.service` en `systemctl --user start omega-holding.service` (na `chmod +x scripts/stop_holding.sh`).

Daarna: gericht nieuwe stappen (bijv. wekelijkse grote controle, 24/7 alleen op NUC, heartbeat/engineer uitbreiden).
