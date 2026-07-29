# 37. Azië-scan — next level boven het starter kit (China/Japan/Korea, juli 2026)

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Aanvulling op [Motor AI 2.2](README.md) en [doc 10](10-marktscan-homelab-kansen.md). Onderzoek 2026-07-21; AM-1 bevriest MinerU, reranker en Chinese routes.

---

## 37.1 Hoofdconclusie: waar "next level" écht zit

Het starter-kit-niveau (n8n + Ollama + Qdrant + embed-en-zoek) is in het Chinese ecosysteem op **drie lagen** voorbijgestreefd — en op een vierde as (kosten) is het verschil een orde van grootte:

1. **Document-understanding als ingestielaag.** MinerU (~75k stars) en PaddleOCR/PP-StructureV3 (~86k stars) maken layout-bewust parsen (tabellen→HTML, formules→LaTeX, leesvolgorde, multi-kolom) de *standaard eerste stap* van een RAG-pipeline. Plat tekst-extraheren + fixed-size chunken — wat Motor AI nu doet — geldt daar als legacy. De meeste RAG-kwaliteitsfouten zijn ingestiefouten, geen embeddingfouten. (Korea bevestigt dit onafhankelijk: Upstage — Series C $126M — verdient zijn geld met exact deze parse-laag.)
2. **Eval-observability-loop als standaarduitrusting.** Coze Loop (ByteDance, Apache-2.0, self-hostable) sluit de cirkel die westerse starter kits missen: productie-traces → annoteer fouten → promoveer naar eval-dataset → regressietest bij elke prompt-/modelwijziging. Dit is precies de §25-releasegate-discipline uit de 2.2-synthese, maar dan als kant-en-klaar product.
3. **Multi-tenant gateway met billing.** New-API (~43k stars, actiefste China-relay) behandelt per-klant-keys, quota's en facturering als eersteklas features — relevant zodra Motor AI Playbooks aan derden gaat leveren (Golf 4).
4. **Modeleconomie.** Chinese open-weight frontier-modellen (DeepSeek V4, Kimi K2.5/2.6, GLM-5.x, MiniMax M3, Qwen3.5+) leveren near-frontier agentic prestaties tegen **10–40× lagere tokenkosten** (geverifieerd: DeepSeek V4 Flash $0,14/$0,28 per 1M vs Claude Opus-klasse $5/$25). Cache-hit-input zakt naar fracties van een cent.

