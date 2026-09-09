# 00 — Huidige staat Motor AI 2.2

> **Eigenaar:** Pietje
> **Meetdatum:** 2026-07-27
> **Bron:** PR #9, head `7f89408`
> **Status:** Stap 1 goedgekeurd op 2026-07-27; live runtimevelden blijven open
> **Gerelateerd:** [Master Build Plan](../MASTER-BUILD-PLAN.md) · [ADR-001/002](../DECISIONS.md) · [bindend review-panel](15-review-panel.md)

## Uitkomst in één minuut

De repository is verder dan de oorspronkelijke 2.2-nulmeting voor Qdrant, `knowledge_documents` en API-auth: `/api/chat/*` en `/api/conversations/*` staan niet meer in `PUBLIC_PATHS` en de routes hebben tenantchecks. De runtime is echter niet aantoonbaar groen. Vanaf deze auditomgeving was geen SSH-toegang tot NUC of Hetzner beschikbaar en `https://motorsai.app` gaf op het meetmoment Cloudflare-fout 1033/HTTP 530. OpenClaw-hardening volgens ADR-106 is niet bewezen en grotendeels niet als serverconfiguratie in de repo aanwezig. ADR-002 loopt achter: het migratiescript en Postgres-schema bestaan, maar `POSTGRES_PRIMARY` en `SQLITE_FALLBACK` sturen de applicatierouting niet aan; daardoor is M4 “Postgres SSOT” in de code niet bereikt. Van de nieuwe 2.2-laag bestaan vooral deelstukken: Inngest heeft één geïntegreerde HITL-workflow, maar Kernel, Action Gateway en Playbook-registry bestaan nog niet als 2.2-component.

## Aanvulling 2026-09-08 — QwenPaw en Telegram-migratie

**Besluit:** [ADR-110](../DECISIONS.md) · **Uitvoering:** [runbook `qwenpaw-migratie.md`](../qwenpaw-migratie.md) · **Opdracht (overname):** [`../qwenpaw/OPDRACHT-OVERNAME.md`](../qwenpaw/OPDRACHT-OVERNAME.md)

**Gemeten 2026-09-08 (QwenPaw zelf, doorgestuurd door de eigenaar):** QwenPaw **2.2.0** draait in een Docker-container, hostname `cc22d51c27ac` (`/.dockerenv` aanwezig), werkdirectory `/app/working/workspaces/boka_operations`, agent-id **`boka_operations`**. `~/AI_HQ/ai-motor/qwenpaw` en `~/.qwenpaw/workspaces/default` ontbreken in die container. Skill `project-administratie` en `motor_admin.py` waren op dat moment niet aanwezig.

**Eigenaarsbesluit dezelfde avond:** de NUC is **niet nodig** voor deze taak. Docker-host = NUC is geen meetpunt en geen blokkade. Uitvoering = deze container.

**Gemeten 2026-09-08 later (QwenPaw, doorgestuurd door de eigenaar):** skill `project-administratie` staat **enabled** (`customized`, scanner `safe=True`). Persona-regels zijn in `PROFILE.md` gezet. `agent.json` is niet aangeraakt. Rooktest **OFFLINE**. Telegram-kanaal: **niet actief** (console-instance). QwenPaw schreef een eigen helper die `MOTOR_API_URL` + optioneel `MOTOR_API_TOKEN` leest. **`MOTOR_API_TOKEN` is verboden** (ADR-110); niet zetten. Canonieke helper blijft credential-loos (`BOOKKEEPING_BOT_URL` of loopback/Docker-host-probe).

| Vraag | Status op 2026-09-08 later |
|---|---|
| Draait QwenPaw, waar, welke versie? | **2.2.0** in container `cc22d51c27ac`, agent `boka_operations`. NUC niet vereist. |
| Skill `project-administratie` enabled? | **ja** (eigen variant; moet credential-loos gemaakt worden) |
| Rooktest | **OFFLINE** (geldig) — hun script wachtte op `MOTOR_API_URL`; dat is niet de canonieke bron |
| Telegram-allowlist / kanaal actief? | **nee** — console-only; token alleen via Console door de eigenaar, niet in chat |
| Motor-sessietoken in QwenPaw-env? | **niet gezet** (goed). Niet alsnog `MOTOR_API_TOKEN` exporteren. |
| Bookkeeping-bot bereikbaar? | **onbekend, meten door Pietje** — `motor_admin.py probe` zonder token |

