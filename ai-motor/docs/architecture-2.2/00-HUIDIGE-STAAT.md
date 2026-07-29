# 00 — Huidige staat Motor AI 2.2

> **Eigenaar:** Pietje
> **Meetdatum:** 2026-07-29
> **Bron:** PR #10 op `master`, merge `aea1344`; live strict-read-only SSH-nulmeting en passieve caller-routecontrole van MotorAI 2, motorai en Hetzner
> **Status:** PR #10 gemerged; Golf 0 live gemeten maar **niet groen** en kan pas in herstelstap 4 sluiten; Golf 1 en inference-activering geblokkeerd
> **Gerelateerd:** [Master Build Plan](../MASTER-BUILD-PLAN.md) · [ADR-001/002](../DECISIONS.md) · [bindend review-panel](15-review-panel.md)

> **Actueel live bewijs tot en met:** **2026-08-28**, tenzij eerder geïnvalideerd door een host-rebuild; OS-, kernel-, container- of service-restart/wijziging; Tailscale re-auth/ACL/tag/key-wijziging; firewall-, bind-, listener- of TLS-wijziging; secretrotatie/permissiewijziging; PostgreSQL-role/RLS/schema/migratie/restore; Qdrant-image/volume/collectie/snapshot/restore; Motor/OpenClaw-deployment; of NVIDIA-driver/worker-runtime/reboot. Na invalidatie blijft dit historisch bewijs van 2026-07-29, maar mag het niet als actuele gate-evidence worden geciteerd.

## Uitkomst in één minuut

PR #10 staat op `master`; PR #9 is daarin volledig opgenomen en is niet apart gemerged. De nieuwe NUC **MotorAI 2** (`motorai-server2`) en de AI-pc **motorai** (`motorai-server`) zijn via hun vooraf vertrouwde Tailscale/SSH-identiteit live gemeten. MotorAI 2 is een vrijwel lege Ubuntu-basis: Tailscale SSH draait, maar Motor, OpenClaw, Node, PM2 en containers ontbreken. De AI-pc bevat de Ryzen 7 5800X en RTX 3090, maar gebruikt `nouveau`; de NVIDIA-computedriver en `nvidia-smi` ontbreken, dus inference is nog niet mogelijk en er is geen model gestart.

Hetzner draait onder meer PostgreSQL, Qdrant, Ollama en Dify, maar wijkt op cruciale punten af van het doelontwerp. Een aanvullende passieve controle vond gedurende circa 37 seconden geen Motor-client in drie PostgreSQL-snapshots en geen established TCP/5432-sessie. Op de drie gemeten machines is bovendien geen Motor-runtime gevonden. De best onderbouwde actuele conclusie is daarom: **er is geen werkend Motor→Postgres-pad**. Dit sluit een historische of kortstondige externe client buiten het meetvenster niet uit.

Tailscale staat op Hetzner uitgelogd. PostgreSQL publiceert nu `0.0.0.0:5432`, heeft `ssl=off` en accepteert remote SCRAM-auth; alleen de huidige `DOCKER-USER`-drop blokkeert nieuw publiek verkeer. De enige Motor-loginrol is tegelijk superuser, tabeleigenaar en `BYPASSRLS`, waardoor de aanwezige RLS-policies de huidige identiteit niet isoleren. Voor Motor Postgres is geen actieve geplande backup of restore-test bewezen. Qdrant draait buiten de Motor-compose, als root, op een mutable `latest`-tag en een ouder volume. Op de niet-benaderde oude NUC staat waarschijnlijk de enige actuele bedrijfsstate in `~/AI_HQ/data/ai-motor.db`; dit is een hypothese uit het altijd-writebare codepad, geen gemeten feit. Die bron moet vóór vervanging read-only en consistent worden veiliggesteld.

De repo-items voor kennisbank en API-auth blijven grotendeels aanwezig, maar de verplichte live 401/403-/healthtests zijn op 2026-07-29 niet herhaald. M4 “Postgres SSOT” blijft in de code niet bereikt, omdat `POSTGRES_PRIMARY` en `SQLITE_FALLBACK` de belangrijkste SQLite-routes niet sturen. Kernel, Action Gateway en Playbook-registry bestaan nog niet als volledige 2.2-componenten. Golf 0 blijft daarom structureel rood tijdens herstelstappen 1–3 en kan pas sluiten wanneer de gedeployde Motor-runtime in stap 4 alle live gates bewijst.

## Meetmethode en bewijslimiet

De voorcontrole is geslaagd: remote `master` wijst naar mergecommit `aea1344` van PR #10. De lokale auditworktree is rechtstreeks van die commit afgeleid. De tree van PR #10 bevat PR #9 volledig; de lokale eerdere mergecommit had dezelfde tree, maar een andere merge-SHA en is daarom niet als nieuwe remote waarheid gebruikt.

De eigenaar corrigeerde de hostrollen tijdens de audit: de vernieuwde NUC heet **MotorAI 2** en de AI-pc **motorai**. De actuele Tailscale-apparaten en bestaande Cursor Remote-SSH-workspaces leverden de doelmapping; daarna bevestigde `hostnamectl` de hostnamen. De oude node `openclaw-nuc` en de oude alias `nuc` zijn expliciet niet gebruikt.

Alle hostmetingen waren strikt read-only met `BatchMode`, vooraf vertrouwde hostkeys, time-outs en zonder agent-, poort- of X11-forwarding, TTY, local commands of multiplexing. PostgreSQL-catalogusqueries draaiden met `default_transaction_read_only=on`, statement- en lock-time-outs. Er zijn geen secretwaarden of volledige omgevings-/configuratiedumps gelezen. Op de AI-pc zijn geen model-, runtime- of healthcommando's gebruikt. Alleen normale SSH/accesslogs en read-only databasetransacties kunnen als onvermijdelijke auditvoetafdruk zijn ontstaan.

