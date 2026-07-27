# 1–3. Executive oordeel · Maturityscore · Probleeminventarisatie

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2 — Reference-First Architecture Synthesis](README.md). Feitelijke voortgang staat in [00-HUIDIGE-STAAT](00-HUIDIGE-STAAT.md).

---

## 1. Executive oordeel

**Het huidige Motor AI-masterplan is een degelijk infrastructuur- en migratieplan, maar geen architectuur voor een AI-operating-system.** Het beantwoordt "waar draait wat, en hoe migreren we van SQLite naar Postgres" — het beantwoordt niet "hoe wordt een taak betrouwbaar, verifieerbaar, hervatbaar en herbruikbaar uitgevoerd door agents". Precies dat tweede is wat Codex, Devin, Manus, Anthropic en de open-source harnesses hebben opgelost, en hun oplossingen zijn publiek gedocumenteerd.

**Drie hoofdconclusies:**

1. **De techkeuzes in het masterplan overleven due diligence grotendeels.** Postgres+RLS, Drizzle, LiteLLM als enige model-gateway, Langfuse Cloud en Qdrant-multitenancy blijven staan. `lib/inngest/` is inmiddels een gedeeltelijk geïntegreerde pilot; ADR-101 laat Inngest via een productie-topologiespike bevestigen tegenover DBOS en kiest daarna exact één engine. n8n en Dify verliezen hun rol als orchestrator en worden gedegradeerd tot integratie-/UI-laag respectievelijk Decommissioning.

2. **Wat ontbreekt is niet technologie maar structuur.** Het plan heeft nog geen geïmplementeerde Motor Kernel, credential-broker Action Gateway of taskgebonden evidence-laag. Er leven aantoonbaar **minstens zes state-mechanismen naast elkaar**; welke daarvan productie draaien is nog live te meten. De oplossing blijft: bestaande patronen adopteren, maar in de minimale variant van AM-1 — maximaal acht Core-componenten en geen registry-product vóór de gate.

3. **Het grootste acute risico is security, niet functionaliteit.** OpenClaw — de primaire chat-agent — had in jan–feb 2026 een gedocumenteerde one-click-RCE (CVE-2026-25253, CVSS 8.8), 40.000+ publiek exposed instances en een supply-chain-campagne met malicious ClawHub-skills. De chat- en conversation-routefamilies zijn inmiddels uit `PUBLIC_PATHS`; live 401/403-bewijs ontbreekt nog. OpenClaw-hardening (ADR-106) en het AM-4-compliancepakket blijven daarom Golf 0/1-releasevoorwaarden.

**Eindoordeel:** doorbouwen op de bestaande stack is juist, maar alleen in de minimale variant. De uitvoeringscapaciteit is **1 technicus met 2–3 niet-technische helpers**, niet 3–4 technici; daarom lopen maximaal één architectuurdag per week en één waarde-Playbook tegelijk naast Golf 0.

---

## 2. Maturityscore van het huidige plan

Score per domein, 1–5 (1 = afwezig, 3 = gepland maar niet ontworpen, 5 = production-grade ontworpen én belegd). Referentie = wat de rolmodellen aantoonbaar hebben.

| Domein | Score | Onderbouwing |
|---|---|---|
| Infrastructuur & migratie (PG/RLS/Drizzle, NUC↔Hetzner) | **4/5** | Concreet, gefaseerd, met ADR's en cutover-datums. Mist alleen DR-test-discipline. |
| Multi-tenancy & dataisolatie | **3/5** | RLS gepland (goed), maar geen tenant-isolatie voor Qdrant-payload-filtering afgedwongen in code, geen isolation-evals, geen tenant-scoped secrets. |
| Security & authorization | **2/5** | Auth-gaten benoemd als bugfix, maar geen Action Gateway, geen policy-laag, geen OpenClaw-hardening, geen threat model, geen skill-supply-chain-beleid. |
| Task-/workflow-architectuur | **2/5** | Inngest gepland, maar geen task lifecycle, geen idempotency-ontwerp, geen HITL-semantiek, geen source of truth voor task-state (SQLite? Inngest? n8n? Telegram?). |
| Agent harness & contextmanagement | **1/5** | Volledig afwezig. Geen contextdiscipline, geen tool-registry, geen sandbox-strategie, geen verificatieloop, geen bewijsplicht. |
| Kennisstructuur & agent-legibility | **2/5** | AGENTS.md bestaat (generieke template), Qdrant-kennisbank bestaat, maar geen docs-als-system-of-record, geen freshness/stale-detectie, kennis verspreid over ≥4 documentbomen (`docs/`, `ai-motor/docs/`, `factory-os/docs/`, `kennisbank/`). |
| Recipes/Playbooks/Skills | **1/5** | Begrippen bestaan niet in het plan. Geen kristallisatie-loop, geen versioning. |
| Evals & quality gates | **1/5** | Eén embeddings-eval-script gepland. Geen taak-evals, geen releasegates, geen regressieset. |
| Observability & audit | **3/5** | Langfuse + audit_events gepland — goede keuzes, maar geen evidence-plane-ontwerp, geen koppeling trace↔approval↔deploy. |
| Reliability & DR | **2/5** | Backups genoemd; geen RTO/RPO, geen restore-tests, geen incident-runbooks voor de agent-laag. |
| Productization / white-label | **3/5** | White-label runbook bestaat; geen Playbook-hergebruik-over-tenants-model. |
| Governance (eigenaarschap, exitstrategie, lifecycle) | **2/5** | Skip-list is een goed begin van technology lifecycle; geen eigenaar/runbook/exit per component. |

