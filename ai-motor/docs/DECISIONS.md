# Motor AI Factory OS — Architectuurbeslissingen

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-31
> **Doel:** Vastliggende keuzes die Cursor/agents **niet opnieuw mogen uitvinden** in latere sprints.  
> **Gerelateerd:** [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md) · [`hetzner-migration.md`](hetzner-migration.md)

Wijzig een besluit alleen via expliciete PR + update van dit document (met datum en reden).

---

## ADR-001 — Qdrant: dual-search (geen unified collectie)

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** — geïmplementeerd Fase 0 Week 1 |
| **Datum** | 2026-06-06 |
| **Beslisser** | Pietje (vastgelegd vóór Fase 1) |

### Context

Drie inconsistente collectiepaden veroorzaakten lege kennisbank-zoekresultaten:

| Bron | Collectie |
|------|-----------|
| File-ingest | `factory_os_{klant}` |
| Scrape-pipeline | `{klant}_kennisbank` (bijv. `fumero_kennisbank`) |
| Legacy search | `factory_os` (hardcoded) |

Alternatief was **unified collectie**: scrape-content mergen naar `factory_os_{klant}` met payload `source: scrape|file`.

### Besluit

**Dual-search** — `searchKnowledge()` doorzoekt **beide** buckets per klant en merge resultaten op score.

Implementatie: `lib/qdrant-collection.ts` → `qdrantSearchCollectionsForScope()`, `lib/knowledge-service.ts`.

```
fumero → factory_os_fumero + fumero_kennisbank
bokas  → factory_os_bokas  + bokas_kennisbank
```

Geen merge-migratie van scrape-vectors in Fase 0 of Fase 1.

### Gevolgen

| Sprint | Wat wél | Wat níet |
|--------|---------|----------|
| **0.1** | Dual-search, health op beide collecties, migratiescript legacy → scoped buckets | Scrape → unified merge |
| **1.3** | Payload `workspace_id` + `source`; legacy `factory_os` bucket uit prod (migratiescript only) | Opnieuw debatteren unified vs dual |
| **Later (optioneel ADR-003)** | Unified collectie alleen als dual-search operationeel te duur blijkt | — |

### Env-vars (canonical)

| Variabele | Default | Rol |
|-----------|---------|-----|
| `QDRANT_COLLECTION_PREFIX` | `factory_os` | Ingest: `{prefix}_{klant}` |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | `fumero_kennisbank` | Scrape Fumero |
| `QDRANT_BOKAS_KENNISBANK_COLLECTION` | `bokas_kennisbank` | Scrape Bokas |
| `QDRANT_COLLECTION` | `factory_os` | Legacy — **uitfaseren** in Sprint 1.3 |

### Acceptatie

- Chat preamble vindt zowel file-ingest als scrape-data voor fumero/bokas.
- `GET /api/admin/integration-readiness` toont alle gemonitorde collecties.
- Geen hardcoded `factory_os` in UI-foutmeldingen (gebruik `collections` uit API).

---

## ADR-002 — SQLite → Postgres clean-start gate

| Veld | Waarde |
|------|--------|
| **Status** | ⚠️ **Besloten; clean start vastgesteld, M0 onbewezen, M1/M4/M5/M6 rood en M2/M3 geannuleerd** |
| **Datum** | 2026-06-06; laatst geamendeerd 2026-07-31 |
| **Beslisser** | Pietje |
| **Startpunt plan** | Fase 0 Week 1 = 2026-06-06 |

### Context

De repo opent via `better-sqlite3` nog steeds `$HOME/AI_HQ/data/ai-motor.db` read/write. Dat codepad blokkeert een schone productieruntime. PostgreSQL hoort op **Hetzner**; Motor Next.js blijft op de **NUC** met private connectiviteit.

### Besluit — milestones

