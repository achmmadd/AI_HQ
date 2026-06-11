# Bouwen — roadmap full_app (Fumero-first)

Laatst bijgewerkt: juni 2026.

Stapsgewijs plan om Motor AI **Bouwen** compleet te maken voor multi-page websites, login/registratie, database + API, en volledige B2B-webshops — eerst Fumero, daarna Bokas en persoonlijk lab.

**Gerelateerd:** `BOUWEN-STATUS.md` (widget-parity), `STATUS.md` (Fumero v1), `design-builder.md` (design tokens).

---

## Huidige staat

### Widget-pad (`html`) — productie-klaar

Per `BOUWEN-STATUS.md` is het HTML-widget-pad op Lovable-niveau:

- P0-validatie met retries, publish gate (validatie + smoke + UX ≥ 70)
- Versiegeschiedenis, auto UX-check, NL copy, geen dummy-placeholders
- Reference seeds (chatbot, Flappy), mobiele preview

### Full-app-pad (`full_app`) — scaffold

`generateFullAppArtifact` in `lib/artifact-generate.ts` levert **één vanilla HTML-document** met CRUD via `/api/apps/[slug]/data`. Dat is een werkende basis, maar nog geen complete Bouwen-flow voor websites of SaaS:

| Onderdeel | Wat er is | Wat ontbreekt |
|-----------|-----------|---------------|
| Generatie | `<<<SCHEMA>>>` + `<<<FRONTEND>>>`, JSON-schema-validatie, fetch-URL-check | Multi-page contract, shared nav, page-schema in `db_schema` |
| Runtime | `ProjectRuntime`: `html` \| `react` \| `full_app` | `react` = Babel-sandbox, los van full_app data layer |
| Data API | GET/POST/PATCH/DELETE op SQLite `app_data` | Geen row-validatie tegen `db_schema`, geen table allowlist |
| Auth | Motor operator-login (HMAC-sessies) | Geen end-user register/login; `auth_required` altijd `0` |
| Publish | Status flip via `publishApp()` | Geen smoke/UX-gate zoals widgets |
| Deploy | GitHub + Vercel voor Code-artefacten | Full-app publish = alleen status, geen externe deploy |
| Multi-tenant | `klant` op apps, scope `fumero`/`bokas` | Geen per-app RBAC; Team-tab placeholder |

**Conclusie:** Widget Bouwen is af; full_app blokkeert “Fumero afgerond” voor klantgerichte websites en webshops.

---

## Full-app infrastructuur (audit)

| Area | Live | Backlog / placeholder |
|------|------|----------------------|
| `generateFullAppArtifact` | Anthropic/OpenRouter, schema ≥1 tabel, HTML-lengte, exacte fetch-URLs | Geen Fumero shop/checkout-templates |
| `lib/apps/apps-service.ts` | `generateFullApp`, `refineFullApp`, `publishApp` | `auth_required` ongebruikt |
| `app/api/apps/[slug]/data/route.ts` | CRUD op `app_data` | Geen schema-validatie op writes |
| Preview | `app/apps/[slug]/page.tsx`, `?preview=1` | `/apps/*` publiek in middleware |
| Auth | `/login`, `auth_users`, `requireWorkspaceApi` | Geen publieke registratie voor app-eindgebruikers |
| Database | SQLite (`apps` + `app_data`) | Postgres-cutover gepland (~aug 2026); geen Supabase |
| Intent routing | `detectFullAppIntent()` keyword-based | Mist “website met home/shop/checkout” zonder “app + data” |

---

## Fumero afdelingen — volledigheid

