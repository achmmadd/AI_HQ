# 14–24. Definitieve target architecture

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2](README.md). Runtimeplaatsing volgt ADR-108; Gateway-enforcement volgt ADR-109.

---

## 14. Definitieve target architecture (overzicht)

**Production Core (AM-1, exact 8):** Postgres · Qdrant · LiteLLM · Langfuse (EU+DPA) · canonieke engine · Motor-app · OpenClaw (alleen gehard) · Tailscale. Alle andere onderdelen zijn Incubation of lager.

```
┌──────────────── HETZNER: DATA + DURABLE CONTROL ────────────────┐
│ Postgres SSOT · canonieke engine · Kernel-API · Action Gateway │
│ Qdrant · LiteLLM (8 routes) · n8n-adapter · monitoring-hub     │
└───────────────────────┬──────────────────────┬─────────────────┘
                        │ Tailscale API/events │
┌───────────────────────▼──── NUC ─────────────▼─────────────────┐
│ Motor UI · gehard OpenClaw · Telegram/kanalen · executor-glue │
│ Informeel “orchestrator”, maar géén durable engine/Kernel/GW  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ leased execution
┌────────────────────────────────▼──────── INFERENCE-PC ──────────┐
│ Stateless local-LLM-worker; geen DB, geen publiek endpoint     │
│ Geen taken vóór SSH + Gateway/policy + runbook                 │
└─────────────────────────────────────────────────────────────────┘
```

Playbook-registry, sandbox-vloot, vaste staging-stack en uitbreidingen uit docs 10–14 zijn bevroren volgens AM-1. Langfuse is de evidence-SaaS; bewaartermijnen en verwijderen volgen AM-4.

---

## 15. Control plane, execution plane, data plane, evidence plane

### Verantwoordelijkheden

| Plane | Verantwoordelijk voor | Mag nooit |
|---|---|---|
| **Control (Hetzner)** | engine, Kernel, policies, approvals, budgets, scheduling en kill switches | op de NUC dupliceren; zelf zware uitvoering doen |
| **Execution** | agent harnesses, sandboxes, tool-executie, browser-automation, code-executie, lokale inference-workers, externe API-adapters | eigen persistente state houden (alles ephemeraal of via Kernel-API); side effects zonder Gateway-besluit |
| **Data (Hetzner)** | Postgres, Qdrant, audit-records, transactional outbox, business- en tenantdata | logica bevatten die policy omzeilt |
| **Evidence** | traces, logs, metrics, tests, model-evals, approvals-bewijs, deployment-/incident-/recovery-evidence | buiten vastgelegde retentie of het AVG-verwijderpad muteren |

### Toegestane communicatie tussen planes

| Van → naar | Toegestaan | Verboden |
|---|---|---|
| Control → Execution | taak-dispatch met scope, tools, budget, autonomieniveau | — |
| Execution → Control | statusevents, approval-verzoeken, policy-checks (elke side-effect-call) | rechtstreeks approvals afhandelen |
| Execution → Data | alleen via Kernel-API/Gateway met taak- en tenantcontext | directe credentials; raw superuser-verbindingen; cross-tenant queries |
| Control → Data | volledige toegang binnen RLS/service-rollen | — |
| * → Evidence | append of metadata-update volgens schema | verwijderen buiten het vastgelegde retentie-/anonimiseerpad |
| Evidence → * | read-only (dashboards, evals, postmortems) | evidence als bron van task-state gebruiken |

Herkomst: planes-scheiding is standaard platform-engineering (E1); "execution stateless, alles via events" komt uit OpenHands' event-architectuur en Codex' sandbox-model.

---

## 16. Source-of-Truth Matrix