| Milestone | Historische datum | Status / criterium |
|---|---|---|
| **M0 — Geen nieuwe SQLite-only tabellen** | 2026-06-20 | **Niet bewezen.** De toekomstige regel blijft: nieuwe schema's zijn PostgreSQL-ready; geen nieuwe SQLite-only tabellen vanaf acceptatie. |
| **M1 — PostgreSQL live op Hetzner** | 2026-06-28 | De PG-keten — BKP-IAM-SCRATCH plus PG-INVENTORY → PG-DUMP → PG-OFFHOST naar beide provider-onafhankelijke bestemmingen → PG-RESTORE → PG-LOCAL-CLEANUP — is alleen noodzakelijk subbewijs en nooit zelfstandig voldoende. M1 blijft rood tot het volledige twaalf-gate herstelpad inclusief de QD-keten en daarna SCRATCH-DELETE groen is, gevolgd door Tailscale-IP-bind, TLS met `sslmode=verify-full` en negatieve publieke/non-TLS-tests. |
| **M2 — Dual-write aan** | 2026-07-05 | **Geannuleerd, nooit gehaald.** Clean start gebruikt geen SQLite-dual-write. |
| **M3 — Legacy-SQLite migreren** | 2026-07-19 | **Geannuleerd, nooit gehaald.** Geen migratie, rijpariteit of `legacy_sqlite_id`-reconciliatie. |
| **M4 — PostgreSQL canonieke store** | 2026-07-26 | **Niet gehaald; toekomstige acceptatiegate.** Pietje kiest pas na het volledige twaalf-gate herstelpad — BKP-IAM-SCRATCH; PG-INVENTORY → PG-DUMP → PG-OFFHOST naar beide provider-onafhankelijke bestemmingen → PG-RESTORE → PG-LOCAL-CLEANUP; QD-INVENTORY → QD-SNAPSHOT → QD-OFFHOST naar beide bestemmingen → QD-RESTORE → QD-LOCAL-CLEANUP; daarna SCRATCH-DELETE — expliciet de bestemming van de gerapporteerde stores. Geen subset volstaat; QD-PIN blijft een latere afzonderlijke wijziging. De schone runtime leest en schrijft daarna PostgreSQL zonder productie-SQLite. |
| **M5 — RLS productie** | 2026-08-02 | Productieruntime gebruikt tenantgebonden least-privilege app-role/pool; RLS vertrouwt geen vrij instelbare tenant-GUC; same-tenant, 401, 403, directe SQL-, pool-reuse- en context-switchtests zijn groen. |
| **M6 — Geen productie-SQLite** | 2026-08-09 | **Voorwaarde vóór deployment:** geen `better-sqlite3`-import, -load, -open, -create, -read, -write of SQLite-fallback in productie. Bewijs: geen `.db`/`.db-wal`/`.db-shm` aangemaakt tijdens canary. |

De oude datums zijn historische, rode gates en geen bewijs van uitvoering. De nulmeting van 2026-07-29 blijft uitsluitend een historisch, door de eigenaar geaccepteerd rapport: de ruwe command evidence is niet onafhankelijk reproduceerbaar vanuit deze repository. Iedere runtimeclaim wordt read-only opnieuw gevalideerd voordat zij gate-evidence vormt of aan een live actie voorafgaat.

### Amendement 2026-07-30, aangescherpt 2026-07-31 — clean start en niet-forgeerbare M5-isolatie

De legacy-SSD is defect en permanent uitgesloten. Er volgt geen mount, read, copy, recovery, migratie, rijpariteit, `legacy_sqlite_id`-reconciliatie of SQLite-rollback. Dit is geen geslaagde recovery. De clean start geldt uitsluitend voor legacy SQLite.

De op Hetzner gerapporteerde PostgreSQL- en Qdrant-stores zijn strikt **no-touch**: niet verwijderen, resetten, overschrijven, leeg veronderstellen of stilzwijgend canoniek hergebruiken.

#### Vastgestelde volgorde — geen stap is voor uitvoering goedgekeurd

Deze documenten **authoriseren geen enkele live actie**. Zelfs read-only SSH of control-plane-export vereist aparte, command-specifieke Pietje-goedkeuring vóór uitvoering.

