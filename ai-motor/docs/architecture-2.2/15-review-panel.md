# 41. Review-panel — vier onafhankelijke inspecties + consolidatie-besluiten

> Aanvulling op [Motor AI 2.2](README.md). Datum: 2026-07-23.
> Vier onafhankelijke, adversariële reviews van de volledige documentset (doc 01–14 + masterplan + DECISIONS + repo-staat), elk vanuit een andere discipline. Dit document consolideert de bevindingen en legt **bindende amendementen** vast: waar dit document conflicteert met doc 01–14, geldt dit document.

---

## 41.1 Paneloverzicht

| Reviewer (rol) | Cijfer | Kernoordeel in één zin |
|---|---|---|
| **SRE / haalbaarheid** | **4/10 zoals geschreven · 7/10 met minimale variant** | Architectuur intellectueel uitstekend, maar gevalideerd tegen een team dat niet bestaat; de meta-last (17 criteria, ±17 Core-componenten, nachtploeg-ochtenden) eet de vooruitgang op. |
| **Distributed-systems-architect** | **6,5/10 → 8 na twee extra ADR's** | Precies op de kernpunten (Kernel↔engine-consistentie, Gateway-afdwingbaarheid, runtime-plaatsing over drie machines) staan open vragen die als besloten worden gepresenteerd. |
| **Business / MKB-product** | **6/10 (architectuur 8,5 · businessplan 4)** | De waarde-volgorde is omgekeerd: de eigen beste kansen (bonnetjes, reviews) zijn naar maand 4+ verbannen ten gunste van een architectuurtest; EUR-prioritering ontbreekt. Het plan hoeft niet herschreven — het hoeft omgedraaid. |
| **Privacy/AVG & governance** | **voorwaardelijk** | Datasoevereiniteit ver boven MKB-niveau, maar compliance leunt op tekst: geen bewaartermijnen/verwijderpad, Telegram als blinde vlek, Langfuse-traces ondergraven de PII-regels, approval-ontwerp regelt "wanneer" maar niet "wie" en "wat". |

**Convergentie (alle vier onafhankelijk):** (1) het plan is gedimensioneerd op 3–4 technici terwijl het echte team 1 technicus + 2–3 niet-technische helpers is; (2) de "dunne" componenten (Gateway, Kernel) zijn in werkelijkheid het zwaartepunt; (3) docs 10–14 vormen samen precies de scope-explosie waar elk doc afzonderlijk voor waarschuwt; (4) de sterkste onderdelen zijn de No-Invention-discipline, Golf 0-security-eerst en de meetbaarheidsambitie.

## 41.2 Geconsolideerde topbevindingen

Gededupliceerd over de vier reviews; bronverwijzing per reviewer (O=ops, A=architectuur, B=business, P=privacy).

