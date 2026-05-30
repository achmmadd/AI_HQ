# Content Studio — Design Spec v1

**Project:** `/home/pietje/AI_HQ/ai-motor` (Next.js 15)  
**Datum:** 30 mei 2026  
**Status:** Research + spec — **geen code-wijzigingen**  
**Referentie:** [DESIGN-SPEC-fumero-studio.md](./DESIGN-SPEC-fumero-studio.md) (dark mode tokens, typografie, spacing)  
**North star:** Artlist AI Toolkit — output is de held, één promptbalk onderaan, alles anders progressive disclosure.

---

## 1. Samenvatting

**Content Studio** (huidige *Photo Studio*) wordt herontworpen van een formulier-first scherm (gestapelde witte kaarten, preset-dropdown, modus-knoppen, nabewerking-blok) naar een **output-first creatiecanvas** zoals Artlist: een volledig scherm gevuld met gegenereerde beelden, met één vaste promptbalk onderaan.

| Huidig probleem | Locatie (code) | Doel |
|-----------------|----------------|------|
| Output is secundair (kleine preview onder form) | `photo-studio-generator.tsx` L213–218 | Output vult viewport |
| Gestapelde witte bordered boxes | `photo-studio-panel.tsx`, generator, output, post-process | Vlak canvas, geen box-in-box |
| Workspace preset dropdown zichtbaar | `photo-studio-generator.tsx` L103–118 | Verwijderen uit UI |
| Tekst→beeld / Beeld→beeld als aparte knoppen | `photo-studio-generator.tsx` L120–143 | Inline Image/Video toggle + "+ Image Reference" |
| Nabewerking (Sharp) op hoofdscherm | `photo-studio-post-process.tsx` | Verplaatsen naar Meer-tab of settings |
| Bibliotheek toont enriched prompt | `library.ts` + `generate/route.ts` L65 | Alleen **user prompt** tonen |
| Verouderde modellen (Flux Schnell, Kontext) | `lib/photo-studio/fal.ts` L4–5 | Nano Banana 2 + later Seedream / GPT Image 2 |
| Carousel + Menu-batch als primaire tabs | `photo-studio-panel.tsx` L37–56 | Achter **Meer**-tab |

**Screenshots:** Geen recente UI-screenshots gevonden in workspace assets (`~/.cursor/projects/home-pietje/assets/` leeg). Analyse gebaseerd op huidige componentcode + door gebruiker beschreven Artlist-referentie (Foto 3–5 = doel).

---

## 2. Benchmark — Artlist AI Toolkit (patroon)

| Artlist-element | Content Studio vertaling | Principe |
|-----------------|--------------------------|----------|
| Grote visuele grid vult scherm | Masonry/responsive grid van alle recente + nieuwe outputs | **clarity** — direct zien wat je hebt gemaakt |
| Eén promptveld onderaan, vast | `"Beschrijf wat je wilt maken…"` — sticky bottom bar | **space** — geen form boven content |
| Model picker inline in prompt bar | `Nano Banana 2 · Seedream 5.0 · GPT Image 2` | **modern** — geen apart settings-scherm voor model |
| Settings achter één knop (popover) | Aspect, kwaliteit, aantal | **trust** — defaults werken; power users kunnen tunen |
| Image / Video toggle links | Image actief; Video disabled + "Binnenkort" | **clarity** — voorbereid zonder half product |
| Reference upload inline | "+ Image Reference" chip — geen aparte modus | **modern** — img2img is extensie, geen modus-switch |

---

## 3. Layout-specificatie

