# 31–33. Migratiegolven · Verticale Bokas-pilot · Twaalfwekenplan

> Onderdeel van [Motor AI 2.2](README.md). Startpunt = huidige productiestaat (NUC + Hetzner, masterplan Fase 0–1 deels uitgevoerd, ADR-002-milestones lopen).

---

## 31. Migratiegolven

Golven zijn afhankelijkheids-geordend; geen kalenderbeloften per golf, wel harde exit-criteria. Het bestaande masterplan (Fase 0/1) is Golf 0–1-werk en blijft geldig.

### Golf 0 — Stop het bloeden (loopt al / direct)

- Fase 0-bugfixes uit het masterplan afronden: **auth-gaten dichten** (`/api/chat/*` uit PUBLIC_PATHS, server-side scope-enforcement), kennisbank-collecties, `knowledge_documents`.
- **OpenClaw-hardening (ADR-106)** — mag niet wachten op de rest.
- Secrets-inventarisatie: welke credentials liggen waar; verwijder gedeelde/verweesde keys.
- **Exit:** cross-tenant curl faalt; OpenClaw niet publiek bereikbaar en met auth; geen bekende open auth-paden.

### Golf 1 — Fundament: één waarheid, één engine, één gateway

- ADR-002 afmaken (PG-cutover M4–M6).
- **ADR-101-spike** → canonieke engine kiezen en installeren.
- **Motor Kernel v1**: `tasks`, `task_events`, `approvals` + eerste lifecycle-workflow; cowork-inbox en Telegram worden emitters/views.
- **Action Gateway v1**: risicoklassen, deny/allow/approve, audit-events; eerst vóór de meest risicovolle toolfamilies (mail, betalingen, deletes, deploys).
- **Kennisconsolidatie start**: nieuwe `docs/`-structuur (§20) aangemaakt in de repo; AGENTS.md herschreven als kaart; doc-CI (linkcheck + freshness) aan.
- **Decommission-lijst uitvoeren**: EXECUTION_BOARD.db, Chroma; inventarisatie omega/holding/evomap/singularity → uit wat niemand mist.
- LiteLLM live met named routes + tenant-keys; Langfuse-tracing op alle paden.
- **Exit:** één task-waarheid; engine draait ≥1 echte HITL-flow; Gateway blokkeert aantoonbaar (policy-eval groen); restore-test PG geslaagd.

### Golf 2 — Verticale Bokas-pilot (§32) + lifecycle compleet

- Volledige task lifecycle op één echte workflow (de Dagelijkse Bokas Management Brief).
- Playbook-registry v1 + eerste Playbook onder versiebeheer + eval-set (≥20 echte cases).
- Session-postmortem-stap + review-queue.
- Isolation-evals in CI.
- **Exit:** pilot draait dagelijks; alle §32-criteria meetbaar; 30-dagen-klok start.

### Golf 3 — Verbreden en opschonen