**Gewogen totaal: ~2,2/5.** Sterk onderaan de stack, zwak precies in de lagen die een "AI-operating-system" definiëren. Dat is geen diskwalificatie — het betekent dat de volgende investering **niet** in nog meer infra of nog meer tools moet zitten, maar in lifecycle, policy, kennis en bewijs.

---

## 3. Probleeminventarisatie

Ieder probleem is gekoppeld aan het rolmodel dat het al heeft opgelost (kolom "Opgelost door") — dit stuurt de Atlas in [hoofdstuk 4](02-reference-atlas.md).

### P-serie: problemen die Motor AI wil oplossen (uit missie + huidige staat)

| # | Probleem | Huidige staat Motor AI | Opgelost door (rolmodel) |
|---|---|---|---|
| P1 | Taken aannemen, scopen en prioriteren zonder dat de eigenaar alles zelf uitschrijft | Ad-hoc chat; geen intake-structuur | Devin (delegation + Ask-scoping), Codex (task command center) |
| P2 | Taken uitvoeren in isolatie zonder productie te raken | Agents draaien direct op NUC/host; geen sandbox per taak | Codex (container per taak), OpenHands (action-execution-server in container), Devin (snapshots) |
| P3 | Lange taken die context overleven en hervatbaar zijn | Niets; sessies verliezen alles | Anthropic long-running harness (init.sh, feature_list.json, progress file, git checkpoints) |
| P4 | Weten wanneer iets écht af is (niet "premature victory") | Geen verificatiediscipline | Anthropic (self-verification als menselijke gebruiker), Codex (verplichte checks + citaties), SWE-agent (lint-gate) |
| P5 | Terugkerend werk consistent herhalen en verbeteren | Niets; elke keer opnieuw prompten | Devin (Playbooks + Session Insights + Knowledge), Hermes (skill-authoring door agent) |
| P6 | Kennis vindbaar voor agents (en nieuwe teamleden) | Verspreid over 4+ documentbomen, Slack/hoofden, Qdrant | Codex harness engineering (docs als system of record, AGENTS.md als kaart), Devin (DeepWiki), Aider (repo-map) |
| P7 | Contextkosten en -kwaliteit beheersen | Geen enkel contextbeleid | Manus (KV-cache, filesystem-as-context, recitation, errors-in-context), Claude Code (compaction, subagent-isolatie) |
| P8 | Risicovolle acties technisch begrenzen (niet alleen vragen) | Approvals via Telegram/UI, maar geen credential-broker, argument-hash of rol×risicoklasse-matrix | Claude Code hooks (deterministische PreToolUse-block), Codex (two-phase sandbox, domain allowlist), Manus (tool masking) |
| P9 | Menselijke goedkeuring op het juiste moment, durable | Telegram-bridge + cowork-inbox; state versnipperd | Inngest waitForEvent / DBOS send-recv / Temporal signals (durable HITL) |
| P10 | Workflow-state die crashes overleeft | n8n (geen mid-run-checkpointing — gediskwalificeerd als engine) | Durable execution: Inngest/DBOS/Temporal/Restate/Hatchet |
| P11 | Multi-tenant isolatie (Bokas/Fumero/toekomstig) | RLS gepland; Qdrant-payload gepland; rest open | Postgres RLS (industrie-standaard), Codex env-per-taak, Qdrant payload-filtering |
| P12 | Modelrouting zonder hardcoded strings, met budget | LiteLLM gepland (goed), geen budget/routing-beleid | LiteLLM (E4/E5), Anthropic routing-pattern, OpenHands (LiteLLM in productie) |
| P13 | Weten wat agents doen en waarom (observability) | Langfuse gepland; geen beslis-tracing | Anthropic multi-agent (full tracing van beslispatronen), Langfuse (E2) |
| P14 | Kwaliteit meten vóór release (evals) | Afwezig | Anthropic (LLM-as-judge single-rubric, start met ~20 echte queries), Devin (verificatie vóór oplevering) |
| P15 | Herstellen na incidenten, ook mid-task | Afwezig voor agent-laag | Anthropic (resume-from-error, rainbow deploys), Temporal-klasse replay |
| P16 | Autonomie geleidelijk verhogen zonder vertrouwensbreuk | Alles of niets nu | Codex (approval modes), Claude Code (permission modes), Devin (confidence-gated review) |
| P17 | Mobiel command center | Telegram-bridge bestaat; motorsai.app mobiel-geoptimaliseerd | Devin (Slack/Linear als command center), OpenClaw (channel bridges — met securitylessen) |
| P18 | Succesvolle taken kristalliseren tot herbruikbaar product | Afwezig | Devin (Playbooks over teams), Coze/white-label-patroon (tenant-herbruikbare workflows) |
| P19 | Eén waarheid per informatiesoort | **Geschonden**: ≥6 state-mechanismen/integraties; live gebruik per store staat in 00-HUIDIGE-STAAT nog deels onbekend | Source-of-Truth-discipline (event-sourced log bij OpenHands; PG-SSOT in eigen ADR-002) |
| P20 | Eén technicus + 2–3 niet-technische helpers moeten het geheel kunnen dragen | Huidige repo bevat ~5 generaties experimenten naast elkaar (omega, holding, evomap, factory-os, singularity, ai-motor) | AM-1: maximaal 8 Core-componenten; legacy bevriezen→30 dagen→verwijderen |

