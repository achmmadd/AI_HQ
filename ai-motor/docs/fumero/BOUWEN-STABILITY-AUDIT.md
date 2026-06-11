# Bouwen stability audit

Laatst bijgewerkt: juni 2026.

## Scope

Deze audit kijkt naar structurele faalmodi in Motor AI Bouwen en het `full_app` pad, niet naar één incident. Recente symptomen waren: `Forbidden for workspace`, HTML waar JSON werd verwacht, kapotte gegenereerde HTML, verwarring tussen `full_app` upgrades, Node/better-sqlite ABI-problemen, poortverwarring en stale PM2-builds.

Belangrijkste gelezen codepaden:

- `lib/fetch-json-client.ts`
- `lib/auth-guards.ts`
- `app/api/apps/generate/route.ts`
- `app/api/apps/route.ts`
- `app/api/apps/[slug]/route.ts`
- `app/api/apps/[slug]/data/route.ts`
- `app/api/fumero/tools/route.ts`
- `lib/apps/apps-service.ts`
- `lib/apps/apps-db.ts`
- `lib/artifact-generate.ts`
- `lib/fumero/build-full-app-validation.ts`
- `docs/fumero/BOUWEN-STATUS.md`
- `docs/fumero/BOUWEN-ROADMAP.md`

## Executive summary

Veel recente fixes zijn echt aanwezig: Fumero workspace guards, JSON-aware client errors, stronger `full_app` generator contracts, schema-aware data API validation, publish smoke gates, Node 22 pinning and PM2 restart scripts. De terugkerende problemen blijven ontstaan omdat deze garanties nog niet als end-to-end contract worden afgedwongen in CI en runtime smoke checks.

De grootste resterende gap is niet een ontbrekende helper, maar ontbrekende integratiebewaking: routes worden niet samen met echte Next request/response, auth cookie, SQLite schema, content-type en running server getest. Daardoor kan een regressie nog steeds alleen in de browser of productie verschijnen als HTML fallback, stale build, verkeerde workspace scope of kapotte builder-output.

## Top 10 long-term root problems

1. **API JSON is not globally enforced.** Veel kritieke routes gebruiken `NextResponse.json`, maar er is geen route-level integration suite die bewijst dat `/api/apps/generate`, `/api/apps`, `/api/apps/[slug]`, `/api/apps/[slug]/data` en `/api/fumero/tools` nooit HTML of redirects teruggeven onder auth, forbidden, validation, builder-fail en exception paths.

2. **Workspace scope rules are fixed locally but not regression-proof.** `requireFumeroWorkspaceApi()` accepteert `fumero` en `all`, en blokkeert `bokas`/`personal`. Dat lost de oude `all`-only bug op. Het risico blijft dat nieuwe routes weer direct `requireWorkspaceApi(req, "all")`, ad-hoc `klant` body values of unguarded legacy paths gebruiken.

3. **Legacy and full-app storage paths coexist.** `apps`/`app_data` is het nieuwe full-app pad; `custom_apps` blijft legacy widget sync. `app/api/apps/route.ts` heeft een guarded `GET`, maar de `POST` schrijft nog naar `custom_apps` zonder Fumero guard. Dat kan verwarring geven bij handmatige tools, tests of toekomstige callers.

4. **Port and server role are inconsistent in tooling.** Production and package scripts use port `3040`; `scripts/test-fumero-scope.mjs` defaults to `3041`. That makes it easy to test a dead server, a dev server, or the wrong process and misdiagnose JSON/HTML/auth failures.

5. **PM2 production can lag behind source changes.** `safe-deploy.sh` and `pm2-safe-restart.sh` are good safeguards, but docs still mention known build failure/stale PM2 risk. Without a mandatory post-deploy route smoke, a fixed source tree can coexist with old `.next` output in production.

6. **Node/better-sqlite3 ABI is managed but fragile.** `.nvmrc`, `ecosystem.config.cjs`, `ensure-sqlite.sh`, and `pm2-safe-restart.sh` pin/rebuild for Node 22. The risk returns when people start Next dev with another Node, run PM2 with a different interpreter, or skip `STRICT=1 bash scripts/ensure-sqlite.sh`.