### 3.1 Viewport-structuur (desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Content Studio                              [Meer ▾]      │  ← dunne header, geen dubbele breadcrumb+h1
├───────────┼──────────────────────────────────────────────────────────────┤
│           │                                                              │
│           │   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│           │   │        │ │        │ │  NEW   │ │        │               │
│           │   │  gen   │ │  gen   │ │ skeleton│ │  gen   │  ← hero grid │
│           │   │        │ │        │ │        │ │        │               │
│           │   └────────┘ └────────┘ └────────┘ └────────┘               │
│           │   ┌────────┐ ┌────────┐ ...                                  │
│           │   │        │ │        │                                      │
│           │   └────────┘ └────────┘                                      │
│           │                                                              │
│           │   (scroll; grid groeit; lege state = subtiele hint midden)   │
├───────────┼──────────────────────────────────────────────────────────────┤
│           │ ┌──────────────────────────────────────────────────────────┐ │
│           │ │ [Beeld▾] [Video]  │ prompt textarea…          │ ⚙ │ ▶ │ │ │  ← sticky prompt bar
│           │ │ + Image Reference │ Nano Banana 2 ▾           │   │   │ │ │
│           │ └──────────────────────────────────────────────────────────┘ │
└───────────┴──────────────────────────────────────────────────────────────┘
```

### 3.2 Prompt bar — specificatie

| Element | Positie | Gedrag | Afmeting / token |
|---------|---------|--------|------------------|
| Media toggle | Links | `Beeld` (actief) / `Video` (disabled, tooltip "Binnenkort") | 36px hoogte knoppen, `text-body-sm` (13px) |
| Prompt textarea | Midden, flex-1 | Placeholder NL: *"Beschrijf wat je wilt maken…"* | min-height 44px, max 120px, radius 12px |
| Image Reference | Onder/ naast prompt | Chip `+ Image Reference`; max 1 ref Phase A (NB2 edit ondersteunt multi later) | Thumbnail 32×32 na upload |
| Model picker | Rechts van prompt | Dropdown: **Nano Banana 2** (default) · Seedream 5.0 · GPT Image 2 | Phase B: Seedream/GPT disabled tot geïmplementeerd |
| Settings (⚙) | Rechts | Opent popover — geen modal | 36×36 icon button |
| Generate (▶) | Rechts | Primary CTA — `#69C400`, alleen groen element in bar | 36px, icon + optional "Genereren" op brede schermen |

**Sticky gedrag:** `position: fixed` of flex column met `main { flex:1; overflow:auto }` + `footer prompt bar` — bar blijft zichtbaar bij scroll. Safe-area padding mobiel: 16px.

### 3.3 Output grid (hero)

| Eigenschap | Waarde |
|------------|--------|
| Layout | CSS grid: `repeat(auto-fill, minmax(220px, 1fr))`, gap 12px (`space-2`) |
| Padding content | 24px desktop / 16px mobiel (`space-3` / `space-2`) |
| Max-width | **Geen** `max-w-3xl` — full bleed binnen main column |
| Kaart hover | Overlay: download, inplannen, kopiëren prompt (user prompt) |
| Nieuwe generatie | Skeleton tile met pulse; nieuwe items prepend in grid |
| Lege state | Gecentreerd: *"Typ hieronder wat je wilt maken — je beelden verschijnen hier."* — geen jargon |

**Varianten (Sharp):** Niet als apart wit blok op main screen. Opties:
- **A (voorkeur Phase A):** Silent — na generatie automatisch Sharp variants (bestaand `resizeMasterToVariants`); download via hover menu op tile.
- **B:** Toggle in settings popover: *"Social formaten automatisch maken"* (default aan).

### 3.4 Settings popover

Trigger: ⚙ in prompt bar. Popover rechtsboven van knop, max-width 280px.

| Instelling | Opties UI | Default | API mapping |
|------------|-----------|---------|-------------|
| Beeldverhouding | 1:1 · 4:3 · 3:4 · 16:9 · 9:16 | 1:1 | Zie §7 per model |
| Kwaliteit | 2K · 3K · 4K | 2K | Zie §7 — NB2 heeft geen 3K native |
| Aantal | 1 · 2 · 3 · 4 · 5 | 1 | Zie §7 — NB2 max 4/request |
| Social formaten | Aan/Uit (Sharp variants) | Aan | Bestaande pipeline |

Popover styling (dark mode — hergebruik Fumero tokens §6.2):