| # | Ernst | Bevinding | Bron |
|---|---|---|---|
| 1 | Kritiek | **n=1-realiteit:** ±17 Core-componenten × 6 zorgplichten + 17 meetcriteria is onhoudbaar; de bewijsketen (evals/evidence) sneuvelt het eerst en dan is "11/10" fictie | O-1, O-10, B-6, P-6 |
| 2 | Kritiek | **Waarde-volgorde omgekeerd:** eerste eigenaarswaarde pas week 10; K2 (reviews) en K1 (bonnetjes) kunnen op de bestaande stack in week 1–4 en zijn naar Golf 3 verbannen met een cirkelredenering | B-1, B-2 |
| 3 | Kritiek | **Kernel↔engine dual-truth:** `tasks` (PG) én engine-run-state zijn beide als waarheid gedeclareerd zonder reconciliatie-ontwerp; bij Inngest komt er zelfs een derde store bij die nergens in RAM/backup/SoT staat | A-1, A-4 |
| 4 | Kritiek | **Gateway-enforcement onbeslist:** advies-check (HTTP) en credential-broker (proxy) worden door elkaar gebruikt; fail-open/closed niet gespecificeerd; budget-check niet atomair (race bij parallelle taken); approval niet gebonden aan argument-hash (TOCTOU) | A-2, P-5 |
| 5 | Kritiek | **AVG-verwijderpad ontbreekt:** persoonsgegevens in ≥6 lagen, evidence plane is append-only "herschrijven verboden" — dat botst frontaal met Art. 17; nergens één concrete bewaartermijn | P-1 |
| 6 | Kritiek | **Art. 9-data als routingprobleem behandeld:** loonstroken/verzuim lokaal draaien lost grondslag/DPIA/doelbinding niet op; mogelijk AI Act Annex III | P-2 |
| 7 | Hoog | **Runtime-topologie onbeslist en spike te smal:** waar draaien engine/Kernel/Gateway (NUC? Hetzner?); DBOS-recovery over 3 machines, checkpoint-latency over Tailscale/WAN, GPU-queue-capability — geen van alle in de spike-criteria; 1–2 dagen is te kort | A-3 |
| 8 | Hoog | **Thuissite = SPOF voor control én execution:** bij thuisuitval blijft alleen de data-plane over; monitoring moet vanaf Hetzner; U6-claim "RPO 15 min zonder kosten" klopt niet bij nightly pulls | A-6, O-9 |
| 9 | Hoog | **Telegram is een ongedocumenteerde subverwerker en datalek-kanaal:** dagbrief (omzet, bezetting) en approvals gaan als inhoud het pand uit; "data verlaat het pand niet" is dan onwaar | P-3 |
| 10 | Hoog | **Langfuse-traces ondergraven pii-strict:** prompts/completions van lokale routes gaan alsnog naar Langfuse Cloud; L1 (DPA/retentie) wordt als afgehandeld gepresenteerd maar is open | P-4 |
| 11 | Hoog | **Scope-verdrievoudiging Golf 2–3 door docs 10–14:** elk doc zegt "geen scope-explosie", samen zíjn ze het; de eigen regel "max één architectuurwijziging per week" wordt geschonden | O-3, B-7 |
| 12 | Hoog | **Nachtploeg-ochtendrekening niet gebudgetteerd:** 45–90 min review/dag realistisch, 1–3 u bij een kapotte increment; nachtploeg-v1 in Golf 2 schendt bovendien de eigen 30-dagen-regel | O-5 |
| 13 | Hoog | **Approval-governance:** wie mág goedkeuren per risicoklasse is niet gekoppeld aan rollen; geen identiteitsbinding Telegram↔user; geen plaatsvervangersregeling (vakantie = alles stokt of regels verwateren) | P-5, O-4 |
| 14 | Middel | **State machines happy-path:** geen cancelled/failed/blocked/expired, geen user-abort-compensatie, geen resource-leases; parallelle vloot (U1) botst met one-increment-per-session op één checklist | A-5 |
| 15 | Middel | **30-dagen-gates op de verkeerde plek:** als blokkade op *starten* van nieuw A1-werk doden ze momentum; ze horen op *autonomie-promotie* | B-3 |
| 16 | Middel | **EUR-prioritering ontbreekt:** top-5-kansen ≈ €650–1.700/mnd waarde, maar de rangorde is tech-geleid; nachtploeg/sandbox-vloot hebben geen businesscase | B-4 |
| 17 | Middel | **Papieren waarborgen:** "security review" zonder proces (zelfcertificering), geen audit-pad voor eigenaar-ingrepen (SSH/SQL/kill-switch), Art. 50-gate aangekondigd maar niet in §25 opgenomen, Art. 4-geletterdheid helpers ontbreekt | P-6, P-7 |
| 18 | Middel | **Named-routes-regel al gebroken:** ±14 routes over docs 11–13 waar §24 max 8 zegt | O-8 |
| 19 | Middel | **Legacy-opruiming onderschat:** vijf generaties experimenten; "inventariseren" is weken werk — bevriezen en verwijderen is de enige haalbare route | O-7 |
| 20 | Middel | **Productfabriek (Golf 4) mist het halve huiswerk:** saleskanaal, support, SLA vanaf thuisinfra, aansprakelijkheid, verwerkersovereenkomsten, AI Act-plichten van klanten | B-5, A-8 |

## 41.3 Bindende amendementen (wat er verandert)

### AM-1 — De minimale variant is het plan (vervangt de omvang van doc 07 §28 en doc 09 §35)

