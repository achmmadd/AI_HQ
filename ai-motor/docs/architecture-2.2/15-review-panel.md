# 41. Review-panel — vier onafhankelijke inspecties + consolidatie-besluiten

> **Eigenaar:** Pietje · **Datum:** 2026-07-23 · **Conflictregister:** 2026-07-27 · **Laatste delta:** 2026-07-31.
> Aanvulling op [Motor AI 2.2](README.md).
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
5. **Week 5–7, alleen na 30 dagen groen van Playbook #1:** C1 ComfyUI voor Fumero; anders schuift dit venster op.
6. **Week 6–9:** K1+K2 migreren naar Kernel/Gateway — **de migratie zelf is de architectuurtest** (vervangt de brief in die rol).
7. **Week 9–12:** dagbrief als Playbook #3, gevoed door de inmiddels bestaande adapters.
8. **Gate-regel herzien (B-3):** 30 dagen groen is vereist voor **autonomie-promotie** (A1→A2→A3), niet voor het starten van nieuw A1-werk.

### AM-3 — Twee nieuwe ADR's vóór Golf 1-bouw (A-1, A-2, A-3)

- **ADR-108 — Runtime-topologie** en **ADR-109 — Gateway-enforcementmodel:** de canonieke tekst staat in [`../DECISIONS.md`](../DECISIONS.md). Daar zijn ook de negen ADR-101-spikegates, runtimeplaatsing, credential-broker, failgedrag, budgettransactie, hash-binding en v1-scope vastgelegd.
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

## 41.6 Conflictregister doc 01–14 versus AM-1 t/m AM-5

> **Status:** geregistreerd op 2026-07-27; doc 15 is de bindende kolom “wat geldt nu”.
> **Interpretatieregel:** AM-1 bepaalt de harde scope-gates; AM-2 bepaalt de vroegst mogelijke volgorde. Daardoor mag ComfyUI alleen in het venster week 5–7 starten als Playbook #1 dan al dertig dagen groen is; anders schuift het op. K2 en K1 starten bewust op de bestaande stack zonder de door AM-1 bevroren registry, MinerU of reranker.

