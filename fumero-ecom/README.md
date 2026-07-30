# Fumero.nl — Productbeeld Workflow

Snelle, schaalbare en SEO-ready productbeelden voor Fumero.nl via **Flair AI** + **Canva Pro**.

## 📦 Productcategorieën
- Vapes
- Gummies
- Cookies
- Truffels
- Candy

---

## 🗂️ Mapstructuur

```
fumero-ecom/
├── README.md                    ← dit bestand
├── input/                       ← plaatsen hier product-PNG's (transparant)
├── output/                      ← gegenereerde en geëxporteerde beelden
├── workflow/
│   ├── flair-ai-instructions.md ← Flair AI stap-voor-stap
│   ├── canva-pro-instructions.md← Canva Pro stap-voor-stap
│   ├── batch-templates.md       ← batch verwerking tips
│   └── seo-export-pipeline.md   ← SEO naamgeving & export
├── prompts/
│   └── prompt-templates.md      ← Flair AI prompt-templates per categorie
├── config/
│   ├── image-sizes.json         ← afmetingen per kanaal
│   └── canva-brand-kit.json     ← Canva Brand Kit definitie
└── templates/
    ├── batch-social.json        ← batch-config social media
    └── batch-blog.json          ← batch-config blog/webshop
```

---

## 🔄 Flowdiagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FUMERO PRODUCT IMAGE FLOW                   │
└─────────────────────────────────────────────────────────────────┘

  [1] Productfoto's voorbereiden
       │  Raw foto of product PNG (transparante achtergrond)
       ▼
  [2] Flair AI — Achtergrond & Scène
       │  Laad product-PNG
       │  Kies prompt-template (zie prompts/prompt-templates.md)
       │  Genereer 3–5 varianten
       │  Selecteer beste resultaat
       ▼
  [3] Export uit Flair AI
       │  Download PNG/JPG (max resolutie)
       │  Bestandsnaam: {categorie}-{product}-{variant}-raw.png
       ▼
  [4] Canva Pro — Layout & Branding
       │  Importeer afbeelding
       │  Gebruik Brand Kit (config/canva-brand-kit.json)
       │  Pas template toe (socialmedia / blog)
       │  Voeg logo, tagline, achtergrondkleur toe
       ▼
  [5] SEO Export
       │  Bestandsnaam: {categorie}-{product-naam}-{formaat}-fumero.jpg
       │  Alt-tekst schema (zie seo-export-pipeline.md)
       │  Resize per kanaal (config/image-sizes.json)
       ▼
  [6] Publiceren
       ├── Blog / Webshop  → upload via CMS
       ├── Instagram        → feed + stories formaat
       ├── Facebook         → post + banner
       └── WhatsApp Status  → 9:16 crop
```

---

## ⚡ Snelstart

1. Pak een productfoto (transparante PNG of vrijstaand op witte achtergrond).
2. Open [Flair AI](https://flair.ai) → kies de juiste prompt uit `prompts/prompt-templates.md`.
3. Download het beste resultaat.
4. Open Canva Pro → gebruik het juiste template uit `templates/`.
5. Exporteer volgens `workflow/seo-export-pipeline.md`.
6. Upload naar je platform.

**Gemiddelde doorlooptijd per product: ~15 minuten.**

---

## 📋 Benodigdheden

| Tool | Licentie | Gebruik |
|------|----------|---------|
| Flair AI | Pro (maandelijks) | Achtergrond & scène generatie |
| Canva Pro | Pro (maandelijks) | Layout, branding, templates |
| Photoshop / Remove.bg | Optioneel | Achtergrond verwijderen |

---

## 🔗 Links

- [Flair AI](https://flair.ai)
- [Canva Pro](https://www.canva.com/pro/)
- [Remove.bg](https://www.remove.bg) — gratis achtergrond verwijderen
- [TinyPNG](https://tinypng.com) — compressie voor web

---

*Bijgehouden door het Fumero.nl team — laatste update zie Git history.*
