# Motor AI Factory OS — Architectuurbeslissingen

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-30
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
| **Status** | ⚠️ **Besloten; clean start vastgesteld, M4/M5 rood** |
| **Datum** | 2026-06-06; amendement 2026-07-30 |
| **Beslisser** | Pietje |
| **Startpunt plan** | Fase 0 Week 1 = 2026-06-06 |

### Context

De repo opent via `better-sqlite3` nog steeds `$HOME/AI_HQ/data/ai-motor.db` read/write. Dat codepad blokkeert een schone productieruntime. PostgreSQL hoort op **Hetzner**; Motor Next.js blijft op de **NUC** met private connectiviteit.

### Besluit — milestones

| Milestone | Historische datum | Status / criterium |
|---|---|---|
| **M0 — Geen nieuwe SQLite-only tabellen** | 2026-06-20 | **Niet bewezen.** De toekomstige regel blijft: nieuwe schema's zijn PostgreSQL-ready; geen nieuwe SQLite-only tabellen vanaf acceptatie. |
| **M1 — PostgreSQL live op Hetzner** | 2026-06-28 | Toekomstige gate: read-only inventaris, gekozen versleutelde off-host backup, geïsoleerde restore, Tailscale-IP-bind, TLS met `sslmode=verify-full`, en negatieve publieke/non-TLS-tests. |
| **M2 — Dual-write aan** | 2026-07-05 | **Geannuleerd, nooit gehaald.** Clean start gebruikt geen SQLite-dual-write. |
| **M3 — Legacy-SQLite migreren** | 2026-07-19 | **Geannuleerd, nooit gehaald.** Geen migratie, rijpariteit of `legacy_sqlite_id`-reconciliatie. |
| **M4 — PostgreSQL canonieke store** | 2026-07-26 | **Niet gehaald; toekomstige acceptatiegate.** Pietje kiest na inventory/restore expliciet de bestemming van de gerapporteerde stores; de schone runtime leest en schrijft daarna PostgreSQL zonder productie-SQLite. |
| **M5 — RLS productie** | 2026-08-02 | Productieruntime gebruikt tenantgebonden least-privilege app-role/pool; RLS vertrouwt geen vrij instelbare tenant-GUC; same-tenant, 401, 403, directe SQL-, pool-reuse- en context-switchtests zijn groen. |
| **M6 — Geen productie-SQLite** | 2026-08-09 | **Voorwaarde vóór deployment:** geen `better-sqlite3`-import, -load, -open, -create, -read, -write of SQLite-fallback in productie. Bewijs: geen `.db`/`.db-wal`/`.db-shm` aangemaakt tijdens canary. |

De oude datums zijn historische, rode gates en geen bewijs van uitvoering. De nulmeting van 2026-07-29 blijft uitsluitend een historisch, door de eigenaar geaccepteerd rapport: de ruwe command evidence is niet onafhankelijk reproduceerbaar vanuit deze repository. Iedere runtimeclaim wordt read-only opnieuw gevalideerd voordat zij gate-evidence vormt of aan een live actie voorafgaat.

### Amendement 2026-07-30 — clean start en niet-forgeerbare M5-isolatie

De legacy-SSD is defect en permanent uitgesloten. Er volgt geen mount, read, copy, recovery, migratie, rijpariteit, `legacy_sqlite_id`-reconciliatie of SQLite-rollback. Dit is geen geslaagde recovery. De clean start geldt uitsluitend voor legacy SQLite.

De op Hetzner gerapporteerde PostgreSQL- en Qdrant-stores zijn strikt **no-touch**: niet verwijderen, resetten, overschrijven, leeg veronderstellen of stilzwijgend canoniek hergebruiken.

#### Vastgestelde volgorde — geen stap is voor uitvoering goedgekeurd

Deze documenten **authoriseren geen enkele live actie**. Zelfs read-only SSH of control-plane-export vereist aparte, command-specifieke Pietje-goedkeuring vóór uitvoering.

| Gate | Risico | Eigenaar | Doel / precondities | Goedkeuring | Evidence | Stop-gedrag |
|---|---|---|---|---|---|---|
| **PG-INVENTORY** | R0 | Infra-operator | Read-only inventaris gerapporteerde PostgreSQL-store | Pietje, command-specifiek | Geredigeerd schema-, RLS- en versie-overzicht | Stop; store blijft no-touch |
| **PG-BACKUP** | R2 live write | Infra-operator | Gekozen versleutelde off-host backup van productie-PG | Pietje, command-specifiek | Manifest/checksum, retentie, RPO ≤ 24 u | Stop; geen restore/cutover |
| **PG-RESTORE** | R2 scratch | Infra-operator | Geïsoleerde restore op scratch-omgeving | Pietje, command-specifiek | Schema/RLS/inhoudscontrole; RTO ≤ 4 u (doc 06 §27) | Stop; scratch blijft; productie no-touch |
| **QD-INVENTORY** | R0 | Infra-operator | Read-only Qdrant-inventaris | Pietje, command-specifiek | Collecties, counts, digest-overzicht | Stop; store blijft no-touch |
| **QD-SNAPSHOT** | R2 live write | Infra-operator | Apart goedgekeurde snapshot van productie-Qdrant | Pietje, command-specifiek | Snapshot-ID, checksum; RPO ≤ 24 u | Stop; geen restore |
| **QD-RESTORE** | R2 scratch | Infra-operator | Geïsoleerde restore op scratch-omgeving | Pietje, command-specifiek | Point-count/digest-match; RTO ≤ 8 u (doc 06 §27) | Stop; scratch blijft; productie no-touch |
| **QD-PIN** | R2 later | Infra-operator | Exact actueel digest pinnen | Pietje, command-specifiek | Digest-pin evidence | Aparte wijziging; geen stilzwijgende reuse |
| **SCRATCH-DELETE** | R2 | Infra-operator | Verwijderen scratch na restore-test | Pietje, command-specifiek | Verwijderbewijs | Productie blijft no-touch |

