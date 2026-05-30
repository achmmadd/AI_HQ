# Fumero Studio — Design Spec v1

**Project:** `/home/pietje/AI_HQ/ai-motor` (Next.js 15, poort 3040)  
**Datum:** 30 mei 2026  
**Status:** Research + spec — **geen code-wijzigingen**  
**Doel:** Pro-niveau UI (Linear / Stripe / Vercel / Anthropic console) die in 5 seconden te begrijpen is voor dagelijkse gebruikers (opa-proof), zonder AI-startup glassmorphism.

---

## 1. Samenvatting

Fumero Studio heeft al een solide basis (`fumero-ops.css`, Geist, groen accent `#69C400`, 8px-grid intentie), maar voelt **bulky en cramped** door:

| Probleem | Component / locatie | Impact |
|----------|---------------------|--------|
| Groot logo in bordered box | `FumeroLogoLockup` in `fumero-sidebar.tsx` | Sidebar voelt zwaar; weinig ruimte voor nav |
| Drie horizontale stroken boven chat | `FumeroChatKpiStrip` + `FumeroBriefingStrip` + `FumeroTopbar` | Visuele overload vóór de primaire actie |
| Jargon in empty state | `motors-chat-panel.tsx` L2377–2378 | "Flash", "+ voor canvas/coder/online" — niet opa-proof |
| Box-in-box composer | `fumero-composer-shell` + KPI-cells + starter cards | Stripe/Linear gebruiken vlakke oppervlakken + dividers |
| Coder toolbar overload | `FumeroComposerToolbar` + `coderExtras` in `motors-chat-panel.tsx` | 6+ pills naast elkaar (Plan, Visual edits, Garage, Connectors, Turbo) |
| Alleen light mode geforceerd | `FumeroWorkspaceRoot` verwijdert `.dark` | Geen designed dark mode |
| MotorsAI-lekkage | `motors-chat-panel.tsx`, `fumero-sidebar.tsx` | White-label breekt |

**North star:** Eén duidelijke primaire actie per scherm, Max als herkenbare assistent, groen alleen voor actie/succes, rest neutraal en luchtig.

---

## 2. Benchmark-principes (vertaald, niet gekopieerd)

| Benchmark | Principe voor Fumero | Concrete vertaling |
|-----------|---------------------|-------------------|
| **Linear** | Ruimte, kalmte, dunne sidebar | Sidebar 200px, nav-items 32px hoog, actieve state = 2px linkse accent-lijn i.p.v. groene achtergrond |
| **Stripe** | Clarity, cards, light mode | Wit canvas `#FAFAFA`, cards met 1px border geen zware shadow; één hero-metric per sectie |
| **Vercel** | Technical credibility, designed dark | Donkergrijs `#0C0C0E`, borders `rgba(255,255,255,0.08)`, monospace voor IDs/versies |
| **Anthropic console** | Restrained | Geen gradients, geen blur-decoratie; max 1 accentkleur |
| **Sidebar-ref (screenshot)** | Collapsed 56px / expanded ~200px | Icon-only mobiel/desktop-collapse; zoek in sidebar optioneel later |

**Expliciet vermijden:** glassmorphism (`backdrop-blur` op KPI-strip), gradient toys, paarse plan-modus tekst, emoji in chrome, meerdere groene elementen tegelijk.

---

## 3. Logo + sidebar — afmetingen

### 3.1 Huidige staat

```tsx
// fumero-sidebar.tsx
aside: w-14 (56px) md:w-[var(--fumero-sidebar-w,240px)]
--fumero-sidebar-w: 240px  // fumero-ops.css

// fumero-logo-lockup.tsx (compact)
rounded-2xl border px-3 py-2
Image: width={260} height={78} min-w-[128px]  // visueel ~78px hoog in sidebar
Tagline: "Product & operations" text-xs mt-2
```

### 3.2 Doel-afmetingen