| Afdeling | Route | Status voor “Fumero afgerond” |
|----------|-------|------------------------------|
| **Chat (Max)** | `/fumero/chat` | **Compleet** — connectors, build routing, full-app cards |
| **Studio** | `/fumero/photo-studio` | **Compleet** (v1); post-v1 items in design spec |
| **Automations** | `/fumero/automations` | **Compleet** — tasks, runs, overview API |
| **Bouwen — widgets** | `/fumero/bouwen` | **Compleet** — Lovable-parity voor HTML |
| **Bouwen — full_app** | `/fumero/bouwen` | **Onvolledig** — blokkeert websites/SaaS |
| **Code** | `/fumero/code` | **Compleet** voor multi-file React/Next; niet gekoppeld aan full_app data API |
| **Bibliotheek** | `/fumero/bibliotheek` | **Compleet** |
| **Projecten** | `/fumero/projecten` | **Grotendeels compleet** — Team-tab placeholder |
| **Orders** | `/fumero/orders` | **Compleet** (Motor-side B2B, niet gegenereerde shop) |
| **Instellingen** | `/fumero/settings/*` | **Gedeeltelijk** — team panel live; gedeelde team-apps backlog |
| **Kennisbank** | Motor `/kennisbank` + build context | **Compleet** als build-input; geen Fumero-sidebar-item |
| **Pay** | `/fumero/pay` | **Placeholder** — API bestaat, env-afhankelijk |
| **Marketing / Email / Content** | redirects → chat/automations | **Deprecated** — bewust |

`STATUS.md` markeert v1 als productie-klaar, met expliciete post-v1 items: team-auth, full-stack UX-review, React HMR.

---

## Fasen 0–7

### Fase 0 — Prerequisites ✅ (juni 2026)

**Doel:** Stabiele platformaannames vóór full-app-uitbreiding.

| | |
|---|---|
| **Deliverables** | Widget Bouwen tests groen (`lib/fumero/*.test.ts`); Motor operator-auth gehard (scope enforcement per `MASTER-BUILD-PLAN` 0.2); documenteer `MOTOR_BUILDER_*` env voor full-app gen; unify apps-tabellen (`apps` vs `custom_apps` deprecatieplan); Fumero kennisbank-ingest geverifieerd voor build-copy |
| **Afhankelijkheden** | — |
| **Inspanning** | 3–5 dagen |
| **Succescriteria** | Alle Fumero-sidebar-routes laden authenticated; widget publish gate slaagt; `/api/apps/generate` werkt met Anthropic/OpenRouter; geen conflicterende app-storage-paden |

**Gedaan:** `MOTOR_BUILDER_*` gedocumenteerd in `lib/artifact-generate.ts`; `apps` = full_app storage, `custom_apps` = legacy widget-sync (comment in `apps-db.ts`); kennisbank injectie uitgebreid naar full_app prompts; `detectFullAppIntent()` uitgebreid.

---

### Fase 1 — Multi-page vanilla full_app ✅ (juni 2026)

**Doel:** Gegenereerde apps ondersteunen home / shop / checkout / dashboard als client-side routes in één HTML-document.

| | |
|---|---|
| **Deliverables** | Uitbreiding `APP_FACTORY_BASE_INSTRUCTIONS` in `lib/artifact-generate.ts`: `pages[]` in schema, hash- of `data-page`-router, shared `<nav>`, active state; `parseAppFactoryOutput` valideert ≥2 pages + nav; Fumero reference seed `lib/fumero/seeds/full-app-multipage.html`; Bouwen UX-copy voor “Website/App”; `lib/fumero/build-full-app-validation.ts` + tests |
| **Afhankelijkheden** | Fase 0 |
| **Inspanning** | 1–2 weken |
| **Succescriteria** | Prompt “B2B shop met home, shop, checkout, dashboard” levert gepubliceerde preview met werkende in-app navigatie; alle pages gebruiken dezelfde data API; refine behoudt routes + data |

**Gedaan:** `build-full-app-validation.ts`, `formatFullAppBuildPlan()`, `publishApp()` publish gate, preview UX-score, data API table allowlist (start Fase 3).

---

### Fase 2 — Auth (login, registratie, 18+ gate) ✅ (juni 2026)

**Doel:** Eindgebruikers van gegenereerde Fumero-apps kunnen registreren, inloggen en de leeftijdsgate passeren — gescheiden van Motor operator-auth.

| | |
|---|---|
| **Deliverables** | `app/api/apps/[slug]/auth/*` (register/login/logout/session) scoped op `app_slug` + `klant`; tabellen `app_users` / `app_sessions`; wire `auth_required` op publish + generator prompt; 18+-gate template in full-app instructions (Fumero-regel: “18 jaar en ouder”); middleware of page guard voor `/apps/[slug]` bij `auth_required=1`; admin toggle in app card / Geavanceerd |
| **Afhankelijkheden** | Fase 1 (login-pagina is een routed page) |
| **Inspanning** | 2–3 weken |
| **Succescriteria** | Gepubliceerde Fumero-app met auth blokkeert anonieme toegang behalve login/register/18+-gate; sessie blijft over pages heen; operator preview werkt met `?preview=1` |