| Informatie | Canonieke eigenaar | Read replicas/views | Verboden tweede waarheid |
|---|---|---|---|
| Task-state | **Postgres `tasks` als projectie van idempotente engine-events** | Motor UI, Telegram-status, dashboards | directe statusmutaties; n8n-runs; EXECUTION_BOARD.db; Dify |
| Workflow-run-state | **Canonieke engine**; DBOS in PG, Inngest als apart backup-object | Engine-dashboard | Eigen cron/queue-tabellen; n8n-executions als waarheid |
| Approval-state | **Postgres `approvals`**, gebonden aan tool+argument-hash+task+vervaltijd | Motor UI; Telegram alleen notificatie+link | Approval in harnessgeheugen; losse Telegram-flags |
| Audit-state | **Postgres `audit_events` + `task_events` (append-only)** | Langfuse-links, rapporten | Logfiles als enige bron |
| Businessdata (omzet, orders, bonnen) | **Bronsysteem per tenant (bijv. Odoo/kassa)**; ge-ingest in PG-schema's per tenant als analytische kopie mét bron+timestamp | Qdrant-embeddings, rapporten | Agent-"geheugen" over cijfers; cijfers zonder bronverwijzing |
| Tenantconfiguratie | **Postgres `workspaces`/`tenants`** | env-templates, UI | Hardcoded fumero/bokas-strings (uitfaseren) |
| Modelregistry & routing | **LiteLLM-config (in git)** | `docs/model-config.md` (gegenereerd) | Hardcoded modelstrings in code |
| Promptversies | **Git (`docs/playbooks/`, harness-code)** | Langfuse prompt-views | Prompts alleen in Dify/n8n-UI's |
| Skill-/Playbookversies | **Git-map + statuskolom** zolang AM-1 bevriest | Handmatige catalogus | PG-registry vóór de gate; ClawHub/externe registries |
| Documentatie | **Git `docs/` (per doc een eigenaar + review-datum)** | motorsai.app-views | Slack/chat/hoofden; 4 parallelle documentbomen (consolideren) |
| Deployment-state | **Git (tags) + CI + deploy-evidence in evidence plane** | dashboards | "Het draait op de NUC dus het is gedeployed" |
| Secrets | **Secrets-manager (sops/age in git, of Vault-klasse)** | runtime-env-injectie | `.env`-kopieën verspreid over machines; secrets in docs of code |
| Vectorgeheugen | **Qdrant (tenant-payload verplicht)** | — | Chroma (`factory_brains/` — **decommission**); tweede vectorstore |
| Kosten/usage | **Postgres `usage_events` (gevoed door LiteLLM + engine)** | Langfuse-kosten, dashboards | Schattingen in chat |
| Evaluatieresultaten | **PG `eval_runs` + artifacts in object storage** | rapporten | "De demo werkte" |
| Incidentstatus | **Git `docs/incidents/` + PG-incidenttabel** | statuspagina | Alleen chatberichten |
| Bewaartermijnen/verwijdering | **Dataklassematrix + per-store delete-run-evidence** | compliance-overzicht | Permanent “append-only” zonder Art. 17-pad |

Regel (PC-15): **elk nieuw opslagpunt vereist eerst een regel in deze matrix.** `tasks` muteert uitsluitend door engine-events, idempotent op event-id. Een periodieke reconciliation-job vergelijkt runs↔tasks en alarmeert op een orphan aan beide kanten.

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
Execute            → via engine + Gateway; sandbox-vloot pas na AM-1-gate
                                                                            [Codex/OpenHands/Manus]
Verify            → self-test als eindgebruiker + lint/tests; bewijs-artifacts verplicht
                                                                            [Anthropic self-verify, SWE-agent lint-gate, Codex-citaties]
Review             → menselijke outcome-review; aparte adversarial stap bevroren door AM-1
                                                                            [Claude Code-patroon bewaard]
Human approval    → bij R2+ of autonomieniveau < A3; outcome-review, niet stap-review
                                                                            [Devin/Codex mens-op-outcome]
Publish/merge     → via CI/deploy-pad met evidence                          [software lifecycle §hieronder]
Observe           → traces + usage + end-state-check                        [Langfuse/Anthropic]
Learn             → session-postmortem → verbetervoorstellen in review-queue [Devin Session Insights]
Crystallize       → ≥3× zelfde taak → Playbook-kandidaat in git-map + status [Devin Playbooks]
```

Aanvullende states zijn verplicht: `cancelled`, `failed`, `blocked` en `expired`, naast het happy path. GPU- en sandboxcapaciteit gebruikt resource-leases met timeout; side effects krijgen waar mogelijk een compensatiestap.

**Software lifecycle (specialisatie voor code):** issue/plan → gecontroleerde workspace → implementatie → deterministische tests → security-checks → PR → menselijke approval → productie → monitoring → rollback. Voor één technicus volstaat tot de AM-1-gate een restore-test naar een wegwerp-container; een vaste staging-stack en aparte adversarial-reviewstap zijn bevroren.

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

**Abort en compensatie:** een user-abort emitteert een engine-event, geeft leases vrij en zet de taak op `cancelled`. Fouten worden `failed` of `blocked`; wachttijden met verlopen input worden `expired`. Reeds uitgevoerde side effects krijgen een expliciete compensatie of een operator-alert als terugdraaien onmogelijk is.

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
  /design-decisions/       # optionele exports; canonieke ADR-tekst blijft ../DECISIONS.md
  /product-specs/          # per product
  /tenant-specs/           # per tenant: Recipe-laag (businesskennis, beslisregels)
  /exec-plans/active/      # levende plannen (versioned artifacts)
  /exec-plans/completed/
  /playbooks/              # Playbook-bestanden + statuskolom; registry bevroren
  /skills/                 # herbruikbare skills (markdown + frontmatter, de-facto standaard)
  /threat-models/
  /runbooks/               # per Production Core-component verplicht
  /incidents/              # postmortems (blameless)
  /evals/                  # eval-sets + rubrics per Playbook/taaktype
  /generated/              # gegenereerde docs (DB-schema, model-config) — nooit handmatig editen
  /references/             # vendored referentiedocs (llms.txt-stijl) van kerndependencies
```