7. **Builder validation is strong but still mostly synthetic.** `generateFullAppArtifact()` validates schema/frontend blocks, fetch URLs, runtime style, HTML, multi-page requirements and publish smoke. Remaining risk: LLM output can pass string/rule validation but fail in a real browser against the actual data API/session/cookie flow.

8. **Health endpoints are split and incomplete for Bouwen.** `/api/health` checks n8n/dify only via `lib/health-checks.ts`; `/api/smoke-production` checks more dependencies via `lib/dependency-checks.ts`. Neither proves Bouwen readiness: Node ABI, SQLite schema, builder backend config, `/api/apps/*` JSON contract, Fumero auth scope and data API CRUD.

9. **Tests exist but are not CI-backed.** There are useful unit tests for fetch-json, auth scope mirroring, full-app validation, app auth and schema validation, but no `.github/workflows` were found and no single `npm test` script. The important route contracts are not automatically run before deploy.

10. **Database schema drift is runtime-created, not migration-audited.** `ensureAppsSchema()` creates `apps`, `app_data`, `app_users`, `app_sessions` in SQLite. This keeps local development easy, but can hide drift between SQLite, future Postgres, PM2 runtime data and tests unless schema checks are part of health and integration tests.

## Already fixed

- `fetchJsonChecked()` now reads text first, reports endpoint/status/content-type, converts HTML/Cloudflare timeout responses into user-friendly errors, and parses JSON error payloads.
- `requireFumeroWorkspaceApi()` allows `fumero` and `all` scopes and returns JSON `401/403` responses with `path`, `sessionScope`, and `requiredScope`.
- `/api/apps/generate`, `/api/apps` `GET`, `/api/apps/[slug]` `GET/PATCH`, and `/api/fumero/tools` are node runtime routes and use workspace guards on their main protected paths.
- `generateFullAppArtifact()` enforces `<<<SCHEMA>>>` and `<<<FRONTEND>>>`, full HTML, exact `/api/apps/{slug}/data` fetch paths, no React/import/export runtime, schema tables, multi-page routing checks and validation retries.
- `publishApp()` blocks broken full-app publishes via validation, smoke test, auth-required checks and shop checks.
- `/api/apps/[slug]/data` enforces table allowlist, schema validation, scoped access and mutation permissions.
- Node 22 is pinned by `.nvmrc`; PM2 uses a fixed Node interpreter; `ensure-sqlite.sh` rebuilds `better-sqlite3`; `pm2-safe-restart.sh` checks `.next/BUILD_ID`.
- `scripts/safe-deploy.sh` builds before PM2 restart and probes `/api/health`.

## Still risky

- There are no route integration tests proving JSON-only behavior across success and failure paths for `/api/apps/generate`, `/api/apps`, and `/api/fumero/tools`.
- `scripts/test-fumero-scope.mjs` defaults to port `3041`, while app scripts and PM2 use `3040`.
- `/api/apps` `POST` remains a legacy unguarded `custom_apps` path and should be either guarded, renamed, or explicitly excluded from Bouwen full-app flows.
- The public health endpoint is not a Bouwen readiness check and does not verify app schema, Node ABI, builder config, PM2 build freshness, or Fumero-scoped API JSON.
- No CI workflow or `npm test` script was found to run the existing tests plus integration tests.
- The generated app validation does not yet exercise a real browser/session/data API round trip by default.
- Browser/session cache problems are handled mainly by user reload/login, not by a deterministic diagnostic showing current session scope and target workspace.

## Stability hardening plan

### Phase 1: Contract tests for API JSON and workspace scope

- Add integration tests for `/api/apps/generate`, `/api/apps`, and `/api/fumero/tools`.
- Use a signed `motorsai_token` with `scope: "fumero"` and verify success/failure responses are always JSON.
- Add negative tests for `bokas`, `personal`, missing token and malformed JSON body.
- Assert `content-type` includes `application/json` and body never starts with `<!DOCTYPE`, `<html`, or Next error shell markup.
- Add a test helper for creating Fumero/all/bokas/personal session cookies.

### Phase 2: Bouwen health and smoke script

