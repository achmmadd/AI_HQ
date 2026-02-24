# Start-checklist — is alles compleet om te lanceren?

Controleer dit vóór `./launch_factory.sh` of `./scripts/launch_zwartehand.sh`.

---

## Verplicht voor Omega (launch_factory.sh)

| Check | Wat |
|-------|-----|
| **.env bestaat** | In map `AI_HQ`. Anders: `cp .env.example .env` of `./scripts/create_env_if_missing.sh`. |
| **TELEGRAM_BOT_TOKEN** | In `.env`, echte token van @BotFather (cijfers:AA...). Geen placeholder of "xxx". |
| **AI-backend** | Minimaal één van: **GOOGLE_API_KEY** (aanbevolen), **OPENAI_API_KEY**, of **Ollama** lokaal (`ollama run llama3.2:3b`). |
| **Python + venv** | `python3` beschikbaar. Optioneel: `python3 -m venv venv && source venv/bin/activate`. |
| **Dependencies** | `pip install -r requirements.txt` (python-telegram-bot, google-generativeai, streamlit, requests). |
| **Rechten** | `chmod +x launch_factory.sh scripts/*.sh` (vooral op NUC na rsync). |

Na start: **Telegram** openen → Omega-bot zoeken → bericht sturen.

---

## Verplicht voor Zwartehand (launch_zwartehand.sh)

| Check | Wat |
|-------|-----|
| **Omega al gestart** | Eerst `./launch_factory.sh`, daarna dit script (anders maar één bot). |
| **.env.zwartehand** | Bestand in `AI_HQ` met **TELEGRAM_BOT_TOKEN** = token van de Zwartehand-bot (andere bot dan Omega). |
| **Token geen placeholder** | Waarde moet lijken op `123456789:AAF...`; geen "PLACEHOLDER" of "xxx" in de waarde. |
| **AI voor Zwartehand** | De bridge laadt alleen `.env.zwartehand`. Voor AI-antwoorden: zet **GOOGLE_API_KEY** (of OPENAI_API_KEY) ook in `.env.zwartehand`, of gebruik Ollama (werkt voor alle processen op de machine). |

---

## Optioneel maar handig

- **Dashboard** (Streamlit): wordt door `launch_factory.sh` gestart; vereist `streamlit` in venv. Poort 8501.
- **Heartbeat / Engineer**: starten mee; geen extra config.
- **24/7 op NUC**: `./scripts/start_24_7.sh systemd` en eventueel `loginctl enable-linger $USER`.

---

## Snelle controle

```bash
cd ~/AI_HQ
# .env met token?
grep -q "TELEGRAM_BOT_TOKEN=.*[0-9].*:AA" .env 2>/dev/null && echo "  ✓ Omega-token aanwezig" || echo "  ⚠ Zet TELEGRAM_BOT_TOKEN in .env"
# AI-key?
[ -n "$(grep -E '^GOOGLE_API_KEY=.' .env 2>/dev/null | cut -d= -f2)" ] && echo "  ✓ GOOGLE_API_KEY gezet" || echo "  ⚠ Optioneel: GOOGLE_API_KEY in .env voor Gemini"
# Start
./launch_factory.sh
```

---

## Wat launch_factory.sh aanmaakt als het nog niet bestaat

- `logs/`
- `data/tasks/`, `data/notes/`
- `holding/marketing/`, `holding/marketing/data/`, `holding/app_studio/`, `holding/copy_center/`, `holding/finance/`, `holding/memory/`, `holding/swarm/`, `mcp/`

Alles daarvan wordt bij de eerste start aangemaakt; je hoeft geen mappen handmatig te maken.
