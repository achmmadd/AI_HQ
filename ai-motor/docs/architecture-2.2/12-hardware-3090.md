# 38. Hardware-update — NUC + RTX 3090: wat de GPU ontgrendelt

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Aanvulling op [Motor AI 2.2](README.md), [doc 10](10-marktscan-homelab-kansen.md) en [doc 11](11-azie-next-level.md).
> **Wijziging in uitgangspunten:** doc 10/11 gingen uit van "16 GB, geen GPU". Definitieve topologie (bevestigd door eigenaar):
>
> - **NUC = informele orchestrator** — kanaal/UI-host: Motor Next.js, gehard OpenClaw, Telegram en executor-glue. Durable engine, Kernel en Gateway draaien op Hetzner (ADR-108).
> - **Nieuwe inference-PC (in aanbouw): Ryzen 7 + 32 GB RAM + RTX 3090 (24 GB VRAM)** — dedicated inference-worker in de execution plane, via Tailscale.
> - **Hetzner 16 GB** — data plane + zware services (Postgres, Qdrant, LiteLLM, n8n) conform masterplan.
>
> De 3090 was in de marktscan al geïdentificeerd als de beste prijs/prestatie-keuze van de community. De 32 GB systeem-RAM naast de 24 GB VRAM is belangrijker dan hij lijkt: MoE-modellen met CPU-offload (Gemma 4 26B-A4B-, Qwen3.6-35B-A3B-klasse) worden daarmee haalbaar naast de dense modellen die volledig in VRAM passen.

---

## 38.1 Architectuurpositie: de 3090-box is een inference-worker in de execution plane

Geen nieuwe plane, geen nieuwe waarheid. De GPU-box wordt:

- **Execution plane · "local inference worker"** (die rol stond al in §15) — hij serveert modellen, houdt geen state, en is via LiteLLM-routes bereikbaar zoals elke andere provider.
- **Incubation execution-worker** — eigenaar, minimale runbookstub, Beszel-agent en Tailscale-only. Geen taken vóór SSH én Gateway/policy. Een lokale provider-tier heeft alleen een cloud/EU-fallback als de dataklasse dat toestaat.
- Toegang uitsluitend via de acht **LiteLLM named routes**; `local` is een provider-tier, geen routeprefix.

## 38.2 Wat er op 24 GB VRAM draait (realistisch, medio 2026)

| Named route | Provider-tier | Model-klasse op 3090 | Gebruik/status |
|---|---|---|---|
| `chat.fast` | `local` | Qwen/Gemma 14–32B @ Q4 | interne R0/R1-chat |
| `extract` | `local` | Qwen-VL + constrained JSON | vision/OCR; activatie pas na Gateway/policy |
| `embed` | `local` | bge-m3/Qwen embedding | Qdrant-ingest; wissel = re-index |
| `judge` | `local` | compacte instructieklasse | observatie/evals, cloud voor kalibratie |
| — | service | reranker | **bevroren AM-1**, geen LiteLLM-route |
| — | service | Whisper/Scriberr | latere batchservice, geen LiteLLM-route |
| — | service | MinerU | **bevroren AM-1** |

Cloud-only blijven `chat.deep`, `code.strong`, `research.search` en `agent.orchestrate`. De 3090 is de werkbank, niet de durable orchestrator.

## 38.3 Wat dit wijzigt in eerdere besluiten

| Eerder besluit | Wijziging |
|---|---|
| **PII-routingregel (doc 11, A3)** | Persoonsgegevens gebruiken waar mogelijk tier `local` op `extract`/`chat.fast`/`judge`; `pii-strict` heeft geen cloud-fallback. Art. 9-data krijgt geen Playbook zonder DPIA/grondslag. Chinese routes blijven bevroren. |
| **K1 bonnetjes→Moneybird (doc 10)** | V1 draait week 2–4 met cloud-vision en handmatige approval; lokale `extract`-tier is een latere upgrade na Gateway/policy. |
| **O5 embeddings-upgrade (doc 10)** | Embeddingwissel blijft re-index; reranker blijft bevroren door AM-1. |
| **O6 "NUC naar 32 GB RAM" (doc 10)** | **Vervalt als prioriteit** — de 3090 dekt de lokale-inference-behoefte ruimer dan een RAM-upgrade ooit zou doen. Alleen nog doen als de NUC zelf krap zit |
| **O9 Scriberr (doc 10, Incubation)** | Blijft Incubation en krijgt geen voorrang op K1/K2. |
| **B3 LightRAG-trigger (doc 11)** | Een latere extractiestap kan route `extract` tier `local` gebruiken; ADR-107-trigger en AM-1-bevriezing blijven gelden |
| **Masterplan Appendix B/C** | "Ollama embed-only op Hetzner" blijft, maar zware embed/vision/transcribe verhuist logisch naar de 3090-box; Hetzner-RAM-budget wordt ruimer |