**Even belangrijk — wat mythe is:** "China loopt voor" geldt op platform-/schaalniveau en kostenengineering, **niet** op self-hosted-SMB-niveau. Chinese kleine bedrijven *huren* platform-AI (Taobao's AI Dianxiaomi à ~€0,025/gesprek, DingTalk-assistenten); vrijwel niemand draait daar een eigen Postgres+Qdrant-stack. Motor AI's opzet is overal ongebruikelijk — het next level is **operationele volwassenheid, niet meer infrastructuur**.

## 37.2 Het "digital employee"-model (数字员工) — de organisatieles

De kern-innovatie is organisatorisch, niet technisch: AI-workers krijgen **functieomschrijvingen, KPI's, escalatieregels en outcome-pricing** — exact het Playbook+approval-ontwerp van de 2.2-synthese, maar dan gedisciplineerd doorgevoerd (Ping An claimt 80% CS-volume door AI, resolutie 38%→92% — leveranciersclaim, richtinggevend).

Direct kopieerbaar voor Motor AI (versterkt bestaande §21/§22/§35, geen nieuwe architectuur):

| # | Patroon | Inpassing |
|---|---|---|
| Z1 | **Functieomschrijving per Playbook**: rol, eigenaar, KPI, escalatiegrens | Vanaf K2 reviews, Playbook #1 in week 1–2 |
| Z2 | **KPI's per Playbook**: task-success, correcties en kosten/taak; escalatieratio is observatie | Actieve criteria #1, #2, #7; #3 en #16 gelden platformbreed |
| Z3 | **Escalatie-mét-context in Motor UI**; Telegram bevat alleen notificatie+deeplink | Approval-emitter-adapter (§11), AM-4 |
| Z4 | **Outcome-pricing als hypothese** | Pas na één betalende hands-on pilot zonder SLA |
| Z5 | **"Sell"- vs "operate"-agents scheiden** (Alibaba's Dianxiaomi/Qianniu-split): klantgericht conversatie-agent ≠ back-office-ops-agent; verschillende risicoklassen en approval-strengheid | Risicoklassen §22 — expliciet maken per agent-type |

## 37.3 Kansen — geprioriteerd (adoptieladder + lifecycle-status)

### Tier 1 — Adopt/Configure

| # | Kans | Wat het toevoegt | Bewijs | Footprint | Status/golf |
|---|---|---|---|---|---|
| A1 | **MinerU als ingestie-sidecar** | Layout-bewust parsen | E4 | ~1–2 GB batch | **Bevroren AM-1**; K1 v1 werkt zonder MinerU |
| A2 | **Reranker-stap** tussen Qdrant en LLM | Pipeline-service, geen LiteLLM-route | E4 | <1 GB | **Bevroren AM-1** |
| A3 | **Goedkope/Chinese providers** | Geen nieuwe routenamen; alleen provider-tier binnen de acht routes | E1 | config | **Chinese routes bevroren AM-1** |
| A4 | **KV-cache + batch-kostenengineering** | Alleen ingest-batch is vóór ontdooiing toegestaan | E1/E3 | — | Vanaf K1/K2 waar aantoonbaar |
| A5 | **Z1–Z3 hierboven** | Operationele discipline, nul infra | E2/E3 | — | Vanaf K2 #1 |

### Tier 2 — Configure/Watchlist (voorwaardelijk)

| # | Kans | Voorwaarde |
|---|---|---|
| B1 | **Coze Loop** (eval-observability-loop) | Het patroon is verplicht (§25); het product kost ~3–4 GB (ClickHouse+MySQL+Redis). Besluit: **patroon implementeren in Langfuse** (lichter, al Production Core); Coze Loop = Watchlist als Langfuse-evals tekortschieten |
| B2 | **New-API** (multi-tenant billing-gateway) | Watchlist; eerst één betalende pilotklant zonder SLA, daarna pas billingproduct |
| B3 | **LightRAG** (graph+vector op bestaande PG/Qdrant) | **Blijft Watchlist onder ADR-107** — maar de trigger is nu concreet: zodra een taak aantoonbaar faalt op multi-hop-vragen over tenantkennis ("welke leverancier leverde X in periode Y onder contract Z"), is LightRAG de eerste kandidaat (draait op bestaande stores, MIT, EMNLP 2025, extractie via goedkope route A3) |
| B4 | **DeerFlow 2.0** als "super agent harness"-referentie (~77k stars, MIT, rewrite feb 2026) | Watchlist; herbeoordelen Q4 2026. Patronen (skills, sandbox, subagent-spawning) zijn al geadopteerd via §17–19; het product is 4 maanden oud |
| B5 | **gVisor-sandboxing voor tool-executie** | Patroon bewaard; sandbox-vloot bevroren door AM-1 |
| B6 | **LobeChat** als multi-user chat-frontend | Alleen als interne power-user-console; overlapt met eigen Motor-chat (zelfde afweging als Open WebUI, doc 10 D6) |
| B7 | **NL/EU-subsidiecheck** (Japanse les: SMB-adoptie is subsidie-getrokken, tot 4/5 vergoed) | Eenmalige actie: RVO-/EU-digitaliseringsvouchers checken voor Bokas/Fumero-trajecten |
| B8 | **Karakuri-patroon**: grounded-answers-only + gegarandeerde-accuraatheid-SLA + human-escalatie | Ontwerpprincipe voor toekomstige klantgerichte bots (D2, doc 10); geen product-adoptie |

### Rejected / hype (met reden)

| Item | Reden |
|---|---|
| RAGFlow als platform | Best-in-class maar wil ≥16 GB + Elasticsearch/MySQL/Redis/MinIO voor zichzelf — verkeerde gewichtsklasse; heroverwegen bij een dedicated documentzware tenant |
| Higress / APISIX AI-gateway | K8s/enterprise-gewichtsklasse |
| FastGPT / MaxKB / QAnything | All-in-ones die dupliceren wat we met Dify juist decommissionen (ADR-105) |
| Grey-market messaging-bots (WeChatFerry/CowAgent-op-persoonlijk-account; analoog: onofficiële WhatsApp) | Massale account-bans gedocumenteerd 2025–26; bevestigt doc 10 D1: alleen officiële API's |
| Autonome klantgerichte persona's / "unmanned" AI-streams | Zelfs Chinese platforms verbieden/bestraffen dit (Douyin: 170k+ overtredende streams verwijderd); EU AI Act Art. 50 wijst dezelfde kant op |
| "AI employee"-platformlicenties kopen | Op deze schaal ís Motor AI het platform |
| Eino / Spring AI Alibaba | Verkeerde talen (Go/Java); wel leesvoer als ontwerpliteratuur |
| MetaGPT/OpenManus | Research-lineage, geen productie-infra |
| LiteLLM vervangen | Nee — maar wél: versies pinnen en admin-UI afschermen (PyPI-backdoor mrt 2026 + CVE-2026-42271 in CISA KEV) → toevoegen aan Golf 1-hardening |

## 37.4 Gateway-waarschuwing (geverifieerd, direct relevant voor A3)

De #1 failure-mode bij Chinese modellen achter gateways is **corrupte tool-call-/thinking-block-vertaling**, niet routing. Regel: vóór een route-switch altijd de échte agent (tools + streaming + thinking) door de gateway testen, nooit alleen een hello-world-completion. Dit wordt een vaste stap in de modelwissel-eval (§25, gate-regel 2).

## 37.5 Inpassing in de golven

- **Week 1–2:** Z1–Z3 op K2 review-automation (#1).
- **Week 2–4:** batch/cache alleen waar K1 v1 het nodig heeft; geen MinerU/reranker.
- **Week 6–9:** K1/K2 migreren; routeconfig blijft exact acht namen.
- **Na AM-1-gate:** A1/A2/A3/B5 pas heroverwegen tegen een concrete taak en payback.
- **Golf 4:** eerst één betalende pilot; B2/Z4 pas daarna.
- **Triggers (geen datum):** B3 (LightRAG) bij aangetoonde multi-hop-faal; B1 (Coze Loop) bij Langfuse-eval-tekort; B4 (DeerFlow) herbeoordeling Q4 2026.

**Netto-oordeel:** de operationele discipline Z1–Z3 is nu bruikbaar. MinerU, reranking en Chinese routes zijn waardevolle referenties maar blijven expliciet bevroren; ze vormen geen parallel bouwprogramma.