```css
/* Popover surface */
background: var(--fumero-surface-elevated);  /* #1C1C1F dark */
border: 1px solid var(--fumero-border);       /* rgba(255,255,255,0.08) */
border-radius: var(--fumero-radius-lg);       /* 12px */
padding: 16px;
box-shadow: var(--fumero-shadow-sm);
```

Light mode: `--fumero-surface` / `--fumero-border` uit [DESIGN-SPEC-fumero-studio.md §6.1](./DESIGN-SPEC-fumero-studio.md).

### 3.5 Header + Meer-tab

| Element | Specificatie |
|---------|--------------|
| Paginatitel | **Content Studio** (Fumero sidebar: "Content" of "Beelden"; Bokas: zelfde component) |
| Subtitle | Weg — prompt bar is self-explanatory |
| Meer ▾ | Dropdown of secundaire view: **Instagram carrousel**, **Menu-batch**, **Nabewerking (Sharp)** |
| Geen tabs | Zwarte filled pills (`photo-studio-panel.tsx` L49–51) vervangen door Meer-menu |

### 3.6 Mermaid — interactieflow genereren

```mermaid
flowchart TB
  subgraph UI [Content Studio UI]
    Grid[Output Grid]
    Bar[Prompt Bar]
    Pop[Settings Popover]
    Ref[+ Image Reference]
  end

  Bar -->|Enter / ▶| API["POST /api/photo-studio/generate"]
  Ref -->|upload| Upload["POST /api/upload"]
  Upload --> Bar
  Pop -->|aspect, quality, count| API

  API --> Fal["lib/photo-studio/fal.ts"]
  Fal -->|images[]| Persist["library.ts persist"]
  Persist --> Sharp["resizeMasterToVariants"]
  Sharp --> Grid
```

### 3.7 Mobiel

- Grid: 2 kolommen min 160px
- Prompt bar: model picker → overflow "⋯" menu
- Settings popover: full-width sheet van onderen (optional Phase A polish)

---

## 4. Wat verdwijnt van het hoofdscherm

| Element | Huidige component | Actie | Principe |
|---------|-------------------|-------|----------|
| Workspace preset dropdown | `PhotoStudioGenerator` L103–118 | **Verwijderen** — enrichment blijft server-side per klant | clarity |
| Product template forcing | `workspace-presets.ts` UI + default_prompt fallback | **Geen UI** — vrije prompt; enrichment only | trust |
| Tekst→beeld / Beeld→beeld knoppen | `PhotoStudioGenerator` L120–143 | **Vervangen** door Image Reference chip | modern |
| Nabewerking-blok | `PhotoStudioPostProcess` | **Meer-tab** | space |
| Gestapelde witte boxes | generator + output cards | **Flatten** — grid + prompt bar | space |
| Carousel / Menu-batch tabs | `PhotoStudioPanel` tabs | **Meer-tab** | clarity |
| fal.ai in copy | `photo-studio-panel.tsx` L24 | **Verwijderen** — "AI genereert je beeld" | trust |
| Dubbele header | FumeroShell breadcrumb + h1 | **Eén titel** in content | clarity |
| max-w-3xl | `photo-studio-panel.tsx` L32 | **Full width** main | space |

---

## 5. Model picker — modellen, defaults, fal.ts-plan

### 5.1 Te verwijderen

| Model ID | Gebruik nu |
|----------|------------|
| `fal-ai/flux/schnell` | txt2img in `fal.ts`, `app/api/studio/product-photos/route.ts`, `lib/fumero/fal-product-image.ts` |
| `fal-ai/flux-kontext/dev` | img2img in `fal.ts`, `app/api/content/design/route.ts` |

*Scope Content Studio:* primair `lib/photo-studio/fal.ts`. Overige routes apart ticket of shared model registry.

### 5.2 Nieuwe modellen (fal.ai — geverifieerd mei 2026)

