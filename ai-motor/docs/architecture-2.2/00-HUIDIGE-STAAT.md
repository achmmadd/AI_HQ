# 00 — Huidige staat Motor AI 2.2

> **Eigenaar:** Pietje
> **Meetdatum:** 2026-07-29
> **Bron:** PR #10 op `master`, merge `aea1344`; historisch, door de eigenaar geaccepteerd auditrapport van 2026-07-29
> **Status:** PR #10 gemerged; Golf 0 **niet groen**; alle runtimeclaims wachten op nieuwe read-only validatie
> **Gerelateerd:** [Master Build Plan](../MASTER-BUILD-PLAN.md) · [ADR-001/002](../DECISIONS.md) · [bindend review-panel](15-review-panel.md)

> **Bewijslimiet:** de ruwe command evidence van het rapport is niet onafhankelijk reproduceerbaar vanuit deze repository. De details hieronder blijven historische, owner-accepted claims en worden read-only opnieuw gevalideerd voordat zij gate-evidence vormen of aan een live actie voorafgaan.

## Uitkomst in één minuut

PR #10 staat op `master`; PR #9 is daarin volledig opgenomen. De owner-assigned targetidentiteiten zijn NUC **Motor AI 2** (`motorai-server2`) en AI-pc **motorai** (`motorai-server`), beide pending latere live G0-revalidatie. Het historische rapport beschrijft een vrijwel lege NUC en een Ryzen 7/RTX 3090-worker zonder NVIDIA-computedriver; dit is geen actuele runtimeclaim.

Eigenaarbesluit 2026-07-30: de legacy-SSD is defect en permanent uitgesloten. Er volgt geen mount, read, copy, recovery, migratie, rijpariteit, `legacy_sqlite_id`-reconciliatie of SQLite-rollback. Dit is geen geslaagde recovery. De clean start geldt uitsluitend voor legacy SQLite.

Het historische rapport beschrijft bestaande Hetzner PostgreSQL- en Qdrant-stores en ernstige transport-, role-, backup- en restoregaten. Die stores zijn strikt no-touch: niet verwijderen, resetten, overschrijven, leeg veronderstellen of stilzwijgend canoniek hergebruiken. PostgreSQL inventory→gekozen versleutelde off-host backup→geïsoleerde restore en Qdrant inventory→apart goedgekeurde snapshot→versleutelde off-host kopie→geïsoleerde restore→latere afzonderlijke digest-pin blijven toekomstige gates.

Repo-feit blijft dat `POSTGRES_PRIMARY` en `SQLITE_FALLBACK` de belangrijkste SQLite-routes niet sturen en de huidige code SQLite read/write kan openen. Dit blokkeert deployment van de schone runtime tot een latere codewijziging het productiepad verwijdert. Kernel en Action Gateway bestaan nog niet als volledige 2.2-componenten.

## Meetmethode en bewijslimiet

De Git-voorcontrole uit het rapport is reproduceerbaar: remote `master` wees naar mergecommit `aea1344` van PR #10. Aanwezigheid en aanroep van code zijn repo-bewijs, geen runtimebewijs.

De eigenaar kent de targetidentiteiten **Motor AI 2** / `motorai-server2` en **motorai** / `motorai-server` toe. Zij gelden niet als live bewezen identiteit vóór G0-revalidatie. De oude namen `openclaw-nuc` en `nuc` zijn geen bewijs voor een actieve tweede machine.

Het rapport stelt dat hostmetingen en PostgreSQL-catalogusqueries strikt read-only waren en geen secretwaarden of modellen lazen. Omdat de ruwe output niet in deze repository reproduceerbaar is, zijn methode en resultaten historische attributie, geen actuele acceptatie.

| Bron | Bewijsstatus |
|---|---|
| Git/repository | Statische inspectie van PR #10 op remote `master`/`aea1344`; aanwezigheid en aanroep van code is bewijs van repo-status, niet van live werking. |
| Motor AI 2 — NUC | Historisch owner-accepted rapport; alle host-, service-, netwerk- en privilegeclaims opnieuw read-only meten. |
| motorai — AI-pc | Historisch owner-accepted rapport; hardware, driver, disk en runtime opnieuw read-only meten zonder model te laden. |
| Hetzner | Historisch owner-accepted rapport; services, stores, roles, listeners en backupstatus opnieuw read-only meten. |
| Publieke ingress en tenanttests | Niet herhaald op 2026-07-29. De Cloudflare 1033/HTTP 530-resultaten van 2026-07-27 blijven historische context, geen actueel bewijs. Live 401/403 en health blijven open gates. |
| Privileged en externe control planes | Tailscale-ACL's/tags, Hetzner-accountbackups, root-only UFW/LVM-data op NUC/AI-pc en externe secretmanagers zijn niet uit de hostsnapshot bewijsbaar: **onbekend, meten door eigenaar/infra-operator**. |

Statussen hieronder betekenen:

- **Repo-af:** het gevraagde code-/documentartefact en de relevante aanroep zijn aangetroffen.
- **Deels:** een bruikbaar deel bestaat, maar niet het volledige acceptatiecriterium.
- **Niet aangetroffen:** gezocht in de huidige branch, zonder passend artefact.
- **Runtime onbekend:** **onbekend, meten door de genoemde eigenaar/operator**.

## Historisch Golf 0-auditrapport — 2026-07-29

### Caller-routebewijs: Motor → PostgreSQL

Het rapport vermeldt drie passieve `pg_stat_activity`-snapshots zonder andere client-backends en geen established TCP/5432-sessie. Deze details blijven historische claims en moeten read-only worden herhaald vóór zij caller-routebewijs vormen.

