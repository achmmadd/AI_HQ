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