| Bron | Gemeten resultaat |
|---|---|
| Git/repository | Statische inspectie van PR #10 op remote `master`/`aea1344`; aanwezigheid en aanroep van code is bewijs van repo-status, niet van live werking. |
| MotorAI 2 — nieuwe NUC | Live via Tailscale SSH: host-, OS-, disk-, proces-, service-, listener-, Tailscale-, privilege- en gerichte bestandsmetadata. Geen verhoogde rechten gebruikt; UFW-regels en volledige effectieve sshd-config blijven daarom deels onbewezen. |
| motorai — AI-pc | Live via Tailscale SSH: hardware, GPU PCI-identiteit/driver, OS, disk, processen, services, listeners en gerichte bestandsmetadata. Geen NVIDIA-runtime of model aangeroepen. Root-only firewall-, LVM- en bestandspaden blijven onbewezen. |
| Hetzner | Live via key-only SSH: host/services/containers/listeners/firewall/Tailscale en gerichte metadata. PostgreSQL-catalogi zijn afgedwongen read-only gelezen; geen tabeldata, hashes, queryteksten of secretwaarden. |
| Publieke ingress en tenanttests | Niet herhaald op 2026-07-29. De Cloudflare 1033/HTTP 530-resultaten van 2026-07-27 blijven historische context, geen actueel bewijs. Live 401/403 en health blijven open gates. |
| Privileged en externe control planes | Tailscale-ACL's/tags, Hetzner-accountbackups, root-only UFW/LVM-data op NUC/AI-pc en externe secretmanagers zijn niet uit de hostsnapshot bewijsbaar: **onbekend, meten door eigenaar/infra-operator**. |

Statussen hieronder betekenen:

- **Repo-af:** het gevraagde code-/documentartefact en de relevante aanroep zijn aangetroffen.
- **Deels:** een bruikbaar deel bestaat, maar niet het volledige acceptatiecriterium.
- **Niet aangetroffen:** gezocht in de huidige branch, zonder passend artefact.
- **Runtime onbekend:** **onbekend, meten door de genoemde eigenaar/operator**.

## Live Golf 0-nulmeting — 2026-07-29

### Caller-routebewijs: Motor → PostgreSQL

De passieve routecontrole heeft geen verbinding opgezet vanuit MotorAI 2 of de AI-pc en heeft de oude NUC niet benaderd. Drie `pg_stat_activity`-snapshots om 11:33:52, 11:34:09 en 11:34:29 UTC toonden, met de eigen read-only auditverbinding uitgesloten, telkens **nul** andere client-backends. Zowel host- als containernetwerk toonden nul established TCP/5432-sessies.

| Mogelijk pad | Bewijs op 2026-07-29 | Classificatie |
|---|---|---|
| MotorAI 2 → PostgreSQL | Geen Motor/Node/PM2/container/config en geen actieve 5432-sessie | Uitgesloten voor de gemeten staat |
| AI-pc → PostgreSQL | Geen Motor-, database- of inference-runtime en geen actieve 5432-sessie | Uitgesloten voor de gemeten staat |
| Hetzner Docker-internal | `motor-postgres` is de enige container in `motor-hetzner_default` | Geen interne Motor-caller |
| Hetzner-hostruntime/loopback | Geen Motor-service/proces en geen actieve sessie | Niet waargenomen; hoog vertrouwen voor meetmoment |
| Tailscale | Hetzner `NeedsLogin`, zonder Tailscale-IP | Niet operationeel |
| Publiek IPv4 | PostgreSQL bindt breed, maar `DOCKER-USER` dropt nieuw `eth0`-verkeer naar 5432 | Geen huidig pad; gevaarlijke latente configuratie |
| Oude NUC of andere externe client | Buiten scope en niet benaderd | Onbekend; geen sessie gezien in het meetvenster |

**Conclusie:** tijdens het meetvenster bestond geen aantoonbare Motor→Postgres-route. Dit bewijst niet dat vóór of na het venster nooit een intermitterende client verbindt. Historische counters zijn niet aan een bron toe te schrijven en tellen daarom niet als callerbewijs.

### Node- en runtimeoverzicht

| Rol | Bewezen identiteit | Live staat | Belangrijkste grens |
|---|---|---|---|
| NUC / edge-orchestrator | **MotorAI 2**; host `motorai-server2`; Ubuntu 24.04.4; i5-5250U; 7,6 GiB RAM; 98 GiB rootdisk | Tailscale 1.98.9 en Tailscale SSH actief; geen failed units; alleen SSH en een Tailscale-listener. Docker, Podman, Node, npm, PM2, OpenClaw, Ollama en Motor-processen ontbreken. `/home/motorai2/motorai` is een lege gitwerkboom zonder commits of tracked files. | Geen OpenClaw-, Motor-, Gateway-, policy- of auth-runtime. UFW-regels en volledige sshd-effectieve config vereisen nog goedgekeurde verhoogde read-only verificatie. |
| Always-on kern | **Hetzner**; host `Motor2`; Ubuntu 24.04.4; 15 GiB RAM; 301 GiB rootdisk | Docker, PostgreSQL 16.14, Qdrant, Dify en Bokas-services draaien; Ollama draait als systemd-service. Geen failed units. | Tailscale staat `NeedsLogin`. Engine, Kernel, Gateway en een bewezen private beheerroute ontbreken. Meerdere kernservices binden breder dan Tailscale/loopback-first. |
| Stateless inference-worker | **motorai**; host `motorai-server`; Ubuntu 24.04; Ryzen 7 5800X; 31 GiB RAM; Palit RTX 3090; Samsung 9100 PRO 2 TB | Tailscale SSH actief; geen gewone SSH-, app-, DB- of inference-listener. Geen Docker/Podman/Ollama/vLLM/SGLang of autostart. | RTX 3090 gebruikt `nouveau`; NVIDIA-computedriver, `nvidia-smi` en CUDA ontbreken. Slechts 100 GiB is als root-LV zichtbaar; resterende LVM-capaciteit is zonder verhoogde read-only controle niet bewezen. |
| Oude NUC | Tailscale-node `openclaw-nuc` / oude alias `nuc` | Niet benaderd | Mag niet als bewijs voor MotorAI 2 worden gebruikt. De waarschijnlijke legacy-SQLitebron moet in herstelstap 1 read-only worden veiliggesteld vóór de machine wordt gewijzigd, uitgezet of vervangen. |