| Mogelijk pad | Bewijs op 2026-07-29 | Classificatie |
|---|---|---|
| Motor AI 2 → PostgreSQL | Geen Motor/Node/PM2/container/config en geen actieve 5432-sessie | Uitgesloten voor de gemeten staat |
| AI-pc → PostgreSQL | Geen Motor-, database- of inference-runtime en geen actieve 5432-sessie | Uitgesloten voor de gemeten staat |
| Hetzner Docker-internal | `motor-postgres` is de enige container in `motor-hetzner_default` | Geen interne Motor-caller |
| Hetzner-hostruntime/loopback | Geen Motor-service/proces en geen actieve sessie | Niet waargenomen; hoog vertrouwen voor meetmoment |
| Tailscale | Hetzner `NeedsLogin`, zonder Tailscale-IP | Niet operationeel |
| Publiek IPv4 | PostgreSQL bindt breed, maar `DOCKER-USER` dropt nieuw `eth0`-verkeer naar 5432 | Geen huidig pad; gevaarlijke latente configuratie |
| Andere externe client | Buiten scope | Onbekend; geen sessie gezien in het meetvenster |

**Historische conclusie:** tijdens het gerapporteerde meetvenster was geen Motor→PostgreSQL-route aangetoond. Dit is geen actuele gate; intermitterende of externe callers blijven onbekend.

### Node- en runtimeoverzicht

| Rol | Owner-assigned / historisch gerapporteerd | Historisch gerapporteerde staat | Belangrijkste grens |
|---|---|---|---|
| NUC / edge-orchestrator | **Motor AI 2**; host `motorai-server2`; Ubuntu 24.04.4; i5-5250U; 7,6 GiB RAM; 98 GiB rootdisk | Tailscale 1.98.9 en Tailscale SSH actief; geen failed units; alleen SSH en een Tailscale-listener. Docker, Podman, Node, npm, PM2, OpenClaw, Ollama en Motor-processen ontbreken. `/home/motorai2/motorai` is een lege gitwerkboom zonder commits of tracked files. | Geen OpenClaw-, Motor-, Gateway-, policy- of auth-runtime. UFW-regels en volledige sshd-effectieve config vereisen nog goedgekeurde verhoogde read-only verificatie. |
| Always-on kern | **Hetzner**; host `Motor2`; Ubuntu 24.04.4; 15 GiB RAM; 301 GiB rootdisk | Docker, PostgreSQL 16.14, Qdrant, Dify en Bokas-services draaien; Ollama draait als systemd-service. Geen failed units. | Tailscale staat `NeedsLogin`. Engine, Kernel, Gateway en een bewezen private beheerroute ontbreken. Meerdere kernservices binden breder dan Tailscale/loopback-first. |
| Stateless inference-worker | **motorai**; host `motorai-server`; Ubuntu 24.04; Ryzen 7 5800X; 31 GiB RAM; Palit RTX 3090; Samsung 9100 PRO 2 TB | Tailscale SSH actief; geen gewone SSH-, app-, DB- of inference-listener. Geen Docker/Podman/Ollama/vLLM/SGLang of autostart. | RTX 3090 gebruikt `nouveau`; NVIDIA-computedriver, `nvidia-smi` en CUDA ontbreken. Slechts 100 GiB is als root-LV zichtbaar; resterende LVM-capaciteit is zonder verhoogde read-only controle niet bewezen. |
| Legacybron | Oude namen `openclaw-nuc` / `nuc` | Geen actieve identiteit vastgesteld; legacy-SSD defect en uitgesloten | Geen toegang, recovery, migratie, pariteit of rollback; geen bewijs voor Motor AI 2. |

### PostgreSQL, backups, SQLite en secrets

| Controle | Historisch gerapporteerd | Oordeel / toekomstige gate |
|---|---|---|
| PostgreSQL | `motor-postgres`, PostgreSQL 16.14, twee databases, extensies en 7 Drizzle-regels gerapporteerd | Strikt no-touch; read-only inventory, gekozen off-host backup, geïsoleerde restore en expliciete ownerbeslissing vóór reuse. |
| Tenantisolatie | Acht applicatietabellen hebben RLS én `FORCE RLS`, met 2–5 policies per tabel | **Niet effectief voor de huidige app-login:** rol `motor` is `SUPERUSER`, `REPLICATION` en `BYPASSRLS` en bezit de tabellen. Een `NOLOGIN` owner, aparte migrator en tenantgebonden least-privilege app-roles/pools ontbreken; policies vertrouwen bovendien op appcontext die nog niet als niet-forgeerbaar is bewezen. |
| Backup/restore | `/opt/motor/infra/postgres/backup.sh` bestaat; geen Motor-systemd-timer of cronverwijzing gevonden; `archive_mode=off`; geen restore-testbewijs | M1/RPO/RTO niet groen. Externe Hetzner-backups zijn **onbekend, meten door infra-operator**. |
| SQLite | Repo bevat twee lege placeholderbestanden; de legacy-SSD is defect | Permanent uitgesloten: geen mount/read/copy/recovery/migratie/pariteit/rollback. Huidig productie-writepad in code blijft een deploymentblocker. |
| Secretlocaties | `/opt/motor/infra/hetzner/.env` en `/opt/dify/docker/.env`, beide `root:root` mode `0644`; waarden niet gelezen | **Urgente hardening-gap:** lokaal world-readable. Motor-config onder `/opt/motor/infra` heeft bovendien grotendeels verweesd numeriek ownership `1000:1000` en ruime `0775`/`0664` modes. |
| NUC/AI-pc secrets | Geen `.env`, credential-, secret-, PEM- of keybestanden onder de exacte zichtbare Motor-roots; waarden en root-only paden niet gelezen | Geen zichtbare productie-side-effectcredentials op de worker. Volledige afwezigheid blijft zonder root-only inventaris onbewezen. |

### Geprioriteerde blockers