| AM | Waar staat het | Wat gold in doc 01–14 | Wat geldt nu | Welk document moet wijzigen |
|---|---|---|---|---|
| AM-1 | Doc 07 §28; doc 12 §38.1 | 12 losse Production Core-componenten en de inference-PC als Core-kandidaat | Exact maximaal 8: Postgres, Qdrant, LiteLLM, Langfuse, canonieke engine, Motor-app, gehard OpenClaw en Tailscale | 07, 12 |
| AM-1 | Doc 07 §28 | Drizzle/RLS, Redis, object storage, Telegram, Cloudflare Tunnel en Ollama tellen afzonderlijk als Core | Drizzle/RLS valt onder Postgres; alle overige genoemde onderdelen zijn Incubation of lager | 07 |
| AM-1 | Doc 06 §25–27; doc 09 §35; doc 13 §39.3 | Zeventien criteria en extra GPU-subcriteria functioneren als releasegate | Alleen #1, #2, #3, #7 en #16 zijn actief; de overige twaalf zijn observaties tot minstens drie Playbooks productie draaien | 06, 09, 13 |
| AM-1 | Doc 03 PC-01; doc 05 §17; doc 13 U1/U5 | Sandbox per taak, een parallelle sandbox-vloot en een vaste staging-stack staan in de eerstvolgende golven | Sandbox-vloot en staging-stack zijn bevroren; alleen een restore-test naar een wegwerp-container is toegestaan | 03, 05, 13 |
| AM-1/2 | Doc 14 C1; doc 15 AM-2 punt 5 | ComfyUI staat in Golf 3, respectievelijk in week 5–7 | Week 5–7 is alleen het vroegste venster; start pas na dertig dagen groen van Playbook #1 | 14; verduidelijking staat in dit register |
| AM-1 | Doc 14 §40.2/40.3/40.5 | E-mail, agenda, CRM-tabellen en TTS worden in Golf 3–4 gebouwd | Alle vier zijn bevroren tot Playbook #1 dertig dagen groen is | 14 |
| AM-1 | Doc 10 O5/O9; doc 11 A1–A3; doc 12 §38.2–38.5 | MinerU, reranker, transcriptie-uitbreiding en Chinese/`local.*` routes worden in Golf 2–3 geactiveerd | MinerU, reranker en Chinese routes zijn bevroren; lokale providerkeuze gebeurt als tier binnen maximaal acht routes | 10, 11, 12 |
| AM-1 | Doc 04 NIG-2; doc 07 ADR-103; doc 08 Golf 2/week 9 | Een PG Playbook-registry met versie/promotie/eval-gates wordt vroeg gebouwd | Registry-product is bevroren; een git-map met statuskolom volstaat | 04, 07, 08 |
| AM-1 | Doc 04 §11; doc 05 §17; doc 08 week 5; doc 09 §34–35 | Doc-freshness-CI en adversarial review zijn vroege merge-/releasegates | Beide stappen zijn bevroren; handmatige document- en menselijke review volstaan voorlopig | 04, 05, 08, 09 |
| AM-1 | README-uitbreidingspad; PROMPT-2.4 slot | Nieuwe genummerde architectuurdocs en PROMPT-2.5 volgen uit volgende scans | Geen doc 16+ en geen PROMPT-2.5 tot drie Playbooks productie draaien; alleen een kort delta-memo in doc 15 | README, PROMPT-2.4 |
| AM-2 | Doc 08 §31–33 | Eerst volledige engine/Kernel/Gateway-fundering, daarna de Bokas-brief als eerste pilot | Golf 0 → K2 week 1–2 → K1 week 2–4 → beperkte architectuurspike → migratie K1/K2 → dagbrief #3 | 08 |
| AM-2 | Doc 10 §36.2/36.5; doc 11 §37.5 | K1 en K2 komen in Golf 3 en K1 gaat vóór K2 | K2 reviews is Playbook #1 in week 1–2; K1 bonnetjes is #2 in week 2–4 | 10, 11 |
| AM-2 | Doc 07 ADR-101; doc 08 week 2; PROMPT-2.3 | Engine-spikes duren één à twee dagen en krijgen een volle architectuurweek | N=1-uitwerking in ADR-101: Inngest max. 3 architectuurdagen in week 3–5; DBOS alleen na harde trigger 3–5 dagen, waarna downstream schuift | 07, 08, PROMPT-2.3 |
| AM-2 | Doc 08 §32; doc 07 §29; doc 10 §36.5 | De Bokas-brief is de eerste en enige architectuurtest | Migratie van K1 en K2 naar Kernel/Gateway in week 6–9 is de architectuurtest | 07, 08, 10 |
| AM-2 | Doc 08 §32–33; doc 10/11 pilotplaatsing | De dagbrief is Playbook #1 en gaat rond week 10 live | De dagbrief is Playbook #3 in week 9–12, gevoed door bestaande adapters | 08, 10, 11 |
| AM-2 | Doc 08 §32; doc 13 §39.1; doc 09 §34 | Dertig dagen groen blokkeert het starten van de volgende workflow/divisie | Dertig dagen groen is vereist voor autonomiepromotie; nieuw A1-werk mag starten. AM-1-scope blijft wel bevroren tot #1 dertig dagen groen is | 08, 09, 13 |
| AM-3 | Doc 05 §14; doc 07 ADR-104; doc 12 §38/roltabel; doc 13 intro | Fysieke architectuur blijft NUC+Hetzner; Kernel-API staat op de NUC of in Motor Next.js | Owner-target plaatst Engine, Kernel-API en Action Gateway op Hetzner naast Postgres; NUC is beoogd voor kanaal/UI/OpenClaw/glue; runtime pending revalidatie | 05, 07, 12, 13 |
| AM-3 | Doc 10 O3; doc 12 §38.4; doc 14 §40.4 | Monitoringlocatie is niet vastgelegd of lijkt lokaal op de worker | Owner-target plaatst de Uptime Kuma/Beszel-hub op Hetzner voor bewaking van NUC en inference-PC; runtime pending revalidatie | 10, 12, 14 |
| AM-3 | Doc 04 NIG-3; doc 05 §16; doc 08 Golf 1 | `tasks` en engine-run-state zijn beide waarheid zonder mutatiepad | `tasks` is een projectie en muteert alleen door idempotente engine-events; reconciliation alarmeert op run zonder task of task zonder run | 04, 05, 08 |
| AM-3 | Doc 05 §17–18; doc 13 U1; doc 14 GPU-queue | Lifecycle kent vooral het happy path en concurrency heeft alleen een limiet | Voeg `cancelled`, `failed`, `blocked`, `expired`, compensatie en resource-leases toe | 05, 13, 14 |
| AM-3 | Doc 03 PC-08/09; doc 04 NIG-1; doc 05 §22; doc 07 ADR-102 | Gateway is hoofdzakelijk een HTTP-adviescheck; harness voert zelf uit | Gateway is credential-broker/proxy; R1+ fail-closed, R0-read alleen fail-open; credentials leven uitsluitend bij Gateway | 03, 04, 05, 07 |
| AM-3 | Doc 05 §22/24; doc 08 Gateway-v1 | Budget is een losse check; approval bindt niet aan arguments; geen toolcall-idempotency | PG-transactie reservering→uitvoering→settlement; approval bindt tool+argument-hash+task+vervaltijd; idempotency-key per call | 05, 08 |
| AM-3 | Doc 03 PC-12; doc 05 §22; doc 08 Golf 1 | Gateway-v1 omvat mail/pay/delete/deploy en OpenClaw-omleiding | V1 omvat alleen mail/pay/delete via engine-workflows; deploy en OpenClaw-omleiding volgen later, OpenClaw in Golf 3 | 03, 05, 08 |
| AM-3 | Doc 02 engine-fit; doc 07 ADR-101; doc 08 engine-spike | Spike test vooral Next.js-integratie, HITL, crash en RAM | Test de echte drie-node-topologie: multi-node-recovery, race event-vóór-wait, Tailscale-latency, GPU-concurrency, deploy-versioning en engine-store-backup | 02, 07, 08 |
| AM-4 | Doc 01–09 | Compliance is verspreid over losse DPA-, audit- en delete-verwijzingen | Golf 1 levert Art. 30-register, subverwerkers/DPA-status, Telegram-besluit, dataklassen, tracingbeleid en geteste delete-run | 01, 05, 06, 07, 08, 09 |
| AM-4 | Doc 06 §26; doc 07 §28; doc 08 Golf 1 | Langfuse traceert prompts/completions op alle paden zodra DPA/retentie is geregeld | Langfuse moet EU+DPA hebben; `pii-strict` bevat alleen metadata/kosten, nooit content | 06, 07, 08 |
| AM-4 | Doc 03 PC-09; doc 05 §16/22; doc 08 §32; doc 10/11/13/14 | Brief, approvalcontext, historie en ochtendrapport gaan inhoudelijk via Telegram | Telegram bevat alleen notificatie en deeplink; volledige inhoud en approvalactie staan in Motor UI | 03, 05, 08, 10, 11, 13, 14 |
| AM-4 | Doc 05 §15–16; doc 06 §26–27; doc 07 §28 | Evidence/audit is append-only; retentie en verwijderen zijn open tekst | Per dataklasse concrete bewaartermijn en een geteste delete-/anonimiseerrun over alle stores | 05, 06, 07, 08 |
| AM-4 | Doc 04 approval-emitter; doc 05 §22–23 | Risico- en autonomieniveaus bepalen wanneer approval nodig is, niet wie mag goedkeuren | Rol×risicoklasse-matrix, Telegram-ID↔user-binding en vakantiestand zijn verplicht | 04, 05 |
| AM-4 | Doc 05–07; doc 10 §36.3 | Operatoringrepen ontbreken; Art. 50 is aangekondigd maar niet als gate vastgelegd | `operator_ingreep`-event voor SSH/SQL/kill-switch; policy via PR+cool-down; Art. 50 is gate 7 en helpers krijgen Art. 4-training | 05, 06, 07, 10 |
| AM-4 | Doc 08 §32; doc 12 §38.3; doc 13 U4; doc 14 CRM | Personeels-/gezondheidsdata wordt vooral als lokaal routingprobleem behandeld | Geen Art. 9-Playbook zonder DPIA en grondslaganalyse; U4 verdwijnt uit Golf 3–4 | 08, 12, 13, 14 |
| AM-5 | Doc 06 §27; doc 09 criterium #6; doc 13 U6/§39.3 | Nightly pull kan RPO 15 minuten gratis halen | Nightly is RPO 24 uur; 15 minuten vereist apart besloten WAL-shipping | 06, 09, 13 |
| AM-5 | Doc 12 §38.3b; doc 13 RAM-conclusie | De 3090-verplaatsing lost het 16GB-knelpunt structureel op | Hoofdwinst is Dify-decommissioning van circa 4–6GB; de rest vermijdt groei | 12, 13 |
| AM-5 | Doc 05 §20; doc 07 §28; doc 08 Golf 1 | Legacy wordt geïnventariseerd of inhoudelijk gemigreerd | Omega/holding/evomap/factory-os/singularity: bevriezen, dertig dagen wachten, verwijderen; geen inventarisatieproject | 05, 07, 08 |
| AM-1/5 | Doc 12 §38.5; doc 13 U2/§39.3 | Nachtploeg start in Golf 2 met meerdere taken/increments en Telegramrapport | Bevroren behalve ingest-batch; na ontdooiing exact één increment/nacht en gemiddeld ≤20 minuten ochtendreview over 14 dagen | 12, 13 |
| AM-5 | Doc 08 Golf 4; doc 10 §36.4; doc 13 niveau 4 | Productfabriek/tenant-shared aanbod volgt direct na interne pilot | Eerst één betalende pilotklant uit eigen netwerk, hands-on, zonder SLA; klantproductie niet vanaf thuissite | 08, 10, 13 |
| AM-5 | Doc 10 kansentabel/§36.5 | Waarde is genoemd maar niet uniform geprioriteerd op payback | Eén A4 met waarde/mnd, bouwuren en payback; zonder payback <6 maanden naar Watchlist | 10, onderhoud in 15 |
| AM-1 | Doc 03 PC-13/16; doc 05 §24; doc 11 A3; doc 12 §38.2; doc 13 U3 | Docs noemen samen circa veertien routes, waaronder `local.*`, `judge.local`, `rerank`, `transcribe`, `extract.cheap` | Maximaal acht: `chat.fast`, `chat.deep`, `code.strong`, `extract`, `embed`, `judge`, `research.search`, `agent.orchestrate`; `local` is een provider-tier, rerank/transcribe zijn services | 03, 05, 11, 12, 13, 14 |
| Panelconclusie | Doc 01 §1/P20; doc 07 ADR-105; doc 08 parallelregel; PROMPT-2.3/2.4 | Plan rekent met een technisch team van 3–4 mensen | Uitvoering is voor 1 technicus met 2–3 niet-technische helpers; minimale variant en maximaal één architectuurdag/week | 01, 07, 08, PROMPT-2.3, PROMPT-2.4 |

