# 40. Stack-aanvullingen — de resterende gaten

> Aanvulling op [Motor AI 2.2](README.md), doc 10–13. Datum: 2026-07-22.
> Vraag: "wat nog meer voor mijn AI-stack?" — antwoord: de meeste lagen zijn gedekt; dit zijn de resterende échte gaten, plus wat bewust níet wordt toegevoegd. Zelfde discipline: adoptieladder, lifecycle-status, golf-plaatsing, 16 GB-/VRAM-budget.

---

## 40.1 Creatieve laag voor Fumero (grootste onbenoemde gat)

Fumero is een design-/contentbedrijf en de 3090 is toevallig óók de community-standaard voor lokale beeldgeneratie — dit gat is met bestaande spullen te dichten:

| # | Toevoeging | Detail | Status/golf |
|---|---|---|---|
| C1 | **ComfyUI + open-weight beeldmodellen (Flux-klasse, SDXL) op de 3090** | Design-drafts, moodboards, productvisuals, social-assets. 24 GB VRAM is ruim; draait naast Ollama (niet gelijktijdig onder vollast — GPU-queue, zie 40.4). Node-workflows zijn versioneerbaar → passen in het Playbook-model | E4/E5 (de-facto standaard) · Incubation, Golf 3 |
| C2 | **Beeld-Playbooks met verplichte human review** | AI-draft → mens kiest/bewerkt → publicatie. Nooit auto-publish van beeld (kwaliteit + AI Act-markering synthetische content, doc 10 §36.3) | Golf 3–4 |
| C3 | **Upscaling/achtergrond-verwijdering/batch-varianten** | Standaard ComfyUI-workflows; vervangt losse SaaS-abonnementen (Remove.bg-klasse) | met C1 |
| — | Video-generatie lokaal | **Watchlist** — kán inmiddels op 24 GB (korte clips), maar workflow-volwassenheid en tijdsinvestering rechtvaardigen het nog niet; herbeoordelen bij concrete Fumero-vraag | Watchlist |

**Waarom dit telt:** dit is de eerste plek waar de 3090 direct geld verdient voor een tenant (assets die anders ingekocht/geabonneerd worden), niet alleen kosten bespaart.

## 40.2 E-mail en agenda als agent-kanalen (tweede gat)

De docs dekken Telegram en de web-UI, maar e-mail — waar het meeste MKB-werk binnenkomt — ontbreekt:

| # | Toevoeging | Detail | Status/golf |
|---|---|---|---|
| E1 | **Inbox-triage-Playbook** | IMAP-koppeling per tenant-mailbox → classificatie (factuur → K1-pipeline; klantvraag → concept-antwoord; spam/ruis → digest). Draft-replies altijd via approval (R2: extern zichtbaar) | Configure · Golf 3 |
| E2 | **E-mail-in als taak-intake** | Doorsturen naar een Motor-adres = taak in de Kernel (Devin-patroon: Slack/Linear als intake — hier de NL-MKB-variant) | met E1 |
| E3 | **Agenda-koppeling (CalDAV/Google)** | Bezetting/afspraken als input voor de dagbrief en voor "wat wacht op mij"-overzichten | Configure · Golf 3 |

Alles read-first: eerst maanden alleen lezen/triage/drafts, verzenden blijft achter approval tot de §35-cijfers promotie rechtvaardigen.

## 40.3 CRM-laag: in Postgres, geen product erbij

De Azië-scan-les (privaat-domein-playbook, doc 11): **bezit de klantrelatie in je eigen datalaag, gebruik kanalen alleen als transport.** Concreet: `customers`, `interactions`, `consents` (AVG-grondslag!) als tenant-tabellen in de bestaande Postgres — gevuld door de bestaande adapters (reviews, reserveringen, e-mail, chat). Géén apart CRM-product (HubSpot-kloon self-hosten = tweede waarheid + onderhoudslast). Pas heroverwegen bij een tenant met een echt salesteam. **Status: Extend (klein), Golf 3–4.**

