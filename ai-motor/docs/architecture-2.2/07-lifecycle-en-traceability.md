# 28–30. Technology lifecycle matrix · Role-model traceability matrix · Architecture Decision Records

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2](README.md). De canonieke ADR-tekst staat in [`../DECISIONS.md`](../DECISIONS.md).

---

## 28. Technology lifecycle matrix

Statussen: **Production Core** · **Incubation** · **Watchlist** · **Rejected** · **Decommissioning**. AM-1 stelt een hard maximum van acht Core-componenten; composietonderdelen zoals Drizzle/RLS tellen onder hun parent.

| Component | Status | Eigenaar | Toelichting / voorwaarden |
|---|---|---|---|
| Postgres incl. Drizzle/RLS (Hetzner) | **Production Core 1/8** | Pietje | SSOT; restore-test + isolation-eval |
| Qdrant | **Production Core 2/8** | Pietje | tenant-guard verplicht |
| LiteLLM | **Production Core 3/8** | Pietje | exact acht routes; `local` als provider-tier |
| Langfuse Cloud | **Production Core 4/8** | Pietje | EU-regio+DPA; PII alleen metadata/kosten |
| Canonieke engine (ADR-101) | **Production Core 5/8 na spike** | Pietje | standalone op Hetzner; verliezer Rejected |
| Motor-app | **Production Core 6/8** | Pietje | UI/kanaalhost op NUC; auth live bewijzen |
| OpenClaw gateway | **Production Core 7/8 na hardening** | Pietje | ADR-106; anders Incubation |
| Tailscale | **Production Core 8/8** | Pietje | private machineverbinding |
| Motor Action Gateway | **Incubation** | Pietje | ADR-109; geen Core-promotie in minimale variant |
| Motor Kernel/API | **Incubation** | Pietje | Hetzner, task-projectie uit engine-events |
| Telegram + Cloudflare Tunnel | **Incubation** | Pietje | kanaal/ingress; Telegram link-only |
| Ollama + inference-PC | **Incubation** | Pietje | stateless execution; geen taken vóór Gateway/policy |
| Redis/object storage | **Incubation** | Pietje | ondersteuning, nooit SSOT; concrete retentie vereist |
| Playbook/Skill-registry | **Bevroren** | Pietje | git-map + statuskolom volstaat |
| Eén gecontroleerde coding-sandbox | **Incubation** | Pietje | parallelle sandbox-vloot bevroren tot AM-1-gate |
| agent-browser/Stagehand | **Incubation** | Pietje | on-demand en via Gateway |
| DBOS of Inngest (spike-verliezer) | **Rejected na spike** | — | gedocumenteerde reden in ADR-101 |
| n8n | **Decommissioning als orchestrator; blijft als integratie-adapter** | Pietje | nooit state-eigenaar; flows migreren per Golf 2–3 |
| Dify | **Decommissioning** — datum: einde Golf 3 | Pietje | 4–6 GB RAM voor overlappende functie; builder-flows migreren naar engine/Playbooks |
| SQLite (ai-motor) | **Decommissioning** (ADR-002 M6, 2026-08-09) | Pietje | bestaand besluit |
| EXECUTION_BOARD.db | **Decommissioning** — Golf 1 | Pietje | tweede task-waarheid |
| factory_brains/Chroma | **Decommissioning** — Golf 1 | Pietje | tweede vectorwaarheid |
| Omega/holding/evomap/factory-os/singularity | **Decommissioning** | Pietje | bevriezen → 30 dagen → verwijderen; niet inventariseren/migreren |
| LightRAG / Cognee / graph-memory | **Watchlist** | — | geen taak aangetoond die graph-reasoning vereist (opdracht §17) |
| Temporal (Cloud) | **Watchlist** | — | pas bij >duizenden runs/dag of multi-service |
| Hatchet / Restate | **Watchlist** | — | herzien bij ADR-101-review |
| Coze Studio-patronen | **Watchlist** | — | compile/runtime-split noteren voor later |
| DeerFlow (research-referentie) | **Watchlist** | — | patroon geadopteerd, product niet |
| Hermes-agent | **Watchlist** | — | FTS-memory-patroon geadopteerd |
| Youtu-Agent YAML-configs | **Watchlist** | — | idee voor agent-config-formaat |
| Mastra/VoltAgent/LangGraph/CrewAI | **Rejected** (bestaand besluit, bevestigd) | — | frameworks lossen ons probleem niet op; Anthropic: patronen > frameworks |
| Lokale chat-LLM op NUC/Hetzner | **Rejected** | — | alleen de inference-PC mag `local` provider-tier leveren binnen de acht routes |
| ClawHub-skills / community-skills | **Rejected** | — | ClawHavoc-supply-chain (E1); alleen eigen git |
| Manus (product) | **Rejected** | — | opgekocht door Meta; patronen geadopteerd, product niet |
| Eigen agent-framework / workflow-DSL / vector-DB / IdP | **Rejected pending evidence** | — | No-Invention Gate niet doorlopen |

**Telling:** 8 Core; alle overige componenten zijn Incubation, bevroren, Watchlist, Rejected of Decommissioning.

---

## 29. Role-model traceability matrix

De laatste kolom maakt AI-Act-/human-oversight-impact expliciet; “n.v.t.” betekent dat de component zelf geen klantinteractie of high-risk use case introduceert.