| Gate | Risico | Eigenaar | Doel / precondities | Goedkeuring | Evidence | Stop-gedrag |
|---|---|---|---|---|---|---|
| **BKP-IAM-SCRATCH** | R2 externe config/write/delete | Infra-operator | Na BKP-D1–D3: tijdelijke providerresources en gescheiden upload-/recoveryidentities bewijzen vóór enig productie-artifact | Pietje, command-specifiek | Create/append-only upload slaagt; read/delete/admin/retention/bypass falen; afzonderlijke read-only recovery slaagt; object-lock en cleanup/expiry bewezen | Stop; geen productiecredential/artifact; scratchcredential intrekken volgens apart goedgekeurd cleanupplan |
| **PG-INVENTORY** | R0 | Infra-operator | Read-only inventaris gerapporteerde PostgreSQL-store | Pietje, command-specifiek | Geredigeerd schema-, RLS- en versie-overzicht | Stop; store blijft no-touch |
| **PG-DUMP** | R2 productie-read/lokale write | Infra-operator | Na inventory en BKP-IAM-SCRATCH: consistente PG custom-format dump + globals zonder database-mutatie rechtstreeks naar client-encrypted `0600` staging streamen; geen plaintext dump/globals at rest | Pietje, opnieuw command-specifiek | `artifact_id`, bron- en ciphertext-SHA, staging-mode/owner, PG-/pgvector-/extensieversies, migratie-head en geredigeerd manifest | Stop; geen upload/restore; versleuteld artifact blijft exact geïdentificeerd voor PG-LOCAL-CLEANUP |
| **PG-OFFHOST** | R2 externe write/read | Infra-operator | Na PG-DUMP: hetzelfde client-versleutelde artifact naar beide provider-onafhankelijke bestemmingen | Pietje, opnieuw command-specifiek | Zelfde `artifact_id`, bron- en ciphertext-SHA en per provider: remote objectversie, lockmodus/-einddatum, ouderdom ≤24 u en ciphertext-SHA na remote readback; geen plaintext remote | Stop; geen restore/cutover; versleuteld lokaal artifact blijft alleen voor exact gescope-te cleanup |
| **PG-RESTORE** | R2 scratch | Infra-operator | Geïsoleerde restore van een **vers gedownload** PG-OFFHOST-object met de read-only recoverycredential | Pietje, opnieuw command-specifiek | Recoverycredential leest; recovery-identity decrypt; `artifact_id` en beide SHA's sluiten; PG-/pgvector-/extensieversies, schema/RLS/inhoudscontrole; RTO ≤ 4 u (doc 06 §27) | Stop; scratch blijft; productie no-touch |
| **PG-LOCAL-CLEANUP** | R2 productie-local delete | Infra-operator | Na geaccepteerde PG-RESTORE, of na expliciet goedgekeurde abort: alleen het exacte encrypted staging-artifact met die `artifact_id` verwijderen; geen glob/padverbreding | Pietje, opnieuw command-specifiek | Exact artifact afwezig; siblingbestanden en productiestore ongewijzigd; verwijder-/foutbewijs | Bij mislukking blijft het artifact `0600`, versleuteld en gealarmeerd; geen bredere delete |
| **QD-INVENTORY** | R0 | Infra-operator | Read-only Qdrant-inventaris | Pietje, command-specifiek | Collecties, counts, digest-overzicht | Stop; store blijft no-touch |
| **QD-SNAPSHOT** | R2 live write | Infra-operator | Na QD-INVENTORY en BKP-IAM-SCRATCH: apart goedgekeurde snapshot van productie-Qdrant | Pietje, command-specifiek | `artifact_id`, snapshot-ID en bron-SHA | Stop; geen off-host copy/restore |
| **QD-OFFHOST** | R2 externe write/read | Infra-operator | Na QD-SNAPSHOT: hetzelfde artifact client-versleuteld naar beide gekozen provider-onafhankelijke immutable bestemmingen; bestemming, retentie en key-ownership zijn vooraf besloten | Pietje, opnieuw command-specifiek | Zelfde `artifact_id`, bron- en ciphertext-SHA en per provider: remote objectversie, lockmodus/-einddatum, ouderdom ≤24 u en ciphertext-SHA na remote readback; geen plaintext remote | Stop; geen restore; productiesnapshot blijft no-touch |
| **QD-RESTORE** | R2 scratch | Infra-operator | Geïsoleerde restore van het **vers gedownloade** QD-OFFHOST-object met de read-only recoverycredential | Pietje, command-specifiek | Recoverycredential leest; recovery-identity decrypt; `artifact_id` en beide SHA's sluiten; point-count/digest-match; RTO ≤ 8 u (doc 06 §27) | Stop; scratch blijft; productie no-touch |
| **QD-LOCAL-CLEANUP** | R2 productie live delete | Infra-operator | Na geaccepteerde QD-RESTORE, of na expliciet goedgekeurde abort: alleen exact `snapshot_id` uit QD-SNAPSHOT verwijderen; collectie/volume nooit globben | Pietje, opnieuw command-specifiek | Exact snapshot afwezig; overige snapshots en collectie-count/digest ongewijzigd; verwijder-/foutbewijs | Bij mislukking blijft snapshot geïdentificeerd en storage-alarm actief; geen bredere delete |
| **QD-PIN** | R2 later | Infra-operator | Buiten store-recovery: pas na geaccepteerde QD-RESTORE het exact gevalideerde actuele digest pinnen, vóór een later apart goedgekeurde restart/upgrade/deploy | Pietje, opnieuw command-specifiek | Digest-pin evidence op de afzonderlijke wijziging | Niet bundelen met inventory/snapshot/off-host/restore; geen stilzwijgende reuse |
| **SCRATCH-DELETE** | R2 scratch-delete | Infra-operator | Pas na geaccepteerde PG- én QD-RESTORE én geaccepteerde PG- én QD-LOCAL-CLEANUP: uitsluitend de exact geïdentificeerde scratchomgevingen verwijderen; geen glob/padverbreding | Pietje, opnieuw command-specifiek | Exacte scratch-ID's afwezig; siblingpaden en productiestores ongewijzigd; verwijder-/foutbewijs | Bij mislukking blijft scratch beperkt, geïdentificeerd en gealarmeerd; productie blijft no-touch; geen bredere delete |

