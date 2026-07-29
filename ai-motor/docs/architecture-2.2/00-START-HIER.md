# 00 — START HIER · Motor AI 2.2

> **Eigenaar:** Pietje · **Datum:** 2026-07-27 · **Status:** Definitief uitvoeringsentrypoint
> **Voor wie:** één technicus + 2–3 niet-technische helpers

## In 60 seconden

Motor AI heeft bruikbare app-, auth-, Qdrant-, Postgres- en Inngest-delen, maar is nog geen complete agent-runtime: OpenClaw-hardening is niet live bewezen, ADR-002 M4 (Postgres als SSOT) is in code niet gehaald en Motor Kernel/Action Gateway bestaan nog niet. De NUC is de informele kanaal/UI-orchestrator; durable engine, Kernel en Gateway horen op Hetzner naast Postgres; de Ryzen 7/32 GB/RTX 3090-PC wordt een stateless lokale LLM-worker. SSH en actuele NUC/Hetzner-metingen ontbreken. Daarom geldt: eerst toegang en Golf 0 live groen, daarna K2 en K1 op de bestaande stack; de inference-PC krijgt geen taak vóór SSH, runbook en Gateway/policy.

## Niet opnieuw beslissen

| Waarheid | Canonieke plek |
|---|---|
| Feitelijke repo-/runtimestaat | [`00-HUIDIGE-STAAT.md`](00-HUIDIGE-STAAT.md) |
| ADR-001/002 en ADR-101–109 | [`../DECISIONS.md`](../DECISIONS.md) |
| Bindende scope/volgorde AM-1–5 | [`15-review-panel.md`](15-review-panel.md) |
| Infra-uitvoering Golf 0/1 | [`../MASTER-BUILD-PLAN.md`](../MASTER-BUILD-PLAN.md) |
| Verdiepend ontwerp | Doc 01–14 in deze map |

Bij een nieuw runtimefeit wordt `00-HUIDIGE-STAAT.md` bijgewerkt. Bij een besluit wijzigt `DECISIONS.md`. Tijdens de documentbevriezing gaat een nieuw architectuurinzicht als delta naar doc 15.

## Topologie

| Machine | Rol | Draait daar | Niet daar |
|---|---|---|---|
| **NUC** | Kanaal/UI, informeel “orchestrator” | Motor-app, gehard OpenClaw, Telegram/kanalen, local-executor-glue, ingress | Durable engine, Kernel, Gateway, zware inference |
| **Hetzner** | Data + durable control | Postgres, engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter, monitoring-hub | Frontier/local inference |
| **Inference-PC** | Stateless execution | Later: lokale provider-tiers via LiteLLM | DB, publiek endpoint, eigen taskstate; vóór SSH+Gateway helemaal geen taken |

## Wat er deze week gebeurt

