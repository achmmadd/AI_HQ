# Motor AI — Content Department roadmap

**Project:** `AI_HQ/ai-motor` · **Datum:** juni 2026  
**Status:** Platform roadmap (bevestigde visie)  
**North star:** Eerste EU-first AI e-commerce platform — Content Department levert **campaign packs** (niet losse plaatjes) vanuit **echte productfoto's**.

**Gerelateerd:**
- Layer 1 UI: [`DESIGN-SPEC-content-studio.md`](./DESIGN-SPEC-content-studio.md)
- Platform fundament: [`MASTER-BUILD-PLAN.md`](./MASTER-BUILD-PLAN.md)
- Tenant #1 status: [`fumero/STATUS.md`](./fumero/STATUS.md)
- Fumero pointer: [`fumero/CAMPAIGN-AGENCY-ROADMAP.md`](./fumero/CAMPAIGN-AGENCY-ROADMAP.md)

---

## A. Platformcontext

### A.1 Motor AI ≠ Fumero

**Motor AI** is het **basisplatform** — een white-label Factory OS voor EU MKB en e-commerce. **Fumero** is **tenant #1**: één bedrijf met meerdere markten (`.nl`, `.de`, `.com`), geen productnaam van het platform zelf.

| Concept | Betekenis |
|---------|-----------|
| **Motor AI** | Platform: auth, departments, wrap-engine, infra, billing (later) |
| **Wrap** | Branche-specifieke laag boven Motor: templates, policy, compliance, UI-copy, scene presets |
| **Tenant / company** | Eén klantorganisatie (bijv. Fumero BV) met één of meer locales |
| **Locale** | Taal + markt + policy-profiel (nl-NL, de-DE, en-GB/EU) |
| **Proof customer** | Fumero — HHC/e-com EU; valideert Content Department vóór andere wraps |

### A.2 Wrap-model: signup → branche → vertical wrap

Wanneer een **bedrijf zich aanmeldt**, creëert Motor AI automatisch een **wrap** op basis van hun **branche/vertical**:

```
Signup (bedrijfsnaam, branche, landen)
    │
    ▼
Branche selectie (e-commerce, horeca, retail, B2B, …)
    │
    ▼
Vertical wrap provisioning
    ├── Templates (campaign angles, scene presets, copy tone)
    ├── Policy profiles (Meta, branche-compliance, locale wetgeving)
    ├── UI copy (NL/DE/EN labels, opa-proof jargon)
    ├── Brand Kit defaults (kleuren, logo-placeholder, feed-velden)
    └── Knowledge seed (branche FAQ, geen klant-specifieke feiten)
    │
    ▼
Tenant workspace live (sidebar departments, scoped data, audit)
```

**Voorbeeld Fumero (wrap: `hhc-ecommerce-eu`):**

| Wrap-onderdeel | Fumero invulling |
|----------------|------------------|
| Branche | HHC / vape / edibles e-commerce |
| Locales | nl (primair), de, en |
| Policy | Geen iDEAL-claims, 18+, geen medische claims, crypto/bankoverschrijving |
| Scene presets | Product-on-surface, lifestyle NL/EU, geen US dispensary aesthetic |
| Proof URLs | fumero.nl, fumero.de, fumero.com |

**Voorbeeld Bokas (wrap: `horeca-nl`):** food/menu presets, andere enrichment, MKB horeca-copy — zelfde Content Department engine, andere wrap-config.

Wrap-config leeft op termijn in **Postgres** (`workspace_id` + `vertical_id` + `locale_profiles`) — zie MASTER-BUILD-PLAN Fase 1. Tot cutover: tenant-scoped code (`CompanyId`, `contentTypeForKlant`, Fumero brand voice).

### A.3 Content Department — rol en grenzen

Content Department (= **Content Studio** + **Campaign Agency**) is **één module** onder Motor AI, vergelijkbaar met andere afdelingen:

