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