- Add `/api/bouwen/health` or extend `/api/smoke-production` with a Bouwen section.
- Check: `better-sqlite3` can load, `ensureAppsSchema()` succeeds, builder backend is configured, `MOTOR_BUILDER_*` env is visible, Node major matches `.nvmrc`, and core Bouwen routes respond JSON under Fumero scope.
- Add `scripts/smoke-bouwen.mjs` that creates a Fumero-scoped signed session and probes `/api/apps`, `/api/apps/generate` with a mocked/disabled builder mode where possible, and `/api/fumero/tools`.
- Default all local smoke scripts to `3040`; allow override with `PORT` or `BASE_URL`.

### Phase 3: Server/deploy standardization

- Standardize docs and scripts on `http://127.0.0.1:3040` for PM2/prod and local smoke.
- If a separate dev port is required, name it explicitly, e.g. `NEXT_DEV_PORT`, and never use it as a default in production smoke scripts.
- Make `npm run pm2:restart` or `npm run deploy:safe` the documented path after source changes.
- Add a post-restart smoke: `/api/health`, `/api/smoke-production`, `/api/bouwen/health`, and one Fumero-scoped `/api/apps` curl.

### Phase 4: CI gate

- Add `npm test` to run existing unit tests:
  - `lib/fetch-json-client.test.ts`
  - `lib/auth-guards.test.ts`
  - `lib/fumero/*.test.ts`
  - app/schema/auth tests
- Add route integration tests to that command.
- Add GitHub Actions or the repo's chosen CI equivalent to run install, type/lint where feasible, tests, and build.

### Phase 5: Database and generated-app runtime validation

- Add schema drift tests for `ensureAppsSchema()` and expected columns/indexes.
- Add a real data API integration test: create a generated app row, GET/POST/PATCH/DELETE `/api/apps/[slug]/data`, verify tenant isolation.
- Enable optional Playwright publish smoke for full-apps in pre-production and CI, not only behind manual env.
- Add a regression fixture for broken/truncated HTML and ensure generation/publish rejects it.

## Concrete verification commands

Run from `/home/pietje/AI_HQ/ai-motor`.

```bash
nvm use
node -v
STRICT=1 bash scripts/ensure-sqlite.sh
```

```bash
npx tsx --test lib/fetch-json-client.test.ts lib/auth-guards.test.ts
npx tsx --test lib/fumero/*.test.ts
```

```bash
npm run build
npm run pm2:restart
BASE_URL=http://127.0.0.1:3040 node scripts/smoke-motorsai.mjs
node scripts/test-fumero-scope.mjs 3040
```

```bash
curl -i -H 'Accept: application/json' http://127.0.0.1:3040/api/health
curl -i -H 'Accept: application/json' http://127.0.0.1:3040/api/smoke-production
```

After hardening, add these commands:

```bash
npm test
BASE_URL=http://127.0.0.1:3040 node scripts/smoke-bouwen.mjs
curl -i -H 'Accept: application/json' -H "Cookie: motorsai_token=$FUMERO_TOKEN" http://127.0.0.1:3040/api/apps
curl -i -H 'Accept: application/json' -H "Cookie: motorsai_token=$FUMERO_TOKEN" http://127.0.0.1:3040/api/fumero/tools
```

## Copy-paste coding-agent prompt