- **Production Core ≤8 componenten:** Postgres, Qdrant, LiteLLM (8 routes max, `local.*` als provider-tier bínnen routes), Langfuse (EU-regio + DPA als voorwaarde), canonieke engine, Motor-app, OpenClaw (na hardening), Tailscale. Al het andere: Incubation of lager.
- **5 actieve meetcriteria** (in plaats van 17): #1 task-success, #2 correcties, #3 ongeautoriseerde acties (automatisch), #7 kosten/succesvolle taak (automatisch), #16 operatorvertrouwen. De overige 12 worden observaties zonder gate-status tot er ≥3 Playbooks in productie draaien.
- **Bevroren tot ná 30 dagen groen van Playbook #1:** nachtploeg (behalve ingest-batch), sandbox-vloot, staging-stack (restore-test naar wegwerp-container volstaat), ComfyUI, e-mail/agenda, CRM-tabellen, TTS, MinerU, reranker, Chinese routes, Playbook-*registry* (git-map + statuskolom volstaat), doc-freshness-CI, adversarial-review-stap.
- **Documentbevriezing:** geen doc 16+ en geen PROMPT-2.5 tot 3 Playbooks in productie draaien. Nieuwe inzichten → kort delta-memo in dít document.

### AM-2 — Waarde eerst: herziene startvolgorde (vervangt doc 08 §33-volgorde)

1. **Week 1:** Golf 0 ongewijzigd (auth dicht, OpenClaw-hardening, secrets) — blijft terecht eerst.
2. **Week 1–2:** **K2 review-automation live** op bestaande n8n + Telegram-approvals, bewust wegwerp; migreert later onder de Kernel.
3. **Week 2–4:** **K1 bonnetjes→Moneybird v1** (cloud-vision, elke boeking handmatig approven).
4. **Week 3–5 parallel (max 1 dag/wk):** ADR-108/109 (hieronder) + engine-spike (verbreed, 3–5 dgn/kandidaat) + Kernel-tabellen.
5. **Week 5–7:** C1 ComfyUI voor Fumero (eerste directe omzetondersteuning van de 3090).
6. **Week 6–9:** K1+K2 migreren naar Kernel/Gateway — **de migratie zelf is de architectuurtest** (vervangt de brief in die rol).
7. **Week 9–12:** dagbrief als Playbook #3, gevoed door de inmiddels bestaande adapters.
8. **Gate-regel herzien (B-3):** 30 dagen groen is vereist voor **autonomie-promotie** (A1→A2→A3), niet voor het starten van nieuw A1-werk.

### AM-3 — Twee nieuwe ADR's vóór Golf 1-bouw (A-1, A-2, A-3)

- **ADR-108 — Runtime-topologie:** engine + Kernel-API + Action Gateway draaien **op Hetzner, co-located met Postgres** (thuisuitval raakt dan alleen lokale inference en kanalen; checkpoint-latency verdwijnt). NUC = kanalen/UI/OpenClaw + local-executor-glue. Monitoring (Uptime Kuma/Beszel-hub) draait op Hetzner en bewaakt de thuissite, niet andersom. De spike-criteria worden uitgebreid met: multi-node-recovery, event-vóór-wait-race, checkpoint-latency over Tailscale, GPU-concurrency-limits, in-flight-versioning bij deploy, en de engine-store als apart backup-object (Inngest-geval).
- **ADR-109 — Gateway-enforcementmodel:** expliciet **credential-broker/proxy-model** (side-effect-credentials leven alléén bij de Gateway); **fail-closed voor R1+**, fail-open alleen voor R0-reads; budget als **reservering→uitvoering→settlement** in één PG-transactie; approval-records binden aan **(tool, argument-hash, task_id, vervaltijd)** en de Gateway hertoetst de hash bij uitvoering; idempotency-key per toolcall. Gateway v1 dekt alléén mail/pay/delete via engine-workflows; OpenClaw-omleiding volgt in Golf 3.
- Aanvullend (A-1): `tasks` muteert uitsluitend via engine-emitted events (append-only, idempotent op event-id) + periodieke reconciliation-job (run zonder task / task zonder run → alarm); dit wordt een NIG-3-bewijstest. State machines krijgen cancelled/failed/blocked/expired + resource-leases (A-5).

### AM-4 — Compliance-pakket als Golf 1-deliverable (P-1 t/m P-9)

