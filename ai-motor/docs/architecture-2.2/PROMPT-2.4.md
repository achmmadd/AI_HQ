# MOTOR AI 2.4 — Verbeterde opdrachtprompt (marktscan-editie)

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Opvolger van [PROMPT-2.3](PROMPT-2.3.md). Tijdens AM-1-documentbevriezing levert deze prompt alleen delta's voor doc 15 op.

---

## Wat er schuurde in de 2.3-run (en hoe 2.4 het oplost)

| # | Zwakte in 2.3 | Fix in 2.4 |
|---|---|---|
| 1 | **Geen periodieke marktscan-modus.** 2.3 dekt eenmalige architectuursynthese; de vraag "wat doet de markt inmiddels?" is een terugkerend ander taaktype met andere output (kansenlijst, geen architectuur). | 2.4 definieert een aparte, herhaalbare **FASE M (marktscan)** met eigen deliverable-formaat en een kwartaalritme — zelf een Playbook-kandidaat. |
| 2 | **Nieuwe kansen konden de architectuur omzeilen.** Een losse onderzoeksvraag levert een lijst tools op die buiten de lifecycle-matrix en golven om "leuk" lijken. | 2.4 verplicht: elke kans krijgt een adoptieladder-sport, een lifecycle-status (§28) én een golf-plaatsing (§31), anders is het geen aanbeveling maar een notitie. |
| 3 | **Geen hype-filter als expliciete stap.** SEO-/AI-contentfarms domineren 2026-zoekresultaten; benchmarks van vergelijkingssites zijn vaak verzonnen. | 2.4: bronkwaliteit-check verplicht (claim alleen meewegen bij bevestiging door primaire bron); aparte "Hype/Rejected"-sectie is verplicht onderdeel van de output. |
| 4 | **Regelgeving was een bijzaak.** De AI Act-deadline (Art. 50, 2 aug 2026) kwam alleen boven water omdat de researcher er toevallig op stuitte. | 2.4: vaste sub-opdracht "tijdgevoelige regelgeving met deadlines <12 maanden" (AI Act, e-invoicing/Peppol, GDPR-transfers), met verificatiedatum. |
| 5 | **Budget-/capaciteitstoets ontbrak per kans.** Een kansenlijst zonder RAM-/effort-/teaminspanning leidt tot scope-explosie voor één technicus. | Per kans: RAM, effort, vervanging, waarde/mnd, bouwuren en payback <6 maanden; anders Watchlist. |
| 6 | **Commerciële toets was impliciet.** "Zou Motor AI dit later kunnen verkopen?" stond niet in de onderzoeksvraag. | 2.4: vaste sub-opdracht marktprijzen/productiseerbaarheid per kans (wat verkopen agencies, tegen welke retainers, met welk churn-patroon). |

---

## De prompt-aanvulling (FASE M — plakken onder de 2.3-prompt)

```markdown
## FASE M — Periodieke marktscan (apart uitvoerbaar; ritme: per kwartaal of op verzoek)

Doel: vind wat de self-hosted/homelab-community en de SMB-AI-ops-markt inmiddels
doen dat aantoonbaar aansluit op de bestaande Motor AI-architectuur — zonder de
architectuur te omzeilen.

Input: de bestaande synthese, lifecycle-matrix (§28), doc 15 AM-1/AM-2,
de actuele repo-staat en DECISIONS.md.

Onderzoek (max 3 parallelle richtingen, primaire bronnen, datums verplicht):
1. Homelab-/self-hosted-stacktrends: inference-hardware en -modellen realistisch
   op onze hardware; app-laag (documenten, transcriptie, search/scrape, monitoring,
   secrets, backups, updates); ops-patronen.
2. SMB-AI-ops-use-cases met bewijs: wat draaien vergelijkbare kleine bedrijven
   succesvol (document/finance, klantcontact, marketing, BI, AIOps), met welke
   tools en welk bewijsniveau.
3. Tijdgevoelige regelgeving met deadlines < 12 maanden (EU AI Act, e-invoicing/
   Peppol, GDPR-transfer): wat raakt ons, wat is de concrete actie, verificatiedatum.

Bronkwaliteit (verplichte stap): markeer SEO-/AI-contentfarms; een claim telt
alleen mee bij bevestiging door een primaire bron (GitHub-repo, officiële docs,
peer-reviewed werk, gerenommeerde survey). GitHub-stars zijn populariteits-, geen
kwaliteitsbewijs.

Output per kans (verplicht format — anders is het een notitie, geen aanbeveling):
- naam + wat het doet + bewijsniveau (E1–E7) met bron + datum;
- adoptieladder-sport (Adopt/Configure/Wrap/Extend/Build);
- lifecycle-status-voorstel (Production Core max 8/Incubation/Watchlist/Rejected);
- golf-plaatsing (in welke bestaande golf past dit — nieuwe golven alleen met reden);
- RAM-schatting + effort-klasse + wat het vervangt;
- waarde/mnd + bouwuren + payback; zonder aantoonbare payback <6 mnd → Watchlist;
- impact op de acht named routes (`local` is tier, geen nieuwe routeprefix);
- welke bestaande regel/ADR erdoor geraakt wordt (bijv. embeddingswissel = re-index).

Vaste output-secties: Tier 1 (adopt nu) · Tier 2 (ops-verbeteringen) ·
Tier 3 (defer/voorwaardelijk) · Hype/Rejected (verplicht, met reden) ·
Regelgevings-acties met deadline · Delta t.o.v. vorige scan.

Persistentie tijdens de bevriezing: alleen een kort delta-memo in
`15-review-panel.md`; geen doc 16+ en geen PROMPT-2.5. De eigenaar besluit wat landt.
```