1. **Toegang en Golf 0:** SSH/hostnamen vastleggen; NUC/Hetzner live meten; auth 401/403 bewijzen; OpenClaw versie/bind/token/origin/allowlist hardenen; secrets inventariseren.
2. **ADR-002 eerlijk maken:** productieflags en SQLite↔PG-rijtellingen meten; M4 aantoonbaar afronden of expliciet herplannen in `DECISIONS.md`.
3. **K2 review-automation (#1):** op bestaande n8n; Telegram alleen notificatie+deeplink, approval in Motor UI; bewust wegwerp.
4. **Geen inference-PC-werk:** alleen hardwaregegevens/SSH voorbereiden; geen modelserver of taak vóór Gateway/policy.

Daarna blijft AM-2 bindend:

| Venster | Uitvoering |
|---|---|
| Week 2–4 | K1 bonnetjes→Moneybird v1 (#2), cloud-tier `extract`, iedere boeking handmatig approven |
| Week 3–5 | Maximaal één architectuurdag/week: Inngest bevestigen, ADR-108/109-acceptatie en Kernel-tabellen |
| Week 5–7 | ComfyUI alleen als Playbook #1 al 30 dagen groen is; anders opschuiven |
| Week 6–9 | Gateway v1 groen; daarna K1/K2 migreren — dit is de architectuurtest |
| Week 9–12 | Dagbrief als Playbook #3, volledige inhoud in Motor UI |

Dertig dagen groen blokkeert geen nieuw A1-werk; het blokkeert autonomiepromotie. De AM-1-scopefreeze hieronder blijft wel gelden tot Playbook #1 dertig dagen groen is.

## Wat bevroren is

> Geen doc 16+, geen nieuwe promptversie, geen nachtploeg, sandbox-vloot, staging-stack, ComfyUI, e-mail/agenda, CRM-tabellen, TTS, MinerU, reranker, Chinese routes, Playbook-registry, doc-freshness-CI of adversarial-review-stap — tot Playbook #1 dertig dagen groen draait. Nieuwe inzichten gaan als kort delta-memo naar doc 15, niet als nieuw document.

Uitzonderingen: een ingest-batch mag vóór ontdooiing; een tijdelijke restore-container is geen staging-stack; Playbooks mogen als git-map met statuskolom bestaan.

## De vijf actieve meetcriteria

| # | Criterium | Minimale regel |
|---|---|---|
| 1 | Task-success | % zonder handmatige reparatie |
| 2 | Menselijke correcties | ≤2 per 10 voor A2+ |
| 3 | Ongeautoriseerde acties | **0**, automatisch gemeten |
| 7 | Kosten per succesvolle taak | Binnen vastgesteld Playbookbudget |
| 16 | Operatorvertrouwen | Eigenaar-score ≥8 voor A3 |

De overige twaalf criteria uit doc 09 zijn observaties zonder gate-status tot minstens drie Playbooks productie draaien.

## Lees alleen wat je nodig hebt

| Document | Waarom lezen |
|---|---|
| [`00-HUIDIGE-STAAT`](00-HUIDIGE-STAAT.md) | Voor feiten, onbekenden en exacte live meetcommando’s |
| [`README`](README.md) | Voor de index en bewijsniveaus |
| [`01`](01-executive-oordeel.md) | Voor het probleem, risicobeeld en n=1-oordeel |
| [`02`](02-reference-atlas.md) | Om te zien welk bewezen patroon bij een probleem hoort |
| [`03`](03-pattern-cards.md) | Voor het compacte ontwerpcontract van een patroon |
| [`04`](04-fit-gap-en-adoptieladder.md) | Om zelfbouw te voorkomen en No-Invention Gates te controleren |
| [`05`](05-target-architecture.md) | Voor topologie, SoT, lifecycle, Gateway en de acht routes |
| [`06`](06-evals-observability-reliability.md) | Voor releasegates, tracing, RPO/RTO en incidentgedrag |
| [`07`](07-lifecycle-en-traceability.md) | Voor Core/Incubation/Watchlist en de ADR-index |
| [`08`](08-migratie-pilot-twaalfweken.md) | Voor de uitvoeringsvolgorde K2→K1→migratie→dagbrief |
| [`09`](09-definition-of-done-11-10.md) | Voor Definition of Done en de vijf actieve criteria |
| [`10`](10-marktscan-homelab-kansen.md) | Voor K1/K2, EUR/payback en marktcontext |
| [`11`](11-azie-next-level.md) | Alleen als referentie voor later bevroren ingest/routingkansen |
| [`12`](12-hardware-3090.md) | Voor hardwarevoorwaarden en de stateless inference-rol |
| [`13`](13-mini-datacenter-upgrade.md) | Om te zien welke hardware-ideeën juist níet nu mogen |
| [`14`](14-stack-aanvullingen.md) | Voor de expliciet bevroren uitbreidingslijst |
| [`15`](15-review-panel.md) | Voor AM-1–5, conflictregister en nieuwe delta’s |
| [`PROMPT-2.3`](PROMPT-2.3.md) | Alleen als herbruikbaar architectuur-reviewformat |
| [`PROMPT-2.4`](PROMPT-2.4.md) | Alleen voor een latere marktscan-delta; geen nieuwe promptversie |
| [`MASTER-BUILD-PLAN`](../MASTER-BUILD-PLAN.md) | Voor bestaande infra-/migratietaken, niet voor de actuele volgorde |
| [`DECISIONS`](../DECISIONS.md) | Altijd vóór engine-, data-, Gateway- of topologiewerk |

## Operationele runbooks

- Postgres/cutover: [`fase1-postgres.md`](../fase1-postgres.md) + [`nuc-readiness.md`](../nuc-readiness.md)
- NUC↔Hetzner: [`hybrid-env.md`](../hybrid-env.md) + [`hetzner-migration.md`](../hetzner-migration.md)
- Approvals: [`approval-runbook.md`](../approval-runbook.md)
- Live bewijs: [`motor-test-playbook.md`](../motor-test-playbook.md)

**Startregel voor iedere medewerker of agent:** lees dit bestand, controleer daarna `00-HUIDIGE-STAAT`, en voer alleen de eerstvolgende niet-geblokkeerde regel uit.
