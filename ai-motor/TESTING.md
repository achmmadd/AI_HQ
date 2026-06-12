# Campaign Studio — handmatige testchecklist

Gecombineerde flow: **Brand Kit → Campagnedoel → Concepten → Genereren → Preview / Download**

## Navigatie & routing

- [ ] Sidebar toont alleen **Campaign Studio** (geen aparte Brand Kit-link)
- [ ] `/fumero/brand-kit` redirect naar `/fumero/campaign-studio?step=brand`
- [ ] Campaign Studio opent op stap 1 (Brand Kit)

## Stap 1 — Brand Kit

- [ ] Product-URL import (Kings HHC) leest naam, prijs (€24,95), beschrijving en afbeeldingen
- [ ] Na succesvolle import + auto-bevestiging gaat wizard naar **Campagnedoel**
- [ ] Handmatig starten + logo/productfoto upload werkt
- [ ] Opgeslagen Brand Kits worden getoond
- [ ] Bevestigde kit selecteren via lijst werkt (checkmark + highlight)
- [ ] Concept-kit bewerken en bevestigen werkt
- [ ] **Volgende** is disabled zonder geselecteerde bevestigde kit
- [ ] **Terug** is disabled op stap 1

## State na refresh

- [ ] Refresh op stap 2+ behoudt `step`, `kit` en `goal` in URL + localStorage
- [ ] Refresh tijdens genereren valt terug op concepten-stap (geen hangende loader)

## Stap 2 — Campagnedoel

- [ ] Productnaam van geselecteerde kit zichtbaar
- [ ] Doelen: Verkoop, Bereik, Retargeting selecteerbaar
- [ ] **Genereer concepten** start strategie-API

## Stap 3 — Concepten

- [ ] 3 advertentieconcepten worden getoond
- [ ] Checkbox **Alleen strategy + copy** werkt
- [ ] **Genereer campaign pack** start generatie

## Stap 4–5 — Genereren & Preview

- [ ] Voortgangsmelding tijdens async job
- [ ] Copy sets, static creatives, video (indien FAL_KEY) in preview
- [ ] Download ZIP werkt
- [ ] Geen console errors

## Mobiel

- [ ] Sticky footer (Terug / Volgende) niet overlapt door bottom nav
- [ ] Import- en review-formulieren bruikbaar op smalle viewport

## Automatische tests

```bash
cd /home/pietje/AI_HQ/ai-motor
npx tsx --test lib/photo-studio/campaign/wizard-steps.test.ts
npx tsx --test lib/photo-studio/campaign/wizard-storage.test.ts
npx tsx --test lib/photo-studio/brand-kit/parse-product-page.test.ts
BASE_URL=http://127.0.0.1:3040 npx tsx scripts/test-campaign-flow.mjs
npm run build
```