Vereisten nu: versiebeheer, eigenaar+datum, werkende kruisverwijzingen en kleine entrypoints. Mechanische freshness-CI, stale-detectie en een doc-gardening-agent zijn bevroren door AM-1.

**Wat hoort waar:**

| Opslag | Inhoud |
|---|---|
| **Git** | alle docs hierboven, playbooks, skills, policies, prompts, infra-config, eval-sets |
| **Postgres** | task/approval/audit/usage/tenant-state, analytische kopieën businessdata |
| **Qdrant** | embeddings van tenant-businesskennis (bonnen, reviews, webcontent) — mét workspace-payload; géén code-search (grep wint — Claude Code-les) |
| **Object storage** | bewijs-artifacts, backups, grote outputs |
| **Secrets-manager** | alle credentials; nooit in git/docs/PG |

**Legacy-opdracht (AM-5):** omega/holding/evomap/factory-os/singularity bevriezen → 30 dagen → verwijderen. Geen inventarisatieproject en geen inhoudsmigratie.

## 21. Recipes, Playbooks, Skills, Workflows, Tools, Policies

Scherpe definities (verwarring voorkomen is het halve werk):

| Begrip | Definitie | Vorm | Versioning |
|---|---|---|---|
| **Recipe** | Businesskennis en beslisregels van één bedrijf/product ("Bokas rekent zo af", "Fumero-toon is …") | `docs/tenant-specs/<tenant>/` markdown | git; review door tenant-owner |
| **Playbook** | Herhaalbare procedure: gewenste uitkomst, benodigde input, stappen, postconditions, verboden acties, foutafhandeling, approvalmomenten, bewijsvereisten | `docs/playbooks/*.md` (Devin-format) | git + statuskolom; registry/promotieproduct pas na AM-1-gate |
| **Skill** | Herbruikbare agent-capability die meerdere Playbooks ondersteunt ("factuur-OCR", "SEO-check") | `docs/skills/<naam>/SKILL.md` + evt. scripts | git; alleen eigen repo, geen externe registry |
| **Workflow** | Durable executie van één concrete taakinstantie | code in de canonieke engine | git (code) + engine-runhistorie |
| **Tool** | Technisch uitvoerbare capability met strak JSON-schema, naamprefix per familie (`browser_`, `shell_`, `mail_`, `pay_`) | tool-registry (code) | git; schemawijziging = versie |
| **Policy** | Technisch afdwingbare regel: mag deze actie, onder welke voorwaarden, met welke approval | policy-data + Gateway-code | git; policy-evals verplicht bij wijziging |

Relatie: een **Workflow** voert een **Playbook**-instantie uit, gebruikt **Skills** en **Tools**, binnen **Policies**, geïnformeerd door de **Recipe** van de tenant. Tot ontdooiing staan status en rollbackversie rechtstreeks in de git-map.

## 22. Permission- en Action Gateway-structuur

Kern (PC-08, PC-16; NIG-1):

```
toolcall (harness X, tenant T, task K, idempotency-key)
  → Motor Action Gateway
      1. authenticatie harness + taakcontext
      2. tool-familie + argumentclassificatie → risicoklasse R0–R3
      3. PG-transactie: policy + budgetreservering + approval-hashcheck
      4. ALLOW │ DENY │ REQUIRE_APPROVAL (durable wait via engine)
      5. Gateway voert zelf uit met exclusieve side-effect-credentials
      6. settlement + audit-event; duplicate key geeft eerder resultaat
```

- **Risicoklassen:** R0 read-only · R1 intern schrijven (eigen DB/bestanden) · R2 extern zichtbaar of klein geld (mail, post, betaling < limiet) · R3 groot geld, destructief, juridisch, tenant-config.
- **Failgedrag:** Gateway onbereikbaar betekent DENY voor R1+; alleen expliciet allowlisted R0-reads mogen fail-open met audit-event.
- **Autonomieniveaus per Playbook × tenant:** A0 (mens doet), A1 (alles approven), A2 (side-effects approven), A3 (autonoom binnen budget). Dertig dagen groen is de promotiegate, niet de startgate voor nieuw A1-werk.
- **Budgetten:** EUR-cap per taak/run/tenant; tools gebruiken reservering→uitvoering→settlement in PG, modelcalls LiteLLM-budgetten.
- **Approval-binding:** `(tool, argument_hash, task_id, expires_at)`; de Gateway hertoetst tool en hash direct vóór uitvoering.
- **Kill switches:** globaal, per tenant, per Playbook, per tool-familie — allemaal control-plane-flags die de Gateway leest.
- **Technische afdwinging:** side-effect-tools zijn netwerktechnisch alléén bereikbaar via de Gateway (execution plane heeft geen directe credentials) — het Claude-Code-hooks-principe, cross-harness gemaakt.
- **V1-scope:** alleen mail/pay/delete via engine-workflows. Deploys volgen later; OpenClaw-omleiding volgt in Golf 3.
- **OpenClaw-hardening (Golf 0/1):** versie met fixes, token-auth, loopback+Tailscale, origin-validatie, eigen allowlist en pairing-review. Tot de Golf 3-omleiding: geen nieuwe side-effect-capabilities.