PostgreSQL- en Qdrant-RPO/RTO zijn **onafhankelijk** (doc 06 §27): PG RPO ≤ 24 u / RTO ≤ 4 u; Qdrant RPO ≤ 24 u / RTO ≤ 8 u.

Na store-gates volgen private transport, identities/secrets, clean canary/G0-sluiting en inference-worker — elk met dezelfde command-specifieke Pietje-goedkeuring. De twee permanente, versleutelde, provider-onafhankelijke off-host backupbestemmingen, retentie en key-ownership zijn onbeslist; [doc 15 §41.10](architecture-2.2/15-review-panel.md) bevat alleen een niet-bindend besluitvoorstel. Dit blokkeert live G0/cutover, niet deze documentcorrectie. Een toekomstige Claude-P0 mag alleen na verplichte secret-/PII-redactie in een PR-body worden overgenomen; `[REDACTED]` verlaagt de ernst niet.

#### M5 v1 — database-identiteitsmodel

Voor de huidige 2–4 workspaces is de kleinste controleerbare v1:

1. Een `NOLOGIN` owner-role bezit tenant-schema's en -tabellen.
2. Een afzonderlijke migrator/DBA-role wijzigt schema en policies en wordt niet aan de runtime verstrekt.
3. Iedere workspace krijgt een eigen tenantgebonden login-role en connection pool, met `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, zonder table ownership en zonder membership in een andere tenantrole.
4. RLS bepaalt de workspace uit `current_user` via een beveiligde mapping, of uit een later via ADR bewezen gelijkwaardig **niet door de client schrijfbaar** kenmerk. Policies vertrouwen nooit uitsluitend op `current_setting('app.workspace_id')`.
5. De server-side authentieke sessiescope selecteert de tenantpool. Requestbody, prompt, agent of tool mag geen pool/credential kiezen. Aanvullende context is transactiegebonden en wordt bij pool-return op lekkage getest.

#### M5 acceptance suite

M5 is uitsluitend groen met synthetische fixtures en de **echte productiepool/roles**:

1. Evidence bevat `current_user`, role flags, memberships, tabelowners, actieve policies, releasecommit en meettijd.
2. Same-tenant API en directe `SELECT`/`INSERT` slagen zoals verwacht.
3. Zonder authenticatie geven chat/conversation-routes 401; een fumero-sessie naar bokas geeft 403.
4. Directe SQL als de echte fumero-app-role retourneert nul bokas-rijen en weigert bokas `INSERT`/`UPDATE`; omgekeerd hetzelfde.
5. Op **dezelfde fysieke poolverbinding midden in een transactie** falen adversariële `SET app.workspace_id`, `set_config(...)`, `SET ROLE`, query-ID-, reset- en reuse-pogingen. **Na elke** poging herhalen negatieve `SELECT`/`INSERT` op de andere tenant: nul extra rijen en nul extra rechten.
6. Requestbody/prompt kan de server-side sessiescope of poolkeuze niet overschrijven; ontbrekende/ongeldige scope faalt gesloten.
7. Pool-reuse bewijst dat transactiecontext na commit/rollback leeg is en een fysieke connectie nooit tussen tenantpools wordt gedeeld.

Een test als owner, superuser, `BYPASSRLS`-role of andere identiteit dan de productiepool is ongeldig. API-403 zonder directe SQL-, context-switch- en pool-reusetests is onvoldoende; elke lekkage houdt M5 rood.

### Gevolgen en rollback

- De huidige flags `USE_POSTGRES`, `POSTGRES_PRIMARY` en `SQLITE_FALLBACK` zijn repo-feiten, geen geldig clean-start- of cutovermechanisme.
- Een latere codewijziging moet alle productie-SQLite-writes uitschakelen voordat de schone runtime wordt gedeployed.
- Er bestaat geen SQLite-rollbackpad. Toekomstige recovery verloopt alleen via het volledige twaalf-gate herstelpad: BKP-IAM-SCRATCH; PG-INVENTORY → PG-DUMP → PG-OFFHOST naar beide provider-onafhankelijke bestemmingen → PG-RESTORE → PG-LOCAL-CLEANUP; QD-INVENTORY → QD-SNAPSHOT → QD-OFFHOST naar beide bestemmingen → QD-RESTORE → QD-LOCAL-CLEANUP; daarna SCRATCH-DELETE. Geen subset volstaat; QD-PIN blijft een latere afzonderlijke wijziging.
- Bij een mislukte canary blijven de gerapporteerde Hetzner-stores no-touch en Motor unavailable/degraded; nooit terug naar een superuser/`BYPASSRLS`-appcredential.

### Acceptatie Fase 1

- [ ] BKP-IAM-SCRATCH bewijst gescheiden least-privilege upload/recovery, negatieve rechten en cleanup/expiry vóór productie-artifacts
- [ ] PostgreSQL inventory, apart goedgekeurde dump, en dezelfde artifactketen naar **twee provider-onafhankelijke bestemmingen** met per-provider objectversie/lock/readback en restore van een vers gedownload/decrypt artifact met dezelfde `artifact_id` en SHA-keten bewezen
- [ ] Qdrant inventory, snapshot, en dezelfde artifactketen naar **twee provider-onafhankelijke bestemmingen** met per-provider objectversie/lock/readback en restore van een vers gedownload/decrypt artifact met dezelfde `artifact_id` en SHA-keten bewezen; digest-pin blijft een aparte latere wijziging
- [ ] PG-LOCAL-CLEANUP en QD-LOCAL-CLEANUP verwijderden uitsluitend de exact bewezen staging-/snapshot-artifacts; beide scratch-restores zijn daarna via SCRATCH-DELETE verwijderd; productiestores bleven no-touch
- [ ] Private PostgreSQL-transport met `sslmode=verify-full` groen; publiek en non-TLS falen
- [ ] Pietje heeft de bestemming van bestaande Hetzner-stores expliciet besloten; geen silent reuse
- [ ] M5-suite groen als echte tenantgebonden productieapp-roles/pools
- [ ] Geen `better-sqlite3`-import/load/open/create/read/write of SQLite-fallback in productie; geen `.db`/`.db-wal`/`.db-shm` aangemaakt tijdens canary

---

## ADR-101 — Canonieke workflow-engine: Inngest bevestigen, DBOS als challenger

| Veld | Waarde |
|------|--------|
| **Status** | 🟡 **Voorwaardelijk besloten** — Inngest is incumbent; bevestigingsspike open |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |
| **Deadline** | Inngest-confirmatie **2026-08-30**; alleen bij DBOS-trigger eindbesluit **2026-09-13** |

### Context

`lib/inngest/` is geen lege skeleton: approvals emitten events en één HITL-workflow gebruikt `waitForEvent`. Zonder keys is de integratie no-op en runtimebewijs ontbreekt. n8n is geen durable engine; DBOS is de enige challenger die op de bestaande Hetzner/Postgres-topologie past.

### Besluit

Er komt exact één durable engine op Hetzner. **Inngest blijft de default**, omdat overstappen zonder aantoonbare winst migratierisico toevoegt. Inngest krijgt maximaal drie architectuurdagen totaal, één per week in week 3–5. DBOS krijgt alleen na de vastgelegde trigger een opeenvolgende spike van 3–5 dagen; downstream werk schuift dan mee.

Dezelfde minimale workflow test intake → leased inference-step → approval met timeout/reminder → gesimuleerde side effect → settlement.

Verplichte gates voor iedere geteste kandidaat:

1. event-vóór-wait-race en normale HITL-flow slagen;
2. kill/restart hervat zonder dubbel effect;
3. herstel over NUC, Hetzner en inference-worker geeft geen orphan run/task;
4. checkpointlatency over Tailscale is gemeten en acceptabel voor async steps;
5. twee gelijktijdige GPU-stappen respecteren één resource-lease;
6. een deploy laat in-flight runs veilig uitlopen of migreren;
7. operator vindt en herstart een vastgelopen run binnen 5 minuten;
8. engine-state is herstelbaar: DBOS via PG-restore; Inngest via apart backup-object;
9. Hetzner houdt minimaal 2 GB RAM-headroom onder de testlast.

**DBOS wordt alleen getriggerd** als Inngest na één herstelpoging minimaal één harde gate mist of geen aantoonbaar herstelbaar engine-store-backupobject levert. DBOS wint vervolgens alleen als het alle negen gates haalt. Slaagt Inngest, dan sluit ADR-101 uiterlijk 2026-08-30 zonder DBOS-spike. Bij trigger valt het eindbesluit uiterlijk 2026-09-13. Falen beide, dan bevriest de enginebouw.

### Gevolgen

- Workflows houden businesslogica in gewone functies; de engine-wrapper blijft dun.
- De verliezer gaat naar Rejected met spike-evidence.
- Inngest betekent een apart engine-store-backupobject; DBOS deelt het PG-backuppad.

### Acceptatie

- [ ] Inngest-uitkomst bevat recovery-, race-, lease-, deploy-, backup- en RAM-evidence
- [ ] DBOS wordt alleen bij de vastgelegde trigger getest en krijgt dan dezelfde evidence
- [ ] Inngest bewijst de gates binnen maximaal drie architectuurdagen; DBOS krijgt alleen na trigger 3–5 opeenvolgende dagen
- [ ] Winnaar voldoet aan alle negen gates
- [ ] Keuze staat uiterlijk 2026-08-30 vast, of bij geactiveerde DBOS-trigger uiterlijk 2026-09-13

### Rollback

Tot bevestiging blijft alleen de bestaande Inngest-approvalpilot toegestaan; geen nieuwe engine-workflows. Bij mislukte cutover: nieuwe runs stoppen, in-flight runs afhandelen, terug naar de laatst bewezen engineversie en alles naar autonomie A1.

---

## ADR-102 — Motor Action Gateway: scope en No-Invention Gate

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** — enforcement uitgewerkt in ADR-109 |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Geen bestaand product combineert tenant, risicoklasse, autonomieniveau en EUR-budget over OpenClaw, engine en andere harnesses. Promptregels alleen zijn niet afdwingbaar.

### Besluit

Motor krijgt één cross-harness Action Gateway. Policies blijven versioned data in git; OPA/Cedar wordt pas overwogen boven circa twintig regels. ADR-109 vervangt het oude “adviescheck”-idee door het bindende credential-broker/proxymodel.

### Gevolgen

- Side-effect-tools worden centraal testbaar en auditable.
- Gateway is een beveiligingszwaartepunt, geen vrijblijvende dunne helper.
- OpenClaw-omleiding volgt pas in Golf 3.

### Acceptatie

- [ ] NIG-1 is traceerbaar naar policy-, bypass-, budget- en tenanttests
- [ ] Geen tweede Gateway of harness-eigen policywaarheid

### Rollback

Gateway uit betekent autonomie A1 en side-effect-tools uit; credentials gaan niet terug naar harnesses.

---

## ADR-103 — Playbook/Skill-model: git nu, registry later

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten; registry-implementatie bevroren** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Het Devin-format is bruikbaar, maar een PG-registry met promotieworkflow is extra scope voor één technicus.

### Besluit

Playbooks en skills zijn bestanden in eigen git. Tot Playbook #1 dertig dagen groen is, volstaat een map met een statuskolom en rollbackversie. Geen externe skillregistry. Een PG-registry wordt pas heroverwogen nadat minstens drie Playbooks productie draaien.

### Gevolgen

- Procedures blijven leesbaar zonder platform.
- Tenant-promotie en registry-UI zijn uit scope.
- ClawHub/community-skills blijven verboden.

### Acceptatie

- [ ] Elk actief Playbook heeft owner, status, versie, verboden acties en rollback
- [ ] Geen PG-registry of externe registry vóór de AM-1-gate

### Rollback

Vorige gitversie activeren; de statuskolom terugzetten. Er is geen registryservice om te herstellen.

---

## ADR-104 — Motor Kernel: event-projectie op Hetzner

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

`tasks` en engine-run-state mogen geen twee los muteerbare waarheden zijn. De huidige repo heeft nog geen 2.2-Kernel.

### Besluit

Kernel-API en taskmodel draaien op Hetzner naast engine en Postgres. `tasks` is een read-projectie en muteert uitsluitend door append-only, op event-id idempotente engine-events. Een reconciliation-job alarmeert op run zonder task en task zonder run. De state machine bevat ook `cancelled`, `failed`, `blocked` en `expired`; GPU/sandboxcapaciteit gebruikt leases.

### Gevolgen

- Motor Next.js op de NUC wordt client/emitter en schrijft geen taskstatus direct.
- EXECUTION_BOARD.db en andere taskwaarheden gaan uit.
- Compensatiepaden horen bij onomkeerbare side effects.

### Acceptatie

- [ ] Dubbel event geeft één projectiewijziging
- [ ] Beide orphan-richtingen geven binnen de afgesproken meetperiode alarm
- [ ] Abort, failure, block, expiry en lease-timeout zijn getest
- [ ] NUC-uitval stopt geen lopende engine-run op Hetzner

### Rollback

Stop nieuwe dispatch, herstel de projectie uit engine-events en zet alle taken op A1. Nooit parallel twee schrijfbare taskstores openen.

---

## ADR-105 — Orchestratorconsolidatie

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

OpenClaw, n8n, Dify, SQLite-cron en Inngest overlappen. Dat is niet beheersbaar voor één technicus.

### Besluit

De ADR-101-winnaar is de enige durable orchestrator. OpenClaw blijft kanaal/chat-harness op de NUC; n8n blijft een stateless integratie-adapter; Dify krijgt geen nieuwe workflows en wordt uitgezet. “NUC-orchestrator” is alleen de informele naam voor kanaal/UI/glue.

### Gevolgen

- Nieuwe stateful n8n- of Dify-flows zijn verboden.
- Dify-decommissioning levert circa 4–6 GB Hetzner-headroom.
- Bestaande flows migreren alleen wanneer K1/K2 zelf naar Kernel/Gateway gaan.

### Acceptatie

- [ ] Geen nieuwe durable state buiten engine/Postgres
- [ ] K1/K2-migratie bewijst het adaptermodel
- [ ] Dify 30 dagen ongebruikt vóór verwijderen

### Rollback

Dify-compose blijft na uitzetten 30 dagen beschikbaar maar read-only; herstart alleen voor herstel van een bekende flow, niet voor nieuwbouw.

---

## ADR-106 — OpenClaw-hardening als releasevoorwaarde

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten; runtimebewijs open** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

OpenClaw is een kanaalgateway met remote-shell-risico. De repo bewijst alleen optionele clienttokenondersteuning, niet de serverhardening.

### Besluit

Production Core vereist: versie met relevante CVE-fixes; verplichte token-auth; loopback-bind plus Tailscale-only beheer; WebSocket-originvalidatie; skills-allowlist uit eigen git; device-pairing-review. Geen ClawHub/community-skills. Tot Gateway-omleiding in Golf 3 krijgt OpenClaw geen nieuwe side-effect-capabilities.

### Gevolgen

- Ongehard OpenClaw blijft Incubation of staat uit.
- Golf 0 is niet groen zonder live bind/auth/version/allowlist-bewijs.

### Acceptatie

- [ ] Versie, bindadres, tokencheck, origins, pairing en allowlist zijn live vastgelegd
- [ ] OpenClaw is niet publiek bereikbaar
- [ ] Geen nieuwe side-effect-tool vóór ADR-109-omleiding

### Rollback

OpenClaw uitschakelen; Motor UI blijft het kanaal. Nooit hardening terugdraaien om bereikbaarheid te herstellen.

---

## ADR-107 — Geen tweede memory-laag zonder aangetoonde taak

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Qdrant, PG en filesystem dekken de huidige behoeften; legacy Chroma toont de kosten van extra waarheden.

### Besluit

Qdrant is businesskennis, PG FTS is transcript-/metadatazoeking en filesystem is herstelbare context. LightRAG, Cognee en andere graph-memory blijven Watchlist tot een concrete taak faalt én een eval aantoont dat graph-reasoning de fout oplost.

### Gevolgen

- Geen tweede vector-/graphstore op speculatie.
- Legacy Chroma wordt volgens AM-5 bevroren en verwijderd.

### Acceptatie

- [ ] Elke voorgestelde memorylaag noemt taak, huidige failure en vergelijkende eval
- [ ] Geen nieuwe store zonder SoT-matrixrij

### Rollback

Nieuwe memorylaag verwijderen en opnieuw indexeren vanuit canonieke bronnen; nooit vanuit de afgeleide store herstellen.

---

## ADR-108 — Runtime-topologie: durable control op Hetzner

| Veld | Waarde |
|------|--------|
| **Status** | 🟡 **Besloten als owner-target; runtime-topologie pending revalidatie** |
| **Datum** | 2026-07-27; owner-targetstatus aangescherpt 2026-07-31 |
| **Beslisser** | Pietje |

### Context

Pietjes beoogde owner-target is een drie-node-topologie (NUC, Hetzner 16 GB, Ryzen 7/32 GB/RTX 3090 inference-PC); geen claim dat die topologie nu bestaat — read-only revalidatie pending. Engine/Kernel op de thuissite maakt control en execution tegelijk afhankelijk van thuisstroom en WAN. Onderstaande tabel is **owner-target**, geen aanwezig runtimefeit; live validatie volgt read-only vóór enige gate-evidence.

### Besluit (owner-target, pending revalidatie)

| Node | Verantwoordelijkheid |
|---|---|
| **Hetzner** | Postgres SSOT, canonieke engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter en Uptime Kuma/Beszel-hub |
| **NUC** | Motor UI, gehard OpenClaw, Telegram/kanalen, local-executor/PC-bridge-glue en ingress |
| **Inference-PC** | Stateless lokale LLM-/batchworker via Tailscale; geen DB of publiek endpoint |

Binnen het owner-target mag de eigenaar de NUC informeel “orchestrator” noemen voor kanalen/UI; de beoogde **durable orchestrator** is de engine op Hetzner. Dit is geen runtimefeit vóór revalidatie. De inference-PC krijgt geen taken vóór SSH, runbook en Gateway/policy.

### Verwachte gevolgen als de owner-targettopologie live is gevalideerd

- Engine↔Postgres-checkpoints zouden lokaal op Hetzner blijven; cross-node inference/glue moet dan nog steeds Tailscale-latency meten (ADR-101 gate 4).
- Bij bewezen implementatie zou NUC-uitval kanalen raken, niet de durable state.
- De beoogde monitoringhub op Hetzner moet de thuissite bewaken; aanwezigheid en werking zijn nog niet bewezen.
- Als Inngest wordt bevestigd, vereist die keuze een apart engine-store-backupobject.

### Acceptatie

- [ ] ADR-101-spike draait op deze topologie
- [ ] NUC-uitval laat een lopende run veilig doorgaan
- [ ] Hetzner-uitval geeft NUC degraded/read-only en stopt side effects
- [ ] Monitoringhub ziet NUC en inference-PC
- [ ] Locatie, voeding, opslag en SSH van de inference-PC zijn vóór activering vastgelegd

### Beoogde rollback na geaccepteerde implementatie

Na bewezen implementatie worden bij een Hetzner-incident nieuwe runs gestopt en side effects geblokkeerd. Tijdelijk terugplaatsen naar NUC vereist dan een nieuw expliciet ADR-amendement; geen dual-run.

---

## ADR-109 — Gateway-enforcementmodel: credential-broker/proxy

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Een losse HTTP-policycheck kan worden omzeild als harnesses credentials houden. Parallelle budgetchecks racen en een approval zonder argumentbinding heeft een TOCTOU-gat.

### Besluit

De Action Gateway op Hetzner is de enige houder van side-effect-credentials en voert calls als proxy uit.

- **Fail-closed:** R1/R2/R3 weigeren bij Gateway-uitval; alleen allowlisted R0-reads mogen fail-open met audit.
- **Budget:** reservering → uitvoering → settlement in PG; geen losse check-then-act.
- **Approval:** bindt `(tool, argument_hash, task_id, expires_at)`; Gateway hertoetst de hash.
- **Idempotency:** iedere toolcall heeft een key; een duplicate geeft hetzelfde resultaat zonder tweede effect.
- **V1-scope:** alleen mail/pay/delete via engine-workflows. Deploys later; OpenClaw-omleiding in Golf 3.

### Gevolgen

- Harnesses krijgen geen externe side-effect-API-keys.
- Gateway wordt een kritisch securitycomponent met race-, TOCTOU- en bypass-tests.
- Telegram bevat alleen notificatie+link; approval gebeurt met identiteit in Motor UI.

### Acceptatie

- [ ] Netwerk-bypasstest blokkeert directe mail/pay/delete
- [ ] Gateway-down blokkeert R1+
- [ ] Tien parallelle budgetcalls overschrijden de cap niet
- [ ] Gewijzigde arguments na approval geven DENY
- [ ] Duplicate idempotency-key veroorzaakt één extern effect
- [ ] Elk besluit en settlement heeft `task_id` in `audit_events`

### Rollback

Gateway uit betekent alle side-effect-tools uit en autonomie A1. Credentials terugplaatsen in OpenClaw/n8n/code-agent is geen rollbackoptie.

---

## ADR-index (overzicht)

| ID | Onderwerp | Status |
|----|-----------|--------|
| ADR-001 | Qdrant dual-search | ✅ Besloten |
| ADR-002 | SQLite → PostgreSQL clean start | ⚠️ M0 onbewezen; M1/M4/M5/M6 rood; M2/M3 geannuleerd |
| ADR-003 | Qdrant unified collectie (optioneel) | ⏸ Open — alleen na ADR-001 evaluatie Q3 2026 |
| ADR-101 | Canonieke engine: Inngest bevestigen vs DBOS | 🟡 Inngest uiterlijk 2026-08-30; DBOS bij trigger uiterlijk 2026-09-13 |
| ADR-102 | Action Gateway scope/NIG-1 | ✅ Besloten; enforcement via ADR-109 |
| ADR-103 | Playbook/Skill-model | ✅ Git besloten; registry bevroren |
| ADR-104 | Motor Kernel | ✅ Event-projectie op Hetzner |
| ADR-105 | Orchestratorconsolidatie | ✅ Besloten |
| ADR-106 | OpenClaw-hardening | ✅ Besloten; runtimebewijs open |
| ADR-107 | Geen tweede memorylaag | ✅ Besloten |
| ADR-108 | Runtime-topologie | 🟡 Owner-target; pending revalidatie |
| ADR-109 | Gateway-enforcementmodel | ✅ Credential-broker/proxy |

---

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06-06 | ADR-001 dual-search + ADR-002 Postgres milestones (M0–M6) |
| 2026-06-06 | Sprint 1.3: Qdrant payload schema, master_contexts, PM2 single-instance note |
| 2026-07-27 | ADR-101 t/m ADR-109 geconsolideerd uit Motor AI 2.2 AM-1 t/m AM-5; ADR-108/109 toegevoegd |
| 2026-07-29 | ADR-002-amendement: recovery-first volgorde, private PostgreSQL+TLS-gate en M5 met tenantgebonden roles/pools, directe SQL-, context-switch- en pool-reusetests |
| 2026-07-31 | ADR-002/108-amendement: M0 onbewezen; M5 mid-transactie context-switch; M6 better-sqlite3-ban; afzonderlijke IAM/dump/off-host/restore/lokale-cleanup/scratch-gates en latere QD-PIN; RPO/RTO doc 06 §27; ADR-108 conditioneel owner-target |
