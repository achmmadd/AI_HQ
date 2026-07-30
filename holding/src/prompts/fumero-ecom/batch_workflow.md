# Fumero Blog — Batch Generatie Workflow

> Workflow voor het in één keer genereren van alle benodigde afbeeldingen per blogartikel van Fumero.nl.

---

## Stap 1 — Artikelgegevens verzamelen

Vul voor elk nieuw blogartikel in:

| Veld | Invullen |
|------|----------|
| **Artikel-slug** | bijv. `beste-espressomachines-2025` |
| **Hoofd-zoekwoord** | bijv. `beste espressomachines 2025` |
| **Product/onderwerp** | bijv. `espressomachine` |
| **Aantal inline beelden** | bijv. `2` |
| **Comparison nodig?** | ja / nee |

---

## Stap 2 — Beeldtypen per artikel bepalen

Standaard batch per blogartikel:

| Prioriteit | Beeldtype | Verplicht? |
|------------|-----------|-----------|
| 1 | **Hero image** (1200×628) | ✅ Altijd |
| 2 | **OG image** (1200×630) | ✅ Altijd |
| 3 | **Featured image** (800×450) | ✅ Altijd |
| 4 | **Inline illustration** (800×500) | ✅ Minstens 1 |
| 5 | **Comparison image** (1000×600) | 🔲 Indien vergelijkingsartikel |

---

## Stap 3 — Prompts genereren (gebruik `prompts.md`)

Gebruik de templates uit `prompts.md`. Vul in per beeldtype:

```
Artikel: beste-espressomachines-2025
Zoekwoord: beste espressomachines 2025
Product: espressomachine

→ hero:       "Premium product photography of a high-end espresso machine..."
→ og-image:   "Clean, professional product image of an espresso machine..."
→ featured:   "Styled product flatlay of espresso machine accessories..."
→ inline-01:   "Detailed close-up of espresso machine portafilter..."
→ inline-02:   "Detailed close-up of espresso machine steam wand..."
→ comparison: "Side-by-side product comparison of manual vs automatic espresso machine..."
```

---

## Stap 4 — Generatie uitvoeren

Genereer alle beelden via je beeldgeneratietool (bijv. DALL-E, Midjourney, Stable Diffusion).

**Volgorde aanbevolen:**
1. Hero (meeste aandacht, stel eventueel bij)
2. OG image (op basis van hero-resultaat)
3. Featured (cropped variant van hero indien mogelijk)
4. Inline (per alinea)
5. Comparison (laatste, meest complex)

---

## Stap 5 — Opslaan met juiste bestandsnamen

Gebruik de naamconventie uit `bestandsnamen.md`:

```
fumero-beste-espressomachines-2025-hero.jpg
fumero-beste-espressomachines-2025-og.jpg
fumero-beste-espressomachines-2025-featured.jpg
fumero-beste-espressomachines-2025-inline-01.jpg
fumero-beste-espressomachines-2025-inline-02.jpg
fumero-beste-espressomachines-2025-comparison.jpg
```

---

## Stap 6 — Alt-teksten toevoegen in CMS

Gebruik de suggesties uit `seo_alt_tekst.md` om bij elk beeld de juiste SEO alt-tekst in te vullen vóór publicatie.

---

## Doorlooptijd

| Artikeltype | Benodigde beelden | Geschatte tijd |
|------------|-------------------|---------------|
| Standaard blog | 4 (hero + og + featured + 1 inline) | ~5–8 min |
| Vergelijkingsartikel | 6 (+ 1 inline extra + comparison) | ~8–12 min |
| Top-X gids | 5–7 (+ meerdere inline) | ~10–15 min |
