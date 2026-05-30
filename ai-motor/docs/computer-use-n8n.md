# Computer Use (Agent mode) ↔ n8n

## Env op de Motor-server (`.env.local` / PM2)

| Variabele | Doel |
|-----------|------|
| `N8N_AGENT_WEBHOOK` | Optioneel. Volledige n8n-webhook voor **Agent mode** (alias: `N8N_AGENT_CHAT_WEBHOOK`, `MOTOR_AGENT_CHAT_WEBHOOK`). Heeft voorrang. |
| `COMPUTER_USE_URL` | Optioneel. Agent-chat webhook (`…/webhook/…`). **Geen** Browserbase-/OpenAPI-root (`…/v1`) — die wordt voor chat genegeerd. **Zonder** eigen URL gebruikt MotorsAI de **Factory-webhook** met `agent_mode:true` (standaard). |
| `COMPUTER_USE_VIEWER_URL` | iframe in het Agent-paneel (bv. tunnel naar VNC/stream). Heeft voorrang op publieke fallback. |
| `NEXT_PUBLIC_COMPUTER_USE_VIEWER_URL` | Zelfde als viewer maar zichtbaar in de browser-build; wordt overschreven door `COMPUTER_USE_VIEWER_URL` als die gezet is. |
| `COMPUTER_USE_SCREENSHOT_URL` | Endpoint dat een **`image/*`** antwoord teruggeeft (GET of POST via `METHOD`). `/api/agent/screenshot` proxiet naar de UI. |
| `COMPUTER_USE_SCREENSHOT_BEARER_TOKEN` | Optioneel: `Authorization` voor screenshot-API. |
| `COMPUTER_USE_SCREENSHOT_HEADERS_JSON` | Optioneel JSON object met header-naam → string, bv. `{"X-Api-Key":"..."}`. Overschrijft geen bearer tenzij zelf `Authorization` in JSON. |
| `COMPUTER_USE_SCREENSHOT_METHOD` | Zet op `POST` als je screenshot-url alleen POST accepteert. |
| `COMPUTER_USE_SCREENSHOT_POST_BODY` | Bij POST: ruwe body (bij `{}` automatisch `Content-Type: application/json`). |

Runtime-check: `GET /api/computer-use` (ingelogde sessie) — vlaggen welke onderdelen geconfigureerd zijn. Payload-hints staan daar ook in het veld `chatWebhookPayloadHint`.

## n8n Webhook-body (ongeveer zoals Factory)

Motor stuurt JSON met minimaal:

- `prompt`
- `klant`
- `afdeling`
- `agent_mode`: `true` wanneer de gebruiker Agent mode heeft aangezet
- `context`: laatste chat-fragmenten `{ role, content }[]`
- `intent`: `"action"` | `"question"` | `"build"`

Je workflow kan hierop splitsen en naar je browser-use stack (browserless, Playwright-service, Claude computer use API, enz.) proxien.

---

## Browserbase (managed cloud browsers)

Motor kan **live view** URL’s voor je ophalen zonder dat de API-key in de browser komt.

### Env

| Variabele | Doel |
|-----------|------|
| `BROWSERBASE_API_KEY` | API key uit [Browserbase Settings](https://www.browserbase.com/settings). Vereist voor `POST /api/agent/browserbase/live-view`. |
| `BROWSERBASE_PROJECT_ID` | Optioneel; default project als je **Nieuwe sessie** gebruikt. |

### API (ingelogde Motor-sessie)

**`POST /api/agent/browserbase/live-view`** met JSON:

1. `{ "sessionId": "<sess_...>" }` — haal live debug URL op voor bestaande sessie.
2. `{ "create": true }` — maak nieuwe sessie en haal daarna live debug URL op.

### Diagnose API-key (ingelogd)

**`GET /api/agent/browserbase/ping`** → `{ "ok": true }` als de key tegen Browserbase werkt.

### n8n-antwoord naar de chat

#### Streaming-live view (SSE)

Motor stuurt tijdens **`/api/chat/stream`** naast `delta`-chunks ook **`agent_live`** wanneer de n8n-JSON deze velden bevat:

| Veld | Doel |
|------|------|
| `debugger_fullscreen_url` | Browserbase Debugger-fullscreen voor het Agent-paneel (iframe wordt door de client gezet) |
| `session_id` | Optioneel sessie-ID in het paneel |

De Browser-use microservice onder `agent_service/` geeft precies deze sleutels; importeer daar `n8n-workflows/agent-mvp.json`, zet `N8N_AGENT_WEBHOOK` op `…/webhook/agent-mvp` en `AGENT_SERVICE_URL` op `http://127.0.0.1:8787` (of `host.docker.internal` vanuit Docker).

### n8n-antwoord naar de chat (klassiek)

Zorg dat je workflow-**response** een van deze bevat (string): `message`, `answer`, `text`, `output`, `response`, of OpenAI-chatvorm met `choices[0].message.content`.
