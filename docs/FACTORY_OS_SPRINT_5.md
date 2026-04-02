# Factory OS — Sprint 5 · dag 5 — Leerloop + bibliothecaris (nacht) + Telegram + MVP-finale

**Doel:** het systeem **laten meegroeien**: wat je ’s nachts vult (bibliothecaris), **terugkoppelen** naar kwaliteit (prompts, URL-lijst, Dify-sync), **Telegram** na elke scrape-run, **per afdeling een eigen Dify-app-key** in de dispatcher, en **één vaste plek** voor “waar staan we nu?” — zonder tien losse notities.

**Volgorde:** na **Sprint 3** (kennisbank) en **Sprint 4** (Open WebUI + Cherry Studio). **Sprint 2** blijft de Dify-koppeling in n8n.

**Overzicht:** [`FACTORY_OS_INDEX.md`](FACTORY_OS_INDEX.md) · status-template: [`FACTORY_OS_WAAR_ZIJN_WIJ.md`](FACTORY_OS_WAAR_ZIJN_WIJ.md)

**Workflow-bestanden (repo):** `factory-os/systeem/n8n-workflows/` — `factory_os_dispatcher.json`, `factory_os_bibliothecaris.json`, **`factory_os_ping.json`** (nieuw).

---

## 1. Nachtelijk: bibliothecaris + Telegram

- **02:00** draait de n8n-workflow **Factory OS | Bibliothecaris (Fumero startset)** — Jina → `factory-os/klanten/fumero/kennisbank/`, daarna **HTTP Request** naar `api.telegram.org/.../sendMessage` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` uit `.env`).  
- Handmatig: `POST /webhook/factory-os-bibliothecaris` — zelfde keten; verwacht binnen ca. 30s een Telegram-bericht als de keys gezet zijn.  
- De Telegram-node heeft **continueOnFail**: zonder keys faalt de notify maar blijft de scrape wel gelogd.  
- Details URL-lijst en import: [**Sprint 3**](FACTORY_OS_SPRINT_3.md) § A.

**Telegram snel testen (host):**

```bash
cd ~/AI_HQ && source .env
grep -E "TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID" .env
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -m json.tool | grep -E "ok|username"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"✅ Factory OS Sprint 5\"}" \
  | python3 -m json.tool | grep "ok"
```

**Snel checken of er iets bij is gekomen:**

```bash
ls -lt ~/AI_HQ/factory-os/klanten/fumero/kennisbank/*.md 2>/dev/null | head -5
```

**Als je Dify RAG gebruikt:** sync periodiek (handmatig of cron 02:15), zie Sprint 3 § B.

---

## 2. Leerloop (kort en herhaalbaar)

Geen aparte tool verplicht — wél een **vaste cadans** (bv. wekelijks of na elke grotere wijziging):

| Stap | Vraag |
|------|--------|
| **Antwoorden** | Wat waren foute of dunne Factory OS-/Dify-antwoorden? Noteer 1 zin in `FACTORY_OS_WAAR_ZIJN_WIJ.md` onder *Lessen*. |
| **Kennisbank** | Mist er een URL in `_startset_urls.json`? Staat oude content in de markdown? |
| **Dify** | Moet de research-app **instructions** of **Context** (knowledge) bij? |
| **n8n** | Nog de juiste workflow actief? Geen dubbele webhook? |
| **Keys** | `.env` en `docker compose up -d` na key-wissel (zie clean sheet). |

Optioneel: bewaar 2–3 **voorbeeld-prompts** die je elke keer opnieuw curl’t (`webhook/factory-os`) om regressie te zien.

---

## 3. “Waar staan we?” — één bestand

Onderhoud **[`FACTORY_OS_WAAR_ZIJN_WIJ.md`](FACTORY_OS_WAAR_ZIJN_WIJ.md)** (levend document):

- Datum + **wat draait** (WebUI, n8n, Dify, Optimus).  
- **Sprints:** 2–5 in één regel per stuk (klaar / bezig / volgende).  
- **Volgende actie** (max. 3 bullets).

Zo blijft “waar zijn wij” uit je hoofd en uit losse chats.

---

## 4. Dispatcher: eigen Dify-key per afdeling

In **Factory OS | MVP Dispatcher** routeert de Switch naar vier HTTP-nodes:

| Tak | Env-variabele | Fallback |
|-----|----------------|----------|
| research | `DIFY_RESEARCH_API_KEY` | — |
| marketing | `DIFY_MARKETING_API_KEY` | `DIFY_RESEARCH_API_KEY` |
| fabriek | `DIFY_FABRIEK_API_KEY` | `DIFY_RESEARCH_API_KEY` |
| it | `DIFY_IT_API_KEY` | `DIFY_RESEARCH_API_KEY` |
| overige / default | `DIFY_RESEARCH_API_KEY` | — |

Keys uit Dify: **Apps → [app] → API Access → API key** (`app-...`). Zet in `~/AI_HQ/.env` en `docker compose up -d` / `docker restart n8n` als je keys wijzigt.

Optioneel **`DIFY_FUMERO_API_KEY`**: geen aparte switch-tak in deze MVP; gebruik desgewenst dezelfde key als research of een aparte app en wijs die toe via `DIFY_RESEARCH_API_KEY` voor Fumero-only omgevingen.

---

## 5. Import + ping-webhook (finale)

Eenmalig (of na wijzigingen aan de JSON):

```bash
~/AI_HQ/scripts/factory_os_import_sprint5_finale.sh
docker restart n8n
```

Dit importeert en zet actief: dispatcher, bibliothecaris, **Factory OS | Ping** (`GET /webhook/factory-os-ping` → JSON met `factory_os: true`).

---

## 6. Verify (Sprint 5)

**Licht (kennisbank + reminder):**

```bash
~/AI_HQ/scripts/factory_os_sprint5_verify.sh
```

**Finale curl-suite (MVP-check):**

```bash
~/AI_HQ/scripts/factory_os_finale_test.sh
```

---

## 7. Git (na groene tests)

```bash
cd ~/AI_HQ
git add -A
git commit -m "feat: Factory OS MVP Sprint 5 compleet — alle agents, Telegram, leerloop"
```

---

## Samenvatting (dag 5)

1. **Bibliothecaris** ’s nachts + **Telegram** na scrape; webhook handmatig testbaar.  
2. **Dispatcher** met **per afdeling** Dify-app-key (fallback naar research).  
3. **Ping**-workflow voor healthcheck.  
4. **Leerloop:** korte retro → kennisbank / Dify / prompts.  
5. **`FACTORY_OS_WAAR_ZIJN_WIJ.md`** bijwerken — single source voor team/jezelf-over-een-week.

### Na Sprint 5 (volgende sessie)

- Kennisbank vullen via chat met Optimus  
- Dify-modellen actualiseren  
- Cherry Studio agents verfijnen  
- LiteLLM + Langfuse (kosten)  
- Browser-agent voor webtaken