**Gemeten 2026-09-09 (QwenPaw, doorgestuurd door de eigenaar):** overname gedaan. `OVERDRACHT.md` + lege `STAND.md` (`Bron: probe OFFLINE`). Probe health/recent/documents OFFLINE. QwenPaw vroeg Pietje om inbox/retry/verwerkt/export. **Eigenaar 2026-09-09:** “maar alles zat toch op odoo” — facturen niet laten plakken; bron is Odoo via bookkeeping-bot `GET /odoo/bills` (`motor_admin.py odoo`). Die route is vanaf QwenPaw **nog niet gemeten**. In deze repo en audit-VM zitten **geen** live bonnen. `BOOKKEEPING_BOT_URL` = **onbekend, meten door Pietje**. Geen `MOTOR_API_URL`, geen Odoo-wachtwoord in QwenPaw.

Meetcommando's in de QwenPaw-container (deel uitvoer zonder secrets):

```bash
qwenpaw --version
hostname
pwd
ls /app/working/workspaces/boka_operations
qwenpaw skills list --status enabled --agent-id boka_operations
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py probe
# Telegram zonder token:
python3 -c "import json;c=json.load(open('/app/working/workspaces/boka_operations/agent.json'));t=c.get('channels',{}).get('telegram',{});t['bot_token']='***' if t.get('bot_token') else '';print(json.dumps({k:t.get(k) for k in ('enabled','dm_policy','group_policy','allow_from')},indent=2))"
```

OpenClaw-Telegram is geen QwenPaw-voorwaarde. Alleen meten als dezelfde bot nog via OpenClaw antwoordt.

## Meetmethode en bewijslimiet

De voorcontrole is geslaagd: PR-head `7f89408` bevatte vóór deze nulmeting de opgegeven 19 bestanden; doc 15, het masterplan en `DECISIONS.md` zijn aanwezig. De mechanische bundel `MOTOR-AI-2.2-COMPLEET.md` is niet als bron gebruikt en in consolidatiestap 3 verwijderd om dubbele waarheid te voorkomen.

De eigenaar bevestigde daarna: de NUC is de informele kanaal/UI-orchestrator en de nieuwe PC wordt de lokale LLM-worker zodra SSH beschikbaar is. Conform bindend AM-3 blijven durable engine, Kernel en Gateway op Hetzner; de PC krijgt vóór SSH plus Gateway/policy geen taken.

| Bron | Gemeten resultaat |
|---|---|
| Git/repository | Statische inspectie van PR #9 op `7f89408`; aanwezigheid en aanroep van code is wel bewijs, een bestand of checklist is geen runtimebewijs. |
| Auditomgeving | `USE_POSTGRES`, `POSTGRES_PRIMARY`, `SQLITE_FALLBACK` en `DATABASE_URL` zijn hier unset; `$HOME/AI_HQ/data/ai-motor.db` ontbreekt. Deze VM is niet de NUC. |
| NUC/Hetzner | Geen SSH-configuratie, sleutel, agent of resolveerbare hostalias beschikbaar. Daarom: **onbekend, meten door eigenaar op NUC/Hetzner**. |
| Publieke ingress | `GET https://motorsai.app/api/health` gaf `error code: 1033`; unauthenticated probes op `/api/chat`, `/api/chat/stream` en `/api/conversations` gaven HTTP 530. Dit bewijst een niet-beschikbare Cloudflare-route op het meetmoment, niet dat de interne NUC-processen uitstaan. |
| Tests en scripts | Niet uitgevoerd. Alleen aanwezigheid en inhoud zijn geïnspecteerd; er is geen groen resultaat verondersteld. |

Statussen hieronder betekenen:

- **Repo-af:** het gevraagde code-/documentartefact en de relevante aanroep zijn aangetroffen.
- **Deels:** een bruikbaar deel bestaat, maar niet het volledige acceptatiecriterium.
- **Niet aangetroffen:** gezocht in de huidige branch, zonder passend artefact.
- **Runtime onbekend:** **onbekend, meten door de genoemde eigenaar/operator**.

