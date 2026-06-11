# Bouwen — status vs Lovable

Laatst bijgewerkt: juni 2026.

## World-class nu (parity met Lovable)

| Capability | Status |
|------------|--------|
| P0 HTML-validatie (syntax, truncation, game-loop) | Live — 3 retries bij generate |
| Publish gate (validatie + smoke + UX ≥ 70) | Live — `publishTool()` blokkeert met duidelijke fout |
| Geen dashed Concept-placeholder als eindoutput | Live — seeds + `isDummyPlaceholderHtml` |
| Chatbot reference seed (KB-object, quick replies, toggle) | Live — `lib/fumero/seeds/chatbot-reference.html` |
| Flappy reference seed bij game-fallback | Live — gebundeld + extern pad |
| Versiegeschiedenis bij iterate | Live — INSERT nieuwe rij, oude concept → archived |
| Versie herstellen | Live — API `action: restore` + Geavanceerd-panel |
| Auto UX-check na create | Live — score in API, tool card, preview panel |
| Gestructureerd plan vóór build | Live — plan-modus of eerste build |
| Mobiele preview (375px) | Live — toggle in live-preview-panel |
| NL copy, geen emoji/dev-jargon in Bouwen UI | Grotendeels opgeschoond |

## Architectuur

```
User prompt → buildPrompt (deduped KB) → generateToolHtml (3× retry)
  → validateGeneratedHtml → createTool (geen placeholder)
  → getToolUxCheck → UI (card + preview)

Publish → validate + runBuildSmokeTest (UX ≥ 70) → published
Iterate → archive concept + INSERT version N+1
```

## Tests

```bash
cd AI_HQ/ai-motor
npx tsx --test lib/fumero/*.test.ts
```

**60 tests** (juni 2026) — incl. `app-auth.test.ts`, `app-schema-validation.test.ts`, full-app/shop-validatie.

## Full_app — Fase 0 + 1 (juni 2026)

| Capability | Status |
|------------|--------|
| Multi-page contract (`pages[]` + hash/data-page nav) | Live — `APP_FACTORY_BASE_INSTRUCTIONS` + validatie |
| Plan vóór build (Lovable-achtig) | Live — `formatFullAppBuildPlan()` in chat |
| Intent: website/shop/checkout/dashboard | Live — `detectFullAppIntent()` uitgebreid |
| Reference seed multi-page B2B | Live — `lib/fumero/seeds/full-app-multipage.html` |
| Publish gate (validatie + smoke + UX ≥ 70) | Live — `publishApp()` spiegelt `publishTool()` |
| Preview UX-score + validatiefouten | Live — live-preview-panel + app GET metadata |
| Mobiele preview 375px | Live — zelfde toggle als widgets |
| Data API table allowlist | Live — `apps.db_schema` op GET/POST/PATCH/DELETE |
| Kennisbank injectie op full_app generate | Live — `build-kennisbank-context.ts` |

## Full_app — Fase 2 (auth + 18+ gate) ✅

| Capability | Status |
|------------|--------|
| `app_users` / `app_sessions` tabellen | Live — `apps-db.ts` |
| Auth API register/login/logout/session | Live — `/api/apps/[slug]/auth/*` |
| End-user sessie-cookie (scoped per slug) | Live — `motor_app_sess_{slug}` |
| Page guard bij `auth_required=1` | Live — `AppAuthWall` op `/apps/[slug]` |
| Operator bypass | Live — `?preview=1` |
| `auth_required` admin toggle | Live — garage + PATCH `set_auth_required` |
| 18+-gate in generator + seeds | Live — "18 jaar en ouder" |
| Publish gate auth-check | Live — `validateAuthRequiredApp()` |

**Verify (Fase 2):** `npx tsx --test lib/fumero/app-auth.test.ts` — 4 tests groen.

## Full_app — Fase 3 (DB/API hardening) ✅

| Capability | Status |
|------------|--------|
| POST/PATCH row-validatie tegen schema | Live — `schema-validation.ts` → 400 + field_errors |
| Table allowlist | Live — Fase 1, uitgebreid in data route |
| Public data API voor gepubliceerde apps | Live — `resolveDataApiAccess()` |
| Auth-required apps: data API vereist sessie | Live |
| Viewer read-only (workspace_memberships) | Live — `assertDataMutationAllowed()` |

