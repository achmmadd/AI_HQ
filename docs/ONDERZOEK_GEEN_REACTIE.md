# Onderzoek: waarom reageert de Telegram-bot niet?

## Uitgevoerde analyse (log + code)

### 1. **InvalidToken (placeholder)**  
In `logs/telegram_bridge.log` komt herhaald voor:
```text
telegram.error.InvalidToken: The token `123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` was rejected by the server.
```
- **Oorzaak:** In `.env` staat nog de placeholder-token in plaats van de echte bot-token.
- **Gevolg:** De bridge start, doet een `getMe` naar Telegram, krijgt "token rejected" en **crasht direct**. Er blijft geen proces draaien → geen reactie.
- **Fix:** Op de NUC (en overal): `nano ~/AI_HQ/.env` en vervang `TELEGRAM_BOT_TOKEN` door de echte token van @BotFather.

### 2. **ModuleNotFoundError: No module named 'holding.config'**  
In de log (bij een run met geldige token):
```text
File ".../factory_core/telegram_bridge.py", line 44, in cmd_start
ModuleNotFoundError: No module named 'holding.config'
```
- **Oorzaak:** De `/start`-handler (cmd_start) importeert `holding.config`; dat bestand bestond niet in de repo.
- **Gevolg:** De bridge draait wel (polling, getUpdates), maar bij elke `/start` (of andere actie die die code gebruikt) crasht de handler → **geen antwoord** naar de gebruiker.
- **Fix:** Er is nu `holding/config.py` (en `holding/__init__.py`) toegevoegd. Na sync naar de NUC moet dit probleem verdwijnen.

### 3. **Webhook**  
Als er een webhook op de bot staat, gaan alle updates naar die URL. Long polling op de NUC krijgt dan geen updates → geen reactie.
- **Fix:** `./scripts/telegram_webhook_uit.sh` en daarna `./launch_factory.sh`.

### 4. **Bridge op twee plekken (laptop + NUC)**  
Als dezelfde `TELEGRAM_BOT_TOKEN` op twee machines draait (bijv. laptop én NUC), krijgt maar één van de twee de updates van Telegram. De andere reageert nooit in de chat.
- **Fix:** Laat de bridge **alleen op de NUC** draaien voor je productie-bot. Op de laptop: `pkill -f telegram_bridge.py` of start daar geen `launch_factory.sh` voor Telegram.

### 5. **Welk bridge-bestand?**  
`launch_factory.sh` start expliciet:
```bash
nohup python3 "$ROOT/telegram_bridge.py" ...
```
Dus `AI_HQ/telegram_bridge.py` (in de root). Als die op de NUC ontbreekt (niet meegesyncet), start de bridge niet of wordt een andere variant gebruikt. Zorg dat na sync **in de repo-root** `telegram_bridge.py` staat.

---

## Stappen op de NUC na dit onderzoek

1. **Sync (vanaf laptop):**  
   `cd ~/AI_HQ && ./scripts/sync_naar_nuc.sh`  
   Zodat o.a. `holding/config.py`, `holding/__init__.py` en eventueel `telegram_bridge.py` op de NUC staan.

2. **Token controleren:**  
   Op de NUC: `nano ~/AI_HQ/.env` → `TELEGRAM_BOT_TOKEN` moet de echte token zijn (geen `123456789:AAFxxx...`).

3. **Onderzoek-script draaien:**  
   `cd ~/AI_HQ && ./scripts/onderzoek_geen_reactie.sh`  
   Volg de aanbevolen acties in de uitvoer.

4. **Webhook verwijderen (als aangegeven):**  
   `./scripts/telegram_webhook_uit.sh`

5. **Bridge herstarten:**  
   `./launch_factory.sh`

6. **Testen:** In Telegram `/start` sturen. Als het nog misgaat: bridge in voorgrond draaien om de fout te zien:  
   `python3 telegram_bridge.py`

---

## Scripts

| Script | Doel |
|--------|------|
| `scripts/onderzoek_geen_reactie.sh` | Grondige check: token, holding.config, proces, log, webhook |
| `scripts/debug_daemons.sh` | Log-tail + webhook-check + korte tips |
| `scripts/telegram_webhook_uit.sh` | Webhook verwijderen |
| `scripts/check_telegram_token_env.sh` | Controleren/zetten van TELEGRAM_BOT_TOKEN in .env |