### PostgreSQL, backups, SQLite en secrets

| Controle | Live bewijs | Oordeel |
|---|---|---|
| PostgreSQL | `motor-postgres` gezond; PostgreSQL 16.14; databases `motor_ai` en `postgres`; extensies `pgcrypto 1.3`, `vector 0.8.2`, `plpgsql`; 7 Drizzle-migratieregels; geen andere client in drie snapshots | Database draait, maar een actuele caller, bedrijfsdatapariteit en reconciliatie met de canonieke repo-set zijn niet bewezen. |
| Tenantisolatie | Acht applicatietabellen hebben RLS én `FORCE RLS`, met 2–5 policies per tabel | **Niet effectief voor de huidige app-login:** rol `motor` is `SUPERUSER`, `REPLICATION` en `BYPASSRLS` en bezit de tabellen. Een `NOLOGIN` owner, aparte migrator en tenantgebonden least-privilege app-roles/pools ontbreken; policies vertrouwen bovendien op appcontext die nog niet als niet-forgeerbaar is bewezen. |
| Backup/restore | `/opt/motor/infra/postgres/backup.sh` bestaat; geen Motor-systemd-timer of cronverwijzing gevonden; `archive_mode=off`; geen restore-testbewijs | M1/RPO/RTO niet groen. Externe Hetzner-backups zijn **onbekend, meten door infra-operator**. |
| SQLite | Geen SQLite/WAL/SHM onder `/opt/motor`, de nieuwe MotorAI 2-root of de zichtbare AI-pc-roots; de oude NUC is niet benaderd | De legacybron `~/AI_HQ/data/ai-motor.db` op de oude NUC blijft onbekend en is een stap-1-blocker: consistente read-only backup, checksum, herstelcontrole op een kopie en geredigeerde rijtellingen vóór de oude machine wijzigt. Het artifact is preservation-bewijs, geen automatische productiefallback. |
| Secretlocaties | `/opt/motor/infra/hetzner/.env` en `/opt/dify/docker/.env`, beide `root:root` mode `0644`; waarden niet gelezen | **Urgente hardening-gap:** lokaal world-readable. Motor-config onder `/opt/motor/infra` heeft bovendien grotendeels verweesd numeriek ownership `1000:1000` en ruime `0775`/`0664` modes. |
| NUC/AI-pc secrets | Geen `.env`, credential-, secret-, PEM- of keybestanden onder de exacte zichtbare Motor-roots; waarden en root-only paden niet gelezen | Geen zichtbare productie-side-effectcredentials op de worker. Volledige afwezigheid blijft zonder root-only inventaris onbewezen. |

### Geprioriteerde blockers

| Prioriteit | Blocker | Eigenaar | Exitbewijs vóór volgende fase |
|---|---|---|---|
| P0 — stap 1 | Legacy-SQLite op de oude NUC is niet veilig bewaard | App-eigenaar + infra-operator | Source read-only inventariseren; consistente online backup via read-only bronverbinding, of cold copy inclusief relevante WAL-state nadat de writer bewezen uit staat; versleuteld off-host artifact + checksum; `quick_check`/`integrity_check` en geredigeerde tabeltellingen op een herstelde kopie. Een raw copy tijdens mogelijke writes is ongeldig. |
| P0 — stap 1 | Geen aantoonbare Motor Postgres-backup en restore-test | Infra-operator | Versleutelde off-host backup met manifest/checksum; geïsoleerde restore op bewezen PG16/pgvector-versie; schema-, migratie-, RLS- en geredigeerde rijcontrole; RPO ≤24 uur en RTO ≤4 uur. |
| P0 — stap 1 | Qdrant draait als root op `latest`, oud volume en zonder bewezen herstelpad | Infra-operator | Actueel image-ID/digest, volume, collections/aliases/vectorconfig en point counts vastgelegd zonder payloads; off-host snapshots; geïsoleerde restore op exact dat digest; daarna digest pinnen. Geen pull, upgrade, Compose-/ownership- of volumemigratie in dezelfde wijziging. |
| P0 — stap 2 | Hetzner Tailscale uitgelogd; PostgreSQL bindt `0.0.0.0:5432` met `ssl=off` | Infra-operator + tailnet-eigenaar | Juiste node-identiteit en least-privilege ACL/tag hersteld; PostgreSQL uitsluitend op het Hetzner-Tailscale-IP gepubliceerd; `ssl=on`, `hostssl`, certificaatnaam passend bij de gebruikte tailnet-hostnaam en client `sslmode=verify-full`; NUC-connectie groen; publiek-IP en non-TLS-connectie falen; reboot/Tailscale-late-start faalt gesloten. |
| P0 — stap 3/4 | Huidige PostgreSQL-login omzeilt RLS en de tenantcontext is vrij forgeerbaar | Infra-operator + app-eigenaar | `NOLOGIN` owner, aparte migrator en per workspace een tenantgebonden least-privilege app-role/pool; RLS vertrouwt `current_user` of een gelijkwaardig niet-client-schrijfbaar kenmerk, nooit alleen vrij `SET app.workspace_id`; same-tenant succes, unauth 401, cross-tenant 403, directe negatieve SQL-tests, pool-reuse en adversariële contextswitch groen. |
| P0 — stap 3 | Motor- en Dify-`.env` zijn mode `0644` | Infra-operator | Goedgekeurd rotatie-/permissieplan, minimale modes/ownership en bewijs zonder waarden te loggen; oude appcredential pas intrekken na stap-4-canary. |
| P0 — stap 4 | MotorAI 2 bevat nog geen Motor/OpenClaw/Gateway/policy/auth | Eigenaar + platform | Deployment-/rollbackplan; daarna versiepin, loopback/Tailscale-bind, token/auth, origins, pairing, eigen skill-allowlist, fail-closed policy, integration-readiness en de volledige M5-suite als machineleesbaar bewijs. |
| P1 | SSH/privileges zijn ruimer dan doelontwerp | Infra-operator + eigenaar | Root-SSH/forwarding op Hetzner herzien; `lxd`/`sudo`/`adm`, X11 en tailnet-ACL's op NUC/worker expliciet beargumenteren of beperken. |
| Deferred — stap 5 | AI-pc gebruikt `nouveau`; opslag- en privileged netwerkbewijs ontbreken | Eigenaar + infra-operator | Bewuste veilige ruststand tot Gateway/policy. Daarna afzonderlijk goedgekeurde driver/reboot, `nvidia-smi`, computetest, modelvolume, firewall/listeners en worker-runbook. Geen voorwaarde voor Golf 0. |