## Golf 0 en Fase 0

| Item | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| 0.1.1 Qdrant dual-search | Ingest- en scrape-collecties via één naamlogica doorzoeken | **Repo-af:** `lib/qdrant-collection.ts` is de naam-SSOT; `lib/knowledge-service.ts` zoekt beide collecties en mergeert op score | **onbekend, meten door eigenaar op NUC/Hetzner**: collectie- en hit-counts | Code is klaar; data-aanwezigheid en een echte chat-treffer zijn niet bewezen |
| 0.1.2 Qdrant-migratie | Legacy vectors naar scoped buckets migreren | **Repo-af:** `scripts/qdrant-migrate-collections.mjs` bestaat met dry-run en expliciete delete-optie | **onbekend, meten door eigenaar op Hetzner** | Geen log, marker of snapshot gevonden die bewijst dat het script is gedraaid |
| 0.1.3 UI-labels | Actuele collectienamen tonen, niet hardcoden | **Repo-af:** `kennisbank-file-ingest.tsx` haalt `qdrant_collections` uit de catalog-API; alleen de foutfallback is generiek | **onbekend, meten door eigenaar op NUC** | Live catalog-response en rendering niet gezien |
| 0.1.4 Qdrant-env | Canonieke env-vars documenteren | **Repo-af:** `.env.example`, `docs/model-config.md` en ADR-001 bevatten prefix/scoped configuratie | N.v.t. | Geen afwijking in de repo |
| 0.2.1 `knowledge_documents` | Persistente, querybare tabel | **Repo-af:** SQLite-schema in `lib/db/platform-schema.ts`, PG-schema/migratie en catalog/ingest-routes aanwezig | **onbekend, meten door eigenaar op NUC en Hetzner** | Schema is geen bewijs dat de productietabellen bestaan of gevuld zijn |
| 0.2.2 chat/conversations-auth | Niet publiek; zonder sessie 401 | **Repo-af:** beide families ontbreken in `PUBLIC_PATHS`; middleware geeft 401; routes gebruiken daarnaast `requireApiAuthForKlant` | Publieke test geblokkeerd door Cloudflare 530; **onbekend, meten door eigenaar op NUC** | De claim in doc 01 dat deze paden nog publiek zijn is verouderd. Bewuste uitzondering: `/api/chat/bridge/*` |
| 0.2.3 server-side scope | Cross-tenant verzoek wordt 403 | **Repo-af:** `assertScopeAccess` en `requireApiAuthForKlant` worden door relevante routes gebruikt | **onbekend, meten door eigenaar op NUC** met fumero→bokas-test | Geen opgeslagen groen cross-tenant testresultaat |
| 0.2.4 scope in chatrequest | `klant` tegen sessiescope valideren | **Repo-af:** `/api/chat/stream` valideert vóór uitvoering | **onbekend, meten door eigenaar op NUC** | Code aanwezig; productiegedrag niet bewezen |
| 0.3.1 approvals-inbox | Cowork-inbox en health/status beschikbaar | **Repo-af:** redirect, inbox-count en approvals-route aanwezig | **onbekend, meten door eigenaar op NUC** | UI- en Telegram-keten niet live gemeten |
| 0.3.2 bookkeeping-degradatie | Bij `:8001` down geen lege crash | **Repo-af:** `lib/bookkeeping-bot.ts` retourneert expliciete offline-status/fallback | **onbekend, meten door eigenaar op NUC** | Faalproef met bookkeeping-bot uit is niet vastgelegd |
| 0.3.3 healthdashboard | Qdrant, bookkeeping en OpenClaw op één pagina | **Repo-af:** integration-readiness API en devpagina bevatten de probes | Publieke healthroute is niet bereikbaar; **onbekend, meten door eigenaar op NUC** | Probe-code bestaat, maar “groen” is niet aangetoond |
| 0.3.4 smoke/verify | Reproduceerbare live verificatie | **Repo-af:** `smoke-quality.mjs`, `verify-live.sh` en `e2e-hybrid.mjs` bestaan | **onbekend, meten door eigenaar op NUC** | Geen recente uitvoer aangetroffen |
| Secrets-inventaris | Weten waar credentials leven; verweesde keys weg | **Niet aangetroffen:** geen actuele inventaris of aftekenbewijs | **onbekend, meten door eigenaar op NUC/Hetzner** | Golf 0-item staat open |

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
| Versie met CVE-fixes | Geen serverversie-pin of actuele versie-uitvoer gevonden | **onbekend, meten door eigenaar op NUC** | Niet bewezen |
| Token-auth | Motor-client ondersteunt `OPENCLAW_GATEWAY_TOKEN`, maar een lege token blijft toegestaan | **onbekend, meten door eigenaar op NUC** | Deels; clientondersteuning is geen serverhardening |
| Loopback + Tailscale-only | Clientdefault is `127.0.0.1:18789`; geen bind-/firewallconfig van de Gateway gevonden | **onbekend, meten door eigenaar op NUC** | Niet bewezen |
| WebSocket-originvalidatie | Geen OpenClaw-serverconfig gevonden | **onbekend, meten door eigenaar op NUC** | Niet bewezen |
| Skills-allowlist uit eigen git | Geen complete, actieve allowlistconfig aangetroffen | **onbekend, meten door eigenaar op NUC** | Niet bewezen |
| Side effects via Action Gateway | Action Gateway bestaat nog niet als component | Nee in repo | Niet geïmplementeerd |
| Canonieke ADR | ADR-101–109 staan in `DECISIONS.md`; doc 07 §30 is index-only | N.v.t. | Gespiegeld; runtimebewijs voor ADR-101/106 blijft open |