**Afhandelregel voor stap 3:** de genoemde documenten worden inhoudelijk aangepast; er komen geen permanente override-banners. Na consolidatie blijft dit register de audit trail, niet een tweede set geldende instructies.

## 41.7 Delta-memo 2026-07-27 — hardware en naamgeving

**Eigenaar:** Pietje. In het owner-target is de NUC in dagelijkse taal de “orchestrator” omdat Motor UI, OpenClaw, kanalen en executor-glue daar zijn beoogd. Dit wijzigt AM-3 niet: **durable orchestratie, Kernel-API en Action Gateway horen volgens het owner-target op Hetzner**; geen van deze plaatsingen is runtimebewijs vóór revalidatie. De nieuwe Ryzen 7/32 GB/RTX 3090-PC is uitsluitend beoogd als stateless lokale LLM-worker. Locatie, voeding en opslag mogen voorlopig onbekend blijven; vóór activering zijn SSH, Tailscale, runbook en Gateway/policy verplicht. Tot die tijd krijgt de PC geen taken.

## 41.8 EUR-prioriteringsblad — onderhoud

| Kans | Waarde/mnd | Bouwuren | Payback | Besluit | Laatst gemeten |
|---|---:|---:|---:|---|---|
| K2 reviews | Door eigenaar in te vullen vóór start | Door eigenaar in te vullen | Bouwkosten ÷ waarde/mnd | AM-2 #1; geen uitbreiding zonder cijfers | open |
| K1 bonnetjes | Door eigenaar in te vullen vóór start | Door eigenaar in te vullen | Bouwkosten ÷ waarde/mnd | AM-2 #2; v1 handmatig | open |
| K3 monitoring | Onbekend | Onbekend | Niet bewezen | Watchlist | open |
| K4 forecast | Onbekend | Onbekend | Niet bewezen | Watchlist | open |
| K5 infra-digest | Onbekend | Onbekend | Niet bewezen | Watchlist | open |