### Goedgekeurde herstelvolgorde en gates

| Stap | Werk en eigenaar | Acceptance gate | Stop-/rollbackgedrag |
|---|---|---|---|
| **0 — caller-route** | Infra/Security classificeert het huidige Motor→Postgres-pad uit passief bewijs | Afgerond: geen actieve route aangetroffen; oude/intermitterende caller blijft expliciet onbekend | Geen netwerkpad aannemen of openen op basis van afwezigheid in één meetvenster |
| **1 — recovery & preservation** | App-eigenaar + infra-operator maken vóór iedere wijziging aan de oude NUC een consistente online preservation-backup en bewijzen geïsoleerde PostgreSQL- en Qdrant-restores | Alle drie herstelobjecten hebben off-host artifact, checksum/manifest, geredigeerde inhoudscontrole en RPO/RTO-bewijs; Qdrant draait daarna op exact het bewezen digest. De eerste SQLite-snapshot is een herstelvloer, geen finale migratiesnapshot zolang writes doorgaan | Bij ontbrekende bron, inconsistente SQLite, checksumfout of mislukte restore stopt de reeks zonder de oude NUC, live volumes of imageversies te wijzigen |
| **2 — private transport** | Infra-operator + tailnet-eigenaar herstellen Hetzner-Tailscale, least-privilege ACL's, private PostgreSQL-bind en TLS | NUC→PostgreSQL werkt met `sslmode=verify-full`; alleen noodzakelijke private paden werken; publiek, non-TLS en AI-pc→data-plane falen | Bij Tailscale-, bind- of certificaatfalen blijft Motor unavailable/degraded; nooit publieke 5432 of TLS-uit als rollback |
| **3 — identities & secrets voorbereiden** | Infra-operator + app-eigenaar maken owner/migrator/tenant-app-roles naast de oude role en herstellen/roteren secretlocaties | Role flags, ownership, grants en synthetische SQL-isolatie groen; nieuwe secrets alleen in canaryscope; oude credential nog niet ingetrokken | Bij grant/credentialfout geen app-cutover; minimale grants herstellen, nooit een nieuwe Motor-runtime op de superusercredential zetten |
| **4 — datafreeze, Motor-canary en Golf 0 sluiten** | App-eigenaar zet de oude writer gecontroleerd in maintenance/read-only, maakt een finale consistente SQLite-snapshot, migreert/reconcilieert; platform deployt minimale Motor/OpenClaw/Gateway/policy, verbindt tenantgebonden pools en draait auth/health/M5 | Finale bron/doeltellingen en `legacy_sqlite_id`-reconciliatie groen; same-tenant 2xx; unauth 401; cross-tenant 403; directe SQL-isolatie; niet-forgeerbare context; pool-lektest; OpenClaw-versie/bind/origin/allowlist; integration-readiness groen. Pas daarna oude runtimecredential roteren/intrekken en oude NUC decommissionen | Mislukte migratie/canary blijft maintenance/read-only en sluit Golf 0 niet; herstel alleen naar de vooraf bewezen bronstaat, nooit naar superuser/`BYPASSRLS` |
| **5 — inference-worker** | AI/Infra activeren de AI-pc pas na eigen runbook en Gateway/policy | Gepinde NVIDIA-driver, rebootbewijs, 24 GiB zichtbaar, compute/failover/monitoring groen en geen direct DB/Qdrant-pad | Worker uitregistreren; control/data-plane blijft functioneren |

**Golf 0 blijft rood tijdens stap 1–3 en kan niet vóór volledige acceptatie van stap 4 worden gesloten.** De open 401/403-, cross-tenant-, integration-readiness- en OpenClaw-bewijzen vereisen immers een draaiende Motor-runtime. De AI-pc is een afzonderlijke deferred worker-gate en blokkeert Golf 0 niet.

**Auditverklaring:** er zijn geen packages, bestanden, repositorybestanden op de hosts, services, containers, firewallregels, Tailscale-instellingen, databases, credentials of modellen gewijzigd. Er is geen model gedownload, geladen of gestart.

## Golf 0 en Fase 0