**Golf 0-eindoordeel:** de repo-items voor kennisbank, schema en auth zijn grotendeels af. Golf 0 als geheel is **niet af**, omdat OpenClaw-hardening, secrets-inventaris en de live 401/403-/healthbewijzen ontbreken.

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

| Milestone | Plan zegt | Repo zegt | Draait | Verschil / status op 2026-07-27 |
|---|---|---|---|---|
| M0 — geen nieuwe SQLite-only tabellen | Vanaf 2026-06-20 | Voor kerndata bestaan PG-schema’s, maar er is geen gate die nieuwe SQLite-only tabellen voorkomt | **onbekend, meten door eigenaar/reviewer via historie** | Niet aantoonbaar afgerond uit alleen deze snapshot |
| M1 — Postgres live | 2026-06-28 | Compose, init en backupscript bestaan | **onbekend, meten door infra-operator op Hetzner** | Config aanwezig; container, bereikbaarheid en backup ontbreken als bewijs |
| M2 — dual-write aan | 2026-07-05 | Gedeeltelijk geïmplementeerd; template staat standaard uit | **onbekend, meten door eigenaar op NUC/Hetzner** | Geen bewijs van effectieve flag of rijpariteit |
| M3 — migratie gedraaid | 2026-07-19 | `migrate-sqlite-to-postgres.mjs` migreert auth, chat, approvals en knowledge; readiness-checklist staat open | **onbekend, meten door eigenaar op NUC/Hetzner** | Script aanwezig, uitvoering niet bewezen |
| M4 — Postgres SSOT | 2026-07-26 | Primary/fallback-flags zijn niet aan de SQLite-routes gekoppeld | Niet mogelijk conform ADR met deze code | **Niet gehaald in code; deadline verstreken** |
| M5 — RLS productie | 2026-08-02 | RLS-migraties en workspace-contextcode bestaan | **onbekend, meten door eigenaar op NUC/Hetzner** | Schema gereed; toegepaste migraties en cross-tenant test onbekend |
| M6 — SQLite uit productie | 2026-08-09 | Uitschakelflag heeft geen caller; SQLite blijft read/write openen | Nog niet meetbaar | Nog niet verschuldigd, maar huidige code kan het criterium niet afdwingen |

### Rijtellingen en migratiebewijs