**Regel:** zonder aantoonbare payback korter dan zes maanden blijft een kans Watchlist. Doc 10 bevat de marktcontext; dit is de onderhoudstabel en beslisbron.

## 41.9 Verbeteringen aan de consolidatie-opdracht

> **Opsteller:** architectuurreview · **Datum:** 2026-07-27 · **Beslisser:** eigenaar

1. **Maak root-`AGENTS.md` expliciet een uitzondering op de paden-whitelist.** De absolute regel stond alleen `ai-motor/docs/` en `DECISIONS.md` toe, terwijl stap 4 root-`AGENTS.md` verplichtte.
2. **Lever voor nog geldige metingen read-only hosttoegang of vooraf opgenomen output mee.** Zonder SSH-config/agent konden `pm2 list`, `docker ps`, `systemctl` en productieflags alleen als onbekend worden vastgelegd. Legacy SQLite↔PG-rijpariteit is door de defecte, permanent uitgesloten SSD en geannuleerde M2/M3 definitief vervallen en mag niet opnieuw worden gemeten, hersteld of afgeleid.
3. **Scheid “documentatie final” van “runtime build-ready”.** Het entrypoint kan compleet zijn terwijl OpenClaw-hardening, ADR-002 M4 en live services nog niet bewezen zijn.
4. **Los amendementconflicten in de opdracht zelf op.** AM-1 bevroor ComfyUI terwijl AM-2 week 5–7 noemde; “3–5 dagen per kandidaat” botste met maximaal één architectuurdag per week. Geef vooraf aan welke regel de gate en welke alleen het vroegste venster is.
5. **Geef ieder stapdeliverable een pad en benoem de beslis-hiërarchie.** Stap 2 had geen doelbestand en “doc 15 bindend” versus “DECISIONS één waarheid” vereiste interpretatie; leg vast dat doc 15 scope/amendementen bevat en `DECISIONS.md` canonieke ADR-tekst.