**Gedaan:** `app_users`/`app_sessions`; `/api/apps/[slug]/auth/*`; `AppAuthWall`; `auth_required` toggle in garage; publish gate `validateAuthRequiredApp`; generator auth + 18+-instructies; tests in `app-auth.test.ts`.

---

### Fase 3 — Database + API hardening ✅ (juni 2026)

**Doel:** Betrouwbare datalaag voor productie-apps.

| | |
|---|---|
| **Deliverables** | Schema-validatie op POST/PATCH in `app/api/apps/[slug]/data/route.ts` (kolommen, types, required); table allowlist uit `apps.db_schema`; optionele seed rows bij generate; publish gate voor full_app (min pages, fetch coverage, schema match) spiegelend `publishTool()`; “Bekijk data”-modal in garage uitbreiden met schema-view |
| **Afhankelijkheden** | Fase 1–2 |
| **Inspanning** | 1–2 weken |
| **Succescriteria** | Ongeldige row geweigerd met 400 + field errors; publish geblokkeerd bij frontend/schema mismatch; refine breekt bestaande rows niet |

**Gedaan:** `validateRowAgainstSchema` op POST/PATCH; public published data API via `resolveDataApiAccess`; viewer read-only enforcement; tests `app-schema-validation.test.ts`.

---

### Fase 4 — E-commerce flows (Fumero B2B) ✅ (juni 2026)

**Doel:** Gegenereerde shop + cart + checkout aligned met Fumero-feiten (bank + crypto, €49 min, 18+).

| | |
|---|---|
| **Deliverables** | Full-app prompt templates: `products`, `cart`, `orders` tabellen; checkout flow (geen iDEAL); integratie met bestaande `/api/fumero/pay/initiate` of stub payment step; KB-injectie via `build-kennisbank-context.ts`; reference seed `full-app-b2b-shop.html` |
| **Afhankelijkheden** | Fase 1–3 |
| **Inspanning** | 2–3 weken |
| **Succescriteria** | Demo shop: browse → cart → checkout → order row in `app_data`; copy matcht kennisbank betaal-/leverregels; UX-check of handmatige checklist slaagt |

**Gedaan:** `full-app-b2b-shop.html` seed; `validateShopApp` + `isShopPrompt`; KB-injectie + shop templates in generator; publish gate shop-check.

---

### Fase 5 — Dashboard / admin voor tenants ✅ (juni 2026)

**Doel:** Fumero-medewerkers beheren gegenereerde app-data binnen Motor.

| | |
|---|---|
| **Deliverables** | Uitbreiding `fumero-app-data-modal.tsx` naar schema-aware CRUD; Projecten Team-tab toont interne apps (placeholder verwijderen bij items); role-based access (viewer/editor) via `workspace_memberships`; optioneel `/apps/[slug]/admin` route in gegenereerde apps |
| **Afhankelijkheden** | Fase 3–4 |
| **Inspanning** | 1–2 weken |
| **Succescriteria** | Team-tab toont interne full_apps; admin kan orders/products bewerken zonder chat; scope `fumero` ziet geen `bokas` app-data |

**Gedaan:** schema-aware CRUD in `fumero-app-data-modal.tsx`; Team-tab toont interne apps (placeholder alleen bij leeg); workspace viewer/editor op data-mutaties.

---

### Fase 6 — SaaS-ready (Bokas + billing hooks)

**Doel:** Tweede tenant en billing-fundament zonder custom code per klant.

| | |
|---|---|
| **Deliverables** | `klant=bokas` full-app pad getest; white-label checklist uit `docs/white-label-deploy.md`; connector stubs (Stripe/Mollie) → `coming_soon` → webhook skeleton; Postgres-migratie voor `apps`/`app_data` per ADR-002; workspace provisioning script |
| **Afhankelijkheden** | Fase 0–5 + platform Postgres-cutover |
| **Inspanning** | 3–4 weken |
| **Succescriteria** | Bokas-operator genereert/publiceert app; billing webhook logt event; RLS/cross-tenant curl faalt |