| Item | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| 0.1.1 Qdrant dual-search | Ingest- en scrape-collecties via één naamlogica doorzoeken | **Repo-af:** `lib/qdrant-collection.ts` is de naam-SSOT; `lib/knowledge-service.ts` zoekt beide collecties en mergeert op score | Qdrant draait op Hetzner; collectie- en hit-counts zijn **onbekend, meten door infra-operator** | Code en service bestaan; data-aanwezigheid en een echte chat-treffer zijn niet bewezen |
| 0.1.2 Qdrant-migratie | Legacy vectors naar scoped buckets migreren | **Repo-af:** `scripts/qdrant-migrate-collections.mjs` bestaat met dry-run en expliciete delete-optie | **onbekend, meten door eigenaar op Hetzner** | Geen log, marker of snapshot gevonden die bewijst dat het script is gedraaid |
| 0.1.3 UI-labels | Actuele collectienamen tonen, niet hardcoden | **Repo-af:** `kennisbank-file-ingest.tsx` haalt `qdrant_collections` uit de catalog-API; alleen de foutfallback is generiek | **onbekend, meten door eigenaar op NUC** | Live catalog-response en rendering niet gezien |
| 0.1.4 Qdrant-env | Canonieke env-vars documenteren | **Repo-af:** `.env.example`, `docs/model-config.md` en ADR-001 bevatten prefix/scoped configuratie | N.v.t. | Geen afwijking in de repo |
| 0.2.1 `knowledge_documents` | Persistente, querybare tabel | **Repo-af:** SQLite-schema in `lib/db/platform-schema.ts`, PG-schema/migratie en catalog/ingest-routes aanwezig | PostgreSQL-schema en 7 migratieregels zijn live; Motor-app op de NUC ontbreekt; tabelinhoud/querybaarheid is **onbekend, meten door eigenaar/infra-operator** | Schema en migratieregister zijn geen bewijs van gevulde, end-to-end querybare kennis |
| 0.2.2 chat/conversations-auth | Niet publiek; zonder sessie 401 | **Repo-af:** beide families ontbreken in `PUBLIC_PATHS`; middleware geeft 401; routes gebruiken daarnaast `requireApiAuthForKlant` | Motor-app staat niet op MotorAI 2; live 401 niet herhaald | De claim in doc 01 dat deze paden nog publiek zijn is verouderd. Bewuste uitzondering: `/api/chat/bridge/*`; runtimegate blijft rood |
| 0.2.3 server-side scope | Cross-tenant verzoek wordt 403 | **Repo-af:** `assertScopeAccess` en `requireApiAuthForKlant` worden door relevante routes gebruikt | **onbekend, meten door eigenaar op NUC** met fumero→bokas-test | Geen opgeslagen groen cross-tenant testresultaat |
| 0.2.4 scope in chatrequest | `klant` tegen sessiescope valideren | **Repo-af:** `/api/chat/stream` valideert vóór uitvoering | **onbekend, meten door eigenaar op NUC** | Code aanwezig; productiegedrag niet bewezen |
| 0.3.1 approvals-inbox | Cowork-inbox en health/status beschikbaar | **Repo-af:** redirect, inbox-count en approvals-route aanwezig | **onbekend, meten door eigenaar op NUC** | UI- en Telegram-keten niet live gemeten |
| 0.3.2 bookkeeping-degradatie | Bij `:8001` down geen lege crash | **Repo-af:** `lib/bookkeeping-bot.ts` retourneert expliciete offline-status/fallback | **onbekend, meten door eigenaar op NUC** | Faalproef met bookkeeping-bot uit is niet vastgelegd |
| 0.3.3 healthdashboard | Qdrant, bookkeeping en OpenClaw op één pagina | **Repo-af:** integration-readiness API en devpagina bevatten de probes | Motor-app en OpenClaw staan niet op MotorAI 2; publieke health niet herhaald | Probe-code bestaat, maar er is nog geen deployde NUC-runtime om groen te meten |
| 0.3.4 smoke/verify | Reproduceerbare live verificatie | **Repo-af:** `smoke-quality.mjs`, `verify-live.sh` en `e2e-hybrid.mjs` bestaan | **onbekend, meten door eigenaar op NUC** | Geen recente uitvoer aangetroffen |
| Secrets-inventaris | Weten waar credentials leven; verweesde keys weg | Geen actuele registry in de repo | **Deels live gemeten:** twee Hetzner-`.env`-locaties gevonden met mode `0644`; geen zichtbare Motor-secrets onder de exacte NUC/worker-roots; waarden en root-only paden niet gelezen | Locaties zijn gedeeltelijk bekend, maar ownership, rotatie en secrets-manager-migratie staan open; Golf 0 blijft rood |

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
| Versie met CVE-fixes | Geen serverversie-pin of actuele versie-uitvoer gevonden | OpenClaw is niet geïnstalleerd op MotorAI 2 | Niet operationeel; versiepin is een pre-deploygate |
| Token-auth | Motor-client ondersteunt `OPENCLAW_GATEWAY_TOKEN`, maar een lege token blijft toegestaan | Geen OpenClaw-server of Motor-clientruntime op MotorAI 2 | Niet operationeel; fail-closed tokencheck moet vóór deployment worden ontworpen en getest |
| Loopback + Tailscale-only | Clientdefault is `127.0.0.1:18789`; geen bind-/firewallconfig van de Gateway gevonden | Geen listener op 18789; alleen SSH/Tailscale-listeners | Momenteel niet blootgesteld, maar de vereiste bind is nog niet als deploymentconfig aanwezig |
| WebSocket-originvalidatie | Geen OpenClaw-serverconfig gevonden | Geen OpenClaw-server op MotorAI 2 | Niet operationeel; pre-deploygate |
| Skills-allowlist uit eigen git | Geen complete, actieve allowlistconfig aangetroffen | Geen skills of OpenClaw-root op MotorAI 2 | Niet operationeel; pre-deploygate |
| Side effects via Action Gateway | Action Gateway bestaat nog niet als component | Nee in repo | Niet geïmplementeerd |
| Canonieke ADR | ADR-101–109 staan in `DECISIONS.md`; doc 07 §30 is index-only | N.v.t. | Gespiegeld; runtimebewijs voor ADR-101/106 blijft open |