| Component | Patroon | Rolmodel | Direct | Motor-aanpassing | Reden | Bewijs | Status | AI Act / disclosure |
|---|---|---|---|---|---|---|---|---|
| Task lifecycle | delegatie + verificatie | Devin/Codex/Anthropic | ja | R0–R3 + outcome-review | tenant/geld | E2 | Ontwerp | Art. 50-check vóór publicatie |
| Long-running | initializer/increment | Anthropic | ja | businesschecklist | breder domein | E2/E4 | Ontwerp | n.v.t. |
| Research | orchestrator-worker | Anthropic/DeerFlow | ja | EUR-cap | kosten | E2 | Ontwerp | disclosure bij klantoutput |
| Motor Kernel | event-projectie | OpenHands/eigen | patroon | reconciliation+states+leases | domeinspecifiek | NIG-3 | ADR-104/108 | audit/human oversight |
| Canonieke engine | durable execution | Inngest/DBOS | ja | drie-node-spike | incumbent bevestigen | E1/E2/E4 | ADR-101 | n.v.t. |
| Action Gateway | credential-broker | Claude/Codex/SWE | principe | budget+hash+tenant | cross-harness | NIG-1 | ADR-102/109 | gate 7 afdwingen |
| Autonomieladder | approval-modes | Codex/Claude/Devin | ja | per Playbook×tenant | bewijs nodig | E2 | Ontwerp | human oversight |
| CEO-harness | contextdiscipline | Manus/Claude | ja | — | — | E3 | Ontwerp | disclosure als klantgericht |
| Code-agent | bestaande CLI | Codex/Claude/OpenHands | ja | geen eigen harness | eenvoud | E1–E4 | Ontwerp | n.v.t. |
| Sandboxing | container/action-server | Codex/OpenHands | ja | één sandbox; vloot bevroren | n=1 | E2/E4 | Incubation | n.v.t. |
| Kennisstructuur | AGENTS+docs-SSOT | Codex/agents.md | ja | freshness-CI bevroren | n=1 | E1/E2 | In uitvoering | Art. 9-bronnen labelen |
| Playbooks | Devin-format | Devin | ja | git-status; registry bevroren | AM-1 | E2 | ADR-103 | use-caseclassificatie per Playbook |
| Skills | markdown+frontmatter | OpenHands/Claude/Hermes | ja | geen externe registry | supply chain | E1/E4 | Ontwerp | n.v.t. |
| Learning-loop | Session Insights | Devin/Hermes | ja | menselijke review | kennisveiligheid | E2/E4 | Ontwerp | geen ongecontroleerde training |
| HITL | durable waits | Inngest/DBOS/Temporal | ja | UI; Telegram link-only | AM-4 | E2/E4 | Ontwerp | identiteitsgebonden toezicht |
| Multi-tenancy | RLS+payloadfilter | industrie | ja | isolation-evals | bewijsplicht | E1 | Deels gebouwd | Art. 9 per tenant/DPIA |
| Modelrouting | acht routes | LiteLLM/Anthropic | ja | local-tier+budget | route-sprawl | E4/E5 | Gepland | dataklasse bepaalt tier |
| Observability | correlatie-ID | Anthropic/Langfuse | ja | EU+DPA; PII metadata-only | AM-4 | E2 | Gepland | geen PII-content |
| Evals | judge+end-state | Anthropic | ja | vijf actieve criteria | AM-1 | E2 | Ontwerp | Art. 50 is gate 7 |
| SoT-matrix | eventlog+outbox | OpenHands/industrie | ja | retentie/delete | Art. 17 | E1/E4 | Ontwerp | AI-Act-records traceerbaar |
| Kanaal-gateway | hardened WS | OpenClaw | patroon | secure-by-default | incidenten | E1 | Hardening open | Art. 50 op klantinterface |
| K1/K2-migratie | architectuurtest | eigen | — | week 6–9 | waarde eerst | — | AM-2 | human approval K1 |
| Bokas-brief | Playbook #3 | eigen | — | week 9–12 | niet #1 | — | AM-2 | intern; geen Art. 50 |

**Regel:** component zonder rij in deze matrix mag niet naar Production Core.

---

## 30. Architecture Decision Records

[`../DECISIONS.md`](../DECISIONS.md) is de enige canonieke ADR-tekst. Deze sectie is alleen de architectuurindex:

ADR-001–003 staan in dezelfde `DECISIONS.md`-index; onderstaande tabel beperkt zich tot ADR-101–109.

| ADR | Onderwerp | Geldende status |
|---|---|---|
| ADR-101 | Canonieke engine | Inngest max. 3 architectuurdagen in week 3–5; DBOS 3–5 dagen alleen bij trigger, zie DECISIONS |
| ADR-102 | Motor Action Gateway | NIG-1/omvang besloten; enforcementmodel vervangen door ADR-109 |
| ADR-103 | Playbook/Skill-model | Git-formaat besloten; registry-implementatie bevroren door AM-1 |
| ADR-104 | Motor Kernel | Besloten: Hetzner-API, event-projectie, reconciliation, extra states en leases |
| ADR-105 | Orchestratorconsolidatie | Besloten: engine enige durable orchestrator; OpenClaw kanaal, n8n adapter, Dify uit |
| ADR-106 | OpenClaw-hardening | Besloten en releasevoorwaarde; runtimebewijs nog open |
| ADR-107 | Geen tweede memory-laag | Besloten; LightRAG/Cognee blijven Watchlist zonder taak+eval |
| ADR-108 | Runtime-topologie | Besloten: engine+Kernel+Gateway op Hetzner; NUC kanalen/UI; PC inference |
| ADR-109 | Gateway-enforcement | Besloten: credential-broker/proxy, fail-closed R1+, transactie+hash+idempotency |

Wijzig een ADR uitsluitend in `DECISIONS.md`; werk deze index in dezelfde PR bij.
