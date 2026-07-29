# 34–35. Definition of Done · Meetbare 11/10-criteria

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Onderdeel van [Motor AI 2.2](README.md). AM-1 activeert vijf meetcriteria; de overige twaalf zijn observaties.

---

## 34. Definition of Done

### DoD per taak (agent-uitgevoerd)

Een taak is pas *done* wanneer:

1. Alle acceptatiecriteria/postconditions uit intake of Playbook aantoonbaar groen;
2. **Bewijs-artifacts** aanwezig en gelinkt aan `task_id` (testoutput / bron-queries / screenshots — geen beweringen zonder artefact);
3. Self-verificatie uitgevoerd zoals een eindgebruiker het zou ervaren (niet alleen unit-checks);
4. Menselijke outcome-review gedaan waar vereist; aparte adversarial-reviewstap is bevroren door AM-1;
5. Vereiste approvals vastgelegd (wie, wanneer, op basis waarvan);
6. Schone eindstaat: geen half werk, open punten expliciet gedocumenteerd;
7. Audit- en usage-events compleet;
8. Postmortem-stap gedraaid (of bewust geskipt bij triviale taken).

### DoD per Playbook-versie

Kleine echte eval-set + menselijke review + status in git + rollbackversie getest. Een registry-product is bevroren.

### DoD per Production Core-component

Voor de **acht AM-1-Core-componenten**: eigenaar + runbook + observability + backup/exit + security-review + testdekking + traceability-rij. Incubation krijgt eigenaar en exitnotitie.

### DoD voor Motor AI 2.2 als geheel (architectuur "af")

Golf 0 groen; ADR-101-spike afgerond; ADR-108/109 van kracht; K1/K2 onder Kernel/Gateway; AM-4-punten 1–5 groen; Playbook #1 dertig dagen groen op de vijf actieve criteria. De dagbrief is Playbook #3, niet de eerste architectuurtest.

---

## 35. Meetbare 11/10-criteria

Eigenaar is Pietje. Baseline-eerst geldt voor de vijf actieve criteria; observaties krijgen nog geen gate-status of geforceerde norm.

### Vijf actieve gates

| # | Criterium | Meetmethode | Streefwaarde | Reactie |
|---|---|---|---|---|
| 1 | Task-success | % zonder handmatige reparatie | ≥90% per productie-Playbook | terug naar A1/status `tested`; postmortem |
| 2 | Menselijke correcties | correcties per 10 runs | ≤2/10 voor A2+ | geen promotie; Playbook aanpassen |
| 3 | Ongeautoriseerde acties | automatische Gateway↔effect-reconciliatie | **0** | kill switch + sev-hoog |
| 7 | Kosten per succesvolle taak | usage ÷ succesvolle taken | binnen Playbookbudget | cap/route/prompt aanpassen |
| 16 | Operatorvertrouwen | maandelijkse eigenaar-score 1–10 | ≥8 voor A3 | kwalitatieve review/degradatie |

### Observaties zonder gate-status tot minstens drie Playbooks productie draaien

| # | Observatie | Meetwijze / huidige notitie |
|---|---|---|
| 4 | Tenantisolatie | isolation-evals; een lek blijft wel een sev-kritiek security-incident |
| 5 | Herstelbaarheid | restore-oefening + crash-recovery |
| 6 | Dataverlies | RPO 24 u bij nightly; 15 min alleen als WAL-shipping apart is besloten |
| 8 | Doorlooptijd | intake→done p50/p90 |
| 9 | False approvals | incidentkoppeling |
| 10 | Rollback | tijd naar vorige versie |
| 11 | Documentatiefreshness | handmatig volgen; doc-freshness-CI en merge-block zijn bevroren |
| 12 | Playbookhergebruik | aantal productie/shared |
| 13 | Incidentfrequentie | sev-gewogen per maand |
| 14 | Evalregressies | scoreverschil per versie |
| 15 | Autonome taakduur | langste succesvolle run; geen nachtploeg vóór AM-1-gate |
| 17 | Commerciële herbruikbaarheid | eerst één betalende hands-on pilot zonder SLA |

### Autonomie-promotieregels (koppeling criteria ↔ autonomieladder)

- **A1 → A2:** actieve criteria #1, #2, #3, #7 en #16 dertig dagen groen voor Playbook×tenant.
- **A2 → A3:** dezelfde vijf zestig dagen groen; kill switch getest; eigenaar-score ≥8.
- **Degradatie:** automatisch één niveau omlaag bij sev-hoog-incident dat aan het Playbook raakt; herstel alleen via nieuwe bewijsperiode.

Nieuw A1-werk mag starten zonder voorafgaande 30-dagen-periode; de bewijsperiode begrenst alleen autonomiepromotie.

### Wat een 11/10 betekent

Niet "de documentatie is indrukwekkend", maar: **een buitenstaander kan met deze repo, de runbooks en de evidence plane verifiëren dat het systeem 30+ dagen betrouwbaar, veilig, herstelbaar en betaalbaar heeft gedraaid — en een tweede tenant kan een bewezen Playbook binnen een dag gebruiken.** Alles daaronder is een lager cijfer, ongeacht hoe mooi de architectuurplaten zijn.