| UI-label | fal.ai Model ID (txt2img) | fal.ai Model ID (edit/img2img) | Rol |
|----------|---------------------------|--------------------------------|-----|
| **Nano Banana 2** (default) | `fal-ai/nano-banana-2` | `fal-ai/nano-banana-2/edit` | E-commerce/product, 4K, multi-ref edit (tot 14) |
| **Seedream 5.0** | `fal-ai/bytedance/seedream/v5/lite/text-to-image` | `fal-ai/bytedance/seedream/v5/lite/edit` | Budget/volume, web search grounding |
| **GPT Image 2** | `openai/gpt-image-2` | `openai/gpt-image-2/edit` | Typografie, packaging, tekst in beeld |

**Auth:** Bestaande `FAL_KEY` / `FAL_API_KEY` — geen client-side key.

**Architectuur:** `lib/photo-studio/fal.ts` → refactor naar model registry + `generateWithModel(opts)`.

```typescript
// Voorgestelde structuur (spec, geen implementatie)
type ContentStudioModelId =
  | "nano-banana-2"
  | "seedream-5-lite"
  | "gpt-image-2";

type GenerateOpts = {
  model: ContentStudioModelId;
  userPrompt: string;
  klant: CompanyId;
  imageUrls?: string[];       // leeg = txt2img
  aspectRatio: AspectRatioUI;
  quality: "2K" | "3K" | "4K";
  count: number;              // 1–5
  style_hint?: string;        // deprecated UI; enrichment blijft
};
```

### 5.3 Enrichment (behouden, achter scherm)

Bestaande logica in `fal.ts`:
- `contentTypeForKlant`: fumero → product, bokas → food
- `enrichTextToImagePrompt` / `enrichImageToImagePrompt`
- `buildTextToImageFalPrompt` / `buildImageToImageFalPrompt`

**Wijziging:** Enrichment blijft **alleen** naar fal gestuurd; **nooit** naar UI/library title.

Optioneel Phase A: `system_prompt` parameter Nano Banana 2 vullen met `SYSTEM_CONTEXT[type]` i.p.v. prepending in user prompt — schoner scheiding user vs system.

### 5.4 Default per workspace (enrichment only)

| Workspace | Enrichment type | Geen UI preset |
|-----------|-----------------|----------------|
| Fumero | `product` — studio e-commerce | Vrije prompt |
| Bokas | `food` — menu/restaurant | Vrije prompt |

Verwijder afhankelijkheid `usePhotoStudioPresets` / `activePreset.default_prompt` fallback in generator (L74–75) — lege prompt = validatie error, geen template injectie in UI.

### 5.5 Image Reference → Nano Banana 2 edit

- Geen aparte `mode: "image_to_image"` toggle in UI
- Als `imageUrls.length > 0` → route naar `fal-ai/nano-banana-2/edit` met `image_urls[]`
- Phase A: 1 reference; Phase B: multi-reference chips (NB2 tot 14)

---

## 6. Title bug — user prompt vs enriched prompt

### 6.1 Root cause (bevestigd in code)

```
User prompt (UI)
  → POST /api/photo-studio/generate { prompt: "HHC vape premium" }
  → generateWithFal() bouwt fullPrompt (system + enrichment + user)
  → result.prompt = fullPrompt          // fal.ts L143, L188
  → persistPhotoGeneration({ prompt: result.prompt })  // generate/route.ts L65
  → library strip toont item.prompt     // photo-studio-library-strip.tsx L53
  → content_posts.content = input.prompt.slice(0, 500)  // library.ts L107
```

Gebruiker ziet o.a.: *"HHC vape premium\n\nProfessional studio product photography. Pure white seamless background…"*

### 6.2 Fix-specificatie