| Prioriteit | Blocker | Eigenaar | Exitbewijs vóór volgende fase |
|---|---|---|---|
| P0 — stap 1 | Geen bewezen PostgreSQL-herstelpad | Infra-operator | Read-only inventory; gekozen versleutelde off-host backup; geïsoleerde restore op passende PG/pgvector-versie; schema-, RLS- en geredigeerde inhoudscontrole. |
| P0 — stap 1 | Geen bewezen Qdrant-herstelpad | Infra-operator | Read-only inventory; later apart goedgekeurde snapshot; versleutelde off-host kopie; geïsoleerde restore; exact het dan actuele digest pas daarna in een afzonderlijke wijziging pinnen. |
| P0 — stap 1 | Off-host bestemming, retentie en key-ownership onbeslist | Pietje + infra-operator | Expliciet gekozen bestemming buiten productie-Hetzner en buiten de stateless AI-pc. Blokkeert live G0/cutover, niet deze documentcorrectie. |
| P0 — stap 2 | Hetzner Tailscale uitgelogd; PostgreSQL bindt `0.0.0.0:5432` met `ssl=off` | Infra-operator + tailnet-eigenaar | Juiste node-identiteit en least-privilege ACL/tag hersteld; PostgreSQL uitsluitend op het Hetzner-Tailscale-IP gepubliceerd; `ssl=on`, `hostssl`, certificaatnaam passend bij de gebruikte tailnet-hostnaam en client `sslmode=verify-full`; NUC-connectie groen; publiek-IP en non-TLS-connectie falen; reboot/Tailscale-late-start faalt gesloten. |
| P0 — stap 3/4 | Huidige PostgreSQL-login omzeilt RLS en de tenantcontext is vrij forgeerbaar | Infra-operator + app-eigenaar | `NOLOGIN` owner, aparte migrator en per workspace een tenantgebonden least-privilege app-role/pool; RLS vertrouwt `current_user` of een gelijkwaardig niet-client-schrijfbaar kenmerk, nooit alleen vrij `SET app.workspace_id`; same-tenant succes, unauth 401, cross-tenant 403, directe negatieve SQL-tests, pool-reuse en adversariële contextswitch groen. |
| P0 — stap 3 | Motor- en Dify-`.env` zijn mode `0644` | Infra-operator | Goedgekeurd rotatie-/permissieplan, minimale modes/ownership en bewijs zonder waarden te loggen; oude appcredential pas intrekken na stap-4-canary. |
| P0 — stap 4 | Huidige code kan productie-SQLite openen/schrijven; Motor/OpenClaw/Gateway/policy/auth zijn niet live bewezen | Eigenaar + platform | Latere codewijziging verwijdert het productie-SQLite-pad; canary bewijst versiepin, bind/auth/origins/allowlist, fail-closed policy, integration-readiness en de volledige M5-suite. |
| P1 | SSH/privileges zijn ruimer dan doelontwerp | Infra-operator + eigenaar | Root-SSH/forwarding op Hetzner herzien; `lxd`/`sudo`/`adm`, X11 en tailnet-ACL's op NUC/worker expliciet beargumenteren of beperken. |
| Deferred — stap 5 | AI-pc gebruikt `nouveau`; opslag- en privileged netwerkbewijs ontbreken | Eigenaar + infra-operator | Bewuste veilige ruststand tot Gateway/policy. Daarna afzonderlijk goedgekeurde driver/reboot, `nvidia-smi`, computetest, modelvolume, firewall/listeners en worker-runbook. Geen voorwaarde voor Golf 0. |

### Goedgekeurde clean-start-volgorde en gates

| Stap | Werk en eigenaar | Acceptance gate | Stop-/rollbackgedrag |
|---|---|---|---|
| **0 — revalidatie** | Infra/Security valideert owner-assigned nodes, runtime en caller-route opnieuw read-only | Nieuwe gesaniteerde evidence; historisch rapport is geen actuele gate | Geen netwerkpad of runtimefeit aannemen op basis van het oude meetvenster |
| **1 — store-herstelpaden** | Infra bewijst afzonderlijk PostgreSQL- en Qdrant-inventory, off-host backup/kopie en geïsoleerde restore | Manifest/checksum, geredigeerde inhoudscontrole en RPO/RTO-bewijs; Qdrant digest-pin blijft apart | Bij ontbrekende bestemming of mislukte restore: stoppen; stores blijven no-touch |
| **2 — private transport** | Infra-operator + tailnet-eigenaar herstellen Hetzner-Tailscale, least-privilege ACL's, private PostgreSQL-bind en TLS | NUC→PostgreSQL werkt met `sslmode=verify-full`; alleen noodzakelijke private paden werken; publiek, non-TLS en AI-pc→data-plane falen | Bij Tailscale-, bind- of certificaatfalen blijft Motor unavailable/degraded; nooit publieke 5432 of TLS-uit als rollback |
| **3 — identities & secrets voorbereiden** | Infra-operator + app-eigenaar maken owner/migrator/tenant-app-roles naast de oude role en herstellen/roteren secretlocaties | Role flags, ownership, grants en synthetische SQL-isolatie groen; nieuwe secrets alleen in canaryscope; oude credential nog niet ingetrokken | Bij grant/credentialfout geen app-cutover; minimale grants herstellen, nooit een nieuwe Motor-runtime op de superusercredential zetten |
| **4 — clean canary en Golf 0 sluiten** | Pietje beslist eerst reuse/quarantaine/decommissioning van gerapporteerde stores; platform gebruikt daarna productie-SQLite-vrije code en tenantpools | Same-tenant 2xx; unauth 401; cross-tenant 403; directe SQL-isolatie; transactiegebonden context; adversariële context-switch; pool-reuse; OpenClaw- en readinessbewijs | Mislukte canary sluit G0 niet; stores blijven no-touch en herstel loopt alleen via bewezen off-host paden |
| **5 — inference-worker** | AI/Infra activeren de stateless AI-pc pas na eigen runbook en Gateway/policy | Driver/compute/failover/monitoring groen; 2 TB alleen model/cache/scratch; geen direct DB/Qdrant-pad | Worker uitregistreren; control/data-plane blijft functioneren |

