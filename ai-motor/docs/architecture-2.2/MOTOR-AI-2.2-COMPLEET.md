

<!-- ======== BESTAND: README.md ======== -->

# Motor AI 2.2 — Reference-First Architecture Synthesis

> **Versie:** 2026-07-21 · **Eigenaar:** Pietje · **Status:** Voorstel ter review
> **Vervangt niet:** [`../MASTER-BUILD-PLAN.md`](../MASTER-BUILD-PLAN.md) (infra-plan blijft geldig als Golf 0/1) — dit document is de **architectuurlaag erboven**.
> **Methode:** Reverse-engineering van bewezen rolmodellen (OpenAI Codex, Cognition Devin, Manus, Anthropic, OpenHands, SWE-agent, Claude Code, Qwen-Agent, Coze Studio, DeerFlow, Youtu-Agent, OpenClaw, Hermes, Temporal/Inngest/DBOS/Restate/Hatchet/Conductor) op basis van primaire bronnen, daarna pas ontwerp.

## Hoofdregel

**Adopt proven patterns by default. Configure before wrapping. Wrap before extending. Extend before building. Build custom only when a documented gap remains.**

## Leeswijzer — verplichte outputvolgorde (35 onderdelen)

| # | Output | Document |
|---|--------|----------|
| 1 | Executive oordeel | [`01-executive-oordeel.md`](01-executive-oordeel.md) |
| 2 | Maturityscore huidig plan | [`01-executive-oordeel.md`](01-executive-oordeel.md) |
| 3 | Probleeminventarisatie | [`01-executive-oordeel.md`](01-executive-oordeel.md) |
| 4 | Reference Architecture Atlas | [`02-reference-atlas.md`](02-reference-atlas.md) |
| 5 | Pattern Cards | [`03-pattern-cards.md`](03-pattern-cards.md) |
| 6 | Rolmodelvergelijking | [`02-reference-atlas.md`](02-reference-atlas.md) |
| 7 | Welke wielen al zijn uitgevonden | [`02-reference-atlas.md`](02-reference-atlas.md) |
| 8 | Rechtstreeks overgenomen patronen | [`02-reference-atlas.md`](02-reference-atlas.md) |
| 9 | Fit-gap-analyse | [`04-fit-gap-en-adoptieladder.md`](04-fit-gap-en-adoptieladder.md) |
| 10 | Niet zelf bouwen | [`04-fit-gap-en-adoptieladder.md`](04-fit-gap-en-adoptieladder.md) |
| 11 | Dunne adapter voldoende | [`04-fit-gap-en-adoptieladder.md`](04-fit-gap-en-adoptieladder.md) |
| 12 | Mogelijk custom | [`04-fit-gap-en-adoptieladder.md`](04-fit-gap-en-adoptieladder.md) |
| 13 | No-Invention Gate per custom component | [`04-fit-gap-en-adoptieladder.md`](04-fit-gap-en-adoptieladder.md) |
| 14 | Definitieve target architecture | [`05-target-architecture.md`](05-target-architecture.md) |
| 15 | Control/execution/data/evidence-plane | [`05-target-architecture.md`](05-target-architecture.md) |
| 16 | Source-of-Truth Matrix | [`05-target-architecture.md`](05-target-architecture.md) |
| 17 | Task lifecycle | [`05-target-architecture.md`](05-target-architecture.md) |
| 18 | Long-running task lifecycle | [`05-target-architecture.md`](05-target-architecture.md) |
| 19 | Multi-agent beslisboom | [`05-target-architecture.md`](05-target-architecture.md) |
| 20 | Knowledge- en repositorystructuur | [`05-target-architecture.md`](05-target-architecture.md) |
| 21 | Recipe/Playbook/Skill/Workflow-model | [`05-target-architecture.md`](05-target-architecture.md) |
| 22 | Permission- en Action Gateway-structuur | [`05-target-architecture.md`](05-target-architecture.md) |
| 23 | Multi-tenantstructuur | [`05-target-architecture.md`](05-target-architecture.md) |
| 24 | Modelroutingstructuur | [`05-target-architecture.md`](05-target-architecture.md) |
| 25 | Evals en releasegates | [`06-evals-observability-reliability.md`](06-evals-observability-reliability.md) |
| 26 | Observability en audit | [`06-evals-observability-reliability.md`](06-evals-observability-reliability.md) |
| 27 | Reliability en disaster recovery | [`06-evals-observability-reliability.md`](06-evals-observability-reliability.md) |
| 28 | Technology lifecycle matrix | [`07-lifecycle-en-traceability.md`](07-lifecycle-en-traceability.md) |
| 29 | Role-model traceability matrix | [`07-lifecycle-en-traceability.md`](07-lifecycle-en-traceability.md) |
| 30 | Architecture Decision Records | [`07-lifecycle-en-traceability.md`](07-lifecycle-en-traceability.md) |
| 31 | Migratiegolven | [`08-migratie-pilot-twaalfweken.md`](08-migratie-pilot-twaalfweken.md) |
| 32 | Verticale Bokas-pilot | [`08-migratie-pilot-twaalfweken.md`](08-migratie-pilot-twaalfweken.md) |
| 33 | Twaalfwekenplan | [`08-migratie-pilot-twaalfweken.md`](08-migratie-pilot-twaalfweken.md) |
| 34 | Definition of Done | [`09-definition-of-done-11-10.md`](09-definition-of-done-11-10.md) |
| 35 | Meetbare 11/10-criteria | [`09-definition-of-done-11-10.md`](09-definition-of-done-11-10.md) |
| — | Verbeterde prompt (Motor AI 2.3) | [`PROMPT-2.3.md`](PROMPT-2.3.md) |
| 36 | Marktscan homelab/SMB-AI-ops + kansen (2026-07-21) | [`10-marktscan-homelab-kansen.md`](10-marktscan-homelab-kansen.md) |
| — | Verbeterde prompt marktscan-editie (Motor AI 2.4) | [`PROMPT-2.4.md`](PROMPT-2.4.md) |
| 37 | Azië-scan: next level boven het starter kit (2026-07-21) | [`11-azie-next-level.md`](11-azie-next-level.md) |
| 38 | Hardware-update: NUC + RTX 3090 (2026-07-21) | [`12-hardware-3090.md`](12-hardware-3090.md) |
| 39 | Mini-datacenter-upgrade: het derde niveau (2026-07-21) | [`13-mini-datacenter-upgrade.md`](13-mini-datacenter-upgrade.md) |

## Bewijsniveaus (gebruikt in alle documenten)

1. **E1** — Onafhankelijk production-proven
2. **E2** — Officieel productiongebruik gedocumenteerd
3. **E3** — Officiële leveranciersclaim
4. **E4** — Open-source implementatie beschikbaar
5. **E5** — Communityervaring
6. **E6** — Architectuurinference
7. **E7** — Onbewezen hypothese

## Kern van het oordeel in één alinea

Het huidige masterplan is een goed **infrastructuurplan** (Postgres/RLS, LiteLLM, Inngest, Langfuse — allemaal validated door dit onderzoek), maar het is **geen agent-operating-system-architectuur**. Het mist precies de lagen waar de rolmodellen hun succes aan danken: een task lifecycle met verificatie en bewijs, een repository-local kennisstructuur die agents kunnen lezen, een Playbook/Skill-kristallisatiemechanisme, een Policy/Action Gateway die risicovolle acties technisch begrenst, evals als releasegate, en één canonieke eigenaar per waarheid (nu: minstens zes concurrerende state-stores). Bijna alles wat ontbreekt is al uitgevonden en gedocumenteerd — er hoeft vrijwel niets custom gebouwd te worden behalve dunne adapters. De grootste acute risico's: OpenClaw-hardening (CVE-2026-25253-klasse, supply-chain via skills), open auth-paden, en drie overlappende orchestrators (OpenClaw, n8n, Dify) zonder afgebakende rol.


<!-- ======== BESTAND: 01-executive-oordeel.md ======== -->

# 1–3. Executive oordeel · Maturityscore · Probleeminventarisatie

> Onderdeel van [Motor AI 2.2 — Reference-First Architecture Synthesis](README.md)

---

## 1. Executive oordeel

**Het huidige Motor AI-masterplan is een degelijk infrastructuur- en migratieplan, maar geen architectuur voor een AI-operating-system.** Het beantwoordt "waar draait wat, en hoe migreren we van SQLite naar Postgres" — het beantwoordt niet "hoe wordt een taak betrouwbaar, verifieerbaar, hervatbaar en herbruikbaar uitgevoerd door agents". Precies dat tweede is wat Codex, Devin, Manus, Anthropic en de open-source harnesses hebben opgelost, en hun oplossingen zijn publiek gedocumenteerd.

**Drie hoofdconclusies:**

1. **De techkeuzes in het masterplan overleven due diligence grotendeels.** Postgres+RLS, Drizzle, LiteLLM als enige model-gateway, Langfuse Cloud, Qdrant-multitenancy en Inngest zijn allemaal verdedigbaar en blijven staan. Eén keuze verdient een expliciete spike vóór commitment: **DBOS Transact** als alternatief voor Inngest (nul extra infra op de 16 GB-box, MIT-licentie, state in de Postgres die er al staat) — zie ADR-101. n8n en Dify verliezen hun rol als orchestrator en worden gedegradeerd tot integratie-/UI-laag respectievelijk Decommissioning.

2. **Wat ontbreekt is niet technologie maar structuur.** Het plan heeft geen task lifecycle (intake → plan → execute-in-isolation → verify → review → approve → learn), geen bewijsplicht (terminal/test/log-citaties zoals Codex; end-to-end selfverificatie zoals Anthropic), geen Playbook/Skill-kristallisatie (Devin), geen contextdiscipline (Manus), geen repository-local kennisstructuur met progressive disclosure (Codex harness engineering), geen Policy Gateway die risicovolle acties technisch afdwingt (Claude Code hooks-patroon), geen evals als releasegate, en geen Source-of-Truth-matrix — terwijl er nu aantoonbaar **minstens zes state-stores naast elkaar leven** (ai-motor SQLite, EXECUTION_BOARD.db, omega_db, factory_brains/chroma, Qdrant, n8n/Dify interne state). Elk van deze gaten wordt gedicht met een **bestaand, gedocumenteerd patroon** — vrijwel niets hoeft custom.