## 40.4 GPU-ops (nodig zodra C1 náást inference draait)

- **Meetbaarheid:** nvtop (interactief) + DCGM-exporter of Beszel-GPU-metrics → bestaande monitoring; GPU-benutting is al een §39.3-criterium.
- **Queue-beleid:** één GPU, meerdere workloads (Ollama, Whisper, ComfyUI, MinerU) → simpele prioriteitsregel via de engine: interactief (chat/extractie) gaat voor batch (beeld, video, nachtingest); batch-jobs zijn onderbreekbaar. Geen custom scheduler bouwen — de canonieke engine ís de queue (concurrency-limiet per resource).
- **Model-cachebeleid:** Ollama `keep_alive` bewust instellen; de wissel tussen LLM-weights en beeldmodel-weights kost 10–30 s — inplannen, niet wegoptimaliseren.

## 40.5 Spraak-uit (klein, leuk, goedkoop)

TTS lokaal (Piper- of Kokoro-klasse, CPU/GPU-licht): de **dagbrief als audiobericht** in Telegram naast tekst. Triviale toevoeging op bestaande stack; STT (Whisper) stond al gepland. **Configure, Golf 3 — nice-to-have, geen prioriteit.**

## 40.6 Bewust níet toevoegen (met reden)

| Item | Reden |
|---|---|
| LoRA-finetuning van chatmodellen op de 3090 | Strijdig met het model-agnostische principe (Manus: "the boat, not the pillar"); onderhoudslast per model-generatie. Uitzondering (Watchlist): stijl-LoRA's voor béeld (C1) — dat is asset-productie, geen model-lock-in |
| Tweede vector-DB / graph-store | ADR-107 blijft; LightRAG-trigger is al gedefinieerd |
| Apart CRM-/ERP-product | §40.3; tweede waarheid |
| Home Assistant-integratie | Geen businesscase voor Bokas/Fumero; hobby ≠ Production Core |
| Muziek-/song-generatie | Geen taak die erom vraagt |
| Kubernetes | Compose + 3 nodes blijft de juiste gewichtsklasse (doc 10) |
| Nóg een chat-UI (LobeChat/Open WebUI) | Al beoordeeld (doc 10 D6, doc 11 B6): alleen als interne console, en zelfs dan optioneel |

## 40.7 Volledigheidscheck: de stack in lagen (wat waar gedekt is)

| Laag | Gedekt in | Status |
|---|---|---|
| Hardware/topologie | doc 12–13 | ✅ compleet |
| Netwerk/toegang | doc 10 (Tailscale, Pangolin-optie) | ✅ |
| Data (PG/Qdrant/objectstore/secrets) | doc 05 §16, doc 10 O2 | ✅ |
| Workflow-engine + Kernel | ADR-101/104 | spike open |
| Policy/Gateway/autonomie | doc 05 §22, ADR-102 | ontwerp klaar |
| Modelrouting + kostenroutes | doc 05 §24, doc 11 A3, doc 12 | ✅ |
| Kennis/RAG/ingest | doc 05 §20, doc 11 A1–A2 | ✅ |
| Evals/observability | doc 06, doc 11 B1, §39 U3 | ✅ |
| Backup/DR/monitoring | doc 06 §27, doc 10 O1–O4, §39 U5–U6 | ✅ |
| Business-use-cases | doc 10 K1–K5, doc 11 | ✅ |
| **Creatief (beeld)** | **dit doc C1–C3** | **nieuw** |
| **E-mail/agenda-kanaal** | **dit doc E1–E3** | **nieuw** |
| **CRM-datalaag** | **dit doc 40.3** | **nieuw** |
| Spraak (STT/TTS) | doc 10 O9 + dit doc 40.5 | ✅ |
| Productization/billing | doc 10 §36.4, doc 11 B2/Z4 | Golf 4 |

Na dit document is de stack **in de breedte compleet gedekt**. Alles wat hierna nog komt hoort via de kwartaal-marktscan (PROMPT-2.4, FASE M) binnen te komen — niet als losse tool-impulsen.