PostgreSQL- en Qdrant-RPO/RTO zijn **onafhankelijk** (doc 06 §27): PG RPO ≤ 24 u / RTO ≤ 4 u; Qdrant RPO ≤ 24 u / RTO ≤ 8 u.

Na store-gates volgen private transport, identities/secrets, clean canary/G0-sluiting en inference-worker — elk met dezelfde command-specifieke Pietje-goedkeuring. De permanente versleutelde off-host backupbestemming, retentie en key-ownership zijn onbeslist; dit blokkeert live G0/cutover, niet deze documentcorrectie. Een toekomstige Claude-P0 mag alleen na verplichte secret-/PII-redactie in een PR-body worden overgenomen; `[REDACTED]` verlaagt de ernst niet.

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
- Er bestaat geen SQLite-rollbackpad. Toekomstige recovery verloopt alleen via afzonderlijk bewezen PostgreSQL- en Qdrant-off-host backups en geïsoleerde restores.
- Bij een mislukte canary blijven de gerapporteerde Hetzner-stores no-touch en Motor unavailable/degraded; nooit terug naar een superuser/`BYPASSRLS`-appcredential.

### Acceptatie Fase 1

- [ ] PostgreSQL inventory, gekozen off-host backup en geïsoleerde restore bewezen
- [ ] Qdrant inventory, snapshot, off-host kopie en geïsoleerde restore bewezen; digest-pin blijft een aparte latere wijziging
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
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Pietjes beoogde owner-target is een drie-node-topologie (NUC, Hetzner 16 GB, Ryzen 7/32 GB/RTX 3090 inference-PC); geen claim dat die topologie nu bestaat — read-only revalidatie pending. Engine/Kernel op de thuissite maakt control en execution tegelijk afhankelijk van thuisstroom en WAN. Onderstaande tabel is **owner-target**, geen aanwezig runtimefeit; live validatie volgt read-only vóór enige gate-evidence.

### Besluit (owner-target, pending revalidatie)

| Node | Verantwoordelijkheid |
|---|---|
| **Hetzner** | Postgres SSOT, canonieke engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter en Uptime Kuma/Beszel-hub |
| **NUC** | Motor UI, gehard OpenClaw, Telegram/kanalen, local-executor/PC-bridge-glue en ingress |
| **Inference-PC** | Stateless lokale LLM-/batchworker via Tailscale; geen DB of publiek endpoint |

De eigenaar mag de NUC informeel “orchestrator” noemen voor kanalen/UI; de enige **durable orchestrator** is de engine op Hetzner. De inference-PC krijgt geen taken vóór SSH, runbook en Gateway/policy.

### Gevolgen

- Engine↔Postgres-checkpoints blijven lokaal op Hetzner; cross-node inference/glue meet nog steeds Tailscale-latency (ADR-101 gate 4).
- NUC-uitval raakt kanalen, niet durable state.
- Monitoring op Hetzner bewaakt de thuissite.
- Inngest vereist een apart engine-store-backupobject.

### Acceptatie

- [ ] ADR-101-spike draait op deze topologie
- [ ] NUC-uitval laat een lopende run veilig doorgaan
- [ ] Hetzner-uitval geeft NUC degraded/read-only en stopt side effects
- [ ] Monitoringhub ziet NUC en inference-PC
- [ ] Locatie, voeding, opslag en SSH van de inference-PC zijn vóór activering vastgelegd

### Rollback

Bij een Hetzner-incident worden nieuwe runs gestopt en side effects geblokkeerd. Tijdelijk terugplaatsen naar NUC vereist een nieuw expliciet ADR-amendement; geen dual-run.

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
| ADR-002 | SQLite → PostgreSQL clean start | ⚠️ M2/M3 geannuleerd; M4/M5 rood |
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
| 2026-07-31 | ADR-002/108-amendement: M0 onbewezen; M5 mid-transactie context-switch; M6 better-sqlite3-ban; aparte PG/QD-gates; RPO/RTO doc 06 §27; ADR-108 owner-target |
