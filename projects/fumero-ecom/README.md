# Fumero Blog Beeldenworkflow — README

> **Dit project is uitsluitend voor het snel genereren van premium blog-illustraties voor de SEO-blogs van [Fumero.nl](https://fumero.nl).**  
> Geen social/pinterest/instagram focus — alle templates en configs zijn gericht op blog-workflows.

---

## Doel

Snelle, consistente generatie van **blog-ready afbeeldingen** voor Fumero's SEO-blogcontent:

| Beeldtype | Gebruik |
|-----------|---------|
| **Hero image** | Bovenaan blogartikel; groot formaat (1200×628 px) |
| **OG image** | Open Graph preview voor social shares & zoekmachines |
| **Featured image** | WordPress/CMS featured thumbnail |
| **Inline illustration** | Illustratie midden in artikel bij alinea's |
| **Comparison image** | Vergelijkingstabel of guide-visual in artikel |

---

## Structuur

```
projects/fumero-ecom/
  README.md           ← dit bestand
  profile.json        ← projectconfiguratie (kleuren, tone-of-voice, KPIs)

holding/src/prompts/fumero-ecom/
  prompts.md          ← snelle prompt-templates per beeldtype
  batch_workflow.md   ← stap-voor-stap workflow voor batch-generatie
  bestandsnamen.md    ← bestandsnaming-conventies voor blog-SEO
  seo_alt_tekst.md    ← SEO alt-tekst suggesties per beeldtype
  config.json         ← technische configuratie (formaten, afmetingen)
```

---

## Snelstart

1. Kies een blogartikel-onderwerp (bijv. "beste espressomachines 2025").
2. Open `prompts.md` en selecteer het gewenste beeldtype (hero / inline / comparison).
3. Vul het prompt-template in met het onderwerp en relevante zoekwoorden.
4. Gebruik `batch_workflow.md` voor het in één keer genereren van alle beelden per artikel.
5. Sla bestanden op met de naamconventie uit `bestandsnamen.md`.
6. Voeg de alt-tekst uit `seo_alt_tekst.md` toe bij het uploaden in het CMS.

---

## Stijlrichtlijnen Fumero.nl

- **Kleuren:** #1A1A1A (donker), #FFFFFF (wit), #C8A96E (goud accent)
- **Typografie:** Clean, premium sans-serif
- **Sfeer:** Helder, informatief, high-end product fotografie
- **Achtergrond:** Licht of neutraal; product altijd scherp en goed belicht
- **Geen:** Stockfoto-clichés, drukke achtergronden, social media-stickers/tekst-overlays

---

## Wat dit project NIET doet

- ❌ Geen Pinterest pins of Instagram posts
- ❌ Geen social media story-formaten (9:16)
- ❌ Geen carousel posts of TikTok-thumbnails
- ✅ Alleen blog-ready beelden voor Fumero.nl SEO-content