**Golf 0-eindoordeel:** de repo-items voor kennisbank, schema en auth zijn grotendeels aanwezig. Golf 0 is **niet af**: de nieuwe NUC heeft nog geen Motor/OpenClaw-runtime, de huidige PostgreSQL-login omzeilt RLS, recovery is niet bewezen, secrets-permissies zijn te ruim en live 401/403-/healthbewijzen ontbreken. Deze bewijzen kunnen pas met de stap-4-runtime worden geleverd; Golf 0 en stap 4 sluiten daarom samen. De AI-pc blijft conform gate zonder workload en is geen Golf 0-blocker.

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
| M2 — dual-write aan | 2026-07-05 | Gedeeltelijk geïmplementeerd; template staat standaard uit | Motor-app ontbreekt op MotorAI 2; effectieve flags en rijpariteit niet meetbaar | Geen runtime om dual-write te bewijzen |
| M3 — migratie gedraaid | 2026-07-19 | `migrate-sqlite-to-postgres.mjs` migreert auth, chat, approvals en knowledge; readiness-checklist staat open | Drizzle-register bevat 7 migratieregels; bron-/doelreconciliatie en legacy-ID-tellingen ontbreken | **Deels bewijs:** schemawijzigingen zijn geregistreerd, datamigratie niet bewezen |
| M4 — Postgres SSOT | 2026-07-26 | Primary/fallback-flags zijn niet aan de SQLite-routes gekoppeld | Niet mogelijk conform ADR met deze code | **Niet gehaald in code; deadline verstreken** |
| M5 — RLS productie | 2026-08-02 | RLS-migraties en workspace-contextcode bestaan | Acht app-tabellen hebben RLS + `FORCE RLS`, maar login `motor` is owner/superuser/`BYPASSRLS`; tenant-GUC is niet als niet-forgeerbaar bewezen; API-, directe SQL-, context-switch- en pooltests ontbreken | **Niet gehaald:** policies bestaan, maar runtime-identiteit en tenantbinding maken ze niet effectief |
| M6 — SQLite uit productie | 2026-08-09 | Uitschakelflag heeft geen caller; SQLite blijft read/write openen | Nog niet meetbaar | Nog niet verschuldigd, maar huidige code kan het criterium niet afdwingen |

### Rijtellingen en migratiebewijs

| Store | Meting op 2026-07-29 | Conclusie |
|---|---|---|
| Productie-SQLite `~/AI_HQ/data/ai-motor.db` | Motor staat niet op MotorAI 2; geen SQLite/WAL/SHM onder `/home/motorai2/motorai`; oude NUC niet benaderd | Waarschijnlijke legacybron op de oude NUC is **onbekend, meten en consistent read-only veiligstellen door app-eigenaar + infra-operator** vóór wijziging/decommissioning |
| Postgres op Hetzner | PostgreSQL 16.14 live; `motor_ai` circa 8,3 MB; 8 app-tabellen met RLS; 7 Drizzle-migratieregels | Rij- en `legacy_sqlite_id`-tellingen zijn bewust nog niet gedaan; M3 blijft onbewezen |
| `ai-motor/motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |
| `ai-motor/lib/db/ai-motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |
| Migratie-uitvoer | Drizzle-register live met 7 regels; geen log/rapport met “Migration complete” of bron-/doeltellingen aangetroffen | Schema-apply deels bewijsbaar; datamigratie M3 niet |

Een kale totaaltelling is niet genoeg voor M3: het script dedupliceert en vertaalt `auth_users` naar `users`/memberships. De eigenaar moet daarom zowel totalen als aantallen met `legacy_sqlite_id` rapporteren.

## Welke 2.2-componenten bestaan werkelijk?

| Component | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| Motor Kernel | PG `tasks`, append-only `task_events`, approvals en lifecycle-API | Geen Kernel-module, `/api/kernel`, PG-`tasks` of `task_events`; wel legacy SQLite `automation_tasks`/`automation_runs` en approvals | Geen Motor-runtime op MotorAI 2 en geen Kernel-service op Hetzner aangetroffen | **2.2-Kernel bestaat niet** |
| Action Gateway | Centrale policy- en credential-broker vóór side effects | Geen Gateway-route, risicoklassen, argument-hash, reservering/settlement of centrale credential-broker; alleen lokale budget/policy-fragmenten | Nee als 2.2-component | **Bestaat niet** |
| Playbook-registry | Git-playbooks plus versie/status/tenant | Geen `playbooks/`-registry of PG-register; `motor_skills` is een SQLite prompt-/skilltabel en `motor-test-playbook.md` is een handmatig logboek | Nee als 2.2-component | **Bestaat niet**; bovendien bevroren door AM-1 |
| Canonieke engine | Eén gekozen engine; n8n alleen adapter | Inngest-dependency, serve-route, events en één `approval-hitl`-functie bestaan; n8n en SQLite-cron blijven feitelijke orchestrators | Geen Motor-engine op MotorAI 2/Hetzner aangetroffen; geen actieve standalone n8n | Geen canonieke engine gekozen of bewezen |
| `lib/inngest/` | Durable enginebasis | Meer dan een lege skeleton: approvals emitten events en één workflow doet `waitForEvent`; zonder keys wordt verzenden bewust no-op. Relay/reminder-events hebben geen eigen handler | Niet gedeployd op MotorAI 2; externe Inngest-status niet gemeten | **Gedeeltelijk geïntegreerde pilot, niet de engine** |
| Adapters/executors | Achter Kernel/Gateway | OpenClaw-, n8n-, local-executor-, PC-bridge-, browser- en automation-adapters bestaan verspreid | Niet gedeployd op de nieuwe NUC; AI-pc bewust leeg | Bruikbare code, maar geen centrale dispatch/policy |
| Evidence/observability | Taskgebonden evidence, traces en audit | Langfuse-chat-tracing, audit- en usagepaden bestaan; geen taskgebonden evidence-model of Gateway-beslislog | Geen Motor-runtime of monitoringhub aangetroffen | Deels in repo, niet live als 2.2-keten |
| DBOS/Temporal/Restate/Hatchet | Alleen kandidaten/referenties | Geen applicatie-integratie aangetroffen | Nee | Geen verborgen tweede engine in code |

