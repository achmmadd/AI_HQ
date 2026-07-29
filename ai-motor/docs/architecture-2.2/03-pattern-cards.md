# 5. Pattern Extraction Cards

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2](README.md). Structuur per kaart: Probleem · Gebruikt door · Structuur · Waarom het werkt · Wanneer toepassen · Wanneer niet · Failure modes · Motor AI-adoptie · Benodigde afwijking · Bewijs.
> Adoptiestatussen: **Adopt as-is · Configure · Wrap · Extend · Reject · Defer**

---

## PC-01 — Sandbox-per-taak (geïsoleerde omgeving)

- **Probleem:** Agents die code/tools uitvoeren mogen productie, elkaars werk en secrets niet raken; exfiltratie moet technisch onmogelijk zijn.
- **Gebruikt door:** Codex (container per taak, two-phase: setup mét internet/secrets → agentfase zónder, domain-allowlist + HTTP-method-restricties), Devin (snapshot-VM per sessie), OpenHands (action-execution-server in container), Manus (VM per sessie, E3).
- **Structuur:** Per taak een verse container/worktree; dependencies in een setup-fase; agentfase krijgt geen secrets en geen ongefilterd internet; resultaten verlaten de sandbox alleen via een gecontroleerd kanaal (PR, artifact).
- **Waarom het werkt:** Blast radius per taak; prompt-injectie kan hooguit de sandbox besmetten; parallelle taken interfereren niet.
- **Wanneer toepassen:** Alle code-executie, browser-automation, alles met schrijfrechten.
- **Wanneer niet:** Pure read-only Q&A op reeds geautoriseerde data (overhead zonder winst).
- **Failure modes:** Sandbox-escape via gemounte volumes; secrets die tóch in de agentfase lekken; images die verouderen (Devin lost dit met snapshots + maintenance-script).
- **Motor AI-adoptie:** **Defer volgens AM-1.** Het patroon blijft gekozen, maar de sandbox-vloot start pas na dertig dagen groen van Playbook #1.
- **Benodigde afwijking:** Geen eigen image-bouwdienst; één gestandaardiseerd base-image per taaktype (code / browser / data), handmatig beheerd.
- **Bewijs:** openai.com/index/introducing-codex (2025-05-16); developers.openai.com/codex/cloud/environments; docs.devin.ai/product-guides/snapshots; OpenHands ICLR 2025-paper. E2/E4.

## PC-02 — AGENTS.md als kaart + docs als system of record

