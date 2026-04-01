# Factory OS — overzicht (één startpunt)

Gebruik dit bestand om **niet dubbel te lezen** en **niet op twee plekken hetzelfde te onderhouden**.  
Dieper werk volgt altijd via de gelinkte doc; details staan **niet** dubbel hier.

---

## Wat is wat (volgorde)

| # | Document | Wanneer |
|---|----------|---------|
| 1 | **Dit bestand** (`FACTORY_OS_INDEX.md`) | Oriëntatie, “waar staat wat?” |
| 2 | [`FACTORY_OS_MVP_AFRONDEN.md`](FACTORY_OS_MVP_AFRONDEN.md) | **Standaard runbook:** `.env`, compose, test webhook, opruimen n8n |
| 3 | [`FACTORY_OS_KEYS_MVP_AFRONDEN.md`](FACTORY_OS_KEYS_MVP_AFRONDEN.md) | Extra uitleg + troubleshooting (URL’s, API, WebUI vs `.env`) |
| 4 | [`FACTORY_OS_TELEGRAM_DEBUG.md`](FACTORY_OS_TELEGRAM_DEBUG.md) | Alleen bij Telegram: getMe, sendMessage, webhook |
| 5 | [`FACTORY_OS_SPRINT_2.md`](FACTORY_OS_SPRINT_2.md) | **Dify na routing** — keys, import workflow, test |
| 6 | [`ONDERZOEK_GEEN_REACTIE.md`](ONDERZOEK_GEEN_REACTIE.md) | Bridge/logs/dubbele processen (na stap 4 nog stil?) |

**Niet dubbel:** MVP-runbook = kort pad. KEYS-doc = dieper + randgevallen. Telegram = los spoor (Omega-bot ≠ n8n tenzij je dat koppelt).

---

## Repo-structuur (Factory OS)

| Pad | Rol |
|-----|-----|
| [`docker-compose.yml`](../docker-compose.yml) | **Bron:** Open WebUI + **n8n**, env naar n8n (`OPTIMUS_API_KEY`, …). Start: `cd ~/AI_HQ && docker compose up -d` |
| [`docker-compose.singularity.yml`](../docker-compose.singularity.yml) | **Andere stack** (omega_core, dashboard, …) — **geen** n8n hier |
| [`evomap/docker-compose.yml`](../evomap/docker-compose.yml) | Evomap — los van Factory OS |
| [`factory-os/`](../factory-os/) | Klantdata, kennisbank, straks workflows — zie [`factory-os/README.md`](../factory-os/README.md) |
| `factory-os/systeem/n8n-workflows/` | **Export/import** van n8n JSON (dispatcher, ping, …) — onderhoud hier i.p.v. losse copies |
| [`scripts/factory_os_import_dispatcher_sprint2.sh`](../scripts/factory_os_import_dispatcher_sprint2.sh) | Import Sprint 2-dispatcher + oude MVP-dispatchers uit + `docker restart n8n` |
| [`factory-os/systeem/cherry-studio/`](../factory-os/systeem/cherry-studio/) | Cherry Studio op Mac: MCP (GitHub, Memory, Fetch) + NUC via Tailscale — zie **INSTALLATIE.md** |

---

## n8n (kort)

- **Webhook MVP:** `POST /webhook/factory-os` — body `{"prompt","klant"}`.
- **Workflow-naam:** `Factory OS | MVP Dispatcher` (CEO-routing via Optimus `/v1/chat/completions`).
- **Imports:** JSON uit `factory-os/systeem/n8n-workflows/` in n8n UI of `n8n import:workflow`.

---

## Omgevingsvariabelen (kort)

| Variabele | Waar |
|-----------|------|
| `OPTIMUS_API_KEY` of `OPENAI_API_KEY` | **`AI_HQ/.env`** — zelfde Bearer als Open WebUI → Optimus; **niet** in `.env.example` met echte waarde |
| `FACTORY_OS_OPTIMUS_MODEL` | Optioneel; default vaak `optimus-router` |
| `OPENAI_API_BASE` | Alleen als je compose-default URL wilt overschrijven |

Uitgebreide URL-tabellen: `docs/ENV_REFERENCE.md` (als aanwezig in je clone).

---

## Status (inhoudelijk)

- **Sprint 1 (routing):** Optimus CEO-json → `afdeling` / `complexiteit` — **klaar** als `curl` `status: ok` geeft (zonder Dify).
- **Sprint 2:** Zie [`FACTORY_OS_SPRINT_2.md`](FACTORY_OS_SPRINT_2.md) — **n8n → Dify API (app-key)** → Dify-agent → **Ollama lokaal** (Dify kent Ollama al; geen Ollama-key in n8n). `DIFY_RESEARCH_API_KEY` is de **Dify app**-key, niet Optimus/Ollama. **Let op:** WebUI kan wél Dify tonen terwijl de **n8n-webhook** nog Sprint 1 is — zie *Controle: Sprint 1 vs Sprint 2* in dat document.

---

## Sneltest

```bash
cd ~/AI_HQ
docker exec n8n sh -c 'eval "x=\$OPTIMUS_API_KEY"; echo "OPTIMUS lengte: ${#x}"'
curl -s -X POST http://127.0.0.1:5678/webhook/factory-os \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","klant":"fumero"}' | python3 -m json.tool
```

---

## Andere docs in deze repo

[`START_CHECKLIST.md`](START_CHECKLIST.md) (keten Dify/n8n/OpenClaw) linkt hierheen voor Factory OS — geen tweede waarheid; checklist blijft hoog-niveau.
