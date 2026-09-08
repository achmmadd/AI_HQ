# Motor AI Factory OS — Architectuurbeslissingen

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
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

## ADR-002 — SQLite → Postgres cutover (data & tijdlijn)

| Veld | Waarde |
|------|--------|
| **Status** | ⚠️ **Besloten; uitvoering achter op M4** |
| **Datum** | 2026-06-06 |
| **Beslisser** | Pietje |
| **Startpunt plan** | Fase 0 Week 1 = 2026-06-06 |

### Context

Motor draait op `better-sqlite3` (`~/AI_HQ/data/ai-motor.db`). Single-writer blokkeert multi-tenant SaaS, PM2 `instances: 1`, en white-label uitrol. Postgres komt op **Hetzner**; Motor Next.js blijft op **NUC** met remote `DATABASE_URL` via Tailscale.

### Besluit — milestones (hard)

| Milestone | Datum | Sprint | Criterium |
|-----------|-------|--------|-----------|
| **M0 — Geen nieuwe SQLite-only tabellen** | **2026-06-20** | Fase 0 exit | Nieuwe schema’s alleen Drizzle/Postgres-ready of in `platform-schema.ts` met PG-migratie in zelfde PR |
| **M1 — Postgres live op Hetzner** | **2026-06-28** | 1.1 | `infra/postgres/docker-compose.yml`; Tailscale bereikbaar; dagelijkse backup |
| **M2 — Dual-write aan** | **2026-07-05** | 1.1 | `USE_POSTGRES=1` schrijft SQLite **én** Postgres; SQLite blijft read-fallback |
| **M3 — Migratie-script gedraaid** | **2026-07-19** | 1.2 | `scripts/migrate-sqlite-to-postgres.mjs`; chat_history, auth, approvals, knowledge_documents over |
| **M4 — Postgres SSOT** | **2026-07-26** | 1.2 exit | Default read/write = Postgres; SQLite read-only backup |
| **M5 — RLS productie** | **2026-08-02** | 1.3 | Drizzle RLS policies actief; cross-tenant curl → 403/DB error |
| **M6 — SQLite uit productie** | **2026-08-09** | 1.3 exit | `better-sqlite3` alleen nog `NODE_ENV=development` of expliciete fallback flag |

**Cutover-datum (M4)** = **26 juli 2026** — dit is de officiële “Postgres is waarheid”-datum.

**Werkelijke stand 2026-07-27:** M4 is niet gehaald. `POSTGRES_PRIMARY` en `SQLITE_FALLBACK` sturen de SQLite read/write-routes nog niet aan; productieflags en rijpariteit zijn live onbekend. Zie [`architecture-2.2/00-HUIDIGE-STAAT.md`](architecture-2.2/00-HUIDIGE-STAAT.md). De eigenaar moet M4 expliciet herplannen of de implementatie aantoonbaar afronden; de oude datum is geen bewijs van cutover.

### Gevolgen

| Onderdeel | Tot M4 (26 jul) | Na M4 |
|-----------|-----------------|-------|
| Motor app locatie | NUC | NUC |
| Database | SQLite primair → dual-write | Postgres primair |
| PM2 instances | 1 | 1 tot M6; daarna evalueren |
| Qdrant | Hetzner (Fase 0/3) | ongewijzigd |
| LightRAG evaluatie | ❌ | ✅ pas na M4 |
| Nieuwe tenants | Hardcoded fumero/bokas OK | Workspace-tabel verplicht |

### Feature flags

```bash
# Fase 1.1
USE_POSTGRES=0          # default tot M2
DATABASE_URL=postgres://...@hetzner:5432/motor_ai

# Fase 1.2
USE_POSTGRES=1          # dual-write vanaf M2
POSTGRES_PRIMARY=0      # tot M4
POSTGRES_PRIMARY=1      # vanaf M4 — SQLite read-only

# Fase 1.3 exit
SQLITE_FALLBACK=0       # vanaf M6 — prod zonder SQLite
```

### Rollback

Tot **M4**: zet `POSTGRES_PRIMARY=0`, herstart PM2 — SQLite blijft volledige kopie via dual-write.  
Na **M4**: rollback alleen via PG restore uit backup (geen automatische SQLite-terugval).

### Acceptatie Fase 1

- [ ] M1–M6 datums gehaald of expliciet verschoven met update van dit document
- [ ] RLS penetration test faalt cross-tenant
- [ ] Geen `better-sqlite3` write in productie na M6

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
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-07-27 |
| **Beslisser** | Pietje |

### Context

Er zijn drie nodes: NUC, Hetzner 16 GB en een Ryzen 7/32 GB/RTX 3090-PC in aanbouw. Engine/Kernel op de thuissite maakt control en execution tegelijk afhankelijk van thuisstroom en WAN.

### Besluit