| Department | Rol (high level) | Huidige Fumero-route |
|------------|------------------|----------------------|
| **Content** | Beelden, video, campaign packs, social assets | `/fumero/photo-studio`, `/fumero/campaign-studio` |
| **Commerce** | Orders, catalogus, checkout-integraties | `/fumero/orders` |
| **Marketing** | Campagnes, e-mail, performance (later) | Redirect → chat/automations (deprecated apart) |
| **Knowledge** | Kennisbank, RAG, URL Reader, scrape | Kennisbank + chat context |
| **Automations** | Tasks, runs, n8n/Inngest flows | `/fumero/automations` |
| **Builder** | Max chat, Bouwen, widgets, apps | `/fumero/chat`, `/fumero/bouwen` |
| **Intelligence** | Analytics, insights, agent orchestration (later) | OpenClaw + model router |

**Layer 1 — Content Studio** (losse creatie): output-first canvas, Nano Banana 2, bibliotheek. Zie [`DESIGN-SPEC-content-studio.md`](./DESIGN-SPEC-content-studio.md).

**Layer 2 — Campaign Agency** (gestructureerde output): wizard → strategy → copy → creative → video → ZIP pack. Code: `lib/photo-studio/campaign/`, UI: `/fumero/campaign-studio`.

### A.4 API-grenzen (department boundary)

Content Department exposeert **tenant-scoped** endpoints. Andere departments (Marketing, Automations) consumeren packs via stabiele contracten — geen directe fal/LLM-calls van buitenaf.

**Concept (doel-API, nog niet volledig platform-breed):**

```http
POST /api/content/campaign-pack
Content-Type: application/json
X-Workspace-Id: {workspace_id}
X-Locale: nl-NL

{
  "product_url": "https://fumero.nl/product/…",
  "goal": "conversion",
  "formats": ["1:1", "4:5", "9:16"],
  "include_video": true
}
```

**Huidige implementatie (Fumero-scoped, juni 2026):**

| Endpoint | Functie |
|----------|---------|
| `POST /api/fumero/campaign/strategy` | Ad angles |
| `POST /api/fumero/campaign/copy` | Copy sets + Meta policy |
| `POST /api/fumero/campaign/generate` | Volledige pack (async job) |
| `GET /api/fumero/campaign/jobs/[id]` | Job status + progress |
| `GET /api/fumero/campaign/[id]/download` | ZIP download |

**Migratiepad:** `/api/fumero/campaign/*` → `/api/content/campaign-pack` met workspace middleware + wrap-config injectie. Fumero-routes blijven alias tot multi-tenant RLS live is (MASTER-BUILD-PLAN Fase 1).

---

## B. Agency MVP roadmap — Stap 0–8 + Fase 2–4

### B.1 North star (onveranderd)

NL/EU MKB en webshops · **REAL productfoto** + environment swap · **campaign packs** (static + video + copy + README) · Meta-ready naming · compliance per wrap/locale.

### B.2 Stap 0–8 — status en gates

**Eerlijk beeld (juni 2026):** Stap **0–1 done**. Stap **2–7 built but unstable** — code bestaat, gates niet groen. Stap **8 not started**.