**Verify (Fase 3):** `npx tsx --test lib/fumero/app-schema-validation.test.ts` — 4 tests groen.

## Full_app — Fase 4 (Fumero B2B e-commerce) ✅

| Capability | Status |
|------------|--------|
| Shop templates (products, orders) in generator | Live — `APP_FACTORY_BASE_INSTRUCTIONS` |
| Reference seed B2B shop | Live — `lib/fumero/seeds/full-app-b2b-shop.html` |
| Checkout copy (bank + crypto, €49 min, 18+) | Live — seed + `validateShopApp()` |
| KB-injectie bij shop-prompts | Live — `isShopPrompt` + `loadFullAppB2bShopSeed` |
| Geen iDEAL/PayPal in shop-copy gate | Live — publish validatie |

**Verify (Fase 4):** `full-app-b2b-shop.html` passeert `validateShopApp` in `build-full-app-validation.test.ts`.

## Full_app — Fase 5 (dashboard / team admin) ✅

| Capability | Status |
|------------|--------|
| Schema-aware CRUD in data-modal | Live — toevoegen, bewerken, verwijderen per tabel |
| Team-tab interne full_apps | Live — `filterTeamWorkItems()`; placeholder alleen bij 0 items |
| Workspace scope op data-mutaties | Live — fumero/bokas via operator sessie |

**Verify (Fase 5):** garage data-modal CRUD + team-tab met interne apps; regressietests groen.

## Nog niet op Lovable-niveau (eerlijk)

| Item | Reden |
|------|--------|
| Playwright smoke in CI | Fase 7 — optioneel skeleton |
| LLM UX-review automatisch na elke full_app build | Fase 7 — rule-based score live |
| Copywriter/SEO connectors in Geavanceerd | Verwijderd uit UI (geen "Binnenkort" placeholders) |
| Bokas full_app pad + billing | Fase 6 |
| GitHub export full_app bundle | Fase 7 |

## Success criteria checklist

- [x] Broken Max Flappy pattern rejected, retry works
- [x] Chatbot build uses KB reference (bankoverschrijving + crypto, geen iDEAL als betaalmethode)
- [x] Publish blocked without validation/smoke pass
- [x] Iterate creates new version row
- [x] No dashed dummy placeholder as final output
- [x] UI zonder dubbele/dev-jargon strings in Bouwen-flow
- [x] Alle fumero lib tests (60)
- [x] Dit document

## Fumero Bouwen afgerond (Fase 0–5) — checklist juni 2026

- [x] Fase 0 — prerequisites (widget tests, KB, intent routing)
- [x] Fase 1 — multi-page full_app + publish gate
- [x] Fase 2 — end-user auth + 18+-gate
- [x] Fase 3 — schema-validatie + public data API
- [x] Fase 4 — B2B shop/checkout templates + seed
- [x] Fase 5 — schema-aware admin CRUD + team-tab

### P1/P2 platform (juni 2026)

| Item | Status |
|------|--------|
| Productie auth: geen `demo123` zonder `MOTORSAI_PASSWORD` | Live — `isLegacyPasswordLoginEnabled()` |
| Team invites SQLite (`workspace_invites`) | Live — persistent i.p.v. in-memory |
| Billing skeleton (`/api/billing/summary`, Stripe webhook stub) | Live — `/fumero/settings/billing` |
| Cross-tenant guards (`requireApiAuthForKlant`) op kpi/usage/afdelingen | Live |
| Playwright publish gate (`MOTORSAI_PUBLISH_PLAYWRIGHT=1`) | Live — API routes only |
| Pay UI (`/fumero/pay`) | Live — wired naar initiate |
| Afdelingen echte `usage_logs` kosten | Live |
| Team-tab Data-knop + `FumeroAppDataModal` | Live — zonder chat |

### Nog open (Fase 6–7 / Bokas)

| Fase | Focus | Status |
|------|--------|--------|
| **6** | Bokas `klant=bokas` pad, Stripe productie, Postgres-cutover | Backlog |
| **7** | Playwright CI, LLM UX-review full_app, GitHub export, React HMR | Backlog |
| **Build** | `reference-seeds`/`build-validation` in client bundle → `npm run build` faalt | Bekend — PM2 draait oude build |
