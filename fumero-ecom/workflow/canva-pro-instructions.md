# Canva Pro — Stap-voor-stap Instructies

Na Flair AI verwerk je de gegenereerde productbeelden in Canva Pro voor de definitieve branding, layout en export.

---

## 🚀 Setup — Brand Kit

Zorg dat de **Fumero Brand Kit** is geladen in Canva Pro.

**Brand Kit locatie:** `Canva Pro → Brand Hub → Fumero.nl`

De volledige Brand Kit definitie staat in `config/canva-brand-kit.json`. Importeer handmatig via:
1. **Canva Pro** → Brand Hub → **"Add Brand"**
2. Upload logo's, stel kleuren en lettertypes in zoals gedefinieerd in het JSON-bestand.

---

## 📐 Templates Overzicht

Gebruik de juiste template per kanaal:

| Kanaal | Formaat | Canva Template Naam |
|--------|---------|---------------------|
| Webshop productfoto | 1000 × 1000 px | `Fumero-Product-Square` |
| Instagram feed | 1080 × 1080 px | `Fumero-Insta-Feed` |
| Instagram Stories | 1080 × 1920 px | `Fumero-Insta-Story` |
| Facebook post | 1200 × 630 px | `Fumero-FB-Post` |
| Facebook banner | 820 × 312 px | `Fumero-FB-Banner` |
| Blog header | 1200 × 628 px | `Fumero-Blog-Header` |
| WhatsApp Status | 1080 × 1920 px | `Fumero-WA-Status` |
| Pinterest | 1000 × 1500 px | `Fumero-Pinterest` |

> Alle afmetingen staan ook in `config/image-sizes.json`.

---

## 🎨 Stap 1 — Design openen

1. Open Canva Pro: [https://www.canva.com](https://www.canva.com)
2. Zoek naar de gewenste template (bijv. `Fumero-Insta-Feed`)
3. Klik **"Use template"**

---

## 🖼️ Stap 2 — Productafbeelding importeren

1. Klik links op **"Uploads"**
2. Upload het Flair AI resultaat (`{categorie}-{productnaam}-v1-raw.png`)
3. Sleep de afbeelding naar het canvas
4. Gebruik **Ctrl+Shift+F** (Fill) om het de achtergrond te laten vullen, **of** positioneer het product als centraal element

---

## 🏷️ Stap 3 — Tekst & Branding

### Logo
- Sleep het **Fumero logo** (wit of zwart, afhankelijk van achtergrond) vanuit Brand Assets
- Positie: rechtsonder of linksboven
- Grootte: maximaal 15% van de breedte

### Productnaam & Tagline
Gebruik de brand fonts:

```
Productnaam:  [Brand Font Bold]  →  bijv. "Strawberry Pie Vape"
Categorie:    [Brand Font Light] →  bijv. "Premium Vapes"
Prijs (opt.): [Brand Font Bold]  →  bijv. "€12,95"
Tagline:      [Brand Font Italic]→  bijv. "Vrij. Puur. Krachtig."
```

### Kleurvlakken
- Gebruik uitsluitend kleuren uit de **Fumero Brand Palette** (zie `config/canva-brand-kit.json`)
- Vermijd witte tekst op lichte achtergronden — gebruik een semi-transparante overlay

---

## ✨ Stap 4 — Stijl aanpassen per categorie

| Categorie | Accentkleur | Stijl |
|-----------|-------------|-------|
| Vapes | Midnight Blue `#1A1F36` | Dark, premium, minimalistisch |
| Gummies | Coral Pink `#FF6B6B` | Vrolijk, helder, speels |
| Cookies | Warm Amber `#E8A838` | Knus, warm, artisanaal |
| Truffels | Deep Purple `#4A1D6E` | Mystiek, luxe, exclusief |
| Candy | Electric Lime `#C2F03A` | Neon, pop, energiek |

---

## 🔧 Stap 5 — Kwaliteitscontrole in Canva

Controleer voor export:

- [ ] Logo zichtbaar en op de juiste positie
- [ ] Tekst leesbaar op alle schermformaten (minimaal 24pt voor mobiel)
- [ ] Geen visuele conflicten tussen tekst en productafbeelding
- [ ] Achtergrondkleur/stijl consistent met categorie
- [ ] Geen Canva watermerk zichtbaar (vereist Pro licentie)
- [ ] Afmetingen kloppen met het gewenste kanaal

---

## 💾 Stap 6 — Exporteren

### Webshop / Blog (JPG, hoge kwaliteit)
1. Klik **"Share"** → **"Download"**
2. Kies **JPG** → kwaliteit **100%**
3. Klik **"Download"**

### Transparant (PNG, voor hergebruik)
1. Klik **"Share"** → **"Download"**
2. Kies **PNG** → vink **"Transparante achtergrond"** aan
3. Klik **"Download"**

### Naamgeving bij export:
```
{categorie}-{productnaam}-{kanaal}-fumero.jpg

Voorbeelden:
vapes-strawberry-pie-insta-feed-fumero.jpg
gummies-tropical-mix-blog-header-fumero.jpg
cookies-chocolate-chunk-fb-post-fumero.jpg
truffels-gold-magic-pinterest-fumero.jpg
candy-rainbow-bites-wa-status-fumero.jpg
```

---

## 📦 Batch Export (meerdere formaten tegelijk)

Canva Pro ondersteunt **"Resize & Magic Switch"**:

1. Maak het design klaar in 1 formaat (bijv. 1080×1080)
2. Klik **"Resize"** (rechtsbovenin)
3. Voeg alle gewenste formaten toe (zie `config/image-sizes.json`)
4. Klik **"Resize design"** → Canva maakt automatisch alle varianten
5. Controleer elke variant en corrigeer waar nodig
6. Exporteer alle varianten als ZIP

---

## 🔗 Handige Canva Pro Sneltoetsen

| Actie | Sneltoets |
|-------|-----------|
| Kopie maken van element | Ctrl+D |
| Op scherm centreren | Ctrl+Shift+C |
| Groep maken | Ctrl+G |
| Achtergrondkleur wijzigen | Klik canvas → kleur kiezen |
| Alle lagen bekijken | Menu → Lagen |
| Uitlijnen | Selecteer elementen → Uitlijnen |