1. **Verwerkingsregister (Art. 30)** + subverwerkerslijst met DPA-status (Langfuse EU-regio, modelproviders, Hetzner, EU-inference) — inclusief het expliciete **Telegram-besluit**.
2. **Dataklassificatieschema** (publiek/intern/persoonsgegeven/bijzonder) als bijlage bij §22; per klasse: toegestane routes, tracing-beleid, masking-verplichting. De dagbrief krijgt een maskingstap vóór elke cloud-route (personeelsbezetting!).
3. **Tracing-beleid per dataklasse:** pii-strict → géén content in traces, alleen metadata/kosten.
4. **Telegram-dataminimalisatie:** notificatie + link naar Motor UI in plaats van inhoud, voor brief én approvals.
5. **Bewaartermijnen per categorie in de SoT-matrix** + ontworpen en getest verwijder-/anonimiseerpad over álle stores (crypto-shredding of pseudonimisering vóór evidence-opslag) — geteste delete-run is exit-criterium.
6. **Approval-matrix:** rol × risicoklasse, identiteitsbinding Telegram-ID ↔ user-record, afwezigheidsregeling ("vakantiestand": alles terug naar A1/pauze + extern technisch contact met geoefende restore, 2 u/mnd retainer — O-4).
7. **Audit-pad voor eigenaar-ingrepen:** verplicht "operator-ingreep"-event (met reden) bij SSH/direct SQL/kill-switch; policy-wijzigingen via PR met cool-down.
8. **AI Act:** Art. 50-disclosure als gate-regel 7 in §25 (was aangekondigd, nu vastgelegd); kort Art. 4-geletterdheidsprogramma voor de helpers; AI-Act-kolom in de traceability-matrix.
9. **U4 (pii-strict personeels-/gezondheidsdata) verschuift naar "na DPIA"** — uit Golf 3–4, geen Playbooks op Art. 9-data zonder DPIA en grondslag-analyse.

### AM-5 — Kleinere correcties

- U6-claim gecorrigeerd: nightly pulls = RPO 24 u; RPO 15 min vereist WAL-shipping (aparte beslissing, niet "gratis").
- §38.3b-claim "lost het 16 GB-knelpunt structureel op" afgezwakt: de echte winst is Dify (4–6 GB); de rest is vermeden groei.
- Legacy (omega/holding/evomap/factory-os/singularity): **bevriezen → 30 dagen → verwijderen**; geen inventarisatie-project, geen migratie van inhoud.
- Nachtploeg (wanneer ontdooid): start met exact 1 increment/nacht; hard criterium "gemiddelde ochtendreview ≤20 min over 14 dagen, anders terug naar ingest-only".
- EUR-prioriteringsblad (B-4): één A4 met waarde/mnd, bouwuren en payback per kans; onderhoudslijst bij dit document; alles zonder payback <6 mnd → Watchlist.
- Golf 4 geherformuleerd: eerst **één betalende pilotklant uit eigen netwerk, hands-on, zonder SLA-belofte**; productstrategie pas daarna; klantgerichte productie draait niet vanaf de thuissite.

## 41.4 Wat expliciet overeind blijft (door alle reviewers bevestigd)

Golf 0 security-eerst · de adoptieladder en No-Invention Gates · nul zelfbouw op sport 5 · PG als SSOT + RLS · LiteLLM/Langfuse/Qdrant-keuzes · de autonomieladder met bewijsperiodes · PII-lokaal-eerst als richting (mits AM-4 het toetsbaar maakt) · de Bokas-brief als Playbook (alleen niet als #1) · de 3090-rolverdeling (doc 12) · de hype-/Rejected-lijsten.

## 41.5 Eindstand

Met AM-1 t/m AM-5 verwerkt beoordeelt het panel het plan als uitvoerbaar: SRE 7/10, architectuur ~8/10 (na ADR-108/109), business "omgedraaid en daarmee gezond", privacy "voorwaardelijk akkoord — geen klant-/personeelsdata vóór AM-4-punten 1–5 staan". De rode draad van alle vier: **minder tegelijk, waarde eerst, en de twee kernontwerpen (topologie + Gateway-enforcement) expliciet beslissen vóór er gebouwd wordt.**
