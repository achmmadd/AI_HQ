# NUC opschonen + Motor AI inspiratie uit Omega

## 1. Richting: Dify naar DE-server

- Zet de **volledige Dify Docker-stack** op de machine met meer RAM (Duitsland).
- Op de **NUC** houd je o.a. **n8n + Qdrant** (als je lokaal wilt) en **Motor (PM2)**.
- In **n8n / `.env`**: wijs API-base naar DE, bv. `FACTORY_OS_DIFY_API_BASE` / `DIFY_BASE_URL` = `https://dify.jouwdomein.nl` (geen trailing slash), **niet** `http://docker-api-1:5001`.
- Zorg dat **firewall/Tailscale** n8n → Dify mag; test: `curl -s -o /dev/null -w '%{http_code}\n' https://…/console/api/setup` of health-endpoint.

**Pas daarna** op de NUC de oude Dify-containers stoppen (zie onder), anders breekt Factory tot de URL’s kloppen.

---

## 2. Nu uitzetten: Open WebUI + omega-* (copy-paste NUC)

Controleer eerst welke tunnel je voor **motorsai.app** gebruikt. Als **alleen** `omega-cloudflared` naar het publiek wijst, eerst **Motor-tunnel** (of Cloudflare op DE) actief hebben, dan pas cloudflared stoppen.

### Open WebUI (parallel chat-laag)

```bash
docker stop open-webui
# blijft uit na reboot tenzij compose hem weer start:
# in het compose-bestand dat open-webui start: profile verwijderen of service uit commenten, dan:
# docker compose -f <jouw-compose.yml> up -d
```

### Omega-keten (container-namen uit jouw `docker stats`)

```bash
docker stop \
  omega-optimus-api \
  omega-optimus-dashboard \
  omega-agent-workers \
  omega-engineer \
  omega-telegram-bridge \
  omega-mission-control \
  omega-resource-warden \
  omega-heartbeat \
  omega-tunnel-watcher \
  omega-cloudflared
```

**Let op**

- **Telegram:** als Factory / n8n nog **geen** vervanger is voor `omega-telegram-bridge`, krijg je geen Telegram meer tot je webhook naar n8n/Motor zet.
- **Tunnel:** `omega-cloudflared` uit → alleen OK als **motorsai** (of andere publieke ingress) al via een andere tunnel/host draait.

Permanent uitzetten: pas het **docker compose**-bestand aan dat deze services start (of gebruik `docker update --restart=no` + `docker rm` na stop), anders komen ze terug na `up -d`.

---

## 3. Wat Omega slim deed → wat Motor / Factory kan overnemen

| Omega-patroon | Wat het oplost | Inspiratie voor Motor AI / Factory |
|---------------|----------------|-------------------------------------|
| **Telegram-bridge** | Één duidelijke ingress (bot → holding) | Één pad: Telegram → **n8n webhook** of **Motor API-route**; geen tweede bridge op laptop+NUC (zie `docs/ONDERZOEK_GEEN_REACTIE.md`). Documenteer welke bot waarheen wijst. |
| **Mission Control (dashboard)** | Zicht op “draait het?” | Motor: uitbreiden **admin/health** (n8n bereikbaar, Dify URL OK, PM2, laatste error) of klein **intern** dashboard; niet per se Streamlit — kan `/api/health` + JSON + optioneel pagina onder `/admin`. |
| **Heartbeat** | “Ik leef” + eenvoudige SLA | **Cron** of systemd timer: `curl` Motor `/api/health` + optioneel `POST /webhook/factory-os-ping`; bij fail → Telegram (bestaande `sendTelegramMessage`-patroon). |
| **Resource warden** | RAM/CPU grenzen voor workers | Op NUC: **PM2** `max_memory_restart`, Playwright/inventory **niet parallel** stormen; op DE: Docker **memory limits** voor Dify worker; alerts op host-niveau blijven nuttig. |
| **Engineer daemon** | Basis self-heal | `pm2 restart ai-motor` in runbook; optioneel script bij **exit code ≠ 0** na deploy; geen volledige engineer nodig als stack simpeler wordt. |
| **Cloudflared + tunnel watcher** | Tunnel blijft leven | **Eén** tunnel-strategie documenteren (NUC vs DE); watcher-idee: periodiek check `https://motorsai.app/api/health`. |
| **Agent workers (OpenClaw)** | Zware taken uit de request-thread | Factory: **n8n** als queue; lange jobs **async** + Telegram “klaar”; Motor blijft dun (zoals nu chat → n8n). |
| **Compose profiles** | Alleen wat je nodig hebt | Aparte compose of profile **factory-only** (n8n, qdrant, motor-build stack) vs **legacy-omega** — voorkomt per ongeluk alles tegelijk `up`. |

---

## 4. Korte prioriteit

1. Dify-URL in n8n/Motor naar **DE**; rooktest `webhook/factory-os`.
2. **Open WebUI** uit (scheelt parallel laag + verwarring).
3. **Omega-*** uit volgens bovenstaande, **na** tunnel + Telegram-plan.
4. In Motor: **`GET /api/health`** — nu met **`dependencies.n8n`** (host + `/healthz`) en **`dependencies.dify`** (host + `/console/api/setup`, 401 telt ook als “draait”). Geen secrets in de JSON. Bij problemen: HTTP **503** + `ok: false`. Gebruik voor cron/Telegram: `curl -sf https://motorsai.app/api/health | jq .ok`.

---

*Gebaseerd op `PROJECT_INDEX.md`, `docs/INFRASTRUCTUUR.md` en jouw NUC `docker stats`.*