| Store | Meting op 2026-07-27 | Conclusie |
|---|---|---|
| Productie-SQLite `~/AI_HQ/data/ai-motor.db` | Ontbreekt in de audit-VM | **onbekend, meten door eigenaar op NUC** voor `auth_users`, `chat_history`, `approvals`, `knowledge_documents` |
| Postgres op Hetzner | Geen `DATABASE_URL` of live toegang in auditomgeving | **onbekend, meten door infra-operator op Hetzner** voor `users`, `chat_history`, `approvals`, `knowledge_documents` en gemigreerde `legacy_sqlite_id`-rijen |
| `ai-motor/motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |
| `ai-motor/lib/db/ai-motor.db` | Getrackt placeholderbestand, 0 bytes | Geen productiegegevens |
| Migratie-uitvoer | Geen log/rapport met “Migration complete” of bron-/doeltellingen aangetroffen | M3 niet bewijsbaar |

Een kale totaaltelling is niet genoeg voor M3: het script dedupliceert en vertaalt `auth_users` naar `users`/memberships. De eigenaar moet daarom zowel totalen als aantallen met `legacy_sqlite_id` rapporteren.

## Welke 2.2-componenten bestaan werkelijk?

| Component | Plan zegt | Repo zegt | Draait | Verschil / conclusie |
|---|---|---|---|---|
| Motor Kernel | PG `tasks`, append-only `task_events`, approvals en lifecycle-API | Geen Kernel-module, `/api/kernel`, PG-`tasks` of `task_events`; wel legacy SQLite `automation_tasks`/`automation_runs` en approvals | **onbekend, meten door eigenaar op NUC** voor legacy routes | **2.2-Kernel bestaat niet** |
| Action Gateway | Centrale policy- en credential-broker vóór side effects | Geen Gateway-route, risicoklassen, argument-hash, reservering/settlement of centrale credential-broker; alleen lokale budget/policy-fragmenten | Nee als 2.2-component | **Bestaat niet** |
| Playbook-registry | Git-playbooks plus versie/status/tenant | Geen `playbooks/`-registry of PG-register; `motor_skills` is een SQLite prompt-/skilltabel en `motor-test-playbook.md` is een handmatig logboek | Nee als 2.2-component | **Bestaat niet**; bovendien bevroren door AM-1 |
| Canonieke engine | Eén gekozen engine; n8n alleen adapter | Inngest-dependency, serve-route, events en één `approval-hitl`-functie bestaan; n8n en SQLite-cron blijven feitelijke orchestrators | **onbekend, meten door eigenaar op NUC/Hetzner** | Geen canonieke engine gekozen of bewezen |
| `lib/inngest/` | Durable enginebasis | Meer dan een lege skeleton: approvals emitten events en één workflow doet `waitForEvent`; zonder keys wordt verzenden bewust no-op. Relay/reminder-events hebben geen eigen handler | **onbekend, meten door eigenaar op NUC/Hetzner** | **Gedeeltelijk geïntegreerde pilot, niet de engine** |
| Adapters/executors | Achter Kernel/Gateway | OpenClaw-, n8n-, local-executor-, PC-bridge-, browser- en automation-adapters bestaan verspreid | **onbekend, meten door eigenaar op NUC/Hetzner** | Bruikbare code, maar geen centrale dispatch/policy |
| Evidence/observability | Taskgebonden evidence, traces en audit | Langfuse-chat-tracing, audit- en usagepaden bestaan; geen taskgebonden evidence-model of Gateway-beslislog | **onbekend, meten door eigenaar op NUC/Hetzner** | Deels |
| DBOS/Temporal/Restate/Hatchet | Alleen kandidaten/referenties | Geen applicatie-integratie aangetroffen | Nee | Geen verborgen tweede engine in code |

## State-stores die de repo werkelijk ondersteunt

De repo bevestigt meer dan zes persistentiemechanismen of externe state-eigenaren. Hij bewijst niet dat ze allemaal tegelijk live zijn.

| Store / waarheid | Repo zegt | Live status | SoT-probleem |
|---|---|---|---|
| ai-motor SQLite | Altijd geopende read/write database voor chat, conversations, approvals, automation en meer | **onbekend, meten door eigenaar op NUC** | Feitelijke primaire app-state in code |
| Postgres/Drizzle | Workspace-, tenant-, audit-, usage- en master-contextschema’s; gedeeltelijke dual-write | **onbekend, meten door infra-operator op Hetzner** | Parallel aan SQLite; nog geen volledige SSOT |
| Qdrant | Kennisbank- en memorycollecties via externe service | **onbekend, meten door infra-operator op Hetzner** | Bedoelde vector-SSOT; live collecties/counts onbekend |
| Filesystem | Uploads, photo-studio-assets, campaignpacks en projectbestanden onder `$HOME/AI_HQ` | **onbekend, meten door eigenaar op NUC** | Persistente blobs buiten DB; retentie/backup niet als geheel bewezen |
| Inngest run-state | Externe durable state zodra keys actief zijn | **onbekend, meten door eigenaar op NUC/Hetzner** | Approval-state blijft daarnaast in SQLite |
| n8n interne state | Veel actieve webhook-/automation-aanroepen in code | **onbekend, meten door infra-operator op Hetzner/NUC** | n8n is in code nog de-facto orchestrator |
| Dify interne state | Builder/artifact-integratie en deploydocumentatie aanwezig | **onbekend, meten door infra-operator op Hetzner** | Geplande decommissioning; actuele locatie/status onbekend |
| Langfuse Cloud | Optionele chat-traces | **onbekend, meten door eigenaar** | Extra observability-store; DPA/retentie niet live bewezen |
| Browser-localStorage | Zustand-stores voor UI-voorkeuren | Alleen client-side | Geen server-SSOT, wel gebruikersstate |
| `EXECUTION_BOARD.db` | Getrackt legacybestand: 20.480 bytes, tabellen `projects` en `tasks`, beide 0 rijen | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Leeg in Git, maar code/legacy kan elders een kopie gebruiken |
| Chroma legacy | `db/chroma.sqlite3`: 2 collecties; `factory_brains/chroma.sqlite3`: 1 collectie | Repo-artifact, runtimegebruik **onbekend, meten door eigenaar** | Tweede/derde vectorwaarheid blijft als legacy aanwezig |
| `omega_db` | Legacy Python-code verwijst naar eigen DB; productiebestand niet in auditomgeving | **onbekend, meten door eigenaar op NUC** | Nog een mogelijke taakwaarheid |

## Services op NUC, Hetzner en inference-PC

De laatste gecommitte snapshots zijn te oud om als actuele status te gelden: op 2026-02-13 stond OpenClaw `failed` wegens een ontbrekende token en was `omega-holding` `active (exited)` maar disabled; `factory-os/docs/V3_STATUS.md` markeerde n8n, Qdrant en Ollama op 2026-04-19 als actief. Ze bewijzen alleen dat meerdere topologieën eerder hebben gedraaid.

### NUC

| Service | Plan/config zegt | Draait | Verschil |
|---|---|---|---|
| Motor Next.js | PM2 `ai-motor`, poort 3040, één instance | **onbekend, meten door eigenaar op NUC** | Publieke tunnel gaf fout 1033; intern proces niet meetbaar |
| local-executor | PM2 `local-executor`, poort 8790 | **onbekend, meten door eigenaar op NUC** | Alleen ecosystemconfig aanwezig |
| OpenClaw gateway | Poort 18789, gehardened | **onbekend, meten door eigenaar op NUC** | Hardening niet bewezen |
| bookkeeping-bot | Poort 8001 | **onbekend, meten door eigenaar op NUC** | App degradeert netjes, maar service-status onbekend |
| Cloudflare Tunnel | `motorsai.app` naar Motor | Publieke route **niet beschikbaar** op meetmoment (1033/530) | Tunnel/origin moet worden gemeten; interne Motor-status volgt hier niet uit |
| Legacy omega/n8n/Qdrant/Ollama-containers | Oude docs noemen verschillende NUC-stacks | **onbekend, meten door eigenaar op NUC** | Repo bevat tegenstrijdige historische topologieën |

### Hetzner

| Service | Plan/config zegt | Draait | Verschil |
|---|---|---|---|
| Postgres | `motor-postgres`, core, poort 5432 loopback-bind | **onbekend, meten door infra-operator op Hetzner** | Compose is geen live bewijs |
| Qdrant | `motor-qdrant`, core, poort 6333 | **onbekend, meten door infra-operator op Hetzner** | Collecties/counts onbekend |
| Ollama embed | `motor-ollama`, core, poort 11434 | **onbekend, meten door infra-operator op Hetzner** | Modelaanwezigheid onbekend |
| LiteLLM | Optioneel compose-profiel, poort 4000 | **onbekend, meten door infra-operator op Hetzner** | Named routes niet live bewezen |
| n8n | Optioneel compose-profiel, poort 5678 | **onbekend, meten door infra-operator op Hetzner** | Code gebruikt n8n breed; actuele host onbekend |
| Dify | Losse stack onder `/opt/dify/docker` | **onbekend, meten door infra-operator op Hetzner** | Niet in unified compose |
| Engine/Kernel/Gateway | AM-3 plaatst ze hier, co-located met PG | Niet als volledige componenten in repo | Target, geen huidige runtime |
| Monitoringhub | AM-3: Uptime Kuma/Beszel-hub op Hetzner | **onbekend, meten door infra-operator op Hetzner** | Geen actuele status aangetroffen |

### Inference-PC

| Onderdeel | Plan zegt | Huidige staat | Open punt |
|---|---|---|---|
| Hardware/OS | Ryzen 7, 32 GB, RTX 3090, Ubuntu LTS headless | In aanbouw; geen runtimebewijs | **onbekend, bevestigen door eigenaar** |
| Rol | Stateless inference-worker in execution plane; alleen via Tailscale/LiteLLM | Nog geen taken toegestaan vóór Gateway/policy | Geen afwijking: dit is een harde blokkade |
| Locatie | Prompt laat dit bewust open | **onbekend, bevestigen door eigenaar** | Vastleggen vóór ingebruikname; bepaalt single-site-risico |
| Voeding | Doc 12 adviseert ≥850 W en twee aparte PCIe-kabels | **onbekend, bevestigen door eigenaar** | Bevestigen vóór GPU-belasting |
| Opslag | Doc 12 adviseert 1–2 TB NVMe | **onbekend, bevestigen door eigenaar** | Capaciteit/modelcachebeleid vastleggen |
| Runbook/monitoring | Tailscale-only, Beszel-agent, failovertest en inference-worker-runbook | Runbookbestand niet aangetroffen | Open punt; geen taken op de box vóór Gateway/policy |

## Nog uit te voeren live metingen

Deze metingen veranderen niets en moeten door de genoemde operator op de echte hosts worden uitgevoerd. Deel uitvoer zonder secrets.

### Eigenaar op NUC

```bash
pm2 list
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
systemctl --user --no-pager status openclaw-gateway.service ai-motor-tunnel.service omega-holding.service
systemctl --no-pager status ollama.service