**Golf 0 blijft rood tijdens stap 1–3 en kan niet vóór volledige acceptatie van stap 4 worden gesloten.** De open 401/403-, cross-tenant-, integration-readiness- en OpenClaw-bewijzen vereisen immers een draaiende Motor-runtime. De AI-pc is een afzonderlijke deferred worker-gate en blokkeert Golf 0 niet.

**Historische auditverklaring:** volgens het owner-accepted rapport zijn geen host-, service-, database-, credential- of modelwijzigingen uitgevoerd. Ook deze verklaring vereist revalidatie voordat zij als gate-evidence wordt gebruikt.

## Golf 0 en Fase 0

| Item | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| 0.1.1 Qdrant dual-search | Ingest- en scrape-collecties via één naamlogica doorzoeken | **Repo-af:** `lib/qdrant-collection.ts` is de naam-SSOT; `lib/knowledge-service.ts` zoekt beide collecties en mergeert op score | Qdrant draait op Hetzner; collectie- en hit-counts zijn **onbekend, meten door infra-operator** | Code en service bestaan; data-aanwezigheid en een echte chat-treffer zijn niet bewezen |
| 0.1.2 Qdrant-migratie | Legacy vectors naar scoped buckets migreren | **Repo-af:** `scripts/qdrant-migrate-collections.mjs` bestaat met dry-run en expliciete delete-optie | **onbekend, meten door eigenaar op Hetzner** | Geen log, marker of snapshot gevonden die bewijst dat het script is gedraaid |
| 0.1.3 UI-labels | Actuele collectienamen tonen, niet hardcoden | **Repo-af:** `kennisbank-file-ingest.tsx` haalt `qdrant_collections` uit de catalog-API; alleen de foutfallback is generiek | **onbekend, meten door eigenaar op NUC** | Live catalog-response en rendering niet gezien |
| 0.1.4 Qdrant-env | Canonieke env-vars documenteren | **Repo-af:** `.env.example`, `docs/model-config.md` en ADR-001 bevatten prefix/scoped configuratie | N.v.t. | Geen afwijking in de repo |
| 0.2.1 `knowledge_documents` | Persistente, querybare tabel | **Repo-af:** SQLite-schema in `lib/db/platform-schema.ts`, PG-schema/migratie en catalog/ingest-routes aanwezig | PostgreSQL-schema en 7 migratieregels zijn live; Motor-app op de NUC ontbreekt; tabelinhoud/querybaarheid is **onbekend, meten door eigenaar/infra-operator** | Schema en migratieregister zijn geen bewijs van gevulde, end-to-end querybare kennis |
| 0.2.2 chat/conversations-auth | Niet publiek; zonder sessie 401 | **Repo-af:** beide families ontbreken in `PUBLIC_PATHS`; middleware geeft 401; routes gebruiken daarnaast `requireApiAuthForKlant` | Motor-app staat niet op Motor AI 2; live 401 niet herhaald | De claim in doc 01 dat deze paden nog publiek zijn is verouderd. Bewuste uitzondering: `/api/chat/bridge/*`; runtimegate blijft rood |
| 0.2.3 server-side scope | Cross-tenant verzoek wordt 403 | **Repo-af:** `assertScopeAccess` en `requireApiAuthForKlant` worden door relevante routes gebruikt | **onbekend, meten door eigenaar op NUC** met fumero→bokas-test | Geen opgeslagen groen cross-tenant testresultaat |
| 0.2.4 scope in chatrequest | `klant` tegen sessiescope valideren | **Repo-af:** `/api/chat/stream` valideert vóór uitvoering | **onbekend, meten door eigenaar op NUC** | Code aanwezig; productiegedrag niet bewezen |
| 0.3.1 approvals-inbox | Cowork-inbox en health/status beschikbaar | **Repo-af:** redirect, inbox-count en approvals-route aanwezig | **onbekend, meten door eigenaar op NUC** | UI- en Telegram-keten niet live gemeten |
| 0.3.2 bookkeeping-degradatie | Bij `:8001` down geen lege crash | **Repo-af:** `lib/bookkeeping-bot.ts` retourneert expliciete offline-status/fallback | **onbekend, meten door eigenaar op NUC** | Faalproef met bookkeeping-bot uit is niet vastgelegd |
| 0.3.3 healthdashboard | Qdrant, bookkeeping en OpenClaw op één pagina | **Repo-af:** integration-readiness API en devpagina bevatten de probes | Motor-app en OpenClaw staan niet op Motor AI 2; publieke health niet herhaald | Probe-code bestaat, maar er is nog geen deployde NUC-runtime om groen te meten |
| 0.3.4 smoke/verify | Reproduceerbare live verificatie | **Repo-af:** `smoke-quality.mjs`, `verify-live.sh` en `e2e-hybrid.mjs` bestaan | **onbekend, meten door eigenaar op NUC** | Geen recente uitvoer aangetroffen |
| Secrets-inventaris | Weten waar credentials leven; verweesde keys weg | Geen actuele registry in de repo | **Historisch gerapporteerd:** twee Hetzner-`.env`-locaties met mode `0644`; geen zichtbare Motor-secrets onder de genoemde NUC/worker-roots; waarden niet gelezen | Locaties, ownership en permissies opnieuw read-only valideren; rotatie en secrets-manager-migratie staan open |

### Specifieke controle: `PUBLIC_PATHS`

| Routefamilie | Huidige repo-uitkomst |
|---|---|
| `/api/chat/*` | **Niet** algemeen publiek. Alleen de expliciete PC-bridge-uitzondering `/api/chat/bridge/*` passeert de edge-sessiegate. |
| `/api/conversations/*` | **Niet** publiek. Middleware en routehandlers vereisen auth; routehandlers doen tevens een tenantcheck. |
| `/api/message-feedback` | Wel expliciet publiek; valt buiten de twee gevraagde routefamilies en is in deze nulmeting niet verder beoordeeld. |
| `/api/inngest/*` | Wel expliciet publiek voor Inngest-callbacks; authenticiteit hoort door Inngest-signing te worden afgedwongen zodra de integratie actief is. |