| Node | Verantwoordelijkheid |
|---|---|
| **Hetzner** | Postgres SSOT, canonieke engine, Kernel-API, Action Gateway, Qdrant, LiteLLM, n8n-adapter en Uptime Kuma/Beszel-hub |
| **NUC** | Motor UI, gehard OpenClaw (tot ADR-110-cutover), local-executor/PC-bridge-glue en ingress. **Telegram voor projectadministratie: niet hier — zie ADR-110.** |
| **Inference-PC** | Stateless lokale LLM-/batchworker via Tailscale; geen DB of publiek endpoint |

De eigenaar mag de NUC informeel “orchestrator” noemen voor UI/glue; de enige **durable orchestrator** is de engine op Hetzner. De inference-PC krijgt geen taken vóór SSH, runbook en Gateway/policy.

**Amendement 2026-09-08 (ADR-110):** Telegram + projectadministratie via QwenPaw vereisen **geen NUC**. Die kanaalrol draait op de bestaande QwenPaw-instance (Docker, agent `boka_operations`). Dit wijzigt Hetzner-durable-control en de inference-PC-blokkade niet.

### Gevolgen

- Engine↔Postgres-checkpoints blijven lokaal op Hetzner; cross-node inference/glue meet nog steeds Tailscale-latency (ADR-101 gate 4).
- NUC-uitval raakt Motor UI/ingress, niet durable state. QwenPaw-Telegram (ADR-110) is daar niet van afhankelijk.
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

## ADR-110 — QwenPaw als assistent-harness voor projectadministratie; Telegram verhuist mee

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** — uitvoering/migratie open |
| **Datum** | 2026-09-08 |
| **Beslisser** | Pietje (mondelinge opdracht in eigenaarsessie: "project administratie overzetten op qwenpaw en de telegram mee") |

### Context

De eigenaar heeft QwenPaw (AgentScope persoonlijke-assistent, self-hosted, met Telegram-kanaal en skills) beschikbaar en wil daar de projectadministratie — het bonnen-/administratie-domein per project (fumero/bokas), in Motor UI onder "Bonnen en administratie" — op draaien, met het Telegram-kanaal erbij. Dit raakt ADR-105 (OpenClaw als kanaal-harness), ADR-106 (OpenClaw-hardening) en ADR-108 (kanalen op de NUC).

### Besluit

1. **QwenPaw is kanaal/assistent-harness, geen orchestrator.** Engine, Kernel en Gateway blijven op Hetzner (ADR-105/108). **De NUC is geen voorwaarde en geen uitvoeringsdoel** voor projectadministratie + Telegram. **Live:** QwenPaw 2.2.0, agent **`boka_operations`**, Docker-hostname `cc22d51c27ac`, workspace `/app/working/workspaces/boka_operations`. Bestanden en skill horen in díe workspace. QwenPaw neemt de Telegram-kanaalrol voor de eigenaar over van OpenClaw. Of de Docker-host toevallig de NUC is, is irrelevant voor deze taak.
2. **Projectadministratie via QwenPaw is read-only (R0).** De skill `project-administratie` leest `/health`, `/recent` en `/export/documents` zonder credentials. Eerst `BOOKKEEPING_BOT_URL` indien gezet; anders `127.0.0.1:8001`, daarna Docker-host-kandidaten (`host.docker.internal`, `172.17.0.1`). Geen Motor-sessietoken. Boekingen, approvals, edits en exports blijven in de Motor UI (ADR-109, AM-4 punt 4). Geen side-effect-credentials in de QwenPaw-context. Als geen URL bereikbaar is: **onbekend, meten door Pietje** — geen verzonnen endpoint.
3. **Telegram-token: één poller.** Eén bot-token mag niet door twee pollers tegelijk. Als OpenClaw hetzelfde token nog pollen, dat kanaal daar uit — dat is geen NUC-setup voor QwenPaw. Motor-notificaties (`lib/telegram.ts`, alleen `sendMessage`) mogen hetzelfde token gebruiken. Token roteren via @BotFather bij de verhuizing.
4. **Toegangscontrole:** `dm_policy: "allowlist"` met alleen het Telegram-user-id van de eigenaar, `group_policy: "allowlist"`, `/setprivacy` ENABLED en `/setjoingroups` DISABLED in @BotFather. De bot gebruikersnaam wordt niet publiek gedeeld.
5. **AM-1-impact:** QwenPaw start als **Incubation**. OpenClaw blijft de Core-kanaalcomponent (na hardening, ADR-106) tot de QwenPaw-Telegram-migratie live is bewezen; daarna telt QwenPaw als de kanaalcomponent binnen de maximaal acht Production Core-componenten en vervalt OpenClaw naar Incubation. Het componentenaantal stijgt niet.
6. **AM-4-impact:** het verwerkingsregister (Art. 30) en de subverwerkerslijst moeten QwenPaw opnemen zodra AM-4 wordt uitgevoerd. Telegram blijft subverwerker met dataminimalisatie (notificatie + deeplink, geen inhoud). QwenPaw zelf is self-hosted en geen subverwerker, maar de achterliggende modelprovider is dat wél zodra een cloud-route wordt gebruikt; de dataklassen uit AM-4 punt 2 bepalen welke routes mogen. QwenPaw's eigen geheugen (ReMe) is harness-intern en wordt geen tweede memorylaag voor Motor-data (ADR-107): er wordt geen Motor-data in QwenPaw-memory opgeslagen buiten vluchtige sessiecontext.
7. **Legacy project-/taakborden** (`EXECUTION_BOARD.db`, `mission_control.py`, root-`projects/`) migreren **niet** naar QwenPaw; AM-5 (bevriezen → 30 dagen → verwijderen) blijft ongewijzigd.