grep -E '^(USE_POSTGRES|POSTGRES_PRIMARY|SQLITE_FALLBACK)=' ~/AI_HQ/ai-motor/.env.local

sqlite3 -readonly ~/AI_HQ/data/ai-motor.db "
SELECT 'auth_users', COUNT(*) FROM auth_users
UNION ALL SELECT 'chat_history', COUNT(*) FROM chat_history
UNION ALL SELECT 'approvals', COUNT(*) FROM approvals
UNION ALL SELECT 'knowledge_documents', COUNT(*) FROM knowledge_documents;"
```

Daarnaast: unauthenticated 401 voor chat/conversations, een fumero→bokas 403-test, OpenClaw-versie/bind/auth/origin/allowlist en de output van de bestaande integration-readiness/smoke-scripts.

### Infra-operator op Hetzner

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
systemctl --no-pager --type=service --state=running
cd /opt/motor/infra/hetzner && docker compose ps
cd /opt/dify/docker && docker compose ps
```

Rapporteer daarnaast read-only Postgres-tellingen voor `users`, `chat_history`, `approvals` en `knowledge_documents`, inclusief het aantal rijen met een niet-lege `legacy_sqlite_id`; status van Drizzle-migraties; laatste geslaagde backup/restore-test; Qdrant point-counts; en health van LiteLLM/n8n.

## Goedkeuringspunt

Deze nulmeting maakt bewust geen runtime-aannames. Voor stap 2 zijn twee geldige vervolgen mogelijk:

1. de eigenaar vult de live metingen aan en keurt daarna deze tabel goed; of
2. de eigenaar accepteert alle gemarkeerde runtimevelden voorlopig als onbekend en keurt deze repository-baseline goed.

De eigenaar accepteerde op 2026-07-27 de repository-baseline en gaf opdracht stap 2–4 volledig af te ronden. De gemarkeerde live metingen blijven uitvoerblokkades voor deployment, niet voor documentconsolidatie.
