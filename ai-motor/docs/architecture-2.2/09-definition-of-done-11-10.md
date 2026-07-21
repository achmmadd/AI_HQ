# 34–35. Definition of Done · Meetbare 11/10-criteria

> Onderdeel van [Motor AI 2.2](README.md).

---

## 34. Definition of Done

### DoD per taak (agent-uitgevoerd)

Een taak is pas *done* wanneer:

1. Alle acceptatiecriteria/postconditions uit intake of Playbook aantoonbaar groen;
2. **Bewijs-artifacts** aanwezig en gelinkt aan `task_id` (testoutput / bron-queries / screenshots — geen beweringen zonder artefact);
3. Self-verificatie uitgevoerd zoals een eindgebruiker het zou ervaren (niet alleen unit-checks);
4. Adversarial review gedaan bij R2+ of code;
5. Vereiste approvals vastgelegd (wie, wanneer, op basis waarvan);
6. Schone eindstaat: geen half werk, open punten expliciet gedocumenteerd;
7. Audit- en usage-events compleet;
8. Postmortem-stap gedraaid (of bewust geskipt bij triviale taken).

### DoD per Playbook-versie

Groene eval-set (≥20 echte cases) + menselijke review + registry-promotie + rollbackpad getest.

### DoD per Production Core-component

Eigenaar + runbook + observability + backup/exit-strategie + security-review + testdekking + rij in de traceability-matrix ([§29](07-lifecycle-en-traceability.md)).

### DoD voor Motor AI 2.2 als geheel (architectuur "af")

Alle Golf 0–2-exitcriteria gehaald én de Bokas-pilot 30 dagen door alle vijf gates ([§32](08-migratie-pilot-twaalfweken.md)).

---

## 35. Meetbare 11/10-criteria

Per criterium: meetmethode · streefwaarde · minimale bewijsperiode · eigenaar · reactie bij overtreding. Eigenaar is nu overal Pietje; bij teamgroei worden rollen gesplitst (security/ops). "Baseline eerst": waar geen historische data is, meten we 30 dagen vóór het vastklikken van de streefwaarde.

| # | Criterium | Meetmethode | Streefwaarde | Bewijsperiode | Reactie bij overtreding |
|---|---|---|---|---|---|
| 1 | Task-success | % taken done zonder handmatige reparatie (Kernel-data) | ≥90% per Playbook in production | 30 dgn | Playbook terug naar `tested`; postmortem-analyse |
| 2 | Menselijke correcties | correcties per 10 taken (feedback + postmortems) | dalend per Playbook-versie; ≤2/10 voor A2+ | 30 dgn | geen autonomie-promotie; Playbook-revisie |
| 3 | Ongeautoriseerde acties | side effects zonder Gateway-allow (audit-reconciliatie) | **0** | continu | sev-hoog incident; kill switch toolfamilie; root cause vóór heractivering |
| 4 | Tenantisolatie | isolation-evals + wekelijkse cross-tenant-pentest | 0 lekken | continu | sev-kritiek; tenant-API's dicht tot fix + regressietest |
| 5 | Herstelbaarheid | maandelijkse restore-oefening + geënsceneerde crash mid-task | RTO ≤4 u (PG); taak hervat zonder dubbele side effects | maandelijks | migratie-/deploystop tot geslaagde herhaling |
| 6 | Dataverlies | RPO-meting bij oefening/incident | ≤15 min (PG, Golf 2+) | maandelijks | backup-architectuur herzien |
| 7 | Kosten per succesvolle taak | usage_events ÷ succesvolle taken, per Playbook | ≤ budget per Playbook; trend niet stijgend >20%/mnd zonder verklaring | 30 dgn | budget-cap verlagen; route-/promptoptimalisatie |
| 8 | Doorlooptijd | intake→done p50/p90 per Playbook | p90 binnen Playbook-norm | 30 dgn | bottleneck-analyse (vaak approval-latency) |
| 9 | False approvals | achteraf onterecht gebleken approvals (incidentkoppeling) | 0 met schade; ≤1/kwartaal zonder schade | kwartaal | approval-informatie verbeteren (bewijs bij verzoek) |
| 10 | Rollback | tijd tot vorige Playbook-/deploy-versie actief | ≤15 min, getest | per release | release-freeze tot rollbackpad werkt |
| 11 | Documentatiefreshness | doc-CI: % docs binnen review-termijn (90 dgn) | ≥90%; entrypoints 100% | continu | doc-gardening-taak; merge-block op verlopen kern-docs |
| 12 | Playbookhergebruik | # Playbooks `production` + # tenant-shared | ≥3 production (Golf 3); ≥1 shared (Golf 4) | golf-exit | prioriteit herzien: minder nieuwbouw, meer kristallisatie |
| 13 | Incidentfrequentie | sev-gewogen incidenten/maand | sev-kritiek: 0; sev-hoog ≤1/mnd, dalend | kwartaal | capaciteit van features naar reliability |
| 14 | Evalregressies | eval-score per Playbook-versie t.o.v. vorige | geen daling >5% zonder expliciete acceptatie | per promotie | promotie geblokkeerd |
| 15 | Autonome taakduur | langste succesvolle onbegeleide run (long-running-harnas) | groeiend per kwartaal bij gelijkblijvende criteria 1–3 | kwartaal | niet forceren; eerst 1–3 op orde |
| 16 | Operatorvertrouwen | maandelijkse zelfscore eigenaar (1–10) + "delegeer ik dit blind?"-lijst per Playbook | stijgend; A3-Playbooks alleen bij score ≥8 | maandelijks | kwalitatieve review: wat ondermijnt vertrouwen |
| 17 | Commerciële herbruikbaarheid | tijd om bewezen Playbook bij nieuwe tenant te activeren | ≤1 dag (white-label-runbook + registry) | per nieuwe tenant | provisioning-pad verbeteren |

### Autonomie-promotieregels (koppeling criteria ↔ autonomieladder)

- **A1 → A2:** criteria 1–4 groen gedurende 30 dagen voor dat Playbook × tenant.
- **A2 → A3:** criteria 1–4 én 7–9 groen gedurende 60 dagen; kill switch getest; eigenaar-score ≥8.
- **Degradatie:** automatisch één niveau omlaag bij sev-hoog-incident dat aan het Playbook raakt; herstel alleen via nieuwe bewijsperiode.

### Wat een 11/10 betekent

Niet "de documentatie is indrukwekkend", maar: **een buitenstaander kan met deze repo, de runbooks en de evidence plane verifiëren dat het systeem 30+ dagen betrouwbaar, veilig, herstelbaar en betaalbaar heeft gedraaid — en een tweede tenant kan een bewezen Playbook binnen een dag gebruiken.** Alles daaronder is een lager cijfer, ongeacht hoe mooi de architectuurplaten zijn.