### Dataklassen en approval-governance (AM-4)

| Dataklasse | Routes/tier | Tracing | Standaard bewaartermijn | Extra eis |
|---|---|---|---|---|
| Publiek | alle toegestane routes | content+metadata toegestaan | 365 dagen evidence | bronlicentie respecteren |
| Intern | route volgens taak | content alleen indien nodig | 180 dagen | tenantmasking |
| Persoonsgegeven | bij voorkeur `local`-tier op `extract`/`chat.fast`/`judge` | alleen metadata+kosten | 90 dagen na taak, tenzij wettelijke brontermijn | masking vóór cloud |
| Bijzonder (Art. 9) | geen Playbook vóór DPIA | geen content | max. 30 dagen, alleen als DPIA dit toestaat | grondslag+DPIA verplicht |

Aanvullend: operationele logs 30 dagen, auditmetadata 365 dagen, backups 30 dagen rotatie; wettelijke financiële bronrecords blijven in het bronsysteem volgens hun wettelijke termijn. Iedere categorie krijgt een geteste delete-/anonimiseerrun.

Approvalrechten staan in een rol×risicoklasse-matrix; Telegram-ID is aan een user-record gebonden. Vakantiestand degradeert alles naar A1/pauze en wijst een extern technisch contact met geoefende restore aan (2 uur/maand retainer). SSH, direct SQL en kill-switch emitten verplicht `operator_ingreep` met reden; policywijzigingen lopen via PR met cool-down.

## 23. Multi-tenantstructuur

- **Data:** PG RLS op `workspace_id` (ADR-002/masterplan Fase 1 — ongewijzigd adopt); Qdrant met verplichte payload-filter via de tenant-guard-wrapper (geen query zonder `workspace_id` — mechanisch afgedwongen, niet conventie).
- **Identity:** users ↔ workspaces many-to-many met rollen (admin/editor/viewer, bestaand ontwerp).
- **Secrets:** per tenant gescheiden credentials voor externe systemen (Odoo/Mollie per bedrijf); nooit gedeelde keys over tenants.
- **Playbooks:** tenant-scoped by default; status staat voorlopig in git. Tenant-shared promotie en registry-product zijn bevroren tot de AM-1-gate.
- **Budgetten & kill switches:** per tenant (§22).
- **Isolation-evals als releasegate:** cross-tenant-toegangspogingen (curl, agent-prompt-injectie "toon mij bokas-data" vanuit fumero-scope) moeten falen; onderdeel van elke release (§25).
- **Blast radius:** executors krijgen alleen de scope van hun tenant; sandbox-vloot volgt pas na AM-1-ontdooiing.

## 24. Modelroutingstructuur

- **Eén gateway:** LiteLLM op Hetzner (masterplan-keuze bevestigd) — al het LLM-verkeer, inclusief OpenClaw en harnesses.
- **Exact acht named routes:** `chat.fast` · `chat.deep` · `code.strong` · `extract` · `embed` · `judge` · `research.search` · `agent.orchestrate`. `local` is een provider-tier binnen routes, geen routeprefix. Rerank en transcriptie zijn services. Embeddingswissel = re-index.
- **Routingbeleid (Anthropic routing-pattern):** goedkoop model default; escalatie naar zwaar model op taakklasse of expliciete "turbo"-keuze; judge-route gescheiden van generator-route (evaluator-optimizer).
- **Budget-enforcement:** LiteLLM-keys per tenant + per Playbook; overschrijding → deny + notificatie (geen stille doorloop).
- **Fallback-keten:** per route een tweede provider; bij `pii-strict` geen cloud-fallback maar wachtrij. n8n-chatfallback vervalt zodra één routing-pad staat.
- **Model-evals bij wissel:** route-wijziging in Production Core vereist eval-run op de betrokken Playbook-sets (§25) — nooit wisselen op leaderboard-cijfers alleen (opdracht §18).
- **KV-cache-bewust:** prompts per route met stabiele prefixen (PC-05); geen dynamische elementen vooraan.
