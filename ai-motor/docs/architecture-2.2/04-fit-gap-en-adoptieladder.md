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