| Element | Nu | Doel | Principe |
|---------|-----|------|----------|
| Sidebar breed (expanded) | 240px | **200px** | space |
| Sidebar collapsed | 56px | **56px** (behouden) | modern |
| Logo lockup container | bordered box 128×~40+ px | **Geen box** — alleen wordmark | clarity |
| Logo image (wordmark) | ~128×40 effective | **max 112×28 px** display | space |
| Logo + workspace label | "Product & operations" | **"Studio"** of weglaten | clarity |
| Nav item hoogte | py-2 (~36px) | **32px** (py-1.5) | space |
| Nav icon | 16×16 | **16×16** stroke 1.5 | modern |
| Nav label | text-sm (14px) | **13px** medium | hierarchy |
| Active nav | groene bg 8% | **2px left border `#69C400`** + `bg-transparent` | trust |
| Sidebar header padding | px-4 py-4 | **px-16 py-16** (16px) | 8px grid |
| Topbar hoogte | h-12 (48px) | **48px** (behouden) | — |
| Main content padding | p-6 (24px) | **24px** desktop / **16px** mobiel | 8px grid |

### 3.3 Sidebar-navigatie (hernoemen waar nodig)

| Huidig label | Voorstel | Reden |
|--------------|----------|-------|
| Chat | **Max** of **Assistent** | Merk + opa-proof |
| Photo Studio | **Foto's** | Korter NL |
| Automations | **Automatisering** | Geen Engels jargon |
| Bibliotheek | **Bibliotheek** | OK |
| Apps | **Apps** | OK |
| Orders | **Bestellingen** | NL-first |
| Motor Chat (lab) | **Verwijderen** of "Geavanceerd ↗" in footer settings | white-label / trust |

---

## 4. Typografie — Geist schaal (exact px)

Gebaseerd op huidige mix (10–15px) en benchmark body 13–14px. **Eén font:** Geist (`--font-geist`), geen Poppins in Fumero scope.

| Token | Size | Line-height | Weight | Gebruik | Component-voorbeeld |
|-------|------|-------------|--------|---------|---------------------|
| `text-display` | **28px** | 36px (1.29) | 600 | Empty-state greeting | `motors-chat-panel` h2 empty |
| `text-h1` | **24px** | 32px (1.33) | 600 | Paginatitel | `PhotoStudioPanel` h1, `FumeroPageHeader` |
| `text-h2` | **18px** | 26px (1.44) | 600 | Sectiekop | Garage "Tools & widgets" |
| `text-h3` | **15px** | 22px (1.47) | 600 | Card-titel | `FumeroChatStarterCards` title |
| `text-body` | **14px** | 22px (1.57) | 400 | Body, chat bubbles | `fumero-canvas-doc`, composer textarea |
| `text-body-sm` | **13px** | 20px (1.54) | 400 | Nav, breadcrumbs, descriptions | sidebar links, topbar |
| `text-caption` | **12px** | 16px (1.33) | 500 | Labels, badges, meta | status badges, tool meta |
| `text-micro` | **11px** | 14px (1.27) | 500 | KPI labels, timestamps | `FumeroChatKpiStrip` — **max 1 rij per view** |
| `text-mono` | **12px** | 16px | 400 (Geist Mono) | Versies, order-IDs | `Concept v2` → `Versie 2 · concept` |

**Wijzigingen t.o.v. nu:**
- Empty-state subtitle: 15px → **14px**, max-width **480px**
- KPI strip labels: 10px uppercase → **11px sentence case** ("Bibliotheek" i.p.v. "BIBLIOTHEEK")
- Briefing strip: 11px + 12px → uniform **13px** summary, **11px** timestamp

---

## 5. Spacing — 8px grid

| Token | Waarde | Toepassing |
|-------|--------|------------|
| `space-1` | 8px | Icon-gap, compact lists |
| `space-2` | 16px | Card padding compact, nav item gap |
| `space-3` | 24px | Page padding, section gap, card padding default |
| `space-4` | 32px | Empty-state vertical gap, section headers |
| `space-5` | 48px | Page header → content, grote secties |

### Whitespace-audit (nested boxes flattenen)

| Locatie | Nu | Doel | Principe |
|---------|-----|------|----------|
| Chat empty home | KPI strip + briefing + bordered composer shell + 4 starter cards met shadow | **Alleen** greeting + 4 vlakke starter tiles + composer zonder dubbele border | space |
| `fumero-composer-shell` | border + shadow-sm + shadow-md + focus ring | **1px border**, shadow alleen on focus | clarity |
| `FumeroChatKpiStrip` | witte strip met 4 cells + divide-x | **Verplaatsen** naar sidebar footer of Cmd+K; niet boven composer | clarity |
| `PhotoStudioGenerator` | rounded-xl border shadow-sm p-4 | **Geen outer card** — form op page bg, output in apart paneel | space |
| `FumeroToolsGarage` cards | border + shadow hover lift | border-only, hover = border-color change (geen translateY) | trust |
| Coder split | chat column + preview rail beide `#FAFAFA` + borders | chat **wit**, preview **#FAFAFA** — één scheiding | hierarchy |