### ADR-106: OpenClaw-hardening

| Vereiste uit ADR-106 | Repo zegt | Draait | Oordeel |
|---|---|---|---|
| Versie met CVE-fixes | Geen serverversie-pin of actuele versie-uitvoer gevonden | OpenClaw is niet geïnstalleerd op Motor AI 2 | Niet operationeel; versiepin is een pre-deploygate |
| Token-auth | Motor-client ondersteunt `OPENCLAW_GATEWAY_TOKEN`, maar een lege token blijft toegestaan | Geen OpenClaw-server of Motor-clientruntime op Motor AI 2 | Niet operationeel; fail-closed tokencheck moet vóór deployment worden ontworpen en getest |
| Loopback + Tailscale-only | Clientdefault is `127.0.0.1:18789`; geen bind-/firewallconfig van de Gateway gevonden | Geen listener op 18789; alleen SSH/Tailscale-listeners | Momenteel niet blootgesteld, maar de vereiste bind is nog niet als deploymentconfig aanwezig |
| WebSocket-originvalidatie | Geen OpenClaw-serverconfig gevonden | Geen OpenClaw-server op Motor AI 2 | Niet operationeel; pre-deploygate |
| Skills-allowlist uit eigen git | Geen complete, actieve allowlistconfig aangetroffen | Geen skills of OpenClaw-root op Motor AI 2 | Niet operationeel; pre-deploygate |
| Side effects via Action Gateway | Action Gateway bestaat nog niet als component | Nee in repo | Niet geïmplementeerd |
| Canonieke ADR | ADR-101–109 staan in `DECISIONS.md`; doc 07 §30 is index-only | N.v.t. | Gespiegeld; runtimebewijs voor ADR-101/106 blijft open |

**Golf 0-eindoordeel:** de repo-items voor kennisbank, schema en auth zijn grotendeels aanwezig. Golf 0 is **niet af**: runtimeclaims moeten opnieuw worden gemeten, store-herstelpaden en M5 zijn niet bewezen, het productie-SQLite-codepad staat nog open en live 401/403-/healthbewijs ontbreekt. De AI-pc blijft een afzonderlijke deferred gate.

## ADR-002 — SQLite naar Postgres

### Feature flags en werkelijk effect

| Variabele | Template/default | Werkelijke productiewaarde | Werkelijk code-effect | Verschil met ADR-002 |
|---|---|---|---|---|
| `USE_POSTGRES` | `0` / false | **onbekend, meten door eigenaar op NUC** | Zet gedeeltelijke PG-paden aan; dual-write bestaat voor onder meer auth, audit en usage, niet voor alle tenantdata | “Dual-write” is niet volledig voor chat, approvals en knowledge |
| `POSTGRES_PRIMARY` | `0` / false | **onbekend, meten door eigenaar op NUC** | `isPostgresPrimary()` bestaat, maar wordt buiten `pg-flags.ts` niet gebruikt voor read/write-routing; `shouldUsePostgres()` opent alleen aanvullende PG-paden | Ook bij waarde `1` blijven belangrijke routes direct SQLite lezen en schrijven |
| `SQLITE_FALLBACK` | `1`; unset betekent fallback aan | **onbekend, meten door eigenaar op NUC** | `sqliteFallbackDisabled()` bestaat, maar wordt nergens aangeroepen | Waarde `0` schakelt SQLite in de huidige code niet uit |
| `DATABASE_URL` | Placeholder naar `hetzner-motor` | **onbekend, meten door eigenaar op NUC** | Vereist voor Drizzle, migratie en PG-probes | Connectiviteit en doelcluster niet bewezen |

`lib/db/database.ts` opent altijd `$HOME/AI_HQ/data/ai-motor.db` read/write. Onder andere chat en conversations schrijven rechtstreeks via `better-sqlite3`. De M4-claim “Postgres primair, SQLite read-only” is daardoor niet gerealiseerd in de huidige code.

### Milestones

| Milestone | Plan zegt | Repo zegt | Draait | Verschil / status op 2026-07-29 |
|---|---|---|---|---|
| M0 — geen nieuwe SQLite-only tabellen | Vanaf 2026-06-20 | Voor kerndata bestaan PG-schema’s, maar er is geen gate die nieuwe SQLite-only tabellen voorkomt | **onbekend, meten door eigenaar/reviewer via historie** | Niet aantoonbaar afgerond uit alleen deze snapshot |
| M1 — Postgres live | 2026-06-28 | Compose, init en backupscript bestaan | `motor-postgres` is gezond; Tailscale is uitgelogd; geen geplande Motor-backup of restore-test bewezen | **Deels, niet gehaald:** proces live, maar private bereikbaarheid en backup/restore ontbreken |
| M2 — dual-write aan | 2026-07-05 | Gedeeltelijk geïmplementeerd; template staat standaard uit | Niet uitvoeren | **Geannuleerd; nooit gehaald** |
| M3 — legacy-SQLite migreren | 2026-07-19 | Migratiescript bestaat in de repo | Niet uitvoeren | **Geannuleerd; nooit gehaald; geen parity of legacy-ID-reconciliatie** |
| M4 — PostgreSQL canonieke store | 2026-07-26 | Primary/fallback-flags sturen SQLite-routes niet; productie-SQLite blijft mogelijk | Toekomstige gate na inventory/restore en ownerbesluit | **Niet gehaald; clean runtime vereist latere codewijziging** |
| M5 — RLS productie | 2026-08-02 | RLS-migraties en workspace-contextcode bestaan | Acht app-tabellen hebben RLS + `FORCE RLS`, maar login `motor` is owner/superuser/`BYPASSRLS`; tenant-GUC is niet als niet-forgeerbaar bewezen; API-, directe SQL-, context-switch- en pooltests ontbreken | **Niet gehaald:** policies bestaan, maar runtime-identiteit en tenantbinding maken ze niet effectief |
| M6 — SQLite uit productie | 2026-08-09 | Uitschakelflag heeft geen caller; SQLite blijft read/write openen | Voorwaarde vóór clean deployment | **Niet gehaald; latere codewijziging vereist** |