## State-stores die de repo werkelijk ondersteunt

De repo bevestigt meer dan zes persistentiemechanismen of externe state-eigenaren. Hij bewijst niet dat ze allemaal tegelijk live zijn.

| Store / waarheid | Repo zegt | Live status | SoT-probleem |
|---|---|---|---|
| ai-motor SQLite | Altijd geopende read/write database voor chat, conversations, approvals, automation en meer | Niet aanwezig op de nieuwe NUC, omdat Motor nog niet is gedeployd | Feitelijke primaire app-state zodra huidige code wordt gestart; M4 blijft codeblokkade |
| Postgres/Drizzle | Workspace-, tenant-, audit-, usage- en master-contextschema’s; gedeeltelijke dual-write | PostgreSQL 16.14 en 7 Drizzle-migratieregels live op Hetzner; datapariteit onbekend | Parallel aan SQLite; nog geen volledige SSOT. Huidige app-role omzeilt RLS |
| Qdrant | Kennisbank- en memorycollecties via externe service | Live op Hetzner, maar buiten Motor Compose, op `latest` en oud volume; collecties/counts onbekend | Bedoelde vector-SSOT; ownership, reproduceerbaarheid en backup zijn niet bewezen |
| Filesystem | Uploads, photo-studio-assets, campaignpacks en projectbestanden onder `$HOME/AI_HQ` | Nieuwe NUC-root is leeg; legacyfiles buiten de nieuwe root zijn onbekend | Persistente blobs buiten DB vereisen vóór migratie een expliciete bron- en backupinventaris |
| Inngest run-state | Externe durable state zodra keys actief zijn | Geen Motor-runtime op de NUC; externe control-plane-status niet gemeten | Approval-state blijft in repo daarnaast SQLite-gebaseerd |
| n8n interne state | Veel actieve webhook-/automation-aanroepen in code | Geen actieve standalone n8n op de drie gemeten nodes aangetroffen | Codeafhankelijkheden moeten vóór enginekeuze worden gereconcilieerd |
| Dify interne state | Builder/artifact-integratie en deploydocumentatie aanwezig | Dify-stack 1.13.3 live onder `/opt/dify/docker` | Geplande decommissioning; exit/migratie en te ruime `.env`-permissies staan open |
| Langfuse Cloud | Optionele chat-traces | **onbekend, meten door eigenaar** | Extra observability-store; DPA/retentie niet live bewezen |
| Browser-localStorage | Zustand-stores voor UI-voorkeuren | Alleen client-side | Geen server-SSOT, wel gebruikersstate |
| `EXECUTION_BOARD.db` | Getrackt legacybestand: 20.480 bytes, tabellen `projects` en `tasks`, beide 0 rijen | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Leeg in Git, maar code/legacy kan elders een kopie gebruiken |
| Chroma legacy | `db/chroma.sqlite3`: 2 collecties; `factory_brains/chroma.sqlite3`: 1 collectie | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Tweede/derde vectorwaarheid blijft als legacy aanwezig |
| `omega_db` | Legacy Python-code verwijst naar eigen DB | Geen productiebestand onder de exacte zichtbare MotorAI 2-root; legacylocaties buiten scope blijven **onbekend, meten door eigenaar** | Nog een mogelijke legacy-taakwaarheid, niet actief op de nieuwe NUC aangetroffen |

## Services op NUC, Hetzner en inference-PC

Onderstaande tabellen zijn de live, read-only snapshot van 2026-07-29. Oudere snapshots blijven alleen historie en mogen niet meer als bewijs voor de vernieuwde NUC of AI-pc worden gebruikt.

### Nieuwe NUC — MotorAI 2

