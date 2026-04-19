# Telegram Bridge op de NUC — één instantie

De Omega-bot mag maar **één keer** met dezelfde token pollen (getUpdates). Anders: **409 Conflict**.

## Oorzaken van dubbele instantie

1. **Docker + handmatig** — Als `docker compose up -d` draait, start de container `omega-telegram-bridge`. Als je daarnaast in een terminal `nohup python3 telegram_bridge.py &` doet, draaien er twee.
2. **Twee terminals op de NUC** — In beide `start_on_nuc.sh` of `nohup python3 telegram_bridge.py &` gedraaid.
3. **Root-proces** — Ooit `sudo python3 telegram_bridge.py` of Docker (container = root) gestart; daarna handmatig als pietje. Beide draaien.

## Kies één manier

| Manier | Gebruik |
|--------|--------|
| **Alleen handmatig** | Geen Docker voor de bridge. In één NUC-terminal: `bash scripts/start_on_nuc.sh` of de nohup-regel. |
| **Alleen Docker** | `docker compose up -d` — dan draait de bridge in de container. Start geen bridge handmatig. |

## Diagnose

```bash
cd ~/AI_HQ && bash scripts/diagnose_bridge_conflict.sh
```

Toont: Docker-container, systemd-service, alle PIDs met eigenaar (root = vaak Docker of sudo).

## Alles stoppen, daarna één keer starten

```bash
cd ~/AI_HQ && bash scripts/stop_all_bridge.sh
# Wacht tot je "Alle bridge-processen gestopt" ziet, dan:
source venv/bin/activate && nohup python3 telegram_bridge.py >> logs/telegram_bridge.log 2>&1 &
```

## Regels

- **Één terminal voor de bridge** — Alleen in die terminal start/stop je de bridge.
- **Geen sudo** — Start met `python3 telegram_bridge.py`, niet `sudo python3 ...`.
- **Docker OF handmatig** — Niet allebei tegelijk.