---

## 6. Dark mode — designed tokens (shadcn-style)

Fumero forceert nu light (`FumeroWorkspaceRoot` verwijdert `.dark`). Spec: **dual theme** via `[data-fumero-ops]` met `data-theme="light"|"dark"` of class toggle, light blijft default.

### 6.1 Light mode (behouden + harmoniseren)

```css
[data-fumero-ops] {
  --fumero-bg: #FAFAFA;
  --fumero-surface: #FFFFFF;
  --fumero-surface-muted: #F5F5F5;
  --fumero-border: #E5E5E5;
  --fumero-border-subtle: #F0F0F0;
  --fumero-text: #171717;
  --fumero-text-muted: #737373;
  --fumero-text-subtle: #A3A3A3;
  --fumero-accent: #69C400;
  --fumero-accent-hover: #5DB000;
  --fumero-accent-muted: rgba(105, 196, 0, 0.08);
  --fumero-accent-foreground: #FFFFFF;
  --fumero-destructive: #DC2626;
  --fumero-sidebar-w: 200px;
  --fumero-radius: 8px;
  --fumero-radius-lg: 12px;
  --fumero-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

### 6.2 Dark mode (nieuw — Vercel/Linear inspired, **niet** inverted)

```css
[data-fumero-ops][data-theme="dark"] {
  --fumero-bg: #0C0C0E;
  --fumero-surface: #141416;
  --fumero-surface-muted: #1A1A1D;
  --fumero-surface-elevated: #1C1C1F;
  --fumero-border: rgba(255, 255, 255, 0.08);
  --fumero-border-subtle: rgba(255, 255, 255, 0.05);
  --fumero-text: #EDEDEF;           /* niet #FFFFFF */
  --fumero-text-muted: #8B8B8F;
  --fumero-text-subtle: #5C5C61;
  --fumero-accent: #69C400;         /* enige chromatic accent */
  --fumero-accent-hover: #7AD917;
  --fumero-accent-muted: rgba(105, 196, 0, 0.12);
  --fumero-accent-foreground: #0C0C0E;
  --fumero-destructive: #F87171;
  --fumero-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  color-scheme: dark;
}
```

### 6.3 Accent-regels (beide modes)

- `#69C400` **alleen** voor: primary button, send button, success badge, active focus ring, health dot OK, link hover op primaire CTA
- **Niet** groen: nav active bg (nu wel), user chat bubbles, alle mode pills tegelijk, KPI numbers
- Secundaire status: neutraal grijs; waarschuwing `#F59E0B`; fout `#DC2626` / dark `#F87171`

### 6.4 Mapping naar shadcn-variabelen

```css
--background: var(--fumero-bg);
--foreground: var(--fumero-text);
--card: var(--fumero-surface);
--card-foreground: var(--fumero-text);
--muted: var(--fumero-surface-muted);
--muted-foreground: var(--fumero-text-muted);
--border: var(--fumero-border);
--primary: var(--fumero-accent);
--primary-foreground: var(--fumero-accent-foreground);
--ring: rgba(105, 196, 0, 0.35);
```

---

## 7. Jargon → heldere taal

