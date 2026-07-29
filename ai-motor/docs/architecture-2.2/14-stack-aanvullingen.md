# 40. Stack-aanvullingen — de resterende gaten

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Aanvulling op [Motor AI 2.2](README.md), doc 10–13. Dit is referentie; AM-1 bevriest de genoemde uitbreidingen.
> Vraag: "wat nog meer voor mijn AI-stack?" — antwoord: de meeste lagen zijn gedekt; dit zijn de resterende échte gaten, plus wat bewust níet wordt toegevoegd. Zelfde discipline: adoptieladder, lifecycle-status, golf-plaatsing, 16 GB-/VRAM-budget.

---

## 40.1 Creatieve laag voor Fumero (grootste onbenoemde gat)

Fumero is een design-/contentbedrijf en de 3090 is toevallig óók de community-standaard voor lokale beeldgeneratie — dit gat is met bestaande spullen te dichten:

| # | Toevoeging | Detail | Status/golf |
|---|---|---|---|
| C1 | **ComfyUI + open-weight beeldmodellen** | Mogelijke Fumero-omzetondersteuning | **Bevroren AM-1**; week 5–7 is alleen vroegste venster als #1 dan 30 dagen groen is |
| C2 | **Beeld-Playbooks met human review** | Nooit auto-publish | Bevroren met C1 |
| C3 | **Upscaling/achtergrond-verwijdering** | Standaardworkflows | Bevroren met C1 |
| — | Video-generatie lokaal | **Watchlist** — kán inmiddels op 24 GB (korte clips), maar workflow-volwassenheid en tijdsinvestering rechtvaardigen het nog niet; herbeoordelen bij concrete Fumero-vraag | Watchlist |

**Waarom dit telt:** dit is de eerste plek waar de 3090 direct geld verdient voor een tenant (assets die anders ingekocht/geabonneerd worden), niet alleen kosten bespaart.

## 40.2 E-mail en agenda als agent-kanalen (tweede gat)

De docs dekken Telegram en de web-UI, maar e-mail — waar het meeste MKB-werk binnenkomt — ontbreekt:

| # | Toevoeging | Detail | Status/golf |
|---|---|---|---|
| E1 | **Inbox-triage-Playbook** | Kan later K1 hergebruiken | **Bevroren AM-1** |
| E2 | **E-mail-in als taak-intake** | Toekomstige emitter naar Kernel | **Bevroren AM-1** |
| E3 | **Agenda-koppeling** | Toekomstige input voor UI | **Bevroren AM-1** |

Alles read-first: eerst maanden alleen lezen/triage/drafts, verzenden blijft achter approval tot de §35-cijfers promotie rechtvaardigen.

## 40.3 CRM-laag: in Postgres, geen product erbij

CRM-tabellen (`customers`, `interactions`, `consents`) zijn **bevroren door AM-1**. Een `consents`-tabel vervangt geen grondslag of DPIA; Art. 9-data blijft uitgesloten.

## 40.4 GPU-ops (nodig zodra C1 náást inference draait)

- **Meetbaarheid:** Beszel-agent op de PC → monitoring-hub op Hetzner; GPU-benutting is observatie.
- **Queue-beleid:** de engine op Hetzner gebruikt resource-leases per GPU-slot. ComfyUI/MinerU zijn bevroren; geen custom scheduler.
- **Model-cachebeleid:** Ollama `keep_alive` bewust instellen; de wissel tussen LLM-weights en beeldmodel-weights kost 10–30 s — inplannen, niet wegoptimaliseren.

## 40.5 Spraak-uit (klein, leuk, goedkoop)

TTS is **bevroren door AM-1**. Als het later ontdooit, staat audio in Motor UI; Telegram bevat alleen een link.

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
| Hardware/topologie | doc 12–13 + ADR-108 | Besloten; SSH/hardwaredetails open |
| Netwerk/toegang | doc 10 (Tailscale, Pangolin-optie) | ✅ |
| Data (PG/Qdrant/objectstore/secrets) | doc 05 §16, doc 10 O2 | ✅ |
| Workflow-engine + Kernel | ADR-101/104/108 | bevestigingsspike open |
| Policy/Gateway/autonomie | doc 05 §22, ADR-109 | besloten, nog niet gebouwd |
| Modelrouting + kostenroutes | doc 05 §24 | exact acht routes; local=tier |
| Kennis/RAG/ingest | doc 05 §20 | MinerU/reranker bevroren |
| Evals/observability | doc 06, doc 11 B1, §39 U3 | ✅ |
| Backup/DR/monitoring | doc 06 §27, doc 10 O1–O4, §39 U5–U6 | RPO 24u tenzij WAL apart besloten |
| Business-use-cases | doc 10 K1–K5, doc 11 | ✅ |
| **Creatief (beeld)** | **dit doc C1–C3** | **bevroren** |
| **E-mail/agenda-kanaal** | **dit doc E1–E3** | **bevroren** |
| **CRM-datalaag** | **dit doc 40.3** | **bevroren** |
| Spraak (STT/TTS) | doc 10 O9 + dit doc 40.5 | TTS bevroren |
| Productization/billing | doc 10 §36.4, doc 11 B2/Z4 | eerst één betalende pilot zonder SLA |

De referentielijst is conceptueel compleet, maar geeft geen bouwtoestemming. Geen doc 16+, nieuwe promptversie of kwartaaluitbreiding vóór drie Playbooks productie draaien; nieuwe inzichten worden een kort delta-memo in doc 15.