### Datastores en clean-start-bewijs

| Store | Repo/historisch rapport | Conclusie |
|---|---|---|
| Legacy-SQLite | SSD defect en door eigenaar permanent uitgesloten | Geen toegang, recovery, migratie, pariteit of rollback; geen geslaagde recovery claimen |
| PostgreSQL op Hetzner | Bestaande store historisch gerapporteerd; repo bevat schema/config | No-touch tot read-only inventory, gekozen off-host backup, geïsoleerde restore en expliciet ownerbesluit |
| Qdrant op Hetzner | Bestaande store historisch gerapporteerd; repo bevat clients/config | No-touch tot inventory, snapshot, off-host kopie, geïsoleerde restore; digest-pin later apart |
| `ai-motor/motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |
| `ai-motor/lib/db/ai-motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |

## Welke 2.2-componenten bestaan werkelijk?

De kolom “Draait” hieronder citeert het historische rapport en vereist live revalidatie; de repo-kolom blijft statisch bewijs.

| Component | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| Motor Kernel | PG `tasks`, append-only `task_events`, approvals en lifecycle-API | Geen Kernel-module, `/api/kernel`, PG-`tasks` of `task_events`; wel legacy SQLite `automation_tasks`/`automation_runs` en approvals | Geen Motor-runtime op Motor AI 2 en geen Kernel-service op Hetzner aangetroffen | **2.2-Kernel bestaat niet** |
| Action Gateway | Centrale policy- en credential-broker vóór side effects | Geen Gateway-route, risicoklassen, argument-hash, reservering/settlement of centrale credential-broker; alleen lokale budget/policy-fragmenten | Nee als 2.2-component | **Bestaat niet** |
| Playbook-registry | Git-playbooks plus versie/status/tenant | Geen `playbooks/`-registry of PG-register; `motor_skills` is een SQLite prompt-/skilltabel en `motor-test-playbook.md` is een handmatig logboek | Nee als 2.2-component | **Bestaat niet**; bovendien bevroren door AM-1 |
| Canonieke engine | Eén gekozen engine; n8n alleen adapter | Inngest-dependency, serve-route, events en één `approval-hitl`-functie bestaan; n8n en SQLite-cron blijven feitelijke orchestrators | Geen Motor-engine op Motor AI 2/Hetzner aangetroffen; geen actieve standalone n8n | Geen canonieke engine gekozen of bewezen |
| `lib/inngest/` | Durable enginebasis | Meer dan een lege skeleton: approvals emitten events en één workflow doet `waitForEvent`; zonder keys wordt verzenden bewust no-op. Relay/reminder-events hebben geen eigen handler | Niet gedeployd op Motor AI 2; externe Inngest-status niet gemeten | **Gedeeltelijk geïntegreerde pilot, niet de engine** |
| Adapters/executors | Achter Kernel/Gateway | OpenClaw-, n8n-, local-executor-, PC-bridge-, browser- en automation-adapters bestaan verspreid | Niet gedeployd op de nieuwe NUC; AI-pc bewust leeg | Bruikbare code, maar geen centrale dispatch/policy |
| Evidence/observability | Taskgebonden evidence, traces en audit | Langfuse-chat-tracing, audit- en usagepaden bestaan; geen taskgebonden evidence-model of Gateway-beslislog | Geen Motor-runtime of monitoringhub aangetroffen | Deels in repo, niet live als 2.2-keten |
| DBOS/Temporal/Restate/Hatchet | Alleen kandidaten/referenties | Geen applicatie-integratie aangetroffen | Nee | Geen verborgen tweede engine in code |

## State-stores die de repo werkelijk ondersteunt

De repo bevestigt meer dan zes persistentiemechanismen of externe state-eigenaren. Hij bewijst niet dat ze allemaal tegelijk live zijn.

| Store / waarheid | Repo zegt | Historisch gerapporteerde status | SoT-probleem |
|---|---|---|---|
| ai-motor SQLite | Code opent read/write voor chat, conversations, approvals, automation en meer | Niet aangetroffen op de gerapporteerde NUC-root | Starten van huidige code creëert opnieuw SQLite-state; clean deployment blijft geblokkeerd |
| Postgres/Drizzle | Workspace-, tenant-, audit-, usage- en master-contextschema’s | PostgreSQL 16.14 en 7 Drizzle-regels gerapporteerd | No-touch; geen SSOT-claim vóór inventory, restore, M5 en ownerbesluit |
| Qdrant | Kennisbank- en memorycollecties via externe service | Losse container op mutable tag en oud volume gerapporteerd | No-touch; ownership, inhoud en herstelbaarheid opnieuw bewijzen |
| Filesystem | Uploads, assets, campaignpacks en projectbestanden onder `$HOME/AI_HQ` | Nieuwe NUC-root als leeg gerapporteerd | Persistente blobs vereisen een aparte bron- en backupinventaris; geen legacy-SSD-toegang |
| Inngest run-state | Externe durable state zodra keys actief zijn | Geen Motor-runtime op de NUC; externe control-plane-status niet gemeten | Approval-state blijft in repo daarnaast SQLite-gebaseerd |
| n8n interne state | Veel actieve webhook-/automation-aanroepen in code | Geen actieve standalone n8n op de drie gemeten nodes aangetroffen | Codeafhankelijkheden moeten vóór enginekeuze worden gereconcilieerd |
| Dify interne state | Builder/artifact-integratie en deploydocumentatie aanwezig | Dify-stack 1.13.3 live onder `/opt/dify/docker` | Geplande decommissioning; exit/migratie en te ruime `.env`-permissies staan open |
| Langfuse Cloud | Optionele chat-traces | **onbekend, meten door eigenaar** | Extra observability-store; DPA/retentie niet live bewezen |
| Browser-localStorage | Zustand-stores voor UI-voorkeuren | Alleen client-side | Geen server-SSOT, wel gebruikersstate |
| `EXECUTION_BOARD.db` | Getrackt legacybestand: 20.480 bytes, tabellen `projects` en `tasks`, beide 0 rijen | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Leeg in Git, maar code/legacy kan elders een kopie gebruiken |
| Chroma legacy | `db/chroma.sqlite3`: 2 collecties; `factory_brains/chroma.sqlite3`: 1 collectie | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Tweede/derde vectorwaarheid blijft als legacy aanwezig |
| `omega_db` | Legacy Python-code verwijst naar eigen DB | Geen productiebestand onder de exact genoemde Motor AI 2-root; legacylocaties buiten scope blijven **onbekend, meten door eigenaar** | Nog een mogelijke legacy-taakwaarheid, niet actief op de nieuwe NUC aangetroffen |

