# Motor AI 2.2 — Reference-First Architecture Synthesis

> **Versie:** 2026-07-27 · **Eigenaar:** Pietje · **Status:** Geconsolideerd volgens AM-1 t/m AM-5
> **Vervangt niet:** [`../MASTER-BUILD-PLAN.md`](../MASTER-BUILD-PLAN.md) (infra-plan blijft geldig als Golf 0/1) — dit document is de **architectuurlaag erboven**.
> **Methode:** Reverse-engineering van bewezen rolmodellen (OpenAI Codex, Cognition Devin, Manus, Anthropic, OpenHands, SWE-agent, Claude Code, Qwen-Agent, Coze Studio, DeerFlow, Youtu-Agent, OpenClaw, Hermes, Temporal/Inngest/DBOS/Restate/Hatchet/Conductor) op basis van primaire bronnen, daarna pas ontwerp.

## Hoofdregel

**Adopt proven patterns by default. Configure before wrapping. Wrap before extending. Extend before building. Build custom only when a documented gap remains.**

## Beginpunt en leeswijzer

Start bij [`00-START-HIER.md`](00-START-HIER.md), controleer daarna de feitelijke staat in [`00-HUIDIGE-STAAT.md`](00-HUIDIGE-STAAT.md) en beslissingen in [`../DECISIONS.md`](../DECISIONS.md). Onderstaande documenten zijn verdieping.

**Documentbevriezing:** geen doc 16+ en geen PROMPT-2.5 tot drie Playbooks productie draaien. Nieuwe inzichten gaan als kort delta-memo naar doc 15.

### Oorspronkelijke outputvolgorde (35 onderdelen)

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
| 40 | Stack-aanvullingen: creatieve laag, e-mail/agenda, CRM (2026-07-22) | [`14-stack-aanvullingen.md`](14-stack-aanvullingen.md) |
| 41 | **Review-panel (4 onafhankelijke inspecties) + bindende amendementen AM-1..5** (2026-07-23) | [`15-review-panel.md`](15-review-panel.md) |

> **Bindende volgorde:** [`../DECISIONS.md`](../DECISIONS.md) bevat ADR-101–109; [doc 15](15-review-panel.md) bevat AM-1–5 en het conflictregister. De inhoud van doc 01–14 is op 2026-07-27 daarmee geconsolideerd.

## Bewijsniveaus (gebruikt in alle documenten)

1. **E1** — Onafhankelijk production-proven
2. **E2** — Officieel productiongebruik gedocumenteerd
3. **E3** — Officiële leveranciersclaim
4. **E4** — Open-source implementatie beschikbaar
5. **E5** — Communityervaring
6. **E6** — Architectuurinference
7. **E7** — Onbewezen hypothese

## Kern van het oordeel in één alinea

Het masterplan is een bruikbaar infrastructuurplan; de 2.2-laag voegt lifecycle, bewijs, één taskprojectie en technische policy toe. De actuele repo heeft chat/conversation-auth inmiddels dicht in code, maar OpenClaw-hardening, ADR-002-cutover en live runtimebewijs zijn open. Voor één technicus geldt de minimale variant: acht Core-componenten, vijf actieve criteria, K2→K1→migratie→dagbrief, engine/Kernel/Gateway op Hetzner, NUC als kanaal/UI-orchestrator en de 3090-PC uitsluitend als stateless lokale LLM-worker.
