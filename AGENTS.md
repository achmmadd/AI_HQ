# AGENTS.md — AI_HQ / Motor AI

> **Eigenaar:** Pietje · **Datum:** 2026-07-27 · **SSH-regel:** 2026-10-16 · **RTX-vrijwaring:** 2026-10-16
> Dit bestand is een kaart. Het uitvoeringsentrypoint is [`ai-motor/docs/architecture-2.2/00-START-HIER.md`](ai-motor/docs/architecture-2.2/00-START-HIER.md).

## Verplichte leesvolgorde

1. Lees `ai-motor/docs/architecture-2.2/00-START-HIER.md`.
2. Lees `ai-motor/docs/architecture-2.2/00-HUIDIGE-STAAT.md`; controleer meetdatum en onbekenden.
3. Lees `ai-motor/docs/DECISIONS.md` vóór data-, engine-, Gateway- of topologiewerk.
4. Lees `ai-motor/docs/architecture-2.2/15-review-panel.md` voor AM-1 t/m AM-5.
5. Open daarna alleen de taakrelevante verdiepingsdoc uit de leeskaart in START-HIER.

Geen agent mag een planclaim als runtimefeit presenteren. Repo/config betekent “aanwezig”, niet “draait”.

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
| Infra Golf 0/1 | `ai-motor/docs/MASTER-BUILD-PLAN.md` |
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

## Runtime-topologie — niet heruitvinden

| Node | Verantwoordelijkheid |
|---|---|
| **NUC** | Motor UI, gehard OpenClaw, kanalen, executor/bridge-glue en ingress; informeel “orchestrator” |
| **Hetzner** | Postgres, canonieke engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter en monitoring-hub |
| **Inference-PC** | Stateless lokale LLM-/batchworker via Tailscale |

De inference-PC krijgt **geen taak** vóór SSH, Tailscale, runbook en Gateway/policy. SSH daarvoor is eigenaar/laptop (Tailscale), nooit een Cursor Cloud Agent. De eigenaar gaf de Cloud Agent op 2026-10-16 **vrijwaring voor de RTX 3090**: geen hosttoegang, geen GPU-meting, geen modelserver. Ontbrekende RTX-SSH is geen agentblokkade. Zodra de eigenaar zelf SSH heeft: eerst de read-only nulmeting uit `00-HUIDIGE-STAAT`, daarna pas de eerstvolgende START-HIER-stap.

## Cursor Cloud Agent — geen host-SSH; RTX-vrijwaring

Cursor Cloud Agents draaien in een geïsoleerde VM met alleen GitHub `AI_HQ`. Ze **SSH'en niet** naar NUC, Hetzner of de inference-PC. Ze vragen geen SSH-sleutels, host-IP’s of Tailscale in de Cloud Agent-environment, en zetten die daar ook niet. Een Cursor self-hosted worker is geen login-shell en vervangt geen hosttoegang.

**RTX-vrijwaring (eigenaar, 2026-10-16):** omdat de Cloud Agent niet op de RTX 3090 kan, is hij vrijgesteld van inference-PC-toegang, GPU-livebewijs en RTX-hostwerk. Dat heft de productietaak-blokkade van de PC niet op (Gateway/policy blijven verplicht voor de eigenaar).

Live hostcommando’s (`pm2`, `docker ps`, `systemctl`, productieflags, SQLite↔PG-tellingen) blijven **onbekend, meten door eigenaar op NUC/Hetzner**. RTX-velden blijven **onbekend, meten door eigenaar op de inference-PC**. Een cloud-agent mag die uitvoer alleen verwerken als de eigenaar hem aanlevert, zonder secrets.

## Wat nu wel mag

- Golf 0-docs en repo-controles. Live auth 401/403, OpenClaw-hardening, secrets-inventaris en health: alleen als de eigenaar hostuitvoer aanlevert of het zelf op NUC/Hetzner meet.
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
- Geen SSH-sleutels of Tailscale-auth in de Cursor Cloud Agent-environment.
- Geen RTX/inference-PC-hostwerk vanuit de Cloud Agent; de RTX-vrijwaring dekt ontbrekende GPU-toegang, niet productietaken op die box.
- Geen klant-/personeelsdata naar cloud vóór AM-4-punten 1–5 groen zijn; geen Art. 9-Playbook zonder DPIA.

## Bewijsplicht

- “Af” vereist commandoutput, API-JSON, testresultaat of live healthbewijs.
- Niet-meetbaar wordt letterlijk: **“onbekend, meten door <eigenaar/operator>”**.
- Geen mockdashboard als bewijs.
- Runtimewijzigingen loggen een `operator_ingreep`-event met reden zodra AM-4-audit beschikbaar is.
- Geen destructieve productieactie zonder expliciete opdracht, rollback en relevante runbook.

## Runbooks

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
