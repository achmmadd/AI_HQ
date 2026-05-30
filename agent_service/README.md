# Agent MVP service (Browser-Use + Browserbase)

## Setup

```bash
cd AI_HQ/agent_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Kopieer env (zelfde keys als `ai-motor/.env.local` voor Browserbase):

- `export BROWSERBASE_API_KEY=...`
- optioneel `export BROWSERBASE_PROJECT_ID=...` (alleen geldige UUID uit Browserbase-dashboard)
- `export OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `export OLLAMA_MODEL=<model dat op Ollama draait>` — bij weinig RAM liever **`qwen3:4b`** dan grote Llama-varianten.

## n8n (Agent MVP workflow)

Import `n8n-workflows/agent-mvp.json` — webhook-pad **`/webhook/agent-mvp`**.

- Zet **`AGENT_SERVICE_URL`** op de machine waar n8n draait naar de Python-service, bv. `http://127.0.0.1:8787` of bij Docker-desktop vaak **`http://host.docker.internal:8787`** (geen slash aan het einde).
- Bij `browser_task: true` wordt `POST …/agent/run` aangeroepen met `prompt`, `klant`, `agent_mode`. Bij `browser_task: false` wordt naar de **Factory-webhook** doorgestuurd (`N8N_FACTORY_OS_WEBHOOK`, `N8N_FACTORY_WEBHOOK` of default `…/webhook/factory-os`).

Op de MotorsAI-server (`ai-motor`):

```
N8N_AGENT_WEBHOOK=http://127.0.0.1:5678/webhook/agent-mvp
```

(CORS naar de Motor dev-server kan via `CORS_ALLOW_ORIGINS` in `.env`; default bevat `:3000`, voeg bv. `:3040` toe als je daar draait.)

## Run

```bash
uvicorn main:app --host 127.0.0.1 --port 8787
```

## Tests & ready-check

**MotorsAI (unit-tests, geen npm `test`-script nodig als `package.json` read-only):**

```bash
cd AI_HQ/ai-motor
npx tsx --test lib/intent-detection.test.ts lib/error-payload.test.ts lib/fetch-json-client.test.ts
```

**Stack smoke (Docker `agent-use` + PM2 MotorsAI + snelle n8n Factory-tak):**

```bash
bash AI_HQ/agent_service/scripts/verify-mvp-ready.sh
```

Voor een **volledige Browserbase-run** via n8n: zelfde webhook met `browser_task: true` en een lange HTTP-timeout (**≥ 600s**).


## Smoke (direct naar Python-service)

```bash
curl -sS -X POST http://127.0.0.1:8787/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"ga naar google.com","klant":"fumero","agent_mode":true,"browser_task":true}'
```

Verwacht: `ok:true`, `session_id`, `debugger_fullscreen_url` (kan even duren eerste keer).