## 38.3b Bouw- en inrichtingsadvies voor de Ryzen 7 / 32 GB / 3090-PC

**Bouw (kort, alleen wat ertoe doet):**

- **Voeding:** ≥850 W met twee aparte PCIe-kabels (geen daisy-chain) — de 3090 piekt >350 W met transients daarboven. Dit is de #1 stabiliteitsfout bij 3090-builds.
- **Koeling/behuizing:** de 3090 dumpt ~350 W warmte; ruime airflow-case, en overweeg een undervolt/power-limit (~280 W kost ~5% prestaties, scheelt veel warmte/stroom — standaardpraktijk in de community voor 24/7-gebruik).
- **RAM:** 2×16 GB is prima; laat sloten vrij voor upgrade naar 64 GB — dat is de trigger voor grotere MoE-modellen (Qwen3-Coder-Next-klasse wil ~48 GB+), niet nu nodig.
- **Opslag:** 1–2 TB NVMe; modelbestanden zijn 10–40 GB per stuk en je wilt er meerdere cachen.
- **OS:** Ubuntu LTS headless met gepinde GPU-runtime. Geen desktop- of game-dual-use zodra de Incubation-worker productiewerk krijgt.

**Rolverdeling (definitief):**

| Machine | Plane | Draait | Draait níet |
|---|---|---|---|
| NUC (informele orchestrator) | Kanaal/UI | Motor Next.js, gehard OpenClaw, Telegram-emitters, executor/bridge-glue | engine, Kernel, Gateway, zware inference |
| Inference-PC (Ryzen 7/32 GB/3090) | Execution | na vrijgave: local provider-tiers, embed en toegestane batchservices | state, publieke endpoints, control-plane-taken |
| Hetzner 16 GB | Data + durable control | Postgres, engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter, monitoring-hub | frontier-inference |

Dify-decommissioning levert circa 4–6 GB en is de voornaamste RAM-winst. De inference-PC voorkomt verdere groei op Hetzner; het 16GB-knelpunt is daarmee niet “structureel opgelost”.

## 38.4 Serving-keuze en ops

- **Na vrijgave:** start met Ollama of `llama-server`; vLLM blijft Watchlist tot 5+ gelijktijdige runs aantoonbaar knellen.
- **Ops-eisen:** SSH/Tailscale-only, Beszel-agent op de PC, Uptime Kuma-hub op Hetzner, gepinde driver/runtime en een minimale inference-worker-runbook.
- **Stroom/warmte:** een 3090 idlet op ~10–25 W maar trekt 300 W+ onder last. Voor batchwerk (nachtelijke ingest, transcriptie, dagbrief-voorbereiding) is dat prima; voor 24/7-idle is het acceptabel. Meet het mee in **kosten per succesvolle taak** (§35-criterium 7) — lokaal is niet gratis, het is een ander kostenmodel (stroom i.p.v. tokens).
- **Fysieke locatie = open risico-item:** locatie is onbekend en wordt vóór ingebruikname vastgelegd. Bij uitval schakelen alleen toegestane tiers naar cloud/EU; `pii-strict` wacht.

## 38.5 Inpassing in de golven

- **Voor vrijgave:** hardware afbouwen; locatie, ≥850W-voeding, opslag en SSH bevestigen. Geen taken vóór Gateway/policy.
- **Golf 1:** Tailscale, monitoring-agent en runbookstub; LiteLLM-tiers voorbereiden zonder workload.
- **Na Playbook #1-gate:** alleen een gemeten workload activeren; MinerU/reranker blijven bevroren.
- **Later:** K1 kan van cloud-vision naar route `extract` tier `local`; dit is niet K1 v1.
- **Trigger-gebaseerd:** vLLM (bij concurrency-knelpunt), LightRAG-proef (ADR-107-trigger, nu goedkoper), groter lokaal model (alleen als een eval aantoont dat de 14–32B-klasse een concrete taak niet haalt).

**Netto:** de 3090-PC is een stateless lokale provider. Hij maakt later extractie/embeddings goedkoper, maar ontgrendelt geen bevroren scope en krijgt geen taak vóór SSH, runbook en Gateway/policy.
