# AGENTS.md — AI_HQ / Motor AI

> **Eigenaar:** Pietje · **Datum:** 2026-07-31
> Dit bestand is een kaart. Het navigatie-entrypoint is [`ai-motor/docs/architecture-2.2/00-START-HIER.md`](ai-motor/docs/architecture-2.2/00-START-HIER.md); uitvoering volgt uitsluitend de actuele grenzen in `00-HUIDIGE-STAAT.md` en `DECISIONS.md` en vereist de daar genoemde voorafgaande Pietje-goedkeuring.

## Verplichte leesvolgorde

1. Lees `ai-motor/docs/architecture-2.2/00-START-HIER.md`.
2. Lees `ai-motor/docs/architecture-2.2/00-HUIDIGE-STAAT.md`; controleer meetdatum en onbekenden.
3. Lees `ai-motor/docs/DECISIONS.md` vóór data-, engine-, Gateway- of topologiewerk.
4. Lees `ai-motor/docs/architecture-2.2/15-review-panel.md` voor AM-1 t/m AM-5.
5. Open daarna alleen de taakrelevante verdiepingsdoc uit de leeskaart in START-HIER.

Geen agent mag een planclaim als runtimefeit presenteren. Repo/config betekent “aanwezig”, niet “draait”.

Geen document in deze repository autoriseert op zichzelf een live actie. Ook read-only SSH, een control-plane-export of een verhoogde read-only meting vereist **vooraf** een aparte, command-specifieke goedkeuring van Pietje. Zonder die goedkeuring blijft het werk lokaal en documentation-only.

## Team en uitvoeringsregel

- Capaciteit: **1 technicus + 2–3 niet-technische helpers**.
- De minimale variant is het plan: maximaal 8 Production Core-componenten en 5 actieve meetcriteria.
- Maximaal één architectuurdag per week naast K1/K2-waardewerk.
- Nederlands voor business/architectuur; Engels voor code, identifiers en codebestandsnamen.
- Een nieuwe architectuurkeuze wijzigt `DECISIONS.md`; een nieuw feit wijzigt `00-HUIDIGE-STAAT.md`.

## Canonieke waarheden

| Onderwerp | Bron |
|---|---|
| Huidige repo/runtime | `ai-motor/docs/architecture-2.2/00-HUIDIGE-STAAT.md` |
| ADR-001/002, ADR-101–109 | `ai-motor/docs/DECISIONS.md` |
| Scope en volgorde AM-1–5 | `ai-motor/docs/architecture-2.2/15-review-panel.md` |
| Infra Golf 0/1 | `ai-motor/docs/MASTER-BUILD-PLAN.md` als historisch plan; nooit zelfstandig uitvoerbaar, uitsluitend na de toepasselijke gate én voorafgaande command-specifieke Pietje-goedkeuring |
| Target architecture | `ai-motor/docs/architecture-2.2/05-target-architecture.md` |
| Actuele uitvoeringsvolgorde | `ai-motor/docs/architecture-2.2/08-migratie-pilot-twaalfweken.md` |

Doc 07 §30 is alleen een ADR-index. De verwijderde mechanische bundel is geen bron en mag niet terugkomen.

## Repo-kaart

| Pad | Rol | Agentregel |
|---|---|---|
| `ai-motor/` | Actieve Motor Next.js-app en adapters | Alleen wijzigen voor een expliciet toegewezen taak |
| `ai-motor/docs/` | Plan, beslissingen en runbooks | Kruisverwijzingen en owner+datum behouden |
| `ai-motor/infra/` | Hetzner-serviceconfig | Geen deploy/mutatie zonder expliciete infra-opdracht |
| `ai-motor/lib/inngest/` | Bestaande Inngest-approvalpilot | Geen uitbreiding vóór ADR-101-uitkomst |
| `factory-os/`, `holding/`, `evomap/`, `omega*`, `singularity*` | Legacy-generaties | Niet uitbreiden of inhoud migreren; AM-5: bevriezen→30 dagen→verwijderen |
| `memory/` | Sessienotities, geen product-SSOT | Nooit gebruiken als vervanging voor ADR/docs |

## Owner-targettopologie — pending live revalidatie

Onderstaande verdeling is ADR-108-doelontwerp van de eigenaar, **geen huidige runtimeclaim**. Iedere node-identiteit, service en netwerkroute blijft onbekend tot een apart goedgekeurde read-only revalidatie bewijs levert.