### R-serie: risico's bij gebruik en lange termijn (expliciet gevraagd: "wat zijn zwakheden bij gebruik en long term")

| # | Risico | Ernst | Bewijs |
|---|---|---|---|
| R1 | **OpenClaw-klasse security-incidenten**: RCE, exposed gateway, malicious skills | Kritiek | E1 — CVE-2026-25253; 40k+ exposed instances; ClawHavoc-campagne (Koi Security, feb 2026) |
| R2 | Auth-regressie op chat/conversations → tenantdata-lek | Kritiek | Routefamilies zijn repo-af dicht; live 401/403 en regressietest blijven verplicht |
| R3 | Tweede/derde/zesde waarheid: task-state in SQLite én n8n én Telegram én EXECUTION_BOARD.db | Hoog | Eigen repo-inventarisatie |
| R4 | Kennisverlies: beslissingen in chat/hoofden; 4 documentbomen zonder eigenaar/freshness | Hoog | Eigen repo; Codex harness-post beschrijft exact deze failure mode |
| R5 | n8n als durable engine gebruiken → verloren runs bij crash mid-executie | Hoog | E4/E5 — n8n heeft geen mid-run-checkpointing; alleen Wait-node >65s persist |
| R6 | Multi-agent by default → 15× tokenkosten zonder kwaliteitswinst | Middel | E2 — Anthropic: multi-agent ≈15× tokens; coding parallelliseert slecht |
| R7 | Vendor lock-in/abandonment (Manus→Meta overgenomen; Hatchet 7 personen; Inngest SSPL) | Middel | E1/E2 — Manus "part of Meta" (2026); licentie-analyse |
| R8 | Kosten onbeheerst: geen budget per taak/tenant, geen cost-per-successful-task-metriek | Middel | Anthropic tokeneconomie; eigen plan mist budgets |
| R9 | "Premature victory" en stille regressies zonder evals/feature-lists | Middel | E2 — Anthropic long-running harness failure modes |
| R10 | Eén persoon (eigenaar) is bus-factor voor álles: secrets, infra, beslissingen | Hoog | Organisatie-inference (E6) — daarom eigenaar+runbook+exit per component verplicht |
| R11 | Dify + n8n + OpenClaw + Inngest = 4 overlappende automation-lagen → onhoudbaar voor n=1 techniek | Hoog | ADR-105: één durable engine op Hetzner; overige lagen adapter/kanaal/decommission |
| R12 | Prompt-injectie via kennisbank/scrape-content en browser-agent | Middel | E1/E2 — Codex-docs erkennen dit expliciet; OpenClaw-incidenten |

Deze inventarisatie stuurt alles hierna: elk probleem P1–P20 en risico R1–R12 komt terug in de [Atlas](02-reference-atlas.md), de [Pattern Cards](03-pattern-cards.md) en de [fit-gap-analyse](04-fit-gap-en-adoptieladder.md).