De eigenaar bepaalt welke verbeteringen in een volgende opdrachtversie landen; er wordt tijdens AM-1 geen nieuwe promptversie aangemaakt.

## 41.10 Delta-memo 2026-07-31 — off-host backupbesluit (voorstel, niet besloten)

> **Eigenaar/beslisser:** Pietje · **Status:** voorstel ter eigenaarbeslissing · **Bronnen geverifieerd:** 2026-07-31
> Dit memo autoriseert geen account, bucket, credential, dump, snapshot, restore, delete of live toegang. Alle actuele PG-/Qdrant-gates en command-specifieke goedkeuringen uit ADR-002 blijven onverkort van kracht.

### Harde randvoorwaarden

- Permanent buiten productie-Hetzner en buiten de stateless inference-PC; de 2 TB-workeropslag telt alleen als tijdelijke scratch.
- Client-side versleuteld vóór upload; de productiehost bezit uitsluitend publieke encryptierecipients en een write-only/append-only uploadidentity zonder read, delete, admin, retention-wijziging of bypass. Hij kan niet ontsleutelen.
- PostgreSQL en Qdrant houden onafhankelijke SLO's: PG RPO ≤24 u/RTO ≤4 u; Qdrant RPO ≤24 u/RTO ≤8 u.
- Een checksum of succesvolle upload is geen recoverybewijs: alleen een lege, geïsoleerde scratch-restore sluit een gate.
- Doel is een **3-2-1-1-0-geïnspireerd failure-domainmodel**: productie plus twee provider-onafhankelijke kopieën, off-site, immutable en nul geaccepteerde restorefouten. Dit is bewust nog geen letterlijke “twee mediatypen”-implementatie; zonder aparte offline/andere-mediumkopie mag het niet als volledige 3-2-1-conformiteit worden geclaimd.

### Providervergelijking

