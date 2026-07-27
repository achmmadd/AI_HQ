# 31–33. Migratiegolven · Verticale Bokas-pilot · Twaalfwekenplan

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2](README.md). Startpunt = [feitelijke nulmeting](00-HUIDIGE-STAAT.md); AM-2 bepaalt de weekvolgorde.

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
- **ADR-101-bevestigingsspike:** Inngest maximaal 3 architectuurdagen (1/week, week 3–5); DBOS alleen na trigger 3–5 opeenvolgende dagen.
- **Motor Kernel v1 op Hetzner**: `tasks` als event-projectie, `task_events`, approvals, reconciliation en extra foutstates/leases.
- **Action Gateway v1 op Hetzner**: credential-broker voor alleen mail/pay/delete via engine; OpenClaw-omleiding pas Golf 3.
- **Kennisconsolidatie minimaal**: root-AGENTS als kaart; geen doc-freshness-CI.
- **Legacy:** omega/holding/evomap/factory-os/singularity bevriezen → 30 dagen → verwijderen; geen inventarisatieproject.
- LiteLLM live met acht named routes + tenant-keys; Langfuse op alle paden maar voor PII alleen metadata/kosten.
- **Compliancepakket v1 (AM-4):** Art. 30-register/subverwerkers incl. Telegram-besluit; dataklassen; PII-tracingbeleid; Telegram link-only; bewaartermijnen + geteste delete-run; approvalmatrix; vakantiestand met extern restorecontact (2 u/mnd); operator-events; Art. 4/50.
- **Exit:** één task-projectie uit engine-events; reconciliation groen; engine draait ≥1 echte HITL-flow; Gateway-tests groen; restore/delete-run geslaagd.

### Golf 2 — Waarde-Playbooks migreren en lifecycle bewijzen