| Laag | Wijziging |
|------|-----------|
| **DB** | Migratie: kolommen `user_prompt TEXT NOT NULL`, `fal_prompt TEXT` (optioneel, debug). Bestaande rijen: `user_prompt = prompt` truncated vóór `\n\nProfessional` waar mogelijk. |
| **API request** | Body blijft `prompt` (user). Optioneel hernoemen naar `user_prompt` voor clarity — breaking change vermijden: behoud `prompt` = user. |
| **API response** | Return `{ user_prompt, fal_prompt?, model }` — UI gebruikt nooit fal_prompt voor display. |
| **persistPhotoGeneration** | `user_prompt` → DB + content_posts caption/titel; `fal_prompt` → alleen logging/kolom. |
| **Library UI** | `item.user_prompt` truncaten 80 tekens; tooltip full user prompt. |
| **Post-process dropdown** | Label: `tracking_id — user_prompt.slice(0,40)` |
| **Acceptatie** | Geen string "Professional studio product photography" in bibliotheek tenzij user die tekst zelf typte. |

**Principe:** **trust** — wat de gebruiker typte is wat ze terugzien; AI-instructies zijn onzichtbaar.

---

## 7. API request shape — per model

### 7.1 Unified client → server (`POST /api/photo-studio/generate`)

**Nieuw request body (Phase A+B):**

```json
{
  "klant": "fumero",
  "prompt": "Premium gin op marmer",
  "model": "nano-banana-2",
  "image_urls": [],
  "aspect_ratio": "1:1",
  "quality": "2K",
  "count": 1,
  "auto_variants": true
}
```

| Veld | Type | Notes |
|------|------|-------|
| `prompt` | string | **User prompt only** — verplicht |
| `model` | enum | default `nano-banana-2` |
| `image_urls` | string[] | Leeg = txt2img; non-empty = edit endpoint |
| `aspect_ratio` | `1:1\|4:3\|3:4\|16:9\|9:16` | UI enum |
| `quality` | `2K\|3K\|4K` | Model-specifieke mapping |
| `count` | 1–5 | Batch logic per model |
| `auto_variants` | boolean | Sharp resize na gen |

**Response (uitbreiding):**

```json
{
  "ok": true,
  "user_prompt": "Premium gin op marmer",
  "items": [
    {
      "tracking_id": "ps_…",
      "master_url": "…",
      "variants": [],
      "content_id": 123
    }
  ],
  "model": "fal-ai/nano-banana-2"
}
```

Bij `count > 1`: array `items[]` (één DB row per image of batch parent — implementatiekeuze Phase A: parallel requests, elk eigen tracking_id).

### 7.2 Nano Banana 2 — fal payload

**Txt2img** — `POST https://fal.run/fal-ai/nano-banana-2`

```json
{
  "prompt": "<enriched full prompt>",
  "system_prompt": "Je bent een professioneel product fotograaf.",
  "num_images": 1,
  "aspect_ratio": "1:1",
  "resolution": "2K",
  "output_format": "jpeg",
  "limit_generations": true
}
```

| UI | fal field | Opmerking |
|----|-----------|-----------|
| 1:1 | `"1:1"` | Direct |
| 4:3 | `"4:3"` | Direct |
| 3:4 | `"3:4"` | Direct |
| 16:9 | `"16:9"` | Direct |
| 9:16 | `"9:16"` | Direct |
| 2K | `"2K"` | Direct |
| 3K | `"2K"` of `"4K"` | **Geen 3K enum** — UI toont 3K maar mapped naar `2K` + optionele upscale, of disable 3K voor NB2 |
| 4K | `"4K"` | 2× rate |
| count 1–4 | `num_images` | Max **4** per request |
| count 5 | 2 requests: 4+1 | Server-side batch |

**Edit** — `POST https://fal.run/fal-ai/nano-banana-2/edit`

```json
{
  "prompt": "<enriched edit prompt>",
  "image_urls": ["https://…/upload.jpg"],
  "num_images": 1,
  "aspect_ratio": "1:1",
  "resolution": "2K"
}
```

### 7.3 Seedream 5.0 Lite — fal payload (Phase B)

**Txt2img** — `fal-ai/bytedance/seedream/v5/lite/text-to-image`

```json
{
  "prompt": "<enriched prompt>",
  "image_size": "square_hd",
  "num_images": 1
}
```

**Edit** — `fal-ai/bytedance/seedream/v5/lite/edit`