| Optie | Residentie en scheiding | Immutability | Publieke prijs op verificatiedatum | Oordeel |
|---|---|---|---|---|
| **Scaleway Object Storage Standard Multi-AZ** | Europese provider; publieke productinformatie noemt Parijs, Amsterdam en Warschau en Multi-AZ-opslag over drie availability zones; exacte Multi-AZ-beschikbaarheid in de gekozen regio blijft onderdeel van BKP-D1-verificatie | S3 Object Lock **COMPLIANCE**: vóór afloop niet door owner/admin te verwijderen of te verkorten | €0,01606/GB-maand excl. btw; 75 GB egress/maand gratis, daarna €0,01/GB | **Aanbevolen primaire bestemming**: sterke EU-scheiding en echte WORM; `fr-par` voorlopig, definitieve regio en productbeschikbaarheid pas na revalidatie. [Prijs](https://www.scaleway.com/en/pricing/storage/) · [Object Storage](https://www.scaleway.com/en/object-storage/) · [Object Lock](https://www.scaleway.com/en/docs/object-storage/how-to/use-object-lock/) · [security/compliance](https://www.scaleway.com/en/security-and-compliance/) |
| **Backblaze B2 EU Central** | Amerikaanse provider met EU Central in Amsterdam; gekozen regio blijft volgens de provider leidend; DPA/SCC beschikbaar | Governance én **COMPLIANCE** Object Lock; compliance-retentie kan niet worden verwijderd of verkort | $6,95/TB-maand; eerste 10 GB gratis; egress tot 3× gemiddelde maandopslag gratis, daarna $0,01/GB | **Aanbevolen tweede provider**: goedkope providerdiversiteit en sterke WORM; vanwege Amerikaanse provider eerst DPA en zo nodig transfer-impactanalyse. [Prijs](https://www.backblaze.com/cloud-storage/pricing) · [regio's](https://www.backblaze.com/docs/cloud-storage-data-regions) · [Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock) · [DPA EU/EEA](https://www.backblaze.com/company/policy/dpa-for-eea-eu-residents) |
| **Cloudflare R2 EU jurisdiction** | Amerikaanse provider; EU-jurisdiction bucket houdt objecten in de EU; DPA/SCC-mechanismen beschikbaar | Bucket Locks blokkeren writes/deletes, maar een config-admin kan de lockregel verwijderen; geen gelijkwaardige Compliance-WORM tegen accountcompromis | $0,015/GB-maand; eerste 10 GB gratis; egress gratis | Goed als latere restore-/mirrorlaag, **niet als enige immutable backup**. [Prijs](https://developers.cloudflare.com/r2/pricing/) · [data location](https://developers.cloudflare.com/r2/reference/data-location/) · [Bucket Locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/) · [DPA/SCC](https://www.cloudflare.com/en-gb/cloudflare-customer-dpa/) |

Prijzen zijn geen budgetbelofte: kosten volgen het totale aantal **retained GB-maanden**, niet alleen de huidige brondata. Compliance-locked objecten kunnen bij een overschrijding niet voortijdig worden verwijderd; BKP-D1 vereist daarom vóór activatie een worst-case retained-GB-raming, maximale artifactgrootte en budgetalerts. Een kostenalarm stopt vereiste backups niet stilzwijgend en verlaagt het RPO alleen na een nieuw expliciet eigenaarbesluit. Het failure-domainmodel wijkt vooralsnog bewust af van de letterlijke twee-mediatypenregel in de [CISA-backupdefinitie](https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf).

### Aanbevolen v1-contract

| Kopie | Voorstel | Retentie / bewijs |
|---|---|---|
| 1 — productie | PostgreSQL en Qdrant op het gerapporteerde Hetzner-doel, tot revalidatie strikt no-touch | Geen backupstatus claimen |
| 2 — dagelijkse primary | Private Scaleway Multi-AZ-bucket, voorlopig `fr-par`, versioning + 35 dagen Compliance Object Lock | Dagelijks; waarschuwing bij ouderdom >20 u en harde page/blokkade bij >24 u; maandelijkse PG-scratchrestore |
| 3 — providerdiverse copy | Dagelijkse kopie van hetzelfde artifact naar B2 EU Central met 90 dagen Compliance Object Lock | Ook deze objectouderdom blijft ≤24 u; Qdrant maandelijks én extra voor/na iedere upgrade herstellen; PG ≤4 u en Qdrant ≤8 u blijven harde tests |

De artifactpipeline is geen verkorte route: alleen het volledige twaalf-gate herstelpad uit ADR-002 telt — BKP-IAM-SCRATCH; PG-INVENTORY → PG-DUMP → PG-OFFHOST naar beide provider-onafhankelijke bestemmingen → PG-RESTORE → PG-LOCAL-CLEANUP; QD-INVENTORY → QD-SNAPSHOT → QD-OFFHOST naar beide bestemmingen → QD-RESTORE → QD-LOCAL-CLEANUP; daarna SCRATCH-DELETE. Geen subset volstaat en QD-PIN blijft een latere afzonderlijke wijziging. De pipeline gebruikt zelfstandig herstelbare bestanden: PostgreSQL custom-format dump plus cluster-globals, rechtstreeks gestreamd naar client-encrypted `0600` staging zonder plaintext dump/globals at rest; Qdrant-snapshot plus aliases/configuratie en exact image-digest; en een versleuteld manifest met UTC-tijd, uniek `artifact_id`, bron- en ciphertext-SHA-256, grootte, tool-/storeversies (expliciet PostgreSQL, pgvector en overige vereiste extensies), migratie-head en artifactlijst. Datzelfde `artifact_id` loopt ongewijzigd van creatie via de twee remote objectversies/readbacks naar verse download, decryptie en scratchrestore. Alleen restore van het opnieuw via de read-only recoverycredential gedownloade off-host object telt; een achtergebleven lokale dump of snapshot is ongeldig bewijs. De recovery-identity moet de download werkelijk ontsleutelen en beide checksums moeten sluiten. Na geaccepteerde restore verwijderen PG-LOCAL-CLEANUP en QD-LOCAL-CLEANUP met elk een aparte command-specifieke Pietje-goedkeuring uitsluitend het exacte staging-artifact respectievelijk `snapshot_id`; geen glob of volume-/collectiedelete. Ook na een expliciet goedgekeurde abort blijven deze productie-lokale cleanupgates afzonderlijk oproepbaar. SCRATCH-DELETE verwijdert pas nadat **beide** restores én beide LOCAL-CLEANUP-gates zijn geaccepteerd, onder een eigen command-specifieke Pietje-goedkeuring, alleen de exact geïdentificeerde scratchomgevingen; bij een abort blijft scratch beperkt, geïdentificeerd en gealarmeerd tot beide herstelketens alsnog zijn geaccepteerd. PostgreSQL custom/directory-formaten ondersteunen selectieve en parallelle restore volgens de [PostgreSQL-documentatie](https://www.postgresql.org/docs/current/backup-dump.html). Een Qdrant-collectionsnapshot bevat geen aliases en een restore vraagt tijdelijke doelschijfruimte; versiecompatibiliteit en recovery-eisen volgen de [Qdrant snapshot-](https://qdrant.tech/documentation/operations/snapshots/) en [recoverydocumentatie](https://qdrant.tech/documentation/migration-recovery-options/).

Versleutel ieder artifact en manifest met [`age`](https://github.com/FiloSottile/age) naar minimaal twee publieke recipients: Pietjes primaire identity en een afzonderlijke recovery-identity. Upload met unieke write-once objectnamen en uitsluitend een create/append-identity; nooit `sync`. De afzonderlijke **BKP-IAM-SCRATCH**-gate moet na BKP-D1–D3 en met een eigen command-specifieke Pietje-goedkeuring bewijzen dat `rclone copy` zonder `GetObject`, delete, admin, retention-wijziging of bypass werkt; anders gebruikt de implementatie een provider-native single-object PUT in plaats van ruimere productierechten. De verse readback gebeurt vanuit scratch/operatorcontext met een **andere**, read-only recoverycredential; geen van beide identities bezit de private decryptiesleutel. Objectnamen zijn opaak. Provider-SSE is defense-in-depth, niet de gezaghebbende encryptielaag. `restic` blijft alleen kandidaat voor een aparte mutable filesystemrepository: onbewezen combineren met bucketbrede Compliance Lock kan `forget`/`prune` en repository-lockmutaties blokkeren ([restic repository](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html), [append-only/forget](https://restic.readthedocs.io/en/stable/060_forget.html)).

De private recovery-identities en read-only recoverycredentials staan niet op Hetzner, NUC of inference-PC. De owner-recoverykit bevat beide object-storelocaties, de afzonderlijke read-only restorecredentials, MFA-recoverycodes, gepinde tool-/imageversies, manifests en een offline runbook. Bewaar de kit in een beveiligde password manager én op een verzegelde offline drager; één bevoegde operator moet vanaf een lege machine kunnen herstellen zonder productie-toegang.

Immutability schort verwijder-/anonimiseringsplichten niet op. Het voorstel gebruikt daarom een minimale, gepseudonimiseerde **write-ahead tombstone-journal** als afzonderlijke recovery-SSOT buiten het primaire dataset: een delete/anonimiseeractie schrijft eerst een monotone sequence, vorige-record-hash, stabiele interne subjectreferentie, scope en ingangs-UTC naar een client-versleutelde append-only objectstroom bij beide providers. De live verwijdering mag pas uitvoeren nadat **beide** providers dezelfde journalrecord immutable hebben bevestigd; bij één ontbrekende ACK blijft de actie pending/fail-closed, krijgt de operator een alarm en wordt zij idempotent hervat binnen de in BKP-D2 expliciet vastgelegde en juridisch geverifieerde maximale afhandeltermijn. Het journal bevat geen namen, contactwaarden of businessinhoud, maar de pseudonieme referentie blijft een persoonsgegeven en valt dus onder Art. 30, DPA-, toegangs- en retentiebeleid. Het journal heeft een expliciete retentie van minstens de langste backupretentie plus één restorecyclus en een high-water mark in ieder backupmanifest. Verlies, een gat in de hashketen of ontbreken van journalrecords na die high-water mark laat herstel gesloten falen.

Een scratch-restore blijft netwerkgeïsoleerd en mag pas als herstelbewijs gelden nadat het journal via de recoverykit opnieuw is gelezen/ontsleuteld, alle records na de manifest-high-water mark zijn toegepast en negatieve queries aantonen dat betrokken pseudoniemen in PostgreSQL, Qdrant én evidence niet terugkeren. Data waarvoor dit niet betrouwbaar kan, hoort niet in de backup of vereist per-subject crypto-shredding. De maandelijkse oefening test dit replaypad expliciet; hiermee blijft AM-4's geteste delete-/anonimiseerpad onderdeel van recovery-acceptatie.

### Drie ownerbesluiten die live G0 blijven blokkeren

| ID | Pietje beslist | Benodigd vóór besluit |
|---|---|---|
| **BKP-D1 — providers en budget** | Scaleway primary + B2 secondary accepteren of alternatief kiezen; maandelijks budgetplafond vastleggen | Gecomprimeerde huidige omvang, maandgroei, productielocatie en verwachte retained GB-maanden |
| **BKP-D2 — retentie, rechtmatigheid en verwijdertermijn** | Dagelijks naar beide providers met 35 dagen Scaleway- en 90 dagen B2-retentie accepteren; maand-/jaararchief expliciet wel/niet toestaan; journalretentie, tombstone-replay of per-subject crypto-shredding én de maximale wettelijke/operationele afhandeltermijn voor een pending verwijdering vastleggen | Zakelijke bewaarbehoefte, dataklassen, delete-/anonimiseerbaarheid per store, pseudonimiseringsmethode, juridisch geverifieerde maximumtermijn, DPA's en eventuele B2-transfer-impactanalyse |
| **BKP-D3 — herstel en key-custody** | Recovery-identity uitsluitend verzegeld of bij een benoemde tweede custodian; password-manager/offline locatie en journal-recoverykey/-route aanwijzen | Beschikbare scratchcapaciteit en downloadsnelheid; journal-read/decrypt/replaybewijs; bevestigen of Qdrant unieke data bevat of volledig herbouwbaar is |

Zonder expliciete besluiten op BKP-D1 t/m D3 blijft BKP-IAM-SCRATCH geblokkeerd; zonder een groene, apart goedgekeurde IAM-gate blijven PG-DUMP, PG-OFFHOST, QD-SNAPSHOT en QD-OFFHOST geblokkeerd. Een providerkeuze alleen autoriseert nog steeds geen live actie.