| Node | Beoogde verantwoordelijkheid |
|---|---|
| **NUC** | Motor UI, gehard OpenClaw, kanalen, executor/bridge-glue en ingress; informeel “orchestrator” |
| **Hetzner** | Postgres, canonieke engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter en monitoring-hub |
| **Inference-PC** | Stateless lokale LLM-/batchworker via Tailscale |

De inference-PC krijgt **geen taak** vóór SSH, Tailscale, runbook en Gateway/policy. Beschikbare SSH-toegang is geen uitvoeringsmachtiging: eerst vraagt de operator Pietje om command-specifieke goedkeuring voor de read-only nulmeting uit `00-HUIDIGE-STAAT`; daarna volgt opnieuw een aparte goedkeuring voor iedere volgende stap.

## Wat nu wel mag

Zonder aanvullende eigenaarstoestemming betekent “mag” hieronder uitsluitend: lokaal analyseren en documentatie voorbereiden. Live verificatie of wijziging begint pas na de hierboven vereiste command-specifieke goedkeuring.

- Golf 0 verifiëren/afronden: auth 401/403, OpenClaw-hardening, secrets-inventaris, health.
- ADR-002 live meten en M4 aantoonbaar afronden of expliciet herplannen.
- K2 reviews op bestaande n8n met Telegram-notificatie + approval in Motor UI.
- K1 bonnetjes v1 daarna: route `extract` cloud-tier, elke boeking handmatig approven.
- Documentatie corrigeren in bestaande docs; nieuwe inzichten als delta in doc 15.

## Wat nu niet mag

Geen doc 16+, nieuwe promptversie, nachtploeg, sandbox-vloot, staging-stack, ComfyUI, e-mail/agenda, CRM-tabellen, TTS, MinerU, reranker, Chinese routes, Playbook-registry, doc-freshness-CI of aparte adversarial-reviewstap vóór Playbook #1 dertig dagen groen.

Daarnaast:

- Geen nieuwe orchestrator, vectorstore, memorylaag, SQLite-only tabel of stateful n8n/Dify-flow.
- `/api/chat/*` en `/api/conversations/*` nooit opnieuw algemeen publiek maken.
- Geen ClawHub/community-skills.
- Geen side-effect-credentials in OpenClaw, n8n of agentcontext toevoegen.
- Geen klant-/personeelsdata naar cloud vóór AM-4-punten 1–5 groen zijn; geen Art. 9-Playbook zonder DPIA.

## Bewijsplicht

- “Af” vereist commandoutput, API-JSON, testresultaat of live healthbewijs.
- Niet-meetbaar wordt letterlijk: **“onbekend, meten door <eigenaar/operator>”**.
- Geen mockdashboard als bewijs.
- Runtimewijzigingen loggen een `operator_ingreep`-event met reden zodra AM-4-audit beschikbaar is.
- Geen destructieve productieactie zonder expliciete opdracht, rollback en relevante runbook.

## Runbooks

Alle runbooks hieronder zijn alleen navigatiereferenties en **nooit zelfstandig uitvoerbaar**. Bekende pre-amendementconflicten staan minimaal in `00-START-HIER.md`, `MASTER-BUILD-PLAN.md`, `fase1-postgres.md`, `nuc-readiness.md`, `hybrid-env.md`, `hetzner-migration.md`, `white-label-deploy.md`, `hetzner-phase1.md`, `local-executor-nuc.md`, `motor-test-playbook.md` en `factory-os/docs/QDRANT_RESTORE_RUNBOOK.md`. De conflictwaarschuwing en actuele gates staan in `00-HUIDIGE-STAAT.md` en `DECISIONS.md`.

| Taak | Runbook |
|---|---|
| PG deploy/cutover | `ai-motor/docs/fase1-postgres.md`, `ai-motor/docs/nuc-readiness.md` |
| NUC↔Hetzner | `ai-motor/docs/hybrid-env.md`, `ai-motor/docs/hetzner-migration.md` |
| Approvals | `ai-motor/docs/approval-runbook.md` |
| Local executor | `ai-motor/docs/local-executor-nuc.md` |
| Live verificatie | `ai-motor/docs/motor-test-playbook.md` |
| Qdrant restore | `factory-os/docs/QDRANT_RESTORE_RUNBOOK.md` (alleen runbookreferentie; stack blijft legacy) |

## Sessies en continuïteit

In een directe eigenaarsessie: lees `SOUL.md`, `USER.md`, de dagnotities van vandaag/gisteren en `MEMORY.md` als die bestaan. Persoonlijke context mag nooit productbeslissingen, securityregels of de canonieke docs overschrijven.