| Huidig | Probleem | Voorstel UI-copy | Context |
|--------|----------|------------------|---------|
| **Flash / Normaal / Pro** | Model-intern jargon | **Snel / Standaard / Grondig** | `FUMERO_MODEL_TIERS` pill |
| **Coder** | Dev-term | **Bouwen** | mode pill, + menu, starter card |
| **Canvas** | Onduidelijk | **Schrijven** (document rechts) | mode pill, menu |
| **Online** | Vaag | **Zoeken op internet** | mode pill |
| **Turbo** | Onbekend | **Uitgebreid** (tooltip: "Browser & automatisering") | `MotorTurboButton` |
| **Visual edits** | Engels | **Klik om te wijzigen** | coderExtras — alleen in overflow |
| **Connectors** | Tech | **Live shopdata** | menu + modal titel |
| **Garage** | Intern | **Mijn apps** | apps page, link in coder |
| **Concept v1** | Dev versioning | **Versie 1 · nog niet live** | `live-preview-panel`, `fumero-tool-card` |
| **Briefing** | OK maar abstract | **Dagoverzicht** | strip + panel titel |
| **Builder** | Intern | **Max** (altijd) | `fumeroBuilderLabel` |
| **Deploy** | Dev | **Online zetten** | tool card CTA |
| **Preview** | OK | **Voorbeeld** | NL variant optioneel |
| **Photo Studio** | Engels | **Productfoto's** | sidebar + page |
| **Menu-batch / Carousel** | Intern | **Meerdere foto's / Instagram carrousel** | photo studio tabs |
| **fal.ai** | Vendor | **Verwijderen uit UI** — "AI genereert je foto" | `PhotoStudioPanel` description |
| **AI Assistent** | Generiek | **Max** | `app/fumero/chat/page.tsx` page prop |
| **Product & operations** | Corporate | **Fumero Studio** of weg | sidebar tagline |
| **Motor Chat (lab)** | MotorsAI leak | **Verwijderen** | sidebar footer |
| **Flash is standaard, + voor…** | Onleesbaar | **"Typ je vraag — kies hieronder een startpunt"** | empty state |

---

## 8. Scherm-voor-scherm

### 8.1 Chat (default) — `FumeroMaxChatShell` + `MotorsChatWorkspace`

**Primaire actie:** Typ vraag aan Max → Enter.

#### Verwijderen / verbergen (progressive disclosure)

| Element | Actie | Principe |
|---------|-------|----------|
| `FumeroChatKpiStrip` | Verplaats naar sidebar footer (4 compacte getallen) of Cmd+K "Studio overzicht" | clarity |
| `FumeroBriefingStrip` | Collapse tot 1 regel; expand on click; default **ingeklapt** na eerste bezoek | space |
| Model tier pill | Default **Standaard**; verberg in "⋯" menu tenzij user expanded preferences | clarity |
| + menu secties "Data & sync" | Verplaats Connectors naar **Instellingen** of Cmd+K | Hick's Law |
| Turbo toggle | Verberg; alleen via Cmd+K of settings | clarity |
| Thread sidebar (gesprekken) | Default **dicht** op desktop; open via icon (Linear-style) | space |
| `AgentAvatar` large | Verklein naar 40px of vervang door "Max" wordmark | space |

#### Shrinks

| Element | Van → Na |
|---------|----------|
| Empty greeting | text-lg → **28px display**, één regel |
| Starter cards | 4 cards 2-col → **3 cards** (foto, schrijven, bestellingen) — coder via + menu |
| Composer min-height | 52px → **44px** |
| Composer border-radius | 16px → **12px** |
| Suggestion chips | Verberg op empty home (cards zijn genoeg) | |

#### Ruimte toevoegen

- Empty state: **48px** boven greeting, **32px** tussen cards en composer
- Chat messages: `space-y-6` → **space-y-24** (24px) consistent
- Max-width chat column: **720px** centered (Stripe invoice-width gevoel)

#### First-time 5 sec test

> *"Dit is Max, je assistent voor de Fumero shop. Typ een vraag of kies een kaart."*

Geen Flash/Coder/Canvas in eerste zin.

---

### 8.2 Coder (Bouwen-modus) — `?mode=coder` / composer mode `coder`

**Primaire actie:** Beschrijf wat je wilt bouwen → Max toont voorbeeld rechts.

#### Verwijderen / verbergen

| Element | Actie | Principe |
|---------|-------|----------|
| 3-step breadcrumb pills | Vervang door **statische hint** onder preview header (1× zichtbaar) | space |
| `Plan` button | Cmd+K "Eerst plan maken" | clarity |
| `Visual edits` | Alleen zichtbaar **nadat** preview geladen | progressive disclosure |
| `Kies uit garage` | Verplaats naar preview header dropdown | space |
| `Connectors` (dubbel) | Alleen in + menu, niet in coderExtras | clarity |
| `FumeroToolCard` inline iframe (split mode) | Alleen compact card + preview rechts (bestaand gedrag versterken) | clarity |
| Groene plan-modus tekst | Neutrale `#737373` hint | trust |

#### Shrinks

