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