- Tweede en derde Playbook (bijv. Fumero-contentworkflow, bonnen/boekhoudflow) — hergebruik van dezelfde lifecycle, géén nieuwe architectuur.
- Code-agent-taken via sandbox + coding-CLI (masterplan-gap #7).
- n8n-flows migreren naar engine-stappen waar ze state droegen; **Dify uit** (ADR-105).
- Long-running-harnas voor het eerste grote bouwproject.
- **Exit:** 3 Playbooks in production; Dify uit; RAM-headroom ≥4 GB; alle Production Core-componenten hebben runbook + eigenaar.

### Golf 4 — Productfabriek

- Playbook-promotie tenant → tenant-shared (eerste herbruikbare product-Playbook).
- Autonomie-promoties op basis van bewijsperiodes (A1→A2 waar cijfers het toestaan).
- White-label-runbook uitbreiden met Playbook-provisioning per nieuwe tenant.
- **Exit:** één Playbook aantoonbaar hergebruikt bij tweede tenant zonder herbouw; §35-metrieken 30 dagen groen.

---

## 32. Verticale Bokas-pilot: Dagelijkse Bokas Management Brief

Eén echte workflow als architectuurtest — hij raakt élk onderdeel van de target architecture.

### Specificatie

- **Input** (per bron een adapter, elk met bron+timestamp in het resultaat): omzet & orders & annuleringen (kassa/Odoo via bookkeeping-pad), populaire producten, voorraadsignalen, personeelsbezetting (roosterbron of handmatige input), weer (publieke API), reviews (scrape/API), operationele incidenten (takenlog).
- **Output** (dagelijks, vast tijdstip, naar Telegram + Motor UI): managementsamenvatting; afwijkingen t.o.v. verwachtingspatroon; oorzaakhypothesen (expliciet als hypothese gelabeld); concrete aanbevelingen; **bewijs en bronnen bij elk cijfer**; takenvoorstellen (concept-taken in de Kernel); approvalverzoeken waar acties uit voortvloeien.

### Architectuurdekking (de eigenlijke test)

```
Intake (cron-trigger in engine)
→ data ingestion (adapters, elk idempotent, elk met bronvermelding)
→ tenant isolation (alle queries RLS/payload-gefilterd op bokas)
→ workflow-state (engine-run, crash-recovery getest: kill mid-run → hervat)
→ planning (deterministische workflow — beslisboom §19: stappen zijn vooraf bekend;
   alleen de analyse-/schrijfstap is een LLM-stap)
→ modelrouting (chat.deep voor analyse, judge voor eval; budget-cap per run)
→ policy check (Gateway: brief = R1; takenvoorstellen met side effects = R2 → approval)
→ execution
→ verification (cijfers matchen bron-queries — end-state-check; geen cijfer zonder bron)
→ evidence (query-resultaten + bronnen als artifacts, gelinkt aan task_id)
→ human approval (alleen voor voorgestelde acties, niet voor de brief zelf)
→ output (Telegram + UI)
→ audit (volledige task_events + Gateway-log)
→ feedback (eigenaar beoordeelt: nuttig/onnuttig + correcties — 30 sec werk)
→ Playbook improvement (wekelijkse postmortem-batch → Playbook-versie omhoog)
```

### 30-dagen-gates vóór iedere volgende complexe divisie

| Gate | Norm |
|---|---|
| Betrouwbaar | ≥95% van de dagen geleverd vóór deadline zonder handmatige reparatie |
| Meetbaar | elk cijfer herleidbaar naar bron; judge-eval wekelijks groen |
| Herstelbaar | ≥1 geënsceneerde crash mid-run hersteld zonder dataverlies of dubbele output |
| Betaalbaar | kosten per brief ≤ vastgesteld budget (EUR-cap; streefwaarde bij start vastleggen) |
| Veilig | 0 cross-tenant-lekken; 0 ongeautoriseerde side effects; Gateway-log compleet |

Pas als alle vijf 30 dagen staan: tweede divisie/workflow van vergelijkbare complexiteit.

---

## 33. Twaalfwekenplan

Weken zijn richtinggevend voor volgorde en parallelliteit (geen kalenderbelofte); elke week eindigt met een committed, getest increment (long-running-discipline op onszelf toegepast).

| Week | Focus | Belangrijkste deliverables |
|---|---|---|
| 1 | Golf 0 | Auth-gaten dicht; OpenClaw-hardening uitgevoerd; secrets-inventaris |
| 2 | Golf 0→1 | ADR-101-spike (Inngest vs DBOS) + besluit; PG-cutover-milestones op koers |
| 3 | Golf 1 | Kernel v1-schema (`tasks`/`task_events`/`approvals`); eerste engine-workflow met HITL-wait; Telegram-emitter |
| 4 | Golf 1 | Action Gateway v1 (mail/pay/delete-families); policy-evals; audit-events |
| 5 | Golf 1 | Kennisstructuur §20 aangemaakt; AGENTS.md als kaart; doc-CI; decommission EXECUTION_BOARD.db + Chroma |
| 6 | Golf 1 | LiteLLM named routes + tenant-keys; Langfuse-correlatie via task_id; restore-test PG (evidence vastleggen) |
| 7 | Golf 2 | Bokas-brief: adapters (omzet/orders/weer/reviews) idempotent + bronvermelding |
| 8 | Golf 2 | Bokas-brief: volledige lifecycle-run end-to-end in staging; crash-recovery-test |
| 9 | Golf 2 | Playbook-registry v1; Brief-Playbook v1 + eval-set (≥20 echte dagen/cases); judge-rubric |
| 10 | Golf 2 | **Pilot live** — dagelijkse brief in productie; 30-dagen-klok start; feedback-knop |
| 11 | Golf 2/3 | Postmortem-loop actief (wekelijkse batch); isolation-evals in CI; runbooks voor Core-componenten |
| 12 | Golf 3-start | Evaluatie tegen §34/§35; besluit tweede Playbook; Dify-migratie-inventaris; dit document bijwerken met geleerde lessen |

Parallel-regel: max één architectuurwijziging per week naast de pilot; team van 3–4 verdraagt geen drie gelijktijdige fundamentwissels.