| Stap | Naam | Status | Code-locatie | Gate vóór LIVE |
|------|------|--------|--------------|------------------|
| **0** | Quality gates | ✅ **Done** | `lib/photo-studio/quality/` — resolution, safe zone, SSIM, format | SSIM op **productregio** in campaign pipeline (nu gap — zie E) |
| **1** | Brand Kit | ✅ **Done** | `lib/photo-studio/brand-kit/`, wizard step `brand` | Multi-tenant + Shopify/Channable import (Fase 2) |
| **2** | Ad Strategy Engine | 🟡 **Built, unstable** | `ad-strategy.ts`, `/api/fumero/campaign/strategy` | LLM niet template-only in prod |
| **3** | Copy Generator | 🟡 **Built, unstable** | `copy-generator.ts`, `meta-policy.ts` | Policy + tenant-feiten in elke set; locale-aware |
| **4** | Creative (environment swap) | 🟡 **Built, unstable** | `creative.ts`, NB2 edit + scene presets | SSIM pass + product bbox; retry bij fail |
| **5** | Video Generator | 🟡 **Built, unstable** | `video.ts` — fal video, 9:16 | Frame-check; timeout job queue |
| **6** | Campaign Pack Builder | 🟡 **Built, unstable** | `pack-builder.ts` — ZIP, copy.csv, README | Naming + 1:1/4:5/9:16 compleet |
| **7** | UI Wizard | 🟡 **Built, unstable** | `/fumero/campaign-studio`, async jobs | Refresh-safe preview; opa-proof copy |
| **8** | Beta & validatie | ⬜ **Not started** | Tests + 524 handling | 3 echte packs + Meta upload test |

**MVP LIVE = stap 0–8 gates groen**, niet opnieuw bouwen. Focus: **validatie, SSIM-fix, prod LLM, beta**.

#### Acceptatiegates per stap

| Stap | Groen als |
|------|-----------|
| 0 | Campaign creative SSIM ≥ 0,85 op productregio; safe zone pass 1:1 + 4:5 |
| 1 | Import URL → product + kleur + reviews; wizard advance |
| 2 | 3 angles per locale; geen hallucinated prijs/betaal |
| 3 | Alle copy sets `policy_pass`; geen emoji; geen verboden betaalmethodes per wrap |
| 4 | 3 angles × 2 formaten; fail < 20% na retry |
| 5 | ≥ 1 Reel 9:16 < 100 MB; of expliciet skip |
| 6 | ZIP opent; copy.csv + README; filenames Ads-ready |
| 7 | Async job < 10 min P95; refresh → concepts (geen stuck generate) |
| 8 | 2 beta users uploaden naar Meta zonder reject; NPS ≥ 7 |

### B.3 Layer 1 — Content Studio (parallel track)

Campaign Agency **bouwt voort** op Content Studio (NB2, fal, Sharp variants). UI-herontwerp staat in DESIGN-SPEC Phase A–B:

| Phase | Focus | Relatie met Agency |
|-------|-------|-------------------|
| **A** | Output-first grid, prompt bar, NB2, user_prompt fix | Shared fal registry; betere losse assets vóór pack |
| **B** | Seedream, GPT Image 2, video toggle | Volume + typografie varianten in packs |

Campaign wizard blijft **Meer-/power-flow**; Content Studio is **vrije creatie**. Beide delen `lib/photo-studio/`.

### B.4 Fase 2–4 (post-MVP)

| Fase | Focus | Niet nu | Wel nu voorbereiden |
|------|-------|---------|---------------------|
| **2** MKB + integraties | Channable, Shopify, Meta export, multi-tenant RLS | Volledige Omneky-loop | Meta `asset_feed_spec` export skeleton |
| **3** Performance + batch | Insights → brief; batch packs per catalogus | Closed-loop ML | CSV + naming voor Ads Manager upload |
| **4** Creator Studio | Reve v2 layout, OGA Workflow Studio, Vibe-Workflow nodes | Fork hele OGA UI | Campaign pack als **vaste workflow template** |

**MVP LIVE definitie:** Fase 2–4 zijn **differentiator expansion**, geen MVP blocker — tenzij enterprise agencies vóór MKB bediend moeten worden.

---

## C. EU-first + multi-locale

Motor AI is **EU-first**, niet NL-only. Eén tenant kan meerdere locales; elk locale heeft eigen copy, policy en optioneel eigen domein.

### C.1 Locale-profielen

| Locale | Taal | Policy accent | Fumero proof |
|--------|------|---------------|--------------|
| `nl-NL` | Nederlands | iDEAL **niet** claimen; 18+ NL formulering; AVG | fumero.nl |
| `de-DE` | Deutsch | UWG/Health claims strict; Impressum-aware copy | fumero.de |
| `en-EU` | English (EU) | GDPR tone; geen US-only payment claims | fumero.com |