## Historisch gerapporteerde services op NUC, Hetzner en inference-PC

Onderstaande tabellen bewaren het owner-accepted rapport van 2026-07-29. Geen regel is actuele gate-evidence zonder nieuwe read-only validatie.

### NUC — Motor AI 2

| Service | Plan/config zegt | Draait | Verschil |
|---|---|---|---|
| Tailscale / beheer | Tailscale-only beheerroute | Tailscale 1.98.9 en Tailscale SSH actief; geen subnetroutes/services geadverteerd | Positieve basis; ACL/tag/device ownership en `ShieldsUp=false` nog beoordelen |
| Motor Next.js | PM2 `ai-motor`, poort 3040, één instance | Afwezig; Node/npm/PM2 ontbreken | Nog niet gedeployd |
| local-executor | PM2 `local-executor`, poort 8790 | Afwezig | Nog niet gedeployd |
| OpenClaw gateway | Poort 18789, gehardened | Afwezig; geen unit, proces, container, root of listener | Nog niet gedeployd; alle ADR-106-gates staan open |
| bookkeeping-bot | Poort 8001 | Afwezig | Nog niet gedeployd |
| Cloudflare Tunnel | `motorsai.app` naar Motor | Geen tunnelunit/proces aangetroffen op Motor AI 2; publieke route niet herhaald | Ingressplan en origin moeten vóór deployment expliciet worden vastgesteld |
| Legacy omega/n8n/Qdrant/Ollama-containers | Geen legacy runtime op de nieuwe NUC | Docker/Podman/Ollama ontbreken; geen legacyprocessen | Positief: schone basis, geen verborgen tweede topologie |
| SSH/firewall | Headless en alleen via private beheergrens | SSH luistert op alle IPv4/IPv6-interfaces; Tailscale SSH actief; UFW actief, regels zonder sudo niet leesbaar | X11 staat aan; user zit in `sudo` en `lxd`; exacte SSH/UFW-hardening blijft open |

### Hetzner

| Service | Plan/config zegt | Draait | Verschil |
|---|---|---|---|
| Tailscale / beheer | Private mesh en Tailscale-only kernbereikbaarheid | `tailscaled` draait, maar status is `NeedsLogin` en er is geen actuele Tailscale-IP | Harde drift; private beheer- en servicepaden zijn niet groen |
| Postgres | `motor-postgres`, core, poort 5432 uitsluitend private + TLS | Container gezond; PostgreSQL 16.14; nu `0.0.0.0:5432`, `ssl=off`; publiek `eth0` alleen door `DOCKER-USER` gedropt; geen actieve Motor-client gezien | **Stap-2-blocker:** bind naar het Hetzner-Tailscale-IP, TLS verplicht met `sslmode=verify-full`, non-TLS/public weigeren en negatieve tests opslaan. Bij Tailscale- of certificaatfalen blijft Motor degraded; geen publieke fallback |
| Qdrant | `motor-qdrant`, core, poort 6333 | Live als losse `qdrant`-container op `6333/6334`, `latest`, root en oud `qdrant_storage`-volume; publiek `eth0` door `DOCKER-USER` gedropt | Stap 1: inventaris + snapshot + geïsoleerde restore op huidig digest, daarna exact dat digest pinnen. Compose-/ownership-/volumemigratie blijft een aparte latere wijziging |
| Ollama embed | `motor-ollama`, core, poort 11434 | Actieve systemd-service, bind `*:11434`; voorbereid Motor-volume ongebruikt; modelaanwezigheid bewust niet opgevraagd | Buiten unified compose en breder gebonden dan doel |
| LiteLLM | Optioneel compose-profiel, poort 4000 | Geen actieve service/container in de live inventaris aangetroffen | Named routes en providerfailover niet live |
| n8n | Optioneel compose-profiel, poort 5678 | Geen actieve standalone n8n-service/container in de live inventaris aangetroffen | Code gebruikt n8n breed; actuele uitvoeringsroute moet worden gereconcilieerd |
| Dify | Losse stack onder `/opt/dify/docker` | Dify 1.13.3-stack live | Niet in unified compose; `.env` te ruim leesbaar; exitplan blijft open |
| Engine/Kernel/Gateway | AM-3 plaatst ze hier, co-located met PG | Niet als volledige componenten in repo | Target, geen huidige runtime |
| Monitoringhub | AM-3: Uptime Kuma/Beszel-hub op Hetzner | Geen Kuma/Beszel-hub in de geïnspecteerde service-/containerlijst aangetroffen | Target, niet bewezen live |
| SSH/firewall | Key-only en private beheerroute | Publieke key-only root-SSH; password en keyboard-interactive uit; X11 en TCP-forwarding aan | Geen wachtwoordauth is positief; root/forwarding en publieke beheerroute zijn ruimer dan doel |