```json
{
  "prompt": "<enriched prompt>",
  "image_urls": ["https://…"]
}
```

Aspect/quality mapping: playground schema valideren bij implementatie — Seedream gebruikt vaak `image_size` presets i.p.v. `aspect_ratio` enum. UI labels blijven gelijk; server mapped.

### 7.4 GPT Image 2 — fal payload (Phase B)

**Txt2img** — `openai/gpt-image-2`

```json
{
  "prompt": "<enriched prompt — typography: quote exact text>",
  "image_size": "1024x1024",
  "quality": "high",
  "num_images": 1,
  "output_format": "png"
}
```

| UI aspect | GPT `image_size` suggestion |
|-----------|----------------------------|
| 1:1 | `1024x1024` |
| 4:3 | `landscape_4_3` |
| 3:4 | `portrait_4_3` |
| 16:9 | `1536x864` (multiples of 16) |
| 9:16 | `864x1536` |

| UI quality | GPT `quality` |
|------------|---------------|
| 2K | `medium` |
| 3K | `high` |
| 4K | `high` + max dimension |

**Edit** — `openai/gpt-image-2/edit` — `image_urls[]`, optional mask later.

---

## 8. Component inventory

### 8.1 Hergebruiken (refactor)

| Component / module | Rol in Content Studio |
|--------------------|----------------------|
| `lib/photo-studio/fal.ts` | Model registry + generate — **kern refactor** |
| `lib/photo-studio/library.ts` | Persist + list — **+ user_prompt kolom** |
| `lib/photo-studio/resize-variants.ts` | Silent Sharp variants |
| `lib/photo-studio/types.ts` | Uitbreiden: `ContentStudioModelId`, settings types |
| `lib/photo-studio/enrichment` (fal.ts functions) | Ongewijzigd gedrag, scheiding user/fal prompt |
| `photo-studio-output.tsx` | Schedule-knop → tile hover action of detail drawer |
| `photo-studio-library-strip.tsx` | Logica merge in **Output Grid** (data source) |
| `photo-studio-carousel.tsx` | Meer-tab view |
| `photo-studio-menu-batch.tsx` | Meer-tab view |
| `photo-studio-post-process.tsx` | Meer-tab view (herschrijf labels NL) |
| `app/api/photo-studio/*` | Routes blijven; generate uitbreiden |
| `FumeroShell` / `BokasWorkspaceRoot` | Layout wrapper |

### 8.2 Verwijderen / deprecaten

| Item | Reden |
|------|-------|
| `PhotoStudioGenerator` (huidige vorm) | Vervangen door prompt bar + grid shell |
| Preset dropdown UI | Geen product template forcing |
| Mode toggle buttons | Image Reference pattern |
| Aparte `PhotoStudioOutput` card op main | Output = grid tiles |
| `max-w-3xl` wrapper | Full-bleed grid |
| `usePhotoStudioPresets` in main flow | Alleen enrichment server-side |
| `workspace-presets.ts` UI exports | Behouden voor Meer/workflows indien nodig; niet op main |

### 8.3 Nieuw te bouwen

| Component | Verantwoordelijkheid |
|-----------|---------------------|
| `ContentStudioShell` (of `PhotoStudioPanel` v2) | Grid + prompt bar layout, Meer-menu |
| `ContentStudioOutputGrid` | Hero grid, skeletons, empty state, tile actions |
| `ContentStudioPromptBar` | Prompt, model picker, generate, reference chips |
| `ContentStudioSettingsPopover` | Aspect, quality, count, auto_variants |
| `ContentStudioModelPicker` | Inline dropdown met model descriptions |
| `ContentStudioMediaToggle` | Beeld/Video (video stub) |
| `ContentStudioMeerPanel` | Router naar carousel / menu-batch / post-process |

**Naming:** Interne map kan `components/photo-studio/` blijven; user-facing copy = **Content Studio**.

### 8.4 Routes / pages

