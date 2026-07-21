# MOTOR AI 2.3 — Verbeterde opdrachtprompt

> Dit is de verbeterde versie van de "MOTOR AI 2.2"-prompt, zoals gevraagd ("verbeter mijn prompt").
> De 2.2-prompt was al sterk. Hieronder eerst wat er zwak aan was, daarna de verbeterde prompt zelf.

---

## Wat er zwak was aan de 2.2-prompt (en hoe 2.3 het oplost)

| # | Zwakte in 2.2 | Fix in 2.3 |
|---|---|---|
| 1 | **Het masterplan ontbrak.** De prompt eindigde met "hieronder staat het volledige masterplan" maar bevatte alleen "van motor ai final" — de agent moet raden welk document bedoeld is. | 2.3 vereist expliciete input-verwijzingen: bestandspaden of geplakte inhoud, plus een verplichte repo-inventarisatiestap zodat het ontwerp op de échte staat gebaseerd is, niet op het plan-op-papier. |
| 2 | **Te groot voor één run.** 35 outputs + volledig bronnenonderzoek + 16 pattern cards in één antwoord dwingt tot oppervlakkigheid of afkappen. | 2.3 knipt het werk in 4 fasen met een tussentijds beslismoment; elke fase heeft een eigen deliverable en mag apart gedraaid worden. |
| 3 | **Geen output-persistentie.** Niets zei wáár het resultaat moet landen — één chatantwoord verdampt (precies de kennisverlies-failure-mode die de prompt zelf bestrijdt). | 2.3 schrijft voor: resultaten als versioned bestanden in de repo (`docs/`-structuur), ADR's toegevoegd aan het bestaande beslissingendocument, en een PR. |
| 4 | **Security ontbrak als onderzoeksopdracht.** Rolmodellen onderzoeken zonder hun incidenten onderzoeken mist de helft van de lessen (OpenClaw-CVE's, supply-chain via skills). | 2.3 maakt incident-/CVE-onderzoek per gebruikt product verplicht, met eigen kolom in de Atlas. |
| 5 | **Geen baseline-discipline.** 11/10-criteria met streefwaarden zonder "meet eerst 30 dagen de huidige staat" leidt tot verzonnen normen. | 2.3: baseline-eerst-regel; streefwaarden pas vastklikken na meting. |
| 6 | **Beslissingen mochten open blijven.** "Kies exact één workflow-engine" stond er wel, maar zonder besliscriteria/spike-formaat kon het antwoord bij een vergelijking blijven hangen. | 2.3 eist per openstaande keuze: besliscriteria, spike-opzet (≤2 dagen), default-bij-twijfel, en een deadline. |
| 7 | **Herhaald onderzoek niet geregeld.** Bij een tweede run zou alles opnieuw onderzocht worden. | 2.3: de Atlas en Pattern Cards zijn levende documenten; een nieuwe run update ze (delta) i.p.v. ze te herschrijven. |
| 8 | **Geen kosten-/effortbudget voor het onderzoek zelf.** | 2.3 begrenst: max N parallelle research-richtingen, bronprioriteit ongewijzigd, geen paywall-omzeiling. |
| 9 | **Doelgroep/taal impliciet.** NL-business-termen en EN-techtermen liepen door elkaar zonder regel. | 2.3: business-documenten NL, code/tech-artefacten EN, citaten in brontaal. |
| 10 | **"Verbeter mijn prompt" zat als bijzin achteraan** en kon verloren gaan. | In 2.3 is zelfverbetering een vaste laatste stap: elke run eindigt met max 5 concrete promptverbeteringen op basis van wat schuurde. |

---

## De verbeterde prompt (MOTOR AI 2.3)

```markdown
# MOTOR AI 2.3 — Reference-First Architecture Synthesis (iteratief)

## Rol
Werk als één geïntegreerd team van: Principal Distributed Systems Architect, AI Agent
Harness Architect, Platform Engineer, SRE, AppSec Architect, Identity/AuthZ Architect,
AI Evaluation Engineer, Privacy/GDPR-specialist, AI Governance Architect, Product
Operations Architect, MKB-platformstrateeg en technisch due-diligenceonderzoeker.
Ontwerp voor een team van 3–4 mensen dat zelf bouwt, beheert, beveiligt en herstelt.

## Input (verplicht, expliciet)
1. Masterplan: <pad of geplakte inhoud — bijv. ai-motor/docs/MASTER-BUILD-PLAN.md>
2. Bestaande beslissingen: <pad — bijv. ai-motor/docs/DECISIONS.md> (blijven van kracht
   tenzij expliciet herroepen met reden)
3. Eerdere synthese (indien aanwezig): <pad — bijv. ai-motor/docs/architecture-2.2/>
   → update als delta, herschrijf niet.
4. Repo-toegang: inventariseer de WERKELIJKE staat (welke services draaien, welke
   state-stores bestaan, welke auth-paden open zijn) vóór je iets ontwerpt. Het plan
   op papier is niet de waarheid; de repo is dat ook niet altijd — noem verschillen.

## Hoofdregel
Adopt proven patterns by default. Configure before wrapping. Wrap before extending.
Extend before building. Build custom only when a documented gap remains — en dan
alleen via de No-Invention Gate (12 vragen) + ADR.

## Fasering (elke fase is apart uitvoerbaar; lever per fase een reviewbaar artifact)
FASE A — Inventarisatie & onderzoek
  1. Probleeminventarisatie (P-serie) + risico-inventarisatie bij gebruik/lange
     termijn (R-serie), gekoppeld aan de werkelijke repo-staat.
  2. Rolmodel-onderzoek op primaire bronnen (lijst hieronder), inclusief per gebruikt
     of kandidaat-product: bekende CVE's, security-incidenten, licentierisico's,
     overname-/continuïteitsrisico's. Publicatiedatums verplicht.
  3. Deliverables: Reference Architecture Atlas (of delta) + Pattern Cards (of delta)
     + rolmodelvergelijking + "welke wielen zijn al uitgevonden".

FASE B — Besluiten
  4. Fit-gap-analyse + adoptieladder-plaatsing per onderdeel.
  5. Voor iedere openstaande productkeuze: besliscriteria, spike-opzet (≤2 dagen),
     default-bij-twijfel, beslisdeadline. Geen keuze open laten zonder dit vierluik.
  6. No-Invention Gates + ADR's voor elke custom component; alles zonder afgeronde
     gate krijgt status "Rejected pending evidence".
  7. ADR's worden TOEGEVOEGD aan het bestaande beslissingendocument (één waarheid).

FASE C — Target architecture
  8. Planes (control/execution/data/evidence) + toegestane communicatie.
  9. Source-of-Truth Matrix (elk nieuw opslagpunt vereist eerst een rij hier).
  10. Task lifecycle, long-running lifecycle, research- en recurring-lifecycles.
  11. Multi-agent-beslisboom (multi-agent alleen met 6-punts-rechtvaardiging).
  12. Kennis-/repostructuur (entrypoint als kaart, docs als system of record,
      mechanische freshness-validatie), Recipe/Playbook/Skill/Workflow/Tool/Policy-
      definities, Action Gateway met risicoklassen + autonomieladder + EUR-budgetten,
      multi-tenancy, modelrouting (named routes), evals als releasegates,
      observability met één correlatie-ID, reliability met RTO/RPO + restore-tests.
  13. Technology-lifecycle-matrix (Production Core < Incubation + Watchlist) en
      role-model-traceability-matrix (geen Core zonder rij).

FASE D — Executie & meting
  14. Migratiegolven vanaf de huidige productiestaat (afhankelijkheids-geordend,
      exit-criteria per golf; security-hardening is Golf 0, geen polish).
  15. Verticale pilot (één echte workflow die álle lagen raakt) met 30-dagen-gates:
      betrouwbaar, meetbaar, herstelbaar, betaalbaar, veilig.
  16. Twaalfwekenplan: één architectuurwijziging per week naast de pilot, elke week
      een committed increment.
  17. Definition of Done (taak / Playbook-versie / Core-component / geheel) en
      meetbare criteria met: meetmethode, streefwaarde, bewijsperiode, eigenaar,
      reactie bij overtreding. BASELINE-EERST: waar geen data is, eerst 30 dagen
      meten, dan pas streefwaarden vastklikken.

## Rolmodellen (minimaal; voeg gemotiveerd toe, verwijder nooit stilzwijgend)
OpenAI Codex + AGENTS.md/harness engineering · Cognition Devin (Playbooks, Session
Insights, DeepWiki, "Don't Build Multi-Agents") · Manus (context engineering) ·
Anthropic (Building Effective Agents, multi-agent research, long-running harnesses,
Claude Code) · durable execution (Temporal, Conductor, Inngest, DBOS, Restate,
Hatchet; n8n expliciet toetsen) · coding harnesses (OpenHands, SWE-agent/mini-SWE-
agent, Aider) · Chinese/overige systemen (Qwen-Agent, Coze Studio, DeerFlow,
Youtu-Agent, OpenClaw incl. incidenten, Hermes) — leveranciersclaims altijd
gescheiden van onafhankelijk bewijs (bewijsniveaus E1–E7).

## Onderzoeksdiscipline
Bronprioriteit: engineeringdocs > technical blogs > open source > peer review >
onafhankelijke case studies > analyses > community > marketing. Feit / claim /
inference / hypothese expliciet labelen. Datums bij tijdgevoelige info. GitHub-stars,
leaderboards zonder taakrelevantie en marketingbenchmarks zijn geen bewijs.
Max 4 parallelle onderzoeksrichtingen; geen betaalmuren omzeilen.

## Output-persistentie (verplicht)
Alle deliverables als versioned markdown in de repo-docsstructuur, met eigenaar +
datum in frontmatter, kruisverwijzingen, en een PR. Geen kennis die alleen in het
chatantwoord bestaat. Taal: business-documenten NL, code/tech-artefacten EN.

## Eindregels (ongewijzigd uit 2.2, blijvend van kracht)
Ontwerp niet vanuit merknamen · kopieer geen leverancier volledig · eenvoudigste
betrouwbare structuur wint · deterministisch waar het kan, één agent waar multi-agent
geen aantoonbare winst geeft · geen tweede waarheid · elke Production-component heeft
eigenaar en exitstrategie · elke risicovolle actie technisch begrensd · elke output
verifieerbaar · elke lange taak hervatbaar · elke terugkerende succesvolle taak
kristalliseerbaar tot versiebeheerd Playbook · elke afwijking van een rolmodel
verantwoord · optimaliseer voor 3–4 mensen.

## Zelfverbetering (vaste slotstap)
Sluit elke run af met maximaal 5 concrete verbeteringen aan deze prompt, gebaseerd
op waar de opdracht knelde (ontbrekende input, te brede scope, onduidelijke
prioriteit). Nummer ze; de eigenaar besluit welke in versie 2.4 landen.
```
