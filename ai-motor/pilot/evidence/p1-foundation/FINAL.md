# FINAL — P1 Product Foundation

> Synthetische interne shell bovenop de gesloten P0-ruggengraat.
> Geen commit/push/PR/merge/deploy. Repo is publiek: geen echte secrets, IPs of bedrijfsdata.

```text
P1_FOUNDATION_SHA=f60fa9a4b3ec45c431a25239ddd74ceaf9c9a372
BASE_SHA=44d72545e3fb98f796286e67738338fbab34dc6f
RUNTIME_INTEGRATION_SHA=e53f18bf7b5d4aa3fd3f3e5b5eaee9c12a8a4434
FINAL_EVIDENCE_SHA=9f5996b9def883e1a2ee7c49681da31a4fd18094
CURRENT_P0_HEAD=514b33f0f33274da13bb083c5e6860087f58894e
CI_PYTHON_JOB_SHA=44d72545e3fb98f796286e67738338fbab34dc6f
WORKTREE=/tmp/aihq-p1-foundation
WORKTREE_PARENT=/tmp/aihq-p1-src
WORKTREE_CLEAN_AT_START=yes
BRANCH=pilot/p1-foundation
P0_COMPLETE=yes
P0_TESTS_BASELINE=225 pass / 0 fail / 1 skip
P1_PLUS_P0_TESTS=233 pass / 0 fail / 1 skip
P1_TESTS=8 pass (delta +8)
TESTS_EXIT=0
TYPES_P0=0
TYPES_APP=2
LINT_EXIT=0
LIVE_AUTHORITY=NONE
REAL_CONTEXT_USED=no
MASTER_MERGE=no
NEW_DEPENDENCIES=none
POSTGRES_MIGRATION=none
SQLITE=none
```

## Fase 0 — inspectie (voor edits)

```text
BASE_SHA=44d72545e3fb98f796286e67738338fbab34dc6f
WORKTREE_CLEAN=yes
P0_STATUS=P0_COMPLETE=yes; descendant of e53f18b and 514b33f; origin/pilot/runtime-activation = 44d7254 (CI python-job)
CURRENT_UI_STACK=Next.js 16 + React 19 + Tailwind 3 + Radix (slot/dialog/tabs/…) + existing design-system Button/Card
CURRENT_AUTH_SCOPE=cookie motorsai_token; roles admin/fumero/bokas; scopes all/fumero/bokas/personal
CURRENT_PERSISTENCE=app heeft Drizzle/Postgres/SQLite; P1 gebruikt uitsluitend in-memory typed read-models
EXISTING_P1_DRAFTS=eerdere incomplete poging (app/motor + components/p1, geen data-laag, geen tests, geen tenant-isolatie, draft/review/publish niet als aparte objecten). Weggegooid en opnieuw gebouwd. Geen 0009_*.sql aangetroffen.
BLOCKED=none for local synthetic build
```

Een eerdere worktree op `/tmp/aihq-p1-foundation` hing aan de P0-kloon. Die is verwijderd. Deze lijn gebruikt een eigen parent-clone (`/tmp/aihq-p1-src`) vanaf `origin/pilot/runtime-activation`.

`outputs/motor-ai-parallel-integratiesprint/05-PRODUCTGEHEUGEN-NA-DE-SPRINT.md` was in deze worktree niet aanwezig; overgeslagen.

## Wat gebouwd is

Interne Product Foundation in de bestaande Next.js-app. Geen klantproduct, geen CRM.