3. **Het grootste acute risico is security, niet functionaliteit.** OpenClaw — de primaire chat-agent — had in jan–feb 2026 een gedocumenteerde one-click-RCE (CVE-2026-25253, CVSS 8.8), 40.000+ publiek exposed instances (93% zonder auth) en een supply-chain-campagne met ~800 malicious skills in ClawHub (bewijsniveau E1: meerdere onafhankelijke securityfirma's). Het masterplan noemt dit nergens. Daarnaast staan `/api/chat/*` en `/api/conversations/*` in PUBLIC_PATHS (eigen Fase 0-bevinding, nog open op moment van schrijven van dit document). Hardening en Action Gateway zijn daarom **Golf 1, geen polish**.

**Eindoordeel:** doorbouwen op de bestaande stack is juist; het plan moet worden aangevuld met de agent-OS-laag volgens de patronen in dit document. Team van 3–4 mensen kan dit dragen omdat ~90% adoptie/configuratie is en <10% dunne adapters.

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
| P8 | Risicovolle acties technisch begrenzen (niet alleen vragen) | Approvals via Telegram/UI, maar niets is technisch afgedwongen | Claude Code hooks (deterministische PreToolUse-block), Codex (two-phase sandbox, domain allowlist), Manus (tool masking) |
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
| P19 | Eén waarheid per informatiesoort | **Geschonden**: ≥6 state-stores (ai-motor SQLite, EXECUTION_BOARD.db, omega_db.py, factory_brains/chroma, Qdrant, n8n/Dify state), 3 orchestrators | Source-of-Truth-discipline (event-sourced log bij OpenHands; PG-SSOT in eigen ADR-002) |
| P20 | Team van 3–4 mensen mag het geheel kunnen dragen | Huidige repo bevat ~5 generaties experimenten naast elkaar (omega, holding, evomap, factory-os, singularity, ai-motor) | mini-SWE-agent-les: radicale eenvoud wint; Production Core klein houden |

### R-serie: risico's bij gebruik en lange termijn (expliciet gevraagd: "wat zijn zwakheden bij gebruik en long term")

| # | Risico | Ernst | Bewijs |
|---|---|---|---|
| R1 | **OpenClaw-klasse security-incidenten**: RCE, exposed gateway, malicious skills | Kritiek | E1 — CVE-2026-25253; 40k+ exposed instances; ClawHavoc-campagne (Koi Security, feb 2026) |
| R2 | Open auth-paden (`/api/chat/*` public) → tenantdata-lek | Kritiek | Eigen codebase, Fase 0-item 0.2.2 |
| R3 | Tweede/derde/zesde waarheid: task-state in SQLite én n8n én Telegram én EXECUTION_BOARD.db | Hoog | Eigen repo-inventarisatie |
| R4 | Kennisverlies: beslissingen in chat/hoofden; 4 documentbomen zonder eigenaar/freshness | Hoog | Eigen repo; Codex harness-post beschrijft exact deze failure mode |
| R5 | n8n als durable engine gebruiken → verloren runs bij crash mid-executie | Hoog | E4/E5 — n8n heeft geen mid-run-checkpointing; alleen Wait-node >65s persist |
| R6 | Multi-agent by default → 15× tokenkosten zonder kwaliteitswinst | Middel | E2 — Anthropic: multi-agent ≈15× tokens; coding parallelliseert slecht |
| R7 | Vendor lock-in/abandonment (Manus→Meta overgenomen; Hatchet 7 personen; Inngest SSPL) | Middel | E1/E2 — Manus "part of Meta" (2026); licentie-analyse |
| R8 | Kosten onbeheerst: geen budget per taak/tenant, geen cost-per-successful-task-metriek | Middel | Anthropic tokeneconomie; eigen plan mist budgets |
| R9 | "Premature victory" en stille regressies zonder evals/feature-lists | Middel | E2 — Anthropic long-running harness failure modes |
| R10 | Eén persoon (eigenaar) is bus-factor voor álles: secrets, infra, beslissingen | Hoog | Organisatie-inference (E6) — daarom eigenaar+runbook+exit per component verplicht |
| R11 | Dify + n8n + OpenClaw + Inngest = 4 overlappende automation-lagen → onderhoudslast 3–4-persoonsteam | Hoog | Eigen plan; mini-SWE-agent-les over eenvoud |
| R12 | Prompt-injectie via kennisbank/scrape-content en browser-agent | Middel | E1/E2 — Codex-docs erkennen dit expliciet; OpenClaw-incidenten |

Deze inventarisatie stuurt alles hierna: elk probleem P1–P20 en risico R1–R12 komt terug in de [Atlas](02-reference-atlas.md), de [Pattern Cards](03-pattern-cards.md) en de [fit-gap-analyse](04-fit-gap-en-adoptieladder.md).


<!-- ======== BESTAND: 02-reference-atlas.md ======== -->

# 4, 6, 7, 8. Reference Architecture Atlas · Rolmodelvergelijking · Uitgevonden wielen · Direct overgenomen patronen

> Onderdeel van [Motor AI 2.2](README.md). Bewijsniveaus E1–E7, zie [README](README.md#bewijsniveaus-gebruikt-in-alle-documenten).
> Onderzoek uitgevoerd 2026-07-21 op primaire bronnen; publicatiedatums vermeld bij tijdgevoelige claims.

---

## 4. Reference Architecture Atlas

Kolommen: Probleemgebied · Rolmodel · Bewezen patroon · Bewijsniveau · Schaal · Sterkte · Zwakte · Toepassing voor Motor AI.

| Probleemgebied | Rolmodel | Bewezen patroon | Bewijs | Schaal | Sterkte | Zwakte | Toepassing Motor AI |
|---|---|---|---|---|---|---|---|
| **Task intake** | Devin | Delegatie als teamlid: taak ≤ "3 uur handwerk", success criteria verplicht, Ask-scoping vóór implementatiesessie | E2 (docs) | Enterprise-klanten | Dwingt scherpe scope af | Vage taken falen alsnog | Adopt: intake-template met outcome + criteria + verboden acties |
| Task intake | Codex | Task command center: veel parallelle, goed afgebakende taken vanuit één board | E2 | OpenAI intern + ChatGPT-users | Async delegatie schaalt | Geen mid-task-bijsturing | Adopt: Motor `/cowork` wordt het board; taken klein houden |
| **Planning** | Claude Code | Plan mode: tool-afgedwongen read-only fase vóór edits; plan als reviewbaar artifact | E2/E4 | Breed productgebruik | Deterministisch afgedwongen | Overkill voor 1-zin-taken | Adopt: plan-fase verplicht boven risicoklasse R2 |
| Planning | Codex harness | Exec plans als versioned artifacts in repo (`docs/exec-plans/active|completed`) | E2 (één case study) | 1 team, 1M LoC claim (E3) | Plan overleeft sessie/context | Vereist docdiscipline | Adopt as-is |
| **Orchestration** | Anthropic | Workflows > agents wanneer stappen vooraf bekend; 5 workflow-patronen (chaining, routing, parallelization, orchestrator-worker, evaluator-optimizer) | E2/E4 (cookbook) | Industrie-referentie | Eenvoudigste betrouwbare structuur | — | Adopt als beslisboom (§19) |
| Orchestration | Inngest/DBOS | Durable step functions in TypeScript over bestaande Postgres | E2/E4 | SoundCloud, Resend (Inngest); BMS, Dosu (DBOS) | Past op 16 GB + Next.js | Inngest self-host jong; DBOS geen UI | Configure: één canonieke engine (ADR-101) |
| **Multi-agentdelegatie** | Cognition | "Don't build multi-agents": single-threaded agent + full context; compressor voor lange taken | E3 (essay, breed geciteerd) | — | Voorkomt conflicterende impliciete beslissingen | Sluit echte parallelle winst uit | Adopt als default |
| Multi-agentdelegatie | Anthropic research | Orchestrator-worker alléén voor breadth-first research; subagents = filters/compressors; ~15× tokens | E2 | Claude Research productie | 90% sneller op brede queries (E3-cijfer) | Duur; coding parallelliseert slecht | Configure: alleen research-lifecycle |
| Multi-agentdelegatie | Manus Wide Research | Parallelle subagents zonder onderling contact, alle coördinatie via controller | E3 | Manus-product | Voorkomt context pollution | Alleen embarrassingly-parallel werk | Defer tot research-pilot bewezen |
| **Workflow-state** | Temporal-klasse | Event-sourced replay / step-checkpointing; state overleeft crash | E1 | Netflix, Stripe, Coinbase e.a. | Gouden standaard | Self-host = 3–6 GB + ops-tax | Wrap: semantiek adopteren via Inngest/DBOS |
| Workflow-state | n8n | Wait-node persistence only; géén mid-run checkpoint | E4/E5 | Breed, maar als integratietool | Snelle integraties | **Geen durable engine** | Degradeer: n8n = adapterlaag, nooit state-eigenaar |
| **Contextmanagement** | Manus | KV-cache-stabiliteit: stabiele prefix, append-only, deterministische serialisatie; hit rate = belangrijkste metric | E3 (blog 2025-07-18), mechanisme onafh. verifieerbaar (cache-pricing 10×) | Miljoenen sessies (E3) | 10× kostenverschil cached/uncached input | Vereist discipline in harness | Adopt as-is in CEO-harness |
| Contextmanagement | Manus | Filesystem als externe context; compressie altijd herstelbaar (URL/pad bewaren) | E3, gedrag observeerbaar (E5) | idem | Onbeperkt geheugen | Bestandsbeheer nodig | Adopt as-is |
| Contextmanagement | Manus | Recitation (todo.md herschrijven), errors in context laten, few-shot-rut vermijden | E3 + academisch fundament (lost-in-the-middle, Liu 2023) | idem | Goedkoop, effectief | Effectgrootte onbekend | Adopt as-is |
| Contextmanagement | Claude Code | Subagent-isolatie depth-1: alleen samenvatting terug naar parent | E2/E4 | Breed | Contexthygiëne zonder multi-agent-risico | — | Adopt as-is |
| **Kennisstructuur** | Codex harness | AGENTS.md ≈100 regels als kaart; `docs/` als system of record; progressive disclosure; mechanische validatie + doc-gardening-agent | E2 | 1 team (claims E3); AGENTS.md-spec: Linux Foundation, 20+ tools, 60k+ repos (E1 voor de conventie) | Agent-legible, vers | Vereist CI-tooling | Adopt: structuur in §20 |
| Kennisstructuur | Devin | DeepWiki: automatische codebase-wiki; Knowledge met trigger-descriptions | E2, deels E1 (deepwiki.com publiek testbaar) | Enterprise | Retrieval wanneer relevant, niet alles tegelijk | Kwaliteit op monorepos onbewezen | Configure: triggers op Knowledge-items |
| Kennisstructuur | Aider | Repo-map: tree-sitter + PageRank binnen tokenbudget | E4 | Breed OSS-gebruik | Structurele compressie | Alleen code | Watchlist (pas bij repo-agent) |
| **Memory** | Hermes | SQLite FTS5 over sessietranscripten + samenvatting; agent schrijft eigen skills na taak (met review) | E4 | Groot OSS-gebruik 2026 | Goedkoop lange-termijn-geheugen | "Self-improving" = marketing | Configure: PG FTS ipv SQLite |
| Memory | Manus/OpenHands | Append-only event log als geheugen + replay | E4 (OpenHands ICLR 2025) | OSS + cloud | Reconstrueerbaar | Volume | Adopt: task-event-log in PG |
| **Toolselectie** | Manus | Tools maskeren, niet verwijderen (logit-masking, prefix-naamgeving `browser_`, `shell_`) | E3, mechanisme standaard (E4) | Manus-productie | Cache-stabiel + geen schema-violaties | Vereist inference-controle | Adopt naamgeving; masking waar API het toelaat |
| Toolselectie | SWE-agent | ACI-principes: weinig simpele tools, compacte feedback, lint-gate op elke edit | E1 (NeurIPS 2024, ablaties) | Academisch + breed overgenomen | Bewezen effect onafhankelijk van model | 2026-les: minder ACI nodig bij frontier-modellen | Adopt principes |
| **Sandboxing** | Codex | Container per taak; two-phase (setup mét internet/secrets → agent zónder, domain-allowlist, method-restricties) | E2 | ChatGPT-schaal | Exfiltratie-preventie | Complexiteit | Adopt-vereenvoudigd: Docker per taak op NUC/Hetzner |
| Sandboxing | OpenHands | Action-execution-server (FastAPI) in container; host praat REST/WS | E4 + E1 (paper) | OSS + cloud | Herbruikbaar, taal-agnostisch | Beheer images | Adopt as-is voor code-taken |
| Sandboxing | mini-SWE-agent | Stateless `subprocess`/`docker exec` per actie; bash-only | E4, breed geadopteerd (Meta, NVIDIA — E2) | RL/benchmarks | Triviaal te sandboxen | Geen sessiestate | Configure voor korte taken |
| **Code generation** | Codex/Claude Code | Kleine toolset, agentic search (grep>RAG), verplichte checks uit AGENTS.md | E2 | Breed | Eenvoud | — | Adopt |
| **Code review** | Claude Code | Adversarial review met verse context: reviewer ziet alleen diff+criteria | E2 | Breed | Geen self-grading-bias | Reviewer vindt áltijd iets → scope-instructie nodig | Adopt as-is |
| Code review | Devin | Devin Review + Auto-Fix tot CI groen | E2 | Enterprise | Sluit de loop | Vendor-product | Patroon adopteren, tool zelf kiezen |
| **Human approval** | Inngest/DBOS/Temporal | Durable HITL: waitForEvent / send-recv / signals met timeout | E2/E4 | Breed | Overleeft crash/restart | — | Adopt via canonieke engine |
| Human approval | Devin | Confidence-gated: agent meldt onzekerheid expliciet; mens reviewt outcome, niet elke stap | E2 | Enterprise | Schaalt menselijke aandacht | Vereist eerlijke onzekerheid | Adopt |
| **Authorization** | Claude Code hooks | Deterministische PreToolUse-block (exit 2 = hard block, niet-omzeilbaar) | E2/E4 | Breed | Policy ≠ prompt | Hook-onderhoud | **Adopt als kern van Action Gateway** |
| Authorization | OpenClaw (negatief) | Gateway met permissive defaults → 40k exposed, CVE, malicious skills | E1 (Censys, Bitsight, Koi Security, jan–feb 2026) | 100k+ installs | — | Secure-by-default ontbrak | Les: loopback-bind, token-auth verplicht, geen ongesigneerde skills |
| **Multi-tenancy** | Industrie | Postgres RLS + workspace_id overal + Qdrant payload-filter | E1 | Breed SaaS | DB-niveau isolatie | RLS-testdiscipline | Adopt (al gepland) |
| **Observability** | Anthropic | Full decision-tracing (zonder content), resume-from-error, end-state-evaluatie | E2 | Claude Research | Debugt non-determinisme | — | Configure in Langfuse + eigen event log |
| Observability | Langfuse | LLM-tracing SaaS/OSS | E2/E4 | Breed | Direct bruikbaar | Cloud-DPA nodig (AVG) | Configure (al gepland) |
| **Evals** | Anthropic | Start met ~20 echte queries; LLM-as-judge met één rubric (0–1 + pass/fail); end-state-evaluatie | E2 | Claude Research | Realistisch voor klein team | Judge-bias bewaken | Adopt as-is |
| **Incident recovery** | Anthropic | Resume-from-error ipv restart; rainbow deploys voor lopende agents | E2 | Productie | Geen verloren uren werk | — | Adopt via durable engine |
| **Progressive autonomy** | Codex/Claude Code | Approval-modes per risicoklasse (read-only → ask → auto binnen sandbox) | E2 | Breed | Vertrouwen groeit meetbaar | — | Adopt: autonomieniveaus per Playbook |
| **Mobile command center** | Devin | Slack/Linear/Jira als volwaardige intake+review-kanalen | E2 | Enterprise | Werk waar de eigenaar is | — | Configure: Telegram + motorsai.app mobiel |
| **Recurring workflows** | Devin | Playbooks: outcome, procedure, specifications (postconditions), advice, forbidden actions, required input; `!macro`-triggers | E2 | Enterprise | Direct kopieerbare structuur | Onderhoud bij drift | **Adopt as-is als Motor-Playbookformat** |
| **Skill crystallization** | Devin | Session Insights: automatische sessie-analyse → verbeterde prompt → Knowledge-suggesties | E2 (API publiek) | Enterprise | Leren zonder fine-tuning | Menselijke review blijft nodig | Adopt patroon |
| Skill crystallization | Hermes | Agent schrijft SKILL.md na complexe taak; mens reviewt en versioneert | E4 | OSS | Goedkoop | Kwaliteitsbewaking | Configure |
| **Productization** | Coze Studio | Compile/runtime-scheiding voor workflows; DDD-lagen voor multi-tenant platform | E4 (Apache-2.0, jul 2025) | ByteDance-schaal (E3) | Bewezen platformstructuur | Zwaar voor 3–4 p. | Watchlist; patroon noteren |
| Productization | Eigen white-label runbook | Tenant < 1 dag | intern | Bestaat al | Nog geen Playbook-hergebruik | Extend met Playbook-scoping per tenant |

---

## 6. Rolmodelvergelijking (wat elk systeem het beste doet, en wat we bewust níet overnemen)

| Rolmodel | Beste bijdrage aan Motor AI | Bewust niet overnemen | Waarom niet |
|---|---|---|---|
| **OpenAI Codex** | Kennisstructuur (AGENTS.md-als-kaart, docs-als-SSOT, exec-plans), sandbox-per-taak, bewijs-citaties, mechanische regels met remediation-lints | Near-total autonomy (agent-to-agent review, automerge zonder mens) | Berust op één self-reported case study (E3); Motor AI heeft 3–4 mensen en klantdata — human gates blijven |
| **Cognition Devin** | Playbook-formaat, Knowledge-met-triggers, Session Insights, snapshots, verificatie-vóór-oplevering, command-center-integraties | Devin als product kopen | Motor AI is zelf het platform; patronen zijn vrij beschikbaar in docs |
| **Manus** | Alle zes context-engineering-lessen; filesystem-as-context; tool-masking | Wide Research als default; eigen model-hosting-aannames | 15×-kostenklasse; Manus is opgekocht door Meta (2026) → continuïteit onzeker; wij zijn model-agnostisch via LiteLLM |
| **Anthropic (patterns + research + long-running)** | Workflow-vs-agent-beslisboom, orchestrator-worker-criteria, evals-aanpak, long-running-harness (feature list, progress, checkpoints, self-verify) | Multi-agent als default | Anthropic zelf: coding parallelliseert slecht; 15× tokens |
| **Claude Code** | Hooks (deterministische policy), CLAUDE.md-discipline, plan mode, subagent depth-1, grep-over-RAG | Volledige CLI-adoptie als enige harness | Motor AI heeft ook niet-code-taken; patroon > product |
| **OpenHands** | Event-sourced log, sandbox-as-server, microagents/skills-injectie | Volledige platform-adoptie | Overlapt met eigen Next.js-platform; wél de runtime als component overwegen (Incubation) |
| **SWE-agent / mini-SWE-agent** | ACI-principes; lint-gate; 2026-les "simpel wint" | Elaborate custom ACI bouwen | Het team dat ACI uitvond, verving het zelf door bash-only |
| **Temporal / Conductor** | Durable-semantiek als eis-checklist (replay, signals, timers, saga) | Self-hosten | 3–6 GB + ops-tax (Temporal); JVM+JSON-DSL (Conductor) past niet bij TS-team |
| **Inngest / DBOS / Hatchet / Restate** | Kandidaten canonieke engine op 16 GB | Meerdere tegelijk draaien | Eén canonieke engine (ADR-101) |
| **Qwen-Agent** | MCP-config-als-toollist; template-aware tool-parsing voor self-hosted open modellen | Framework-adoptie | Python-centrisch; overlapt |
| **Coze Studio** | Compile/runtime-split; DDD-lagen; bewijs dat visual-builder een apart productcategorie is | Platform-adoptie | Te zwaar; Dify-les herhaalt zich |
| **DeerFlow** | Coordinator→Planner→Researchers→Reporter met plan-approval als research-referentie | LangGraph-stack overnemen | Motor AI kiest TS-native engine; patroon volstaat |
| **Youtu-Agent** | YAML-declaratieve agentconfigs; eval-harnesspatroon | Benchmarkclaims geloven | GAIA-cijfer = text-only subset, vendor-judged (E3) |
| **OpenClaw** | Channel-bridge-patroon, typed-WS-gateway met device pairing, skills-injectie — én de securityles van 2026 | Skills uit ClawHub ongescreend; publieke exposure; localhost-trust | E1: CVE-2026-25253, ClawHavoc (~800 malicious skills), 40k+ exposed instances |
| **Hermes** | FTS-over-transcripten; agent-authored skills met review | "Self-improving"-framing | Marketing; mechanisme is skill-file-authoring |

---

## 7. Welke wielen zijn al uitgevonden

Concreet: **deze dingen nooit zelf ontwerpen — ze bestaan, met bewijs:**

1. **Durable execution** (replay, retries, timers, HITL-waits, crash recovery, idempotency) — Temporal-klasse semantiek, beschikbaar op 16 GB via Inngest of DBOS. *Zelf een queue+cron+state-machine bouwen op Postgres = het wiel opnieuw, slechter.*
2. **Task-instructieformat voor terugkerend werk** — Devin Playbooks (outcome/procedure/specifications/advice/forbidden/required-input). Kopieerbaar als markdown-schema.
3. **Repo-/kennisnavigatie voor agents** — AGENTS.md-conventie (Linux Foundation-gesteward, 20+ tools) + Codex' docs-als-SSOT-structuur + progressive disclosure.
4. **Long-running-taakdiscipline** — Anthropic's initializer/increment/feature-list/progress-file/git-checkpoint-harnas, inclusief open-source prompts (claude-quickstarts).
5. **Contextmanagement** — Manus' zes lessen + Claude Code compaction/subagents. Niets hiervan hoeft uitgevonden; alles is beschreven.
6. **Deterministische policy-afdwinging** — Claude Code hooks-model (PreToolUse hard block). Het patroon "policy buiten de prompt" is af.
7. **Sandbox-architectuur** — OpenHands action-execution-server (E4) of stateless docker-exec (mini-SWE-agent). Beide open source.
8. **Verificatie** — lint-gate-op-elke-edit (SWE-agent, grootste enkele win in ablaties), self-verify-als-gebruiker (Anthropic), bewijs-citaties (Codex).
9. **Evals voor agentwerk** — LLM-as-judge met één rubric + end-state-evaluatie + klein beginnen (~20 queries). Anthropic publiceerde de methode.
10. **Multi-tenant dataisolatie** — Postgres RLS + payload-filtering in vectorstore. Industriestandaard, al in eigen plan.
11. **Model-gateway** — LiteLLM (ook OpenHands' keuze). Al gepland.
12. **LLM-observability** — Langfuse. Al gepland.
13. **Skill/knowledge-kristallisatie** — Devin Session Insights + Hermes agent-authored skills. Patroon compleet gedocumenteerd.
14. **Channel-gateway (Telegram e.d.)** — OpenClaw/Hermes-patroon; zelfs de securityfouten zijn al voor ons gemaakt en gedocumenteerd.

**Wat níet af is (de echte gaps, → [fit-gap](04-fit-gap-en-adoptieladder.md)):** tenant-bewuste Policy/Action Gateway als samenhangend product; Playbook-registry met versioning/promotie over tenants; business-brede (niet-code) evidence-standaard. Zelfs dáár zijn het dunne adapters bovenop bestaande patronen, geen nieuwe systemen.

---

## 8. Welke bestaande patronen rechtstreeks worden overgenomen (Adopt as-is)

| # | Patroon | Bron | Motor AI-plek |
|---|---|---|---|
| A1 | AGENTS.md ≤100 regels als kaart + `docs/` als system of record + exec-plans versioned | Codex harness / agents.md-spec | Repo-structuur §20 |
| A2 | Playbook-format (outcome, input, procedure, postconditions, forbidden, foutafhandeling, approvals, bewijs) | Devin | Playbook-registry §21 |
| A3 | Long-running lifecycle: init.sh + feature_list.json (JSON, niet MD — modellen herschrijven JSON minder snel) + progress-file + git-checkpoints + one-increment-per-session + smoke-test-eerst | Anthropic (OSS prompts) | Alle lange taken §18 |
| A4 | KV-cache-discipline: stabiele prefix, append-only, deterministische serialisatie, geen timestamps in system prompt | Manus | CEO-harness |
| A5 | Filesystem-as-context met herstelbare compressie | Manus | Harness + task-workspace |
| A6 | Recitation (todo.md), errors-in-context, variatie tegen few-shot-rut | Manus | Harness |
| A7 | Subagent depth-1, alleen samenvatting terug | Claude Code | Harness |
| A8 | Workflow-vs-agent-beslisboom; multi-agent alleen met expliciete rechtvaardiging | Anthropic + Cognition | §19 |
| A9 | Deterministische policy-hooks (PreToolUse hard block) | Claude Code | Action Gateway §22 |
| A10 | Adversarial review met verse context (diff + criteria only) | Claude Code / Anthropic | Task lifecycle §17 |
| A11 | Bewijsplicht: test-/terminal-/log-citaties bij iedere claim "het werkt" | Codex | Evidence plane §15 |
| A12 | Lint-gate op iedere edit | SWE-agent | Code-harness |
| A13 | Durable HITL-waits met timeout + reminder | Inngest/DBOS-klasse | Approvals §22 |
| A14 | LLM-as-judge single-rubric + end-state-evals + start met ~20 echte queries | Anthropic | Evals §25 |
| A15 | Session-postmortem → verbeterprompt → Knowledge-kandidaat (menselijke review) | Devin Session Insights | Learning-loop §21 |
| A16 | Tool-naamprefixen per familie (`browser_`, `shell_`, `mail_`) t.b.v. masking/policy | Manus | Tool-registry |
| A17 | Secure-by-default gateway: loopback-bind, verplichte token-auth bij first launch, origin-validatie, gesigneerde/gescreende skills, kill-switch | OpenClaw-incidentlessen (omgekeerd) | Gateway-hardening, Golf 1 |
| A18 | Grep/agentic search boven embeddings-index voor code; Qdrant alleen voor businesskennis | Claude Code ("search, don't index") | Kennislaag |
| A19 | Approval-modes / progressieve autonomie per risicoklasse | Codex/Claude Code | Autonomieladder §22 |
| A20 | Event-sourced task-log (append-only) als replay-/debugbron | OpenHands | Data plane §15 |


<!-- ======== BESTAND: 03-pattern-cards.md ======== -->

# 5. Pattern Extraction Cards

> Onderdeel van [Motor AI 2.2](README.md). Structuur per kaart: Probleem · Gebruikt door · Structuur · Waarom het werkt · Wanneer toepassen · Wanneer niet · Failure modes · Motor AI-adoptie · Benodigde afwijking · Bewijs.
> Adoptiestatussen: **Adopt as-is · Configure · Wrap · Extend · Reject · Defer**

---

## PC-01 — Sandbox-per-taak (geïsoleerde omgeving)

- **Probleem:** Agents die code/tools uitvoeren mogen productie, elkaars werk en secrets niet raken; exfiltratie moet technisch onmogelijk zijn.
- **Gebruikt door:** Codex (container per taak, two-phase: setup mét internet/secrets → agentfase zónder, domain-allowlist + HTTP-method-restricties), Devin (snapshot-VM per sessie), OpenHands (action-execution-server in container), Manus (VM per sessie, E3).
- **Structuur:** Per taak een verse container/worktree; dependencies in een setup-fase; agentfase krijgt geen secrets en geen ongefilterd internet; resultaten verlaten de sandbox alleen via een gecontroleerd kanaal (PR, artifact).
- **Waarom het werkt:** Blast radius per taak; prompt-injectie kan hooguit de sandbox besmetten; parallelle taken interfereren niet.
- **Wanneer toepassen:** Alle code-executie, browser-automation, alles met schrijfrechten.
- **Wanneer niet:** Pure read-only Q&A op reeds geautoriseerde data (overhead zonder winst).
- **Failure modes:** Sandbox-escape via gemounte volumes; secrets die tóch in de agentfase lekken; images die verouderen (Devin lost dit met snapshots + maintenance-script).
- **Motor AI-adoptie:** **Adopt (vereenvoudigd).** Docker per taak op NUC/Hetzner; OpenHands-runtime als kandidaat-implementatie (Incubation).
- **Benodigde afwijking:** Geen eigen image-bouwdienst; één gestandaardiseerd base-image per taaktype (code / browser / data), handmatig beheerd.
- **Bewijs:** openai.com/index/introducing-codex (2025-05-16); developers.openai.com/codex/cloud/environments; docs.devin.ai/product-guides/snapshots; OpenHands ICLR 2025-paper. E2/E4.

## PC-02 — AGENTS.md als kaart + docs als system of record

- **Probleem:** Monolithische instructiefiles verdringen taakcontext, rotten en zijn niet mechanisch valideerbaar; kennis buiten de repo bestaat voor agents niet.
- **Gebruikt door:** Codex (AGENTS.md ±100 regels; `docs/design-docs`, `exec-plans/active|completed`, `generated/`, `references/`), Claude Code (CLAUDE.md kort houden, `@imports`), Devin (Knowledge + wiki), agents.md-spec (Linux Foundation, 20+ tools).
- **Structuur:** Kleine entrypoint-file = inhoudsopgave; per onderwerp aparte docs met eigenaar en freshness-metadata; exec-plans zijn versioned artifacts; CI valideert links/staleness; een periodieke doc-gardening-taak opent fix-PR's.
- **Waarom het werkt:** Progressive disclosure houdt het contextvenster voor de taak vrij; "closest file wins"-precedentie schaalt naar monorepos; mechanische checks maken documentatie afdwingbaar in plaats van adviserend.
- **Wanneer toepassen:** Altijd; het is de kennislaag.
- **Wanneer niet:** N.v.t. — wel: geen encyclopedie in het entrypoint proppen.
- **Failure modes:** Kaart verwijst naar dode docs (→ linkcheck in CI); niemand is eigenaar (→ eigenaar per doc verplicht); "when everything is important, nothing is".
- **Motor AI-adoptie:** **Adopt as-is.** Zie [§20](05-target-architecture.md#20-knowledge--en-repositorystructuur).
- **Benodigde afwijking:** Motor AI voegt `tenant-specs/` en `playbooks/` toe (business-taken, niet alleen code) en tweetaligheid (NL voor business-docs, EN voor code-docs).
- **Bewijs:** openai.com/index/harness-engineering (2026-02-11); agents.md; code.claude.com/docs/en/best-practices. E2 + E1 (conventie).

## PC-03 — Playbook (Devin-format)

- **Probleem:** Terugkerende taken krijgen telkens andere instructies → inconsistente uitkomsten; kennis over "hoe wij dit doen" zit in hoofden.
- **Gebruikt door:** Devin (Playbooks, `!macros`, label-triggered automations); analoog: OpenHands microagents, Claude Code skills.
- **Structuur:** Eén document per terugkerende taak met: **gewenste outcome · benodigde input · procedure (imperatief, MECE) · specifications/postconditions · advice (priors corrigeren) · forbidden actions · foutafhandeling · approvalmomenten · bewijsvereisten.** Versiebeheerd; iteratief aangescherpt na elke failure.
- **Waarom het werkt:** Het is een custom system prompt met de structuur van een SOP: postconditions maken "klaar" toetsbaar, forbidden actions begrenzen de risicoruimte, en versiebeheer maakt verbetering cumulatief.
- **Wanneer toepassen:** Elke taak die ≥3× voorkomt of tenant-overdraagbaar moet worden.
- **Wanneer niet:** Eenmalige exploratieve taken (dan volstaat een goede intake).
- **Failure modes:** Playbook-drift (procedure klopt niet meer met systeem — → regressietest per versie); te generiek (→ per tenant een Recipe-laag eroverheen).
- **Motor AI-adoptie:** **Adopt as-is** als markdown-schema; **Extend** met tenant-scoping en versiepromotie (draft → tested → production → tenant-shared).
- **Benodigde afwijking:** Motor AI-Playbooks gelden ook voor niet-code-werk (brief, boekhouding, content) — bewijsvereisten worden dan output-artifacts + bronvermelding i.p.v. tests.
- **Bewijs:** docs.devin.ai/product-guides/creating-playbooks; cognition.ai/blog/how-cognition-uses-devin-to-build-devin (2026-02-27). E2.

## PC-04 — Long-running harness (initializer + increment + feature list)

- **Probleem:** Lange taken falen op twee manieren: te veel in één sessie (context op, kapotte staat achtergelaten) en "premature victory" (latere sessie ziet vooruitgang en verklaart het af).
- **Gebruikt door:** Anthropic (autonomous-coding quickstart), Codex (exec-plans + worktrees), Devin (sessies ≤ ~90 min equivalent).
- **Structuur:** Sessie 1 (initializer): `init.sh`, `feature_list.json` (alle acceptatiecriteria, `passes:false`), `progress.txt`, git-commit. Elke volgende sessie: oriënteer (git log + progress) → smoke-test éérst → kies één hoogst-geprioriteerd falend item → implementeer → self-test → schone staat → commit + progress-update. Alleen `passes` false→true mag; items verwijderen is verboden.
- **Waarom het werkt:** De feature-list is een extern, niet-onderhandelbaar contract dat "klaar" definieert; JSON wordt door modellen minder herschreven dan proza; git+progress geven complementaire recovery-informatie (diffs + intentie).
- **Wanneer toepassen:** Alles wat niet in één sessie past: software-bouw, migraties, grote research, tenant-onboarding.
- **Wanneer niet:** Taken < 1 sessie (overhead).
- **Failure modes:** Smoke-test overgeslagen → bouwt op kapotte staat; feature-list te vaag → schijn-groen (→ elk item heeft concrete stappen); progress-file wordt roman (→ max lengte).
- **Motor AI-adoptie:** **Adopt as-is**, gegeneraliseerd naar niet-code-taken (checklist-JSON i.p.v. feature-list).
- **Benodigde afwijking:** Checkpoints voor business-taken landen in de task-event-log (Postgres) i.p.v. alleen git.
- **Bewijs:** anthropic.com/engineering/effective-harnesses-for-long-running-agents (2025-11-26) + open-source prompts (claude-quickstarts). E2/E4.

## PC-05 — Context engineering (Manus-zesluik)

- **Probleem:** Agentloops zijn ~100:1 prefill:decode; ongedisciplineerde context maakt taken traag, duur en onbetrouwbaar.
- **Gebruikt door:** Manus; onderdelen onafhankelijk herbevestigd door Claude Code (compaction), Cognition (compressor-model), OpenHands (condensers).
- **Structuur:** (1) KV-cache: stabiele prompt-prefix, append-only, deterministische serialisatie, geen timestamps; (2) tools maskeren i.p.v. verwijderen, naamprefixen per familie; (3) filesystem als extern geheugen, compressie altijd herstelbaar (URL/pad blijft); (4) recitation: todo.md telkens herschrijven; (5) fouten in context laten staan; (6) gecontroleerde variatie tegen few-shot-rut.
- **Waarom het werkt:** Cache-hit is 10× goedkoper dan uncached input (verifieerbare pricing); recente tokens krijgen de meeste aandacht (lost-in-the-middle); zichtbare fouten verschuiven priors weg van mislukte acties.
- **Wanneer toepassen:** In elke harness, vanaf dag één.
- **Wanneer niet:** N.v.t.; wel: masking vereist inference-API-steun (prefill/constrained decoding) — anders alleen de naamgevings- en policy-kant.
- **Failure modes:** Eén dynamisch element vooraan de prompt (datum, usage-teller) sloopt de hele cache; agressieve compressie gooit de observatie weg die stap 10 later nodig is.
- **Motor AI-adoptie:** **Adopt as-is** (1,3,4,5,6); **Configure** (2: prefixen + gateway-side filtering; logit-masking alleen waar LiteLLM/provider het ondersteunt).
- **Benodigde afwijking:** Geen — dit is pure discipline.
- **Bewijs:** manus.im blog "Context Engineering for AI Agents" (2025-07-18). E3 met onafhankelijk verifieerbare mechanismen.

## PC-06 — Workflow eerst, agent daarna (Anthropic-taxonomie)

- **Probleem:** Teams grijpen naar autonome agents/multi-agent waar een deterministische workflow goedkoper, sneller en betrouwbaarder is.
- **Gebruikt door:** Anthropic (Building Effective Agents), Cognition (single-threaded default), industrie-brede consensus 2025–2026.
- **Structuur:** Ladder: één LLM-call+retrieval → prompt chaining → routing → parallelization → orchestrator-worker → evaluator-optimizer → pas dán een autonome agent (loop met tools + environment-feedback + stopconditie).
- **Waarom het werkt:** Voorspelbaarheid en reproduceerbaarheid zijn gratis bij vaste code-paden; agent-vrijheid koopt flexibiliteit tegen kosten en compounding errors.
- **Wanneer toepassen:** Bij ieder ontwerp; de beslisboom in [§19](05-target-architecture.md#19-multi-agent-beslisboom) is bindend.
- **Wanneer niet:** —
- **Failure modes:** "Agent-washing": een workflow verkleed als agent → onnodige variantie; of andersom een rigide workflow voor een taak vol ambiguïteit → eindeloos patchen.
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Geen.
- **Bewijs:** anthropic.com/engineering/building-effective-agents (2024-12-19) + open cookbook. E2/E4.

## PC-07 — Orchestrator-worker research (parallelle subagents, begrensd)

- **Probleem:** Breadth-first onderzoek past niet in één contextvenster; een lineaire pipeline kan geen leads volgen.
- **Gebruikt door:** Anthropic Research (lead + 3–5 subagents + CitationAgent), DeerFlow (coordinator/planner/researchers/reporter + plan-approval), Manus Wide Research (subagents zonder onderling contact).
- **Structuur:** Lead bewaart plan extern (memory/file), spawnt subagents met elk: objectief, outputformat, toolbegrenzing, taakgrens; subagents comprimeren bevindingen en schrijven naar filesystem (referenties i.p.v. volle inhoud terug); lead synthetiseert; aparte citatie-/critic-stap.
- **Waarom het werkt:** Tokenbudget over gescheiden contextvensters is de dominante prestatiefactor (Anthropic: tokengebruik verklaarde 80% van variantie); geen peer-to-peer-communicatie = geen conflicterende impliciete beslissingen (Cognition-kritiek ondervangen).
- **Wanneer toepassen:** Onafhankelijke richtingen, brede vergelijkingen, hoge waarde per resultaat.
- **Wanneer niet:** Coding en alles met gedeelde context/afhankelijkheden (Anthropic zelf: slecht parallelliseerbaar); lage-waarde-taken (~15× tokens).
- **Failure modes:** Vage delegatie → dubbel/verkeerd werk (→ verplichte taakspecificatie); kosten-explosie (→ budget-cap per run, effort-scaling-regels: simpel=1 agent/3–10 calls).
- **Motor AI-adoptie:** **Configure**, alléén in de research-lifecycle, met verplichte multi-agent-rechtvaardiging per [§19](05-target-architecture.md#19-multi-agent-beslisboom).
- **Benodigde afwijking:** Harde EUR-cap per research-run in de Policy Gateway.
- **Bewijs:** anthropic.com/engineering/multi-agent-research-system (2025-06-13); cognition.ai/blog/dont-build-multi-agents (2025-06); manus.im Wide Research (2025-07-31). E2/E3.

## PC-08 — Deterministische policy-hooks (Action Gateway-kern)

- **Probleem:** Promptinstructies zijn adviserend; een model kán ze negeren. Risicovolle acties vereisen technische, niet-omzeilbare grenzen.
- **Gebruikt door:** Claude Code (PreToolUse-hook, exit 2 = harde block; Stop-hooks die beurt niet laten eindigen tot verificatie slaagt), SWE-agent (lint-gate weigert invalide edits), Codex (sandbox + allowlist buiten het model om).
- **Structuur:** Elke toolcall passeert vóór uitvoering een policy-evaluatie buiten het model: allow / deny / require-approval, op basis van (tool, argumenten, tenant, risicoklasse, budgetstand, autonomieniveau). Denials injecteren een remediation-boodschap terug in de context (Codex-lint-truc).
- **Waarom het werkt:** De enforcementlaag draait in de harness, niet in het model — prompt-injectie of model-drift kan er niet omheen.
- **Wanneer toepassen:** Elke side-effect-tool: betalingen, mail, publiceren, deletes, deploys, externe API's.
- **Wanneer niet:** Read-only tools binnen reeds geautoriseerde scope (alleen loggen).
- **Failure modes:** Policy-set raakt verouderd (→ policies versioned in git, getest); te grofmazig → alles vraagt approval → alert fatigue (→ risicoklassen + autonomieladder).
- **Motor AI-adoptie:** **Adopt patroon / Wrap implementatie** — dit is de Motor Action Gateway ([§22](05-target-architecture.md#22-permission--en-action-gateway-structuur)); No-Invention Gate NIG-1 in [hoofdstuk 13](04-fit-gap-en-adoptieladder.md).
- **Benodigde afwijking:** Tenant-dimensie en EUR-budgetten toevoegen (bestaat in geen enkel role-model kant-en-klaar).
- **Bewijs:** code.claude.com/docs (hooks); SWE-agent NeurIPS 2024-ablaties (lint-gate = grootste enkele win). E1/E2/E4.

## PC-09 — Durable HITL (approval als workflow-state)

- **Probleem:** Menselijke goedkeuring duurt uren/dagen; de wachtende taak moet crashes, redeploys en reboots overleven en kunnen herinneren/escaleren.
- **Gebruikt door:** Inngest (`step.waitForEvent` + CEL + timeouts), DBOS (`send/recv` exactly-once + agent-inbox-referentie-app), Temporal (signals/updates), Restate (awakeables), Conductor (Human task).
- **Structuur:** Approval = een durable wait-step in de workflow; de UI/Telegram-actie stuurt een event; timeout-tak stuurt reminder of escaleert; beslissing + beslisser + tijdstip worden audit-events.
- **Waarom het werkt:** State leeft in de engine/Postgres, niet in een proces; exact-één-keer-semantiek voorkomt dubbele uitvoering na dubbele klik.
- **Wanneer toepassen:** Alle risicoklasse-R2+-acties; plan-approvals; publish/deploy-momenten.
- **Wanneer niet:** R0/R1 (lage-risico) — daar volstaat logging (anders alert fatigue).
- **Failure modes:** Race: event vóór de wait geregistreerd (Inngest-caveat — → event-lookback of idempotente re-check); approvals versnipperd over kanalen zonder één state-eigenaar (huidige situatie!).
- **Motor AI-adoptie:** **Configure** via de canonieke engine; Telegram/UI worden dunne event-emitters.
- **Benodigde afwijking:** Geen.
- **Bewijs:** inngest.com/docs/ai-patterns/human-in-the-loop; docs.dbos.dev/ai/hitl. E2/E4.

## PC-10 — Bewijsplicht (evidence-before-done)

- **Probleem:** Agents rapporteren "klaar" zonder dat het waar is; mensen kunnen niet elke regel nalopen.
- **Gebruikt door:** Codex (citatiesyntax voor terminal-/testoutput, verplicht bij claims), Anthropic (self-verification als eindgebruiker, screenshots; "evidence, not assertions"), Devin (verificatiemechanisme verplicht per taak; CI groen).
- **Structuur:** Iedere statusovergang naar "done" vereist machineverifieerbaar bewijs: testoutput, exit codes, screenshots, brongelinkte cijfers. Het bewijs is een artifact in de evidence plane, gelinkt aan taak-ID.
- **Waarom het werkt:** Het verplaatst vertrouwen van de bewering naar het artefact; reviewers beoordelen outcome + bewijs i.p.v. proces.
- **Wanneer toepassen:** Elke taak; de vorm van bewijs verschilt per taaktype (tests voor code; bronnen + queries voor analyses; before/after voor content).
- **Wanneer niet:** —
- **Failure modes:** Schijnbewijs (test die niets test) — → adversarial review + evals; bewijs zonder retentiebeleid → storage-groei (→ object storage + retentie).
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Bewijstypes voor business-taken definiëren (bronverwijzing met datum, query + resultaat-hash).
- **Bewijs:** Codex system message (gepubliceerd, 2025-05-16); anthropic long-running post (2025-11-26); docs.devin.ai. E2.

## PC-11 — Session Insights / skill-kristallisatie

- **Probleem:** Lessen uit sessies verdampen; dezelfde fouten worden herhaald; goede werkwijzen worden niet herbruikbaar.
- **Gebruikt door:** Devin (automatische sessie-analyse, verbeterde prompt, Knowledge-suggesties, Useful/Misleading-classificatie van gebruikte kennis), Hermes (agent schrijft SKILL.md na complexe taak, mens reviewt).
- **Structuur:** Na iedere afgeronde taak: geautomatiseerde postmortem (wat ging mis, welke kennis hielp/misleidde, efficiëntie) → concrete verbetervoorstellen: prompt-rewrite, Knowledge-item-kandidaat (mét trigger-descriptie), of Playbook-wijziging → menselijke review → versioneren.
- **Waarom het werkt:** Het sluit de leerloop zonder fine-tuning; trigger-descripties zorgen dat kennis alleen geladen wordt wanneer relevant (context-hygiëne).
- **Wanneer toepassen:** Elke productietaak; verplicht bij Playbook-runs.
- **Wanneer niet:** Triviale taken (alleen tellen, niet analyseren).
- **Failure modes:** Ongereviewde auto-kennis vervuilt de knowledge base (→ mens keurt); knowledge-items zonder trigger → alles wordt altijd geladen.
- **Motor AI-adoptie:** **Adopt patroon / Configure** (LLM-postmortem-stap in de task lifecycle + review-queue in Motor UI).
- **Benodigde afwijking:** Tenant-scoping: geleerde kennis mag niet zomaar cross-tenant lekken.
- **Bewijs:** docs.devin.ai/product-guides/session-insights + knowledge; Hermes-docs. E2/E4.

## PC-12 — Kanaal-gateway met secure-by-default (OpenClaw-les)

- **Probleem:** Eén assistent bereikbaar via Telegram/WhatsApp/web vereist een gateway — en die gateway is de facto een remote shell op je systemen.
- **Gebruikt door:** OpenClaw (typed WS-gateway, device pairing, channel bridges, skills), Hermes (gateway + zes terminal-backends), Devin (Slack/Linear/Jira).
- **Structuur:** Eén gateway-daemon met: loopback-bind default, verplichte token-auth vanaf first launch, WS-origin-validatie, device-pairing met approval, capabilities per device, en een kill-switch. Skills/plugins alleen uit een gescreende, gesigneerde bron.
- **Waarom het werkt / faalt:** Het patroon zelf is sterk (één normalisatielaag voor alle kanalen); de 2026-incidenten bewijzen dat de defaults het verschil maken: 40k+ exposed instances (93% zonder auth), one-click RCE, ~800 malicious skills in de registry.
- **Wanneer toepassen:** Motor AI gebruikt OpenClaw al → hardening is verplicht, nu.
- **Wanneer niet:** Nooit publiek exposen; nooit community-skills auto-installeren.
- **Failure modes:** Reverse proxy die localhost-trust breekt ("ClawJacked"); token-lek via UI; supply-chain via skills.
- **Motor AI-adoptie:** **Configure + Wrap**: OpenClaw hardenen (versie ≥ 2026.2.12-klasse fixes, auth aan, loopback + Tailscale-only, skills-allowlist in git) en alle side-effect-tools door de Motor Action Gateway laten lopen i.p.v. rechtstreeks.
- **Benodigde afwijking:** OpenClaw wordt kanaal+harness in de execution plane; het mag nooit state-eigenaar of policy-eigenaar zijn.
- **Bewijs:** CVE-2026-25253; Censys/Bitsight/SecurityScorecard-scans (jan–feb 2026); Koi Security ClawHavoc (2026-02). E1.

## PC-13 — Repo-local model-agnostische model-gateway

- **Probleem:** Hardcoded modelstrings verspreid door de codebase; geen failover, geen kosten-attributie, geen tenant-budget.
- **Gebruikt door:** OpenHands (LiteLLM), Motor-masterplan (LiteLLM gepland), Manus (model-agnostisch harness als expliciete strategie: "the boat, not the pillar").
- **Structuur:** Eén proxy (LiteLLM) met named routes per taaktype (`chat.fast`, `code.strong`, `research.search`, `embed`), budget/rate-limits per key/tenant, logging naar Langfuse + usage-tabel; applicatiecode kent alleen route-namen.
- **Waarom het werkt:** Modelwissel = configwijziging; kosten worden meetbaar per taak/tenant; benchmark-gedreven routing wordt mogelijk.
- **Wanneer toepassen:** Al het LLM-verkeer, ook OpenClaw en (zolang aanwezig) Dify.
- **Wanneer niet:** —
- **Failure modes:** Proxy als single point of failure (→ health-check + directe fallbackroute gedocumenteerd); "route-sprawl" (→ max ~8 named routes).
- **Motor AI-adoptie:** **Configure** (al gepland; dit document voegt route-namen, budget-enforcement en tenant-keys toe).
- **Benodigde afwijking:** Geen.
- **Bewijs:** LiteLLM E4/E5; OpenHands SDK-docs E4.

## PC-14 — Evals: klein beginnen, LLM-as-judge, end-state

- **Probleem:** Zonder evals is elke prompt-/model-/Playbook-wijziging een gok; regressies blijven onzichtbaar tot een klant ze ziet.
- **Gebruikt door:** Anthropic (start met ~20 echte queries; één judge-rubric 0–1 + pass/fail; end-state-evaluatie voor state-muterende agents; menselijke steekproeven ernaast), Youtu-Agent (eval-harnesspatroon: data/processing/judging), Devin (verificatie per taak).
- **Structuur:** Per Playbook/taaktype een kleine, echte queryset; judge beoordeelt output tegen rubric (accuraatheid, bronnen, volledigheid, kosten-efficiëntie); voor taken met side effects wordt de eindtoestand gecheckt, niet het pad; eval-run is releasegate voor Playbook-promotie en modelwissel.
- **Waarom het werkt:** 20 echte cases vangen de meeste regressies; end-state-evaluatie tolereert legitieme padvariatie van agents.
- **Wanneer toepassen:** Vóór iedere promotie (Playbook-versie, modelwissel, promptwijziging in Production Core).
- **Wanneer niet:** Watchlist-experimenten (daar is falen goedkoop).
- **Failure modes:** Judge-bias (→ periodieke menselijke kalibratie); eval-set veroudert (→ elk incident wordt een eval-case).
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Geen.
- **Bewijs:** anthropic.com/engineering/multi-agent-research-system (2025-06-13). E2.

## PC-15 — Eén canonieke waarheid + transactional outbox

- **Probleem:** Dashboards, boards en harnesses worden ongemerkt tweede state-eigenaren; kopieën lopen uit sync (Motor AI heeft dit vandaag: ≥6 stores).
- **Gebruikt door:** OpenHands (append-only event log = enige waarheid; alles verder read-only observer); ADR-002 (PG = SSOT); industrie (outbox-patroon).
- **Structuur:** Per informatiesoort exact één eigenaar ([§16](05-target-architecture.md#16-source-of-truth-matrix)); afgeleide views zijn expliciet read-only; wijzigingen die derden moeten zien gaan via events uit een transactional outbox in dezelfde PG-transactie.
- **Waarom het werkt:** Er is altijd één plek om te herstellen, te auditen en te migreren; outbox garandeert dat event en state nooit uiteenlopen.
- **Wanneer toepassen:** Alle state; met name task-, approval- en audit-state.
- **Wanneer niet:** —
- **Failure modes:** "Tijdelijke" cache wordt stille eigenaar (→ elk nieuw opslagpunt vereist een regel in de SoT-matrix); outbox-consumer loopt achter (→ monitoring op lag).
- **Motor AI-adoptie:** **Adopt as-is**; consolidatie van de zes bestaande stores is Golf 1-werk.
- **Benodigde afwijking:** Geen.
- **Bewijs:** OpenHands ICLR 2025 (E1/E4); outbox = industriestandaard (E1).

## PC-16 — Progressieve autonomie (approval-modes per risicoklasse)

- **Probleem:** "Alles handmatig goedkeuren" schaalt niet; "alles autonoom" is onverantwoord. Vertrouwen moet meetbaar en omkeerbaar groeien.
- **Gebruikt door:** Claude Code (permission modes: read-only → ask → auto binnen sandbox), Codex (approval modes + sandbox-gradaties), Devin (confidence-labels op reviews).
- **Structuur:** Autonomieniveaus per Playbook × tenant: A0 mens doet het met AI-hulp → A1 agent stelt voor, mens keurt alles → A2 agent voert uit, mens keurt side-effects → A3 agent autonoom binnen budget/policy, mens reviewt steekproef + outcome. Promotie/degradatie op basis van gemeten task-success en correctieratio (uit evals + postmortems).
- **Waarom het werkt:** Autonomie wordt een gemeten eigenschap per werksoort in plaats van een geloofsartikel.
- **Wanneer toepassen:** Iedere Playbook krijgt een expliciet autonomieniveau; default A1.
- **Wanneer niet:** —
- **Failure modes:** Niveau verhoogd zonder bewijsperiode (→ minimale bewijsperiode per promotie, zie [§35](09-definition-of-done-11-10.md)); degradatie vergeten na incident (→ automatische degradatie bij incident-severity ≥ hoog).
- **Motor AI-adoptie:** **Adopt patroon**, geïmplementeerd in de Policy Gateway.
- **Benodigde afwijking:** Tenant-dimensie.
- **Bewijs:** Codex/Claude Code docs (E2); Devin docs (E2).


<!-- ======== BESTAND: 04-fit-gap-en-adoptieladder.md ======== -->

# 9–13. Fit-gap-analyse · Niet zelf bouwen · Dunne adapters · Custom kandidaten · No-Invention Gates

> Onderdeel van [Motor AI 2.2](README.md). Adoptieladder: **1 Adopt → 2 Configure → 3 Wrap → 4 Extend → 5 Build.**

---

## 9. Fit-gap-analyse

Per Motor AI-behoefte: welk bestaand patroon/product dekt het, wat is de gap, en op welke sport van de adoptieladder komt het terecht.

| Behoefte | Bestaande dekking | Gap | Ladder-sport |
|---|---|---|---|
| Durable workflow-engine | Inngest (gepland) / DBOS (challenger) — beide dekken retries, timers, HITL, crash recovery, idempotency op 16 GB | Keuze nog niet gevalideerd met spike; self-host Inngest-dashboard zonder auth | **Configure** (ADR-101) |
| Task lifecycle | Devin-delegatie + Codex-board + Anthropic-verificatie dekken alle fasen | Niemand levert de lifecycle als product; het is compositie in eigen platform | **Configure/Wrap** (dunne statusmachine over engine) |
| Long-running taken | Anthropic-harnas volledig gedocumenteerd + OSS-prompts | Generalisatie naar niet-code-taken (checklists i.p.v. feature lists) | **Adopt + Extend (klein)** |
| Agent-harness (CEO/chat) | OpenClaw als kanaal/loop; Manus-lessen als discipline; Claude Code-patronen | Geen policy-integratie; OpenClaw mag geen state/policy-eigenaar zijn | **Configure (hardening) + Wrap (gateway ervoor)** |
| Code-agent | Claude Code / Codex CLI / OpenHands bestaan; masterplan item 7 ("multi-file repo-agent ❌") | Integratie met Motor-taken en sandbox; geen eigen harness bouwen | **Configure** (bestaande coding-CLI in sandbox draaien via task-runner) |
| Sandboxing | OpenHands-runtime (E4), docker-exec-patroon (E4) | Base-images en netwerk-policy voor eigen infra | **Configure** |
| Kennisstructuur | agents.md-conventie + Codex-docs-structuur | Consolidatie van 4 documentbomen; freshness-CI bestaat niet kant-en-klaar maar is triviaal (linkcheck + datum-lint) | **Adopt + Configure** |
| Recipes/Playbooks/Skills | Devin-formats volledig gedocumenteerd | Registry met tenant-scoping en promotie; bestaat nergens als OSS-product | **Adopt format + Extend (registry in eigen PG, dun)** |
| Policy / Action Gateway | Hooks-patroon (Claude Code), sandbox-allowlists (Codex), OPA/Cedar als policy-engines (E1) | Samenhangend product "tenant-bewuste agent-action-gateway met EUR-budgetten" bestaat niet | **Wrap/Extend** — NIG-1 hieronder |
| HITL-approvals | Engine-primitief + bestaande cowork-inbox/Telegram | Consolidatie naar één approval-state-eigenaar | **Configure** |
| Multi-tenancy | PG RLS + Qdrant payload (gepland) | Isolation-evals; tenant-scoped secrets; tenant-budgetten | **Configure + Extend (evals)** |
| Modelrouting | LiteLLM (gepland) | Named routes, budget-enforcement, tenant-keys | **Configure** |
| Observability | Langfuse (gepland) + PG task-event-log | Koppeling trace↔taak↔approval↔bewijs (correlatie-ID) | **Configure** |
| Evals | Anthropic-methode + Langfuse-scores / promptfoo-klasse tooling (E4) | Eval-sets zelf vullen (~20 echte queries per Playbook) | **Adopt methode + Configure tooling** |
| Memory (vector/graph) | Qdrant (staat er al); PG FTS (Hermes-patroon) | Graph-reasoning: **geen aangetoonde taak die het rechtvaardigt** → geen Cognee/LightRAG nu | **Adopt (Qdrant) · Defer (graph)** |
| Mobile command center | motorsai.app + Telegram-bridge | Approvals/status als events uit de engine i.p.v. eigen state | **Configure** |
| Incident recovery | Engine-recovery + runbooks-patroon | Agent-laag-runbooks schrijven; restore-tests inplannen | **Adopt discipline** |
| Productization | White-label runbook bestaat | Playbook-hergebruik cross-tenant met versiepromotie | **Extend (klein)** |

**Samenvattend:** 0 componenten op sport 5 (Build). Drie kandidaten op sport 3–4 (Wrap/Extend) doorlopen de No-Invention Gate in §13.

---

## 10. Onderdelen die Motor AI níet zelf moet bouwen

1. **Workflow-/durable-engine** — bestaat 5× beter dan zelfbouw (Inngest/DBOS/Temporal/Restate/Hatchet). Zelfbouw op cron+queue = gegarandeerde dataverlies-bugs.
2. **Model-gateway** — LiteLLM.
3. **LLM-tracing** — Langfuse.
4. **Vector-store** — Qdrant (staat er al). Geen tweede memory-laag (LightRAG/Cognee/graph) zonder aangetoonde taak — beslisregel uit §17 van de opdracht: eerst de vraag "welke concrete taak rechtvaardigt de laag?".
5. **Coding-harness** — Claude Code/Codex CLI/OpenHands; wij leveren alleen sandbox + AGENTS.md + checks.
6. **Sandbox-runtime** — OpenHands-runtime of kale docker-exec; geen eigen executor-daemon (de bestaande `local-executor`/PC-bridge blijft dunne glue, geen platform).
7. **Kanaal-bridges** — Telegram via bestaande bridge/OpenClaw; nooit zelf WhatsApp reverse-engineeren (Baileys-risico's zijn bekend).
8. **Auth/identity** — bestaande session-auth + PG RLS; geen eigen IdP. Bij teamgroei: standaard OIDC-product (Keycloak/Auth.js), geen maatwerk.
9. **Policy-taal** — als policies complexer worden dan tabel+code: OPA of Cedar adopteren, geen eigen DSL.
10. **Visual workflow-builder** — niet bouwen, niet uitbreiden in Dify; het is een andere productcategorie (Coze-les).
11. **Eigen embeddings/finetunes** — model-agnostisch blijven (Manus-strategie: "the boat, not the pillar").
12. **Documentatie-portal** — git + markdown + CI-checks; geen wiki-product.

## 11. Onderdelen waarvoor een dunne adapter voldoende is

| Adapter | Wat het doet | Dikte |
|---|---|---|
| **Task-API ↔ engine** | Motor UI/Telegram maken taken; adapter vertaalt naar engine-runs en leest status terug | ~1 module; geen eigen state behalve de task-tabel (SSOT) |
| **Approval-emitter** | Telegram/UI-knop → engine-event; reminder/escalatie-takken in de workflow zelf | ~1 webhook + 1 event-schema |
| **OpenClaw-toolproxy** | OpenClaw-tools met side effects wijzen naar Motor Action Gateway-endpoints i.p.v. direct op systemen | Config + kleine HTTP-shim |
| **n8n-bridge** | Bestaande n8n-flows blijven; engine roept n8n-webhooks aan als *stap* (nooit andersom als state-eigenaar) | Bestaat deels al (inngest-n8n-bridge.md) |
| **Evidence-uploader** | Testoutput/screenshots/bronnen → object storage + verwijzing in task-event-log | ~1 helper |
| **LiteLLM named-routes** | Route-namen + budget-keys per tenant | Configuratie |
| **Doc-freshness-CI** | Linkcheck + "reviewed-by/date"-lint + stale-detectie op `docs/` | ~1 CI-job |
| **Session-postmortem-stap** | LLM-analyse van afgeronde taak → verbetervoorstel in review-queue | ~1 workflow-stap + 1 tabel |
| **Qdrant-tenant-guard** | Verplichte payload-filter injectie op elke search (geen query zonder workspace_id) | ~1 wrapper om de client |

## 12. Onderdelen die mogelijk custom moeten worden gebouwd

Slechts drie, allemaal "Extend"-klasse (dun, op bestaande fundamenten):

1. **Motor Action Gateway** — tenant-bewuste policy-evaluatie vóór iedere side-effect-toolcall, met risicoklassen, autonomieniveaus en EUR-budgetten. (NIG-1)
2. **Playbook/Skill-registry** — versioned opslag + promotieflow (draft→tested→production→tenant-shared) + koppeling aan evals. (NIG-2)
3. **Task-orchestratielaag ("Motor Kernel")** — de dunne statusmachine die intake→plan→execute→verify→review→approve→learn aan elkaar knoopt bovenop de engine. (NIG-3)

## 13. No-Invention Gate per custom component

### NIG-1 — Motor Action Gateway

1. **Exact probleem:** Geen bestaand product evalueert agent-toolcalls tegen (tenant × risicoklasse × autonomieniveau × EUR-budget) en geeft allow/deny/require-approval met audit-event, vóór uitvoering, over meerdere harnesses (OpenClaw, code-agent, workflows) heen.
2. **Onderzocht:** Claude Code hooks (per-harness, niet tenant-bewust, niet cross-harness); Codex sandbox-allowlists (netwerkniveau, niet actiesemantiek); OPA/Cedar (policy-evaluatie ja, maar geen agent-toolmodel, geen budgetten); LiteLLM budget-limits (alleen LLM-calls, geen tool-acties); Inngest/DBOS (workflow-niveau, niet toolcall-niveau); OpenClaw permissies (per-instance, na 2026-incidenten niet als enige laag te vertrouwen).
3. **Waarom onvoldoende:** Elk dekt één dimensie; niemand dekt de kruising, en niemand is cross-harness.
4. **Configuratie oplosbaar?** Deels: hooks + allowlists dekken ~60%. De tenant/budget/audit-kruising niet.
5. **Dunne adapter oplosbaar?** Ja grotendeels — en zo bouwen we het ook: een HTTP-endpoint (~"policy check") dat elke harness aanroept; beslislogica als tabel + code; **OPA/Cedar wordt geadopteerd zodra policies > ~20 regels**.
6. **Open standaard?** Policy-evaluatie: Cedar/OPA (gepland als groeipad). Toolschema's: MCP/JSON-Schema (adopt).
7. **Onderhoudslast:** ~1 module + policytabellen; getest via policy-evals. Laag.
8. **Eigenaar:** Pietje (tot teamgroei; dan security-rol).
9. **Exitstrategie:** Vervangbaar door OPA/Cedar + per-product-hooks; policies zijn declaratieve data en migreren mee.
10. **Bewijstests:** Isolation-evals (cross-tenant calls → deny), budget-evals (overschrijding → deny), bypass-test (geen enkele harness kan side-effect-tool zonder gateway bereiken — netwerkpolicy).
11. **Bouwer vertrekt?** Runbook + policy-als-data + <500 regels kern; overdraagbaar in een dag.
12. **Decommissioning:** Gateway uit → autonomieniveau overal terug naar A1 (alles handmatig); gedocumenteerd in runbook.

**Status: Approved als Extend** (dunne laag, verplichte OPA/Cedar-adoptie bij groei). ADR-102.

### NIG-2 — Playbook/Skill-registry

1. **Exact probleem:** Versioned, tenant-scoped opslag en promotie van Playbooks/Skills met eval-gating bestaat niet als product (Devin heeft het, maar als gesloten SaaS-onderdeel).
2. **Onderzocht:** Devin Playbooks (gesloten), Claude Code skills / OpenHands microagents (bestandsformaat zonder registry/promotie), ClawHub (registry, maar ongescreend — ClawHavoc-les), promptregistries à la Langfuse prompts (versioning ja, tenant-promotie nee).
3. **Waarom onvoldoende:** Formaat bestaat (adopt), registry-mechaniek met tenant-promotie niet.
4. **Configuratie?** Git + mappenstructuur dekt versioning; promotie-workflow niet.
5. **Dunne adapter?** Ja: **git is de opslag** (playbooks zijn markdown/JSON in `docs/playbooks/`), registry = één PG-tabel met versie→status→tenant-mapping + eval-resultaatverwijzing. Geen eigen opslagformaat.
6. **Open standaard?** Markdown + frontmatter (de-facto skills-standaard 2026), JSON-Schema voor checklists.
7. **Onderhoudslast:** 1 tabel, 1 promotie-workflow, UI-lijstje. Zeer laag.
8. **Eigenaar:** Pietje.
9. **Exitstrategie:** Playbooks zijn platte bestanden in git — leesbaar zonder het systeem.
10. **Bewijstests:** Regressie-eval per versiepromotie; rollback-test (vorige versie activeren < 5 min).
11. **Bouwer vertrekt?** Alles is git + één tabel.
12. **Decommissioning:** Tabel droppen; bestanden blijven bruikbaar als documentatie.

**Status: Approved als Extend.** ADR-103.

### NIG-3 — Motor Kernel (task-orchestratielaag)

1. **Exact probleem:** De task lifecycle (intake→…→learn) moet over engine, harnesses, gateway en UI heen gecoördineerd worden met één task-state-eigenaar.
2. **Onderzocht:** De engine zelf (Inngest/DBOS: runs, geen product-taakbegrip met risicoklasse/approval-semantiek), Linear/Jira (taakbeheer voor mensen, geen agent-lifecycle-hooks — wél als frontend denkbaar), Devin (gesloten), OpenHands Cloud (code-only).
3. **Waarom onvoldoende:** Task-domeinmodel (tenant, risicoklasse, autonomieniveau, bewijs, playbook-versie) is Motor-specifiek per definitie.
4. **Configuratie?** Nee, maar de zware onderdelen (state-machine-runtime, retries, HITL) komen uit de engine.
5. **Dunne adapter?** Ja — de Kernel is tabellen (`tasks`, `task_events`, `approvals`) + workflow-definities in de engine + API-routes in de bestaande Next.js-app. Geen nieuwe service.
6. **Open standaard?** Event-schema volgens CloudEvents-stijl; task-states als klein vocabulaire.
7. **Onderhoudslast:** Laag-middel; het is de kern van het product en hoort bij het team.
8. **Eigenaar:** Pietje.
9. **Exitstrategie:** Task-state is gewone PG-data; workflows zijn code; migratie naar andere engine = workflows herschrijven (bewust klein houden).
10. **Bewijstests:** Crash-recovery-test (kill mid-task → hervat), idempotency-test (dubbele event → één uitvoering), lifecycle-evals.
11. **Bouwer vertrekt?** Runbook + het feit dat 90% engine-primitief is.
12. **Decommissioning:** N.v.t. (kernproduct); wel per-workflow decommissioning-pad.

**Status: Approved als Extend.** ADR-104.

**Alle overige denkbare custom componenten: `Rejected pending evidence`.** Expliciet afgewezen zonder nieuwe gate: eigen memory-layer, eigen agent-framework, eigen workflow-DSL, eigen vector-DB, eigen prompt-language, eigen mobiele app (PWA volstaat), eigen fine-tunes.


<!-- ======== BESTAND: 05-target-architecture.md ======== -->

# 14–24. Definitieve target architecture

> Onderdeel van [Motor AI 2.2](README.md). Iedere component vermeldt zijn adoptieladder-sport en rolmodel-herkomst; volledige traceability in [hoofdstuk 29](07-lifecycle-en-traceability.md).

---

## 14. Definitieve target architecture (overzicht)

```
┌────────────────────────── CONTROL PLANE ──────────────────────────┐
│ Motor Kernel (tasks, lifecycle, risicoklassen)     [Extend]       │
│ Canonieke workflow-engine (Inngest│DBOS, ADR-101)  [Configure]    │
│ Motor Action Gateway (policy, budget, autonomie)   [Extend]       │
│ Playbook/Skill-registry (promotie, versies)        [Extend]       │
│ LiteLLM (modelrouting, named routes, budgetten)    [Configure]    │
│ Identity/session + RLS-context                     [Configure]    │
│ Kill switches (per tenant / per playbook / global) [Adopt]        │
└──────────────┬───────────────────────────────┬───────────────────┘
        alleen API's + events           policy-besluiten
┌──────────────▼──────────── EXECUTION PLANE ───▼───────────────────┐
│ CEO-harness (chat, Manus-discipline)               [Configure]    │
│ OpenClaw gateway — gehardened, kanaal+tools        [Configure]    │
│ Code-agent: bestaande coding-CLI in sandbox        [Configure]    │
│ Sandboxes: docker-per-taak / OpenHands-runtime     [Configure]    │
│ Browser-automation (on-demand container)           [Configure]    │
│ n8n: integratie-adapters als workflow-stap         [Wrap]         │
│ Externe API-adapters (Odoo, Mollie, mail, …)       [Wrap]         │
└──────────────┬────────────────────────────────────────────────────┘
        writes alleen via Kernel-API / outbox-events
┌──────────────▼──────────────── DATA PLANE ────────────────────────┐
│ Postgres (SSOT: tasks, approvals, audit, tenants,  [Adopt]        │
│   playbook-registry, usage, outbox)                               │
│ Qdrant (businesskennis, tenant-payload verplicht)  [Adopt]        │
│ Redis (cache/queue-hulp, nooit SSOT)               [Adopt]        │
│ Object storage (artifacts, bewijs, backups)        [Adopt]        │
│ Secrets management (env→sops/age of Vault-klasse)  [Configure]    │
└──────────────┬────────────────────────────────────────────────────┘
        append-only
┌──────────────▼─────────────── EVIDENCE PLANE ─────────────────────┐
│ Langfuse (LLM-traces)                              [Configure]    │
│ task_events (append-only log, replaybaar)          [Adopt]        │
│ Testoutput/screenshots/bronnen in object storage   [Adopt]        │
│ Eval-resultaten, deploy- en incident-evidence      [Adopt]        │
└───────────────────────────────────────────────────────────────────┘
```

Alles draait op de bestaande NUC + Hetzner-verdeling uit het masterplan; dit document wijzigt de *logische* architectuur, niet de fysieke.

---

## 15. Control plane, execution plane, data plane, evidence plane

### Verantwoordelijkheden

| Plane | Verantwoordelijk voor | Mag nooit |
|---|---|---|
| **Control** | tasks, workflows, planning, policies, approvals, identity, budgets, modelrouting, scheduling, kill switches | zelf zware uitvoering doen; direct in tenant-businessdata schrijven buiten task-context |
| **Execution** | agent harnesses, sandboxes, tool-executie, browser-automation, code-executie, lokale inference-workers, externe API-adapters | eigen persistente state houden (alles ephemeraal of via Kernel-API); side effects zonder Gateway-besluit |
| **Data** | Postgres, Redis, Qdrant, object storage, audit-records, transactional outbox, businessdata, tenantdata | logica bevatten die policy omzeilt |
| **Evidence** | traces, logs, metrics, tests, model-evals, approvals-bewijs, deployment-/incident-/recovery-evidence | herschreven worden (append-only) |

### Toegestane communicatie tussen planes

| Van → naar | Toegestaan | Verboden |
|---|---|---|
| Control → Execution | taak-dispatch met scope, tools, budget, autonomieniveau | — |
| Execution → Control | statusevents, approval-verzoeken, policy-checks (elke side-effect-call) | rechtstreeks approvals afhandelen |
| Execution → Data | alleen via Kernel-API of expliciet gescoped credentials binnen de taak (RLS-context gezet) | raw superuser-verbindingen; cross-tenant queries |
| Control → Data | volledige toegang binnen RLS/service-rollen | — |
| * → Evidence | append | update/delete (behalve retentiebeleid) |
| Evidence → * | read-only (dashboards, evals, postmortems) | evidence als bron van task-state gebruiken |

Herkomst: planes-scheiding is standaard platform-engineering (E1); "execution stateless, alles via events" komt uit OpenHands' event-architectuur en Codex' sandbox-model.

---

## 16. Source-of-Truth Matrix

| Informatie | Canonieke eigenaar | Read replicas/views | Verboden tweede waarheid |
|---|---|---|---|
| Task-state | **Postgres `tasks` (Motor Kernel)** | Motor UI, Telegram-status, dashboards | n8n-runs, Telegram-chatgeschiedenis, EXECUTION_BOARD.db (**decommission**), Dify |
| Workflow-run-state | **Canonieke engine (in PG)** | Engine-dashboard | Eigen cron/queue-tabellen; n8n-executions als waarheid |
| Approval-state | **Postgres `approvals`** (beslist via engine-events) | Telegram, cowork-inbox, mail | Approval "in het geheugen" van een harness; losse Telegram-flags |
| Audit-state | **Postgres `audit_events` + `task_events` (append-only)** | Langfuse-links, rapporten | Logfiles als enige bron |
| Businessdata (omzet, orders, bonnen) | **Bronsysteem per tenant (bijv. Odoo/kassa)**; ge-ingest in PG-schema's per tenant als analytische kopie mét bron+timestamp | Qdrant-embeddings, rapporten | Agent-"geheugen" over cijfers; cijfers zonder bronverwijzing |
| Tenantconfiguratie | **Postgres `workspaces`/`tenants`** | env-templates, UI | Hardcoded fumero/bokas-strings (uitfaseren) |
| Modelregistry & routing | **LiteLLM-config (in git)** | `docs/model-config.md` (gegenereerd) | Hardcoded modelstrings in code |
| Promptversies | **Git (`docs/playbooks/`, harness-code) + registry-tabel** | Langfuse prompt-views | Prompts alleen in Dify/n8n-UI's |
| Skill-/Playbookversies | **Git + PG-registry (status/tenant-mapping)** | UI-catalogus | ClawHub of andere externe registries |
| Documentatie | **Git `docs/` (per doc een eigenaar + review-datum)** | motorsai.app-views | Slack/chat/hoofden; 4 parallelle documentbomen (consolideren) |
| Deployment-state | **Git (tags) + CI + deploy-evidence in evidence plane** | dashboards | "Het draait op de NUC dus het is gedeployed" |
| Secrets | **Secrets-manager (sops/age in git, of Vault-klasse)** | runtime-env-injectie | `.env`-kopieën verspreid over machines; secrets in docs of code |
| Vectorgeheugen | **Qdrant (tenant-payload verplicht)** | — | Chroma (`factory_brains/` — **decommission**); tweede vectorstore |
| Kosten/usage | **Postgres `usage_events` (gevoed door LiteLLM + engine)** | Langfuse-kosten, dashboards | Schattingen in chat |
| Evaluatieresultaten | **PG `eval_runs` + artifacts in object storage** | rapporten | "De demo werkte" |
| Incidentstatus | **Git `docs/incidents/` + PG-incidenttabel** | statuspagina | Alleen chatberichten |

Regel (PC-15): **elk nieuw opslagpunt vereist eerst een regel in deze matrix.** Een dashboard, kanbanbord of harness mag nooit ongemerkt tweede state-eigenaar worden.

---

## 17. Task lifecycle

Adoptie van de kandidaat uit de opdracht, met per fase het rolmodel en de technische drager:

```
Intake            → taak in `tasks` (bron: chat/Telegram/cron/API); Devin-intaketemplate:
                    outcome, context, success criteria, verboden acties     [Devin]
Clarify           → agent stelt gerichte vragen bij ontbrekende input; skip bij Playbook-run
                                                                            [Devin Ask / Claude Code interview]
Scope             → taakgrootte begrensd ("≤3 uur handwerk-equivalent"); groter → long-running lifecycle (§18)
                                                                            [Devin]
Risk classify     → R0 read-only · R1 intern schrijven · R2 extern zichtbaar/geld klein ·
                    R3 geld groot/destructief/juridisch — bepaalt approvals + autonomieplafond
                                                                            [Codex approval-modes, eigen klassen]
Plan              → plan-artifact (exec-plan voor groot werk, inline voor klein)
                                                                            [Claude Code plan mode, Codex exec-plans]
Approve plan      → verplicht bij R2+; durable HITL-wait                    [engine-primitief]
Execute in isolation → sandbox per taak; tools via Action Gateway; Manus-contextdiscipline
                                                                            [Codex/OpenHands/Manus]
Verify            → self-test als eindgebruiker + lint/tests; bewijs-artifacts verplicht
                                                                            [Anthropic self-verify, SWE-agent lint-gate, Codex-citaties]
Adversarial review → verse-context-reviewer (alleen diff/output + criteria) bij R2+ of code
                                                                            [Claude Code]
Human approval    → bij R2+ of autonomieniveau < A3; outcome-review, niet stap-review
                                                                            [Devin/Codex mens-op-outcome]
Publish/merge     → via CI/deploy-pad met evidence                          [software lifecycle §hieronder]
Observe           → traces + usage + end-state-check                        [Langfuse/Anthropic]
Learn             → session-postmortem → verbetervoorstellen in review-queue [Devin Session Insights]
Crystallize       → ≥3× zelfde taak → Playbook-kandidaat; registry-promotie  [Devin Playbooks]
```

**Software lifecycle (specialisatie voor code):** issue/plan → geïsoleerde workspace (worktree/container) → implementatie → deterministische tests → security-checks (dep-audit, secret-scan) → agent-evals waar relevant → adversarial review → PR → mens- of policy-approval → getagd artifact → staging → canary waar mogelijk → productie → monitoring → rollback bij drempeloverschrijding. Voor het 3–4-persoonsteam geldt: staging = tweede compose-stack; canary = tenant-voor-tenant uitrol.

## 18. Long-running task lifecycle

Adopt as-is van het Anthropic-harnas (PC-04), gegeneraliseerd naar alle lange taken:

```
Initialize environment      → init.sh / omgevings-setup; sandbox of werkmap
Create complete inventory   → checklist.json: alle acceptatiecriteria, passes:false
                              (JSON — modellen herschrijven JSON minder snel dan proza)
Select one bounded increment→ hoogst-geprioriteerd falend item, één per sessie
Execute                     → binnen budget en Gateway-policy
Self-test                   → smoke-test EERST bij sessiestart (bestaande breuk vóór nieuw werk),
                              end-to-end-verificatie als gebruiker na de increment
Leave clean state           → geen half werk; documenteer wat open is
Save evidence               → artifacts naar evidence plane
Commit/checkpoint           → git (code) of task-event-checkpoint (business)
Update progress artifact    → progress-notitie: wat, waarom, volgende stap
Continue in fresh session   → nieuwe context leest git log + progress + checklist
```

Verboden (hard, in prompt én policy): checklist-items verwijderen of afzwakken; `passes` van true naar false zonder incident; "klaar" zonder alle items groen.

Toepassing breder dan code: tenant-onboarding, datamigraties, groot onderzoek, contentseries — de checklist bevat dan postconditions per onderdeel i.p.v. tests.

**Research lifecycle** (specialisatie, PC-07): vraagdefinitie → rechtvaardiging parallel onderzoek (anders: één agent) → onafhankelijke richtingen → per worker beperkte scope + verse context + outputformat → bronvermelding verplicht → compressie naar bestanden (referenties, geen volle dumps) → critic-check op tegenspraken/omissies → synthese door lead → citatiecontrole. EUR-cap per run.

**Recurring-task lifecycle** (PC-03/PC-11): succesvolle run → sessie-analyse → correcties extraheren → Playbook-kandidaat bijwerken → regressietest (eval-set) → menselijke review → versioneren → hergebruik over geautoriseerde tenants.

## 19. Multi-agent beslisboom

Bindend bij ieder ontwerp (PC-06/PC-07; Anthropic + Cognition):

```
1. Zijn de stappen vooraf bekend, is compliance/reproduceerbaarheid belangrijk,
   is ambiguïteit laag?
   → DETERMINISTISCHE WORKFLOW (engine-stappen, geen agent)

2. Nodig: dynamische toolkeuze, taak past in één coherent contextgebied,
   parallelisatie levert weinig op?
   → ÉÉN AGENT (single-threaded, volle context — Cognition-default)

3. Taak niet vooraf opdeelbaar, subtaken ontstaan tijdens uitvoering,
   workers hebben verschillende specialisaties nodig?
   → ORCHESTRATOR-WORKER (subagents depth-1, alleen samenvattingen terug)

4. Richtingen onafhankelijk, breadth-first, verse context per richting waardevol,
   ~15× kosten gerechtvaardigd door taakwaarde?
   → PARALLELLE SUBAGENTS (alleen research-klasse; nooit voor coding)

5. Duidelijke kwaliteitscriteria + iteratie geeft meetbare winst?
   → EVALUATOR-OPTIMIZER (generator + judge-loop, max N iteraties)
```

**Verplichte rechtvaardiging per multi-agent-ontwerp** (zonder deze zes: afgewezen):
1. waarom één agent onvoldoende is; 2. verwachte kwaliteitswinst; 3. verwachte kostenstijging; 4. coördinatierisico; 5. stopconditie; 6. fallback naar eenvoudiger structuur.

## 20. Knowledge- en repositorystructuur

Adopt van Codex-harness-structuur (PC-02), met Motor-uitbreidingen (tenants, playbooks, NL/EN):

```
/AGENTS.md                 # ≤100 regels; kaart, geen encyclopedie; verwijst hieronder
/ARCHITECTURE.md           # planes, SoT-matrix-verwijzing, systeemkaart
/SECURITY.md               # threat model-samenvatting, Gateway-regels, incidentproces
/RELIABILITY.md            # RTO/RPO, backup/restore, runbook-index
/QUALITY.md                # evals, releasegates, definition of done
/PRODUCT_SENSE.md          # Bokas/Fumero-productprincipes
/PLANS.md                  # index van actieve exec-plans
/docs/
  /core-beliefs/           # onveranderlijke uitgangspunten (bijv. "één waarheid per informatie")
  /design-decisions/       # ADR's (bestaand DECISIONS.md migreert hierheen)
  /product-specs/          # per product
  /tenant-specs/           # per tenant: Recipe-laag (businesskennis, beslisregels)
  /exec-plans/active/      # levende plannen (versioned artifacts)
  /exec-plans/completed/
  /playbooks/              # Playbook-bestanden (SSOT; registry-tabel verwijst hiernaar)
  /skills/                 # herbruikbare skills (markdown + frontmatter, de-facto standaard)
  /threat-models/
  /runbooks/               # per Production Core-component verplicht
  /incidents/              # postmortems (blameless)
  /evals/                  # eval-sets + rubrics per Playbook/taaktype
  /generated/              # gegenereerde docs (DB-schema, model-config) — nooit handmatig editen
  /references/             # vendored referentiedocs (llms.txt-stijl) van kerndependencies
```

Vereisten (mechanisch afgedwongen via CI): versiebeheer (git), eigenaar + review-datum in frontmatter van elk doc, linkcheck, stale-detectie (>90 dagen zonder review → issue), gegenereerde docs alleen via scripts, progressive disclosure (entrypoints klein). Een periodieke **doc-gardening-taak** (agent) opent fix-PR's — Codex-patroon.

**Wat hoort waar:**

| Opslag | Inhoud |
|---|---|
| **Git** | alle docs hierboven, playbooks, skills, policies, prompts, infra-config, eval-sets |
| **Postgres** | task/approval/audit/usage/tenant/registry-state, analytische kopieën businessdata |
| **Qdrant** | embeddings van tenant-businesskennis (bonnen, reviews, webcontent) — mét workspace-payload; géén code-search (grep wint — Claude Code-les) |
| **Object storage** | bewijs-artifacts, backups, grote outputs |
| **Secrets-manager** | alle credentials; nooit in git/docs/PG |

**Consolidatie-opdracht (Golf 1):** de vier bestaande documentbomen (`/docs`, `/ai-motor/docs`, `/factory-os/docs`, `/kennisbank`) migreren naar deze ene structuur; legacy-generaties (omega/holding/evomap/singularity-docs) naar `docs/references/legacy/` of decommission.

## 21. Recipes, Playbooks, Skills, Workflows, Tools, Policies

Scherpe definities (verwarring voorkomen is het halve werk):

| Begrip | Definitie | Vorm | Versioning |
|---|---|---|---|
| **Recipe** | Businesskennis en beslisregels van één bedrijf/product ("Bokas rekent zo af", "Fumero-toon is …") | `docs/tenant-specs/<tenant>/` markdown | git; review door tenant-owner |
| **Playbook** | Herhaalbare procedure: gewenste uitkomst, benodigde input, stappen, postconditions, verboden acties, foutafhandeling, approvalmomenten, bewijsvereisten | `docs/playbooks/*.md` (Devin-format) + registry-rij | git + registry: draft→tested→production→tenant-shared; rollback = vorige versie activeren |
| **Skill** | Herbruikbare agent-capability die meerdere Playbooks ondersteunt ("factuur-OCR", "SEO-check") | `docs/skills/<naam>/SKILL.md` + evt. scripts | idem; alleen uit eigen repo (nooit externe registries — ClawHavoc-les) |
| **Workflow** | Durable executie van één concrete taakinstantie | code in de canonieke engine | git (code) + engine-runhistorie |
| **Tool** | Technisch uitvoerbare capability met strak JSON-schema, naamprefix per familie (`browser_`, `shell_`, `mail_`, `pay_`) | tool-registry (code) | git; schemawijziging = versie |
| **Policy** | Technisch afdwingbare regel: mag deze actie, onder welke voorwaarden, met welke approval | policy-data + Gateway-code | git; policy-evals verplicht bij wijziging |

Relatie: een **Workflow** voert een **Playbook**-instantie uit, gebruikt **Skills** en **Tools**, binnen **Policies**, geïnformeerd door de **Recipe** van de tenant. Testing/promotion/rollback per type staat in de registry (NIG-2).

## 22. Permission- en Action Gateway-structuur

Kern (PC-08, PC-16; NIG-1):

```
toolcall (harness X, tenant T, taak K)
  → Motor Action Gateway
      1. authenticatie harness + taakcontext
      2. tool-familie + argumentclassificatie → risicoklasse R0–R3
      3. policy-evaluatie: (tenant, playbook, autonomieniveau, budgetstand, R-klasse)
      4. besluit: ALLOW │ DENY (met remediation-tekst terug in context)
                 │ REQUIRE_APPROVAL (durable HITL-wait via engine)
      5. audit-event (altijd, ook bij allow)
  → uitvoering in execution plane
```

- **Risicoklassen:** R0 read-only · R1 intern schrijven (eigen DB/bestanden) · R2 extern zichtbaar of klein geld (mail, post, betaling < limiet) · R3 groot geld, destructief, juridisch, tenant-config.
- **Autonomieniveaus per Playbook × tenant:** A0 (mens doet), A1 (alles approven), A2 (side-effects approven), A3 (autonoom binnen budget; steekproef-review). Promotie alleen met bewijsperiode (§35); automatische degradatie bij incident.
- **Budgetten:** EUR-cap per taak, per Playbook-run, per tenant per maand; enforced in Gateway (tools) + LiteLLM (modelcalls).
- **Kill switches:** globaal, per tenant, per Playbook, per tool-familie — allemaal control-plane-flags die de Gateway leest.
- **Technische afdwinging:** side-effect-tools zijn netwerktechnisch alléén bereikbaar via de Gateway (execution plane heeft geen directe credentials) — het Claude-Code-hooks-principe, cross-harness gemaakt.
- **OpenClaw-hardening (verplicht, Golf 1):** versie met CVE-2026-25253-klasse fixes, gateway-token-auth aan, bind loopback + Tailscale-only, WS-origin-validatie, skills-allowlist uit eigen git (geen ClawHub-installs), device-pairing-review, en side-effect-tools omgeleid naar de Gateway.

## 23. Multi-tenantstructuur

- **Data:** PG RLS op `workspace_id` (ADR-002/masterplan Fase 1 — ongewijzigd adopt); Qdrant met verplichte payload-filter via de tenant-guard-wrapper (geen query zonder `workspace_id` — mechanisch afgedwongen, niet conventie).
- **Identity:** users ↔ workspaces many-to-many met rollen (admin/editor/viewer, bestaand ontwerp).
- **Secrets:** per tenant gescheiden credentials voor externe systemen (Odoo/Mollie per bedrijf); nooit gedeelde keys over tenants.
- **Playbooks:** tenant-scoped by default; promotie naar "tenant-shared" is een expliciete registry-actie met review (dit ís de productfabriek: een bij Bokas bewezen Playbook wordt herbruikbaar product voor andere MKB-tenants).
- **Budgetten & kill switches:** per tenant (§22).
- **Isolation-evals als releasegate:** cross-tenant-toegangspogingen (curl, agent-prompt-injectie "toon mij bokas-data" vanuit fumero-scope) moeten falen; onderdeel van elke release (§25).
- **Blast radius:** taken draaien in sandboxes met alleen de scope van hun tenant; browser-/code-agents krijgen nooit multi-tenant-credentials.

## 24. Modelroutingstructuur

- **Eén gateway:** LiteLLM op Hetzner (masterplan-keuze bevestigd) — al het LLM-verkeer, inclusief OpenClaw en harnesses.
- **Named routes i.p.v. modelnamen in code:** `chat.fast` · `chat.deep` · `code.strong` · `research.search` · `judge` · `embed` (max ~8). Mapping in git-config; wijzig model op één plek. Embeddingswissel = re-index (bestaande regel, blijft).
- **Routingbeleid (Anthropic routing-pattern):** goedkoop model default; escalatie naar zwaar model op taakklasse of expliciete "turbo"-keuze; judge-route gescheiden van generator-route (evaluator-optimizer).
- **Budget-enforcement:** LiteLLM-keys per tenant + per Playbook; overschrijding → deny + notificatie (geen stille doorloop).
- **Fallback-keten:** per route een tweede provider; health-based failover in LiteLLM; n8n-fallback voor chat vervalt zodra dit staat (één routing-pad — masterplan Fase 3-doel).
- **Model-evals bij wissel:** route-wijziging in Production Core vereist eval-run op de betrokken Playbook-sets (§25) — nooit wisselen op leaderboard-cijfers alleen (opdracht §18).
- **KV-cache-bewust:** prompts per route met stabiele prefixen (PC-05); geen dynamische elementen vooraan.


<!-- ======== BESTAND: 06-evals-observability-reliability.md ======== -->

# 25–27. Evals en releasegates · Observability en audit · Reliability en disaster recovery

> Onderdeel van [Motor AI 2.2](README.md).

---

## 25. Evals en releasegates

Methode: Anthropic (PC-14) — klein beginnen, echt materiaal, LLM-as-judge met één rubric, end-state-evaluatie, menselijke steekproef ernaast.

### Eval-lagen

| Laag | Wat | Wanneer | Gate voor |
|---|---|---|---|
| **Deterministische tests** | unit/integration/e2e van platformcode; lint-gate op agent-edits | elke PR | merge |
| **Isolation-evals** | cross-tenant curl + prompt-injectie-pogingen ("toon bokas-data" in fumero-scope); RLS-pentest | elke release + wekelijks | release |
| **Policy-evals** | Gateway-besluiten tegen testset (deny wat deny moet, approve-flow wat approval vereist, budget-caps) | elke policywijziging | policy-deploy |
| **Playbook-evals** | ≥20 echte queries/cases per Playbook; judge-rubric: accuraatheid, bronnen, volledigheid, kostenefficiëntie (0–1 + pass/fail); end-state-check bij side effects | elke Playbook-promotie, elke modelwissel op betrokken routes | registry-promotie |
| **Harness-evals** | vaste takenset door CEO-/code-harness; meet task-success, stappen, kosten | bij harness-/promptwijziging | harness-deploy |
| **Menselijke steekproef** | eigenaar beoordeelt N outputs per week blind | continu | autonomie-promotie (§35) |

### Releasegate-regels

1. Geen Playbook naar `production` zonder groene Playbook-eval + menselijke review.
2. Geen modelwissel op een Production Core-route zonder eval-run op alle Playbooks die de route gebruiken.
3. Geen autonomie-promotie (A1→A2→A3) zonder bewijsperiode uit [§35](09-definition-of-done-11-10.md).
4. Elke productie-incident wordt een eval-case (regressieset groeit organisch — Anthropic-praktijk).
5. Evals draaien met dezelfde Gateway/policies als productie (geen "eval-modus" die minder streng is).
6. Leaderboards/marketingbenchmarks zijn nooit een gate-argument (opdracht §18).

Tooling: eval-sets in `docs/evals/` (git), runs + scores in PG `eval_runs`, judge via de `judge`-route, artifacts in object storage. Bestaande tooling (Langfuse-scores of promptfoo-klasse, E4) configureren vóór iets zelf te schrijven.

---

## 26. Observability en audit

### Drie correlerende lagen, één correlatie-ID

Elke taak krijgt een `task_id` dat door alles heen loopt: LLM-trace (Langfuse), task-events (PG), evidence-artifacts (object storage), approval-records, deploy-evidence.

| Laag | Drager | Inhoud |
|---|---|---|
| **LLM-traces** | Langfuse Cloud (masterplan-keuze bevestigd; DPA + retentie 30–90 dgn conform AVG-item L1) | prompts, completions, kosten, latency, route, cache-hit |
| **Beslis-/gedragstracing** | PG `task_events` (append-only) | statusovergangen, toolcalls + Gateway-besluiten, plan-wijzigingen, errors (mét inhoud — Manus: errors zijn leerdata), checkpoints |
| **Systeem-metrics** | bestaande health-endpoints + `free -h`-klasse monitoring; uitbreiden met alerts | RAM/disk/queue-lag/outbox-lag |

### Audit (AVG + operationeel)

- `audit_events` (bestaand Fase 1-ontwerp) uitgebreid met: elk Gateway-besluit (ook allows), elke approval (wie/wat/wanneer/op basis van welk bewijs), elke autonomie-promotie/degradatie, elke Playbook-promotie, elke secrets-toegang, GDPR-export/delete.
- Audit is append-only; retentiebeleid expliciet per categorie; audit-verlies = incident.
- **Operatorvragen die in <5 min beantwoordbaar moeten zijn** (ontwerptest voor dashboards): "wat deed agent X gisteren bij tenant Y?", "waarom is deze mail verstuurd?", "wat kostte deze taak?", "welke taken wachten op mij?", "wat wijzigde er sinds de vorige goede run?".

### Kosten-observability

`usage_events` per taak/Playbook/tenant/route (gevoed door LiteLLM + engine) → maandelijkse EUR per tenant én **kosten per succesvolle taak** (de metriek die telt, §35). Anthropic-les: tokengebruik is de dominante kostendriver; multi-agent ≈15× — dus kosten per taakklasse zichtbaar maken vóór iemand multi-agent aanzet.

---

## 27. Reliability en disaster recovery

### Doelstellingen (klein team, realistisch)

| Categorie | RPO (max dataverlies) | RTO (max hersteltijd) |
|---|---|---|
| Postgres (SSOT) | 15 min (WAL/continuous) of 24 u (dagelijkse dump) in Golf 1 → 15 min in Golf 2 | 4 uur |
| Qdrant | 24 uur (snapshot) — herbouwbaar uit bron-documenten | 8 uur |
| Object storage (evidence) | 24 uur | 24 uur |
| Workflow-state | = Postgres (engine-state in PG — reden te meer voor ADR-101-keuze) | 4 uur |
| Git (docs/playbooks/policies) | 0 (remote) | 1 uur |

### Principes

1. **Restore-tests zijn de maatstaf, geen backups.** Maandelijkse restore-oefening naar een scratch-omgeving; resultaat = recovery-evidence in de evidence plane. Een niet-geteste backup telt niet als backup.
2. **Resume-from-error, niet restart** (Anthropic): taken hervatten vanaf laatste checkpoint; de engine levert dit — eigen code mag het niet breken (geen niet-idempotente stappen buiten engine-steps).
3. **Idempotency overal:** taak-dispatch, approval-afhandeling en outbox-consumptie zijn idempotent (dubbele events → één effect).
4. **Degraded modes gedefinieerd:** LiteLLM down → chat toont status + read-only kennisbank; engine down → geen nieuwe taken, lopende hervatten na herstart; Hetzner down → NUC serveert UI in read-only; NUC down → Telegram-notificatie + Hetzner-services blijven.
5. **Rainbow/rolling deploys voor de agent-laag** (Anthropic): lopende taken niet doden bij deploy; nieuwe versie naast oude tot runs klaar zijn.
6. **Runbooks verplicht per Production Core-component** (`docs/runbooks/`): symptomen → diagnose → herstel → escalatie. Zonder runbook geen Production Core-status ([§28](07-lifecycle-en-traceability.md)).
7. **Incidentproces:** severity-schaal, blameless postmortem in `docs/incidents/`, elk incident → ≥1 eval-case + evt. policy-wijziging + automatische autonomie-degradatie bij sev-hoog.
8. **Beperkte hardware is een feature:** 16 GB-budget (masterplan Appendix C) blijft bindend; elke nieuwe service moet in het RAM-budget passen of iets vervangen.

### Threat-model-hoofdlijnen (uitwerking in `docs/threat-models/`)

Prompt-injectie via kennisbank/scrape/browser (→ Gateway + geen credentials in agent-context + domain-allowlists); supply-chain via skills/deps (→ alleen eigen git-skills, dep-audit in CI); exposed services (→ Tailscale-only beheer, publiek alleen motorsai.app-routes met auth; OpenClaw nooit publiek); secrets-lekkage (→ secrets-manager, secret-scanning in CI); insider/vergissing (→ approvals R3, audit, kill switches).


<!-- ======== BESTAND: 07-lifecycle-en-traceability.md ======== -->

# 28–30. Technology lifecycle matrix · Role-model traceability matrix · Architecture Decision Records

> Onderdeel van [Motor AI 2.2](README.md).

---

## 28. Technology lifecycle matrix

Statussen: **Production Core** (eigenaar + runbook + observability + backup/exit + security review + testdekking vereist) · **Incubation** (staging/shadow/pilot) · **Watchlist** (alleen onderzoek) · **Rejected** (met reden) · **Decommissioning** (met datum).

Regel uit de opdracht: **Production Core blijft kleiner dan Incubation + Watchlist samen.** Huidige telling: 12 Core vs 6 Incubation + 7 Watchlist + 12 Rejected/Decommissioning — voldoet.

| Component | Status | Eigenaar | Toelichting / voorwaarden |
|---|---|---|---|
| Postgres (Hetzner) | **Production Core** | Pietje | SSOT; runbook + restore-test verplicht (Golf 1) |
| Drizzle + RLS | **Production Core** | Pietje | isolation-evals als gate |
| Qdrant | **Production Core** | Pietje | tenant-guard-wrapper verplicht |
| Redis | **Production Core** | Pietje | nooit SSOT |
| Object storage (backups/evidence) | **Production Core** | Pietje | retentiebeleid documenteren |
| LiteLLM | **Production Core** | Pietje | named routes + budgetten |
| Langfuse Cloud | **Production Core** | Pietje | DPA + retentie 30–90 dgn |
| Canonieke engine (Inngest of DBOS, ADR-101) | **Production Core na spike** | Pietje | winnaar van de spike; verliezer → Rejected |
| Motor Next.js-app (motorsai.app) | **Production Core** | Pietje | auth-gaten dichten = voorwaarde |
| OpenClaw gateway | **Production Core, voorwaardelijk** | Pietje | alléén na hardening (§22); anders degradatie naar Incubation |
| Telegram-bridge | **Production Core** | Pietje | wordt dunne event-emitter |
| Tailscale + Cloudflare Tunnel | **Production Core** | Pietje | beheer-toegang alleen via Tailscale |
| Motor Action Gateway | **Incubation → Core** | Pietje | NIG-1; Core na policy-evals groen |
| Playbook/Skill-registry | **Incubation → Core** | Pietje | NIG-2 |
| Motor Kernel (task-laag) | **Incubation → Core** | Pietje | NIG-3 |
| Coding-CLI in sandbox (Claude Code/Codex CLI-klasse) | **Incubation** | Pietje | vult masterplan-gap "repo-agent"; eerst alleen eigen repo's |
| OpenHands-runtime als sandbox | **Incubation** | Pietje | alternatief voor kale docker-exec; kies één |
| agent-browser/Stagehand (on-demand) | **Incubation** | Pietje | masterplan-keuze; via Gateway |
| DBOS of Inngest (spike-verliezer) | **Rejected na spike** | — | gedocumenteerde reden in ADR-101 |
| n8n | **Decommissioning als orchestrator; blijft als integratie-adapter** | Pietje | nooit state-eigenaar; flows migreren per Golf 2–3 |
| Dify | **Decommissioning** — datum: einde Golf 3 | Pietje | 4–6 GB RAM voor overlappende functie; builder-flows migreren naar engine/Playbooks |
| SQLite (ai-motor) | **Decommissioning** (ADR-002 M6, 2026-08-09) | Pietje | bestaand besluit |
| EXECUTION_BOARD.db | **Decommissioning** — Golf 1 | Pietje | tweede task-waarheid |
| factory_brains/Chroma | **Decommissioning** — Golf 1 | Pietje | tweede vectorwaarheid |
| Omega/holding/evomap/singularity-stack | **Decommissioning** — inventarisatie Golf 1, uit vóór Golf 3 | Pietje | legacy-generaties; alles wat niemand mist gaat uit |
| Ollama (embed-only, Hetzner) | **Production Core** | Pietje | alleen `nomic-embed-text`; wissel = re-index |
| LightRAG / Cognee / graph-memory | **Watchlist** | — | geen taak aangetoond die graph-reasoning vereist (opdracht §17) |
| Temporal (Cloud) | **Watchlist** | — | pas bij >duizenden runs/dag of multi-service |
| Hatchet / Restate | **Watchlist** | — | herzien bij ADR-101-review |
| Coze Studio-patronen | **Watchlist** | — | compile/runtime-split noteren voor later |
| DeerFlow (research-referentie) | **Watchlist** | — | patroon geadopteerd, product niet |
| Hermes-agent | **Watchlist** | — | FTS-memory-patroon geadopteerd |
| Youtu-Agent YAML-configs | **Watchlist** | — | idee voor agent-config-formaat |
| Mastra/VoltAgent/LangGraph/CrewAI | **Rejected** (bestaand besluit, bevestigd) | — | frameworks lossen ons probleem niet op; Anthropic: patronen > frameworks |
| Lokale chat-LLM's (8B+ op eigen hardware) | **Rejected** | — | RAM; cloud via LiteLLM (bestaand besluit) |
| ClawHub-skills / community-skills | **Rejected** | — | ClawHavoc-supply-chain (E1); alleen eigen git |
| Manus (product) | **Rejected** | — | opgekocht door Meta; patronen geadopteerd, product niet |
| Eigen agent-framework / workflow-DSL / vector-DB / IdP | **Rejected pending evidence** | — | No-Invention Gate niet doorlopen |

---

## 29. Role-model traceability matrix

Kolommen: Motor AI-component · Onderliggend patroon · Rolmodel(len) · Direct overgenomen · Motor-aanpassing · Reden afwijking · Bewijs · Status.

| Motor AI-component | Patroon | Rolmodel(len) | Direct | Aanpassing | Reden | Bewijs | Status |
|---|---|---|---|---|---|---|---|
| Task lifecycle (§17) | delegatie + verificatie + outcome-review | Devin, Codex, Anthropic | fasen 1-op-1 | risicoklassen R0–R3 toegevoegd | tenant-/geldrisico's die rolmodellen niet kennen | E2 | Ontwerp |
| Long-running lifecycle (§18) | initializer/increment/feature-list | Anthropic | ja, incl. JSON-checklist | gegeneraliseerd naar business-taken | Motor doet meer dan code | E2/E4 | Ontwerp |
| Research-lifecycle | orchestrator-worker + critic + citaties | Anthropic, DeerFlow | ja | EUR-cap per run | kostenrisico 15× | E2 | Ontwerp |
| Motor Kernel | dunne statusmachine op engine | OpenHands (event log), eigen | patroon ja | task-domeinmodel eigen | per definitie domeinspecifiek | NIG-3 | ADR-104 |
| Canonieke engine | durable execution | Temporal-semantiek via Inngest/DBOS | ja | keuze via spike | 16 GB + TS + PG-constraint | E1/E2/E4 | ADR-101 open |
| Action Gateway | deterministische hooks + allowlists | Claude Code, Codex, SWE-agent | principe ja | tenant + EUR-budget cross-harness | bestaat nergens gecombineerd | NIG-1 | ADR-102 |
| Autonomieladder | approval-modes | Codex, Claude Code, Devin | ja | per Playbook × tenant + bewijsperiode | meetbare promotie nodig | E2 | Ontwerp |
| CEO-harness | context engineering-zesluik | Manus, Claude Code | ja | — | — | E3 (mechanismen verifieerbaar) | Ontwerp |
| Code-agent | bestaande coding-CLI in sandbox + AGENTS.md + checks | Codex/Claude Code/OpenHands | ja | geen eigen harness | mini-SWE-agent-les: simpel wint | E1–E4 | Ontwerp |
| Sandboxing | container per taak / action-server | Codex, OpenHands | ja | vereenvoudigd (vaste base-images) | teamgrootte | E2/E4 | Ontwerp |
| Kennisstructuur (§20) | AGENTS.md-kaart + docs-SSOT + gardening | Codex, agents.md, Claude Code | ja | tenant-specs + NL/EN | multi-tenant business | E1/E2 | Ontwerp |
| Playbooks (§21) | Devin-format | Devin | ja | tenant-scoping + promotie | productfabriek-doel | E2 | ADR-103 |
| Skills | markdown+frontmatter, eigen registry | OpenHands/Claude Code/Hermes | ja | geen externe registries | ClawHavoc (E1) | E1/E4 | Ontwerp |
| Learning-loop | Session Insights-postmortem | Devin, Hermes | ja | review-queue in Motor UI | mens keurt kennis | E2/E4 | Ontwerp |
| HITL-approvals | durable waits | Inngest/DBOS/Temporal | ja | Telegram+UI als emitters | bestaande kanalen | E2/E4 | Ontwerp |
| Multi-tenancy | RLS + payload-filter + isolation-evals | industrie + eigen plan | ja | evals toegevoegd | bewijsplicht | E1 | Deels gebouwd |
| Modelrouting | gateway + named routes | LiteLLM/OpenHands, Anthropic routing | ja | budget-keys per tenant | kostenbeheersing | E4/E5 | Gepland |
| Observability | 3 lagen + correlatie-ID | Anthropic, Langfuse | ja | — | — | E2 | Gepland |
| Evals (§25) | 20-queries + judge-rubric + end-state | Anthropic | ja | policy-/isolation-evals toegevoegd | security-eisen | E2 | Ontwerp |
| SoT-matrix (§16) | event log + outbox + één eigenaar | OpenHands, industrie | ja | — | — | E1/E4 | Ontwerp |
| Kanaal-gateway | typed-WS-gateway, hardened | OpenClaw (incl. negatieve lessen) | patroon ja | secure-by-default verplicht | E1-incidenten | E1 | Hardening open |
| Bokas-brief-pilot (§32) | verticale slice test | eigen; lifecycle-patronen | — | — | — | — | Golf 2 |

**Regel:** component zonder rij in deze matrix mag niet naar Production Core.

---

## 30. Architecture Decision Records

Bestaande ADR-001 (Qdrant dual-search) en ADR-002 (PG-cutover) blijven van kracht. Nieuw:

### ADR-101 — Canonieke workflow-engine: Inngest vs DBOS (spike verplicht)

- **Status:** Open — beslissen in Golf 1 na spike van elk ~1–2 dagen.
- **Context:** n8n is gediskwalificeerd als durable engine (geen mid-run-checkpointing, E4/E5). Temporal self-host kost 3–6 GB + ops-tax (E2); Conductor is JVM/JSON-DSL-mismatch. Op 16 GB + TypeScript + bestaande Postgres resteren twee sterke kandidaten: **Inngest** (gepland in masterplan; TS-first, `waitForEvent`-HITL, dashboard; risico's: SSPL-server, self-host jong, dashboard zonder auth) en **DBOS Transact** (MIT-library, nul extra infra, state in eigen PG, exactly-once send/recv + agent-inbox-referentie; risico's: geen bundler-support in Next.js-build, dunnere UI, recovery via processupervisor).
- **Besliscriteria (spike):** HITL-approval met timeout+reminder werkt end-to-end; crash-recovery-test (kill -9 mid-run → hervat); Next.js-integratie zonder build-pijn; operator kan een vastgelopen run vinden en herstarten < 5 min; RAM-meting.
- **Besluit-default bij twijfel:** DBOS (minder bewegende delen — mini-SWE-agent-les), tenzij het dashboard-gemis in de praktijk zwaarder weegt.
- **Exit:** workflows klein en engine-agnostisch houden (logica in gewone functies, engine-API dun eromheen).

### ADR-102 — Motor Action Gateway (Extend)

- **Status:** Besloten (NIG-1 doorlopen, [hoofdstuk 13](04-fit-gap-en-adoptieladder.md#nig-1--motor-action-gateway)).
- **Besluit:** dunne HTTP-policy-check die elke harness aanroept vóór side-effect-tools; policies als data in git; audit-event bij elk besluit; OPA/Cedar-adoptie zodra policies >~20 regels; netwerkpolicy dwingt af dat side-effect-credentials alleen bij de Gateway leven.
- **Gevolg:** OpenClaw/n8n/code-agent verliezen directe credentials (Golf 1–2).

### ADR-103 — Playbook/Skill-registry (Extend)

- **Status:** Besloten (NIG-2).
- **Besluit:** playbooks/skills als bestanden in git (Devin-format; markdown+frontmatter); PG-tabel voor versie→status→tenant; promotie vereist groene eval + menselijke review; rollback = vorige versie activeren; geen externe skill-registries.

### ADR-104 — Motor Kernel (Extend)

- **Status:** Besloten (NIG-3).
- **Besluit:** task-domeinmodel (`tasks`, `task_events` append-only, `approvals`) in PG; lifecycle-workflows in de canonieke engine; API in bestaande Next.js-app; geen nieuwe service. EXECUTION_BOARD.db en andere taak-stores worden gedecommissioned.

### ADR-105 — Orchestrator-consolidatie: OpenClaw = kanaal/harness, n8n = adapter, Dify = decommission

- **Status:** Besloten.
- **Context:** drie overlappende orchestrators + geplande engine = vier automation-lagen voor een 3–4-persoonsteam (R11); Dify kost 4–6 GB RAM op een 16 GB-box voor functionaliteit die engine+Playbooks overneemt.
- **Besluit:** engine is de enige orchestrator. OpenClaw blijft kanaal+chat-harness (gehardened, zonder directe side-effect-credentials). n8n blijft uitsluitend integratie-adapter, aangeroepen als workflow-stap; bouwt geen nieuwe flows met state. Dify: geen nieuwe workflows; migratie + uitzetten einde Golf 3 (RAM-winst → headroom).
- **Rollback:** Dify-compose blijft 30 dagen beschikbaar na uitzetten.

### ADR-106 — OpenClaw-hardening als releasevoorwaarde

- **Status:** Besloten.
- **Besluit:** de zes maatregelen uit [§22](05-target-architecture.md#22-permission--en-action-gateway-structuur) (versie met CVE-fixes, token-auth, loopback+Tailscale, origin-validatie, skills-allowlist uit eigen git, tools via Gateway) zijn een harde voorwaarde voor OpenClaw in Production Core. Tot die tijd: geen nieuwe capabilities op OpenClaw.
- **Bewijs:** CVE-2026-25253; 40k+ exposed instances; ClawHavoc (E1, jan–feb 2026).

### ADR-107 — Geen tweede memory-laag zonder aangetoonde taak

- **Status:** Besloten.
- **Besluit:** Qdrant (business-kennis) + PG FTS (transcript-zoeken, Hermes-patroon) + filesystem-as-context dekken de aangetoonde behoeften. LightRAG/Cognee/graph-memory blijven Watchlist tot een concrete taak aantoonbaar faalt op de huidige lagen én een eval laat zien dat graph-reasoning het oplost.


<!-- ======== BESTAND: 08-migratie-pilot-twaalfweken.md ======== -->

# 31–33. Migratiegolven · Verticale Bokas-pilot · Twaalfwekenplan

> Onderdeel van [Motor AI 2.2](README.md). Startpunt = huidige productiestaat (NUC + Hetzner, masterplan Fase 0–1 deels uitgevoerd, ADR-002-milestones lopen).

---

## 31. Migratiegolven

Golven zijn afhankelijkheids-geordend; geen kalenderbeloften per golf, wel harde exit-criteria. Het bestaande masterplan (Fase 0/1) is Golf 0–1-werk en blijft geldig.

### Golf 0 — Stop het bloeden (loopt al / direct)

- Fase 0-bugfixes uit het masterplan afronden: **auth-gaten dichten** (`/api/chat/*` uit PUBLIC_PATHS, server-side scope-enforcement), kennisbank-collecties, `knowledge_documents`.
- **OpenClaw-hardening (ADR-106)** — mag niet wachten op de rest.
- Secrets-inventarisatie: welke credentials liggen waar; verwijder gedeelde/verweesde keys.
- **Exit:** cross-tenant curl faalt; OpenClaw niet publiek bereikbaar en met auth; geen bekende open auth-paden.

### Golf 1 — Fundament: één waarheid, één engine, één gateway

- ADR-002 afmaken (PG-cutover M4–M6).
- **ADR-101-spike** → canonieke engine kiezen en installeren.
- **Motor Kernel v1**: `tasks`, `task_events`, `approvals` + eerste lifecycle-workflow; cowork-inbox en Telegram worden emitters/views.
- **Action Gateway v1**: risicoklassen, deny/allow/approve, audit-events; eerst vóór de meest risicovolle toolfamilies (mail, betalingen, deletes, deploys).
- **Kennisconsolidatie start**: nieuwe `docs/`-structuur (§20) aangemaakt in de repo; AGENTS.md herschreven als kaart; doc-CI (linkcheck + freshness) aan.
- **Decommission-lijst uitvoeren**: EXECUTION_BOARD.db, Chroma; inventarisatie omega/holding/evomap/singularity → uit wat niemand mist.
- LiteLLM live met named routes + tenant-keys; Langfuse-tracing op alle paden.
- **Exit:** één task-waarheid; engine draait ≥1 echte HITL-flow; Gateway blokkeert aantoonbaar (policy-eval groen); restore-test PG geslaagd.

### Golf 2 — Verticale Bokas-pilot (§32) + lifecycle compleet

- Volledige task lifecycle op één echte workflow (de Dagelijkse Bokas Management Brief).
- Playbook-registry v1 + eerste Playbook onder versiebeheer + eval-set (≥20 echte cases).
- Session-postmortem-stap + review-queue.
- Isolation-evals in CI.
- **Exit:** pilot draait dagelijks; alle §32-criteria meetbaar; 30-dagen-klok start.

### Golf 3 — Verbreden en opschonen

- Tweede en derde Playbook (bijv. Fumero-contentworkflow, bonnen/boekhoudflow) — hergebruik van dezelfde lifecycle, géén nieuwe architectuur.
- Code-agent-taken via sandbox + coding-CLI (masterplan-gap #7).
- n8n-flows migreren naar engine-stappen waar ze state droegen; **Dify uit** (ADR-105).
- Long-running-harnas voor het eerste grote bouwproject.
- **Exit:** 3 Playbooks in production; Dify uit; RAM-headroom ≥4 GB; alle Production Core-componenten hebben runbook + eigenaar.

### Golf 4 — Productfabriek

- Playbook-promotie tenant → tenant-shared (eerste herbruikbare product-Playbook).
- Autonomie-promoties op basis van bewijsperiodes (A1→A2 waar cijfers het toestaan).
- White-label-runbook uitbreiden met Playbook-provisioning per nieuwe tenant.
- **Exit:** één Playbook aantoonbaar hergebruikt bij tweede tenant zonder herbouw; §35-metrieken 30 dagen groen.

---

## 32. Verticale Bokas-pilot: Dagelijkse Bokas Management Brief

Eén echte workflow als architectuurtest — hij raakt élk onderdeel van de target architecture.

### Specificatie

- **Input** (per bron een adapter, elk met bron+timestamp in het resultaat): omzet & orders & annuleringen (kassa/Odoo via bookkeeping-pad), populaire producten, voorraadsignalen, personeelsbezetting (roosterbron of handmatige input), weer (publieke API), reviews (scrape/API), operationele incidenten (takenlog).
- **Output** (dagelijks, vast tijdstip, naar Telegram + Motor UI): managementsamenvatting; afwijkingen t.o.v. verwachtingspatroon; oorzaakhypothesen (expliciet als hypothese gelabeld); concrete aanbevelingen; **bewijs en bronnen bij elk cijfer**; takenvoorstellen (concept-taken in de Kernel); approvalverzoeken waar acties uit voortvloeien.

### Architectuurdekking (de eigenlijke test)

```
Intake (cron-trigger in engine)
→ data ingestion (adapters, elk idempotent, elk met bronvermelding)
→ tenant isolation (alle queries RLS/payload-gefilterd op bokas)
→ workflow-state (engine-run, crash-recovery getest: kill mid-run → hervat)
→ planning (deterministische workflow — beslisboom §19: stappen zijn vooraf bekend;
   alleen de analyse-/schrijfstap is een LLM-stap)
→ modelrouting (chat.deep voor analyse, judge voor eval; budget-cap per run)
→ policy check (Gateway: brief = R1; takenvoorstellen met side effects = R2 → approval)
→ execution
→ verification (cijfers matchen bron-queries — end-state-check; geen cijfer zonder bron)
→ evidence (query-resultaten + bronnen als artifacts, gelinkt aan task_id)
→ human approval (alleen voor voorgestelde acties, niet voor de brief zelf)
→ output (Telegram + UI)
→ audit (volledige task_events + Gateway-log)
→ feedback (eigenaar beoordeelt: nuttig/onnuttig + correcties — 30 sec werk)
→ Playbook improvement (wekelijkse postmortem-batch → Playbook-versie omhoog)
```

### 30-dagen-gates vóór iedere volgende complexe divisie

| Gate | Norm |
|---|---|
| Betrouwbaar | ≥95% van de dagen geleverd vóór deadline zonder handmatige reparatie |
| Meetbaar | elk cijfer herleidbaar naar bron; judge-eval wekelijks groen |
| Herstelbaar | ≥1 geënsceneerde crash mid-run hersteld zonder dataverlies of dubbele output |
| Betaalbaar | kosten per brief ≤ vastgesteld budget (EUR-cap; streefwaarde bij start vastleggen) |
| Veilig | 0 cross-tenant-lekken; 0 ongeautoriseerde side effects; Gateway-log compleet |

Pas als alle vijf 30 dagen staan: tweede divisie/workflow van vergelijkbare complexiteit.

---

## 33. Twaalfwekenplan

Weken zijn richtinggevend voor volgorde en parallelliteit (geen kalenderbelofte); elke week eindigt met een committed, getest increment (long-running-discipline op onszelf toegepast).

| Week | Focus | Belangrijkste deliverables |
|---|---|---|
| 1 | Golf 0 | Auth-gaten dicht; OpenClaw-hardening uitgevoerd; secrets-inventaris |
| 2 | Golf 0→1 | ADR-101-spike (Inngest vs DBOS) + besluit; PG-cutover-milestones op koers |
| 3 | Golf 1 | Kernel v1-schema (`tasks`/`task_events`/`approvals`); eerste engine-workflow met HITL-wait; Telegram-emitter |
| 4 | Golf 1 | Action Gateway v1 (mail/pay/delete-families); policy-evals; audit-events |
| 5 | Golf 1 | Kennisstructuur §20 aangemaakt; AGENTS.md als kaart; doc-CI; decommission EXECUTION_BOARD.db + Chroma |
| 6 | Golf 1 | LiteLLM named routes + tenant-keys; Langfuse-correlatie via task_id; restore-test PG (evidence vastleggen) |
| 7 | Golf 2 | Bokas-brief: adapters (omzet/orders/weer/reviews) idempotent + bronvermelding |
| 8 | Golf 2 | Bokas-brief: volledige lifecycle-run end-to-end in staging; crash-recovery-test |
| 9 | Golf 2 | Playbook-registry v1; Brief-Playbook v1 + eval-set (≥20 echte dagen/cases); judge-rubric |
| 10 | Golf 2 | **Pilot live** — dagelijkse brief in productie; 30-dagen-klok start; feedback-knop |
| 11 | Golf 2/3 | Postmortem-loop actief (wekelijkse batch); isolation-evals in CI; runbooks voor Core-componenten |
| 12 | Golf 3-start | Evaluatie tegen §34/§35; besluit tweede Playbook; Dify-migratie-inventaris; dit document bijwerken met geleerde lessen |

Parallel-regel: max één architectuurwijziging per week naast de pilot; team van 3–4 verdraagt geen drie gelijktijdige fundamentwissels.


<!-- ======== BESTAND: 09-definition-of-done-11-10.md ======== -->

# 34–35. Definition of Done · Meetbare 11/10-criteria

> Onderdeel van [Motor AI 2.2](README.md).

---

## 34. Definition of Done

### DoD per taak (agent-uitgevoerd)

Een taak is pas *done* wanneer:

1. Alle acceptatiecriteria/postconditions uit intake of Playbook aantoonbaar groen;
2. **Bewijs-artifacts** aanwezig en gelinkt aan `task_id` (testoutput / bron-queries / screenshots — geen beweringen zonder artefact);
3. Self-verificatie uitgevoerd zoals een eindgebruiker het zou ervaren (niet alleen unit-checks);
4. Adversarial review gedaan bij R2+ of code;
5. Vereiste approvals vastgelegd (wie, wanneer, op basis waarvan);
6. Schone eindstaat: geen half werk, open punten expliciet gedocumenteerd;
7. Audit- en usage-events compleet;
8. Postmortem-stap gedraaid (of bewust geskipt bij triviale taken).

### DoD per Playbook-versie

Groene eval-set (≥20 echte cases) + menselijke review + registry-promotie + rollbackpad getest.

### DoD per Production Core-component

Eigenaar + runbook + observability + backup/exit-strategie + security-review + testdekking + rij in de traceability-matrix ([§29](07-lifecycle-en-traceability.md)).

### DoD voor Motor AI 2.2 als geheel (architectuur "af")

Alle Golf 0–2-exitcriteria gehaald én de Bokas-pilot 30 dagen door alle vijf gates ([§32](08-migratie-pilot-twaalfweken.md)).

---

## 35. Meetbare 11/10-criteria

Per criterium: meetmethode · streefwaarde · minimale bewijsperiode · eigenaar · reactie bij overtreding. Eigenaar is nu overal Pietje; bij teamgroei worden rollen gesplitst (security/ops). "Baseline eerst": waar geen historische data is, meten we 30 dagen vóór het vastklikken van de streefwaarde.

| # | Criterium | Meetmethode | Streefwaarde | Bewijsperiode | Reactie bij overtreding |
|---|---|---|---|---|---|
| 1 | Task-success | % taken done zonder handmatige reparatie (Kernel-data) | ≥90% per Playbook in production | 30 dgn | Playbook terug naar `tested`; postmortem-analyse |
| 2 | Menselijke correcties | correcties per 10 taken (feedback + postmortems) | dalend per Playbook-versie; ≤2/10 voor A2+ | 30 dgn | geen autonomie-promotie; Playbook-revisie |
| 3 | Ongeautoriseerde acties | side effects zonder Gateway-allow (audit-reconciliatie) | **0** | continu | sev-hoog incident; kill switch toolfamilie; root cause vóór heractivering |
| 4 | Tenantisolatie | isolation-evals + wekelijkse cross-tenant-pentest | 0 lekken | continu | sev-kritiek; tenant-API's dicht tot fix + regressietest |
| 5 | Herstelbaarheid | maandelijkse restore-oefening + geënsceneerde crash mid-task | RTO ≤4 u (PG); taak hervat zonder dubbele side effects | maandelijks | migratie-/deploystop tot geslaagde herhaling |
| 6 | Dataverlies | RPO-meting bij oefening/incident | ≤15 min (PG, Golf 2+) | maandelijks | backup-architectuur herzien |
| 7 | Kosten per succesvolle taak | usage_events ÷ succesvolle taken, per Playbook | ≤ budget per Playbook; trend niet stijgend >20%/mnd zonder verklaring | 30 dgn | budget-cap verlagen; route-/promptoptimalisatie |
| 8 | Doorlooptijd | intake→done p50/p90 per Playbook | p90 binnen Playbook-norm | 30 dgn | bottleneck-analyse (vaak approval-latency) |
| 9 | False approvals | achteraf onterecht gebleken approvals (incidentkoppeling) | 0 met schade; ≤1/kwartaal zonder schade | kwartaal | approval-informatie verbeteren (bewijs bij verzoek) |
| 10 | Rollback | tijd tot vorige Playbook-/deploy-versie actief | ≤15 min, getest | per release | release-freeze tot rollbackpad werkt |
| 11 | Documentatiefreshness | doc-CI: % docs binnen review-termijn (90 dgn) | ≥90%; entrypoints 100% | continu | doc-gardening-taak; merge-block op verlopen kern-docs |
| 12 | Playbookhergebruik | # Playbooks `production` + # tenant-shared | ≥3 production (Golf 3); ≥1 shared (Golf 4) | golf-exit | prioriteit herzien: minder nieuwbouw, meer kristallisatie |
| 13 | Incidentfrequentie | sev-gewogen incidenten/maand | sev-kritiek: 0; sev-hoog ≤1/mnd, dalend | kwartaal | capaciteit van features naar reliability |
| 14 | Evalregressies | eval-score per Playbook-versie t.o.v. vorige | geen daling >5% zonder expliciete acceptatie | per promotie | promotie geblokkeerd |
| 15 | Autonome taakduur | langste succesvolle onbegeleide run (long-running-harnas) | groeiend per kwartaal bij gelijkblijvende criteria 1–3 | kwartaal | niet forceren; eerst 1–3 op orde |
| 16 | Operatorvertrouwen | maandelijkse zelfscore eigenaar (1–10) + "delegeer ik dit blind?"-lijst per Playbook | stijgend; A3-Playbooks alleen bij score ≥8 | maandelijks | kwalitatieve review: wat ondermijnt vertrouwen |
| 17 | Commerciële herbruikbaarheid | tijd om bewezen Playbook bij nieuwe tenant te activeren | ≤1 dag (white-label-runbook + registry) | per nieuwe tenant | provisioning-pad verbeteren |

### Autonomie-promotieregels (koppeling criteria ↔ autonomieladder)

- **A1 → A2:** criteria 1–4 groen gedurende 30 dagen voor dat Playbook × tenant.
- **A2 → A3:** criteria 1–4 én 7–9 groen gedurende 60 dagen; kill switch getest; eigenaar-score ≥8.
- **Degradatie:** automatisch één niveau omlaag bij sev-hoog-incident dat aan het Playbook raakt; herstel alleen via nieuwe bewijsperiode.

### Wat een 11/10 betekent

Niet "de documentatie is indrukwekkend", maar: **een buitenstaander kan met deze repo, de runbooks en de evidence plane verifiëren dat het systeem 30+ dagen betrouwbaar, veilig, herstelbaar en betaalbaar heeft gedraaid — en een tweede tenant kan een bewezen Playbook binnen een dag gebruiken.** Alles daaronder is een lager cijfer, ongeacht hoe mooi de architectuurplaten zijn.


<!-- ======== BESTAND: 10-marktscan-homelab-kansen.md ======== -->

# 36. Marktscan — homelab/self-hosted AI-markt 2026 en aansluitende kansen voor Motor AI

> Aanvulling op [Motor AI 2.2](README.md), onderzoek uitgevoerd 2026-07-21 (twee parallelle marktonderzoeken: homelab-/self-hosted-community + SMB-AI-ops-markt). Bewijsniveaus E1–E7 zoals in de rest van de synthese. Alle kansen zijn gefilterd door de adoptieladder en de 16 GB-/teamgrootte-constraints.

---

## 36.1 Hoofdconclusie

**De Motor AI-stack is de marktstandaard, geen buitenbeentje.** n8n + Ollama + Qdrant + Postgres + cloud-routing op Docker Compose is vrijwel identiek aan het officiële n8n Self-hosted AI Starter Kit-patroon waar de community in 2025–2026 op convergeerde (E4). De achterstand zit niet in de stack maar in: (a) use-cases erbovenop, (b) ops-discipline (updates, secrets, monitoring, backups), (c) één acute deadline (EU AI Act Art. 50, 2 aug 2026).

## 36.2 Nieuwe kansen — geprioriteerd

Statussen sluiten aan op de [technology-lifecycle-matrix (§28)](07-lifecycle-en-traceability.md).

### Tier 1 — Adopt/Configure (bewezen patroon, hoge waarde, past in RAM-budget)

| # | Kans | Tools | Bewijs | RAM | Waarde |
|---|---|---|---|---|---|
| K1 | **Bonnetjes/factuur → Moneybird-pipeline** (foto via Telegram → vision-extractie → validatie btw/rekensom → concept-boeking → approval) | Paperless-ngx + paperless-gpt/PaperCortex-klasse AI-laag + LiteLLM-vision + Moneybird API | E1/E4 — bewezen NL/DE-categorie; vision-extractie 87–97% veldnauwkeurigheid (peer-reviewed, arXiv 2509.04469) | ~2 GB | Hoog, maandelijks terugkerend; wordt Playbook #2 of #3 |
| K2 | **Review-response-automation Bokas** (4–5★ auto, 1–3★ via approval) | Google Business Profile API + engine-workflow + bestaande Telegram-approvals | E1 — meest gerepliceerde SMB-AI-workflow (meerdere onderhouden n8n-templates) | ~0 | Hoog voor reputatie; 1-op-1 op bestaand approval-ontwerp |
| K3 | **Concurrent-/prijs-/webmonitoring → dagbrief** | changedetection.io (~25k stars) + LLM-diff-samenvatting | E1/E4 | ~0,5 GB | Middel-hoog, beide tenants; voedt de Bokas-brief (§32) |
| K4 | **Anomaliedetectie + forecast op omzet in de dagbrief** | statsforecast (prediction intervals; v2.1 jul 2026) + vaste SQL + LLM-narratie | E1 — statistiek detecteert, LLM vertelt (anti-hype-ontwerp, conform §19-beslisboom: deterministisch waar het kan) | ~0 | Hoog voor Bokas-ops |
| K5 | **Infra-log-triage → digest** ("infrastructuur-alinea" in de ochtendbrief) | logs → filter → LLM actionable/ruis → Telegram (kritiek) / digest (rest) | E5 — community-gevalideerd patroon (Cortex-homelab e.a.); LLM = triage, nooit auto-remediation | ~0 | Middel; solo-operator-verzekering |

### Tier 2 — Ops-verbeteringen (direct, klein, sluit aan op §26–27)

| # | Verbetering | Detail | Bewijs |
|---|---|---|---|
| O1 | **Container-updates: Watchtower vervangen** | containrrr/watchtower gearchiveerd 2025-12-17 → Renovate-PR's tegen compose-files in git (past bij GitOps/doc-CI) of Diun (notify-only). Nooit blind auto-updaten op businesskritieke stacks | E1 |
| O2 | **Secrets: sops + age** | Encrypted values in git, geen extra server; bevestigt §16-keuze. Infisical pas bij meerdere operators | E5 (consensus) |
| O3 | **Monitoring: Beszel + Uptime Kuma** | Samen ~150–180 MB; alerts naar Telegram; Prometheus/Grafana is overkill <10 hosts | E4/E5 |
| O4 | **Backup: restic/Borg 3-2-1 + push-monitor** | Stille backup-failure = alert (healthchecks-patroon); versterkt de restore-test-discipline uit §27 | E1 |
| O5 | **Embeddings-upgrade** | nomic-embed-text → bge-m3 of Qwen3-Embedding-0.6B (multilingual/NL) + Qwen3-Reranker-0.6B vóór Qdrant-resultaten; CPU-haalbaar. Let op bestaande regel: wissel = volledige re-index | E4 |
| O6 | **NUC → 32 GB RAM (~€70)** | Goedkoopste capability-unlock: MoE-modellen (Gemma 4 26B-A4B-klasse, ~4B actief) draaien dan lokaal ~5+ tok/s voor batch-extractie/tagging — kosten-/privacy-winst voor R0/R1-taken | E4/E5 |
| O7 | **Compose-beheer: Komodo** (Watchlist) | Multi-server compose-management met git-webhook-deploys over NUC + Hetzner; lichte Portainer-vervanger | E4 |
| O8 | **SearXNG (+ Crawl4AI op Hetzner)** | Private zoek-/scrape-laag voor agents zonder per-call-API-kosten; via MCP aan harnesses koppelen | E4 |
| O9 | **Scriberr (Whisper-transcriptie)** (Incubation) | Meeting-/gesprekstranscriptie → samenvatting → Qdrant; folder-watcher speciaal voor n8n-pipelines | E4 |

### Tier 3 — Defer / voorwaardelijk

| # | Kans | Voorwaarde |
|---|---|---|
| D1 | **WhatsApp-klantcontact Bokas** | Alléén officiële Cloud API (per-conversation-pricing). Onofficieel (Baileys/Evolution/WAHA) = gedocumenteerd verhoogd banrisico 2025–2026 → **Rejected** voor productie; Telegram blijft intern kanaal |
| D2 | **Website-chat met RAG** | Typebot (deterministische flows: reservering/FAQ) + eigen Qdrant-RAG-fallback; Chatwoot alleen bij omnichannel-behoefte (Captain = betaald). Vereist Art. 50-disclosure vóór livegang |
| D3 | **Telefonie-voice-agent** | LiveKit Agents is bewezen framework, maar SIP/WebRTC-zelfbouw is te veel bewegende delen voor deze schaal → Watchlist; pragmatische v1 = missed-call → bericht-callback |
| D4 | **Text-to-SQL voor ad-hocvragen** | Werkt in 2026 alleen met gecureerde semantische laag (Metabase/Lightdash-les); fase 2, en dan alleen op whitelisted views |
| D5 | **Social scheduling (Postiz) + nieuwsbrief (Listmonk)** | Beide bewezen OSS; waarde vooral Fumero; OAuth-app-registraties zijn de echte frictie. Ná de eerste 3 Playbooks |
| D6 | **Open WebUI als interne staff-chat** | 145k stars, klaar product over LiteLLM/Ollama — maar overlapt met eigen Motor-chat; alleen overwegen als interne power-user-console |

### Hype-lijst (Rejected — niet aan beginnen)

DGX Spark als inference-server · exo/Mac-clustering · k3s op 2 nodes · voice-interfaces voor business-ops · autonome SEO-agents · "AI employee"-full-autonomy-aanbiedingen · LLM-gestuurde auto-remediation van infra · factuurautomatisering zonder approval-stap · onofficiële WhatsApp-API's als productie-infra.

## 36.3 Regelgeving (tijdgevoelig, geverifieerd juli 2026)

- **EU AI Act Art. 50 — 2 augustus 2026, mét handhaving:** klantgerichte chatbots/voice-agents moeten AI-disclosure tonen bij eerste interactie, in de interface. Geen SMB-uitzondering. Interne tools (dagbrief, triage, extractie voor eigen personeel) vallen er praktisch buiten. Actie: disclosure-banner is een releasevoorwaarde voor élke klantgerichte bot (opnemen in Action Gateway-releasegates §25); gepubliceerde AI-content houdt een human-review-stap; bots nooit onder een mensennaam.
- **NL e-invoicing/Peppol:** géén B2B-mandaat vandaag; ministerie-advies (10 mrt 2026): binnenlands B2B verplicht ~1 jan 2030, ViDA juli 2030. **Geen eigen Peppol-access-point bouwen**; Peppol-ontvangst via Moneybird geeft gratis gestructureerde UBL (geen OCR nodig) — extra argument voor K1.
- **GDPR/soevereiniteit:** EU-SMB's kiezen self-hosted om de transferproblematiek (Schrems II, CLOUD Act) te vermijden; het gelaagde model (PII → EU-endpoints zoals Mistral; geminimaliseerde context naar US-modellen; ruwe data in eigen PG/Qdrant) is precies de bestaande LiteLLM-named-routes-structuur (§24) — routeringsregel per dataklasse toevoegen.

## 36.4 Commerciële validatie (productfabriek, Golf 4)

Marktdata 2026 (operator-surveys, agency-pricing): losse workflow-builds $1.800–4.500; SMB-retainers $650–1.200/mnd; AI-agent-retainers $2.500–6.000/mnd (snelst groeiend). **Self-hosted verkoopt 40–60% duurder** in de EU omdat de klant stack + compliance bezit. Wat verkoopt is exact wat Motor AI intern bouwt: review-automation, bonnetjes-intake, rapportage-digests, monitoring-retainers. Wat churnt: generieke "AI employee"-chatbots zonder workflow. → Bevestigt Golf 4 (§31): elk intern Playbook is potentieel een €500–1.500/mnd productized service met "data blijft op EU-infra" als differentiator; Bokas/Fumero als live case studies.

## 36.5 Inpassing in de bestaande golven

- **Golf 1 (nu):** O1–O4 (updates, secrets, monitoring, backup-alerting) — ops-hygiëne, geen architectuurwijziging.
- **Golf 2 (pilot):** K3 + K4 + K5 worden input-adapters/secties van de Bokas-dagbrief — ze verrijken de pilot zonder scope-explosie.
- **Golf 3:** K1 (bonnetjes→Moneybird) als Playbook #2 (heeft Gateway + approvals nodig, dus ná Golf 1); K2 (reviews) als Playbook #3; O5/O8/O9 waar capaciteit is.
- **Golf 4:** D5, D2 (mét Art. 50-disclosure), productizing van bewezen Playbooks.
- **Direct, los van golven:** Art. 50-check borgen in releasegates (§25); O6 (RAM) bij eerstvolgende hardware-moment.

**Bronkwaliteit-caveat:** enkele 2026-vergelijkingssites bleken SEO-/AI-contentfarms; claims zijn alleen meegewogen waar primaire bronnen (GitHub, officiële docs, peer-reviewed papers, selfh.st-survey) ze bevestigen.


<!-- ======== BESTAND: 11-azie-next-level.md ======== -->

# 37. Azië-scan — next level boven het starter kit (China/Japan/Korea, juli 2026)

> Aanvulling op [Motor AI 2.2](README.md) en [doc 10 (marktscan)](10-marktscan-homelab-kansen.md). Onderzoek 2026-07-21, twee parallelle onderzoeken: (a) Chinees open-source-AI-infrastructuurecosysteem, (b) hoe Aziatische bedrijven AI operationeel draaien voorbij chat+RAG. Leveranciersclaims zijn gemarkeerd; alle kansen gefilterd door adoptieladder + 16 GB-budget + ADR's.

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
| Z1 | **Functieomschrijving per agent/Playbook**: rol, eigenaarschap, KPI, escalatiegrens ("review-agent: bezit Google-replies; KPI: reactie <4u, approval-rate >90%; 1–2★ → mens") | Playbook-frontmatter (§21) |
| Z2 | **Vier vaste KPI's per Playbook**: auto-resolutieratio, escalatieratio, kosten/taak, correctieratio — wekelijks dashboard uit PG | Al gedekt door §35-criteria 1, 2, 7; "escalatieratio" toevoegen |
| Z3 | **Escalatie-mét-context**: elke handoff naar Telegram bevat historie + aanbevolen actie + one-tap approve/reject (nooit een "kale" vraag) | Approval-emitter-adapter (§11); het meest consistent gevalideerde patroon in heel Azië |
| Z4 | **RaaS-pricing richting tenants**: betalen per opgelost gesprek / gepubliceerde post, niet per uur — het Chinese verdienmodel voor de productfabriek | Golf 4; sluit aan op doc 10 §36.4 |
| Z5 | **"Sell"- vs "operate"-agents scheiden** (Alibaba's Dianxiaomi/Qianniu-split): klantgericht conversatie-agent ≠ back-office-ops-agent; verschillende risicoklassen en approval-strengheid | Risicoklassen §22 — expliciet maken per agent-type |

## 37.3 Kansen — geprioriteerd (adoptieladder + lifecycle-status)

### Tier 1 — Adopt/Configure

| # | Kans | Wat het toevoegt | Bewijs | Footprint | Status/golf |
|---|---|---|---|---|---|
| A1 | **MinerU als ingestie-sidecar** (CPU-pipeline op de NUC, `mineru-api`) vóór alle Qdrant-ingest | Layout-bewust parsen van facturen/contracten/menu's/prijslijsten (tabellen!) i.p.v. platte tekst; versterkt K1 (bonnetjespipeline, doc 10) | E4 — 75k stars, v3.4 jun 2026; PaddleOCR-rapport peer-reviewed | ~1–2 GB tijdens batch, CPU volstaat | Incubation → Core; Golf 3 (samen met K1) |
| A2 | **Reranker-stap** tussen Qdrant en LLM (bge-reranker/Qwen3-Reranker) | RAGFlow/MaxKB/FastGPT shippen dit *standaard* — goedkoopste kwaliteitswinst; bevestigt O5 uit doc 10 | E4 | <1 GB, CPU | Golf 2–3 |
| A3 | **Chinese modellen in LiteLLM-routes — via EU-hosting voor PII** | Named routes uitbreiden: `extract.cheap` (DeepSeek V4 Flash-klasse), `agent.orchestrate` (Kimi/MiniMax-klasse); **PII-regel: alleen EU-gehoste open weights (OVHcloud/Scaleway/IONOS/Nebius serveren Qwen/DeepSeek, ~€0,75–2,25/1M); directe Chinese endpoints alleen voor niet-persoonsgebonden bulk** | E1 (pricing geverifieerd; Garante-blokkade DeepSeek jan 2025 = reëel GDPR-risico) | config | Golf 2; modelwissel = eval-run (§25) |
| A4 | **KV-cache + batch-kostenengineering** | Bevestigt PC-05 (Manus) en voegt toe: batch-API's (50% korting) voor nachtwerk (digests, embeddings, rapporten); cache-hit-kortingen 90–98% | E1/E3 | — | Golf 2 (dagbrief draait 's nachts = batch) |
| A5 | **Z1–Z3 hierboven** (functieomschrijving, KPI's, escalatie-mét-context) | Operationele volwassenheid, nul infra | E2/E3 | — | Golf 2 |

### Tier 2 — Configure/Watchlist (voorwaardelijk)

| # | Kans | Voorwaarde |
|---|---|---|
| B1 | **Coze Loop** (eval-observability-loop) | Het patroon is verplicht (§25); het product kost ~3–4 GB (ClickHouse+MySQL+Redis). Besluit: **patroon implementeren in Langfuse** (lichter, al Production Core); Coze Loop = Watchlist als Langfuse-evals tekortschieten |
| B2 | **New-API** (multi-tenant billing-gateway) | Pas bij Golf 4 (externe tenants met eigen budgetten/facturatie); tot dan volstaan LiteLLM-tenant-keys. Single Go-binary, ~100–300 MB — makkelijk later toe te voegen. AGPL-licentie noteren |
| B3 | **LightRAG** (graph+vector op bestaande PG/Qdrant) | **Blijft Watchlist onder ADR-107** — maar de trigger is nu concreet: zodra een taak aantoonbaar faalt op multi-hop-vragen over tenantkennis ("welke leverancier leverde X in periode Y onder contract Z"), is LightRAG de eerste kandidaat (draait op bestaande stores, MIT, EMNLP 2025, extractie via goedkope route A3) |
| B4 | **DeerFlow 2.0** als "super agent harness"-referentie (~77k stars, MIT, rewrite feb 2026) | Watchlist; herbeoordelen Q4 2026. Patronen (skills, sandbox, subagent-spawning) zijn al geadopteerd via §17–19; het product is 4 maanden oud |
| B5 | **gVisor-sandboxing voor tool-executie** (AgentScope/DeerFlow/RAGFlow-patroon) | Versterkt PC-01: agent-code-executie in gVisor/Docker i.p.v. op de host — meenemen in sandbox-keuze Golf 2–3 |
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

- **Golf 1 (aanvulling):** LiteLLM-hardening (versie-pin, admin-UI achter Tailscale) bij de bestaande security-golf.
- **Golf 2:** A3 (routes + PII-regel), A4 (batch/cache), A5/Z1–Z3 (agent-als-werknemer-discipline in het Brief-Playbook), A2 (reranker) — allemaal binnen de pilot, geen scope-explosie.
- **Golf 3:** A1 (MinerU vóór de bonnetjespipeline K1), B5 (gVisor-sandbox bij code-agent).
- **Golf 4:** B2 (New-API of gelijkwaardig voor tenant-billing), Z4 (RaaS-pricing), Z5 formaliseren per klantgerichte agent.
- **Triggers (geen datum):** B3 (LightRAG) bij aangetoonde multi-hop-faal; B1 (Coze Loop) bij Langfuse-eval-tekort; B4 (DeerFlow) herbeoordeling Q4 2026.

**Netto-oordeel:** Azië bevestigt de 2.2-architectuur (Playbooks, approvals, evals, context-discipline waren al de juiste keuzes) en voegt vier concrete versnellers toe: layout-bewuste ingest, reranking, 10–40× goedkopere modelroutes met een harde PII-grens, en het digital-employee-operatiemodel als discipline bovenop de bestaande lifecycle.


<!-- ======== BESTAND: 12-hardware-3090.md ======== -->

# 38. Hardware-update — NUC + RTX 3090: wat de GPU ontgrendelt

> Aanvulling op [Motor AI 2.2](README.md), [doc 10](10-marktscan-homelab-kansen.md) en [doc 11](11-azie-next-level.md). Datum: 2026-07-21.
> **Wijziging in uitgangspunten:** doc 10/11 gingen uit van "16 GB, geen GPU". Definitieve topologie (bevestigd door eigenaar):
>
> - **NUC = orchestrator** — control plane-host: Motor Next.js, OpenClaw-gateway, Kernel/engine-aansturing, Telegram. Geen zware inference.
> - **Nieuwe inference-PC (in aanbouw): Ryzen 7 + 32 GB RAM + RTX 3090 (24 GB VRAM)** — dedicated inference-worker in de execution plane, via Tailscale.
> - **Hetzner 16 GB** — data plane + zware services (Postgres, Qdrant, LiteLLM, n8n) conform masterplan.
>
> De 3090 was in de marktscan al geïdentificeerd als de beste prijs/prestatie-keuze van de community. De 32 GB systeem-RAM naast de 24 GB VRAM is belangrijker dan hij lijkt: MoE-modellen met CPU-offload (Gemma 4 26B-A4B-, Qwen3.6-35B-A3B-klasse) worden daarmee haalbaar naast de dense modellen die volledig in VRAM passen.

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

## 38.3b Bouw- en inrichtingsadvies voor de Ryzen 7 / 32 GB / 3090-PC

**Bouw (kort, alleen wat ertoe doet):**

- **Voeding:** ≥850 W met twee aparte PCIe-kabels (geen daisy-chain) — de 3090 piekt >350 W met transients daarboven. Dit is de #1 stabiliteitsfout bij 3090-builds.
- **Koeling/behuizing:** de 3090 dumpt ~350 W warmte; ruime airflow-case, en overweeg een undervolt/power-limit (~280 W kost ~5% prestaties, scheelt veel warmte/stroom — standaardpraktijk in de community voor 24/7-gebruik).
- **RAM:** 2×16 GB is prima; laat sloten vrij voor upgrade naar 64 GB — dat is de trigger voor grotere MoE-modellen (Qwen3-Coder-Next-klasse wil ~48 GB+), niet nu nodig.
- **Opslag:** 1–2 TB NVMe; modelbestanden zijn 10–40 GB per stuk en je wilt er meerdere cachen.
- **OS:** headless Linux (Ubuntu LTS/Debian) + Docker + nvidia-container-toolkit, gepinde driverversie. Geen desktop-omgeving, geen dual-use als game-PC voor de Production Core-rol (of accepteer expliciet dat inference wijkt tijdens gebruik).

**Rolverdeling (definitief):**

| Machine | Plane | Draait | Draait níet |
|---|---|---|---|
| NUC (orchestrator) | Control | Motor Next.js, OpenClaw-gateway (gehardened), Kernel-API, Telegram-emitters, local-executor/PC-bridge-glue | inference, zware ingest |
| Inference-PC (Ryzen 7/32 GB/3090) | Execution | Ollama/llama.cpp-server met `local.*`-modellen, embed/rerank, Whisper/Scriberr, MinerU-GPU-batch, evt. code-agent-sandboxes (CPU/RAM zat) | state (geen DB's), publieke endpoints, control-plane-taken |
| Hetzner 16 GB | Data + zwaar | Postgres (SSOT), Qdrant, LiteLLM, n8n-adapter, engine | frontier-inference |

Met MinerU/Whisper/sandboxes van de NUC en Hetzner áf ontstaat er bovendien RAM-headroom op beide — de Dify-decommissioning (ADR-105) plus deze verschuiving lost het 16 GB-knelpunt structureel op.

## 38.4 Serving-keuze en ops

- **Start met Ollama (of kale llama.cpp `llama-server`) op de 3090-box** — 1 gebruiker/agent-verkeer, simpel beheer, past bij het team. **vLLM pas** wanneer batch-throughput aantoonbaar knelt (5+ gelijktijdige agent-runs); dat is een Watchlist-trigger, geen dag-1-keuze.
- **Ops-eisen (Production Core-checklist §28):** Tailscale-only (nooit publiek), Beszel-agent + Uptime Kuma-check op het endpoint, nvidia-driver/container-toolkit gepind, runbook (`docs/runbooks/inference-worker.md`): herstart, modelcache legen, route-failover testen.
- **Stroom/warmte:** een 3090 idlet op ~10–25 W maar trekt 300 W+ onder last. Voor batchwerk (nachtelijke ingest, transcriptie, dagbrief-voorbereiding) is dat prima; voor 24/7-idle is het acceptabel. Meet het mee in **kosten per succesvolle taak** (§35-criterium 7) — lokaal is niet gratis, het is een ander kostenmodel (stroom i.p.v. tokens).
- **Fysieke locatie = risico-item:** de inference-PC staat thuis naast de NUC → zelfde single-site-risico. Geen extra DR-eis: alle lokale routes hebben cloud-fallback, dus uitval = duurdere taken, geen stilstand. Vastleggen in §27-degraded-modes: "3090 down → local.* routes failover naar cloud/EU; PII-taken wachten of gaan via EU-route met notificatie".

## 38.5 Inpassing in de golven

- **Golf 1 (klein):** box in Tailscale, Ollama + named routes in LiteLLM-config, monitoring-agent, runbook-stub. Geen taken erop tot Gateway/policy staat.
- **Golf 2:** `embed`/`rerank` live (O5/A2), dagbrief-batchwerk 's nachts op de box, PII-lokaal-eerst-regel in de Gateway-policies.
- **Golf 3:** `local.vision` in de bonnetjespipeline (K1+A1: MinerU-GPU → vision-extractie → validatie → Moneybird), Scriberr-transcriptie.
- **Trigger-gebaseerd:** vLLM (bij concurrency-knelpunt), LightRAG-proef (ADR-107-trigger, nu goedkoper), groter lokaal model (alleen als een eval aantoont dat de 14–32B-klasse een concrete taak niet haalt).

**Netto:** de 3090 maakt de architectuur niet anders — hij maakt drie al-geplande dingen goedkoper en AVG-sterker (extractie, embeddings/rerank, transcriptie) en upgradet de PII-regel van "EU-cloud" naar "eigen pand eerst". Alles blijft achter LiteLLM en de Action Gateway; geen nieuwe waarheid, geen nieuwe plane.


<!-- ======== BESTAND: 13-mini-datacenter-upgrade.md ======== -->

# 39. Mini-datacenter-upgrade — wat het derde niveau ontgrendelt

> Aanvulling op [Motor AI 2.2](README.md) en [doc 12](12-hardware-3090.md). Datum: 2026-07-21.
> Topologie: **NUC (orchestrator/control) + inference-PC (Ryzen 7 / 32 GB / RTX 3090, execution) + Hetzner 16 GB (data + zwaar)**, via Tailscale. Dat is functioneel een mini-datacenter: gescheiden control/execution/data over drie nodes, precies de planes-indeling uit §15 — maar nu fysiek.

---

## 39.1 Eerst de discipline: wat er NIET verandert

Een mini-datacenter is capaciteit, geen vrijbrief. Deze regels blijven onverkort gelden:

1. **Postgres op Hetzner blijft de enige SSOT** (§16). De inference-PC krijgt géén databases met waarheid.
2. **Eén canonieke engine** (ADR-101), één orchestrator. Meer hardware ≠ meer orchestrators.
3. **Production Core blijft klein** (§28). Elke nieuwe service op de PC vereist een lifecycle-rij, eigenaar en runbook — anders is het een experiment op de Watchlist.
4. **De Bokas-pilot-gates (§32) blijven de maat.** Capaciteit versnelt de uitvoering, niet de bewijsperiodes.
5. **De 30-dagen-regel blijft:** geen tweede complexe divisie vóór de eerste 30 dagen groen is.

De les uit al het onderzoek (mini-SWE-agent, Azië-scan §37.1): het next level is operationele volwassenheid. Het mini-datacenter maakt die volwassenheid *goedkoper en sneller bereikbaar* — dat is de upgrade.

## 39.2 Wat het derde niveau wél ontgrendelt (zeven upgrades)

### U1 — Parallelle sandbox-vloot → de Codex-werkwijze wordt haalbaar

De Ryzen 7 + 32 GB is ruim genoeg voor **3–5 gelijktijdige geïsoleerde task-sandboxes** (Docker, per-taak worktree) naast de inference-load. Daarmee wordt het Codex-patroon (PC-01: veel parallelle, goed afgebakende taken vanaf één board) praktisch uitvoerbaar in plaats van theoretisch:

- masterplan-gap #7 ("multi-file repo-agent ❌") wordt: coding-CLI in sandbox × N parallel;
- elke sandbox: eigen worktree, eigen branch, lint-gate, bewijs-artifacts, PR — mens reviewt outcomes.
- **Golf-inpassing:** Golf 3 (stond al gepland; capaciteit was de bottleneck, die is weg).

### U2 — De nachtploeg: autonome shifts terwijl je slaapt

Het Anthropic long-running-harnas (§18) + batch-economie (doc 11 A4) + lokale stroom i.p.v. tokens = een **dagelijkse autonome nachtcyclus**:

```
23:00  ingest-batch (MinerU-parsing, embeddings, transcripties)   → inference-PC
00:00  doc-gardening-agent (stale docs, fix-PR's — Codex-patroon) → sandbox
01:00  1–2 long-running increments (feature_list.json, checkpoint) → sandboxes
05:00  eval-runs op gewijzigde Playbooks/prompts                  → lokaal + judge
06:30  dagbrief-voorbereiding (queries, anomaliedetectie, concept) → engine + lokaal
07:30  ochtendrapport in Telegram: wat is gedaan, bewijs, wat wacht op approval
```

Alles binnen Gateway-policies en budgetten; R2+-acties blijven 's nachts geblokkeerd (wachten op ochtend-approval). Dit is de "engineers working in shifts"-metafoor van Anthropic, letterlijk gemaakt — en het is de snelste route naar §35-criterium 15 (autonome taakduur).
**Golf-inpassing:** eerste versie in Golf 2 (alleen ingest + briefvoorbereiding), volledig in Golf 3.

### U3 — Evals worden bijna gratis → strakkere gates zonder frictie

Het duurste bezwaar tegen frequente eval-runs (tokens) vervalt voor het gros van de checks: judge-runs voor R0/R1-taken en regressiesets draaien op `local.chat`/`judge.local`. Consequentie: **eval-frequentie omhoog** — bij elke Playbook-wijziging én wekelijks als drift-detectie, niet alleen bij promoties. Cloud-judge blijft voor kalibratie (maandelijkse steekproef vergelijkt lokale vs cloud-judge-scores).
**Golf-inpassing:** Golf 2, samen met de eerste eval-set.

### U4 — PII-volledig-lokale Playbooks: een nieuwe klasse werk

Met `local.vision`/`local.extract` (doc 12) kan een categorie Playbooks die eerder principieel lastig was: **personeelsdata, loonstroken, medische verzuimcorrespondentie, contracten, financiële details** — alles waarvoor zelfs EU-cloud-routing een AVG-gesprek was. De Gateway-policy krijgt een dataklasse `pii-strict` → alleen `local.*`-routes toegestaan, geen fallback naar cloud (wachtrij bij uitval).
**Golf-inpassing:** policy in Golf 2; eerste pii-strict Playbook (bijv. personeels-/contractadministratie) in Golf 3–4.

### U5 — Echte staging-omgeving

§17 definieerde "staging = tweede compose-stack" zonder plek. Die plek is er nu: **staging-stack op de inference-PC** (Motor-app + engine + kopie-DB met synthetische/gemaskeerde data). Daarmee worden migraties, Playbook-promoties en modelwissels toetsbaar vóór productie — en de maandelijkse restore-test (§27) krijgt een vast doelwit: restore náár staging is meteen de oefening.
**Golf-inpassing:** Golf 2 (restore-test-doelwit), volwaardig in Golf 3.

### U6 — Derde backup-locatie: 3-2-1 wordt compleet

NVMe/HDD op de inference-PC = tweede on-site kopie naast Hetzner; Storage Box/B2 = off-site. Daarmee is 3-2-1 (doc 10 O4) volledig: PG-dumps en Qdrant-snapshots nightly naar de PC (pull via Tailscale, append-only), off-site wekelijks+. RPO kan van 24u naar 15 min zonder extra kosten.
**Golf-inpassing:** Golf 1–2 (klein, hoge waarde).

### U7 — Eerder afgewezen zwaargewichten krijgen een voorwaardelijke plek

Sommige "Rejected/Watchlist wegens RAM"-besluiten krijgen een nieuwe voorwaarde (géén automatische promotie — lifecycle-regels §28 gelden):

| Component | Was | Wordt |
|---|---|---|
| RAGFlow | Rejected (wilde 16 GB voor zichzelf) | Watchlist met concrete optie: kan op de PC als een documentzware tenant landt — maar pas ná MinerU+LightRAG-pad bewezen tekortschiet |
| Coze Loop | Watchlist (3–4 GB te zwaar naast alles) | Watchlist, drempel verlaagd: past op de PC als Langfuse-evals aantoonbaar tekortschieten |
| vLLM | Trigger-based | idem; trigger (5+ gelijktijdige runs) wordt door U1/U2 eerder geraakt — meten |
| Groter lokaal model (64 GB RAM-upgrade) | n.v.t. | Blijft trigger-based: alleen als een eval aantoont dat de 14–32B-klasse een concrete taak mist |

## 39.3 Wat dit betekent voor de 11/10-criteria

- **Criterium 7 (kosten/succesvolle taak):** verwacht een structurele daling voor extractie-/batch-klasse taken (stroom ≈ €0,05–0,10/uur onder last vs token-kosten). Meet lokaal vs cloud per Playbook — dit wordt het eerste harde bewijs van de hardware-investering.
- **Criterium 15 (autonome taakduur):** de nachtploeg (U2) is de motor; verwacte progressie van "1 increment/nacht" naar "meerdere parallelle increments/nacht" (U1) binnen twee kwartalen — mits criteria 1–3 groen blijven.
- **Criterium 5/6 (herstelbaarheid/dataverlies):** U5+U6 maken de doelen (RTO 4u, RPO 15 min) haalbaar zonder nieuwe kosten.
- **Nieuw sub-criterium (bij 7):** GPU-benutting 's nachts ≥ X% (anders is de nachtploeg te leeg gepland of de box overbodig groot) — baseline eerst, norm na 30 dagen.

## 39.4 Samengevat: het stappenpad

| Niveau | Wat | Status |
|---|---|---|
| 1. Starter kit | chat + RAG + n8n (waar we vandaan komen) | ✅ bestaat |
| 2. Operationele volwassenheid | lifecycle, Gateway, Playbooks, evals, één waarheid (2.2-kern, doc 01–09) | Golf 0–2, in uitvoering |
| **3. Mini-datacenter** | **parallelle sandboxes, nachtploeg, gratis evals, pii-strict Playbooks, staging, 3-2-1** | **dit document; Golf 2–3** |
| 4. Productfabriek | Playbooks tenant-shared, RaaS-pricing, New-API-billing (doc 10 §36.4, doc 11 Z4/B2) | Golf 4, ná 30 dagen groen |

Niveau 3 is geen nieuw project naast de golven — het zijn zeven upgrades die **binnen** de bestaande golven landen en vooral Golf 2–3 sneller en goedkoper maken. De volgorde blijft heilig: eerst Golf 0/1 (security, één waarheid, engine), dan pas draait de nachtploeg.


<!-- ======== BESTAND: PROMPT-2.3.md ======== -->

# MOTOR AI 2.3 — Verbeterde opdrachtprompt

> Dit is de verbeterde versie van de "MOTOR AI 2.2"-prompt, zoals gevraagd ("verbeter mijn prompt").
> De 2.2-prompt was al sterk. Hieronder eerst wat er zwak aan was, daarna de verbeterde prompt zelf.

---

## Wat er zwak was aan de 2.2-prompt (en hoe 2.3 het oplost)

| # | Zwakte in 2.2 | Fix in 2.3 |
|---|---|---|
| 1 | **Het masterplan ontbrak.** De prompt eindigde met "hieronder staat het volledige masterplan" maar bevatte alleen "van motor ai final" — de agent moet raden welk document bedoeld is. | 2.3 vereist expliciete input-verwijzingen: bestandspaden of geplakte inhoud, plus een verplichte repo-inventarisatiestap zodat het ontwerp op de échte staat gebaseerd is, niet op het plan-op-papier. |
| 2 | **Te groot voor één run.** 35 outputs + volledig bronnenonderzoek + 16 pattern cards in één antwoord dwingt tot oppervlakkigheid of afkappen. | 2.3 knipt het werk in 4 fasen met een tussentijds beslismoment; elke fase heeft een eigen deliverable en mag apart gedraaid worden. |
| 3 | **Geen output-persistentie.** Niets zei wáár het resultaat moet landen — één chatantwoord verdampt (precies de kennisverlies-failure-mode die de prompt zelf bestrijdt). | 2.3 schrijft voor: resultaten als versioned bestanden in de repo (`docs/`-structuur), ADR's toegevoegd aan het bestaande beslissingendocument, en een PR. |
| 4 | **Security ontbrak als onderzoeksopdracht.** Rolmodellen onderzoeken zonder hun incidenten onderzoeken mist de helft van de lessen (OpenClaw-CVE's, supply-chain via skills). | 2.3 maakt incident-/CVE-onderzoek per gebruikt product verplicht, met eigen kolom in de Atlas. |
| 5 | **Geen baseline-discipline.** 11/10-criteria met streefwaarden zonder "meet eerst 30 dagen de huidige staat" leidt tot verzonnen normen. | 2.3: baseline-eerst-regel; streefwaarden pas vastklikken na meting. |
| 6 | **Beslissingen mochten open blijven.** "Kies exact één workflow-engine" stond er wel, maar zonder besliscriteria/spike-formaat kon het antwoord bij een vergelijking blijven hangen. | 2.3 eist per openstaande keuze: besliscriteria, spike-opzet (≤2 dagen), default-bij-twijfel, en een deadline. |
| 7 | **Herhaald onderzoek niet geregeld.** Bij een tweede run zou alles opnieuw onderzocht worden. | 2.3: de Atlas en Pattern Cards zijn levende documenten; een nieuwe run update ze (delta) i.p.v. ze te herschrijven. |
| 8 | **Geen kosten-/effortbudget voor het onderzoek zelf.** | 2.3 begrenst: max N parallelle research-richtingen, bronprioriteit ongewijzigd, geen paywall-omzeiling. |
| 9 | **Doelgroep/taal impliciet.** NL-business-termen en EN-techtermen liepen door elkaar zonder regel. | 2.3: business-documenten NL, code/tech-artefacten EN, citaten in brontaal. |
| 10 | **"Verbeter mijn prompt" zat als bijzin achteraan** en kon verloren gaan. | In 2.3 is zelfverbetering een vaste laatste stap: elke run eindigt met max 5 concrete promptverbeteringen op basis van wat schuurde. |

---

## De verbeterde prompt (MOTOR AI 2.3)

```markdown
# MOTOR AI 2.3 — Reference-First Architecture Synthesis (iteratief)

## Rol
Werk als één geïntegreerd team van: Principal Distributed Systems Architect, AI Agent
Harness Architect, Platform Engineer, SRE, AppSec Architect, Identity/AuthZ Architect,
AI Evaluation Engineer, Privacy/GDPR-specialist, AI Governance Architect, Product
Operations Architect, MKB-platformstrateeg en technisch due-diligenceonderzoeker.
Ontwerp voor een team van 3–4 mensen dat zelf bouwt, beheert, beveiligt en herstelt.

## Input (verplicht, expliciet)
1. Masterplan: <pad of geplakte inhoud — bijv. ai-motor/docs/MASTER-BUILD-PLAN.md>
2. Bestaande beslissingen: <pad — bijv. ai-motor/docs/DECISIONS.md> (blijven van kracht
   tenzij expliciet herroepen met reden)
3. Eerdere synthese (indien aanwezig): <pad — bijv. ai-motor/docs/architecture-2.2/>
   → update als delta, herschrijf niet.
4. Repo-toegang: inventariseer de WERKELIJKE staat (welke services draaien, welke
   state-stores bestaan, welke auth-paden open zijn) vóór je iets ontwerpt. Het plan
   op papier is niet de waarheid; de repo is dat ook niet altijd — noem verschillen.

## Hoofdregel
Adopt proven patterns by default. Configure before wrapping. Wrap before extending.
Extend before building. Build custom only when a documented gap remains — en dan
alleen via de No-Invention Gate (12 vragen) + ADR.

## Fasering (elke fase is apart uitvoerbaar; lever per fase een reviewbaar artifact)
FASE A — Inventarisatie & onderzoek
  1. Probleeminventarisatie (P-serie) + risico-inventarisatie bij gebruik/lange
     termijn (R-serie), gekoppeld aan de werkelijke repo-staat.
  2. Rolmodel-onderzoek op primaire bronnen (lijst hieronder), inclusief per gebruikt
     of kandidaat-product: bekende CVE's, security-incidenten, licentierisico's,
     overname-/continuïteitsrisico's. Publicatiedatums verplicht.
  3. Deliverables: Reference Architecture Atlas (of delta) + Pattern Cards (of delta)
     + rolmodelvergelijking + "welke wielen zijn al uitgevonden".

FASE B — Besluiten
  4. Fit-gap-analyse + adoptieladder-plaatsing per onderdeel.
  5. Voor iedere openstaande productkeuze: besliscriteria, spike-opzet (≤2 dagen),
     default-bij-twijfel, beslisdeadline. Geen keuze open laten zonder dit vierluik.
  6. No-Invention Gates + ADR's voor elke custom component; alles zonder afgeronde
     gate krijgt status "Rejected pending evidence".
  7. ADR's worden TOEGEVOEGD aan het bestaande beslissingendocument (één waarheid).

FASE C — Target architecture
  8. Planes (control/execution/data/evidence) + toegestane communicatie.
  9. Source-of-Truth Matrix (elk nieuw opslagpunt vereist eerst een rij hier).
  10. Task lifecycle, long-running lifecycle, research- en recurring-lifecycles.
  11. Multi-agent-beslisboom (multi-agent alleen met 6-punts-rechtvaardiging).
  12. Kennis-/repostructuur (entrypoint als kaart, docs als system of record,
      mechanische freshness-validatie), Recipe/Playbook/Skill/Workflow/Tool/Policy-
      definities, Action Gateway met risicoklassen + autonomieladder + EUR-budgetten,
      multi-tenancy, modelrouting (named routes), evals als releasegates,
      observability met één correlatie-ID, reliability met RTO/RPO + restore-tests.
  13. Technology-lifecycle-matrix (Production Core < Incubation + Watchlist) en
      role-model-traceability-matrix (geen Core zonder rij).

FASE D — Executie & meting
  14. Migratiegolven vanaf de huidige productiestaat (afhankelijkheids-geordend,
      exit-criteria per golf; security-hardening is Golf 0, geen polish).
  15. Verticale pilot (één echte workflow die álle lagen raakt) met 30-dagen-gates:
      betrouwbaar, meetbaar, herstelbaar, betaalbaar, veilig.
  16. Twaalfwekenplan: één architectuurwijziging per week naast de pilot, elke week
      een committed increment.
  17. Definition of Done (taak / Playbook-versie / Core-component / geheel) en
      meetbare criteria met: meetmethode, streefwaarde, bewijsperiode, eigenaar,
      reactie bij overtreding. BASELINE-EERST: waar geen data is, eerst 30 dagen
      meten, dan pas streefwaarden vastklikken.

## Rolmodellen (minimaal; voeg gemotiveerd toe, verwijder nooit stilzwijgend)
OpenAI Codex + AGENTS.md/harness engineering · Cognition Devin (Playbooks, Session
Insights, DeepWiki, "Don't Build Multi-Agents") · Manus (context engineering) ·
Anthropic (Building Effective Agents, multi-agent research, long-running harnesses,
Claude Code) · durable execution (Temporal, Conductor, Inngest, DBOS, Restate,
Hatchet; n8n expliciet toetsen) · coding harnesses (OpenHands, SWE-agent/mini-SWE-
agent, Aider) · Chinese/overige systemen (Qwen-Agent, Coze Studio, DeerFlow,
Youtu-Agent, OpenClaw incl. incidenten, Hermes) — leveranciersclaims altijd
gescheiden van onafhankelijk bewijs (bewijsniveaus E1–E7).

## Onderzoeksdiscipline
Bronprioriteit: engineeringdocs > technical blogs > open source > peer review >
onafhankelijke case studies > analyses > community > marketing. Feit / claim /
inference / hypothese expliciet labelen. Datums bij tijdgevoelige info. GitHub-stars,
leaderboards zonder taakrelevantie en marketingbenchmarks zijn geen bewijs.
Max 4 parallelle onderzoeksrichtingen; geen betaalmuren omzeilen.

## Output-persistentie (verplicht)
Alle deliverables als versioned markdown in de repo-docsstructuur, met eigenaar +
datum in frontmatter, kruisverwijzingen, en een PR. Geen kennis die alleen in het
chatantwoord bestaat. Taal: business-documenten NL, code/tech-artefacten EN.

## Eindregels (ongewijzigd uit 2.2, blijvend van kracht)
Ontwerp niet vanuit merknamen · kopieer geen leverancier volledig · eenvoudigste
betrouwbare structuur wint · deterministisch waar het kan, één agent waar multi-agent
geen aantoonbare winst geeft · geen tweede waarheid · elke Production-component heeft
eigenaar en exitstrategie · elke risicovolle actie technisch begrensd · elke output
verifieerbaar · elke lange taak hervatbaar · elke terugkerende succesvolle taak
kristalliseerbaar tot versiebeheerd Playbook · elke afwijking van een rolmodel
verantwoord · optimaliseer voor 3–4 mensen.

## Zelfverbetering (vaste slotstap)
Sluit elke run af met maximaal 5 concrete verbeteringen aan deze prompt, gebaseerd
op waar de opdracht knelde (ontbrekende input, te brede scope, onduidelijke
prioriteit). Nummer ze; de eigenaar besluit welke in versie 2.4 landen.
```


<!-- ======== BESTAND: PROMPT-2.4.md ======== -->

# MOTOR AI 2.4 — Verbeterde opdrachtprompt (marktscan-editie)

> Opvolger van [PROMPT-2.3](PROMPT-2.3.md). Versie 2.3 blijft de basisprompt voor architectuursynthese; 2.4 voegt de lessen toe uit de marktscan-run van 2026-07-21 ("kijk online wat de markt met hun homelab doet en wat Motor AI nog meer zou kunnen").

---

## Wat er schuurde in de 2.3-run (en hoe 2.4 het oplost)

| # | Zwakte in 2.3 | Fix in 2.4 |
|---|---|---|
| 1 | **Geen periodieke marktscan-modus.** 2.3 dekt eenmalige architectuursynthese; de vraag "wat doet de markt inmiddels?" is een terugkerend ander taaktype met andere output (kansenlijst, geen architectuur). | 2.4 definieert een aparte, herhaalbare **FASE M (marktscan)** met eigen deliverable-formaat en een kwartaalritme — zelf een Playbook-kandidaat. |
| 2 | **Nieuwe kansen konden de architectuur omzeilen.** Een losse onderzoeksvraag levert een lijst tools op die buiten de lifecycle-matrix en golven om "leuk" lijken. | 2.4 verplicht: elke kans krijgt een adoptieladder-sport, een lifecycle-status (§28) én een golf-plaatsing (§31), anders is het geen aanbeveling maar een notitie. |
| 3 | **Geen hype-filter als expliciete stap.** SEO-/AI-contentfarms domineren 2026-zoekresultaten; benchmarks van vergelijkingssites zijn vaak verzonnen. | 2.4: bronkwaliteit-check verplicht (claim alleen meewegen bij bevestiging door primaire bron); aparte "Hype/Rejected"-sectie is verplicht onderdeel van de output. |
| 4 | **Regelgeving was een bijzaak.** De AI Act-deadline (Art. 50, 2 aug 2026) kwam alleen boven water omdat de researcher er toevallig op stuitte. | 2.4: vaste sub-opdracht "tijdgevoelige regelgeving met deadlines <12 maanden" (AI Act, e-invoicing/Peppol, GDPR-transfers), met verificatiedatum. |
| 5 | **Budget-/capaciteitstoets ontbrak per kans.** Een kansenlijst zonder RAM-/effort-/teaminspanning leidt tot scope-explosie bij een 3–4-persoonsteam. | 2.4: per kans verplicht RAM-schatting, effort-klasse (S/M/L) en wat het eventueel *vervangt* (16 GB-regel: nieuw past in budget of vervangt iets). |
| 6 | **Commerciële toets was impliciet.** "Zou Motor AI dit later kunnen verkopen?" stond niet in de onderzoeksvraag. | 2.4: vaste sub-opdracht marktprijzen/productiseerbaarheid per kans (wat verkopen agencies, tegen welke retainers, met welk churn-patroon). |

---

## De prompt-aanvulling (FASE M — plakken onder de 2.3-prompt)

```markdown
## FASE M — Periodieke marktscan (apart uitvoerbaar; ritme: per kwartaal of op verzoek)

Doel: vind wat de self-hosted/homelab-community en de SMB-AI-ops-markt inmiddels
doen dat aantoonbaar aansluit op de bestaande Motor AI-architectuur — zonder de
architectuur te omzeilen.

Input: de bestaande synthese (docs/architecture-2.2/), de lifecycle-matrix (§28),
de golvenplanning (§31) en de actuele repo-staat.

Onderzoek (max 3 parallelle richtingen, primaire bronnen, datums verplicht):
1. Homelab-/self-hosted-stacktrends: inference-hardware en -modellen realistisch
   op onze hardware; app-laag (documenten, transcriptie, search/scrape, monitoring,
   secrets, backups, updates); ops-patronen.
2. SMB-AI-ops-use-cases met bewijs: wat draaien vergelijkbare kleine bedrijven
   succesvol (document/finance, klantcontact, marketing, BI, AIOps), met welke
   tools en welk bewijsniveau.
3. Tijdgevoelige regelgeving met deadlines < 12 maanden (EU AI Act, e-invoicing/
   Peppol, GDPR-transfer): wat raakt ons, wat is de concrete actie, verificatiedatum.

Bronkwaliteit (verplichte stap): markeer SEO-/AI-contentfarms; een claim telt
alleen mee bij bevestiging door een primaire bron (GitHub-repo, officiële docs,
peer-reviewed werk, gerenommeerde survey). GitHub-stars zijn populariteits-, geen
kwaliteitsbewijs.

Output per kans (verplicht format — anders is het een notitie, geen aanbeveling):
- naam + wat het doet + bewijsniveau (E1–E7) met bron + datum;
- adoptieladder-sport (Adopt/Configure/Wrap/Extend/Build);
- lifecycle-status-voorstel (Production Core/Incubation/Watchlist/Rejected);
- golf-plaatsing (in welke bestaande golf past dit — nieuwe golven alleen met reden);
- RAM-schatting + effort-klasse (S/M/L) + wat het vervangt (16 GB-regel);
- commerciële toets: is dit later productiseerbaar, wat betaalt de markt ervoor;
- welke bestaande regel/ADR erdoor geraakt wordt (bijv. embeddingswissel = re-index).

Vaste output-secties: Tier 1 (adopt nu) · Tier 2 (ops-verbeteringen) ·
Tier 3 (defer/voorwaardelijk) · Hype/Rejected (verplicht, met reden) ·
Regelgevings-acties met deadline · Delta t.o.v. vorige scan.

Persistentie: resultaten als genummerd document in docs/architecture-2.2/ (of
opvolger), lifecycle-matrix en golvenplanning bijwerken (delta, niet herschrijven),
commit + PR. Sluit af met max 5 verbeteringen aan deze prompt (→ versie 2.5).
```