---

### Fase 7 — Parity polish

**Doel:** Lovable-niveau vertrouwen voor full_app CI en export.

| | |
|---|---|
| **Deliverables** | `runPlaywrightSmokeTest` in CI voor full_app publishes; LLM UX-review voor full_app (nu geblokkeerd in `motors-chat-panel.tsx`); GitHub export-pad voor full_app bundle; staging preview env; React HMR sandbox (post-v1 backlog) |
| **Afhankelijkheden** | Fase 1–6 |
| **Inspanning** | 2–3 weken |
| **Succescriteria** | CI faalt bij broken full_app publish; UX-review draait op full_app; one-click export levert deployable static + API manifest |

---

## Prioritering

### Blokkeert Fumero afgerond (eerst)

1. **Fase 1** — multi-page full_app (zonder dit is “website” ≠ compleet Bouwen)
2. **Fase 3** — data API-validatie + full_app publish gate (widgets hebben dit; apps niet)
3. **Fase 2** — end-user auth + 18+-gate (vereist voor gereguleerde Fumero klant-apps)
4. **Fase 4** — B2B shop/checkout (kern Fumero business narrative)
5. **Fase 5** — Team-tab / admin (`STATUS.md` noemt team-auth als post-v1 blocker)

### Nice-to-have (na Fumero compleet)

- Fase 6 Bokas/billing (expliciet na Fumero)
- Fase 7 Playwright CI, LLM UX-review voor full_app
- React HMR / Code workspace merge met full_app
- Supabase (niet in architectuur; Postgres is het pad)
- Pay page UI polish (API bestaat al)
- Copywriter/SEO connectors (`coming_soon` in registry)

### Al gedaan (niet opnieuw bouwen)

- Widget Bouwen pipeline (validatie, smoke, publish gate, versioning)
- Full_app generate/refine/publish scaffold
- SQLite `apps` + `app_data` + chat app cards
- Motor operator-auth + workspace scoping
- Kennisbank als build-input voor copy en feiten

---

## Tijdlijn

| Fase | Focus | Inspanning | Volgorde |
|------|--------|------------|----------|
| **0** | Prerequisites | 3–5 dagen | Start |
| **1** | Multi-page full_app | 1–2 weken | Na 0 |
| **2** | End-user auth + 18+ | 2–3 weken | Na 1 |
| **3** | DB/API + publish gate | 1–2 weken | Na 1–2 (deels parallel met 2) |
| **4** | Fumero e-commerce | 2–3 weken | Na 1–3 |
| **5** | Dashboard / team admin | 1–2 weken | Na 3–4 |
| **6** | Bokas / SaaS | 3–4 weken | Na Fumero + Postgres |
| **7** | CI / export polish | 2–3 weken | Na 1–6 |

### Schatting Fumero-compleet Bouwen (Fase 0–5)

**~8–12 weken** sequentieel met één developer.

Met gedeeltelijke overlap (Fase 1 + 3 parallel waar mogelijk): **~6–8 weken**.

Fase 6–7 vallen **buiten** de Fumero-afgerond-scope en volgen na Bokas/platform-cutover.

---

## Volgorde na Fumero

1. **Bokas** — zelfde full_app-pad met `klant=bokas` (Fase 6)
2. **Persoonlijk lab** — experimenten op bewezen stack
3. **Platform** — Postgres-cutover, CI-parity (Fase 7)

---

## Success criteria — Fumero Bouwen afgerond

- [x] Multi-page full_app: home, shop, checkout, dashboard in één gegenereerde app
- [x] End-user auth + 18+-gate op gepubliceerde klant-apps
- [x] Publish gate voor full_app (validatie + smoke + UX ≥ 70)
- [x] Data API valideert writes tegen schema (allowlist + row-validatie)
- [x] Demo B2B shop met correcte Fumero betaal-/levercopy (bank + crypto, geen iDEAL)
- [x] Team-tab toont interne apps; admin CRUD zonder chat
- [x] Widget-pad blijft groen (regressietests — 60 tests juni 2026)