1. **Shell** — responsive; primaire nav **Nu / Projecten / Afdelingen**. Geen runtime- of modelnamen in de nav.
2. **Nu** — attention-inbox Vraag → Actief → Jij nodig → Klaar. Toont approvals, failures en uitkomsten. Referenties zijn id's; technische logs zijn geen primaire UX.
3. **Projecten** — doel, team, contextstatus (manifest-digest, nooit inhoud), taken, artifacts, tijdlijn. Draft / review / publish zijn aparte objecten. Publish is zichtbaar DENY, ook na approved review.
4. **Afdelingen** — configureerbare capabilities + teams (Reviewkring, Koppelingen). Geen legacy sales/finance/hr-taxonomie.
5. **Roster** — Human (Mira Vos) en AI Employee (Motor Reviewer). Identity, Employee, Task, Run, Attempt, Agent, Runtime en Model blijven aparte begrippen. Runtime/model-labels zitten alleen intern en verdwijnen uit view-models.
6. **Typed BlockManifest** — schema, scopes, effects, risk, evidence. Frozen compositie-data: geen `execute`/`invoke`, geen SSOT, geen authority.

Route: `/motor` (bestaande cookie-auth; redirect naar login indien geen sessie). De pagina krijgt uitsluitend `serializeFoundationView("ws-motor")`.

Synthetische tenants: `ws-motor` / "De Linde (demo)" (zichtbaar) en `ws-anders` / "Noordkaap Intern" (niet zichtbaar, niet muteerbaar).

## Bestanden (nieuw, uncommitted)

- `ai-motor/pilot/p1-foundation.ts`
- `ai-motor/pilot/p1-foundation.test.ts`
- `ai-motor/app/motor/page.tsx`
- `ai-motor/components/p1/ui.tsx`
- `ai-motor/components/p1/p1-foundation-shell.tsx`
- `ai-motor/pilot/evidence/p1-foundation/SHADCN-SOURCE.md`
- `ai-motor/pilot/evidence/p1-foundation/FINAL.md`

Geen P0-bestanden, geen governance-docs, geen workflow-edits, geen compose/store/gateway, geen migratie.

## UI-primitieven

Zie `SHADCN-SOURCE.md`. Officiële MIT shadcn Button / Card / Badge, lokaal gethematiseerd. Geen nieuwe npm-dependency. Reeds aanwezige `@radix-ui/react-slot` en `class-variance-authority`.

## Validatie (Hetzner-builder, `/tmp/pv-p1`, `node:24-alpine`)

Kopie via rsync van de worktree; geen git push. Geen nieuwe installs op de host.

```text
TESTS_EXIT=0
ℹ pass 233
ℹ fail 0
ℹ skipped 1
TYPES_P0=0     # tsc --noEmit -p pilot/tsconfig.json
TYPES_APP=2    # tsc --noEmit -p tsconfig.json — pre-existing P0: TS5097 .ts-imports + enkele conformance-types; geen nieuwe fout in app/motor of components/p1
LINT_EXIT=0    # eslint lib/adr110 pilot --max-warnings 0
```

P1-suite (8): Nu→Project→Afdeling, nav zonder runtime/model, tenant-isolatie, geen legacy-taxonomie, geen secrets/context/logs in view-models, draft/review/publish + publish DENY, roster-scheiding, BlockManifest niet-uitvoerbaar.

De skip is de bestaande alpine-conformance-modus zonder python (P0).

## Grenzen (ongewijzigd)

```text
LIVE_AUTHORITY=NONE
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
COMMIT=no
PUSH=no
```

## Bewust niet gedaan

Geen Postgres-migratie, geen SQLite, geen nieuwe dependencies, geen live-stack, geen P0-evidence-edit, geen governance-doc, geen workflow-edit, geen deploy.

## Blokkades

1. **Uncommitted tot ownerratificatie.** `P1_FOUNDATION_SHA` blijft `UNCOMMITTED_UNTIL_OWNER_APPROVAL` tot `COMMIT P1`.
2. **TYPES_APP=2** is de bestaande app-tsconfig versus P0 `.ts`-extensies. Geen P1-regressie; `TYPES_P0=0`.
3. **Geen visuele browser-smoke.** Tests lopen via read-model helpers, zoals gevraagd.

Wacht op `COMMIT P1`. Daarna apart `PUSH P1`.
