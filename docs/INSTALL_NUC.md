# Bestanden op de NUC (als er iets ontbreekt)

Als op de NUC `launch_factory.sh` of scripts ontbreken (bijv. geen git remote of andere kopie), sync dan vanaf de plek waar je in Cursor werkt naar de NUC.

## Optie 1: rsync (vanaf je Cursor-machine)

```bash
# Op de machine waar Cursor/AI_HQ staat (niet op de NUC):
rsync -avz --exclude venv --exclude __pycache__ --exclude .git /pad/naar/AI_HQ/ pietje@openclaw-nuc:~/AI_HQ/
```

Daarna op de NUC: `chmod +x ~/AI_HQ/launch_factory.sh ~/AI_HQ/scripts/*.sh`

## Optie 2: Minimale set handmatig op de NUC

Zorg dat op de NUC in `~/AI_HQ/` ten minste bestaan:

- **launch_factory.sh** (in de root van AI_HQ)
- **.env** (met TELEGRAM_BOT_TOKEN) — `./scripts/create_env_if_missing.sh` en daarna token invullen
- **scripts/stop_bridge_and_restart.sh**
- **scripts/check_telegram_token_env.sh**
- **scripts/create_env_if_missing.sh**
- **telegram_bridge.py**, **dashboard.py** (Mission Control op poort 8501)
- **heartbeat.py**, **scripts/engineer_daemon.py** (daemons voor status/checks; start via launch_factory.sh)
- **scripts/stop_holding.sh** (nodig voor `systemctl --user stop omega-holding.service`)

Als alleen `launch_factory.sh` ontbreekt: die staat in de root van deze repo; kopieer die naar `~/AI_HQ/launch_factory.sh` op de NUC en doe `chmod +x ~/AI_HQ/launch_factory.sh`.

## Na sync

```bash
cd ~/AI_HQ
chmod +x launch_factory.sh scripts/*.sh
./scripts/create_env_if_missing.sh   # als .env nog ontbreekt
nano .env                            # TELEGRAM_BOT_TOKEN invullen
./scripts/stop_bridge_and_restart.sh
# of: systemctl --user start omega-holding.service
```
