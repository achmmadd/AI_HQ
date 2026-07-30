# SEO & Image Export Pipeline

Zorg dat elke afbeelding optimaal is voor zoekmachines, snelle laadtijden en sociale platforms.

---

## 🎯 Waarom SEO voor afbeeldingen?

- Google indexeert productafbeeldingen → gratis organisch verkeer via **Google Images**
- Snelle laadtijden → betere **Core Web Vitals** → hogere rankings
- Juiste alt-teksten → beter vindbaar voor zoekopdrachten zoals *"vapes kopen nederland"*

---

## 📛 Bestandsnaam Conventies

**Format:**
```
{categorie}-{productnaam}-{kanaal}-fumero.{ext}
```

**Regels:**
- Alles **lowercase**
- Spaties vervangen door **koppeltekens** (`-`)
- Geen speciale tekens (`&`, `#`, `@`, etc.)
- Max 60 tekens voor de bestandsnaam
- Gebruik `.jpg` voor foto's (kleiner bestand), `.png` alleen voor transparantie

**Voorbeelden:**

| Product | Kanaal | Bestandsnaam |
|---------|--------|--------------|
| Strawberry Pie Vape | Webshop | `vapes-strawberry-pie-webshop-fumero.jpg` |
| Tropical Mix Gummies | Instagram Feed | `gummies-tropical-mix-insta-feed-fumero.jpg` |
| Chocolate Chunk Cookie | Blog Header | `cookies-chocolate-chunk-blog-header-fumero.jpg` |
| Gold Magic Truffels | Pinterest | `truffels-gold-magic-pinterest-fumero.jpg` |
| Rainbow Bites Candy | Facebook Post | `candy-rainbow-bites-fb-post-fumero.jpg` |

---

## 🏷️ Alt-tekst Schema

Gebruik dit schema voor alt-teksten bij upload naar CMS/webshop:

**Format:**
```
{Productnaam} {categorie} kopen bij Fumero.nl – {USP}
```

**Voorbeelden per categorie:**

```
# Vapes
alt="Strawberry Pie vape kopen bij Fumero.nl – premium kwaliteit"
alt="Blue Razz disposable vape Fumero – snel geleverd in Nederland"

# Gummies
alt="Tropical Mix gummies kopen bij Fumero.nl – lekker en zacht"
alt="CBD gummies assortiment Fumero – discreet thuisbezorgd"

# Cookies
alt="Chocolate Chunk cookies Fumero.nl – vers gebakken kwaliteit"
alt="Artisanale magic cookies kopen – Fumero premium collectie"

# Truffels
alt="Gold Magic truffels kopen Fumero.nl – exclusieve selectie"
alt="Psilocybine truffels assortiment Fumero – veilig en betrouwbaar"

# Candy
alt="Rainbow Bites candy Fumero – kleurrijke snoepjes kopen"
alt="Premium candy collectie Fumero.nl – feestelijke smaken"
```

---

## 📐 Resolutie & Compressie Pipeline

### Stap 1 — Export uit Canva

Exporteer altijd op **maximale resolutie** (Canva Pro geeft 4× schaal):
- Webformaten: `JPG 100%`
- Transparant/layered: `PNG`

### Stap 2 — Compressie (verplicht voor web)

Gebruik **TinyPNG** of **Squoosh** voor compressie:

| Tool | Methode | Verwachte reductie |
|------|---------|-------------------|
| [TinyPNG](https://tinypng.com) | Upload PNG/JPG → download | 60–80% kleiner |
| [Squoosh](https://squoosh.app) | Browser, meer controle | 50–90% kleiner |
| ImageOptim (macOS) | Desktop app | 40–70% kleiner |

**Doel bestandsgrootte:**

| Gebruik | Max bestandsgrootte |
|---------|---------------------|
| Webshop productfoto | ≤ 150 KB |
| Blog header | ≤ 200 KB |
| Instagram (upload) | ≤ 500 KB |
| Facebook (upload) | ≤ 500 KB |
| Pinterest | ≤ 300 KB |

### Stap 3 — Resize naar finale afmetingen

Zie `config/image-sizes.json` voor alle afmetingen per kanaal.

Gebruik voor bulk resize:
- **Canva Pro Resize** (in-tool, aanbevolen)
- **ImageMagick CLI** voor technische gebruikers:

```bash
# Resize voor webshop (1000×1000)
convert input.png -resize 1000x1000^ -gravity center -extent 1000x1000 output-webshop.jpg

# Resize voor Instagram Feed (1080×1080)
convert input.png -resize 1080x1080^ -gravity center -extent 1080x1080 output-insta.jpg

# Batch resize alle bestanden in een map
for f in *.png; do
  convert "$f" -resize 1080x1080^ -gravity center -extent 1080x1080 "resized/${f%.png}-insta.jpg"
done
```

---

## 📋 Export Checklist per Kanaal

### Webshop / WooCommerce

- [ ] Formaat: 1000 × 1000 px (vierkant)
- [ ] Bestandstype: JPG
- [ ] Bestandsgrootte: ≤ 150 KB
- [ ] Alt-tekst ingevuld volgens schema
- [ ] Bestandsnaam: SEO-vriendelijk
- [ ] Product-thumbnail variant: 300 × 300 px

### Instagram Feed

- [ ] Formaat: 1080 × 1080 px (of 1080 × 1350 px portrait)
- [ ] Bestandstype: JPG
- [ ] Bestandsgrootte: ≤ 500 KB
- [ ] Eerste frame bevat logo & productnaam

### Instagram Stories / Reels

- [ ] Formaat: 1080 × 1920 px
- [ ] Bestandstype: JPG (of MP4 voor video)
- [ ] Veilig zone: tekst binnen middelste 70%

### Facebook Post

- [ ] Formaat: 1200 × 630 px
- [ ] Bestandstype: JPG
- [ ] Tekst op afbeelding: ≤ 20% van het oppervlak

### Blog Header

- [ ] Formaat: 1200 × 628 px
- [ ] Bestandstype: JPG
- [ ] Alt-tekst bevat zoekwoord + locatie

---

## 🗂️ Upload Workflow CMS (WooCommerce / WordPress)

1. Open WordPress backend → **Media → Nieuwe media toevoegen**
2. Upload gecomprimeerde afbeelding
3. Vul in:
   - **Alt-tekst:** gebruik schema hierboven
   - **Titel:** `{Productnaam} – Fumero.nl`
   - **Beschrijving:** korte productomschrijving (optioneel)
4. Kopieer de afbeeldings-URL voor gebruik in het productformulier

---

## 🔍 SEO Zoekwoorden per Categorie

Verwerk deze zoekwoorden in alt-teksten en bestandsnamen:

| Categorie | Primair zoekwoord | Secundaire zoekwoorden |
|-----------|------------------|------------------------|
| Vapes | `vapes kopen` | `disposable vape nederland`, `e-sigaret kopen` |
| Gummies | `gummies kopen` | `cbd gummies nederland`, `fruitgummies bestellen` |
| Cookies | `cookies kopen` | `magic cookies nederland`, `eetbare koekjes` |
| Truffels | `truffels kopen` | `psilocybine truffels`, `magic truffels nederland` |
| Candy | `candy kopen` | `snoep online kopen`, `premium candy nederland` |
