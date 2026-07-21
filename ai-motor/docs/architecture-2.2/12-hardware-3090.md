# 38. Hardware-update — NUC + RTX 3090: wat de GPU ontgrendelt

> Aanvulling op [Motor AI 2.2](README.md), [doc 10](10-marktscan-homelab-kansen.md) en [doc 11](11-azie-next-level.md). Datum: 2026-07-21.
> **Wijziging in uitgangspunten:** doc 10/11 gingen uit van "16 GB, geen GPU". De eigenaar heeft nu een **NUC + RTX 3090 (24 GB VRAM)**. De 3090 was in de marktscan al geïdentificeerd als de beste prijs/prestatie-keuze van de community — die staat er nu dus gewoon.
> **Aanname:** de 3090 zit in een aparte PC/workstation (een NUC kan geen full-size GPU hosten), bereikbaar via Tailscale — d.w.z. de bestaande "PC-bridge"-machine of vergelijkbaar. Als dat anders is: alleen de plaatsing wijzigt, niet de architectuur.

---

## 38.1 Architectuurpositie: de 3090-box is een inference-worker in de execution plane

Geen nieuwe plane, geen nieuwe waarheid. De GPU-box wordt:

- **Execution plane · "local inference worker"** (die rol stond al in §15) — hij serveert modellen, houdt geen state, en is via LiteLLM-routes bereikbaar zoals elke andere provider.
- **Production Core-kandidaat** → dus (§28-regels): eigenaar, runbook, monitoring (Beszel-agent), Tailscale-only, en een exit-strategie: **elke lokale route heeft een cloud-fallback in LiteLLM** — als de box uitvalt, schakelt de route om en wordt alleen de PII-policy strenger (wachtrij i.p.v. cloud, of EU-gehoste route).
- Toegang uitsluitend via **LiteLLM named routes** — applicatiecode weet niet dat iets lokaal draait (§24 blijft ongewijzigd).

## 38.2 Wat er op 24 GB VRAM draait (realistisch, medio 2026)

| Route (nieuw/gewijzigd) | Model-klasse op de 3090 | Gebruik |
|---|---|---|
| `local.chat` | Qwen3.5/Gemma 4-klasse 14–32B @ Q4 (~30–60 tok/s) | interne chat, draft-werk, R0/R1-taken |
| `local.extract` | idem + **grammar-constrained JSON** (llama.cpp/Ollama `format`) | bonnetjes-/factuurvelden, tagging, classificatie — batch |
| `local.vision` | Qwen-VL-klasse 7–8B (comfortabel) tot ~32B quantized (krap) | **vision-OCR van bonnetjes/facturen — PII blijft in huis** |
| `embed` | bge-m3 of Qwen3-Embedding-0.6B (GPU = re-index van de hele kennisbank in minuten i.p.v. uren) | Qdrant-ingest; wissel = re-index (bestaande regel) |
| `rerank` | Qwen3-Reranker-0.6B / bge-reranker-v2 | tussen Qdrant en LLM (A2 uit doc 11) |
| `transcribe` | Whisper large-v3 via Scriberr/WhisperX (GPU: ~10–30× sneller dan CPU) | vergader-/gesprekstranscriptie (O9 uit doc 10) |
| — (geen route) | MinerU GPU-backend | document-parsing (A1 doc 11) wordt ~10× sneller dan CPU-pipeline |

**Wat er níet op moet:** frontier-redeneerwerk (agent-orkestratie, complexe analyse, code op R2+-niveau) — dat blijft cloud (`chat.deep`, `code.strong`, `agent.orchestrate`). De onderzoeksconsensus is eenduidig: kleine lokale modellen falen als *orchestrator*, ook als ze subtaken prima doen. De 3090 is de werkbank, niet het brein.

## 38.3 Wat dit wijzigt in eerdere besluiten