| Huidig | Voorstel |
|--------|----------|
| `/fumero/photo-studio` | Behoud URL (geen break) — titel **Content Studio** |
| `/bokas/photo-studio` | Idem |
| Sidebar "Photo Studio" | **Content Studio** of **Beelden** (align Fumero jargon doc) |

---

## 9. Fasering

### Phase A — ~80% waarde (layout + Nano Banana 2)

| # | Deliverable | Principes |
|---|-------------|-----------|
| A1 | Output-first layout: grid + sticky prompt bar | space, modern |
| A2 | Settings popover (aspect, quality, count) | clarity |
| A3 | Model picker UI — alleen Nano Banana 2 actief | trust |
| A4 | fal.ts: NB2 txt2img + edit; remove Flux | modern |
| A5 | Image Reference chip (1 image) | clarity |
| A6 | **Title bug fix** — user_prompt in DB + UI | trust |
| A7 | Meer-tab: carousel, menu-batch, post-process verplaatst | space |
| A8 | Dark tokens voor prompt bar + popover | modern |
| A9 | Silent Sharp variants (auto_variants default on) | clarity |
| A10 | Schedule to Social — tile action | behouden |

**Niet in Phase A:** Video toggle functionaliteit, Seedream, GPT Image 2, multi-ref >1.

### Phase B — later

| # | Deliverable |
|---|-------------|
| B1 | Seedream 5.0 Lite integratie |
| B2 | GPT Image 2 integratie |
| B3 | Video toggle + generation pipeline |
| B4 | Multi image reference (NB2 tot 14) |
| B5 | Batch count 5 optimalisatie + queue/webhook voor lange runs |
| B6 | Tile detail drawer (varianten download, metadata) |
| B7 | Rename route `/content-studio` + redirects (optional) |

---

## 10. Per wijziging — principes matrix

| # | Wijziging | clarity | space | trust | modern |
|---|-----------|---------|-------|-------|--------|
| 1 | Output hero grid | ✓ | ✓ | | ✓ |
| 2 | Sticky prompt bar onderaan | ✓ | ✓ | | ✓ |
| 3 | Settings in popover | ✓ | ✓ | | |
| 4 | Inline model picker | ✓ | ✓ | | ✓ |
| 5 | Image Reference i.p.v. modus | ✓ | ✓ | | ✓ |
| 6 | user_prompt title fix | ✓ | | ✓ | |
| 7 | Preset dropdown weg | ✓ | ✓ | ✓ | |
| 8 | Meer-tab voor advanced | ✓ | ✓ | | |
| 9 | Nano Banana 2 default | | | ✓ | ✓ |
| 10 | fal.ai/vendor weg uit copy | ✓ | | ✓ | |
| 11 | Dark mode prompt chrome | | ✓ | | ✓ |
| 12 | Video toggle disabled prep | ✓ | | ✓ | |

---

## 11. Acceptatiecriteria (visueel + functioneel)

- [ ] Gegenereerde beelden vullen **≥60% viewport** op desktop bij ≥1 item  
- [ ] Precies **één** promptveld zichtbaar op main screen  
- [ ] Geen workspace preset dropdown op main  
- [ ] Geen "Tekst→beeld" / "Beeld→beeld" knoppen — alleen "+ Image Reference"  
- [ ] Bibliotheek/grid titels = **exact user prompt** (geen enrichment zichtbaar)  
- [ ] Nabewerking-blok niet op main — alleen via Meer  
- [ ] Carousel + Menu-batch alleen via Meer  
- [ ] Default model Nano Banana 2; Flux endpoints niet meer aangeroepen vanuit Content Studio  
- [ ] Settings popover: aspect + quality + count werken voor NB2  
- [ ] Schedule to Social bereikbaar per tile  
- [ ] Lege state begrijpelijk binnen **5 sec** zonder AI-jargon  

---

## 12. Huidige vs doel — ASCII vergelijking

**Nu (gestapeld, form-first):**