```text
Work in /home/pietje/AI_HQ/ai-motor.

Goal: make Motor AI Bouwen / full_app reliable end-to-end, not just fix one symptom. Recent failures included Forbidden for workspace, HTML returned where JSON was expected, broken generated HTML, full_app upgrade regressions, PM2 stale builds, Node/better-sqlite3 ABI mismatch, and port confusion between 3040/3041.

Read these files first:
- lib/fetch-json-client.ts
- lib/auth-guards.ts
- app/api/apps/generate/route.ts
- app/api/apps/route.ts
- app/api/apps/[slug]/route.ts
- app/api/apps/[slug]/data/route.ts
- app/api/fumero/tools/route.ts
- lib/apps/apps-service.ts
- lib/apps/apps-db.ts
- lib/artifact-generate.ts
- lib/fumero/build-full-app-validation.ts
- scripts/test-fumero-scope.mjs
- scripts/safe-deploy.sh
- scripts/pm2-safe-restart.sh
- package.json
- ecosystem.config.cjs
- docs/fumero/BOUWEN-STABILITY-AUDIT.md

Implement stability hardening with these requirements:

1. Write route integration tests for:
   - POST /api/apps/generate
   - GET /api/apps
   - GET and POST /api/fumero/tools
   - Include auth scopes: fumero, all, bokas, personal, and missing token.
   - Use createSignedSessionToken from lib/auth-session to create motorsai_token cookies.
   - Assert every API response has application/json content-type for success and error paths.
   - Assert no response body starts with <!DOCTYPE, <html, or a Next.js HTML error shell.
   - Verify fumero/all are allowed for Fumero routes and bokas/personal are rejected with JSON 403 including path/sessionScope/requiredScope.
   - Avoid calling a real paid builder in tests: mock/stub generation services or structure tests around validation/auth paths unless an existing local test pattern supports route module mocking.

2. Enforce JSON-only API responses for Bouwen routes:
   - Keep using NextResponse.json for all known error paths.
   - Wrap route handlers where needed so unexpected exceptions still return JSON with { error, detail?, path } and never framework HTML.
   - Do not convert app preview/page routes to JSON; only API routes.
   - Review /api/apps POST legacy custom_apps path. Either guard it with requireFumeroWorkspaceApi or explicitly split/rename/document it so Bouwen full_app callers cannot bypass workspace scope.

3. Add a server health endpoint/check script for Bouwen:
   - Add /api/bouwen/health or a Bouwen section in /api/smoke-production.
   - It must check: better-sqlite3 can load, ensureAppsSchema succeeds, Node major matches .nvmrc, builder backend availability via assertArtifactBuilderConfigured, and core route JSON readiness if feasible.
   - Do not expose secrets. Return booleans, status, service names, and safe hostnames only.
   - Add scripts/smoke-bouwen.mjs that creates a fumero-scoped session cookie and probes /api/apps, /api/fumero/tools, and the Bouwen health endpoint. It must fail on HTML, non-JSON, 5xx, wrong scope behavior, or wrong port.

4. Standardize port/server usage:
   - Use 3040 as the default for local PM2/prod smoke because package.json, ecosystem.config.cjs and safe-deploy use 3040.
   - Fix scripts/test-fumero-scope.mjs so default is 3040, with override via CLI arg or BASE_URL.
   - Search docs/scripts for 3041 and remove or clearly mark it as a non-default dev-only port if still needed.
   - Ensure smoke scripts print the base URL they actually test.

5. Add test/CI entry points:
   - Add an npm test script that runs fetch-json, auth-guards, fumero unit tests, schema/auth tests, and new route integration tests.
   - If there is no CI, add a minimal GitHub Actions workflow or project-appropriate CI config that runs npm install, npm test, and npm run build.
   - Keep tests deterministic and avoid real external model calls.

6. Rebuild/restart and verify:
   - Run: nvm use; STRICT=1 bash scripts/ensure-sqlite.sh
   - Run all tests via npm test or the exact npx tsx --test commands if npm test is not yet available.
   - Run npm run build.
   - Restart with npm run pm2:restart or npm run deploy:safe.
   - Verify with curl using a fumero-scoped session:
     * GET /api/apps returns JSON, HTTP 200, no HTML.
     * GET /api/fumero/tools returns JSON, HTTP 200, no HTML.
     * POST /api/apps/generate returns JSON for validation/auth/builder-failure paths; no HTML.
     * GET /api/bouwen/health or /api/smoke-production returns JSON.
   - Also verify bokas/personal scoped sessions get JSON 403 for Fumero routes.

7. Update docs:
   - Update docs/fumero/BOUWEN-STABILITY-AUDIT.md with what changed, exact commands run, and remaining risks.
   - If build/test/restart could not be run, say exactly why.

Do not mask failures with client-only fallbacks. The end state must be a server-enforced, test-backed contract: Bouwen API routes return JSON only, workspace scope is deterministic, the correct server/port is tested, PM2 runs a fresh build, SQLite native bindings match Node, and full_app generation/publish remains validated.
```
