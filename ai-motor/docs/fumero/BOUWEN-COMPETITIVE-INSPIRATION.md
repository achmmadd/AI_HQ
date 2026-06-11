# Bouwen — competitive inspiration (final research pass)

Laatst bijgewerkt: juni 2026.

**Doel:** Concrete patronen uit Lovable, Bolt, v0, Replit Agent, Cursor/Windsurf en opkomende builders — vertaald naar één coherente architectuur voor Motor **full_app** (Phases 0–7 in `BOUWEN-ROADMAP.md`), zonder dubbel bouwen.

**Motor-context:** Widget-pad (`html`) heeft al Lovable-parity (`BOUWEN-STATUS.md`). Full-app is vanilla HTML + Motor data API — geen React/Supabase-stack.

---

## Competitor snapshot (2025–2026)

### 1. Lovable ([lovable.dev](https://lovable.dev))

| Patroon | Concreet gedrag | Bron |
|---------|-----------------|------|
| Plan → Build split | **Plan mode** = redeneren, plan document, geen code. **Build mode** = autonome uitvoering met zichtbare taken, file diffs, verificatie. Schakelbaar op elk moment. | [Plan mode](https://docs.lovable.dev/features/plan-mode), [Build mode](https://docs.lovable.dev/features/agent-mode) |
| Goedgekeurd plan persistent | Approved plan → `.lovable/plan.md`; eerdere plannen blijven in chat history. | [Plan mode](https://docs.lovable.dev/features/plan-mode) |
| Prompt queue | Berichten in wachtrij tijdens Build; reorder, pause, edit, repeat (tot 50×). | [Build mode](https://docs.lovable.dev/features/agent-mode) |
| Stop + undo | Stop behoudt partial work; undo revert naar vorige staat (betaald per voltooide work). | [Build mode](https://docs.lovable.dev/features/agent-mode) |
| `@file` guardrails | `@src/pages/dashboard` — scope wijzigingen, bescherm auth/layout. | [Build mode](https://docs.lovable.dev/features/agent-mode) |
| Supabase/Cloud backend | Schema, RLS, auth flows, edge functions uit NL-prompt; service role nooit in client (~1200 hardcoded keys/dag geblokkeerd). | [Supabase integration](https://docs.lovable.dev/integrations/supabase), [agent architecture](https://sarthakai.substack.com/p/lets-build-the-lovable-ai-agent-tutorialcode) |
| Multi-page routing | React Router; page navigator in editor; shared layouts. | [Getting started](https://docs.lovable.dev/introduction/getting-started) |
| Preview | Live preview modal; **web/mobile toggle**; refresh; publieke preview URL na publish. | [Getting started](https://docs.lovable.dev/introduction/getting-started) |
| Browser testing | Agent klikt formulieren, navigeert pages, screenshots, console/network; mobile/tablet/desktop breakpoints. | [Browser testing](https://docs.lovable.dev/features/browser-testing), [Testing overview](https://docs.lovable.dev/features/testing) |
| Versioning 2.0 | Date-grouped history, **bookmark stable versions**, restore = nieuwe edit card (git-revert-achtig). | [Versioning 2.0](https://lovable.dev/blog/product-updates/versioning-with-lovable-two-point-zero) |
| GitHub two-way sync | Eén actieve branch; PR workflow; staging preview vóór merge naar live. | [GitHub](https://docs.lovable.dev/integrations/github), [Publish guide](https://lovable.dev/guides/how-to-publish-a-web-app) |
| Knowledge | Workspace (10k) + project (10k) knowledge; AGENTS.md/CLAUDE.md in repo; project > workspace bij conflict. | [Knowledge](https://docs.lovable.dev/features/knowledge) |
| Publish | One-click publish → shareable URL; **re-publish na wijzigingen** expliciet gedocumenteerd. | [Getting started](https://docs.lovable.dev/introduction/getting-started) |

**Praise:** Snelheid tot werkend prototype/MVP; mooie UI; Supabase-integratie “uit de doos”; Plan/Build scheiding; versioning + GitHub. ([G2 ~4.6](https://www.nxcode.io/resources/news/v0-vs-bolt-vs-lovable-ai-app-builder-comparison-2025), [Product Hunt ~4.7](https://checkthat.ai/compare/bolt-vs-lovable))

**Complaints:** Credit burn + ondoorzichtige kosten; **bug loops** (fix introduceert nieuwe bug); ~70% klaar, laatste 30% pijnlijk; generieke designs; security/compliance gaps; security incident feb–apr 2026 (cross-tenant chat/source exposure). ([Superblocks review](https://www.superblocks.com/blog/lovable-dev-review), [AIToolGrade](https://aitoolgrade.com/review/lovable.html), [Reddit synthesis](https://webaistack.com/real-developer-insights-lovable-dev-reddit-community-reviews/))

---

### 2. Bolt.new ([bolt.new](https://bolt.new))

| Patroon | Concreet gedrag | Bron |
|---------|-----------------|------|
| Full environment control | AI beheert filesystem, npm, terminal, browser console in **WebContainers** — niet alleen code genereren. | [GitHub README](https://github.com/stackblitz/bolt.new) |
| Plan → build → publish | Support flow: design/plan → build → publish (Bolt hosting, Netlify, GitHub+CI/CD). | [Build your first app](https://support.bolt.new/building/build-your-first-app) |
| Stack | Vite, Next.js, React; Supabase handmatig of via prompt (Next.js auto-integratie beperkt). | [LogRocket guide](https://blog.logrocket.com/build-deploy-web-app-bolt-new/) |
| Preview | In-browser instant preview; HMR via WebContainer. | [GitHub README](https://github.com/stackblitz/bolt.new) |
| Deploy | `.bolt.host` one-click; export → Vercel/Netlify; GitHub voor productie. | [Codecademy](https://www.codecademy.com/article/build-an-app-with-bolt-new) |
| Batch prompts | Combineer kleine instructies in één bericht → minder token/credit burn. | [GitHub README](https://github.com/stackblitz/bolt.new) |

**Praise:** Snelheid prototype; zero local setup; one-click deploy voor demos. ([r/boltnewbuilders ~54% positief](https://aiunpacking.com/review/bolt-new/))

**Complaints:** Token/credit spiral op grote projecten (elke prompt leest hele codebase); **preview ≠ production**; error loops; WebContainer crashes; Trustpilot 1.4/5 (selection bias). ([Trickle](https://trickle.so/blog/bolt-new-review), [Bolt Reddit synthesis](https://webaistack.com/bolt-ai-unveiled-reddits-most-candid-insights-and-user-experiences/))

---

### 3. v0 ([v0.app](https://v0.app))

| Patroon | Concreet gedrag | Bron |
|---------|-----------------|------|
| UI-first | shadcn/ui + Tailwind + Next.js App Router; component- en full-app generatie. | [v0](https://v0.app/), [NxCode guide](https://www.nxcode.io/resources/news/v0-by-vercel-complete-guide-2026) |
| Design mode | Visuele fine-tuning naast chat; live preview. | [v0](https://v0.app/) |
| Agentic build | Plant taken, verbindt databases (2026 update). | [v0](https://v0.app/) |
| Integratie | `npx v0 add <url>`; GitHub branch/PR; one-click Vercel deploy. | [Vercel Academy](https://examples.vercel.com/academy/ai-sdk/ui-with-v0), [Afterbuild production guide](https://afterbuildlabs.com/resources/v0-to-production-guide) |
| Templates / design systems | Herbruikbare componenten en kleur/typografie tokens over projecten. | [v0](https://v0.app/) |

**Praise:** Beste React/Next UI-kwaliteit in categorie; naadloze Vercel-deploy.

**Complaints:** Geen native backend (Supabase/Stripe handmatig); credit tiers; output varieert sterk met prompt; “mooi maar geen logica”. ([NxCode comparison](https://www.nxcode.io/resources/news/v0-vs-bolt-vs-lovable-ai-app-builder-comparison-2025))

---

### 4. Replit Agent 4 ([replit.com](https://replit.com))

| Patroon | Concreet gedrag | Bron |
|---------|-----------------|------|
| Plan-while-building | Parallel plannen terwijl main build loopt; geen sequentiële blokkade. | [Agent 3→4 blog](https://replit.com/blog/whats-changed-agent3-to-agent4) |
| Task system | Kanban: Drafts → Active → Ready → Done; **isolated project copies**; apply/dismiss naar main. | [Task system](https://docs.replit.com/core-concepts/agent/task-system) |
| Agent modes | Lite (visueel/bugs) / Economy / Power (+ Turbo); Plan mode apart. | [Agent overview](https://docs.replit.com/references/agent/overview) |
| Design Canvas | Infinite board, live previews, frame → Artifact conversie. | [Agent 4 intro](https://replit.com/blog/introducing-agent-4-built-for-creativity) |
| Multi-artifact | Web, mobile (Expo), slides, data viz in één project; parallel artifacts. | [Agent 4 blog](https://replit.com/blog/whats-changed-agent3-to-agent4) |
| Publish | Alle artifacts deployen samen vanuit Project Editor. | [Agent overview](https://docs.replit.com/references/agent/overview) |

**Praise:** Eén omgeving build+run+ship; task isolation voorkomt broken main; parallel work.

**Complaints:** Kosten bij Power/Turbo; vendor lock-in Replit hosting; minder geschikt voor embed/vanilla constraints.

---

### 5. Cursor / Windsurf (IDE agents — relevant voor builder UX)

| Patroon | Motor-relevantie | Bron |
|---------|------------------|------|
| Plan → approve → execute | Cursor Plan mode; Windsurf Plan → markdown → **Implement** knop. | [Cursor agents](https://cursor.com/blog/long-running-agents), [Windsurf Plan mode](https://docs.windsurf.com/windsurf/cascade/modes) |
| Zichtbare agent progress | Task lists, file diffs, Agents Window (local + cloud). | [SwitchTools Cursor guide](https://www.switchtools.io/blog/cursor-agent-mode-ai-coding) |
| Persistent rules | Windsurf memories/rulebooks; Lovable-achtig → Motor heeft al `max-build-style.ts` + kennisbank. | [Windsurf Cascade](https://windsurf.com/cascade) |
| Verification loop | Terminal output → agent fix; niet primair “publish gate”. | [Cursor long-running agents](https://cursor.com/blog/long-running-agents) |

**Niet kopiëren als product:** Cursor/Windsurf zijn developer-IDE’s, geen no-code Bouwen voor Fumero-medewerkers. Wel: **Plan/Build UX**, **plan.md persistentie**, **@file scope**.

---

### 6. Emerging builders

| Product | Differentiator | Relevant voor Motor? | Bron |
|---------|----------------|----------------------|------|
| **Tempo** | Multi-agent **plan-first** (architecture diagrams, user flows) vóór code; React visual IDE. | Plan-UI vóór generate — ja; React-only — nee. | [SSOJet roundup](https://ssojet.com/blog/best-ai-app-builders) |
| **Softgen** | Next.js + Supabase; roadmap uit prompt; GitHub sync; pay-per-use credits. | GitHub export + roadmap UX — ja; stack — nee. | [softgen.ai](https://softgen.ai/) |
| **Anything (Create.xyz)** | Full-stack + iOS/Android; **Anything Max QA agent**; multi-model. | Autonomous QA na build — inspiratie voor smoke/UX gate. | [aitoolsatlas](https://aitoolsatlas.ai/tools/create-xyz) |

---

## A. Best-in-class patterns to adopt (prioritized)

Prioriteit voor **Fumero embed + full_app** — hoogste eerst.

### P0 — Must-have (Fase 0–1, foundation)

1. **Unified Plan → Build pipeline (één contract voor widget + full_app)**  
   - Plan: gestructureerd NL-plan in chat (bestaand widget-patroon) → bij goedkeuring `plan.md` equivalent in app-record (`build_plan` JSON of `apps.metadata`).  
   - Build: generate/refine met retry + zichtbare stappen (“Schema valideren”, “Navigatie check”, “Data-API coverage”).  
   - *Lovable:* [Plan mode](https://docs.lovable.dev/features/plan-mode) + [Build mode](https://docs.lovable.dev/features/agent-mode). *Motor:* extend `BOUWEN-STATUS.md` flow naar `publishApp()`.

2. **Multi-page contract in `<<<SCHEMA>>>` + client router**  
   - `pages: [{ id, title, route }]` in schema; hash- of `data-page`-router; shared `<nav>` + active state.  
   - *Lovable:* page navigator. *Motor:* Fase 1 in roadmap — **niet** aparte HTML per page.

3. **Publish gate parity voor full_app** (spiegel `publishTool()`)  
   - Validatie: ≥2 pages, nav, fetch-URL coverage, schema↔frontend kolom-match, geen truncation.  
   - Smoke: rule-based UX (bestaand) + optioneel fetch-mock smoke.  
   - Blokkeer publish met **één NL-foutmelding** (geen credit-achtige opaque errors).  
   - *Lovable weakness:* geen harde gate → bug loops. *Motor strength:* al live voor widgets.

4. **Layered knowledge (workspace + project + build)**  
   - Workspace: Fumero brand (`max-build-style.ts`, kennisbank-feiten).  
   - Project/app: `apps.metadata.knowledge` (schema, pages, betaalregels).  
   - Build-turn: deduped KB inject (`build-kennisbank-context.ts`).  
   - *Lovable:* [Knowledge](https://docs.lovable.dev/features/knowledge) — 10k/project; Motor kan groter via file-based kennisbank.

5. **Versioning + restore (bestaand uitbreiden naar apps)**  
   - INSERT nieuwe rij bij refine; `action: restore`; bookmark “stable” versie op app-card.  
   - *Lovable:* [Versioning 2.0](https://lovable.dev/blog/product-updates/versioning-with-lovable-two-point-zero).

### P1 — Core product (Fase 2–4)

6. **End-user auth scoped per `app_slug`**  
   - `/api/apps/[slug]/auth/*`; sessie cookie scoped; login/register als routed pages.  
   - Operator bypass via `?preview=1`.  
   - *Lovable:* Supabase auth; *Motor:* eigen `app_users`/`app_sessions` (geen Supabase).

7. **Schema-validatie op data writes + table allowlist**  
   - POST/PATCH valideert tegen `db_schema`; 400 + field errors.  
   - *Lovable:* RLS; *Motor:* server-side validation + tenant `klant` scope.

8. **Preview UX: desktop + 375px mobile toggle**  
   - Bestaand in `live-preview-panel.tsx` — **zelfde toggle voor full_app iframe**.  
   - *Lovable:* [Getting started](https://docs.lovable.dev/introduction/getting-started).

9. **Fumero e-commerce page templates in generator**  
   - `products`, `cart`, `orders` tabellen; checkout stub → `/api/fumero/pay/initiate`.  
   - KB-feiten hard in prompt (bank + crypto, €49, 18+, geen iDEAL).  
   - Reference seed `full-app-b2b-shop.html`.

10. **Refine guardrails (`@`-achtig)**  
    - Refine-prompt: “wijzig alleen checkout; niet auth-routes”; parser reject als nav/pages verwijderd.  
    - *Lovable:* `@file` references.

### P2 — Trust & ops (Fase 3, 5, 7)

11. **Post-build auto UX-check** (rule-based, geen credit)  
    - Score in tool card + publish threshold (≥70, zoals widgets).  
    - LLM UX-review optioneel/handmatig — niet auto-loop (vermijd Lovable bug-loop patroon).

12. **“Bekijk data” schema-aware CRUD**  
    - Admin modal + optioneel `/apps/[slug]/admin` in generated app.  
    - *Replit:* apply/review task result — vergelijkbaar voor intern team.

13. **GitHub export bundle** (static HTML + `manifest.json` met schema + API base URL)  
    - *Lovable/Bolt:* GitHub sync; Motor: one-way export voldoende voor Fase 7.

14. **Playwright smoke in CI voor published full_app**  
    - Nav click smoke: home → shop → checkout; geen broken fetch.  
    - *Lovable:* [Browser testing](https://docs.lovable.dev/features/browser-testing) — agent-driven; Motor: deterministic CI.

15. **Intent routing uitbreiden**  
    - “website met home en shop” → full_app zonder “app + database” keywords.  
    - *Bolt/Replit:* auto stack detection.

### P3 — Later (Fase 6–7)

16. **Workspace RBAC voor Team-tab** (`viewer`/`editor` via `workspace_memberships`).  
17. **Staging preview env** (concept vs published URL).  
18. **Prompt queue** (batch refine requests) — nice-to-have uit Lovable.

---

## B. Patterns to NOT copy (and why)

| Pattern | Waarom niet voor Motor/Fumero |
|---------|-------------------------------|
| **React + Vite/Next als default runtime** | Fumero embed vereist één vanilla `index.html`, geen modules ([`fumero-max.mdc`](../../.cursor/rules/fumero-max.mdc)). v0/Bolt/Lovable stack past niet in embed. |
| **Supabase als default backend** | Roadmap: SQLite → Postgres (ADR-002); geen Supabase. Wel: **server-side validation + tenant scope** als RLS-equivalent. |
| **Autonomous bug-fix loops zonder cap** | #1 user complaint (Lovable/Bolt): credit burn + regressions. Motor: **max 3 generate retries**, publish gate, **geen auto-retry op publish**. |
| **Opaque usage-based pricing in Bouwen UI** | Motor is intern Fumero-tool; toon **vaste stappen** (“Validatie mislukt: nav ontbreekt”), niet “1 credit”. |
| **WebContainer in-browser Node** | Bolt-specifiek; Motor serveert via Next preview route — eenvoudiger, minder preview≠prod gap. |
| **Credit-gated verification** | Lovable browser tests “on request”. Motor: rule-based smoke **gratis**; Playwright in CI. |
| **Public storage buckets default** | Lovable Cloud storage vaak public ([RapidDev](https://www.rapidevelopers.com/lovable-integration/supabase)). Motor: geen user file upload in v1 full_app. |
| **Vendor-lock full codebase** | Anything/Create.xyz lock-in. Motor: export bundle + eigen API. |
| **Parallel background tasks (Replit Pro)** | Complexiteit; Fumero v1 = single-thread build met versioning volstaat. |
| **Generic AI SaaS copy** | Lovable genereert Lorem/generic payment. Motor: **kennisbank = source of truth**, seeds, `isDummyPlaceholderHtml`. |

---

## C. Unified architecture recommendation (Phases 0–7, één ontwerp)

Eén **App Factory pipeline** — widget (`html`) en `full_app` delen dezelfde Bouwen-shell, kennisbank, versioning en publish-philosophy. Alleen de **artifact contract** en **runtime adapter** verschillen.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Fumero Bouwen Shell (/fumero/bouwen) + Max Chat routing                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ Intent detect   │────▶│ Plan (optional)  │────▶│ Generate / Refine       │
│ html | full_app │     │ build_plan JSON  │     │ 3× retry + parse        │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
         │                        │                          │
         │                        │                          ▼
         │                        │              ┌─────────────────────────┐
         │                        │              │ Artifact contract       │
         │                        │              │ html: single index.html │
         │                        │              │ full_app: SCHEMA+HTML   │
         │                        │              │   + pages[] in schema   │
         │                        │              └─────────────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Validation layer (shared lib/fumero/build-*-validation.ts)           │
│  • syntax / truncation / game-loop (html)                               │
│  • pages≥2, nav, fetch coverage, schema match (full_app)                │
│  • KB fact check (payment, 18+, €49)                                    │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ Preview         │────▶│ UX check (auto)  │────▶│ Publish gate            │
│ iframe + mobile │     │ score ≥ 70       │     │ concept → published     │
│ ?preview=1      │     │                  │     │ + smoke test            │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
         │                                                  │
         ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Runtime surfaces                                                       │
│  • /apps/[slug] — public (auth guard if auth_required)                  │
│  • /api/apps/[slug]/data — CRUD + schema validation                     │
│  • /api/apps/[slug]/auth/* — end-user sessions (Fase 2)                 │
│  • Motor admin: fumero-app-data-modal, Team-tab (Fase 5)                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼ (Fase 7)
┌─────────────────┐     ┌──────────────────┐
│ CI Playwright   │     │ GitHub export    │
│ on publish      │     │ static + manifest│
└─────────────────┘     └──────────────────┘
```

### Schema contract (full_app — implement once in Fase 1, extend in 2–4)

```json
{
  "tables": [{ "name": "products", "columns": [...] }],
  "pages": [
    { "id": "home", "title": "Home", "route": "#/" },
    { "id": "shop", "title": "Shop", "route": "#/shop" },
    { "id": "checkout", "title": "Checkout", "route": "#/checkout" },
    { "id": "dashboard", "title": "Dashboard", "route": "#/dashboard", "auth": true }
  ],
  "auth": { "required": false, "age_gate": true }
}
```

### Auth model (Fase 2 — twee lagen, niet vermengen)

| Laag | Wie | Mechanisme |
|------|-----|------------|
| Motor operator | Fumero-medewerker | Bestaand HMAC workspace auth |
| App end-user | Klant van gegenereerde app | `app_users` + `app_sessions` per `app_slug` |

### Data layer (Fase 3 — Postgres-ready)

- `apps.db_schema` = single source of truth voor generator **én** API allowlist/validation.
- `auth_required` flag wired in Fase 2; validated at publish.

### Waarom dit voorkomt dubbel bouwen

- **Geen aparte “website builder”** naast full_app — multi-page zit in hetzelfde HTML artifact.
- **Geen React full_app pad** in Fase 0–5 — Code workspace (`/fumero/code`) blijft apart tot HMR-merge (Fase 7 backlog).
- **Publish gate één keer ontwerpen** in Fase 1/3 (`lib/fumero/build-full-app-validation.ts` + `publishApp()`), niet opnieuw in Fase 7.

---

## D. One-shot implementation checklist

Als deze **20 items** live zijn, matcht Motor Lovable voor het Fumero use case (embed + B2B shop) en vermijdt het de bekende valkuilen.

| # | Item | Fase | Lovable-equivalent |
|---|------|------|-------------------|
| 1 | `pages[]` in schema + client-side router + shared nav | 1 | Page navigator |
| 2 | `parseAppFactoryOutput` valideert ≥2 pages + nav links | 1 | — |
| 3 | Reference seed `full-app-multipage.html` | 1 | Templates |
| 4 | `publishApp()` publish gate (validatie + smoke + UX ≥70) | 1/3 | Implicit publish |
| 5 | `build-full-app-validation.ts` + tests | 1 | Frontend tests |
| 6 | Intent: “website/shop/checkout” → full_app | 0/1 | Auto stack |
| 7 | Preview mobile toggle voor full_app iframe | 1 | Web/mobile toggle |
| 8 | Versioning: refine → new row; restore API | 0 | Versioning 2.0 |
| 9 | KB inject op elke generate/refine (deduped) | 0 | Project knowledge |
| 10 | `app_users` + `app_sessions` + auth API routes | 2 | Supabase auth |
| 11 | 18+-gate template in generator + page | 2 | Custom compliance |
| 12 | `auth_required` wired publish + middleware guard | 2 | Protected routes |
| 13 | POST/PATCH schema validation + 400 field errors | 3 | RLS + validation |
| 14 | Table allowlist uit `db_schema` | 3 | Schema sync |
| 15 | E-commerce tables + checkout flow + pay stub | 4 | Stripe integration |
| 16 | `full-app-b2b-shop.html` seed + KB copy check | 4 | — |
| 17 | Schema-aware admin CRUD modal | 5 | Supabase dashboard |
| 18 | Team-tab: interne full_apps + scope `fumero` | 5 | Collaboration |
| 19 | Playwright smoke in CI op publish | 7 | Browser testing |
| 20 | GitHub export: HTML + schema manifest | 7 | GitHub sync |

**Definition of done:** Alle items ✅ + widget regressietests groen (`npx tsx --test lib/fumero/*.test.ts`).

---

## E. Updated phase order (research-adjusted)

Roadmap-volgorde in `BOUWEN-ROADMAP.md` blijft **grotendeels correct**. Onderstaande tweaks voorkomen rework:

| Wijziging | Rationale | Nieuwe volgorde |
|-----------|-----------|-----------------|
| **Publish gate vroeger** | Lovable/Bolt falen door geen harde gate → bug loops. Widgets hebben dit al; full_app moet **met Fase 1**, niet pas Fase 3. | Fase 1 deliverables: `publishApp()` gate + `build-full-app-validation.ts` |
| **Fase 3 splitsen** | Data API hardening kan parallel met auth **na** multi-page contract staat. | 3a: schema validation (parallel met 2); 3b: publish gate polish + seed rows |
| **Fase 0: intent routing** | Replit/Bolt auto-detect stack/intent — voorkomt verkeerd pad. | Verplaats `detectFullAppIntent()` uitbreiding naar Fase 0 |
| **Fase 7: CI eerder optioneel** | Playwright kan starten zodra multi-page publish gate bestaat (Fase 1), niet wachten op Fase 6. | Start Playwright skeleton in Fase 1; volledige CI in Fase 7 |
| **Auth vóór e-commerce** | Checkout vereist sessie/cart identity. | Fase 2 vóór 4 (ongewijzigd) |
| **React HMR blijft post-v1** | v0/Bolt React preview niet nodig voor Fumero embed. | Fase 7 backlog (ongewijzigd) |

### Aanbevolen sequentie (6–8 weken, 1 dev)

```
Fase 0 (3–5d) → Fase 1 incl. publish gate (1–2w)
    ├─ parallel: Fase 3a data validation (start week 2)
    └─ Fase 2 auth (2–3w, start na week 1 router)
→ Fase 3b publish polish (3–5d)
→ Fase 4 e-commerce (2–3w)
→ Fase 5 admin/team (1–2w)
→ Fase 6–7 na Fumero-compleet
```

---

## Cross-competitor: wat users prijzen vs. bekritiseren

| Thema | Geprezen (alle platforms) | Bekritiseerd (alle platforms) |
|-------|----------------------------|------------------------------|
| Snelheid tot demo | “Minuten tot werkende URL” | Laatste 30% kost disproportioneel |
| Plan/Build | Duidelijke fases, minder chaos | Nog steeds prompt-afhankelijk |
| Preview | Instant feedback, mobile toggle | Preview ≠ production (Bolt) |
| Backend | Supabase/auth “magisch” (Lovable) | Security, RLS fouten, data leaks |
| Kosten | Gratis tier voor experimenteren | Credit/token loops, onvoorspelbaar |
| Versioning | Bookmark + restore (Lovable 2.0) | Geen rollback vóór GitHub (oude Lovable) |
| Verificatie | Browser tests (Lovable) | Auto-fix loops zonder menselijke gate |

**Motor differentiator:** Harde publish gate + kennisbank-feiten + vanilla embed + geen credit-gedreven auto-fix loops. Zwaktes die we moeten dichten: full_app parity, end-user auth, schema-validatie, e-commerce templates.

---

## Bronnen

### Official docs
- Lovable Plan mode: https://docs.lovable.dev/features/plan-mode  
- Lovable Build mode: https://docs.lovable.dev/features/agent-mode  
- Lovable Knowledge: https://docs.lovable.dev/features/knowledge  
- Lovable Testing: https://docs.lovable.dev/features/testing  
- Lovable Browser testing: https://docs.lovable.dev/features/browser-testing  
- Lovable GitHub: https://docs.lovable.dev/integrations/github  
- Lovable Supabase: https://docs.lovable.dev/integrations/supabase  
- Lovable Versioning 2.0: https://lovable.dev/blog/product-updates/versioning-with-lovable-two-point-zero  
- Bolt.new README: https://github.com/stackblitz/bolt.new  
- Bolt support — build first app: https://support.bolt.new/building/build-your-first-app  
- v0: https://v0.app/  
- Replit Task system: https://docs.replit.com/core-concepts/agent/task-system  
- Replit Agent overview: https://docs.replit.com/references/agent/overview  
- Windsurf Plan mode: https://docs.windsurf.com/windsurf/cascade/modes  
- Cursor long-running agents: https://cursor.com/blog/long-running-agents  

### Reviews & comparisons (2025–2026)
- https://checkthat.ai/compare/bolt-vs-lovable  
- https://www.nxcode.io/resources/news/v0-vs-bolt-vs-lovable-ai-app-builder-comparison-2025  
- https://www.superblocks.com/blog/lovable-dev-review  
- https://aitoolgrade.com/review/lovable.html  
- https://aiunpacking.com/review/bolt-new/  
- https://trickle.so/blog/bolt-new-review  
- https://ssojet.com/blog/best-ai-app-builders  
- https://sarthakai.substack.com/p/lets-build-the-lovable-ai-agent-tutorialcode  

### Motor intern
- `BOUWEN-ROADMAP.md` — Phases 0–7  
- `BOUWEN-STATUS.md` — widget Lovable parity  
- `lib/artifact-generate.ts` — `APP_FACTORY_BASE_INSTRUCTIONS`  
- `lib/fumero/tools-service.ts` — `publishTool()` pattern  