| Element | Van → Na |
|---------|----------|
| Preview rail width | max 55% → **50%**, min 320px | balance |
| `fumero-live-preview-header` | min 48px → **40px** | space |
| Coder composer pills | Max **2 zichtbaar** (mode + model); rest overflow "⋯" | clarity |

#### Toevoegen

- Preview header: **"Voorbeeld"** + status dot (bouwt / klaar / live)
- Primary CTA in preview: **"Online zetten"** (was Deploy)
- Empty preview: illustratie + *"Beschrijf je tool links — het voorbeeld verschijnt hier"*

---

### 8.3 Photo Studio — `PhotoStudioPanel`

**Primaire actie:** Genereer productfoto (tab 1).

#### Verwijderen / verbergen

| Element | Actie | Principe |
|---------|-------|----------|
| Tabs Carousel + Menu-batch | Naar **"Meer" dropdown** of secundaire nav under page title | Hick's Law |
| `PhotoStudioPostProcess` | Collapsible sectie "Achteraf bewerken" | progressive disclosure |
| Dubbele headers | `FumeroShell` breadcrumb + `PhotoStudioPanel` h1 → **alleen h1** in content | clarity |
| `fal.ai` in copy | Verwijderen | opa-proof |

#### Shrinks

| Element | Van → Na |
|---------|----------|
| max-w-3xl | → **max-w-4xl** met 2-koloms layout: form links (360px), output rechts | hierarchy |
| Tab pills zwart | Primary tab = **underline** i.p.v. filled black pill | modern |
| Generator card border+shadow | Flat form fields op `--fumero-bg` | space |

#### Layout doel (desktop)

```
┌─────────────────────────────────────────────────┐
│ Productfoto's                    [Genereer foto]│  ← enige primary CTA top-right
├──────────────────┬──────────────────────────────┤
│ Form (360px)     │ Output preview (flex)        │
│ - preset         │ - large image                │
│ - prompt         │ - download / bibliotheek     │
│ - upload         │                              │
└──────────────────┴──────────────────────────────┘
│ Bibliotheek strip (horizontal scroll, 1 row)    │
└─────────────────────────────────────────────────┘
```

---

## 9. Animaties — functioneel overzicht

| Animatie | Wat het communiceert | Duur / easing | Implementatie | Principe |
|----------|---------------------|---------------|---------------|----------|
| Composer focus ring | "Hier typ je" | 150ms ease | **CSS** `border-color, box-shadow` (bestaat) | clarity |
| Composer drag-over | "Laat bestand los" | 150ms | **CSS** `.fumero-composer-drag` | clarity |
| Card hover | Klikbaar | 150ms | **CSS** border-color only (geen translateY) | trust |
| KPI count-up | Data geladen | 400ms ease-out | **CSS** `@property` of lightweight JS; geen Framer nodig | modern |
| Skeleton pulse | Laden | 1.5s infinite | **CSS** `animate-pulse` (bestaat in `FumeroSkeleton`) | clarity |
| Toast in/out | Feedback | 200ms ease | **CSS** `.fumero-toast` (bestaat) | clarity |
| Briefing panel slide | Context openen | 250ms ease-out | **Framer Motion** `x: 100% → 0` op `MaxBriefingDetailPanel` | modern |
| Preview panel resize | Split view | 200ms | **CSS** `transition: width` | space |
| Status badge change | Live / concept | 200ms | **CSS** opacity crossfade | trust |
| Deploy success banner | Gepubliceerd | 250ms ease-out | **CSS** `fumero-deploy-success-in` (bestaat) | trust |
| Thread list item | Nieuw gesprek | 150ms | **CSS** fade | — |
| Page route change | Navigatie | — | **Geen** page transition (Next.js App Router snappy) | trust |

### Library-aanbeveling (Next.js 15)

| Use case | Aanbeveling | Reden |
|----------|-------------|-------|
| Hover, focus, skeleton, toast | **CSS-only** | Geen bundle cost; Fumero gebruikt Framer nergens nu |
| Briefing/detail drawer | **Framer Motion** (lazy import) | `framer-motion` ^11.15 al in project; dynamic import in panel only |
| Cmd+K palette | **cmdk** (nieuw) + CSS | Standaard voor command palettes; geen motion lib nodig |
| KPI count-up | **CSS of 10 regels JS** | Avoid Framer voor cijfers |

**Performance:** Geen `framer-motion` in layout.tsx; alleen dynamic in client panels. Respect `prefers-reduced-motion: reduce` → alle transitions → 0ms.