| Eerder besluit | Wijziging |
|---|---|
| **PII-routingregel (doc 11, A3):** "PII alleen naar EU-gehoste open weights" | **Verbeterd: PII lokaal-eerst.** Bonnetjes, klantdata, personeelsdata → `local.*`-routes; EU-gehoste API's worden fallback; directe Chinese endpoints blijven alleen voor niet-persoonsgebonden bulk. Sterkste AVG-verhaal dat er bestaat ("data verlaat het pand niet") — en een verkoopargument voor de productfabriek |
| **K1 bonnetjes→Moneybird (doc 10):** vision via LiteLLM-cloud | Vision-extractie kan nu **volledig lokaal** (Qwen-VL-klasse). Cloud-vision blijft fallback bij lage confidence — meet beide in de Playbook-eval |
| **O5 embeddings-upgrade (doc 10):** "CPU-haalbaar" | GPU maakt de re-index triviaal → upgrade naar bge-m3/Qwen3-Embedding kan eerder (Golf 2 i.p.v. 3) |
| **O6 "NUC naar 32 GB RAM" (doc 10)** | **Vervalt als prioriteit** — de 3090 dekt de lokale-inference-behoefte ruimer dan een RAM-upgrade ooit zou doen. Alleen nog doen als de NUC zelf krap zit |
| **O9 Scriberr (doc 10, Incubation)** | Promoveert naar "adopt in Golf 3" — GPU haalt de frictie weg |
| **B3 LightRAG-trigger (doc 11)** | Extractiestap kan lokaal (`local.extract`) i.p.v. DeepSeek-API — indexeringskosten ≈ stroomkosten; drempel voor de proef wordt lager, ADR-107-trigger blijft gelden |
| **Masterplan Appendix B/C** | "Ollama embed-only op Hetzner" blijft, maar zware embed/vision/transcribe verhuist logisch naar de 3090-box; Hetzner-RAM-budget wordt ruimer |

## 38.4 Serving-keuze en ops

- **Start met Ollama (of kale llama.cpp `llama-server`) op de 3090-box** — 1 gebruiker/agent-verkeer, simpel beheer, past bij het team. **vLLM pas** wanneer batch-throughput aantoonbaar knelt (5+ gelijktijdige agent-runs); dat is een Watchlist-trigger, geen dag-1-keuze.
- **Ops-eisen (Production Core-checklist §28):** Tailscale-only (nooit publiek), Beszel-agent + Uptime Kuma-check op het endpoint, nvidia-driver/container-toolkit gepind, runbook (`docs/runbooks/inference-worker.md`): herstart, modelcache legen, route-failover testen.
- **Stroom/warmte:** een 3090 idlet op ~10–25 W maar trekt 300 W+ onder last. Voor batchwerk (nachtelijke ingest, transcriptie, dagbrief-voorbereiding) is dat prima; voor 24/7-idle is het acceptabel. Meet het mee in **kosten per succesvolle taak** (§35-criterium 7) — lokaal is niet gratis, het is een ander kostenmodel (stroom i.p.v. tokens).
- **Fysieke locatie = risico-item:** de box staat (aanname) thuis naast de NUC → zelfde single-site-risico als de NUC. Geen extra DR-eis: alle lokale routes hebben cloud-fallback, dus uitval = duurdere taken, geen stilstand. Vastleggen in §27-degraded-modes: "3090 down → local.* routes failover naar cloud/EU; PII-taken wachten of gaan via EU-route met notificatie".

## 38.5 Inpassing in de golven

- **Golf 1 (klein):** box in Tailscale, Ollama + named routes in LiteLLM-config, monitoring-agent, runbook-stub. Geen taken erop tot Gateway/policy staat.
- **Golf 2:** `embed`/`rerank` live (O5/A2), dagbrief-batchwerk 's nachts op de box, PII-lokaal-eerst-regel in de Gateway-policies.
- **Golf 3:** `local.vision` in de bonnetjespipeline (K1+A1: MinerU-GPU → vision-extractie → validatie → Moneybird), Scriberr-transcriptie.
- **Trigger-gebaseerd:** vLLM (bij concurrency-knelpunt), LightRAG-proef (ADR-107-trigger, nu goedkoper), groter lokaal model (alleen als een eval aantoont dat de 14–32B-klasse een concrete taak niet haalt).

**Netto:** de 3090 maakt de architectuur niet anders — hij maakt drie al-geplande dingen goedkoper en AVG-sterker (extractie, embeddings/rerank, transcriptie) en upgradet de PII-regel van "EU-cloud" naar "eigen pand eerst". Alles blijft achter LiteLLM en de Action Gateway; geen nieuwe waarheid, geen nieuwe plane.