- **Probleem:** Monolithische instructiefiles verdringen taakcontext, rotten en zijn niet mechanisch valideerbaar; kennis buiten de repo bestaat voor agents niet.
- **Gebruikt door:** Codex (AGENTS.md ±100 regels; `docs/design-docs`, `exec-plans/active|completed`, `generated/`, `references/`), Claude Code (CLAUDE.md kort houden, `@imports`), Devin (Knowledge + wiki), agents.md-spec (Linux Foundation, 20+ tools).
- **Structuur:** Kleine entrypoint-file = inhoudsopgave; per onderwerp aparte docs met eigenaar en freshness-metadata; exec-plans zijn versioned artifacts; CI valideert links/staleness; een periodieke doc-gardening-taak opent fix-PR's.
- **Waarom het werkt:** Progressive disclosure houdt het contextvenster voor de taak vrij; "closest file wins"-precedentie schaalt naar monorepos; mechanische checks maken documentatie afdwingbaar in plaats van adviserend.
- **Wanneer toepassen:** Altijd; het is de kennislaag.
- **Wanneer niet:** N.v.t. — wel: geen encyclopedie in het entrypoint proppen.
- **Failure modes:** Kaart verwijst naar dode docs (→ linkcheck in CI); niemand is eigenaar (→ eigenaar per doc verplicht); "when everything is important, nothing is".
- **Motor AI-adoptie:** **Adopt de entrypoint-kaart nu.** Mechanische freshness-CI en doc-gardening blijven bevroren volgens AM-1; zie [§20](05-target-architecture.md#20-knowledge--en-repositorystructuur).
- **Benodigde afwijking:** Motor AI voegt `tenant-specs/` en `playbooks/` toe (business-taken, niet alleen code) en tweetaligheid (NL voor business-docs, EN voor code-docs).
- **Bewijs:** openai.com/index/harness-engineering (2026-02-11); agents.md; code.claude.com/docs/en/best-practices. E2 + E1 (conventie).

## PC-03 — Playbook (Devin-format)

- **Probleem:** Terugkerende taken krijgen telkens andere instructies → inconsistente uitkomsten; kennis over "hoe wij dit doen" zit in hoofden.
- **Gebruikt door:** Devin (Playbooks, `!macros`, label-triggered automations); analoog: OpenHands microagents, Claude Code skills.
- **Structuur:** Eén document per terugkerende taak met: **gewenste outcome · benodigde input · procedure (imperatief, MECE) · specifications/postconditions · advice (priors corrigeren) · forbidden actions · foutafhandeling · approvalmomenten · bewijsvereisten.** Versiebeheerd; iteratief aangescherpt na elke failure.
- **Waarom het werkt:** Het is een custom system prompt met de structuur van een SOP: postconditions maken "klaar" toetsbaar, forbidden actions begrenzen de risicoruimte, en versiebeheer maakt verbetering cumulatief.
- **Wanneer toepassen:** Elke taak die ≥3× voorkomt of tenant-overdraagbaar moet worden.
- **Wanneer niet:** Eenmalige exploratieve taken (dan volstaat een goede intake).
- **Failure modes:** Playbook-drift (procedure klopt niet meer met systeem — → regressietest per versie); te generiek (→ per tenant een Recipe-laag eroverheen).
- **Motor AI-adoptie:** **Adopt as-is** als markdown-schema. Tot de AM-1-gate volstaat een git-map met statuskolom; de registry en tenant-promotie zijn bevroren.
- **Benodigde afwijking:** Motor AI-Playbooks gelden ook voor niet-code-werk (brief, boekhouding, content) — bewijsvereisten worden dan output-artifacts + bronvermelding i.p.v. tests.
- **Bewijs:** docs.devin.ai/product-guides/creating-playbooks; cognition.ai/blog/how-cognition-uses-devin-to-build-devin (2026-02-27). E2.

## PC-04 — Long-running harness (initializer + increment + feature list)

- **Probleem:** Lange taken falen op twee manieren: te veel in één sessie (context op, kapotte staat achtergelaten) en "premature victory" (latere sessie ziet vooruitgang en verklaart het af).
- **Gebruikt door:** Anthropic (autonomous-coding quickstart), Codex (exec-plans + worktrees), Devin (sessies ≤ ~90 min equivalent).
- **Structuur:** Sessie 1 (initializer): `init.sh`, `feature_list.json` (alle acceptatiecriteria, `passes:false`), `progress.txt`, git-commit. Elke volgende sessie: oriënteer (git log + progress) → smoke-test éérst → kies één hoogst-geprioriteerd falend item → implementeer → self-test → schone staat → commit + progress-update. Alleen `passes` false→true mag; items verwijderen is verboden.
- **Waarom het werkt:** De feature-list is een extern, niet-onderhandelbaar contract dat "klaar" definieert; JSON wordt door modellen minder herschreven dan proza; git+progress geven complementaire recovery-informatie (diffs + intentie).
- **Wanneer toepassen:** Alles wat niet in één sessie past: software-bouw, migraties, grote research, tenant-onboarding.
- **Wanneer niet:** Taken < 1 sessie (overhead).
- **Failure modes:** Smoke-test overgeslagen → bouwt op kapotte staat; feature-list te vaag → schijn-groen (→ elk item heeft concrete stappen); progress-file wordt roman (→ max lengte).
- **Motor AI-adoptie:** **Adopt as-is**, gegeneraliseerd naar niet-code-taken (checklist-JSON i.p.v. feature-list).
- **Benodigde afwijking:** Checkpoints voor business-taken landen in de task-event-log (Postgres) i.p.v. alleen git.
- **Bewijs:** anthropic.com/engineering/effective-harnesses-for-long-running-agents (2025-11-26) + open-source prompts (claude-quickstarts). E2/E4.

## PC-05 — Context engineering (Manus-zesluik)

- **Probleem:** Agentloops zijn ~100:1 prefill:decode; ongedisciplineerde context maakt taken traag, duur en onbetrouwbaar.
- **Gebruikt door:** Manus; onderdelen onafhankelijk herbevestigd door Claude Code (compaction), Cognition (compressor-model), OpenHands (condensers).
- **Structuur:** (1) KV-cache: stabiele prompt-prefix, append-only, deterministische serialisatie, geen timestamps; (2) tools maskeren i.p.v. verwijderen, naamprefixen per familie; (3) filesystem als extern geheugen, compressie altijd herstelbaar (URL/pad blijft); (4) recitation: todo.md telkens herschrijven; (5) fouten in context laten staan; (6) gecontroleerde variatie tegen few-shot-rut.
- **Waarom het werkt:** Cache-hit is 10× goedkoper dan uncached input (verifieerbare pricing); recente tokens krijgen de meeste aandacht (lost-in-the-middle); zichtbare fouten verschuiven priors weg van mislukte acties.
- **Wanneer toepassen:** In elke harness, vanaf dag één.
- **Wanneer niet:** N.v.t.; wel: masking vereist inference-API-steun (prefill/constrained decoding) — anders alleen de naamgevings- en policy-kant.
- **Failure modes:** Eén dynamisch element vooraan de prompt (datum, usage-teller) sloopt de hele cache; agressieve compressie gooit de observatie weg die stap 10 later nodig is.
- **Motor AI-adoptie:** **Adopt as-is** (1,3,4,5,6); **Configure** (2: prefixen + gateway-side filtering; logit-masking alleen waar LiteLLM/provider het ondersteunt).
- **Benodigde afwijking:** Geen — dit is pure discipline.
- **Bewijs:** manus.im blog "Context Engineering for AI Agents" (2025-07-18). E3 met onafhankelijk verifieerbare mechanismen.

## PC-06 — Workflow eerst, agent daarna (Anthropic-taxonomie)

- **Probleem:** Teams grijpen naar autonome agents/multi-agent waar een deterministische workflow goedkoper, sneller en betrouwbaarder is.
- **Gebruikt door:** Anthropic (Building Effective Agents), Cognition (single-threaded default), industrie-brede consensus 2025–2026.
- **Structuur:** Ladder: één LLM-call+retrieval → prompt chaining → routing → parallelization → orchestrator-worker → evaluator-optimizer → pas dán een autonome agent (loop met tools + environment-feedback + stopconditie).
- **Waarom het werkt:** Voorspelbaarheid en reproduceerbaarheid zijn gratis bij vaste code-paden; agent-vrijheid koopt flexibiliteit tegen kosten en compounding errors.
- **Wanneer toepassen:** Bij ieder ontwerp; de beslisboom in [§19](05-target-architecture.md#19-multi-agent-beslisboom) is bindend.
- **Wanneer niet:** —
- **Failure modes:** "Agent-washing": een workflow verkleed als agent → onnodige variantie; of andersom een rigide workflow voor een taak vol ambiguïteit → eindeloos patchen.
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Geen.
- **Bewijs:** anthropic.com/engineering/building-effective-agents (2024-12-19) + open cookbook. E2/E4.

## PC-07 — Orchestrator-worker research (parallelle subagents, begrensd)

- **Probleem:** Breadth-first onderzoek past niet in één contextvenster; een lineaire pipeline kan geen leads volgen.
- **Gebruikt door:** Anthropic Research (lead + 3–5 subagents + CitationAgent), DeerFlow (coordinator/planner/researchers/reporter + plan-approval), Manus Wide Research (subagents zonder onderling contact).
- **Structuur:** Lead bewaart plan extern (memory/file), spawnt subagents met elk: objectief, outputformat, toolbegrenzing, taakgrens; subagents comprimeren bevindingen en schrijven naar filesystem (referenties i.p.v. volle inhoud terug); lead synthetiseert; aparte citatie-/critic-stap.
- **Waarom het werkt:** Tokenbudget over gescheiden contextvensters is de dominante prestatiefactor (Anthropic: tokengebruik verklaarde 80% van variantie); geen peer-to-peer-communicatie = geen conflicterende impliciete beslissingen (Cognition-kritiek ondervangen).
- **Wanneer toepassen:** Onafhankelijke richtingen, brede vergelijkingen, hoge waarde per resultaat.
- **Wanneer niet:** Coding en alles met gedeelde context/afhankelijkheden (Anthropic zelf: slecht parallelliseerbaar); lage-waarde-taken (~15× tokens).
- **Failure modes:** Vage delegatie → dubbel/verkeerd werk (→ verplichte taakspecificatie); kosten-explosie (→ budget-cap per run, effort-scaling-regels: simpel=1 agent/3–10 calls).
- **Motor AI-adoptie:** **Configure**, alléén in de research-lifecycle, met verplichte multi-agent-rechtvaardiging per [§19](05-target-architecture.md#19-multi-agent-beslisboom).
- **Benodigde afwijking:** Harde EUR-cap per research-run in de Policy Gateway.
- **Bewijs:** anthropic.com/engineering/multi-agent-research-system (2025-06-13); cognition.ai/blog/dont-build-multi-agents (2025-06); manus.im Wide Research (2025-07-31). E2/E3.

## PC-08 — Deterministische policy-hooks (Action Gateway-kern)

- **Probleem:** Promptinstructies zijn adviserend; een model kán ze negeren. Risicovolle acties vereisen technische, niet-omzeilbare grenzen.
- **Gebruikt door:** Claude Code (PreToolUse-hook, exit 2 = harde block; Stop-hooks die beurt niet laten eindigen tot verificatie slaagt), SWE-agent (lint-gate weigert invalide edits), Codex (sandbox + allowlist buiten het model om).
- **Structuur:** De Gateway is credential-broker/proxy en voert de side effect zelf uit. R1+ faalt gesloten; alleen allowlisted R0-reads mogen bij Gateway-uitval fail-open. Budget loopt in PG via reservering→uitvoering→settlement; elke call heeft een idempotency-key.
- **Waarom het werkt:** De enforcementlaag draait in de harness, niet in het model — prompt-injectie of model-drift kan er niet omheen.
- **Wanneer toepassen:** Elke side-effect-tool: betalingen, mail, publiceren, deletes, deploys, externe API's.
- **Wanneer niet:** Read-only tools binnen reeds geautoriseerde scope (alleen loggen).
- **Failure modes:** Policy-set raakt verouderd (→ policies versioned in git, getest); te grofmazig → alles vraagt approval → alert fatigue (→ risicoklassen + autonomieladder).
- **Motor AI-adoptie:** **Adopt patroon / Wrap implementatie** — dit is de Motor Action Gateway ([§22](05-target-architecture.md#22-permission--en-action-gateway-structuur)); No-Invention Gate NIG-1 in [hoofdstuk 13](04-fit-gap-en-adoptieladder.md).
- **Benodigde afwijking:** Tenant-dimensie, EUR-budgetten en approval-binding aan `(tool, argument-hash, task_id, vervaltijd)` toevoegen (ADR-109).
- **Bewijs:** code.claude.com/docs (hooks); SWE-agent NeurIPS 2024-ablaties (lint-gate = grootste enkele win). E1/E2/E4.

## PC-09 — Durable HITL (approval als workflow-state)

- **Probleem:** Menselijke goedkeuring duurt uren/dagen; de wachtende taak moet crashes, redeploys en reboots overleven en kunnen herinneren/escaleren.
- **Gebruikt door:** Inngest (`step.waitForEvent` + CEL + timeouts), DBOS (`send/recv` exactly-once + agent-inbox-referentie-app), Temporal (signals/updates), Restate (awakeables), Conductor (Human task).
- **Structuur:** Approval = een durable wait-step in de workflow. Telegram stuurt alleen een notificatie+deeplink; de actie gebeurt in Motor UI. Het record bindt aan tool, argument-hash, task en vervaltijd; de Gateway hertoetst de hash.
- **Waarom het werkt:** State leeft in de engine/Postgres, niet in een proces; exact-één-keer-semantiek voorkomt dubbele uitvoering na dubbele klik.
- **Wanneer toepassen:** Alle risicoklasse-R2+-acties; plan-approvals; publish/deploy-momenten.
- **Wanneer niet:** R0/R1 (lage-risico) — daar volstaat logging (anders alert fatigue).
- **Failure modes:** Race: event vóór de wait geregistreerd (Inngest-caveat — → event-lookback of idempotente re-check); approvals versnipperd over kanalen zonder één state-eigenaar (huidige situatie!).
- **Motor AI-adoptie:** **Configure** via de canonieke engine; Motor UI emit approvals, Telegram emit alleen notificatie+deeplink.
- **Benodigde afwijking:** Geen.
- **Bewijs:** inngest.com/docs/ai-patterns/human-in-the-loop; docs.dbos.dev/ai/hitl. E2/E4.

## PC-10 — Bewijsplicht (evidence-before-done)

- **Probleem:** Agents rapporteren "klaar" zonder dat het waar is; mensen kunnen niet elke regel nalopen.
- **Gebruikt door:** Codex (citatiesyntax voor terminal-/testoutput, verplicht bij claims), Anthropic (self-verification als eindgebruiker, screenshots; "evidence, not assertions"), Devin (verificatiemechanisme verplicht per taak; CI groen).
- **Structuur:** Iedere statusovergang naar "done" vereist machineverifieerbaar bewijs: testoutput, exit codes, screenshots, brongelinkte cijfers. Het bewijs is een artifact in de evidence plane, gelinkt aan taak-ID.
- **Waarom het werkt:** Het verplaatst vertrouwen van de bewering naar het artefact; reviewers beoordelen outcome + bewijs i.p.v. proces.
- **Wanneer toepassen:** Elke taak; de vorm van bewijs verschilt per taaktype (tests voor code; bronnen + queries voor analyses; before/after voor content).
- **Wanneer niet:** —
- **Failure modes:** Schijnbewijs (test die niets test) → menselijke review + evals; de aparte adversarial stap is tijdelijk bevroren. Bewijs zonder retentie/verwijderpad veroorzaakt groei én AVG-risico.
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Bewijstypes voor business-taken definiëren (bronverwijzing met datum, query + resultaat-hash).
- **Bewijs:** Codex system message (gepubliceerd, 2025-05-16); anthropic long-running post (2025-11-26); docs.devin.ai. E2.

## PC-11 — Session Insights / skill-kristallisatie

- **Probleem:** Lessen uit sessies verdampen; dezelfde fouten worden herhaald; goede werkwijzen worden niet herbruikbaar.
- **Gebruikt door:** Devin (automatische sessie-analyse, verbeterde prompt, Knowledge-suggesties, Useful/Misleading-classificatie van gebruikte kennis), Hermes (agent schrijft SKILL.md na complexe taak, mens reviewt).
- **Structuur:** Na iedere afgeronde taak: geautomatiseerde postmortem (wat ging mis, welke kennis hielp/misleidde, efficiëntie) → concrete verbetervoorstellen: prompt-rewrite, Knowledge-item-kandidaat (mét trigger-descriptie), of Playbook-wijziging → menselijke review → versioneren.
- **Waarom het werkt:** Het sluit de leerloop zonder fine-tuning; trigger-descripties zorgen dat kennis alleen geladen wordt wanneer relevant (context-hygiëne).
- **Wanneer toepassen:** Elke productietaak; verplicht bij Playbook-runs.
- **Wanneer niet:** Triviale taken (alleen tellen, niet analyseren).
- **Failure modes:** Ongereviewde auto-kennis vervuilt de knowledge base (→ mens keurt); knowledge-items zonder trigger → alles wordt altijd geladen.
- **Motor AI-adoptie:** **Adopt patroon / Configure** (LLM-postmortem-stap in de task lifecycle + review-queue in Motor UI).
- **Benodigde afwijking:** Tenant-scoping: geleerde kennis mag niet zomaar cross-tenant lekken.
- **Bewijs:** docs.devin.ai/product-guides/session-insights + knowledge; Hermes-docs. E2/E4.

## PC-12 — Kanaal-gateway met secure-by-default (OpenClaw-les)

- **Probleem:** Eén assistent bereikbaar via Telegram/WhatsApp/web vereist een gateway — en die gateway is de facto een remote shell op je systemen.
- **Gebruikt door:** OpenClaw (typed WS-gateway, device pairing, channel bridges, skills), Hermes (gateway + zes terminal-backends), Devin (Slack/Linear/Jira).
- **Structuur:** Eén gateway-daemon met: loopback-bind default, verplichte token-auth vanaf first launch, WS-origin-validatie, device-pairing met approval, capabilities per device, en een kill-switch. Skills/plugins alleen uit een gescreende, gesigneerde bron.
- **Waarom het werkt / faalt:** Het patroon zelf is sterk (één normalisatielaag voor alle kanalen); de 2026-incidenten bewijzen dat de defaults het verschil maken: 40k+ exposed instances (93% zonder auth), one-click RCE, ~800 malicious skills in de registry.
- **Wanneer toepassen:** Motor AI gebruikt OpenClaw al → hardening is verplicht, nu.
- **Wanneer niet:** Nooit publiek exposen; nooit community-skills auto-installeren.
- **Failure modes:** Reverse proxy die localhost-trust breekt ("ClawJacked"); token-lek via UI; supply-chain via skills.
- **Motor AI-adoptie:** **Configure eerst:** OpenClaw hardenen (versie met fixes, auth, loopback+Tailscale, origin-validatie, eigen allowlist). Omleiding van side-effect-tools naar de Gateway volgt in Golf 3; tot die tijd krijgt OpenClaw geen nieuwe side-effect-capabilities.
- **Benodigde afwijking:** OpenClaw wordt kanaal+harness in de execution plane; het mag nooit state-eigenaar of policy-eigenaar zijn.
- **Bewijs:** CVE-2026-25253; Censys/Bitsight/SecurityScorecard-scans (jan–feb 2026); Koi Security ClawHavoc (2026-02). E1.

## PC-13 — Repo-local model-agnostische model-gateway

- **Probleem:** Hardcoded modelstrings verspreid door de codebase; geen failover, geen kosten-attributie, geen tenant-budget.
- **Gebruikt door:** OpenHands (LiteLLM), Motor-masterplan (LiteLLM gepland), Manus (model-agnostisch harness als expliciete strategie: "the boat, not the pillar").
- **Structuur:** Eén proxy (LiteLLM) met maximaal acht named routes: `chat.fast`, `chat.deep`, `code.strong`, `extract`, `embed`, `judge`, `research.search`, `agent.orchestrate`. `local` is een provider-tier binnen een route, geen routeprefix. Rerank en transcriptie zijn services.
- **Waarom het werkt:** Modelwissel = configwijziging; kosten worden meetbaar per taak/tenant; benchmark-gedreven routing wordt mogelijk.
- **Wanneer toepassen:** Al het LLM-verkeer, ook OpenClaw en (zolang aanwezig) Dify.
- **Wanneer niet:** —
- **Failure modes:** Proxy als single point of failure (→ health-check + gedocumenteerde fallback); route-sprawl (→ hard maximum acht routes).
- **Motor AI-adoptie:** **Configure** (al gepland; dit document voegt route-namen, budget-enforcement en tenant-keys toe).
- **Benodigde afwijking:** Geen.
- **Bewijs:** LiteLLM E4/E5; OpenHands SDK-docs E4.

## PC-14 — Evals: klein beginnen, LLM-as-judge, end-state

- **Probleem:** Zonder evals is elke prompt-/model-/Playbook-wijziging een gok; regressies blijven onzichtbaar tot een klant ze ziet.
- **Gebruikt door:** Anthropic (start met ~20 echte queries; één judge-rubric 0–1 + pass/fail; end-state-evaluatie voor state-muterende agents; menselijke steekproeven ernaast), Youtu-Agent (eval-harnesspatroon: data/processing/judging), Devin (verificatie per taak).
- **Structuur:** Per Playbook/taaktype een kleine, echte queryset; judge beoordeelt output tegen rubric; bij side effects telt de eindtoestand. Tot drie Playbooks productie draaien zijn alleen criteria #1, #2, #3, #7 en #16 actieve gates; de rest blijft observatie.
- **Waarom het werkt:** 20 echte cases vangen de meeste regressies; end-state-evaluatie tolereert legitieme padvariatie van agents.
- **Wanneer toepassen:** Vóór iedere promotie (Playbook-versie, modelwissel, promptwijziging in Production Core).
- **Wanneer niet:** Watchlist-experimenten (daar is falen goedkoop).
- **Failure modes:** Judge-bias (→ periodieke menselijke kalibratie); eval-set veroudert (→ elk incident wordt een eval-case).
- **Motor AI-adoptie:** **Adopt as-is.**
- **Benodigde afwijking:** Geen.
- **Bewijs:** anthropic.com/engineering/multi-agent-research-system (2025-06-13). E2.

## PC-15 — Eén canonieke waarheid + transactional outbox

- **Probleem:** Dashboards, boards en harnesses worden ongemerkt tweede state-eigenaren; kopieën lopen uit sync (Motor AI heeft dit vandaag: ≥6 stores).
- **Gebruikt door:** OpenHands (append-only event log = enige waarheid; alles verder read-only observer); ADR-002 (PG = SSOT); industrie (outbox-patroon).
- **Structuur:** Per informatiesoort exact één eigenaar ([§16](05-target-architecture.md#16-source-of-truth-matrix)); afgeleide views zijn expliciet read-only; wijzigingen die derden moeten zien gaan via events uit een transactional outbox in dezelfde PG-transactie.
- **Waarom het werkt:** Er is altijd één plek om te herstellen, te auditen en te migreren; outbox garandeert dat event en state nooit uiteenlopen.
- **Wanneer toepassen:** Alle state; met name task-, approval- en audit-state.
- **Wanneer niet:** —
- **Failure modes:** "Tijdelijke" cache wordt stille eigenaar (→ elk nieuw opslagpunt vereist een regel in de SoT-matrix); outbox-consumer loopt achter (→ monitoring op lag).
- **Motor AI-adoptie:** **Adopt as-is**; consolidatie van de zes bestaande stores is Golf 1-werk.
- **Benodigde afwijking:** Geen.
- **Bewijs:** OpenHands ICLR 2025 (E1/E4); outbox = industriestandaard (E1).

## PC-16 — Progressieve autonomie (approval-modes per risicoklasse)

- **Probleem:** "Alles handmatig goedkeuren" schaalt niet; "alles autonoom" is onverantwoord. Vertrouwen moet meetbaar en omkeerbaar groeien.
- **Gebruikt door:** Claude Code (permission modes: read-only → ask → auto binnen sandbox), Codex (approval modes + sandbox-gradaties), Devin (confidence-labels op reviews).
- **Structuur:** Autonomieniveaus per Playbook × tenant: A0 mens doet het met AI-hulp → A1 agent stelt voor, mens keurt alles → A2 agent voert uit, mens keurt side-effects → A3 agent autonoom binnen budget/policy. Dertig dagen groen is alleen een autonomiepromotiegate, niet een verbod op nieuw A1-werk.
- **Waarom het werkt:** Autonomie wordt een gemeten eigenschap per werksoort in plaats van een geloofsartikel.
- **Wanneer toepassen:** Iedere Playbook krijgt een expliciet autonomieniveau; default A1.
- **Wanneer niet:** —
- **Failure modes:** Niveau verhoogd zonder bewijsperiode (→ minimale bewijsperiode per promotie, zie [§35](09-definition-of-done-11-10.md)); degradatie vergeten na incident (→ automatische degradatie bij incident-severity ≥ hoog).
- **Motor AI-adoptie:** **Adopt patroon**, geïmplementeerd in de Policy Gateway.
- **Benodigde afwijking:** Tenant-dimensie.
- **Bewijs:** Codex/Claude Code docs (E2); Devin docs (E2).