---

## 10. Cmd+K — haalbaarheid + acties

**Haalbaarheid: hoog.** Geen bestaande implementatie in Fumero; `cmdk` package toevoegen (~3–4u implementatie). Trigger: `Cmd+K` / `Ctrl+K` global binnen `[data-fumero-ops]`.

### Voorgestelde acties

| Groep | Actie | Route / effect |
|-------|-------|----------------|
| **Navigatie** | Ga naar Max (chat) | `/fumero/chat` |
| | Productfoto's | `/fumero/photo-studio` |
| | Bibliotheek | `/fumero/bibliotheek` |
| | Bestellingen | `/fumero/orders` |
| | Mijn apps | `/fumero/apps` |
| | Automatisering | `/fumero/automations` |
| **Max** | Nieuwe vraag | focus composer, clear thread |
| | Bouw een tool | `/fumero/chat?mode=coder` |
| | Schrijf SEO-artikel | prefilled canvas mode |
| | Zoek op internet | online mode + focus |
| **Data** | Live shopdata aan/uit | open `FumeroConnectorsPanel` |
| | Studio overzicht | modal met KPIs (vervangt strip) |
| | Dagoverzicht | open `MaxBriefingDetailPanel` |
| **Weergave** | Light / Dark / Systeem | toggle theme |
| | Sidebar inklappen | layout store |
| **Instellingen** | Snelheid antwoord (Snel/Standaard/Grondig) | cycle model tier |

Palette styling: Vercel-style centered modal, `max-w-lg`, Geist 13px, groen alleen op geselecteerde rij (left border).

---

## 11. Component consistency audit

| Patroon | Huidige varianten | Standaard |
|---------|---------------------|-----------|
| Primary button | `#69C400` h-8, h-9 mixed | **h-36 (36px)**, radius 8px, font 13px semibold |
| Secondary button | border gray, ghost | border `--fumero-border`, bg transparent |
| Page header | `FumeroPageHeader` text-xl + shell breadcrumb dubbel | **Eén header** per page |
| Status badge | `FumeroStatusBadge` + inline pills | Altijd `FumeroStatusBadge` |
| Card | border+#shadow hover lift vs border-only | **border-only**, radius 12px, padding 24px |
| Modal | mixed shadow-xl | `--fumero-shadow-lg`, radius 12px |
| Input height | h-9 mixed | **36px** uniform |
| Icon stroke | 1.75 default | **1.5** overal in Fumero |

---

## 12. White-label: MotorsAI → Max

### 12.1 Fumero UI — direct zichtbaar (must fix)

| Bestand | Regel / context | Wijziging |
|---------|-----------------|-----------|
| `components/fumero/fumero-sidebar.tsx` | "Motor Chat (lab)" link | **Verwijderen** of vervangen door "Help ↗" |
| `components/motors-chat-panel.tsx` | "MotorsAI onthoudt context…" (L2317) | **"Max onthoudt dit gesprek"** — check `workspace === "fumero"` |
| `components/motors-chat-panel.tsx` | Empty state noemt Flash/canvas/coder | Zie jargon sectie |
| `app/fumero/chat/page.tsx` | `page="AI Assistent"` | **`page="Max"`** |
| `lib/chat-prompt.ts` | System prompt "MotorsAI" | **"Max"** voor klant fumero (backend, geen UI maar wel white-label) |

### 12.2 Fumero-adjacent (indirect zichtbaar)

| Bestand | Context |
|---------|---------|
| `components/motors-chat-workspace.tsx` | Importnaam Motors* — OK intern, geen UI |
| `lib/fumero-quick-actions.ts` | Comment "Motor AI engine" — doc only |
| `lib/openrouter-gateway.ts` | Header `X-Title: MotorsAI` — API metadata |

### 12.3 Buiten Fumero scope (niet in deze redesign, wel audit)

MotorsAI komt **80+ keren** voor in repo (landing page, manifest, login, docs, env vars `MOTORSAI_*`). Voor Fumero white-label:

- **UI/copy:** alle user-facing strings in `/fumero/*` + shared components when `workspace === "fumero"`
- **Niet hernoemen:** env vars, cookies (`motorsai_token`), API headers — breaking changes
- **manifest.json / layout.tsx title:** apart ticket als product "Max" heet op home screen

---

