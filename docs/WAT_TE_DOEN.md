# Wat te doen — Omega op de NUC

**Je hoeft niet op de NUC zelf te zitten.** Alles kan vanaf de **terminal op je laptop** via SSH naar de NUC.

Zie ook: **Infrastructuur** → `docs/INFRASTRUCTUUR.md`. **Start-checklist** (alles compleet?) → `docs/START_CHECKLIST.md`.

---

## AI nu al gebruiken (lokaal of op NUC)

Om de AI direct via Telegram te gebruiken:

1. **.env** in `AI_HQ` moet bevatten:
   - **TELEGRAM_BOT_TOKEN** — van [@BotFather](https://t.me/BotFather) (Omega) of een tweede bot (Zwartehand).
   - **GOOGLE_API_KEY** — van [Google AI Studio](https://aistudio.google.com/) (gratis, aanbevolen). Of **OPENAI_API_KEY**, of lokaal **Ollama** draaien (`ollama run llama3.2:3b`).
2. **Starten:** in de map `AI_HQ`:
   - Omega: `./launch_factory.sh`
   - Alleen Zwartehand: `./scripts/launch_zwartehand.sh` (gebruikt `.env.zwartehand`).
3. **Telegram** openen → je bot zoeken → een bericht sturen. De AI antwoordt (vragen, taken, notities, status, enz.).

Je kunt dit **lokaal op je Mac** doen om te testen, of op de **NUC** (dan daar `./launch_factory.sh` na rsync). Let op: **Omega maar op één plek** (NUC of laptop); anders getUpdates-conflict.

---

## 1. Code naar de NUC brengen (vanaf laptop-terminal)

**Belangrijk:** Je moet in de **AI_HQ-map** staan (de map waar o.a. `launch_factory.sh` en `telegram_bridge.py` in zitten). Anders sync je je hele gebruikersmap (Chrome, Pictures, enz.) — dat is fout.

**Op een Mac** (Cursor-workspace staat vaak in je home of in een projectmap):
```bash
cd ~/AI_HQ
```
Of als AI_HQ ergens anders staat, bijvoorbeeld:
```bash
cd /Users/iliasshammachi/AI_HQ
```
Controleer: `ls` moet o.a. `launch_factory.sh` en `telegram_bridge.py` tonen.

**Daarna** rsync (rsync maakt zelf de SSH-verbinding; je hoeft niet eerst in te loggen):
```bash
rsync -avz --exclude venv --exclude __pycache__ --exclude .git --exclude "*.log" ./ pietje@192.168.178.43:~/AI_HQ/
```

(Vervang `192.168.178.43` door het IP of hostnaam van je NUC als dat anders is.)

- Eerste keer: typ `yes` als er om de host key wordt gevraagd.
- Daarna: wachtwoord van pietje op de NUC (tenzij je SSH-sleutels gebruikt).
- Je zou nu vooral bestanden als `telegram_bridge.py`, `ai_chat.py`, `scripts/`, `.env` moeten zien — **geen** regels met Pictures, Library, Chrome, enz.

---

## 2. Via SSH op de NUC inloggen (vanaf laptop-terminal)

```bash
ssh pietje@openclaw-nuc
```

(Of met IP: `ssh pietje@192.168.178.43`.)

Je bent nu “op de NUC”; alle volgende commando’s tot je weer `exit` doet, draaien op de NUC.

---

## 3. Op de NUC: .env en rechten (in die SSH-sessie)

- Zorg dat op de NUC `~/AI_HQ/.env` bestaat met **TELEGRAM_BOT_TOKEN** = Omega-token.  
  Meest eenvoudig: die `.env` staat al op de NUC na de rsync (als je `.env` niet in .gitignore had en meesyncet). Anders handmatig kopiëren of op de NUC aanmaken met dezelfde inhoud als op je laptop.
- Scripts uitvoerbaar maken:

```bash
chmod +x ~/AI_HQ/launch_factory.sh ~/AI_HQ/scripts/*.sh
```

---

## 4. Op de NUC: Omega starten (in die SSH-sessie)

```bash
cd ~/AI_HQ
./launch_factory.sh
```

Daarna draaien op de NUC: Omega-bridge, dashboard, heartbeat, engineer. Je kunt de SSH-sessie sluiten (`exit`); de processen blijven draaien (of gebruik stap 6 voor 24/7).

---

## 5. Op je laptop: Omega niet starten

- **Niet** op je laptop `./launch_factory.sh` doen voor Omega.
- Als Omega daar nog draait: op de laptop `pkill -f telegram_bridge.py`, zodat alleen op de NUC nog Omega draait.

---

## 6. (Optioneel) Zwartehand

- Als je Zwartehand ook op de NUC wilt: op de NUC ook `~/AI_HQ/.env.zwartehand` met de Zwartehand-token, daarna:  
  `./scripts/launch_zwartehand.sh`
- Als je Zwartehand op je laptop wilt: daar wel `.env.zwartehand` en `./scripts/launch_zwartehand.sh` gebruiken. Geen Omega op de laptop.

---

## 7. (Optioneel) 24/7 op de NUC

Zodat alles blijft draaien na het sluiten van SSH:

```bash
./scripts/start_24_7.sh systemd
```

(of zie `docs/24_7_RUN.md`)

---

## Samenvatting (alles vanaf laptop-terminal)

| Stap | Waar je typt | Actie |
|------|----------------|--------|
| 1    | Laptop        | `rsync ... pietje@openclaw-nuc:~/AI_HQ/` |
| 2    | Laptop        | `ssh pietje@openclaw-nuc` |
| 3    | NUC (via SSH) | `.env` controleren, `chmod +x ~/AI_HQ/launch_factory.sh ~/AI_HQ/scripts/*.sh` |
| 4    | NUC (via SSH) | `cd ~/AI_HQ && ./launch_factory.sh` → daarna mag je `exit` |
| 5    | Laptop        | Omega niet starten; eventueel `pkill -f telegram_bridge.py` |
| 6    | (opt.)        | Zwartehand op NUC of laptop |
| 7    | (opt.)        | Op NUC (via SSH): `./scripts/start_24_7.sh systemd` |

Je gebruikt alleen de **terminal op je laptop**; voor NUC-commando’s log je in met SSH. Daarna in Telegram met de **Omega**-bot praten; die voert op de NUC uit.