**Implementatiepad:**

1. **Nu:** Fumero brand voice + Meta policy hardcoded NL (`brand-voice.ts`, `meta-policy.ts`)
2. **MVP+:** `locale` parameter op copy/strategy; wrap YAML/DB per tenant
3. **Fase 2:** Domain → locale routing; Channable feed per markt

### C.2 Copy & policy per locale

| Onderdeel | nl | de | en |
|-----------|----|----|-----|
| Wizard UI | ✅ primair | 🔜 | 🔜 |
| Ad angles | NL templates | DE vertaling + culturele hooks | EN EU neutral |
| Meta policy filter | NL verboden termen | DE + EU health | EN EU |
| Scene presets | NL/EU lifestyle | DE urban/nature variants | EU generic |
| README in ZIP | NL | DE | EN |

### C.3 .nl · .de · .com als eerste proof tenants

Fumero is **één company**, **drie markten** — geen drie aparte platform-instanties:

```
Fumero BV (workspace)
├── locale: nl-NL → fumero.nl (primair, beta)
├── locale: de-DE → fumero.de (beta na nl gate)
└── locale: en-EU → fumero.com (beta na de gate)
```

Dit bewijst wrap + multi-locale vóór white-label voor andere EU-bedrijven.

---

## D. Don't-be-Columbus matrix

*Bouwt Motor alleen wat differentieert; integreert bestaande tools; stelt de rest uit.*

| Need | Integrate (bestaand) | Build (moat) | Skip / defer |
|------|----------------------|--------------|--------------|
| Background removal | Photoroom API, Claid | — | Eigen rembg |
| Scene / environment | NB2 edit, ComfyUI community workflows | EU scene presets + wrap policy | Reve in MVP |
| Layout control | Reve v2 regions (Fase 4) | Campaign wizard voor MKB | Fork OGA UI |
| Node pipelines | Higgsfield Canvas, Vibe-Workflow, OGA Workflow Studio | Pack builder als **code workflow** | ComfyUI in prod |
| Ad copy + angles | Jasper, AdCreative (referentie) | NL/EU angles + tenant-feiten + meta-policy | — |
| Product protection | Mintly layer (referentie) | SSIM + REAL photo only | — |
| Competitor formats | Mintly Ad Spy, Foreplay | Handmatig Meta Ad Library | Scraper MVP |
| Campaign export | Meta Advantage+ catalog API | ZIP + CSV naming convention | Direct publish Tier 4 |
| Performance loop | Omneky, Superscale | Wrap-specific compliance | ML scoring Fase 3 |
| Batch SKU | Claid API, Photoroom batch | Inngest queue (MASTER plan) | — |
| Agent recipes | Generative-Media-Skills | Max chat → campaign brief | MuAPI uncensored stack |
| Multi-locale | i18n framework, DeepL/LiteLLM translate | Policy profiles per locale | Handmatig 3 locales forever |
| E-com platform core | Shopify, Woo, Channable | Motor wrap + AI departments | Eigen checkout (2029+) |

### D.1 Patronen om van te leren (niet fork-en)

1. **Mintly** — product protection + Ad Library workflow → brand-kit + angle templates  
2. **ComfyUI Product Placement** — still → video prompt chain  
3. **Shopify Background Replacement** — beschrijf scene, niet product  
4. **Higgsfield Canvas** — template save + multi-format branch → pack-builder fases  
5. **Superscale tiers** — MVP = Tier 2–3 (brief → pack), niet Tier 4 publish  
6. **Meta Advantage+** — align met catalog/dynamic media; vecht niet tegen native DCO  

### D.2 Reve 2.0 — timing Fase 4

**Wanneer:** na MVP LIVE + product fidelity bewezen (SSIM, policy, zip export).

**Waarom Reve:** v2 API met `Description` + `Region` + `preserve` — layout-aware product placement.

