# 25–27. Evals en releasegates · Observability en audit · Reliability en disaster recovery

> Onderdeel van [Motor AI 2.2](README.md).

---

## 25. Evals en releasegates

Methode: Anthropic (PC-14) — klein beginnen, echt materiaal, LLM-as-judge met één rubric, end-state-evaluatie, menselijke steekproef ernaast.

### Eval-lagen

| Laag | Wat | Wanneer | Gate voor |
|---|---|---|---|
| **Deterministische tests** | unit/integration/e2e van platformcode; lint-gate op agent-edits | elke PR | merge |
| **Isolation-evals** | cross-tenant curl + prompt-injectie-pogingen ("toon bokas-data" in fumero-scope); RLS-pentest | elke release + wekelijks | release |
| **Policy-evals** | Gateway-besluiten tegen testset (deny wat deny moet, approve-flow wat approval vereist, budget-caps) | elke policywijziging | policy-deploy |
| **Playbook-evals** | ≥20 echte queries/cases per Playbook; judge-rubric: accuraatheid, bronnen, volledigheid, kostenefficiëntie (0–1 + pass/fail); end-state-check bij side effects | elke Playbook-promotie, elke modelwissel op betrokken routes | registry-promotie |
| **Harness-evals** | vaste takenset door CEO-/code-harness; meet task-success, stappen, kosten | bij harness-/promptwijziging | harness-deploy |
| **Menselijke steekproef** | eigenaar beoordeelt N outputs per week blind | continu | autonomie-promotie (§35) |

### Releasegate-regels

1. Geen Playbook naar `production` zonder groene Playbook-eval + menselijke review.
2. Geen modelwissel op een Production Core-route zonder eval-run op alle Playbooks die de route gebruiken.
3. Geen autonomie-promotie (A1→A2→A3) zonder bewijsperiode uit [§35](09-definition-of-done-11-10.md).
4. Elke productie-incident wordt een eval-case (regressieset groeit organisch — Anthropic-praktijk).
5. Evals draaien met dezelfde Gateway/policies als productie (geen "eval-modus" die minder streng is).
6. Leaderboards/marketingbenchmarks zijn nooit een gate-argument (opdracht §18).

Tooling: eval-sets in `docs/evals/` (git), runs + scores in PG `eval_runs`, judge via de `judge`-route, artifacts in object storage. Bestaande tooling (Langfuse-scores of promptfoo-klasse, E4) configureren vóór iets zelf te schrijven.

---

## 26. Observability en audit

### Drie correlerende lagen, één correlatie-ID

Elke taak krijgt een `task_id` dat door alles heen loopt: LLM-trace (Langfuse), task-events (PG), evidence-artifacts (object storage), approval-records, deploy-evidence.

| Laag | Drager | Inhoud |
|---|---|---|
| **LLM-traces** | Langfuse Cloud (masterplan-keuze bevestigd; DPA + retentie 30–90 dgn conform AVG-item L1) | prompts, completions, kosten, latency, route, cache-hit |
| **Beslis-/gedragstracing** | PG `task_events` (append-only) | statusovergangen, toolcalls + Gateway-besluiten, plan-wijzigingen, errors (mét inhoud — Manus: errors zijn leerdata), checkpoints |
| **Systeem-metrics** | bestaande health-endpoints + `free -h`-klasse monitoring; uitbreiden met alerts | RAM/disk/queue-lag/outbox-lag |

### Audit (AVG + operationeel)

- `audit_events` (bestaand Fase 1-ontwerp) uitgebreid met: elk Gateway-besluit (ook allows), elke approval (wie/wat/wanneer/op basis van welk bewijs), elke autonomie-promotie/degradatie, elke Playbook-promotie, elke secrets-toegang, GDPR-export/delete.
- Audit is append-only; retentiebeleid expliciet per categorie; audit-verlies = incident.
- **Operatorvragen die in <5 min beantwoordbaar moeten zijn** (ontwerptest voor dashboards): "wat deed agent X gisteren bij tenant Y?", "waarom is deze mail verstuurd?", "wat kostte deze taak?", "welke taken wachten op mij?", "wat wijzigde er sinds de vorige goede run?".

### Kosten-observability

`usage_events` per taak/Playbook/tenant/route (gevoed door LiteLLM + engine) → maandelijkse EUR per tenant én **kosten per succesvolle taak** (de metriek die telt, §35). Anthropic-les: tokengebruik is de dominante kostendriver; multi-agent ≈15× — dus kosten per taakklasse zichtbaar maken vóór iemand multi-agent aanzet.

---

## 27. Reliability en disaster recovery

### Doelstellingen (klein team, realistisch)

| Categorie | RPO (max dataverlies) | RTO (max hersteltijd) |
|---|---|---|
| Postgres (SSOT) | 15 min (WAL/continuous) of 24 u (dagelijkse dump) in Golf 1 → 15 min in Golf 2 | 4 uur |
| Qdrant | 24 uur (snapshot) — herbouwbaar uit bron-documenten | 8 uur |
| Object storage (evidence) | 24 uur | 24 uur |
| Workflow-state | = Postgres (engine-state in PG — reden te meer voor ADR-101-keuze) | 4 uur |
| Git (docs/playbooks/policies) | 0 (remote) | 1 uur |

### Principes

1. **Restore-tests zijn de maatstaf, geen backups.** Maandelijkse restore-oefening naar een scratch-omgeving; resultaat = recovery-evidence in de evidence plane. Een niet-geteste backup telt niet als backup.
2. **Resume-from-error, niet restart** (Anthropic): taken hervatten vanaf laatste checkpoint; de engine levert dit — eigen code mag het niet breken (geen niet-idempotente stappen buiten engine-steps).
3. **Idempotency overal:** taak-dispatch, approval-afhandeling en outbox-consumptie zijn idempotent (dubbele events → één effect).
4. **Degraded modes gedefinieerd:** LiteLLM down → chat toont status + read-only kennisbank; engine down → geen nieuwe taken, lopende hervatten na herstart; Hetzner down → NUC serveert UI in read-only; NUC down → Telegram-notificatie + Hetzner-services blijven.
5. **Rainbow/rolling deploys voor de agent-laag** (Anthropic): lopende taken niet doden bij deploy; nieuwe versie naast oude tot runs klaar zijn.
6. **Runbooks verplicht per Production Core-component** (`docs/runbooks/`): symptomen → diagnose → herstel → escalatie. Zonder runbook geen Production Core-status ([§28](07-lifecycle-en-traceability.md)).
7. **Incidentproces:** severity-schaal, blameless postmortem in `docs/incidents/`, elk incident → ≥1 eval-case + evt. policy-wijziging + automatische autonomie-degradatie bij sev-hoog.
8. **Beperkte hardware is een feature:** 16 GB-budget (masterplan Appendix C) blijft bindend; elke nieuwe service moet in het RAM-budget passen of iets vervangen.

### Threat-model-hoofdlijnen (uitwerking in `docs/threat-models/`)

Prompt-injectie via kennisbank/scrape/browser (→ Gateway + geen credentials in agent-context + domain-allowlists); supply-chain via skills/deps (→ alleen eigen git-skills, dep-audit in CI); exposed services (→ Tailscale-only beheer, publiek alleen motorsai.app-routes met auth; OpenClaw nooit publiek); secrets-lekkage (→ secrets-manager, secret-scanning in CI); insider/vergissing (→ approvals R3, audit, kill switches).
