# Wat heb je nodig om het te laten werken

Eén overzicht: wat je **moet** hebben en wat **optioneel** is.

---

## 1. Omega draaien (Telegram + AI + Dashboard)

**Minimaal:**

| Nodig | Waar |
|-------|------|
| **.env** in map `AI_HQ` | `cp .env.example .env` en invullen |
| **TELEGRAM_BOT_TOKEN** | In `.env` — token van [@BotFather](https://t.me/BotFather) voor je Omega-bot |
| **GOOGLE_API_KEY** | In `.env` — van [Google AI Studio](https://aistudio.google.com/) (gratis), **of** OPENAI_API_KEY **of** Ollama lokaal |
| **Python 3** | `python3` beschikbaar op de machine |
| **Dependencies** | `pip install -r requirements.txt` (in venv: `source venv/bin/activate` eerst) |
| **Rechten** | `chmod +x launch_factory.sh scripts/*.sh` (vooral na rsync naar NUC) |

**Starten:** `cd ~/AI_HQ && ./launch_factory.sh`

Daarna: Telegram openen → Omega-bot → bericht sturen. Dashboard: http://localhost:8501

---

## 2. Omega in Docker (1Panel / Compose)

**Extra nodig:**

| Nodig | Waar |
|-------|------|
| **Docker + Docker Compose** | Geïnstalleerd op de host (1Panel regelt dit vaak) |
| **.env** | Zelfde als hierboven; moet in dezelfde map liggen als `docker-compose.yml` (1Panel mount of bij deploy meesturen) |

**Starten:** `docker compose build && docker compose up -d`  
Of in 1Panel: Container → Compose → Create → `docker-compose.yml` importeren.

Geen venv nodig; de image bevat Python en dependencies.

---

## 3. 1Panel API-bridge (Jarvis ↔ 1Panel)

**Alleen nodig als** je Omega/Jarvis met de 1Panel API wilt laten praten (metrics, containers, herstart):

| Nodig | Waar |
|-------|------|
| **1Panel draait** | Geïnstalleerd en bereikbaar (bijv. http://IP:port) |
| **API-key** | 1Panel → **Instellingen** → **Panel** → API-sleutel (bekijken/herstellen) |
| **URL van 1Panel** | Bijv. `http://192.168.178.43:1234` (eigen IP en poort) |

**Starten:** `./scripts/install_1panel_bridge.sh` — script vraagt URL en API-key, schrijft `.env.1panel`, test de verbinding.

Daarna: `python3 scripts/onepanel_api.py status` om te testen.

---

## 4. Log-alerts naar Telegram (container gecrasht, etc.)

**Alleen nodig als** je bij problemen een Telegram-bericht wilt:

| Nodig | Waar |
|-------|------|
| **TELEGRAM_CHAT_ID** | In `.env` — het chat-id waar de bot naartoe moet sturen (jouw privé-chat met de bot) |
| **TELEGRAM_BOT_TOKEN** | Staat al in `.env` voor Omega |

Hoe **TELEGRAM_CHAT_ID** vinden: stuur een bericht naar je bot, dan:  
`https://api.telegram.org/bot<JOUW_TOKEN>/getUpdates` — in de JSON staat `"chat":{"id": ...}`.

Daarna: `./scripts/onepanel_log_monitor.sh` handmatig of via cron/systemd.

---

## 5. Zwartehand (tweede bot)

| Nodig | Waar |
|-------|------|
| **Omega al gestart** | Eerst `./launch_factory.sh` |
| **.env.zwartehand** | Met **TELEGRAM_BOT_TOKEN** = token van een *andere* bot (Zwartehand) van @BotFather |
| **AI** | GOOGLE_API_KEY in `.env.zwartehand` of in hoofdsysteem (Ollama) |

**Starten:** `./scripts/launch_zwartehand.sh`

---

## Samenvatting: absoluut minimum

Om **alleen Omega + AI + dashboard** te laten werken:

1. **.env** met **TELEGRAM_BOT_TOKEN** en **GOOGLE_API_KEY** (of OpenAI/Ollama).  
2. **Python 3** + `pip install -r requirements.txt`.  
3. **`./launch_factory.sh`** in de map `AI_HQ`.

De rest (Docker, 1Panel API, log-alerts, Zwartehand) is optioneel en alleen nodig als je die onderdelen wilt gebruiken.

Zie ook: **Start-checklist** → `docs/START_CHECKLIST.md`, **1Panel** → `docs/1PANEL_INTEGRATIE.md`.