### Inference-PC

| Onderdeel | Plan zegt | Huidige staat | Open punt |
|---|---|---|---|
| Hardware/OS | Ryzen 7, 32 GB, RTX 3090, Ubuntu LTS headless | Ryzen 7 5800X, 31 GiB RAM, Palit RTX 3090, Ubuntu 24.04 en 2 TB gerapporteerd | Pending live revalidatie |
| GPU-runtime | Gepinde NVIDIA-computedriver en meetbare 24 GiB VRAM | `nouveau` actief; NVIDIA-driver, `nvidia-smi` en CUDA ontbreken | **Deferred guardrail:** bewust niet inference-klaar; driverwijziging pas in stap 5 apart goedkeuren en na reboot verifiëren |
| Rol | Stateless inference-worker in execution plane; alleen via Tailscale/LiteLLM | Tailscale SSH actief; geen apps, containers, modellen, DB of inference-autostart | Correct veilig gehouden; geen taak vóór Gateway/policy |
| Locatie | Prompt laat dit bewust open | **onbekend, bevestigen door eigenaar** | Vastleggen vóór ingebruikname; bepaalt single-site-risico |
| Voeding | Doc 12 adviseert ≥850 W en twee aparte PCIe-kabels | **onbekend, bevestigen door eigenaar** | Bevestigen vóór GPU-belasting |
| Opslag | Doc 12 adviseert 1–2 TB NVMe | 2 TB gerapporteerd; indeling niet actueel bewezen | Alleen model/cache/scratch; nooit de enige of permanente backuplocatie |
| Netwerk/firewall | Tailscale-only workerverkeer | Tailscale 1.98.9/SSH actief; geen gewone SSH- of applistener; UFW actief maar regels zonder sudo niet leesbaar | ACL/tag en volledige privileged listener/firewallcheck open |
| Runbook/monitoring | Tailscale-only, Beszel-agent, failovertest en inference-worker-runbook | Geen worker-runtime of Beszel aangetroffen; `systemd-networkd-wait-online` failed | Runbook, boot-health en monitoring vóór registratie vereist |

## Nog uit te voeren read-only revalidatie en latere live gates

Alle runtimeclaims worden eerst opnieuw read-only gevalideerd. Latere snapshots, restores, wijzigingen en tests zijn afzonderlijke live acties en vereisen eigen goedkeuring; de legacy-SSD blijft permanent buiten scope.

| Open meting | Waarom open | Operator / bewijs |
|---|---|---|
| Owner-assigned node-identiteiten en runtime | Historisch rapport is niet zelfstandig reproduceerbaar | Eigenaar/infra-operator levert nieuwe gesaniteerde read-only evidence |
| NUC: effectieve sshd-config en UFW/nft-regels | `sudo -n` vereiste een wachtwoord; er is niet geïnteracteerd | Eigenaar/infra-operator met goedgekeurde verhoogde read-only sessie; alleen gefilterde effectieve properties en regelmetadata |
| AI-pc: volledige listeners/firewall en vrije LVM-capaciteit | Root-LV is zichtbaar, VG-free en privileged process-attributie niet | Infra-operator met goedgekeurde verhoogde read-only sessie |
| Tailnet ACL's, tags, device ownership en key expiry | Niet volledig bewijsbaar vanuit nodeprefs | Tailnet-eigenaar via control-plane-export zonder authkeys/tokens |
| Off-host bestemming, retentie en key-ownership | Niet gekozen | Pietje besluit; blokkeert live G0/cutover, niet deze documentcorrectie |
| PostgreSQL inventory en herstelpad | Bestaande store alleen historisch gerapporteerd | Eerst read-only inventory; daarna apart goedgekeurde off-host backup en geïsoleerde restore |
| Qdrant inventory en herstelpad | Bestaande store alleen historisch gerapporteerd | Eerst read-only inventory; daarna apart goedgekeurde snapshot, off-host kopie, restore en latere digest-pin |
| Motor/OpenClaw-versie, bind, token, origins, pairing, allowlist | Runtime ontbreekt op Motor AI 2 | Pas na goedgekeurd deploymentplan; configuratiemetadata plus negatieve authtests |
| Live 401/403, health, knowledge-hit, M5 en smoke | Motor-runtime ontbreekt | App-eigenaar in stap 4; machineleesbare testoutput met tenant-negative SQL/API- en context-switchcases |
| AI-pc locatie, voeding en bekabeling | Niet via SSH te bewijzen | Eigenaar bevestigt fysiek vóór driverbelasting |

## Uitvoeringsgrens

Pietje heeft op 2026-07-30 uitsluitend deze twee-file documentcorrectie geautoriseerd. Geen live stap, merge of ready-for-review is toegestaan. Iedere belangrijke beslissing en live actie krijgt aparte expliciete goedkeuring.

De bestaande [`fase1-postgres.md`](../fase1-postgres.md), [`nuc-readiness.md`](../nuc-readiness.md) en [`hybrid-env.md`](../hybrid-env.md) bevatten nog pre-amendementvoorbeelden met één gedeelde `motor`-credential, verbinding zonder `sslmode=verify-full` en/of een veronderstelde volledige SQLite-rollbackkopie. Tot een afzonderlijk goedgekeurde doccorrectie zijn die passages **niet uitvoerbaar**; het ADR-002-amendement in [`DECISIONS.md`](../DECISIONS.md) is leidend.

De repository-baseline van 2026-07-27 en het owner-accepted auditrapport van 2026-07-29 blijven historische context. Documentatie alleen is geen acceptatiebewijs. Een toekomstige Claude-P0 mag alleen na verplichte secret-/PII-redactie in de PR-body worden overgenomen; `[REDACTED]` verlaagt de ernst niet. PR #11 blijft draft en iedere merge vereist Pietjes verse expliciete goedkeuring op de nieuwe head-SHA nadat CI en reviews zijn afgerond.