| Service | Plan/config zegt | Draait | Verschil |
|---|---|---|---|
| Tailscale / beheer | Tailscale-only beheerroute | Tailscale 1.98.9 en Tailscale SSH actief; geen subnetroutes/services geadverteerd | Positieve basis; ACL/tag/device ownership en `ShieldsUp=false` nog beoordelen |
| Motor Next.js | PM2 `ai-motor`, poort 3040, één instance | Afwezig; Node/npm/PM2 ontbreken | Nog niet gedeployd |
| local-executor | PM2 `local-executor`, poort 8790 | Afwezig | Nog niet gedeployd |
| OpenClaw gateway | Poort 18789, gehardened | Afwezig; geen unit, proces, container, root of listener | Nog niet gedeployd; alle ADR-106-gates staan open |
| bookkeeping-bot | Poort 8001 | Afwezig | Nog niet gedeployd |
| Cloudflare Tunnel | `motorsai.app` naar Motor | Geen tunnelunit/proces aangetroffen op MotorAI 2; publieke route niet herhaald | Ingressplan en origin moeten vóór deployment expliciet worden vastgesteld |
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
| Hardware/OS | Ryzen 7, 32 GB, RTX 3090, Ubuntu LTS headless | Live bewezen: Ryzen 7 5800X, 31 GiB RAM, Palit RTX 3090, Ubuntu 24.04, Samsung 9100 PRO 2 TB | Hardwarebasis klopt |
| GPU-runtime | Gepinde NVIDIA-computedriver en meetbare 24 GiB VRAM | `nouveau` actief; NVIDIA-driver, `nvidia-smi` en CUDA ontbreken | **Deferred guardrail:** bewust niet inference-klaar; driverwijziging pas in stap 5 apart goedkeuren en na reboot verifiëren |
| Rol | Stateless inference-worker in execution plane; alleen via Tailscale/LiteLLM | Tailscale SSH actief; geen apps, containers, modellen, DB of inference-autostart | Correct veilig gehouden; geen taak vóór Gateway/policy |
| Locatie | Prompt laat dit bewust open | **onbekend, bevestigen door eigenaar** | Vastleggen vóór ingebruikname; bepaalt single-site-risico |
| Voeding | Doc 12 adviseert ≥850 W en twee aparte PCIe-kabels | **onbekend, bevestigen door eigenaar** | Bevestigen vóór GPU-belasting |
| Opslag | Doc 12 adviseert 1–2 TB NVMe | Fysiek 2 TB; slechts 100 GiB root-LV zichtbaar, resterende VG-capaciteit zonder sudo niet bewezen | Model-/cachevolume en ownership vóór downloads ontwerpen |
| Netwerk/firewall | Tailscale-only workerverkeer | Tailscale 1.98.9/SSH actief; geen gewone SSH- of applistener; UFW actief maar regels zonder sudo niet leesbaar | ACL/tag en volledige privileged listener/firewallcheck open |
| Runbook/monitoring | Tailscale-only, Beszel-agent, failovertest en inference-worker-runbook | Geen worker-runtime of Beszel aangetroffen; `systemd-networkd-wait-online` failed | Runbook, boot-health en monitoring vóór registratie vereist |

## Nog uit te voeren live metingen

De brede hostinventaris is uitgevoerd. De volgende metingen zijn bewust open gebleven omdat ze verhoogde rechten, een externe control plane of een nog niet gedeployde runtime vereisen. Iedere uitvoering krijgt opnieuw een read-only commandreview; secretwaarden en live SQLite worden niet rechtstreeks gedumpt of geopend.

| Open meting | Waarom open | Operator / bewijs |
|---|---|---|
| Oude NUC: legacy-SQLitebron, writer-state en preservation-backup | Oude NUC was bewust buiten de nulmeting, terwijl de code altijd `~/AI_HQ/data/ai-motor.db` read/write opent | App-eigenaar + infra-operator volgens stap 1; bron alleen read-only inventariseren, consistente backup off-host, checksum, herstelcontrole en geredigeerde rijtellingen |
| NUC: effectieve sshd-config en UFW/nft-regels | `sudo -n` vereiste een wachtwoord; er is niet geïnteracteerd | Eigenaar/infra-operator met goedgekeurde verhoogde read-only sessie; alleen gefilterde effectieve properties en regelmetadata |
| AI-pc: volledige listeners/firewall en vrije LVM-capaciteit | Root-LV is zichtbaar, VG-free en privileged process-attributie niet | Infra-operator met goedgekeurde verhoogde read-only sessie |
| Tailnet ACL's, tags, device ownership en key expiry | Niet volledig bewijsbaar vanuit nodeprefs | Tailnet-eigenaar via control-plane-export zonder authkeys/tokens |
| Externe Hetzner-backup/snapshotstatus | Niet zichtbaar op de host | Infra-operator via Hetzner-control-plane; laatste success, retentie en restorebewijs |
| Postgres bron-/doelreconciliatie en canonieke migratievergelijking | Live schema gemeten, datamigratie niet | App-eigenaar + infra-operator; afgedwongen read-only query met alleen tellingen, na vastgelegde tabel-/tenantmapping |
| Qdrant collectie-/point-counts en snapshotrestore | Service live, inhoud en restore niet gemeten | Infra-operator; tenant-/collectiescope en snapshotbewijs zonder documentpayloads |
| Motor/OpenClaw-versie, bind, token, origins, pairing, allowlist | Runtime ontbreekt op MotorAI 2 | Pas na goedgekeurd deploymentplan; configuratiemetadata plus negatieve authtests |
| Live 401/403, health, knowledge-hit, M5 en smoke | Motor-runtime ontbreekt | App-eigenaar in stap 4; machineleesbare testoutput met tenant-negative SQL/API- en context-switchcases |
| AI-pc locatie, voeding en bekabeling | Niet via SSH te bewijzen | Eigenaar bevestigt fysiek vóór driverbelasting |

## Uitvoeringsgrens

Pietje heeft op 2026-07-29 uitsluitend deze documentdelta en de volgorde 0–5 goedgekeurd. Dat is geen toestemming om een live stap uit te voeren. Iedere herstelstap krijgt vooraf een apart, reviewbaar runbook met exacte targets, maintenance-impact, rollback, bewijsopslag en een eigen expliciete goedkeuring.

De bestaande [`fase1-postgres.md`](../fase1-postgres.md), [`nuc-readiness.md`](../nuc-readiness.md) en [`hybrid-env.md`](../hybrid-env.md) bevatten nog pre-amendementvoorbeelden met één gedeelde `motor`-credential, verbinding zonder `sslmode=verify-full` en/of een veronderstelde volledige SQLite-rollbackkopie. Tot een afzonderlijk goedgekeurde doccorrectie zijn die passages **niet uitvoerbaar**; het ADR-002-amendement in [`DECISIONS.md`](../DECISIONS.md) is leidend.

De repository-baseline van 2026-07-27 blijft historische context. Deze live snapshot van 2026-07-29 vervangt de oude runtimeaannames zolang het bewijs geldig is, maar autoriseert geen remediation. Onbekende velden blijven uitvoerblokkades; documentatie alleen is geen acceptatiebewijs. Draft PR #11 mag niet worden gemerged voordat de eigenaar de documentdelta afzonderlijk heeft gereviewd.