## 13. Per wijziging — principes matrix

| # | Wijziging | clarity | space | trust | modern |
|---|-----------|---------|-------|-------|--------|
| 1 | Sidebar 200px + dun wordmark | | ✓ | ✓ | ✓ |
| 2 | KPI strip uit chat flow | ✓ | ✓ | | |
| 3 | Jargon → NL (Snel/Bouwen/Schrijven) | ✓ | | ✓ | |
| 4 | Flatten composer double box | ✓ | ✓ | ✓ | |
| 5 | Dark mode tokens | | ✓ | ✓ | ✓ |
| 6 | Groen alleen op primary CTA | ✓ | | ✓ | ✓ |
| 7 | Coder overflow menu | ✓ | ✓ | | ✓ |
| 8 | Photo studio 2-col | ✓ | ✓ | | ✓ |
| 9 | Cmd+K palette | ✓ | ✓ | ✓ | ✓ |
| 10 | MotorsAI → Max copy | ✓ | | ✓ | |
| 11 | CSS-first animations | | | ✓ | ✓ |
| 12 | Active nav left border | | ✓ | ✓ | ✓ |

---

## 14. Implementatie-volgorde (suggestie voor build-fase)

1. **Tokens + typography** — `fumero-ops.css` uitbreiden, hardcoded `#171717` migreren  
2. **Sidebar + logo** — `FumeroLogoLockup`, `FumeroSidebar`  
3. **Chat empty state + copy** — `motors-chat-panel`, `composer-model-tier`, `composer-actions`  
4. **Strip reductie** — KPI → sidebar/footer; briefing collapse  
5. **Coder overflow** — `coderExtras` refactor  
6. **Photo studio layout** — `PhotoStudioPanel`  
7. **Dark mode toggle** — `FumeroWorkspaceRoot` + topbar icon  
8. **Cmd+K** — nieuw component + hook  
9. **White-label sweep** — grep `MotorsAI` in fumero code paths  
10. **Animaties** — briefing panel Framer lazy; rest CSS polish  

---

## 15. Acceptatiecriteria (visueel)

- [ ] Nieuwe gebruiker begrijpt binnen **5 sec** dat Max de shop-assistent is  
- [ ] Max **1** groene primary CTA per scherm zichtbaar  
- [ ] Sidebar logo ≤ **28px** hoog, geen border-box  
- [ ] Chat empty state: **≤ 3** horizontale chrome-balken boven composer  
- [ ] Dark mode: geen pure `#000` bg, geen pure `#FFF` text  
- [ ] Geen "MotorsAI", "Flash", "Coder", "Canvas" in Fumero user copy  
- [ ] Cmd+K opent binnen **100ms**, 10+ acties navigeerbaar  
- [ ] `prefers-reduced-motion` respecteert animaties  

---

## Bijlage A — Huidige component inventory

```
components/fumero/
├── fumero-shell.tsx          — layout wrapper (sidebar + topbar + main)
├── fumero-sidebar.tsx        — 240px nav
├── fumero-topbar.tsx         — 48px breadcrumb bar
├── fumero-composer-toolbar.tsx — + menu, model tier, mode pills
├── fumero-logo-lockup.tsx    — bordered logo (te groot)
├── max/
│   ├── fumero-max-chat-shell.tsx
│   ├── fumero-briefing-provider.tsx
│   └── max-briefing-detail-panel.tsx
├── ops/
│   ├── fumero-chat-kpi-strip.tsx
│   ├── fumero-briefing-strip.tsx
│   ├── fumero-chat-starter-cards.tsx
│   ├── fumero-page-header.tsx
│   ├── fumero-skeleton.tsx
│   └── fumero-workspace-health.tsx
└── features/                 — garage, bibliotheek, tool-card, etc.

styles/fumero-ops.css         — light tokens, composer, toast, coder split
app/fumero/chat/page.tsx      — Chat entry
app/fumero/photo-studio/page.tsx
```

## Bijlage B — Benchmark screenshots

Referenties opgeslagen in Cursor assets:
- Linear: drie-koloms, dunne sidebar, muted dark
- Stripe/Rocketship: light cards, blue accent (Fumero houdt groen i.p.v. blauw)
- Vercel: metric cards, flat borders, designed dark
- Sidebar-ref: collapsed 56px / expanded met search

---

*Einde spec — klaar voor review vóór implementatie.*