### Gevolgen

- De eigenaar doet projectadministratie-vragen (openstaande bonnen, recente boekingen, exportstatus, aantal te approven items) via Telegram aan QwenPaw; de antwoorden bevatten deeplinks naar de Motor UI voor elke actie.
- OpenClaw verliest het Telegram-kanaal; overige OpenClaw-functies en de hardeningseisen uit ADR-106 blijven gelden zolang OpenClaw aan staat.
- K1/K2-waardewerk (AM-2) verandert niet van volgorde; QwenPaw is een extra bedieningslaag, geen nieuwe workflow-engine.
- Uitvoering staat in runbook [`qwenpaw-migratie.md`](qwenpaw-migratie.md); artefacten in [`../qwenpaw/`](../qwenpaw/). Live target: agent `boka_operations`. Als de git-checkout in de container ontbreekt, schrijft de agent de bestanden uit [`../qwenpaw/OPDRACHT-VERVOLG.md`](../qwenpaw/OPDRACHT-VERVOLG.md).

### Acceptatie

- [ ] Agent `boka_operations` heeft skill + persona-bestanden en beantwoordt een administratie-vraag met live data of een gedocumenteerde OFFLINE-probe (commandoutput als bewijs)
- [ ] Geen tweede poller op hetzelfde bot-token (OpenClaw-Telegram alleen uitzetten als die nog pollen; geen NUC-werk voor QwenPaw)
- [ ] Approvals/boekingen gebeuren aantoonbaar nog in de Motor UI (deeplink-flow), niet in Telegram
- [ ] Geen Motor-sessietoken of side-effect-credential in de QwenPaw-config of -omgeving
- [ ] `00-HUIDIGE-STAAT.md` is bijgewerkt met de live metingen van de migratie

### Rollback

Telegram-kanaal in QwenPaw uitzetten (`enabled: false`). Als OpenClaw het token eerder pollen: dat kanaal daar weer aan en token roteren. De read-only skill heeft geen state; er is niets in databases terug te zetten. Geen NUC-stap.

---

## ADR-index (overzicht)

| ID | Onderwerp | Status |
|----|-----------|--------|
| ADR-001 | Qdrant dual-search | ✅ Besloten |
| ADR-002 | SQLite → Postgres cutover | ⚠️ Besloten; M4 gemist |
| ADR-003 | Qdrant unified collectie (optioneel) | ⏸ Open — alleen na ADR-001 evaluatie Q3 2026 |
| ADR-101 | Canonieke engine: Inngest bevestigen vs DBOS | 🟡 Inngest uiterlijk 2026-08-30; DBOS bij trigger uiterlijk 2026-09-13 |
| ADR-102 | Action Gateway scope/NIG-1 | ✅ Besloten; enforcement via ADR-109 |
| ADR-103 | Playbook/Skill-model | ✅ Git besloten; registry bevroren |
| ADR-104 | Motor Kernel | ✅ Event-projectie op Hetzner |
| ADR-105 | Orchestratorconsolidatie | ✅ Besloten |
| ADR-106 | OpenClaw-hardening | ✅ Besloten; runtimebewijs open |
| ADR-107 | Geen tweede memorylaag | ✅ Besloten |
| ADR-108 | Runtime-topologie | ✅ Hetzner durable control |
| ADR-109 | Gateway-enforcementmodel | ✅ Credential-broker/proxy |
| ADR-110 | QwenPaw voor projectadministratie; Telegram verhuist mee | ✅ Besloten 2026-09-08; migratie open |

---

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06-06 | ADR-001 dual-search + ADR-002 Postgres milestones (M0–M6) |
| 2026-06-06 | Sprint 1.3: Qdrant payload schema, master_contexts, PM2 single-instance note |
| 2026-07-27 | ADR-101 t/m ADR-109 geconsolideerd uit Motor AI 2.2 AM-1 t/m AM-5; ADR-108/109 toegevoegd |
| 2026-09-08 | ADR-110 toegevoegd: QwenPaw als assistent-harness voor projectadministratie; Telegram-kanaal verhuist van OpenClaw naar QwenPaw (eigenaarsopdracht) |
| 2026-09-08 | ADR-110 aangescherpt: live instance is agent `boka_operations` in Docker 2.2.0; opdracht stopt niet meer op “niet de NUC”; bookkeeping-URL via probe i.p.v. alleen loopback |
| 2026-09-08 | ADR-110 + ADR-108-amendement: NUC is niet nodig voor QwenPaw-projectadministratie/Telegram; kanaalrol = bestaande Docker-instance |
