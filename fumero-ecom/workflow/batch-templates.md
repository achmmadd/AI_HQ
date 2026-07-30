# Batch Templates — Workflow voor meerdere producten

Gebruik deze handleiding om meerdere producten tegelijk te verwerken en tijd te besparen.

---

## 🎯 Wanneer Batch gebruiken?

Gebruik de batch-workflow als je:
- **5 of meer producten** van dezelfde categorie moet verwerken
- Een **nieuwe productlijn** lanceert (bijv. nieuwe vapes collectie)
- **Seizoensgebonden content** maakt (bijv. feestdagen, zomer)
- **Kanaal-refresh** doet (alle Instagram foto's opnieuw in nieuw formaat)

---

## 📋 Batch Voorbereiding Checklist

Voordat je begint:

- [ ] Alle product-PNG's (transparante achtergrond) staan klaar in één map
- [ ] Bestandsnamen volgen de conventie: `{categorie}-{productnaam}-input.png`
- [ ] Prompt-template voor de categorie is gekozen (zie `prompts/prompt-templates.md`)
- [ ] Canva template is klaargemaakt voor het gewenste kanaal
- [ ] Exportmap aangemaakt: `output/{categorie}/{YYYY-MM}/`

---

## 🔄 Flair AI Batch Stappen

### 1. Collection aanmaken
```
Flair AI → Dashboard → "New Collection"
Naam: {Categorie} - {Maand/Kwartaal} - {Kanaal}
Voorbeeld: "Vapes - Q2 2025 - Instagram"
```

### 2. Bulk upload
- Sleep alle product-PNG's tegelijk naar de collection
- Flair verwerkt ze één voor één

### 3. Prompt toepassen op alle items
- Klik **"Select All"** in de collection
- Klik **"Apply Prompt to Selected"**
- Plak de categorie-prompt (uit `prompts/prompt-templates.md`)
- Kies **4 varianten per product**
- Klik **"Generate All"**
- Wacht (~2–5 min per product)

### 4. Bulk selectie & download
- Loop door de resultaten, markeer de beste variant per product met ⭐
- Filter op ⭐ → **"Download Starred"** → ZIP downloaden
- ZIP bevat: `{productnaam}-starred.png` per product

---

## 🎨 Canva Batch Stappen

### Methode A: Magic Switch (snelst, 1 product meerdere formaten)

1. Maak 1 design klaar (bijv. Instagram Feed 1080×1080)
2. Klik **"Resize"** → voeg alle benodigde formaten toe
3. Canva maakt automatisch alle formaten
4. Controleer & exporteer als ZIP

### Methode B: Template Dupliceren (meerdere producten, 1 formaat)

1. Open het Canva template (bijv. `Fumero-Insta-Feed`)
2. Klik op de pagina-thumbnail onderaan → **"Duplicate page"** voor elk product
3. Per pagina: vervang de productafbeelding en pas tekst aan
4. Exporteer als **meerdere pagina's in 1 PDF** of **ZIP met losse afbeeldingen**

### Methode C: Canva Bulk Create (voor grote batches met data)

1. Maak een CSV met productdata:

```csv
product_naam,categorie,prijs,tagline
Strawberry Pie,Vapes,12.95,"Vrij. Puur. Krachtig."
Tropical Mix,Gummies,8.95,"Zoet & Sappig."
Chocolate Chunk,Cookies,9.95,"Vers uit de oven."
Gold Magic,Truffels,24.95,"Mystiek & Exclusief."
Rainbow Bites,Candy,7.95,"Kleuren voor je smaak."
```

2. Canva Pro → **"Bulk Create"** → upload CSV
3. Koppel CSV-velden aan tekstvelden in je template
4. Canva genereert automatisch 1 design per rij
5. Exporteer alle als ZIP

> 📄 Zie `templates/batch-social.json` en `templates/batch-blog.json` voor voorbeeldconfiguraties.

---

## 📁 Bestandsstructuur Output

Organiseer je exports als volgt:

```
output/
├── vapes/
│   ├── 2025-Q2/
│   │   ├── strawberry-pie/
│   │   │   ├── vapes-strawberry-pie-insta-feed-fumero.jpg
│   │   │   ├── vapes-strawberry-pie-insta-story-fumero.jpg
│   │   │   ├── vapes-strawberry-pie-blog-header-fumero.jpg
│   │   │   └── vapes-strawberry-pie-webshop-fumero.jpg
│   │   └── blue-razz/
│   │       └── ...
├── gummies/
│   └── ...
├── cookies/
│   └── ...
├── truffels/
│   └── ...
└── candy/
    └── ...
```

---

## ⏱️ Tijdsinschatting Batch

| Batch grootte | Flair AI | Canva | Totaal |
|---------------|----------|-------|--------|
| 5 producten | ~25 min | ~20 min | ~45 min |
| 10 producten | ~50 min | ~40 min | ~1,5 uur |
| 20 producten | ~100 min | ~80 min | ~3 uur |
| 50 producten | ~4 uur | ~3,5 uur | ~7,5 uur |

> ⏱️ Schatting: ~5 min/product in Flair AI (genereren + selecteren), ~4 min/product in Canva (template aanpassen + exporteren). Eerste batch duurt langer door setup; herhaalde batches gaan sneller.

**Tip:** Zet Flair AI generaties aan het begin van de dag → verwerk in Canva terwijl Flair genereert.