- K2 reviews (#1) en K1 bonnetjes (#2) draaien eerst bewust op de bestaande stack en migreren in week 6–9 naar Kernel/Gateway.
- De K1/K2-migratie is de architectuurtest; de dagbrief volgt als Playbook #3 in week 9–12.
- Playbooks staan in een git-map met statuskolom; geen registry-product.
- Session-postmortem-stap + review-queue.
- **Exit:** K1/K2 onder Kernel/Gateway; dagbrief meetbaar; vijf actieve criteria beschikbaar.

### Golf 3 — Verbreden en opschonen

- OpenClaw-side effects omleiden naar Gateway.
- Code-agent in één gecontroleerde sandbox; een parallelle sandbox-vloot blijft bevroren tot de AM-1-gate.
- n8n-flows migreren naar engine-stappen waar ze state droegen; **Dify uit** (ADR-105).
- Long-running-harnas voor het eerste grote bouwproject.
- **Exit:** 3 Playbooks in productie; Dify uit; RAM-headroom ≥4 GB; acht Core-componenten hebben runbook + eigenaar.

### Golf 4 — Eén betalende pilotklant

- Eerst één betalende pilotklant uit het eigen netwerk, hands-on en zonder SLA-belofte.
- Klantgerichte productie draait niet vanaf de thuissite.
- Pas na de pilot: productstrategie, tenant-shared promotie en provisioning.
- **Exit:** pilot betaald en handmatig beheersbaar; geen SLA- of schaalclaim.

---

## 32. Verticale Bokas-pilot: Dagelijkse Bokas Management Brief

Playbook #3, week 9–12. Hij raakt alle lagen, maar **de K1/K2-migratie in week 6–9 is de architectuurtest**.

### Specificatie

- **Input:** omzet/orders/annuleringen, voorraad, weer, reviews en incidenten, elk met bron+timestamp. Personeelsbezetting wordt gemaskeerd vóór een cloud-route; Art. 9-data is uitgesloten zonder DPIA.
- **Output:** volledige brief in Motor UI; Telegram bevat uitsluitend notificatie+deeplink. Elk cijfer heeft bewijs/bron; acties blijven concept tot approval.

### Laagdekking van Playbook #3

```
Intake (cron-trigger in engine)
→ data ingestion (adapters, elk idempotent, elk met bronvermelding)
→ tenant isolation (alle queries RLS/payload-gefilterd op bokas)
→ workflow-state (engine-run, crash-recovery getest: kill mid-run → hervat)
→ planning (deterministische workflow — beslisboom §19: stappen zijn vooraf bekend;
   alleen de analyse-/schrijfstap is een LLM-stap)
→ modelrouting (chat.deep voor analyse, judge voor eval; budget-cap per run)
→ Gateway broker/proxy (brief R1; side effects R2 → hashgebonden approval)
→ execution
→ verification (cijfers matchen bron-queries — end-state-check; geen cijfer zonder bron)
→ evidence (query-resultaten + bronnen als artifacts, gelinkt aan task_id)
→ human approval (alleen voor voorgestelde acties, niet voor de brief zelf)
→ output (Motor UI; Telegram notificatie + link)
→ audit (volledige task_events + Gateway-log)
→ feedback (eigenaar beoordeelt: nuttig/onnuttig + correcties — 30 sec werk)
→ Playbook improvement (wekelijkse postmortem-batch → Playbook-versie omhoog)
```

### Kwaliteitsnormen en autonomiepromotie

| Gate | Norm |
|---|---|
| Betrouwbaar | ≥95% van de dagen geleverd vóór deadline zonder handmatige reparatie |
| Meetbaar | elk cijfer herleidbaar naar bron; judge-eval wekelijks groen |
| Herstelbaar | ≥1 geënsceneerde crash mid-run hersteld zonder dataverlies of dubbele output |
| Betaalbaar | kosten per brief ≤ vastgesteld budget (EUR-cap; streefwaarde bij start vastleggen) |
| Veilig | 0 cross-tenant-lekken; 0 ongeautoriseerde side effects; Gateway-log compleet |

De vijf normen meten ieder Playbook. Dertig dagen groen is vereist voor autonomiepromotie A1→A2→A3, **niet** voor het starten van nieuw A1-werk. De AM-1-scopefreeze blijft afzonderlijk gelden tot Playbook #1 dertig dagen groen is.

---

## 33. Twaalfwekenplan

Weken zijn richtinggevend. AM-1 is de scopegate; AM-2 is de vroegst mogelijke volgorde.

| Week | Focus | Belangrijkste deliverables |
|---|---|---|
| 1 | Golf 0 + K2 | Live authbewijs, OpenClaw-hardening, secrets; K2 start op n8n met Telegram-notificatie en approval in Motor UI (wegwerp) |
| 2 | K2 + K1 | K2 live als #1; K1 bonnetjes→Moneybird v1 starten met cloud-vision en handmatige approval per boeking |
| 3 | Waarde + architectuur ≤1 dag | K1 v1; ADR-108/109-acceptatietests voorbereiden; Inngest-gates deel 1 |
| 4 | Waarde + architectuur ≤1 dag | K1 live als #2; Inngest recovery/race/backup; Kernel-tabellen ontwerpen |
| 5 | Besluit | Inngest uiterlijk 2026-08-30 bevestigen of DBOS-trigger activeren; downstream schuift. ComfyUI alleen als #1 al 30 dagen groen is |
| 6 | Kernel+Gateway start | Kernel-tabellen, Gateway-skeleton en exact acht LiteLLM-routes; K1/K2 blijven op wegwerp-stack |
| 7 | Gateway v1 + migratie | Mail/pay/delete-tests groen; daarna K1/K2-migratie starten; task-projectie + reconciliation |
| 8 | Migratie+regressie | Migratie voortzetten; crash/multi-node/race/idempotency herhalen op gekozen engine; restore naar wegwerp-container |
| 9 | Architectuurtest | K1/K2 onder Kernel/Gateway; dagbrief #3 starten vanuit bestaande adapters |
| 10 | Dagbrief #3 | UI-output, Telegram link-only, bronbewijs en masking |
| 11 | Dagbrief #3 | Kwaliteitsmeting, postmortem, vijf actieve criteria; geen registry-product |
| 12 | Dagbrief #3 | Productierun en feedback; autonomie blijft A1 tot bewijsperiode groen is |

Parallel-regel: maximaal **één architectuurdag per week** in week 3–5. De capaciteit is één technicus + 2–3 niet-technische helpers.