**Fit:** sterker voor hero layouts; zwakker voor bulk MKB (credits, rate limits). **Integratie:** parallel pad naast NB2 — Reve voor hero; NB2/fal voor volume.

### D.3 Open-Generative-AI ecosystem — timing Fase 4

| Repo | Rol | Gebruik voor Motor |
|------|-----|-------------------|
| [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) | MIT UI + Workflow Studio | **Patroon stelen**, niet hosten naast Motor |
| [Vibe-Workflow](https://github.com/SamurAIGPT/Vibe-Workflow) | Node editor | Fase 4: power-user canvas |
| [Generative-Media-Skills](https://github.com/SamurAIGPT/Generative-Media-Skills) | Agent recipes | Dev tooling / Cursor skills |
| [Open-AI-Design-Agent](https://github.com/Anil-matcha/Open-AI-Design-Agent) | Design agent | Referentie agent loop |

**Waarschuwing:** OGA/MuAPI = uncensored volume gen. Motor moat = **wrap policy + EU MKB + echte productfoto's**.

---

## E. Zwakke punten + mitigaties

### E.1 Per stap (audit juni 2026)

#### Stap 0 — Quality gates
- **Risico:** SSIM bestaat maar `creative.ts` zet `inputPath: undefined` → product fidelity wordt **niet** gecontroleerd in campaign flow.
- **Mitigatie:** download origineel product; bbox (centrum 40%); SSIM fail → retry andere seed/preset.

#### Stap 1 — Brand Kit
- **Risico:** import alleen fumero.nl-achtige URLs; geen Shopify OAuth.
- **Mitigatie:** URL import behouden; Fase 2 Channable/product feed.

#### Stap 2–3 — Strategy + Copy
- **Risico:** `CAMPAIGN_TEMPLATE_ONLY=1` / dev default → demo ≠ productie.
- **Mitigatie:** prod gate: OpenRouter of n8n verplicht; template alleen fallback; locale in prompt.

#### Stap 4 — Creative
- **Risico:** NB2 kan label/logo vervormen (Mintly lost dit op met product protection).
- **Mitigatie:** SSIM + safe zone; overweeg Photoroom cutout → NB2 scene (hybrid).

#### Stap 5 — Video
- **Risico:** fal video timeout; Meta dynamic media kan catalog-video prefereren.
- **Mitigatie:** async job (✅); export hero video + respecteer Advantage+ catalog video.

#### Stap 6–7 — Pack + Wizard
- **Risico:** geen Meta-native export; handmatige upload; UI unstable bij refresh.
- **Mitigatie:** Fase 2 `asset_feed_spec` + zip blijft fallback; wizard state hardening.

#### Stap 8 — Beta
- **Risico:** geen echte ad spend validatie; HHC compliance stricter dan generieke tools.
- **Mitigatie:** 3 beta packs (nl → de → en); Meta policy review vóór spend.

### E.2 Platform-niveau

| Risico | Mitigatie |
|--------|-----------|
| MASTER-BUILD-PLAN Postgres/RLS nog niet live | Fumero-first single-tenant; RLS vóór andere white-label wraps |
| Geen cost guard per pack | Langfuse + usage caps (Fase 2) |
| Cloudflare 524 (~100s) | Async jobs ✅; sync pad beperken |
| SQLite → Postgres cutover (ADR-002, 26 jul 2026) | Campaign packs migreren mee; geen pack-logica in SQLite-only paden |
| Triple stack Fase 4 (Motor + Reve + OGA) | Eén execution engine (`pack-builder` + optionele Reve node) |

### E.3 Dependencies

| Dependency | Impact |
|------------|--------|
| `FAL_KEY` / `FAL_API_KEY` | Zonder key: skip media (strategy+copy only) |
| `OPENROUTER_API_KEY` / n8n | Template strategy/copy als fallback |
| `resolveImageUrlsForFal` | Product URL moet publiek bereikbaar voor fal |
| Meta Marketing API token | Fase 2 export |
| Hetzner RAM | Geen ComfyUI self-host op 16 GB box |

---

## F. Lange termijn 2026–2029

### F.1 2026 H2 — MVP + proof

| Q | Milestone |
|---|-----------|
| Q3 | Agency MVP LIVE (stap 0–8) op fumero.nl; SSIM + prod LLM |
| Q3–Q4 | Content Studio Phase A (DESIGN-SPEC); Postgres cutover |
| Q4 | fumero.de locale beta; Meta export skeleton |

### F.2 2027 — Platform hardening + Fase 2–3

- Multi-tenant RLS; `/api/content/campaign-pack` platform-breed  
- Channable/Shopify Brand Kit import  
- Batch catalog packs (Inngest)  
- Performance feedback: winnaar-tag → volgende brief (handmatig → Marketing API)  
- 2–3 extra EU wraps (niet-Fumero) white-label pilot  

### F.3 2028 — Creator Studio + Intelligence

- **Fase 4:** Reve 2.0 hero layouts; OGA/Vibe-Workflow als **optionele** power-user laag binnen Content Department  
- Marketing Department consumeert packs + insights  
- Intelligence Department: closed-loop suggesties (welke angle/format wint per vertical)  

### F.4 2029 — First AI e-commerce platform (visie)

Motor AI als **EU-first AI e-commerce platform**:

| Laag | Inhoud |
|------|--------|
| **Wraps** | Vertical templates per branche (HHC, horeca, fashion, B2B, …) |
| **Departments** | Content, Commerce, Marketing, Knowledge, Automations, Builder, Intelligence — geïntegreerd |
| **Locales** | nl/de/en/fr/es + policy profiles |
| **White-label** | Nieuwe EU company signup → wrap in < 1 dag (MASTER-BUILD-PLAN Fase 4.3) |
| **Differentiator** | AI campaign packs van **echte** productdata + compliance — geen generic uncensored gen |

Content Department evolueert van **Fumero wizard** naar **platform module** die elke wrap out-of-the-box bedient.

---

## G. Onmiddellijke volgende acties

Prioriteit voor **juni–juli 2026** (vóór beta):

| # | Actie | Owner | Gate |
|---|-------|-------|------|
| **G1** | **SSIM in campaign pipeline** — fix `inputPath` in `creative.ts`; download product; bbox SSIM ≥ 0,85 | Engineering | Stap 0 groen |
| **G2** | **Prod LLM gate** — disable template-only default in prod; OpenRouter/n8n verplicht | Engineering | Stap 2–3 groen |
| **G3** | **Beta plan Fumero nl** — 3 echte producten → pack → handmatige Meta upload | Product | Stap 8 start |
| **G4** | **Meta export skeleton** — `asset_feed_spec` JSON naast ZIP (geen publish) | Engineering | Fase 2 prep |
| **G5** | **Wizard stability** — refresh-safe job polling; error states NL | Engineering | Stap 7 groen |
| **G6** | **Cost visibility** — fal + LLM cost per pack in job result (UI later) | Engineering | Ops |
| **G7** | **Content Studio Phase A kickoff** — user_prompt fix + grid (DESIGN-SPEC A1–A6) | Design/Eng | Layer 1 |

### G.1 Definition of done — "Agency MVP LIVE"

- [ ] Alle gates stap 0–8 groen voor **fumero.nl**  
- [ ] Minimaal 1 pack per ad angle geüpload in Meta Ads Manager zonder policy reject  
- [ ] Documentatie: deze roadmap + STATUS.md bijgewerkt  
- [ ] Geen P0 bugs in campaign job queue (524, stuck wizard)  

---

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06 | Audit roadmap (Fumero-scoped) |
| 2026-06-13 | Herschreven naar Motor AI Content Department platform roadmap; EU multi-locale; wrap model |

---

*Motor AI Content Department — platform roadmap. Fumero = tenant #1, niet het product.*