```
┌──────────────────────── max-w-3xl ────────────────────────┐
│ Photo Studio                                              │
│ Genereer … met fal.ai                                     │
│ [Genereren] [Carousel] [Menu-batch]                       │
│ ┌─────────────────────────────────┐                       │
│ │ Workspace preset ▾              │                       │
│ │ [Tekst→beeld] [Beeld→beeld]     │                       │
│ │ Prompt: ___________             │                       │
│ │ [Genereren]                     │                       │
│ │ [kleine preview]                │                       │
│ └─────────────────────────────────┘                       │
│ ┌ Formaten (Sharp) ─────────────┐                         │
│ └───────────────────────────────┘                         │
│ ┌ Nabewerking (Sharp, geen AI) ─┐                         │
│ │ overlay, logo, bg, brightness  │                         │
│ └───────────────────────────────┘                         │
│ ┌ Bibliotheek ──────────────────┐                         │
│ │ "user prompt + ENRICHMENT…"   │  ← BUG                  │
│ └───────────────────────────────┘                         │
└───────────────────────────────────────────────────────────┘
```

**Doel (Artlist-pattern):**

```
┌────────────────────── full width main ────────────────────┐
│ Content Studio                              [Meer ▾]      │
│                                                           │
│  ████  ████  ████  ████  ████  ████  ← hero output grid  │
│  ████  ████  ████  ████                                  │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ Beeld | Video   Beschrijf wat je wilt maken…              │
│ + Image Ref     Nano Banana 2 ▾              [⚙] [▶]    │
└───────────────────────────────────────────────────────────┘
```

---

## 13. Open punten voor review

1. **3K kwaliteit:** Nano Banana 2 ondersteunt geen native 3K — UI disable voor NB2, of map naar 2K met label "≈3K"?  
2. **Count 5:** NB2 max 4/request — tweede silent request OK?  
3. **URL rename:** `/photo-studio` → `/content-studio` — Phase B of never?  
4. **Sidebar label:** "Content Studio" vs "Beelden" vs "Foto's" (Fumero jargon doc suggereerde "Foto's").  
5. **Screenshots:** Gebruiker kan Foto 1–5 opnieuw attach'en voor pixel-level polish pass.  
6. **Light vs dark default:** Content Studio dark-first (Artlist) of follow workspace theme toggle?  

---

## Bijlage A — Bestandsindex (huidig)

```
components/photo-studio/
├── photo-studio-panel.tsx       ← shell refactor → Content Studio
├── photo-studio-generator.tsx   ← vervangen door prompt bar
├── photo-studio-output.tsx      ← tile actions
├── photo-studio-library-strip.tsx
├── photo-studio-carousel.tsx    ← Meer
├── photo-studio-menu-batch.tsx  ← Meer
└── photo-studio-post-process.tsx ← Meer

lib/photo-studio/
├── fal.ts                         ← model registry (kern)
├── library.ts                     ← user_prompt fix
├── workspace-presets.ts           ← UI decouple
├── resize-variants.ts             ← behouden
└── types.ts

app/fumero/photo-studio/page.tsx
app/bokas/photo-studio/page.tsx
app/api/photo-studio/generate/route.ts
```

## Bijlage B — fal.ai endpoint referentie

| Model | Endpoint |
|-------|----------|
| Nano Banana 2 T2I | `https://fal.run/fal-ai/nano-banana-2` |
| Nano Banana 2 Edit | `https://fal.run/fal-ai/nano-banana-2/edit` |
| Seedream 5 Lite T2I | `https://fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image` |
| Seedream 5 Lite Edit | `https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit` |
| GPT Image 2 T2I | `https://fal.run/openai/gpt-image-2` |
| GPT Image 2 Edit | `https://fal.run/openai/gpt-image-2/edit` |

Documentatie: [fal.ai/nano-banana-2](https://fal.ai/models/fal-ai/nano-banana-2/api), [Seedream 5 Lite](https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image), [GPT Image 2](https://fal.ai/models/openai/gpt-image-2).

---

*Einde spec — klaar voor review vóór implementatie (Phase A).*
